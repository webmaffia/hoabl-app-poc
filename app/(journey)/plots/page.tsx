"use client";

// Recommendations: the Land Advisor's top match for this customer as a hero
// card, and every other project listed below it.

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession, type SearchResult } from "@/lib/store";
import { searchProjects } from "@/lib/agent/tools";
import { getPlots, getProject, type Purpose } from "@/lib/inventory";
import { lakh } from "@/lib/journey";
import { Button, Disclosure } from "@/components/journey/ui";
import { Contours, PlotGrid } from "@/components/Contours";
import { ArrowIcon, PinIcon, SparkleIcon } from "@/components/icons";

export default function Recommendations() {
  const router = useRouter();
  const { lastSearch, profile, overrides, send } = useSession();
  // If the agent hasn't searched yet (a direct visit), rank from the profile.
  const results: SearchResult[] = lastSearch.length
    ? lastSearch
    : searchProjects(
        { budget_max: profile.budget_max, purpose: profile.purpose as Purpose | null, region: profile.region, horizon_years: profile.horizon_years },
        { overrides },
      ).projects;
  // The featured project leads (search_projects already puts it first).
  const [top, ...others] = results;
  const open = (id: string) => router.push(`/plots/${id}`);
  const first = profile.name?.split(" ")[0];

  return (
    <div className="pb-4">
      <div className="px-4 pt-5">
        <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight">Choose where to explore</h1>
        <p className="mt-1.5 text-[14px] leading-snug text-ink-soft">
          All HoABL projects. Your Land Advisor has matched one to {first ? `your profile, ${first}` : "your profile"}.
        </p>
      </div>

      {top && <TopPick p={top} onOpen={() => open(top.id)} overrides={overrides} />}

      {others.length > 0 && (
        <section className="mt-6 px-4">
          <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Other projects</h2>
          <div className="flex flex-col gap-2.5">
            {others.map((p) => (
              <ProjectRow key={p.id} p={p} onOpen={() => open(p.id)} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-4 px-4">
        <button onClick={() => void send("Can you compare these for me?")} className="w-full rounded-xl border border-dashed border-verd/50 py-3 text-[13.5px] font-semibold text-verd">
          Ask the Land Advisor to compare
        </button>
      </div>

      <Disclosure>
        Profile fit ranks projects against what you&rsquo;ve told the Land Advisor. Appreciation figures are projections, not guarantees. Land is
        a long-term, illiquid asset. Illustrative projects are for comparison only.
      </Disclosure>
    </div>
  );
}

function TopPick({ p, onOpen, overrides }: { p: SearchResult; onOpen: () => void; overrides: Record<string, "available" | "held" | "sold"> }) {
  const project = getProject(p.id);
  const plots = getPlots(p.id, overrides);
  const taken = plots.filter((x) => x.status !== "available").length;
  return (
    <article className="mx-4 mt-5 overflow-hidden rounded-3xl border-2 border-gold/80 bg-card shadow-[0_12px_40px_-12px_rgba(216,169,73,0.35)]">
      <div className="relative h-52 bg-site">
        <Thumb id={p.id} image={project?.image} sizes="428px" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/10" />
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-[12px] font-bold text-site">
          <SparkleIcon className="h-3.5 w-3.5" />
          Top recommendation for you
        </span>
        {p.illustrative && <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-1 text-[10.5px] font-semibold text-white backdrop-blur">Illustrative</span>}
        <div className="absolute inset-x-4 bottom-3 text-white">
          <h2 className="font-display text-[26px] font-semibold leading-tight tracking-tight [text-shadow:0_2px_10px_rgb(0_0_0/0.5)]">{p.name}</h2>
          <p className="mt-0.5 flex items-center gap-1 text-[13px] text-white/85">
            <PinIcon className="h-3.5 w-3.5" />
            {p.location}
          </p>
        </div>
      </div>
      <div className="px-4 pb-4 pt-3.5">
        <p className="text-[14px] leading-snug text-ink/90">{project?.hook}</p>
        <div className="mt-3 flex items-center justify-between text-[13px]">
          <span className="font-semibold">{p.fit_score}% profile fit</span>
          <span className="font-semibold text-[#ff8f7a]">
            {taken}/{plots.length} plots booked
          </span>
        </div>
        <div className="mt-3.5 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">From</div>
            <div className="font-display text-[24px] font-semibold text-gold">{lakh(p.cheapest_in_budget ?? p.entry_ticket)}</div>
          </div>
          <Button onClick={onOpen} className="px-5">
            Explore
            <ArrowIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}

function ProjectRow({ p, onOpen }: { p: SearchResult; onOpen: () => void }) {
  const project = getProject(p.id);
  return (
    <button onClick={onOpen} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-2.5 text-left active:bg-verd-soft">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-site">
        <Thumb id={p.id} image={project?.image} sizes="56px" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold">{p.name}</span>
          {p.illustrative && <span className="shrink-0 rounded bg-line px-1 py-px text-[9.5px] font-semibold uppercase tracking-wide text-ink-soft">Illustrative</span>}
        </div>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-ink-soft">
          <PinIcon className="h-3 w-3 shrink-0" />
          <span className="truncate">{p.location}</span>
        </p>
      </div>
    </button>
  );
}

/** Real imagery where we have it; a generated site plan otherwise. */
function Thumb({ id, image, sizes, priority = false }: { id: string; image?: string; sizes: string; priority?: boolean }) {
  if (image) return <Image src={image} alt="" fill sizes={sizes} priority={priority} className="object-cover" />;
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-[#3a1c6b] to-[#0a0810] text-white">
      <Contours className="absolute inset-0 h-full w-full" opacity={0.3} />
      <PlotGrid className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-80 ${id ? "h-1/2" : ""}`} />
    </div>
  );
}
