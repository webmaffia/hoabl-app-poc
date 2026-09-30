"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/store";
import { avatar } from "@/lib/avatar/controller";
import { projectReturnLine } from "@/lib/avatar/screen-lines";
import { entryTicket, getPlots, getProject, PROJECTS } from "@/lib/inventory";
import { lookupKnowledge } from "@/lib/knowledge";
import { lakh } from "@/lib/journey";
import { SITE_MAPS, flushScroll } from "@/lib/maps";
import { Badge, Button, Card, Disclosure, Section, Stat } from "@/components/journey/ui";
import { Contours, PlotGrid } from "@/components/Contours";
import { FilmStrip } from "@/components/journey/FilmStrip";
import { Lightbox, type LightboxImage } from "@/components/journey/Lightbox";
import { InvestmentForecast } from "@/components/journey/InvestmentForecast";
import { DownloadIcon, PinIcon } from "@/components/icons";

const AMENITIES: [string, string][] = [
  ["clubhouse01", "Clifftop clubhouse"],
  ["entrance-gate", "Grand entrance"],
  ["sunset-point", "Sunset point"],
  ["open-air-cafe", "Open-air café"],
  ["amphitheatre-guest-rooms-zip-line", "Amphitheatre and zip line"],
  ["stargazing-and-bornfire", "Stargazing and bonfire"],
  ["hammock", "Hammock garden"],
  ["swinging-pavilion", "Swinging pavilion"],
  ["skating-rink", "Skating rink"],
  ["open-gym-and-bird-bath", "Open gym"],
  ["pet-park", "Pet park"],
  ["flower-nursary", "Flower nursery"],
];

const AMENITY_IMAGES: LightboxImage[] = AMENITIES.map(([file, label]) => ({ src: `/projects/anjarle/amenities/${file}.jpg`, label }));
const MASTER_PLAN: LightboxImage = { src: "/projects/anjarle/renders/top-plan.jpg", label: "Master plan" };

