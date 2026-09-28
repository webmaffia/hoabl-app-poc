import { describe, expect, it } from "vitest";
import {
  TOOL_DEFINITIONS,
  calculatePayment,
  createBooking,
  getKnowledge,
  listPlots,
  runTool,
  searchProjects,
  show,
  toolPill,
} from "@/lib/agent/tools";
import { getPlots } from "@/lib/inventory";

describe("tool definitions", () => {
  it("has exactly six strict tools", () => {
    expect(TOOL_DEFINITIONS.map((t) => t.function.name)).toEqual([
      "search_projects",
      "list_plots",
      "get_knowledge",
      "calculate_payment",
      "show",
      "create_booking",
    ]);
    for (const t of TOOL_DEFINITIONS) {
      const params = t.function.parameters as { properties: object; required: string[]; additionalProperties: boolean };
      expect(t.function.strict).toBe(true);
      expect(params.additionalProperties).toBe(false);
      // Strict mode needs every property listed as required.
      expect(params.required.sort()).toEqual(Object.keys(params.properties).sort());
    }
  });
});

describe("search_projects", () => {
  it("ranks Anjarle first for investment ~45 L near Mumbai", () => {
    const { projects } = searchProjects({ budget_max: 4_500_000, purpose: "investment", region: "near Mumbai", horizon_years: null });
    expect(projects).toHaveLength(3);
    expect(projects[0].id).toBe("anjarle");
    expect(projects[0].available_in_budget).toBeGreaterThan(0);
    expect(projects[0].fit_reason).toMatch(/within budget/);
    expect(projects[0].fit_score).toBeGreaterThan(projects[2].fit_score);
    for (const p of projects) {
      expect(p).toMatchObject({ id: expect.any(String), entry_ticket: expect.any(Number), rate_per_sqft: expect.any(Number) });
    }
  });

  it("always leads with the featured project (demo rule), then ranks the rest", () => {
    const { projects } = searchProjects({ budget_max: 5_000_000, purpose: "holiday_home", region: "Goa", horizon_years: 6 });
    expect(projects[0].id).toBe("anjarle");
    expect(projects[0].fit_score).toBeGreaterThan(projects[1].fit_score);
    expect(projects[1].id).toBe("mopa"); // Goa still ranks Mopa best among the others
  });

  it("stays honest when the featured project is over budget", () => {
    // Anjarle starts at ₹17.7L, so ₹15L is below every plot there.
    const { projects } = searchProjects({ budget_max: 1_500_000, purpose: "investment", region: null, horizon_years: null });
    expect(projects[0].id).toBe("anjarle");
    expect(projects[0].available_in_budget).toBe(0);
    expect(projects[0].fit_reason).toMatch(/above budget, instalment plan and up to 50% financing/);
    expect(projects[1].id).toBe("nagpur");
  });

  it("works with an empty profile", () => {
    expect(searchProjects({ budget_max: null, purpose: null, region: null, horizon_years: null }).projects).toHaveLength(3);
  });
});

describe("list_plots", () => {
  const base = { min_size: null, max_size: null, max_price: null, sort: null } as const;

  it("returns only available plots, sorted by price by default", () => {
    const { plots, total } = listPlots({ ...base, project_id: "anjarle" });
    expect(total).toBe(getPlots("anjarle").filter((p) => p.status === "available").length);
    expect(plots.every((p) => p.status === "available")).toBe(true);
    expect(plots.map((p) => p.price)).toEqual([...plots.map((p) => p.price)].sort((a, b) => a - b));
  });

  it("filters by size for 'show me the 2,000 sq ft options'", () => {
    const { plots } = listPlots({ ...base, project_id: "anjarle", min_size: 1900, max_size: 2100 });
    expect(plots.length).toBeGreaterThan(0);
    expect(plots.every((p) => p.size_sqft === 2002)).toBe(true);
  });

  it("answers 'which is closest to the entrance'", () => {
    const { plots } = listPlots({ ...base, project_id: "anjarle", sort: "distance_from_entrance" });
    const min = Math.min(...plots.map((p) => p.metres_from_entrance));
    expect(plots[0].metres_from_entrance).toBe(min);
  });

  it("respects max_price", () => {
    const { plots } = listPlots({ ...base, project_id: "mopa", max_price: 5_000_000 });
    expect(plots.every((p) => p.price <= 5_000_000)).toBe(true);
  });

  it("reports unknown projects", () => {
    expect(listPlots({ ...base, project_id: "nowhere" })).toMatchObject({ error: expect.any(String), total: 0 });
  });

  it("excludes plots held during the session", () => {
    const first = listPlots({ ...base, project_id: "anjarle" }).plots[0];
    const after = listPlots({ ...base, project_id: "anjarle" }, { overrides: { [first.id]: "held" } });
    expect(after.plots.find((p) => p.id === first.id)).toBeUndefined();
  });
});

