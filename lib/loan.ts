// Loan eligibility, in-principle only. FOIR (the share of income that can go
// to EMIs) and the rate depend on credit band; eligibility is the EMI headroom
// annuitised at the band rate over 15 years, capped at 50% of plot value.

import { emi } from "@/lib/agent/tools";

export const BANDS = [
  { id: "excellent", label: "Excellent", range: "750+", foir: 0.55, rate: 8.5 },
  { id: "good", label: "Good", range: "700–749", foir: 0.5, rate: 8.9 },
  { id: "fair", label: "Fair", range: "650–699", foir: 0.45, rate: 9.6 },
  { id: "building", label: "Building", range: "Below 650", foir: 0.38, rate: 10.75 },
] as const;

export type BandId = (typeof BANDS)[number]["id"];
export const TENURE_YEARS = 15;
export const MAX_LTV = 0.5;

export interface Eligibility {
  band: (typeof BANDS)[number];
  headroomEmi: number;
  byIncome: number;
  cap: number;
  eligible: number;
  emi: number;
  limitedBy: "income" | "ltv" | "none";
}

/** Largest principal whose EMI fits the headroom. */
export function principalFor(monthly: number, ratePct: number, years: number): number {
  if (monthly <= 0) return 0;
  const r = ratePct / 12 / 100;
  const n = years * 12;
  return (monthly * ((1 + r) ** n - 1)) / (r * (1 + r) ** n);
}

export function eligibility(input: { income: number; obligations: number; band: BandId; plotPrice: number }): Eligibility {
  const band = BANDS.find((b) => b.id === input.band)!;
  const headroomEmi = Math.max(0, input.income * band.foir - input.obligations);
  const byIncome = Math.floor(principalFor(headroomEmi, band.rate, TENURE_YEARS) / 1000) * 1000;
  const cap = Math.floor((input.plotPrice * MAX_LTV) / 1000) * 1000;
  const eligible = Math.min(byIncome, cap);
  return {
    band,
    headroomEmi,
    byIncome,
    cap,
    eligible,
    emi: Math.round(emi(eligible, band.rate, TENURE_YEARS)),
    limitedBy: eligible === 0 ? "none" : byIncome < cap ? "income" : "ltv",
  };
}
