// Projects and a seeded plot generator. Deterministic: every demo run sees the
// same plots, prices and statuses.
//
// Isle of Anjarle is a real HoABL project; its facts come from the source
// documents in /assets/Anjarle. Mopa and Samruddhi are illustrative projects
// that exist so there is something to compare against.

export type PlotStatus = "available" | "held" | "sold";

export interface Connectivity {
  label: string;
  km: number;
  note?: string;
}

export interface ProjectVideo {
  src: string;
  poster: string;
  title: string;
  /** What the Land Advisor says over this film (the films play muted). */
  narration: string;
}

export interface Project {
  id: string;
  name: string;
  location: string;
  region: string;
  developer: string;
  illustrative: boolean;
  /** Headline ₹/sq ft; sizeRates overrides it per size where real list prices exist. */
  ratePerSqft: number;
  sizeRates?: Record<number, number>;
  sizes: number[];
  plotCount: number;
  plotPrefix: string;
  cagr: string;
  hold: string;
  holdYearsMin: number;
  rera_no: string;
  hook: string;
  connectivity: Connectivity[];
  features: string[];
  purposes: Purpose[];
  /** Lower-case words a customer might use for this region. */
  regionKeywords: string[];
  cols: number;
  entranceRow: number;
  entranceCol: number;
  /** Row that faces the central green. */
  parkRow: number;
  /** Walkthrough films, shown full screen the first time the project opens. */
  videos?: ProjectVideo[];
  /** Hero image for cards and the project page. */
  image?: string;
}

export type Purpose = "investment" | "holiday_home" | "self_use" | "rental_income" | "commercial";

export interface Plot {
  id: string;
  projectId: string;
  plotNo: string;
  sizeSqft: number;
  facing: string;
  roadWidthM: number;
  gridRow: number;
  gridCol: number;
  isCorner: boolean;
  isParkFacing: boolean;
  metresFromEntrance: number;
  price: number;
  status: PlotStatus;
}

