// Filler speech: a short line spoken the instant a tool call starts, so a tool
// round sounds like a consultant checking rather than dead air. Client-side,
// no model call, zero added latency.

const LINES: Record<string, string[]> = {
  search_projects: ["Let me see what fits that range.", "Give me a second, I'll pull up the options."],
  list_plots: ["Checking what's still available there.", "Let me look at the plot map."],
  compare_plots: ["Let me put those two side by side.", "One moment, comparing them properly."],
  get_knowledge: ["Let me get you the exact position on that.", "One moment, I'll check that for you."],
  calculate_payment: ["Working that out now.", "Let me run those numbers."],
  create_booking: ["Let me hold that for you.", "I'll reserve that plot now."],
};

const turns: Record<string, number> = {};

/** Next rotating line for a tool, or null for tools that don't need one (show). */
export function fillerFor(tool: string): string | null {
  const lines = LINES[tool];
  if (!lines) return null;
  const i = (turns[tool] = (turns[tool] ?? -1) + 1);
  return lines[i % lines.length];
}
