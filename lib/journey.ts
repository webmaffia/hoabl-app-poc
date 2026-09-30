// Maps the agent's `show` views to routes and back. The agent drives the
// screen; the customer can also navigate, and the current screen goes back to
// the agent as context on every turn.

import { findPlot } from "@/lib/inventory";

export type View = "recommendations" | "project" | "location" | "plots" | "plot" | "calculator" | "booking" | "kyc" | "loan" | "plan";

export interface Screen {
  view: View;
  id: string | null;
}

export const VIEW_LABEL: Record<View, string> = {
  recommendations: "Recommendations",
  project: "Project details",
  location: "Site location",
  plots: "Plot map",
  plot: "Plot details",
  calculator: "Payment calculator",
  booking: "Booking",
  kyc: "KYC",
  loan: "Loan eligibility",
  plan: "Payment plan",
};

export function routeFor(screen: Screen): string {
  switch (screen.view) {
    case "recommendations":
      return "/plots";
    case "project":
      return `/plots/${screen.id ?? "anjarle"}`;
    case "location":
      return `/plots/${screen.id ?? "anjarle"}`;
    case "plots":
      return `/plots/${screen.id ?? "anjarle"}/map`;
    case "plot": {
      const plot = screen.id ? findPlot(screen.id) : undefined;
      return `/plots/${plot?.projectId ?? "anjarle"}/map`;
    }
    case "calculator":
      return "/money/calculator";
    case "booking":
      return "/booking";
    case "kyc":
      return "/booking/kyc";
    case "loan":
      return "/money/loan";
    case "plan":
      return "/booking/plan";
  }
}

/** The screen a path shows, or null for the bare advisor screen. */
export function screenFromPath(path: string, selectedPlot: string | null): Screen | null {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "plots") {
    if (parts.length === 1) return { view: "recommendations", id: null };
    if (parts[2] === "map") return selectedPlot && findPlot(selectedPlot)?.projectId === parts[1] ? { view: "plot", id: selectedPlot } : { view: "plots", id: parts[1] };
    return { view: "project", id: parts[1] };
  }
  if (parts[0] === "money") return { view: parts[1] === "loan" ? "loan" : "calculator", id: selectedPlot };
  if (parts[0] === "booking") return { view: parts[1] === "kyc" ? "kyc" : parts[1] === "plan" ? "plan" : "booking", id: selectedPlot };
  return null;
}

// ---------------------------------------------------------------- formatting

export function lakh(rupees: number, digits = 2): string {
  if (rupees >= 1e7) return `₹${(rupees / 1e7).toFixed(2)} Cr`;
  return `₹${(rupees / 1e5).toFixed(digits)} L`;
}

export function inr(rupees: number): string {
  return `₹${Math.round(rupees).toLocaleString("en-IN")}`;
}

export function sqft(n: number): string {
  return `${n.toLocaleString("en-IN")} sq ft`;
}

/** Whole years since an ISO date (yyyy-mm-dd), or null if it isn't one. */
export function yearsSince(iso: string): number | null {
  const t = new Date(iso).getTime();
  if (!iso || Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (365.25 * 86400000));
}

export function dateIn(days: number, from = Date.now()): string {
  return new Date(from + days * 86400000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
