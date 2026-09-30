// Policies, facts and the objection playbook. Plain objects, no embeddings: at
// three projects the whole corpus is small enough to look up by key.
//
// Anjarle facts are from the source documents in /assets/Anjarle (closing deck,
// opportunity doc, Liases Foras white paper, calling scripts). Where the
// documents are silent (booking and cancellation terms), the content is written
// for this POC. The payment plan follows BUILD.md (₹45,000 token, then
// 20/40/40) rather than Anjarle's real ₹99,000 EOI schedule.

import { getProject } from "@/lib/inventory";

export const PROJECT_TOPICS = [
  "connectivity",
  "location",
  "payment_plan",
  "booking_policy",
  "title_approvals",
  "timeline",
  "amenities",
  "infrastructure",
  "developer",
  "market",
] as const;

export const OBJECTION_TOPICS = [
  "why_here",
  "price",
  "consult_spouse",
  "asset_class",
  "finance",
  "stall",
] as const;

export const TOPICS = [...PROJECT_TOPICS, ...OBJECTION_TOPICS] as const;

export type ProjectTopic = (typeof PROJECT_TOPICS)[number];
export type ObjectionTopic = (typeof OBJECTION_TOPICS)[number];
export type Topic = (typeof TOPICS)[number];

export const TOKEN_AMOUNT = 45000;
/** Indicative partner-bank land-loan rate, % a year. */
export const INDICATIVE_RATE = 8.75;

const PAYMENT_PLAN_COMMON =
  "Booking starts with a ₹45,000 token. After that: 20% within 30 days of booking, 40% within 90 days, and the final 40% at registration. Plot-loan financing covers up to 50% of the plot value through partner banks at an indicative 8.75% a year, subject to eligibility and credit profile. Approval is in-principle until the bank sanctions it.";

// Connectivity is generated from the inventory's distance ladder.
type ProjectKnowledge = Record<Exclude<ProjectTopic, "connectivity">, string[]>;