export const PROJECTS: Project[] = [
  {
    id: "anjarle",
    name: "Isle of Anjarle",
    location: "Anjarle, Dapoli, Ratnagiri, Maharashtra",
    region: "Konkan coast, Maharashtra",
    developer: "The House of Abhinandan Lodha (HoABL)",
    illustrative: false,
    ratePerSqft: 3094,
    // Real all-inclusive list prices: 1,367 = ₹39.99 L, 1,506 = ₹43.99 L,
    // 2,002 = ₹61.94 L, 2,723 = ₹83.87 L (CAM and corpus extra).
    // 600 and 1,000 sq ft are demo-only sizes at the same rate, so every
    // budget bracket in the welcome questions has plots:
    //   < ₹20L: 600 · ₹20–35L: 1,000 · ₹35–50L: 1,367, 1,506 · > ₹50L: 2,002, 2,723
    // (1,367 and 1,506 are sold out in reality; the demo keeps some available.)
    sizeRates: { 600: 2950, 1000: 2950, 1367: 2925, 1506: 2921, 2002: 3094, 2723: 3080 },
    sizes: [600, 1000, 1367, 1506, 2002, 2723],
    plotCount: 24,
    plotPrefix: "IA",
    cagr: "Konkan land up about 3–4x over the last decade; Liases Foras projects up to 5x by 2035. Projections, not guaranteed.",
    hold: "7–10 years",
    holdYearsMin: 7,
    rera_no: "MahaRERA P52800076609 (The Ridley); Phase 2 PP1281012400069",
    hook: "A 100+ acre clifftop estate where the Sahyadri meets the Arabian Sea, on one of the under 0.1% of India's coastline that is true sea-and-hill land, with supply capped by CRZ rules.",
    connectivity: [
      { label: "Dapoli town", km: 24.3, note: "about 45 minutes" },
      { label: "Khed railway station (Vande Bharat)", km: 53.8, note: "about 2 hours" },
      { label: "Mumbai", km: 225, note: "about 5.5 hours today, 3–4 hours after the expressway" },
      { label: "Navi Mumbai International Airport", km: 224, note: "about 6 hours via Khed and Dapoli" },
      { label: "Pune International Airport", km: 234, note: "about 6 hours via Khed and Dapoli" },
    ],
    features: [
      "20,000 sq ft clifftop clubhouse 300 ft above the sea, inaugurated 21 March 2026",
      "Master plan by Sanjay Puri Architects, 30+ amenities",
      "Hospitality run by Miros Hotels & Resorts",
      "Three beaches at the site: Ridley's (Anjarle), Padale and Savane",
    ],
    purposes: ["investment", "holiday_home", "rental_income"],
    regionKeywords: ["mumbai", "pune", "konkan", "maharashtra", "ratnagiri", "dapoli", "coast", "coastal", "beach", "sea", "anjarle"],
    cols: 4,
    entranceRow: 5,
    entranceCol: 0,
    parkRow: 2,
    image: "/projects/anjarle/renders/aerial-view.jpg",
    videos: [
      {
        src: "/projects/anjarle/videos/product.mp4",
        poster: "/projects/anjarle/videos/product.jpg",
        title: "The project",
        narration:
          "This is Isle of Anjarle, a 100-acre clifftop estate where the Sahyadri hills meet the Arabian Sea. The master plan is by Sanjay Puri, one of the world's top-ranked architects, with over 30 amenities and a grand clubhouse 300 feet above the sea.",
      },
      {
        src: "/projects/anjarle/videos/location.mp4",
        poster: "/projects/anjarle/videos/location.jpg",
        title: "The location",
        narration:
          "Anjarle sits on the Konkan coast, often called the Goa of tomorrow. There are nine untouched beaches along this stretch, three of them right at the site, and it's a protected biodiversity hotspot, so this coastline stays unspoilt.",
      },
      {
        src: "/projects/anjarle/videos/infrastructure.mp4",
        poster: "/projects/anjarle/videos/infrastructure.jpg",
        title: "Infrastructure",
        narration:
          "Getting here is getting faster. The Mumbai–Goa highway upgrade is nearly complete, Navi Mumbai airport is open, and the new coastal expressway will bring Mumbai to about three hours away.",
      },
      {
        src: "/projects/anjarle/videos/process.mp4",
        poster: "/projects/anjarle/videos/process.jpg",
        title: "How buying works",
        narration:
          "Buying is simple and fully digital. You pick your plot, pay a token to hold it, complete KYC online, and pay the rest in instalments, with financing available through partner banks.",
      },
      {
        src: "/projects/anjarle/videos/testimonials.mp4",
        poster: "/projects/anjarle/videos/testimonials.jpg",
        title: "Customer stories",
        narration:
          "And this is what our customers say. Over 6,500 families across 27 countries have chosen HoABL land. Take a moment to hear from a few of them.",
      },
    ],
  },
  {
    id: "mopa",
    name: "Mopa Airport Hinterland",
    location: "Pernem, North Goa",
    region: "North Goa",
    developer: "Illustrative demo project",
    illustrative: true,
    ratePerSqft: 3600,
    // One size per budget bracket: 500 < ₹20L · 800 ₹20–35L · 1,200 ₹35–50L · 1,800 > ₹50L
    sizes: [500, 800, 1200, 1800],
    plotCount: 14,
    plotPrefix: "MA",
    cagr: "Illustrative 9–12% a year over the hold. Not guaranteed.",
    hold: "5–8 years",
    holdYearsMin: 5,
    rera_no: "PRGO99000101",
    hook: "Land beside Goa's new international airport, where hotel and logistics demand usually arrives before the infrastructure is finished.",
    connectivity: [
      { label: "NH 66", km: 3 },
      { label: "Manohar International Airport, Mopa", km: 8 },
      { label: "Pernem railway station", km: 12 },
      { label: "Arambol beach", km: 22 },
      { label: "Panaji", km: 38 },
    ],
    features: [
      "Gated layout with 9 m and 12 m internal roads",
      "Underground power and water lines to every plot",
      "Clubhouse and central green",
      "Clear-title, NA-converted land",
    ],
    purposes: ["investment", "holiday_home", "commercial"],
    regionKeywords: ["goa", "north goa", "pernem", "mopa", "airport", "coast", "beach"],
    cols: 4,
    entranceRow: 0,
    entranceCol: 1,
    parkRow: 2,
    // Stand-in only: North Goa photography from HoABL's real "One Goa" project — this project itself is illustrative.
    image: "https://hoabl-bucket.s3.ap-south-1.amazonaws.com/One_Goa_Image_1_jpg_771bf9993b.webp",
  },
  {
    id: "nagpur",
    name: "Samruddhi Logistics Belt",
    location: "Nagpur, Maharashtra",
    region: "Vidarbha, Maharashtra",
    developer: "Illustrative demo project",
    illustrative: true,
    ratePerSqft: 1450,
    // One size per budget bracket: 1,000 < ₹20L · 2,000 ₹20–35L · 3,000 ₹35–50L · 5,000 > ₹50L
    sizes: [1000, 2000, 3000, 5000],
    plotCount: 12,
    plotPrefix: "SL",
    cagr: "Illustrative 8–11% a year over the hold. Not guaranteed.",
    hold: "6–10 years",
    holdYearsMin: 6,
    rera_no: "MahaRERA P99900000102",
    hook: "The lowest entry ticket on the Samruddhi Mahamarg corridor, near the MIHAN SEZ, where warehousing is taking up land.",
    connectivity: [
      { label: "Samruddhi Mahamarg interchange", km: 4 },
      { label: "Butibori MIDC", km: 14 },
      { label: "MIHAN SEZ", km: 18 },
      { label: "Dr. Babasaheb Ambedkar International Airport", km: 22 },
      { label: "Nagpur city centre", km: 26 },
    ],
    features: [
      "Plots zoned for residential and light commercial use",
      "24 m approach road off the expressway service lane",
      "Streetlights, drainage and water line built",
      "Lowest ticket of the three projects",
    ],
    purposes: ["investment", "commercial", "self_use"],
    regionKeywords: ["nagpur", "vidarbha", "maharashtra", "samruddhi", "logistics", "mihan"],
    cols: 4,
    entranceRow: 0,
    entranceCol: 0,
    parkRow: 1,
    // Stand-in only: Nagpur photography from HoABL's real "Nagpur Marina" project — this project itself is illustrative.
    image: "https://hoabl-bucket.s3.ap-south-1.amazonaws.com/Web_Site_Banner_Nagpur_01_jpg_4b8b661ba4.webp",
  },
];

