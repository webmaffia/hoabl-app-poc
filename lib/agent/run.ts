// One agent turn: the tool loop, the guard, and the events streamed to the client.
// Kept free of HTTP so it can be driven by a fake client in tests.

import type OpenAI from "openai";
import type {
  ChatCompletionChunk,
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { TOOL_DEFINITIONS, runTool, toolPill, type ToolContext } from "@/lib/agent/tools";
import {
  PROVENANCE_FALLBACK,
  checkReply,
  collectEvidence,
  mergeEvidence,
  stripReturnLanguage,
  type Evidence,
  type Violation,
} from "@/lib/agent/guard";
import { SentenceGate, partialSay } from "@/lib/agent/say-stream";
import {
  REPLY_SCHEMA,
  advanceIntent,
  systemPrompt,
  type AgentReply,
  type Intent,
  type Profile,
} from "@/lib/agent/prompt";
import type { PlotOverrides } from "@/lib/inventory";
import type { TurnContext } from "@/lib/agent/prompt";

export const MAX_ROUNDS = 4;
export const HISTORY_TURNS = 12;

export type AgentEvent =
  | { type: "tool_start"; id: string; name: string; args: unknown }
  | { type: "tool_result"; id: string; name: string; pill: string; result: unknown; ms: number }
  | { type: "show"; view: string; id: string | null }
  /** A checked sentence, safe to speak now. */
  | { type: "say"; text: string }
  /** Something already spoken failed a later check: interrupt and flush the speak queue. */
  | { type: "retract" }
  | { type: "guard"; violations: Violation[]; action: "regenerate" | "strip" | "fallback" }
  | { type: "reply"; reply: AgentReply; profile: Profile; intent: Intent; evidence: Evidence; messages: ChatCompletionMessageParam[] }
  | { type: "error"; message: string };

export interface TurnInput {
  /** Prior conversation in OpenAI format, including tool calls and results. */
  history: ChatCompletionMessageParam[];
  /** The customer's message; null starts the conversation with a greeting. */
  user: string | null;
  profile: Profile;
  intent: Intent;
  evidence: Evidence;
  overrides?: PlotOverrides;
  /** What the customer sees and where the booking stands. */
  context?: TurnContext;
}

export interface TurnDeps {
  client: Pick<OpenAI, "chat">;
  model: string;
  reasoningEffort?: OpenAI.ReasoningEffort;
  emit: (event: AgentEvent) => void;
  log?: (...args: unknown[]) => void;
  signal?: AbortSignal;
}

/** Last N customer turns, cut at a user message so tool call/result pairs stay intact. */
export function trimHistory(history: ChatCompletionMessageParam[], turns = HISTORY_TURNS): ChatCompletionMessageParam[] {
  let seen = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user" && ++seen === turns) return history.slice(i);
  }
  return history;
}

function mergeProfile(profile: Profile, updates: AgentReply["profile_updates"] | undefined): Profile {
  const next = { ...profile };
  for (const [k, v] of Object.entries(updates ?? {})) {
    if (v !== null && v !== undefined) (next as Record<string, unknown>)[k] = v;
  }
  return next;
}

