// The welcome questions asked right after registration, word for word from
// the client's preset script. They run scripted (no model call), so they're
// instant and identical every time. Once all three are answered, the Land
// Advisor takes over with the answers as the customer's profile.

import type { Profile } from "@/lib/agent/prompt";

export interface OnboardingQuestion {
  ask: (name: string | null) => string;
  options: string[];
}

/**
 * Spoken before the first question: who HoABL is and who the Land Advisor is.
 * Figures are from HoABL's own material (the closing deck and calling scripts).
 */
export function intro(name: string | null): string {
  const first = name?.split(" ")[0];
  return `Hi${first ? ` ${first}` : ""}, welcome to The House of Abhinandan Lodha. HoABL is India's branded land developer, trusted by over 6,500 customers across 27 countries, with land in some of India's most sought-after destinations. I'm your Land Advisor. I'll help you find the right plot, answer anything about price, location or paperwork, and hold a plot for you when you're ready.`;
}

export const QUESTIONS: OnboardingQuestion[] = [
  {
    // The preset opener minus its greeting, which the intro already covers.
    ask: () => "Let's find the right land for you. What are you mainly buying the land for?",
    options: ["Investment", "Personal use", "Both"],
  },
  {
    ask: () => "What's your approximate budget?",
    options: ["< ₹20L", "₹20L – ₹35L", "₹35L – ₹50L", "> ₹50L"],
  },
  {
    ask: () => "What's the expected purpose of this land?",
    options: ["Long-term wealth creation", "Future development / income", "Personal use / second home", "Not sure yet"],
  },
];

const BUDGETS: Record<string, number> = {
  "< ₹20L": 2_000_000,
  "₹20L – ₹35L": 3_500_000,
  "₹35L – ₹50L": 5_000_000,
  "> ₹50L": 10_000_000,
};

/** Maps the three answers onto the profile fields the agent and search use. */
export function profileFrom(answers: string[]): Partial<Profile> {
  const [buyingFor, budget, intent] = answers;
  const byIntent: Record<string, string | null> = {
    "Long-term wealth creation": "investment",
    "Future development / income": "rental_income",
    "Personal use / second home": "holiday_home",
    "Not sure yet": null,
  };
  const byBuyingFor: Record<string, string> = { Investment: "investment", "Personal use": "holiday_home", Both: "investment" };
  return {
    purpose: byIntent[intent] ?? byBuyingFor[buyingFor] ?? null,
    budget_max: BUDGETS[budget] ?? null,
  };
}

/** The hand-off message the agent sees (not shown in the transcript). */
export function handoff(answers: string[]): string {
  const [buyingFor, budget, intent] = answers;
  return `[Onboarding] The customer answered the welcome questions in the app. Buying land for: ${buyingFor}. Approximate budget: ${budget}. Expected purpose: ${intent}.`;
}
