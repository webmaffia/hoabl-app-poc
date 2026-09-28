// POST /api/agent: one conversation turn, streamed back as NDJSON events.
// The server is stateless; the client owns the session and sends it each turn.

import OpenAI from "openai";
import { runTurn, type AgentEvent, type TurnInput } from "@/lib/agent/run";
import { emptyEvidence } from "@/lib/agent/guard";
import { emptyProfile } from "@/lib/agent/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
// gpt-5.x on Chat Completions only allows function tools with reasoning off,
// which is also the fastest setting for a spoken turn.
const REASONING = (process.env.OPENAI_REASONING_EFFORT || (/^gpt-5/.test(MODEL) ? "none" : "")) as OpenAI.ReasoningEffort | "";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as Partial<TurnInput> | null;
  if (!body || (body.user !== null && typeof body.user !== "string")) {
    return Response.json({ error: "body must include user (string, or null to start)" }, { status: 400 });
  }

  const input: TurnInput = {
    history: Array.isArray(body.history) ? body.history : [],
    user: body.user ?? null,
    profile: { ...emptyProfile(), ...body.profile },
    intent: body.intent ?? "visitor",
    evidence: body.evidence ?? emptyEvidence(),
    overrides: body.overrides ?? {},
    context: body.context,
  };

  const client = new OpenAI();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const emit = (event: AgentEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          open = false; // client went away (barge-in aborts the fetch)
        }
      };
      console.log(`[agent] turn: ${input.user === null ? "(start)" : JSON.stringify(input.user)} · model ${MODEL}`);
      try {
        await runTurn(input, {
          client,
          model: MODEL,
          reasoningEffort: REASONING || undefined,
          emit,
          log: console.log,
          signal: request.signal,
        });
      } catch (err) {
        if (request.signal.aborted) {
          console.log("[agent] turn aborted by client");
        } else {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[agent] error", message);
          emit({ type: "error", message });
        }
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
