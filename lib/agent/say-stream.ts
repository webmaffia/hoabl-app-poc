// Streams the spoken reply sentence by sentence, in the order BUILD.md §7 asks
// for: a sentence goes out as soon as it is complete, and a sentence carrying
// a digit (figure, date, plot number) goes out only after its provenance check
// passes. A sentence that fails stops the stream, and the caller retracts and
// regenerates.

import { checkProvenance, checkReturnLanguage, needsProvenanceCheck, type Evidence, type Violation } from "@/lib/agent/guard";

/**
 * Reads the `say` value out of a partial structured-output JSON string, as far
 * as it has streamed. `say` is the first key in the reply schema, so it streams
 * first.
 */
export function partialSay(json: string): { text: string; done: boolean } | null {
  const start = json.match(/"say"\s*:\s*"/);
  if (!start) return null;
  let i = start.index! + start[0].length;
  let text = "";
  while (i < json.length) {
    const ch = json[i];
    if (ch === '"') return { text, done: true };
    if (ch !== "\\") {
      text += ch;
      i++;
      continue;
    }
    const next = json[i + 1];
    if (next === undefined) break; // escape split across chunks
    if (next === "u") {
      const hex = json.slice(i + 2, i + 6);
      if (hex.length < 4) break;
      text += String.fromCharCode(parseInt(hex, 16));
      i += 6;
      continue;
    }
    text += ({ n: "\n", t: "\t", r: "", b: "", f: "" } as Record<string, string>)[next] ?? next;
    i += 2;
  }
  return { text, done: false };
}

export class SentenceGate {
  private consumed = 0;
  private spoken: string[] = [];
  failed: Violation[] | null = null;

  constructor(
    private readonly evidence: () => Evidence,
    private readonly emit: (sentence: string) => void,
  ) {}

  get spokeAny(): boolean {
    return this.spoken.length > 0;
  }

  /** Feed the full say text streamed so far. */
  update(say: string, done: boolean): void {
    while (!this.failed) {
      const rest = say.slice(this.consumed);
      // A sentence is complete once terminal punctuation is followed by
      // whitespace, so "₹61.94 lakh" never splits at the decimal point.
      const m = rest.match(/^\s*([\s\S]*?[.?!]+)(?=\s)/);
      if (m) {
        this.consumed += m[0].length;
        this.pass(m[1].trim());
        continue;
      }
      if (done && rest.trim()) {
        this.consumed = say.length;
        this.pass(rest.trim());
      }
      break;
    }
  }

  private pass(sentence: string): void {
    if (!sentence) return;
    const violations = [
      ...checkReturnLanguage(sentence),
      ...(needsProvenanceCheck(sentence) ? checkProvenance(sentence, this.evidence()) : []),
    ];
    if (violations.length) {
      this.failed = violations;
      return;
    }
    this.spoken.push(sentence);
    this.emit(sentence);
  }
}