export default function ProjectDetail() {
  const [viewer, setViewer] = useState<{ images: LightboxImage[]; start: number } | null>(null);
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { overrides, lastSearch, requestHuman, markIntroSeen, introSeen, profile } = useSession();
  const project = getProject(id);
  // The advisor asked for the map: scroll to it once the page has settled at the top.
  useEffect(() => {
    const t = setTimeout(flushScroll, 450);
    return () => clearTimeout(t);
  }, [id]);
  if (!project) return <p className="p-6 text-ink-soft">Project not found.</p>;

  const films = project.videos ?? [];
  const plots = getPlots(project.id, overrides);
  const available = plots.filter((p) => p.status === "available").length;
  const fit = lastSearch.find((s) => s.id === project.id);
  const ladder = [...project.connectivity].sort((a, b) => a.km - b.km);
  const maxKm = Math.max(...ladder.map((c) => c.km));
  const title = lookupKnowledge("title_approvals", project.id);
  const timeline = lookupKnowledge("timeline", project.id);
  const isAnjarle = project.id === "anjarle";

  return (
    <div>
      {/* Hero: the films inline, narrated by the Land Advisor, else the photo or a site plan. */}
      {films.length > 0 ? (
        <FilmStrip
          key={project.id}
          projectName={project.name}
          videos={films}
          poster={project.image ?? films[0].poster}
          startDone={introSeen.includes(project.id)}
          returnLine={projectReturnLine(project.name, available, plots.length, entryTicket(project), profile.name?.split(" ")[0] ?? null)}
          onFinished={() => markIntroSeen(project.id)}
        />
      ) : (
        <div className="relative aspect-video w-full overflow-hidden bg-site text-site-ink">
          {project.image ? (
            <Image src={project.image} alt={project.name} fill sizes="428px" className="object-cover" priority />
          ) : (
            <>
              <Contours className="absolute inset-0 h-full w-full" opacity={0.25} />
              <PlotGrid className="absolute left-1/2 top-1/2 h-28 -translate-x-1/2 -translate-y-1/2" />
            </>
          )}
        </div>
      )}

      <div className="px-4 pb-3 pt-4">
        {project.illustrative && <Badge tone="gold">Illustrative project</Badge>}
        <div className="flex items-start justify-between gap-3">
          <h1 className="mt-1 font-display text-[26px] font-semibold leading-tight tracking-tight">{project.name}</h1>
          {isAnjarle && (
            <a
              href="/Isle-of-Anjarle.pdf"
              download
              className="mt-1 flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-[12px] font-semibold text-ink-soft active:scale-[0.98]"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              Brochure
            </a>
          )}
        </div>
        <p className="mt-0.5 flex items-center gap-1 text-[13px] text-ink-soft">
          <PinIcon className="h-3.5 w-3.5" />
          {project.location}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2 border-b border-line bg-card px-4 py-3">
        <Stat label="From" value={lakh(entryTicket(project), 1)} />
        <Stat label="₹/sq ft" value={project.ratePerSqft.toLocaleString("en-IN")} />
        <Stat label="Available" value={`${available}/${plots.length}`} />
        <Stat label="Hold" value={project.hold.replace(" years", "y")} />
      </div>

      <Section title="AI investment forecast">
        <InvestmentForecast price={entryTicket(project)} />
      </Section>

      {fit && (
        <Section title="Why it fits you">
          <Card className="px-3.5 py-3">
            <div className="flex flex-wrap gap-1.5">
              {fit.fit_reason.split("; ").map((r) => (
                <Badge key={r} tone={/^no |outside|longer/.test(r) ? "muted" : "verd"}>
                  {r}
                </Badge>
              ))}
            </div>
            <p className="mt-2 text-[13.5px] leading-snug">{project.hook}</p>
          </Card>
        </Section>
      )}

      <Section title="Getting there">
        <Card className="px-3.5 py-3">
          <ol className="relative">
            <span className="absolute bottom-2 left-[5px] top-2 w-px bg-line" />
            {ladder.map((c) => (
              <li key={c.label} className="relative flex items-start gap-3 py-1.5">
                <span className="relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-verd bg-card" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13.5px] font-medium">{c.label}</span>
                    <span className="shrink-0 text-[13.5px] font-semibold">{c.km} km</span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-line">
                    <div className="h-1 rounded-full bg-verd/70" style={{ width: `${Math.max(4, (c.km / maxKm) * 100)}%` }} />
                  </div>
                  {c.note && <div className="mt-0.5 text-[11.5px] text-ink-soft">{c.note}</div>}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </Section>

      {SITE_MAPS[project.id] && (
        <div id="location" className="scroll-mt-2">
          <Section title="Site location">
            <Card className="overflow-hidden">
              <iframe
                title={`${project.name} site map`}
                src={SITE_MAPS[project.id].embed}
                loading="lazy"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="block h-64 w-full border-0"
              />
              <a
                href={SITE_MAPS[project.id].link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3.5 py-2.5 text-[13.5px] font-semibold text-verd"
              >
                <PinIcon className="h-4 w-4" />
                <span className="flex-1">Open in Google Maps</span>
                <span aria-hidden>↗</span>
              </a>
            </Card>
          </Section>
        </div>
      )}

      <Section title="What you get">
        <ul className="grid gap-2">
          {project.features.map((f) => (
            <li key={f} className="flex gap-2.5 rounded-xl border border-line bg-card px-3 py-2.5 text-[13.5px] leading-snug">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              {f}
            </li>
          ))}
        </ul>
      </Section>

      {isAnjarle && (
        <>
          <Section title="Amenities">
            <div className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {AMENITIES.map(([file, label]) => (
                <button
                  key={file}
                  onClick={() => setViewer({ images: AMENITY_IMAGES, start: AMENITIES.findIndex(([f]) => f === file) })}
                  className="relative h-36 w-44 shrink-0 snap-start overflow-hidden rounded-xl bg-site text-left"
                  aria-label={`View ${label}`}
                >
                  <Image src={`/projects/anjarle/amenities/${file}.jpg`} alt={label} fill sizes="176px" className="object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-6 text-[12px] font-medium text-white">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </Section>
          <Section title="Master plan">
            <Card className="overflow-hidden">
              <button onClick={() => setViewer({ images: [MASTER_PLAN], start: 0 })} className="relative block aspect-[4/3] w-full" aria-label="View the master plan">
                <Image src={MASTER_PLAN.src} alt="Isle of Anjarle master plan" fill sizes="400px" className="object-cover" />
              </button>
              <p className="px-3.5 py-2.5 text-[12px] text-ink-soft">Master plan by Sanjay Puri Architects. Render, for illustration.</p>
            </Card>
          </Section>
        </>
      )}

      <Section title="Paperwork and timeline">
        <Card className="divide-y divide-line">
          <div className="px-3.5 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Registration</div>
            <div className="mt-0.5 text-[13.5px] font-semibold">{project.rera_no}</div>
          </div>
          {[...title, ...timeline].map((c) => (
            <p key={c.text} className="px-3.5 py-2.5 text-[13px] leading-snug">
              {c.text}
            </p>
          ))}
        </Card>
      </Section>

      {PROJECTS.length > 1 && (
        <Section title="Other projects">
          <div className="flex flex-col gap-2.5">
            {PROJECTS.filter((p) => p.id !== project.id).map((p) => (
              <button
                key={p.id}
                onClick={() => router.push(`/plots/${p.id}`)}
                className="flex items-center gap-3 rounded-2xl border border-line bg-card p-2.5 text-left active:bg-verd-soft"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-site">
                  {p.image ? (
                    <Image src={p.image} alt={p.name} fill sizes="56px" className="object-cover" />
                  ) : (
                    <>
                      <Contours className="absolute inset-0 h-full w-full" opacity={0.25} />
                      <PlotGrid className="absolute left-1/2 top-1/2 h-10 -translate-x-1/2 -translate-y-1/2" />
                    </>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-semibold">{p.name}</span>
                    {p.illustrative && <span className="shrink-0 rounded bg-line px-1 py-px text-[9.5px] font-semibold uppercase tracking-wide text-ink-soft">Illustrative</span>}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-ink-soft">
                    <PinIcon className="h-3 w-3 shrink-0" />
                    {p.location}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </Section>
      )}

      <Disclosure>
        Risk disclosure: land prices can fall as well as rise, and past appreciation doesn&rsquo;t predict future returns. Projections quoted
        here come from third-party research and aren&rsquo;t guaranteed. Land is illiquid; plan to hold for {project.hold}. Check the
        registration on the regulator&rsquo;s website before paying.
      </Disclosure>

      {/* Room for the avatar tile above the pinned buttons at the end of the page. */}
      <div className="h-28" />

      {/* Pinned to the bottom of the screen while scrolling; the avatar tile floats just above it. */}
      <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-2 bg-paper/85 px-4 py-3 backdrop-blur">
        <Button onClick={() => router.push(`/plots/${project.id}/map`)}>See the plot map</Button>
        <Button variant="secondary" onClick={() => {
            avatar.bargeIn();
            void requestHuman();
          }}>
          Ask the advisor
        </Button>
      </div>

      {viewer && <Lightbox images={viewer.images} start={viewer.start} onClose={() => setViewer(null)} />}
    </div>
  );
}
