import { describe, expect, it } from "vitest";
import { BANDS, eligibility, principalFor } from "@/lib/loan";
import { emi } from "@/lib/agent/tools";

describe("loan eligibility", () => {
  it("uses FOIR 0.55 / 0.50 / 0.45 / 0.38 by band", () => {
    expect(BANDS.map((b) => b.foir)).toEqual([0.55, 0.5, 0.45, 0.38]);
  });

  it("annuitises the EMI headroom at the band rate over 15 years", () => {
    const p = principalFor(30000, 8.9, 15);
    expect(Math.round(emi(p, 8.9, 15))).toBe(30000);
  });

  it("is limited by income when headroom is small", () => {
    const e = eligibility({ income: 60000, obligations: 10000, band: "good", plotPrice: 6_194_000 });
    expect(e.headroomEmi).toBe(20000); // 60k × 0.50 − 10k
    expect(e.limitedBy).toBe("income");
    expect(e.eligible).toBeLessThan(e.cap);
  });

  it("caps at 50% of plot value", () => {
    const e = eligibility({ income: 400000, obligations: 0, band: "excellent", plotPrice: 4_399_000 });
    expect(e.limitedBy).toBe("ltv");
    expect(e.eligible).toBe(2_199_000);
  });

  it("returns nothing when obligations exceed headroom", () => {
    const e = eligibility({ income: 50000, obligations: 30000, band: "building", plotPrice: 5_000_000 });
    expect(e.eligible).toBe(0);
    expect(e.limitedBy).toBe("none");
  });
});