export interface OtherProject {
  name: string;
  location: string;
  description: string;
  image?: string;
}

/**
 * Real HoABL developments with no plot/pricing data in this app's inventory —
 * shown for awareness only (name, location, photo), never bookable here.
 * Single source of truth for both the agent's system prompt (lib/agent/prompt.ts)
 * and the "more from HoABL" UI card lists.
 */
export const OTHER_HOABL_PROJECTS: OtherProject[] = [
  {
    name: "The Sarayu Ayodhya",
    location: "Ayodhya, Uttar Pradesh",
    description: "A 7-star land development in Ayodhya",
    image: "https://hoabl-bucket.s3.ap-south-1.amazonaws.com/Web_Site_Banner_June_19x2_02_jpg_0cda8162fc.webp",
  },
  {
    name: "One Goa — The Rhapsody",
    location: "Bicholim, Goa",
    description: "A climate-positive residential community with clubhouse and beach access",
    image: "https://hoabl-bucket.s3.ap-south-1.amazonaws.com/One_Goa_Image_1_jpg_771bf9993b.webp",
  },
  {
    name: "Nagpur Marina",
    location: "Nagpur, Maharashtra",
    description: "A 78-acre waterfront land development",
    image: "https://hoabl-bucket.s3.ap-south-1.amazonaws.com/Web_Site_Banner_Nagpur_01_jpg_4b8b661ba4.webp",
  },
  {
    name: "Miros Riviera Resort Villas",
    location: "Vasco da Gama, Goa",
    description: "Fully-furnished resort villas with ownership and rental options",
    image: "https://hoabl-bucket.s3.ap-south-1.amazonaws.com/hero_banner_desktop_jpg_a7e77cadc1.webp",
  },
  {
    name: "Golden Gateway Mumbai 3.0",
    location: "Neral, Maharashtra",
    description: "Weekend residential plots at the foothills of Matheran",
    image: "https://hoabl-bucket.s3.ap-south-1.amazonaws.com/Flight_2_png_4740a0ed9b.webp",
  },
  {
    name: "Aero Estate",
    location: "Khopoli, Mumbai 3.0, Maharashtra",
    description: "India's first AAA-rated land, about 40 minutes from Navi Mumbai International Airport",
    image: "https://hoabl-bucket.s3.ap-south-1.amazonaws.com/Website_Image_Desktop_version_jpg_jpeg_e2857df1bd.webp",
  },
  {
    name: "Alibaug development",
    location: "Alibaug, Maharashtra",
    description: "Another HoABL branded land development",
  },
];

