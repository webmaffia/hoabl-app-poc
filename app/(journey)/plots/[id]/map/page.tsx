"use client";

// Plot map: every plot in the layout, coloured by status. Sold plots stay
// visible, because scarcity is part of the pitch. Tap a plot for its details.

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/store";
import { getPlots, getProject, type Plot } from "@/lib/inventory";
import { lakh, sqft } from "@/lib/journey";
import { Badge, Button, Card, ScreenTitle } from "@/components/journey/ui";
import { avatar } from "@/lib/avatar/controller";
import { plotLine } from "@/lib/avatar/screen-lines";

export default function PlotMap() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { overrides, selectedPlot, selectPlot, send, profile, booking } = useSession();
  const project = getProject(id);
  const plots = useMemo(() => (project ? getPlots(project.id, overrides) : []), [project, overrides]);
  const prices = plots.map((p) => p.price);
  const [size, setSize] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);

  if (!project) return <p className="p-6 text-ink-soft">Project not found.</p>;

  const minP = Math.floor(Math.min(...prices) / 100000) * 100000;
  const maxP = Math.ceil(Math.max(...prices) / 100000) * 100000;
  const cap = maxPrice ?? maxP;
  const matches = (p: Plot) => (size == null || p.sizeSqft === size) && p.price <= cap;
  const available = plots.filter((p) => p.status === "available");
  const shown = available.filter(matches).length;
  const rows = Math.ceil(plots.length / project.cols);
  const selected = plots.find((p) => p.id === selectedPlot) ?? null;
  const entranceSide = project.entranceCol === 0 && project.entranceRow !== 0 ? "left" : "top";

  return (
    <div>
      <ScreenTitle
        eyebrow={project.name}
        title="Plot map"
        sub={
          <>
            <b className="font-semibold text-ink">{available.length}</b> of {plots.length} available
            {profile.budget_max ? ` · ${available.filter((p) => p.price <= profile.budget_max!).length} within your budget` : ""}
          </>
        }
      />

      {/* filters */}
      <div className="mt-3 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
        {[null, ...project.sizes].map((s) => (
          <button
            key={s ?? "all"}
            onClick={() => setSize(s)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${
              size === s ? "border-verd bg-verd text-white" : "border-line bg-card text-ink"
            }`}
          >
            {s == null ? "All sizes" : sqft(s)}
          </button>
        ))}
      </div>
      <div className="mt-3 px-4">
        <div className="flex items-baseline justify-between text-[12px] text-ink-soft">
          <span>Up to {lakh(cap, 1)}</span>
          <span>{shown} match</span>
        </div>
        <input
          type="range"
          min={minP}
          max={maxP}
          step={100000}
          value={cap}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          className="mt-1 w-full accent-[var(--verd)]"
          aria-label="Maximum price"
        />
      </div>

      {/* the site */}
      <div className="mx-4 mt-3 rounded-2xl border border-line bg-[repeating-linear-gradient(0deg,transparent,transparent_23px,var(--line)_24px)] p-3">
        {entranceSide === "top" && <Entrance col={project.entranceCol} cols={project.cols} />}
        <div className="flex flex-col gap-2">
          {Array.from({ length: rows }, (_, row) => (
            <div key={row}>
              {row === project.parkRow && (
                <div className="mb-2 flex h-7 items-center justify-center rounded-lg bg-verd-soft text-[11px] font-semibold uppercase tracking-wider text-verd">
                  Central green
                </div>
              )}
              <div className="flex items-stretch gap-1.5">
                {entranceSide === "left" && (
                  <div className="flex w-5 shrink-0 items-center justify-center">
                    {row === project.entranceRow && <span className="text-[16px] text-gold" title="Entrance">➜</span>}
                  </div>
                )}
                <div className="grid flex-1 gap-1.5" style={{ gridTemplateColumns: `repeat(${project.cols}, minmax(0, 1fr))` }}>
                  {plots
                    .filter((p) => p.gridRow === row)
                    .map((p) => (
                      <PlotCell key={p.id} plot={p} dim={!matches(p)} selected={p.id === selectedPlot} mine={booking?.plot_id === p.id} onClick={() => {
                          selectPlot(p.id);
                          // The Land Advisor reads out what the customer just tapped.
                          const line = plotLine(p.id, overrides);
                          if (line) {
                            avatar.interrupt();
                            avatar.speak(line);
                          }
                        }}
                      />
                    ))}
                </div>
              </div>
              {row === project.entranceRow && (
                <div className="mt-1.5 h-2 rounded bg-ink/10" title="12 m main road" />
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-soft">
          <Legend className="border-verd bg-card" label="Available" />
          <Legend className="border-gold bg-gold-soft" label="Held" />
          <Legend className="border-line bg-[repeating-linear-gradient(45deg,var(--line),var(--line)_3px,transparent_3px,transparent_6px)]" label="Sold" />
          <span className="flex items-center gap-1">
            <span className="text-gold">➜</span> Entrance
          </span>
        </div>
      </div>

      {selected && (
        <Card className="mx-4 mt-3 px-4 py-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-display text-[22px] font-semibold tracking-tight">{selected.plotNo}</div>
              <div className="mt-0.5 flex flex-wrap gap-1.5">
                <Badge tone={selected.status === "available" ? "verd" : selected.status === "held" ? "gold" : "muted"}>
                  {booking?.plot_id === selected.id ? "Held for you" : selected.status[0].toUpperCase() + selected.status.slice(1)}
                </Badge>
                {selected.isCorner && <Badge tone="gold">Corner</Badge>}
                {selected.isParkFacing && <Badge tone="verd">Park-facing</Badge>}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-[20px] font-semibold">{lakh(selected.price)}</div>
              <div className="text-[11.5px] text-ink-soft">all-inclusive</div>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
            <Row k="Size" v={sqft(selected.sizeSqft)} />
            <Row k="Facing" v={selected.facing} />
            <Row k="Road width" v={`${selected.roadWidthM} m`} />
            <Row k="From entrance" v={`${selected.metresFromEntrance} m`} />
          </dl>
          <div className="mt-3.5 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => router.push("/money/calculator")}>
              Work out EMI
            </Button>
            <Button
              disabled={selected.status !== "available"}
              onClick={() => void send(`I want to book plot ${selected.plotNo}.`)}
            >
              Book this plot
            </Button>
          </div>
          <button onClick={() => void send(`Tell me about plot ${selected.plotNo}.`)} className="mt-2 w-full py-1.5 text-[13px] font-semibold text-verd">
            Ask the advisor about {selected.plotNo}
          </button>
        </Card>
      )}
      {!selected && <p className="mt-3 px-4 text-center text-[12.5px] text-ink-soft">Tap a plot to see its details.</p>}
    </div>
  );
}

function PlotCell({ plot, dim, selected, mine, onClick }: { plot: Plot; dim: boolean; selected: boolean; mine: boolean; onClick: () => void }) {
  const tone =
    plot.status === "sold"
      ? "border-line text-ink-soft bg-[repeating-linear-gradient(45deg,var(--line),var(--line)_3px,transparent_3px,transparent_7px)]"
      : plot.status === "held"
        ? "border-gold bg-gold-soft text-ink"
        : "border-verd/60 bg-card text-ink";
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[58px] flex-col justify-between rounded-lg border px-1.5 py-1 text-left transition ${tone} ${dim ? "opacity-35" : ""} ${
        selected ? "ring-2 ring-gold ring-offset-1 ring-offset-paper" : ""
      }`}
      aria-label={`${plot.plotNo}, ${plot.status}, ${plot.sizeSqft} square feet, ${lakh(plot.price)}`}
    >
      <span className="flex items-center justify-between text-[11px] font-bold">
        {plot.plotNo}
        {mine && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
      </span>
      <span className="text-[10px] leading-tight">
        {plot.sizeSqft.toLocaleString("en-IN")}
        <br />
        {plot.status === "sold" ? "Sold" : lakh(plot.price, 1)}
      </span>
    </button>
  );
}

function Entrance({ col, cols }: { col: number; cols: number }) {
  return (
    <div className="mb-1.5 grid gap-1.5 pl-0" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: cols }, (_, i) => (
        <div key={i} className="flex h-5 items-center justify-center text-[11px] font-semibold text-gold">
          {i === col ? "⬇ Entrance" : ""}
        </div>
      ))}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-3 w-3 rounded border ${className}`} />
      {label}
    </span>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-line/70 pb-1.5">
      <dt className="text-ink-soft">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}
