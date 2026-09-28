import { describe, expect, it } from "vitest";
import { QUESTIONS, handoff, intro, profileFrom } from "@/lib/onboarding";
import { collectEvidence } from "@/lib/agent/guard";

describe("welcome questions", () => {
  it("asks the client's three preset questions with their options", () => {
    expect(QUESTIONS.map((q) => q.options.length)).toEqual([3, 4, 4]);
    expect(QUESTIONS[0].ask(null)).toBe("Let's find the right land for you. What are you mainly buying the land for?");
  });

  it("introduces HoABL and the Land Advisor first, by first name", () => {
    expect(intro("Priya Nair")).toMatch(/^Hi Priya, welcome to The House of Abhinandan Lodha\./);
    expect(intro("Priya Nair")).toMatch(/I'm your Land Advisor/);
    expect(intro(null)).toMatch(/^Hi, welcome/);
    expect(intro("Priya")).not.toMatch(/\bAI\b/);
  });

  it("never uses the word AI", () => {
    for (const q of QUESTIONS) expect(q.ask("Ravi")).not.toMatch(/\bAI\b/);
  });

  it("maps answers onto the profile", () => {
    expect(profileFrom(["Investment", "₹35L – ₹50L", "Long-term wealth creation"])).toEqual({ purpose: "investment", budget_max: 5_000_000 });
    expect(profileFrom(["Personal use", "< ₹20L", "Not sure yet"])).toEqual({ purpose: "holiday_home", budget_max: 2_000_000 });
    expect(profileFrom(["Both", "something typed", "Future development / income"])).toEqual({ purpose: "rental_income", budget_max: null });
  });

  it("hands the budget to the agent as figures it may repeat", () => {
    const ev = collectEvidence(handoff(["Investment", "₹35L – ₹50L", "Long-term wealth creation"]));
    expect(ev.numbers).toEqual(expect.arrayContaining([3_500_000, 5_000_000]));
  });
});