export const KNOWLEDGE: Record<string, ProjectKnowledge> = {
  anjarle: {
    location: [
      "Anjarle sits at the mouth of the Jog River on the Konkan coast, in North Ratnagiri district. Nine untouched beaches line the coastline, three of them right at the site: Ridley's Beach (Anjarle Beach), Padale Beach and Savane Beach.",
      "A UNESCO-recognised biodiversity hotspot with 300+ species of flora and fauna, and a nesting ground for Olive Ridley sea turtles, with humpback dolphin sightings off nearby Harnai.",
      "By road from Mumbai: Mumbai – Panvel – Mangaon – Khed – Dapoli – Anjarle via NH 66, about 225 km, roughly 5.5 hours today. By road from Pune: via Tamhini Ghat – Mangaon – Khed – Dapoli – Anjarle, about 180 km, roughly 4.5 hours. By train: to Khed railway station, then about 40 km by road.",
      "Site visits: customers are welcome to visit Isle of Anjarle in person; the sales team arranges the visit and meets you at the site, so confirm a date with them first. Google Maps location of the site: https://maps.app.goo.gl/77RD3drQb6L4i88A6 . When the customer asks about visiting or where the site is, include this exact link once in your reply; the app shows it as a tappable map card.",
      "Nearby beaches: Karde, Murud, Ladghar (Red Sand Beach) and Tamastirth. Nearby heritage sites: the clifftop Kadyavarcha Ganpati temple, Keshavraj Temple, and Suvarnadurg Fort, a 17th-century Maratha sea fort reachable by boat from Harnai.",
    ],
    payment_plan: [
      PAYMENT_PLAN_COMMON,
      "Prices are all-inclusive list prices. CAM and corpus charges are billed separately.",
      "The Closing Deck's own Expression-of-Interest figure for Isle of Anjarle is ₹99,000, fully refundable, ahead of allotment. This app's booking flow uses the standard ₹45,000 token shown above instead.",
    ],
    booking_policy: [
      "The ₹45,000 token holds the plot for 15 days and is fully refundable within that window, no questions asked.",
      "The allotment letter is issued within 7 days of the first 20% instalment. Cancelling after allotment but before the agreement for sale forfeits only the token. After the agreement for sale, 10% of the plot value is retained and the balance is refunded within 45 days, as set out in the MahaRERA-registered agreement.",
      "Plots are allotted digitally and customers can track instalments and their portfolio in the HoABL app.",
    ],
    title_approvals: [
      "Isle of Anjarle is registered with MahaRERA as The Ridley, P52800076609, and The Ridley Phase 2, PP1281012400069. Registrations can be checked at maharera.mahaonline.gov.in.",
      "The development is phased, and each phase carries its own MahaRERA number: TomorrowView P52800050210; Tomorrowworld / Tomorrowland Phase IV P52800047713; The Ridley P52800076609; The Ridley Phase 2 PP1281012400069; Tomorrowland Phase 1 P52800031035, Phase 2 P52800031036, Phase 3 P52800033162. Which phase a specific plot falls under is confirmed at booking.",
      "The development is CRZ-compliant. Under Coastal Regulation Zone rules nothing can be built within 200 m of the high tide line, and building between 200 and 500 m is regulated.",
      "HoABL was established in 2020 and has no connection with Lodha or the Lodha Group.",
    ],
    timeline: [
      "The 20,000 sq ft clubhouse was inaugurated on 21 March 2026.",
      "The project is at the pre-possession stage, with possession expected by the end of 2026, one of the shortest delivery timelines in branded land.",
    ],
    amenities: [
      "Konkan's largest clubhouse, 20,000 sq ft and 300 ft above the Arabian Sea, has an infinity pool, lap pool, jacuzzi, indoor gym, games room, spa, restaurant, party lounge and guest rooms.",
      "Outdoor amenities include an amphitheatre, cabanas, stargazing zone, bonfire pits, skating rink, hammocks, swinging pavilions, rock climbing, a zip line, outdoor yoga and gym, a reflexology path, a pet park, organic farming and a flower nursery.",
      "Master plan by Sanjay Puri Architects. The practice was founded in 1992 and is ranked in ArchDaily's top 100 architects worldwide, and also placed by the World Architecture Community (UK) and Archello. Hospitality is run by Miros Hotels & Resorts, led by Ranvir Bhandari, whose career includes Oberoi, ITC and Soneva.",
    ],
    infrastructure: [
      "The Mumbai–Goa NH 66 is a 470 km highway and its upgrade is 92% complete, which cuts travel time by 30–40% (Liases Foras).",
      "The Konkan Marine Expressway is a 6-lane road by MSRDC costing ₹26,000 crore. It will bring the drive from Mumbai to about 3 hours.",
      "Navi Mumbai International Airport opened in December 2025 and has capacity for 9 crore passengers a year. The Mumbai–Ratnagiri Ro-Ro ferry has been running since September 2025, and the Mumbai–Madgaon Vande Bharat reaches Khed in about 4 hours.",
      "The Sagari Mahamarg coastal road corridor, about 400 km long, is operational and runs through Anjarle.",
    ],
    developer: [
      "HoABL, The House of Abhinandan Lodha, has 6,500+ customers in 27+ countries, has sold 13+ million sq ft of land and has 34+ million sq ft under development.",
      "Isle of Anjarle is a 100+ acre development, and 500+ families booked in the first 45 days.",
      "Other HoABL developments: The Sarayu Ayodhya, a 7-star land development in Ayodhya, Uttar Pradesh; One Goa — The Rhapsody, a climate-positive residential community with clubhouse and beach access in Bicholim, Goa; Nagpur Marina, a 78-acre waterfront land development in Nagpur; Miros Riviera Resort Villas, fully-furnished resort villas with ownership and rental options in Vasco da Gama, Goa; Golden Gateway Mumbai 3.0, weekend residential plots at the foothills of Matheran, Neral; and Aero Estate, India's first AAA-rated land, in Khopoli, about 40 minutes from Navi Mumbai International Airport. HoABL also has a development at Alibaug, Maharashtra.",
    ],
    market: [
      "Liases Foras, an independent research firm, estimates Anjarle land should command ₹4,000+ per sq ft today.",
      "Anjarle gets about 25,000 tourists a year, and villa stays run ₹6,000–7,000 a night (Liases Foras). Colliers projects footfall rising from 5.22 lakh to 11 lakh+ a year by 2035 and 65% occupancy by 2032.",
      "Konkan land has appreciated about 3–4x over the last decade, and Liases Foras projects up to 5x by 2035. These are projections. Land appreciation is not guaranteed.",
      "Projected regional milestones: the Konkan Marine Expressway's construction stage began March 2026, alongside the NH 66 upgrade completion target; a 20%+ rise in tourism footfall is projected for 2027 from improved road and air access; by 2034 the region's infrastructure is projected to support over 1 million annual tourists. These are projected milestones, not confirmed government timelines.",
      "An illustrative return model for a premium villa built on this land (not the bare plot itself): about ₹2.25 crore average villa cost, about 55% average annual occupancy, about ₹18,000 a night average rate, about 15% rental yield, and about 53% ROI by year 10, with the initial investment modelled as recovered by year 4. Present this as a model contingent on building a villa, never as a return on the plot alone.",
    ],
  },
  mopa: {
    location: ["Illustrative: Pernem, North Goa, near Mopa's Manohar International Airport, in the state's northern coastal belt."],
    payment_plan: [PAYMENT_PLAN_COMMON],
    booking_policy: [
      "The ₹45,000 token holds the plot for 15 days and is fully refundable within that window. After the agreement for sale, 10% of the plot value is retained on cancellation and the balance is refunded within 45 days.",
    ],
    title_approvals: [
      "Goa RERA registration PRGO99000101. The land is NA-converted with clear title, and a title search report is shared at allotment.",
    ],
    timeline: ["Illustrative: internal roads and utilities finish in 18 months, and handover follows in 24 months."],
    amenities: ["Clubhouse, central green, jogging track and children's play area, in an illustrative layout."],
    infrastructure: [
      "Manohar International Airport at Mopa is 8 km away and NH 66 is 3 km away.",
      "Airport-led hotel and warehousing demand usually lifts land values around a new airport in its first decade. This is a pattern, not a guarantee.",
    ],
    developer: ["Illustrative demo project, used for comparison only."],
    market: ["Illustrative: land close to new airports has historically outperformed the regional average, but past performance does not guarantee future returns."],
  },
  nagpur: {
    location: ["Illustrative: on the Samruddhi Mahamarg corridor in Nagpur, Vidarbha region of Maharashtra, near the MIHAN SEZ."],
    payment_plan: [PAYMENT_PLAN_COMMON],
    booking_policy: [
      "The ₹45,000 token holds the plot for 15 days and is fully refundable within that window. After the agreement for sale, 10% of the plot value is retained on cancellation and the balance is refunded within 45 days.",
    ],
    title_approvals: [
      "MahaRERA registration P99900000102. The land is zoned residential and light commercial with clear title, and a title search report is shared at allotment.",
    ],
    timeline: ["Illustrative: infrastructure is complete and plots are ready for registration."],
    amenities: ["Streetlights, drainage, water line and a 24 m approach road, in an illustrative layout."],
    infrastructure: [
      "The Samruddhi Mahamarg interchange is 4 km away, the MIHAN SEZ 18 km and Nagpur airport 22 km.",
      "Warehousing along the expressway corridor is taking up land parcels. This is a trend, not a guarantee.",
    ],
    developer: ["Illustrative demo project, used for comparison only."],
    market: ["Illustrative: corridor land is the lowest ticket and the slowest to appreciate of the three, and suits a patient investor."],
  },
};

