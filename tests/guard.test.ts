import { describe, expect, it } from "vitest";
import {
  checkProvenance,
  checkReturnLanguage,
  collectEvidence,
  emptyEvidence,
  extractFigures,
  mergeEvidence,
  needsProvenanceCheck,
  splitSentences,
  stripReturnLanguage,
} from "@/lib/agent/guard";
import { listPlots } from "@/lib/agent/tools";

describe("extractFigures", () => {
  it("parses rupees, lakh, crore, sizes and percentages", () => {
    const values = extractFigures("₹45,000 token, ₹61.94 lakh, 1.2 crore, 2,002 sq ft, 20%, ₹46,41,000").map((f) => f.value);
    expect(values).toEqual([45000, 6194000, 12000000, 2002, 20, 4641000]);
  });

  it("ignores plot numbers", () => {
    expect(extractFigures("Plot IA-07 is lovely")).toEqual([]);
  });
});

describe("provenance", () => {
  const evidence = mergeEvidence(emptyEvidence(), collectEvidence({ price: 4_641_000, size_sqft: 1506, plot_no: "IA-07", metres: 62 }));

  it("passes figures that came from tool results, allowing spoken rounding", () => {
    expect(checkProvenance("Plot IA-07 is 1,506 sq ft at about ₹46 lakh, 62 metres from the gate.", evidence)).toEqual([]);
    expect(checkProvenance("That's ₹46.4 lakh.", evidence)).toEqual([]);
    expect(checkProvenance("The token is ₹45,000.", evidence)).toEqual([]);
  });

  it("flags invented figures and plot numbers", () => {
    const v = checkProvenance("Plot IA-09 is ₹39 lakh and 3 km from the beach.", evidence);
    expect(v.map((x) => x.text)).toEqual(["₹39 lakh", "3 km", "IA-09"]);
  });

  it("ignores trivial counts", () => {
    expect(checkProvenance("I have 2 options for you.", evidence)).toEqual([]);
  });

  it("collects evidence from real tool output", () => {
    const result = listPlots({ project_id: "anjarle", min_size: null, max_size: null, max_price: null, sort: null });
    const ev = collectEvidence(result);
    const p = result.plots[0];
    expect(checkProvenance(`${p.plot_no} is ${p.size_sqft.toLocaleString("en-IN")} sq ft.`, ev)).toEqual([]);
  });
});

describe("return language", () => {
  it("flags promised returns", () => {
    expect(checkReturnLanguage("This gives assured returns of 15%.")).toHaveLength(1);
    expect(checkReturnLanguage("Appreciation is guaranteed here.")).toHaveLength(1);
    expect(checkReturnLanguage("We promise 5x growth.")).toHaveLength(1);
  });

  it("allows the approved negative phrasing", () => {
    expect(checkReturnLanguage("No one can guarantee land appreciation.")).toEqual([]);
    expect(checkReturnLanguage("Returns are not guaranteed.")).toEqual([]);
  });

  it("allows 'fixed' in unrelated senses", () => {
    expect(checkReturnLanguage("Compared with a fixed deposit at 7%, land is illiquid.")).toEqual([]);
    expect(checkReturnLanguage("The loan has a fixed rate of 8.5%.")).toEqual([]);
  });

  it("ignores guarantees that aren't about returns", () => {
    expect(checkReturnLanguage("I can guarantee the paperwork is clean.")).toEqual([]);
  });

  it("strips only the offending sentence", () => {
    expect(stripReturnLanguage("It's a great plot. Returns are guaranteed at 20%. Shall we look?")).toBe("It's a great plot. Shall we look?");
  });
});

describe("sentences", () => {
  it("splits without breaking decimals", () => {
    expect(splitSentences("It is ₹61.94 lakh. Shall I hold it?")).toEqual(["It is ₹61.94 lakh.", "Shall I hold it?"]);
  });

  it("marks sentences with figures for pre-speech checks", () => {
    expect(needsProvenanceCheck("Shall I show you the map?")).toBe(false);
    expect(needsProvenanceCheck("Plot IA-07 is closest.")).toBe(true);
  });
});
