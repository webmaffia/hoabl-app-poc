import { describe, expect, it } from "vitest";
import { SentenceGate, partialSay } from "@/lib/agent/say-stream";
import { emptyEvidence } from "@/lib/agent/guard";

describe("partialSay", () => {
  it("reads the say value as it streams", () => {
    expect(partialSay('{"sa')).toBeNull();
    expect(partialSay('{"say":"Hello the')).toEqual({ text: "Hello the", done: false });
    expect(partialSay('{"say":"Hello there.","chips":[')).toEqual({ text: "Hello there.", done: true });
  });

  it("decodes escapes, including ones split across chunks", () => {
    expect(partialSay('{"say":"a \\"quote\\" and \\u20b945')).toEqual({ text: 'a "quote" and ₹45', done: false });
    expect(partialSay('{"say":"cut \\')).toEqual({ text: "cut ", done: false });
    expect(partialSay('{"say":"cut \\u20')).toEqual({ text: "cut ", done: false });
  });
});

describe("SentenceGate", () => {
  it("releases sentences only when complete, never splitting decimals", () => {
    const out: string[] = [];
    const gate = new SentenceGate(() => ({ numbers: [6194000], refs: [] }), (s) => out.push(s));
    gate.update("It is ₹61.", false);
    expect(out).toEqual([]);
    gate.update("It is ₹61.94 lakh. Shall", false);
    expect(out).toEqual(["It is ₹61.94 lakh."]);
    gate.update("It is ₹61.94 lakh. Shall I hold it?", true);
    expect(out).toEqual(["It is ₹61.94 lakh.", "Shall I hold it?"]);
  });

  it("stops at the first sentence that fails", () => {
    const out: string[] = [];
    const gate = new SentenceGate(emptyEvidence, (s) => out.push(s));
    gate.update("Lovely views. Returns are guaranteed. Shall we look?", true);
    expect(out).toEqual(["Lovely views."]);
    expect(gate.failed?.[0].check).toBe("return_language");
  });
});