// mulberry32, seeded from the project id
function seededRandom(seedText: string): () => number {
  let seed = 0;
  for (const ch of seedText) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const FACINGS = ["East", "West", "North", "South", "North-East", "South-West"];

export function rateFor(project: Project, sizeSqft: number): number {
  return project.sizeRates?.[sizeSqft] ?? project.ratePerSqft;
}

export function metresFromEntrance(project: Project, row: number, col: number): number {
  return (Math.abs(col - project.entranceCol) + Math.abs(row - project.entranceRow)) * 22 + 40;
}

export function plotPrice(project: Project, sizeSqft: number, isCorner: boolean, isParkFacing: boolean, metres: number): number {
  const multiplier = 1 + (isCorner ? 0.06 : 0) + (isParkFacing ? 0.04 : 0) - (metres > 200 ? 0.03 : 0);
  return Math.round((sizeSqft * rateFor(project, sizeSqft) * multiplier) / 1000) * 1000;
}

function generatePlots(project: Project): Plot[] {
  const rand = seededRandom(project.id);
  const rows = Math.ceil(project.plotCount / project.cols);

  // Even spread of sizes, shuffled.
  const sizes = shuffle(
    Array.from({ length: project.plotCount }, (_, i) => project.sizes[i % project.sizes.length]),
    rand,
  );

  const plots: Plot[] = [];
  for (let i = 0; i < project.plotCount; i++) {
    const gridRow = Math.floor(i / project.cols);
    const gridCol = i % project.cols;
    const isCorner = (gridRow === 0 || gridRow === rows - 1) && (gridCol === 0 || gridCol === project.cols - 1);
    const isParkFacing = gridRow === project.parkRow;
    const metres = metresFromEntrance(project, gridRow, gridCol);
    const sizeSqft = sizes[i];
    plots.push({
      id: `${project.id}-${i + 1}`,
      projectId: project.id,
      plotNo: `${project.plotPrefix}-${String(i + 1).padStart(2, "0")}`,
      sizeSqft,
      facing: FACINGS[Math.floor(rand() * FACINGS.length)],
      roadWidthM: gridRow === project.entranceRow ? 12 : 9,
      gridRow,
      gridCol,
      isCorner,
      isParkFacing,
      metresFromEntrance: metres,
      price: plotPrice(project, sizeSqft, isCorner, isParkFacing, metres),
      status: "available",
    });
  }

  // About 35% sold and 10% held, chosen by seeded shuffle.
  const order = shuffle(plots.map((_, i) => i), rand);
  const sold = Math.round(project.plotCount * 0.35);
  const held = Math.round(project.plotCount * 0.1);
  order.slice(0, sold).forEach((i) => (plots[i].status = "sold"));
  order.slice(sold, sold + held).forEach((i) => (plots[i].status = "held"));

  // Every size keeps at least two plots available, so no budget bracket is
  // ever sold out in the demo.
  for (const size of project.sizes) {
    const ofSize = plots.filter((p) => p.sizeSqft === size);
    let free = ofSize.filter((p) => p.status === "available").length;
    for (const p of ofSize) {
      if (free >= Math.min(2, ofSize.length)) break;
      if (p.status !== "available") {
        p.status = "available";
        free++;
      }
    }
  }
  return plots;
}

const PLOTS: Record<string, Plot[]> = Object.fromEntries(PROJECTS.map((p) => [p.id, generatePlots(p)]));

/** Status changes made during the session (a paid token flips a plot to held). */
export type PlotOverrides = Record<string, PlotStatus>;

export function getProject(id: string): Project | undefined {
  return PROJECTS.find((p) => p.id === id);
}

export function getPlots(projectId: string, overrides: PlotOverrides = {}): Plot[] {
  return (PLOTS[projectId] ?? []).map((p) => (overrides[p.id] ? { ...p, status: overrides[p.id] } : p));
}

export function getPlot(plotId: string, overrides: PlotOverrides = {}): Plot | undefined {
  const projectId = plotId.slice(0, plotId.lastIndexOf("-"));
  return getPlots(projectId, overrides).find((p) => p.id === plotId);
}

/** Resolves either an internal id (`anjarle-7`) or a plot number (`IA-07`). */
export function findPlot(ref: string, overrides: PlotOverrides = {}): Plot | undefined {
  const byId = getPlot(ref, overrides);
  if (byId) return byId;
  const upper = ref.trim().toUpperCase();
  for (const project of PROJECTS) {
    const hit = getPlots(project.id, overrides).find((p) => p.plotNo === upper);
    if (hit) return hit;
  }
  return undefined;
}

export function entryTicket(project: Project): number {
  return Math.min(...project.sizes.map((s) => Math.round((s * rateFor(project, s)) / 1000) * 1000));
}
