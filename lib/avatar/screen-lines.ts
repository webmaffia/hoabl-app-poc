// What the Land Advisor says when the customer opens a screen themselves, so
// the voice always matches what's on screen. Scripted, and built only from
// app data, so every figure is exact. When the advisor itself opened the
// screen (a `show` call), its own reply covers it and none of this is said.

import { findPlot, getProject, type Plot, type PlotOverrides } from "@/lib/inventory";

const spokenLakh = (rupees: number) => `₹${(rupees / 1e5).toFixed(2)} lakh`;

export interface ScreenCue {
  /** Stop what the avatar was saying about the previous screen. */
  interrupt: boolean;
  /** A line for this screen, if it has one. */
  line: string | null;
}

interface CueState {
  firstName: string | null;
  booking: { plot_no: string; status: "initiated" | "paid" } | null;
  kycDone: boolean;
  /** The next payment-plan step still to do; null when all are done. Omitted when unknown. */
  plan?: string | null;
}

export function screenCue(path: string, s: CueState): ScreenCue {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "agent" || parts.length === 0) return { interrupt: false, line: null };

  if (parts[0] === "plots") {
    if (parts.length === 1) {
      return {
        interrupt: true,
        line: `Here are the projects I'd recommend${s.firstName ? `, ${s.firstName}` : ""}. Isle of Anjarle is my top pick for you. Tap Explore to take a closer look.`,
      };
    }
    const project = getProject(parts[1]);
    if (!project) return { interrupt: true, line: null };
    if (parts[2] === "map") {
      return {
        interrupt: true,
        line: `This is the plot map for ${project.name}. Plots with a green border are available, the hatched ones are already sold, and the arrow marks the entrance. Tap any plot to see its size, price and distance from the entrance.`,
      };
    }
    // The project page narrates its own films; a page without films gets a line.
    if (project.videos?.length) return { interrupt: false, line: null };
    return {
      interrupt: true,
      line: `Here's ${project.name}. Take a look at the details, and I'll take you to the plots whenever you're ready.`,
    };
  }

  if (parts[0] === "money") {
    if (parts[1] === "loan") {
      return {
        interrupt: true,
        line: "Let's check your loan eligibility. Enter your monthly income and any existing EMIs, and I'll show what a partner bank could lend you, in-principle.",
      };
    }
    return {
      interrupt: true,
      line: "Here's what it costs you. Move the sliders to try a different down payment, rate or tenure, and the EMI updates as you go.",
    };
  }

  if (parts[0] === "booking") {
    if (parts[1] === "plan") {
      if (!s.booking || s.booking.status !== "paid") return { interrupt: true, line: "The payment plan opens once your token is paid. Let's finish the booking first." };
      if (!s.kycDone) return { interrupt: true, line: "The payment plan opens after KYC. Let's finish your KYC first." };
      const said: Record<string, string> = {
        i20: "Your KYC is done. Next is the 20% instalment. Tap the button to pay it, and I'll take you through what follows.",
        allotment: "Your 20% instalment is in. Next is your allotment letter. Tap the button to get it.",
        i40: "You have your allotment letter. Next is the 40% instalment. Tap the button when you're ready.",
        registration: "Only registration is left. Pay the final 40% and your plot is registered.",
      };
      const line = s.plan === undefined ? "These are your remaining steps. We take them one at a time, in order." : s.plan === null ? "Every step is done, and your plot is registered. That completes your booking." : (said[s.plan] ?? null);
      return { interrupt: true, line };
    }
    if (parts[1] === "kyc") {
      return {
        interrupt: true,
        line: s.kycDone
          ? "Your KYC is complete. We can check your loan eligibility next."
          : "This is a quick KYC. It takes about two minutes: your PAN, a DigiLocker consent, your address and a short selfie check.",
      };
    }
    if (!s.booking) return { interrupt: true, line: "Pick a plot on the map, and I'll hold it for you." };
    return {
      interrupt: true,
      line:
        s.booking.status === "paid"
          ? `Plot ${s.booking.plot_no} is held for you. Here's your confirmation and what happens next.${s.booking.status === "paid" && !s.kycDone ? " Your next step is KYC." : ""}`
          : `Here's your booking summary for plot ${s.booking.plot_no}. Choose how you'd like to pay the ₹45,000 token, and the plot is held for you.`,
    };
  }

  return { interrupt: true, line: null };
}

/** What the Land Advisor says when the customer taps a plot on the map. */
export function plotLine(plotId: string, overrides: PlotOverrides = {}): string | null {
  const plot: Plot | undefined = findPlot(plotId, overrides);
  if (!plot) return null;
  const extras = [plot.isCorner && "a corner plot", plot.isParkFacing && "facing the central green"].filter(Boolean).join(" and ");
  const status =
    plot.status === "available" ? "It's available. Shall I hold it for you?" : plot.status === "held" ? "It's on hold right now." : "This one is already sold.";
  return `${plot.plotNo} is ${plot.sizeSqft.toLocaleString("en-IN")} square feet, ${plot.facing.toLowerCase()}-facing${extras ? `, ${extras}` : ""}, ${plot.metresFromEntrance} metres from the entrance, at ${spokenLakh(plot.price)}. ${status}`;
}
