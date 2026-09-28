"use client";

// An illustrative, animated growth projection for a project's entry price.
// Clearly marked as the Land Advisor's interpretation, not a verified fact or
// a guarantee — ported from the sales-engine prototype's pocket-detail screen.

import { useEffect, useState } from "react";
import { lakh } from "@/lib/journey";
import { Badge } from "@/components/journey/ui";

const FORECAST_POINTS = [
  { label: "Now", growth: 0 },
  { label: "1 Year", growth: 0.15 },
  { label: "3 Years", growth: 0.41 },
  { label: "5 Years", growth: 0.8 },
];

export function InvestmentForecast({ price }: { price: number }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 50);
    return () => clearTimeout(t);
  }, []);

  const values = FORECAST_POINTS.map((p) => Math.round(price * (1 + p.growth)));
  const max = Math.max(...values);

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">AI investment forecast</span>
        <Badge tone="gold">Interpretation</Badge>
      </div>

      <div className="mt-3 flex h-24 items-end gap-2">
        {FORECAST_POINTS.map((p, i) => (
          <div key={p.label} className="flex h-full flex-1 flex-col items-center justify-end">
            <span className="mb-1 text-[10px] font-semibold text-ink">{lakh(values[i], 1)}</span>
            <div
              style={{ height: grown ? `${Math.max((values[i] / max) * 100, 6)}%` : 0, transitionDelay: `${i * 120}ms` }}
              className={`w-full rounded-t-md transition-[height] duration-700 ease-out ${i === 0 ? "bg-line" : "bg-gradient-to-t from-gold to-gold/60"}`}
            />
          </div>
        ))}
      </div>

      <div className="mt-1.5 flex gap-2">
        {FORECAST_POINTS.map((p) => (
          <div key={p.label} className="flex-1 text-center">
            <p className="text-[10px] text-ink-soft">{p.label}</p>
            {p.growth > 0 && <p className="text-[9px] font-semibold text-verd">+{Math.round(p.growth * 100)}%</p>}
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-snug text-ink-soft">
        The Land Advisor&rsquo;s projection, based on comparable growth patterns in the region &mdash; not a guarantee or financial advice.
      </p>
    </div>
  );
}