export async function runTurn(input: TurnInput, deps: TurnDeps): Promise<void> {
  const log = deps.log ?? (() => {});
  const ctx: ToolContext = { overrides: input.overrides };
  let evidence = input.evidence;
  let intent = input.intent;

  const newMessages: ChatCompletionMessageParam[] = [];
  if (input.user !== null) {
    newMessages.push({ role: "user", content: input.user });
    // What the customer says is fair to repeat back ("around 45 lakh").
    evidence = mergeEvidence(evidence, collectEvidence(input.user));
  }

  const system = (): ChatCompletionMessageParam => ({
    role: "system",
    content: systemPrompt(input.profile, intent, { start: input.user === null && input.history.length === 0, context: input.context }),
  });
  const history = trimHistory(input.history);
  const say = (text: string) => deps.emit({ type: "say", text });

  // Runs model rounds until it answers without a tool call. The final round
  // withholds tools so a reply always comes back. The reply streams through
  // `gate`, which releases each sentence once it passes its checks.
  async function complete(gate: SentenceGate, extra: ChatCompletionMessageParam[] = [], maxRounds = MAX_ROUNDS): Promise<AgentReply> {
    for (let round = 1; round <= maxRounds; round++) {
      const lastRound = round === maxRounds;
      const started = Date.now();
      const stream = (await deps.client.chat.completions.create(
        {
          model: deps.model,
          messages: [system(), ...history, ...newMessages, ...extra],
          tools: TOOL_DEFINITIONS,
          tool_choice: lastRound ? "none" : "auto",
          parallel_tool_calls: false,
          response_format: { type: "json_schema", json_schema: REPLY_SCHEMA as never },
          stream: true,
          ...(deps.reasoningEffort ? { reasoning_effort: deps.reasoningEffort } : {}),
        },
        { signal: deps.signal },
      )) as AsyncIterable<ChatCompletionChunk>;

      let content = "";
      let firstTokenMs: number | null = null;
      const pending: { id: string; name: string; args: string }[] = [];
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;
        firstTokenMs ??= Date.now() - started;
        for (const tc of delta.tool_calls ?? []) {
          const slot = (pending[tc.index] ??= { id: "", name: "", args: "" });
          if (tc.id) slot.id = tc.id;
          if (tc.function?.name) slot.name += tc.function.name;
          if (tc.function?.arguments) slot.args += tc.function.arguments;
        }
        if (delta.content && pending.length === 0) {
          content += delta.content;
          const partial = partialSay(content);
          if (partial) gate.update(partial.text, partial.done);
        }
      }
      log(`[agent] round ${round} first token ${firstTokenMs}ms, done ${Date.now() - started}ms`, pending.length ? `→ ${pending.length} tool call(s)` : "→ reply");

      const calls: ChatCompletionMessageFunctionToolCall[] = pending
        .filter(Boolean)
        .map((p) => ({ id: p.id, type: "function", function: { name: p.name, arguments: p.args } }));
      if (calls.length === 0) {
        const reply = parseReply(content);
        // Flush the last sentence. Feed the same untrimmed text the gate has
        // been reading so its offsets line up; fall back to the parsed reply
        // if the stream never produced a say field.
        gate.update(partialSay(content)?.text ?? reply.say, true);
        newMessages.push({ role: "assistant", content });
        return reply;
      }

      newMessages.push({ role: "assistant", content: null, tool_calls: calls });
      for (const call of calls) {
        const args = safeJson(call.function.arguments);
        deps.emit({ type: "tool_start", id: call.id, name: call.function.name, args });
        const t0 = Date.now();
        const result = runTool(call.function.name, args, ctx);
        const ms = Date.now() - t0;
        log(`[tool] ${call.function.name}(${call.function.arguments}) → ${JSON.stringify(result).slice(0, 240)}`);
        deps.emit({ type: "tool_result", id: call.id, name: call.function.name, pill: toolPill(call.function.name, result), result, ms });

        evidence = mergeEvidence(evidence, collectEvidence(result));
        const r = result as Record<string, unknown>;
        if (call.function.name === "show" && r.ok) deps.emit({ type: "show", view: String(r.view), id: (r.id as string) ?? null });
        if (call.function.name === "create_booking" && r.booking_id) intent = advanceIntent(intent, "booking_initiated");

        newMessages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
    throw new Error("agent loop ended without a reply");
  }

  const newGate = () => new SentenceGate(() => evidence, say);
  let gate = newGate();
  let reply = await complete(gate);
  let violations = checkReply(reply.say, evidence);

  if (violations.length) {
    log("[guard] fail", violations);
    // Anything already spoken stays checked, but the reply is being replaced,
    // so stop the avatar and flush its queue before the correction.
    if (gate.spokeAny) deps.emit({ type: "retract" });
    deps.emit({ type: "guard", violations, action: "regenerate" });
    // Drop the failed reply and ask once more, with tools still available so
    // the model can fetch the figure it was missing.
    newMessages.pop();
    const correction: ChatCompletionMessageParam = {
      role: "system",
      content: `Your last draft was rejected by the compliance check: ${violations.map((v) => v.detail).join("; ")}. Rewrite it. Only use figures that appear in tool results (call a tool if you need one), and never describe returns as guaranteed, assured, fixed or promised. Draft was: ${JSON.stringify(reply.say)}`,
    };
    gate = newGate();
    reply = await complete(gate, [correction], 2);
    violations = checkReply(reply.say, evidence);

    if (violations.length) {
      log("[guard] fail after regenerate", violations);
      const provenance = violations.some((v) => v.check === "provenance");
      const stripped = stripReturnLanguage(reply.say);
      reply = { ...reply, say: provenance || !stripped ? PROVENANCE_FALLBACK : stripped };
      if (gate.spokeAny) deps.emit({ type: "retract" });
      deps.emit({ type: "guard", violations, action: provenance ? "fallback" : "strip" });
      say(reply.say);
      newMessages[newMessages.length - 1] = { role: "assistant", content: JSON.stringify(reply) };
    }
  }

  const profile = mergeProfile(input.profile, reply.profile_updates);
  intent = advanceIntent(intent, reply.intent);
  deps.emit({ type: "reply", reply, profile, intent, evidence, messages: newMessages });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function parseReply(content: string | null): AgentReply {
  const parsed = safeJson(content ?? "") as Partial<AgentReply>;
  return {
    say: typeof parsed.say === "string" && parsed.say.trim() ? parsed.say.trim() : "Sorry, could you say that once more?",
    chips: Array.isArray(parsed.chips) ? parsed.chips.slice(0, 4) : [],
    profile_updates: parsed.profile_updates ?? { purpose: null, budget_max: null, horizon_years: null, region: null, funding: null },
    intent: parsed.intent ?? "visitor",
  };
}
