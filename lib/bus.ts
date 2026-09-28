// Agent events fan out from the session store to anything that reacts to them
// (the avatar speaks `say`, fills silence on `tool_start`, flushes on `retract`).

import type { AgentEvent } from "@/lib/agent/run";

/**
 * Server events, plus app events: turn_start (the store, when a turn begins)
 * and the avatar's speech state (the controller), so scripted lines can wait
 * for the advisor to finish talking.
 */
export type BusEvent =
  | AgentEvent
  | { type: "turn_start" }
  | { type: "speech_start" }
  | { type: "speech_idle" }
  | { type: "speech_skipped" };

type Listener = (event: BusEvent) => void;
const listeners = new Set<Listener>();

export function onAgentEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitAgentEvent(event: BusEvent): void {
  for (const fn of listeners) fn(event);
}
