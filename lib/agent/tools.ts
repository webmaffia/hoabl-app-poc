// The six agent tools: strict JSON schemas for OpenAI, and pure handlers.
// Keep this list at six. Each extra tool is one more thing the model can pick
// wrongly under demo pressure.

import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";
import {
  PROJECTS,
  entryTicket,
  findPlot,
  getPlots,
  getProject,
  type Plot,
  type PlotOverrides,
  type Purpose,
} from "@/lib/inventory";
import { INDICATIVE_RATE, TOKEN_AMOUNT, TOPICS, lookupKnowledge, type Topic } from "@/lib/knowledge";

export const VIEWS = ["recommendations", "project", "plots", "plot", "calculator", "booking", "kyc", "loan"] as const;
export type View = (typeof VIEWS)[number];

const PURPOSES: Purpose[] = ["investment", "holiday_home", "self_use", "rental_income", "commercial"];

/** The demo always leads with this project, whatever the customer's answers. */
export const FEATURED_PROJECT = "anjarle";

const nullable = (schema: Record<string, unknown>) => ({ ...schema, type: [schema.type as string, "null"] });

function fn(name: string, description: string, properties: Record<string, unknown>): ChatCompletionFunctionTool {
  return {
    type: "function",
    function: {
      name,
      description,
      strict: true,
      parameters: { type: "object", properties, required: Object.keys(properties), additionalProperties: false },
    },
  };
}

export const TOOL_DEFINITIONS: ChatCompletionFunctionTool[] = [
  fn(
    "search_projects",
    "Rank the projects against the customer's profile. Call once purpose, budget and one more field are known. Returns entry ticket, rate, available plots, a fit score and a fit reason for each project.",
    {
      budget_max: nullable({ type: "number", description: "Maximum budget in rupees, e.g. 5000000 for 50 lakh." }),
      purpose: nullable({ type: "string", enum: PURPOSES }),
      region: nullable({ type: "string", description: "Place or region in the customer's words, e.g. 'near Mumbai', 'Goa', 'coastal'." }),
      horizon_years: nullable({ type: "number", description: "How many years the customer plans to hold." }),
    },
  ),
  fn(
    "list_plots",
    "List available plots in one project, filtered and sorted. Use for size, price or location questions such as 'closest to the entrance'. Sizes are fixed configurations, so a single size like 2000 matches plots within 10% of it. Returns up to 20 plots and the total that matched.",
    {
      project_id: { type: "string", enum: PROJECTS.map((p) => p.id) },
      min_size: nullable({ type: "number", description: "Minimum size in sq ft." }),
      max_size: nullable({ type: "number", description: "Maximum size in sq ft." }),
      max_price: nullable({ type: "number", description: "Maximum price in rupees." }),
      sort: nullable({ type: "string", enum: ["price", "size", "distance_from_entrance"] }),
    },
  ),
  fn(
    "get_knowledge",
    "Look up approved facts: a project topic (connectivity with distances in km, location for geography/travel routes/nearby places, payment_plan, booking_policy, title_approvals, timeline, amenities, infrastructure, developer, market) or an objection playbook (why_here, price, consult_spouse, asset_class, finance, stall). Always use this before stating a policy, date, approval or figure.",
    {
      project_id: nullable({ type: "string", enum: PROJECTS.map((p) => p.id), description: "null returns the topic for all projects, for comparisons." }),
      topic: { type: "string", enum: [...TOPICS] },
    },
  ),
  fn(
    "calculate_payment",
    "Work out the down payment, loan amount, monthly EMI and total interest for a plot price. Figures are indicative and in-principle.",
    {
      price: { type: "number", description: "Plot price in rupees." },
      down_payment_pct: { type: "number", description: "Down payment as a percent, 0 to 100." },
      annual_rate: nullable({ type: "number", description: "Annual rate as a percent. Pass null unless the customer named a rate; null uses the indicative partner-bank rate." }),
      tenure_years: { type: "number" },
    },
  ),
  fn(
    "show",
    "Change the customer's screen. Call right after recommending (view 'recommendations'), when discussing one project ('project' or 'plots' with the project id), one plot ('plot' with the plot id), money ('calculator'), or when moving to booking, KYC or loan.",
    {
      view: { type: "string", enum: [...VIEWS] },
      id: nullable({ type: "string", description: "Project id for project/plots, plot id or plot number for plot/calculator/booking." }),
    },
  ),
  fn(
    "create_booking",
    "Create an initiated booking for one plot. Takes no payment: the customer confirms the ₹45,000 token on the payment screen. Only call after the customer has clearly said they want to book that plot.",
    { plot_id: { type: "string", description: "Plot id or plot number, e.g. IA-07." } },
  ),
];

export type ToolName =
  | "search_projects"
  | "list_plots"
  | "get_knowledge"
  | "calculate_payment"
  | "show"
  | "create_booking";

export interface ToolContext {
  overrides?: PlotOverrides;
}

// ---------------------------------------------------------------- handlers

