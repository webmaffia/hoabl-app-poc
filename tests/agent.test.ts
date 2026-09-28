import { describe, expect, it } from "vitest";
import { runTurn, trimHistory, type AgentEvent } from "@/lib/agent/run";
import { emptyEvidence } from "@/lib/agent/guard";
import { emptyProfile } from "@/lib/agent/prompt";
import { getPlots } from "@/lib/inventory";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

type Step = { tool: string; args: object } | { say: string; intent?: string };

// A scripted stand-in for the OpenAI client: each create() returns the next step.
function fakeClient(steps: Step[]) {
  const requests: { messages: ChatCompletionMessageParam[]; tool_choice: unknown }[] = [];
  let i = 0;
  const client = {
    chat: {
      completions: {
        create: async (req: { messages: ChatCompletionMessageParam[]; tool_choice: unknown }) => {
          requests.push(req);
          const step = steps[i++];
          if (!step) throw new Error("fake client ran out of steps");
          const message =
            "tool" in step
              ? { role: "assistant", content: null, tool_calls: [{ id: `call_${i}`, type: "function", function: { name: step.tool, arguments: JSON.stringify(step.args) } }] }
              : {
                  role: "assistant",
                  content: JSON.stringify({
                    say: step.say,
                    chips: ["Tell me more"],
                    profile_updates: { purpose: "investment", budget_max: 4_500_000, horizon_years: null, region: "near Mumbai", funding: null },
                    intent: step.intent ?? "shortlisted",
                  }),
                };
          return streamOf(message);
        },
      },
    },
  };
  return { client: client as never, requests };
}

// Replays a message as streaming chunks, splitting content into small pieces
// so partial-JSON parsing is exercised.
async function* streamOf(message: { content: string | null; tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[] }) {
  if (message.tool_calls) {
    for (const [index, tc] of message.tool_calls.entries()) {
      yield { choices: [{ delta: { tool_calls: [{ index, id: tc.id, type: "function", function: { name: tc.function.name, arguments: "" } }] } }] };
      yield { choices: [{ delta: { tool_calls: [{ index, function: { arguments: tc.function.arguments } }] } }] };
    }
    return;
  }
  const text = message.content ?? "";
  for (let i = 0; i < text.length; i += 7) yield { choices: [{ delta: { content: text.slice(i, i + 7) } }] };
}

async function run(steps: Step[], user = "investment, around 45 lakh, near Mumbai") {
  const { client, requests } = fakeClient(steps);
  const events: AgentEvent[] = [];
  await runTurn(
    { history: [], user, profile: { ...emptyProfile(), name: "Ankit" }, intent: "visitor", evidence: emptyEvidence() },
    { client, model: "fake", emit: (e) => events.push(e) },
  );
  return { events, requests, reply: events.find((e) => e.type === "reply") as Extract<AgentEvent, { type: "reply" }> };
}