/** Approved response shapes. The agent paraphrases them and never goes beyond them. */
export const OBJECTIONS: Record<ObjectionTopic, { general: string; byProject?: Record<string, string> }> = {
  why_here: {
    general:
      "Answer with facts about the corridor, the infrastructure timeline and what the developer has already delivered. Pull the project's infrastructure and timeline topics for figures.",
    byProject: {
      anjarle:
        "Anjarle is true sea-and-hill land, which covers under 0.1% of India's coastline, and CRZ rules cap new supply by law. The infrastructure is arriving now: NH 66 is 92% upgraded, Navi Mumbai airport is open, and the coastal expressway will bring Mumbai to about 3 hours. The clubhouse is already built and was inaugurated on 21 March 2026, so there is something real to see.",
    },
  },
  price: {
    general:
      "Never offer a discount or price exception. Offer, in this order: a smaller plot size, the instalment plan (₹45,000 token, then 20/40/40), and financing of up to 50% through partner banks. Ask which of these helps most.",
  },
  consult_spouse: {
    general:
      "Treat it as sensible. Offer to send a short summary of the shortlisted plot, price and payment plan, and suggest a time to reconnect together. Do not push for a decision today.",
  },
  asset_class: {
    general:
      "You may compare land with other assets: land needs no maintenance, has limited supply and does not depreciate like a built structure. Rental yield for leisure land at Anjarle is projected by Liases Foras at 12–15%, against 2–3% for metro residential. Say clearly that no one can guarantee returns and that land is illiquid compared with equities or FDs. On resale or exit later, point to the same projected appreciation range rather than a guarantee. On 'why land instead of an apartment', it's fine to note plainly that land carries no construction to maintain and lets the buyer control the timeline, without attaching a return figure to that point specifically.",
  },
  finance: {
    general:
      "Explain the eligibility flow: income, existing obligations, employment type and credit band give an in-principle eligibility figure. Rates are indicative and a bank sanction is needed before anything is final. Offer to run the loan eligibility screen.",
  },
  stall: {
    general:
      "Ask gently what is holding them back (timing, budget, family or something else), note the reason, offer a follow-up, and apply no pressure. On a second stall, offer to connect a human advisor.",
  },
};

export interface KnowledgeChunk {
  text: string;
  topic: string;
}

export function lookupKnowledge(topic: Topic, projectId?: string | null): KnowledgeChunk[] {
  if ((OBJECTION_TOPICS as readonly string[]).includes(topic)) {
    const entry = OBJECTIONS[topic as ObjectionTopic];
    const chunks: KnowledgeChunk[] = [{ text: entry.general, topic }];
    if (projectId && entry.byProject?.[projectId]) chunks.push({ text: entry.byProject[projectId], topic });
    return chunks;
  }
  const projectIds = projectId ? [projectId] : Object.keys(KNOWLEDGE);
  return projectIds.flatMap((id) => {
    const texts = topic === "connectivity" ? connectivityText(id) : KNOWLEDGE[id]?.[topic as Exclude<ProjectTopic, "connectivity">] ?? [];
    return texts.map((text) => ({ text: projectId ? text : `[${id}] ${text}`, topic }));
  });
}

function connectivityText(projectId: string): string[] {
  const project = getProject(projectId);
  if (!project) return [];
  return [
    `${project.name} distances: ` +
      project.connectivity.map((c) => `${c.label} ${c.km} km${c.note ? ` (${c.note})` : ""}`).join("; ") + ".",
  ];
}
