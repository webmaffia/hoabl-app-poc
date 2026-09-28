import { describe, expect, it } from "vitest";
import { routeFor, screenFromPath } from "@/lib/journey";
import { getPlots } from "@/lib/inventory";

describe("journey routes", () => {
  it("maps every agent view to a route", () => {
    const plot = getPlots("mopa")[0];
    expect(routeFor({ view: "recommendations", id: null })).toBe("/plots");
    expect(routeFor({ view: "project", id: "mopa" })).toBe("/plots/mopa");
    expect(routeFor({ view: "plots", id: "anjarle" })).toBe("/plots/anjarle/map");
    expect(routeFor({ view: "plot", id: plot.id })).toBe("/plots/mopa/map");
    expect(routeFor({ view: "calculator", id: null })).toBe("/money/calculator");
    expect(routeFor({ view: "booking", id: null })).toBe("/booking");
    expect(routeFor({ view: "kyc", id: null })).toBe("/booking/kyc");
    expect(routeFor({ view: "loan", id: null })).toBe("/money/loan");
  });

  it("reads the screen back from a path", () => {
    expect(screenFromPath("/agent", null)).toBeNull();
    expect(screenFromPath("/plots", null)).toEqual({ view: "recommendations", id: null });
    expect(screenFromPath("/plots/anjarle", null)).toEqual({ view: "project", id: "anjarle" });
    expect(screenFromPath("/plots/anjarle/map", null)).toEqual({ view: "plots", id: "anjarle" });
    expect(screenFromPath("/plots/anjarle/map", "anjarle-5")).toEqual({ view: "plot", id: "anjarle-5" });
    expect(screenFromPath("/plots/mopa/map", "anjarle-5")).toEqual({ view: "plots", id: "mopa" });
    expect(screenFromPath("/booking/kyc", null)).toEqual({ view: "kyc", id: null });
  });
});

import { plotLine, screenCue } from "@/lib/avatar/screen-lines";

describe("screen cues", () => {
  const state = { firstName: "Priya", booking: null, kycDone: false };

  it("gives each screen its own line, and none on the advisor screen", () => {
    expect(screenCue("/agent", state)).toEqual({ interrupt: false, line: null });
    expect(screenCue("/plots", state).line).toMatch(/^Here are the projects I'd recommend, Priya/);
    expect(screenCue("/plots/anjarle/map", state).line).toMatch(/^This is the plot map for Isle of Anjarle/);
    expect(screenCue("/money/calculator", state).line).toMatch(/sliders/);
    expect(screenCue("/money/loan", state).line).toMatch(/in-principle/);
    expect(screenCue("/booking/kyc", state).line).toMatch(/PAN/);
  });

  it("leaves the project page to its narrated films", () => {
    expect(screenCue("/plots/anjarle", state)).toEqual({ interrupt: false, line: null });
    expect(screenCue("/plots/mopa", state).line).toMatch(/^Here's Mopa Airport Hinterland/);
  });

  it("follows the booking state", () => {
    expect(screenCue("/booking", state).line).toMatch(/Pick a plot/);
    expect(screenCue("/booking", { ...state, booking: { plot_no: "IA-05", status: "initiated" } }).line).toMatch(/booking summary for plot IA-05/);
    expect(screenCue("/booking", { ...state, booking: { plot_no: "IA-05", status: "paid" } }).line).toMatch(/IA-05 is held for you/);
  });

  it("reads a tapped plot's facts from the inventory", () => {
    const plot = getPlots("anjarle").find((p) => p.status === "available")!;
    const line = plotLine(plot.id)!;
    expect(line.startsWith(`${plot.plotNo} is ${plot.sizeSqft.toLocaleString("en-IN")} square feet`)).toBe(true);
    expect(line).toContain(`${plot.metresFromEntrance} metres from the entrance`);
    expect(line).toContain(`₹${(plot.price / 1e5).toFixed(2)} lakh`);
    expect(line).toMatch(/Shall I hold it for you\?$/);
    expect(plotLine(plot.id, { [plot.id]: "held" })).toMatch(/on hold right now/);
  });
});