describe("get_knowledge", () => {
  it("returns project facts", () => {
    const { chunks } = getKnowledge({ project_id: "anjarle", topic: "title_approvals" });
    expect(chunks.some((c) => c.text.includes("P52800076609"))).toBe(true);
  });

  it("returns the price playbook without any discount", () => {
    const text = getKnowledge({ project_id: null, topic: "price" }).chunks.map((c) => c.text).join(" ");
    expect(text).toMatch(/smaller/i);
    expect(text).toMatch(/instalment/i);
    expect(text).toMatch(/financing/i);
    expect(text).toMatch(/never offer a discount/i);
  });

  it("adds project colour to why_here", () => {
    expect(getKnowledge({ project_id: "anjarle", topic: "why_here" }).chunks).toHaveLength(2);
  });

  it("returns connectivity across all projects when no project given", () => {
    const { chunks } = getKnowledge({ project_id: null, topic: "infrastructure" });
    expect(chunks.some((c) => c.text.startsWith("[mopa]"))).toBe(true);
    expect(chunks.some((c) => c.text.startsWith("[anjarle]"))).toBe(true);
  });

  it("rejects unknown topics", () => {
    expect(getKnowledge({ project_id: null, topic: "weather" as never })).toMatchObject({ error: expect.any(String) });
  });
});

describe("calculate_payment", () => {
  it("computes a standard EMI", () => {
    // ₹50 L, 20% down, 8.5% over 15 years → loan ₹40 L, EMI ≈ ₹39,390
    const r = calculatePayment({ price: 5_000_000, down_payment_pct: 20, annual_rate: 8.5, tenure_years: 15 });
    expect(r.down_payment).toBe(1_000_000);
    expect(r.loan_amount).toBe(4_000_000);
    expect(r.emi).toBeGreaterThan(39_300);
    expect(r.emi).toBeLessThan(39_500);
    expect(r.total_interest).toBe(r.emi * 180 - r.loan_amount);
  });

  it("handles 100% down and zero rate", () => {
    expect(calculatePayment({ price: 4_000_000, down_payment_pct: 100, annual_rate: 9, tenure_years: 10 })).toMatchObject({ loan_amount: 0, emi: 0 });
    expect(calculatePayment({ price: 1_200_000, down_payment_pct: 0, annual_rate: 0, tenure_years: 1 }).emi).toBe(100_000);
  });
});

describe("show", () => {
  it("accepts recommendations without an id", () => {
    expect(show({ view: "recommendations", id: null })).toMatchObject({ ok: true });
  });

  it("requires a project for project and plots views", () => {
    expect(show({ view: "project", id: null }).ok).toBe(false);
    expect(show({ view: "plots", id: "anjarle" })).toMatchObject({ ok: true, id: "anjarle" });
  });

  it("resolves a plot number to a plot id", () => {
    const plot = getPlots("anjarle")[0];
    expect(show({ view: "plot", id: plot.plotNo })).toMatchObject({ ok: true, id: plot.id });
  });
});

describe("create_booking", () => {
  it("creates an initiated booking with the ₹45,000 token and takes no payment", () => {
    const plot = getPlots("anjarle").find((p) => p.status === "available")!;
    const r = createBooking({ plot_id: plot.plotNo });
    expect(r).toMatchObject({ token_amount: 45_000, status: "initiated", plot: { id: plot.id, plot_no: plot.plotNo } });
    expect((r as { booking_id: string }).booking_id).toMatch(/^BK-IA-\d{2}-/);
  });

  it("refuses sold and held plots", () => {
    const sold = getPlots("anjarle").find((p) => p.status === "sold")!;
    expect(createBooking({ plot_id: sold.id })).toMatchObject({ error: expect.stringMatching(/sold/) });
    const avail = getPlots("anjarle").find((p) => p.status === "available")!;
    expect(createBooking({ plot_id: avail.id }, { overrides: { [avail.id]: "held" } })).toMatchObject({ error: expect.stringMatching(/held/) });
  });

  it("refuses unknown plots", () => {
    expect(createBooking({ plot_id: "ZZ-99" })).toMatchObject({ error: expect.any(String) });
  });
});

describe("dispatch and pills", () => {
  it("routes by name and labels results", () => {
    const r = runTool("list_plots", { project_id: "anjarle", min_size: null, max_size: null, max_price: null, sort: null });
    expect(toolPill("list_plots", r)).toMatch(/^checking availability · \d+ plots in range$/);
    expect(runTool("nope", {})).toMatchObject({ error: expect.any(String) });
  });
});

describe("day 1 tuning", () => {
  it("widens a single size to the nearest configuration", () => {
    const { plots } = listPlots({ project_id: "anjarle", min_size: 2000, max_size: 2000, max_price: null, sort: null });
    expect(plots.length).toBeGreaterThan(0);
    expect(plots.every((p) => p.size_sqft === 2002)).toBe(true);
  });

  it("uses the indicative rate when none is given", () => {
    const r = calculatePayment({ price: 4_399_000, down_payment_pct: 20, annual_rate: null, tenure_years: 15 });
    expect(r.annual_rate).toBe(8.75);
    expect(r.rate_basis).toMatch(/indicative/);
  });

  it("serves connectivity distances from the inventory", () => {
    const text = getKnowledge({ project_id: "anjarle", topic: "connectivity" }).chunks[0].text;
    expect(text).toMatch(/Mumbai 225 km/);
    expect(getKnowledge({ project_id: null, topic: "connectivity" }).chunks).toHaveLength(3);
  });
});