export interface SearchProjectsArgs {
  budget_max: number | null;
  purpose: Purpose | null;
  region: string | null;
  horizon_years: number | null;
}

const project0Hook = (id: string) => getProject(id)?.hook;

export function searchProjects(args: SearchProjectsArgs, ctx: ToolContext = {}) {
  const region = args.region?.toLowerCase() ?? "";
  const projects = PROJECTS.map((project) => {
    const available = getPlots(project.id, ctx.overrides).filter((p) => p.status === "available");
    const inBudget = args.budget_max ? available.filter((p) => p.price <= args.budget_max!) : available;
    const reasons: string[] = [];
    let score = 20;

    if (args.budget_max) {
      if (inBudget.length > 0) {
        score += 40;
        reasons.push(`${inBudget.length} available plots within budget`);
      } else {
        score -= 20;
        reasons.push("no available plots within budget");
      }
    }
    if (args.purpose) {
      if (project.purposes.includes(args.purpose)) {
        score += 20;
        reasons.push(`suits ${args.purpose.replace("_", " ")}`);
      } else {
        score -= 10;
      }
    }
    if (region) {
      if (project.regionKeywords.some((k) => region.includes(k))) {
        score += 15;
        reasons.push(`matches '${args.region}'`);
      } else {
        score -= 25;
        reasons.push(`outside '${args.region}'`);
      }
    }
    if (args.horizon_years) {
      if (args.horizon_years >= project.holdYearsMin) {
        score += 5;
        reasons.push(`fits a ${args.horizon_years}-year hold`);
      } else {
        reasons.push(`suggested hold is ${project.hold}, longer than planned`);
      }
    }

    return {
      id: project.id,
      name: project.name,
      location: project.location,
      illustrative: project.illustrative,
      entry_ticket: entryTicket(project),
      rate_per_sqft: project.ratePerSqft,
      cagr_range: project.cagr,
      hold: project.hold,
      available_plots: available.length,
      available_in_budget: inBudget.length,
      cheapest_in_budget: inBudget.length ? Math.min(...inBudget.map((p) => p.price)) : null,
      fit_score: Math.max(0, Math.min(100, score)),
      fit_reason: reasons.join("; ") || project.hook,
      hook: project.hook,
      featured: project.id === FEATURED_PROJECT,
    };
  }).sort((a, b) => b.fit_score - a.fit_score);

  // Demo rule: the featured project always comes first and scores highest.
  // Its reason stays honest, including when it's above the budget.
  const featured = projects.find((p) => p.featured);
  if (featured) {
    const bestOther = Math.max(0, ...projects.filter((p) => !p.featured).map((p) => p.fit_score));
    featured.fit_score = Math.min(98, Math.max(featured.fit_score, bestOther + 8, 86));
    // Nothing below the top pick may out-score it.
    for (const p of projects) if (!p.featured) p.fit_score = Math.min(p.fit_score, featured.fit_score - 6);
    featured.fit_reason = [
      "featured HoABL project",
      ...featured.fit_reason.split("; ").filter((r) => r && r !== project0Hook(featured.id) && r !== "no available plots within budget"),
    ].join("; ");
    if (featured.available_in_budget === 0 && args.budget_max) {
      featured.fit_reason += "; above budget, instalment plan and up to 50% financing available";
    }
    projects.splice(projects.indexOf(featured), 1);
    projects.unshift(featured);
  }

  return { projects };
}

export interface ListPlotsArgs {
  project_id: string;
  min_size: number | null;
  max_size: number | null;
  max_price: number | null;
  sort: "price" | "size" | "distance_from_entrance" | null;
}

function plotSummary(p: Plot) {
  return {
    id: p.id,
    plot_no: p.plotNo,
    size_sqft: p.sizeSqft,
    price: p.price,
    facing: p.facing,
    road_width_m: p.roadWidthM,
    metres_from_entrance: p.metresFromEntrance,
    is_corner: p.isCorner,
    is_park_facing: p.isParkFacing,
    status: p.status,
  };
}

export function listPlots(args: ListPlotsArgs, ctx: ToolContext = {}) {
  if (!getProject(args.project_id)) return { error: `unknown project ${args.project_id}`, plots: [], total: 0 };
  let { min_size: min, max_size: max } = args;
  // "the 2,000 sq ft options" means the nearest configuration, not exactly 2,000.
  if (min != null && max != null && max - min < min * 0.1) {
    const mid = (min + max) / 2;
    [min, max] = [mid * 0.9, mid * 1.1];
  }
  const matches = getPlots(args.project_id, ctx.overrides).filter(
    (p) =>
      p.status === "available" &&
      (min == null || p.sizeSqft >= min) &&
      (max == null || p.sizeSqft <= max) &&
      (args.max_price == null || p.price <= args.max_price),
  );
  const key = args.sort ?? "price";
  const sorted = [...matches].sort((a, b) =>
    key === "size" ? a.sizeSqft - b.sizeSqft : key === "distance_from_entrance" ? a.metresFromEntrance - b.metresFromEntrance : a.price - b.price,
  );
  return { plots: sorted.slice(0, 20).map(plotSummary), total: matches.length };
}

