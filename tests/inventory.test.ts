import { describe, expect, it } from "vitest";
import { PROJECTS, entryTicket, getPlots, metresFromEntrance, plotPrice, rateFor } from "@/lib/inventory";

describe("inventory", () => {
  it("has the three projects with the right plot counts", () => {
    expect(PROJECTS.map((p) => [p.id, getPlots(p.id).length])).toEqual([
      ["anjarle", 24],
      ["mopa", 14],
      ["nagpur", 12],
    ]);
  });

  it("is deterministic across calls", () => {
    expect(JSON.stringify(getPlots("anjarle"))).toBe(JSON.stringify(getPlots("anjarle")));
  });

  it("keeps Anjarle's real list prices for the four configurations", () => {
    const anjarle = PROJECTS.find((p) => p.id === "anjarle")!;
    const list = (size: number) => Math.round((size * rateFor(anjarle, size)) / 10000) / 10; // lakh, 1 dp
    expect(list(1367)).toBeCloseTo(40.0, 0);
    expect(list(1506)).toBeCloseTo(44.0, 0);
    expect(list(2002)).toBeCloseTo(61.9, 1);
    expect(list(2723)).toBeCloseTo(83.9, 1);
  });

  it("has available inventory in the ₹40–50 L band the demo script uses", () => {
    const inBand = PROJECTS.flatMap((p) => getPlots(p.id)).filter(
      (p) => p.status === "available" && p.price >= 4_000_000 && p.price <= 5_000_000,
    );
    expect(inBand.length).toBeGreaterThanOrEqual(2);
    expect(inBand.some((p) => p.projectId === "anjarle")).toBe(true);
  });

  it("starts every project under ₹20L so the lowest budget bracket has options", () => {
    expect(entryTicket(PROJECTS.find((p) => p.id === "anjarle")!)).toBe(1_770_000);
    expect(entryTicket(PROJECTS.find((p) => p.id === "mopa")!)).toBe(1_800_000);
    expect(entryTicket(PROJECTS.find((p) => p.id === "nagpur")!)).toBe(1_450_000);
  });

  it("has at least two available plots in every budget bracket of the welcome question, in every project", () => {
    const brackets: [number, number][] = [
      [0, 2_000_000], // < ₹20L
      [2_000_000, 3_500_000], // ₹20L – ₹35L
      [3_500_000, 5_000_000], // ₹35L – ₹50L
      [5_000_000, Infinity], // > ₹50L
    ];
    for (const p of PROJECTS) {
      for (const [lo, hi] of brackets) {
        const free = getPlots(p.id).filter((x) => x.status === "available" && x.price > lo && x.price <= hi);
        expect(free.length, `${p.id} ${lo}–${hi}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("applies the distance and multiplier formula", () => {
    const p = PROJECTS[0];
    expect(metresFromEntrance(p, p.entranceRow, p.entranceCol)).toBe(40);
    expect(metresFromEntrance(p, p.entranceRow, p.entranceCol + 2)).toBe(84);
    // corner + park: 1.10; far: -0.03
    expect(plotPrice(p, 2002, true, true, 60)).toBe(Math.round((2002 * 3094 * 1.1) / 1000) * 1000);
    expect(plotPrice(p, 2002, false, false, 250)).toBe(Math.round((2002 * 3094 * 0.97) / 1000) * 1000);
    for (const plot of getPlots("anjarle")) expect(plot.price % 1000).toBe(0);
  });

  it("marks up to about 35% sold and 10% held, keeping two plots of every size free", () => {
    for (const p of PROJECTS) {
      const plots = getPlots(p.id);
      const sold = plots.filter((x) => x.status === "sold").length;
      const held = plots.filter((x) => x.status === "held").length;
      expect(sold).toBeLessThanOrEqual(Math.round(p.plotCount * 0.35));
      expect(sold + held).toBeGreaterThan(0); // scarcity still shows on the map
      for (const size of p.sizes) expect(plots.filter((x) => x.sizeSqft === size && x.status === "available").length).toBeGreaterThanOrEqual(2);
    }
  });

  it("applies session overrides without mutating the base inventory", () => {
    const first = getPlots("anjarle").find((p) => p.status === "available")!;
    expect(getPlots("anjarle", { [first.id]: "held" }).find((p) => p.id === first.id)!.status).toBe("held");
    expect(getPlots("anjarle").find((p) => p.id === first.id)!.status).toBe("available");
  });
});