describe("runTurn", () => {
  it("runs search → show → reply and drives the screen", async () => {
    const { events, reply } = await run([
      { tool: "search_projects", args: { budget_max: 4_500_000, purpose: "investment", region: "near Mumbai", horizon_years: null } },
      { tool: "show", args: { view: "recommendations", id: null } },
      { say: "Isle of Anjarle fits best, with plots within your budget near the Konkan coast." },
    ]);
    expect(events.map((e) => e.type)).toEqual(["tool_start", "tool_result", "tool_start", "tool_result", "show", "say", "reply"]);
    expect(events.find((e) => e.type === "show")).toMatchObject({ view: "recommendations" });
    expect(reply.profile).toMatchObject({ name: "Ankit", purpose: "investment", budget_max: 4_500_000 });
    expect(reply.intent).toBe("shortlisted");
    // user, assistant(tool), tool, assistant(tool), tool, assistant(reply)
    expect(reply.messages.map((m) => m.role)).toEqual(["user", "assistant", "tool", "assistant", "tool", "assistant"]);
  });

  it("forces a reply on the last round", async () => {
    const loop = { tool: "get_knowledge", args: { project_id: "anjarle", topic: "amenities" } };
    const { requests } = await run([loop, loop, loop, { say: "It has a clifftop clubhouse." }]);
    expect(requests).toHaveLength(4);
    expect(requests[3].tool_choice).toBe("none");
  });

  it("regenerates once when a figure has no provenance", async () => {
    const { events, reply } = await run([
      { say: "Plots start at ₹32 lakh." },
      { tool: "list_plots", args: { project_id: "anjarle", min_size: null, max_size: null, max_price: null, sort: "price" } },
      { say: "Let me show you what is available." },
    ]);
    expect(events.find((e) => e.type === "guard")).toMatchObject({ action: "regenerate" });
    expect(reply.reply.say).toBe("Let me show you what is available.");
    // The rejected draft is not kept in history.
    expect(JSON.stringify(reply.messages)).not.toContain("32 lakh");
  });

  it("falls back when the regenerated reply still invents a figure", async () => {
    const { events, reply } = await run([{ say: "It's ₹32 lakh." }, { say: "It's ₹33 lakh." }]);
    expect(events.filter((e) => e.type === "guard").map((e) => (e as { action: string }).action)).toEqual(["regenerate", "fallback"]);
    expect(reply.reply.say).toBe("Let me confirm that figure for you.");
  });

  it("strips promised returns that survive regeneration", async () => {
    const { reply } = await run([
      { say: "Returns are guaranteed here. Shall we look at plots?" },
      { say: "Appreciation is assured. Shall we look at plots?" },
    ]);
    expect(reply.reply.say).toBe("Shall we look at plots?");
  });

  it("marks the booking stage after create_booking", async () => {
    const plot = getPlots("anjarle").find((p) => p.status === "available")!;
    const { reply } = await run(
      [
        { tool: "list_plots", args: { project_id: "anjarle", min_size: null, max_size: null, max_price: null, sort: null } },
        { tool: "create_booking", args: { plot_id: plot.plotNo } },
        { say: `I've started the booking for ${plot.plotNo}. The token is ₹45,000.`, intent: "high_intent" },
      ],
      "I want to book it",
    );
    expect(reply.messages.some((m) => m.role === "tool" && String(m.content).includes("booking_id"))).toBe(true);
    expect(reply.intent).toBe("booking_initiated");
    expect(reply.reply.say).toContain(plot.plotNo);
  });
});

describe("spoken stream", () => {
  const says = (events: AgentEvent[]) => events.filter((e) => e.type === "say").map((e) => (e as { text: string }).text);

  it("streams each checked sentence as a say event", async () => {
    const { events } = await run([{ say: "Welcome, Ankit. I am the HoABL AI advisor. What brings you here?" }]);
    expect(says(events)).toEqual(["Welcome, Ankit.", "I am the HoABL AI advisor.", "What brings you here?"]);
  });

  it("holds back a sentence with an unverified figure and retracts", async () => {
    const { events } = await run([
      { say: "Happy to help. Plots start at ₹32 lakh. Shall I show you?" },
      { say: "Happy to help. Let me pull up the live prices." },
    ]);
    const types = events.map((e) => (e.type === "say" ? `say:${(e as { text: string }).text}` : e.type));
    // The first sentence has no digit, so it went out at once. The figure never did.
    expect(types).toEqual(["say:Happy to help.", "retract", "guard", "say:Happy to help.", "say:Let me pull up the live prices.", "reply"]);
    expect(says(events).join(" ")).not.toContain("32");
  });

  it("speaks a figure once a tool result backs it", async () => {
    const plot = getPlots("anjarle").find((p) => p.status === "available")!;
    const { events } = await run([
      { tool: "list_plots", args: { project_id: "anjarle", min_size: null, max_size: null, max_price: null, sort: null } },
      { say: `${plot.plotNo} is ${plot.sizeSqft.toLocaleString("en-IN")} sq ft.` },
    ]);
    expect(says(events)).toEqual([`${plot.plotNo} is ${plot.sizeSqft.toLocaleString("en-IN")} sq ft.`]);
    expect(events.some((e) => e.type === "guard")).toBe(false);
  });

  it("speaks the fallback line when regeneration also fails", async () => {
    const { events } = await run([{ say: "It's ₹32 lakh." }, { say: "It's ₹33 lakh." }]);
    expect(says(events)).toEqual(["Let me confirm that figure for you."]);
  });
});

describe("trimHistory", () => {
  it("keeps the last N customer turns intact", () => {
    const h: ChatCompletionMessageParam[] = [];
    for (let i = 0; i < 15; i++) h.push({ role: "user", content: `u${i}` }, { role: "assistant", content: `a${i}` });
    const t = trimHistory(h, 12);
    expect(t[0]).toEqual({ role: "user", content: "u3" });
    expect(t).toHaveLength(24);
  });
});