export interface GetKnowledgeArgs {
  project_id: string | null;
  topic: Topic;
}

export function getKnowledge(args: GetKnowledgeArgs) {
  if (!(TOPICS as readonly string[]).includes(args.topic)) return { error: `unknown topic ${args.topic}`, chunks: [] };
  return { chunks: lookupKnowledge(args.topic, args.project_id) };
}

export interface CalculatePaymentArgs {
  price: number;
  down_payment_pct: number;
  annual_rate: number | null;
  tenure_years: number;
}

export function emi(principal: number, annualRatePct: number, tenureYears: number): number {
  const n = Math.round(tenureYears * 12);
  if (principal <= 0 || n <= 0) return 0;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / n;
  return (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1);
}

export function calculatePayment(args: CalculatePaymentArgs) {
  const pct = Math.min(100, Math.max(0, args.down_payment_pct));
  const down = Math.round((args.price * pct) / 100);
  const loan = args.price - down;
  const rate = args.annual_rate ?? INDICATIVE_RATE;
  const monthly = Math.round(emi(loan, rate, args.tenure_years));
  const totalInterest = Math.max(0, monthly * Math.round(args.tenure_years * 12) - loan);
  return {
    down_payment: down,
    loan_amount: loan,
    emi: monthly,
    total_interest: totalInterest,
    annual_rate: rate,
    rate_basis: args.annual_rate == null ? "indicative partner-bank rate, in-principle" : "rate given by customer",
  };
}

export interface ShowArgs {
  view: View;
  id: string | null;
}

export function show(args: ShowArgs, ctx: ToolContext = {}) {
  if (!VIEWS.includes(args.view)) return { ok: false, error: `unknown view ${args.view}` };
  if (args.view === "project" || args.view === "plots") {
    if (!args.id || !getProject(args.id)) return { ok: false, error: `view ${args.view} needs a valid project id` };
    return { ok: true, view: args.view, id: args.id };
  }
  if (args.view === "plot") {
    const plot = args.id ? findPlot(args.id, ctx.overrides) : undefined;
    if (!plot) return { ok: false, error: "view plot needs a valid plot id or plot number" };
    return { ok: true, view: args.view, id: plot.id };
  }
  // Other views take an optional plot for context.
  const plot = args.id ? findPlot(args.id, ctx.overrides) : undefined;
  return { ok: true, view: args.view, id: plot?.id ?? null };
}

export interface CreateBookingArgs {
  plot_id: string;
}

export function createBooking(args: CreateBookingArgs, ctx: ToolContext = {}) {
  const plot = findPlot(args.plot_id, ctx.overrides);
  if (!plot) return { error: `no plot ${args.plot_id}` };
  if (plot.status !== "available") return { error: `${plot.plotNo} is ${plot.status}, not available` };
  const project = getProject(plot.projectId)!;
  return {
    booking_id: `BK-${plot.plotNo}-${Date.now().toString(36).toUpperCase().slice(-5)}`,
    plot: { ...plotSummary(plot), project_id: project.id, project_name: project.name },
    token_amount: TOKEN_AMOUNT,
    status: "initiated" as const,
  };
}

// ---------------------------------------------------------------- dispatch

export function runTool(name: string, args: unknown, ctx: ToolContext = {}): unknown {
  switch (name as ToolName) {
    case "search_projects":
      return searchProjects(args as SearchProjectsArgs, ctx);
    case "list_plots":
      return listPlots(args as ListPlotsArgs, ctx);
    case "get_knowledge":
      return getKnowledge(args as GetKnowledgeArgs);
    case "calculate_payment":
      return calculatePayment(args as CalculatePaymentArgs);
    case "show":
      return show(args as ShowArgs, ctx);
    case "create_booking":
      return createBooking(args as CreateBookingArgs, ctx);
    default:
      return { error: `unknown tool ${name}` };
  }
}

/** Short label for the tool pill, e.g. "checking availability · 9 plots in range". */
export function toolPill(name: string, result: unknown): string {
  const r = result as Record<string, unknown>;
  if (r && typeof r === "object" && "error" in r) return `${name} · ${r.error}`;
  switch (name as ToolName) {
    case "search_projects": {
      const projects = (r.projects as { fit_score: number }[]) ?? [];
      return `matching projects · ${projects.filter((p) => p.fit_score >= 75).length} strong fits`;
    }
    case "list_plots":
      return `checking availability · ${r.total} plots in range`;
    case "get_knowledge":
      return `looking up policy · ${(r.chunks as unknown[]).length} notes`;
    case "calculate_payment":
      return `working out EMI · ₹${Number(r.emi).toLocaleString("en-IN")}/mo`;
    case "show":
      return r.ok ? `opening ${r.view}` : `show failed`;
    case "create_booking":
      return `holding plot · ${(r.plot as { plot_no: string }).plot_no}`;
    default:
      return name;
  }
}
