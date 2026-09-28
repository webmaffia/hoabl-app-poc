import { describe, expect, it } from "vitest";
import { forSpeech } from "@/lib/avatar/spoken";

describe("forSpeech", () => {
  it("reads money, sizes, ranges and plot numbers naturally", () => {
    expect(forSpeech("IA-05 is 1,506 sq ft at ₹43.99 lakh, 84 m from the gate.")).toBe(
      "plot I A 05 is 1,506 square feet at 43.99 lakh rupees, 84 metres from the gate.",
    );
    expect(forSpeech("The token is ₹45,000 and the hold is 7–10 years.")).toBe("The token is 45,000 rupees and the hold is 7 to 10 years.");
    expect(forSpeech("Mumbai is 225 km away.")).toBe("Mumbai is 225 kilometres away.");
  });

  it("spells the brand out letter by letter", () => {
    expect(forSpeech("I’m HoABL’s Land Advisor. HOABL is India's branded land developer.")).toBe(
      "I’m H O A B L’s Land Advisor. H O A B L is India's branded land developer.",
    );
  });
});
