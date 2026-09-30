"use client";

// Console: one live session, not a cohort. The funnel shows where this
// customer is, and the rest shows how the agent got them there: profile,
// transcript, every tool call, guardrail hits and cost-relevant timings.
//
// Open it in another tab of the same browser. The journey tab broadcasts
// every change, and the console also reads the last snapshot on load.

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/journey/ui";
import { INTENTS, type Intent } from "@/lib/agent/prompt";
import { LIVE_CHANNEL, LIVE_KEY, type LiveSnapshot } from "@/lib/store";
import { VIEW_LABEL, inr, lakh, type View } from "@/lib/journey";

const STAGE_LABEL: Record<Intent, string> = {
  visitor: "Visitor",
  interested: "Interested",
  qualified: "Qualified",
  shortlisted: "Shortlisted",
  high_intent: "High intent",
  booking_initiated: "Booking initiated",
  token_paid: "Token paid",
  kyc_completed: "KYC completed",
  loan_processing: "Loan processing",
  booking_completed: "Booking completed",
};

function readSnapshot(): LiveSnapshot | null {
  try {
    const raw = localStorage.getItem(LIVE_KEY);
    return raw ? (JSON.parse(raw) as LiveSnapshot) : null;
  } catch {
    return null;
  }
}

export default function Console() {
  const [snap, setSnap] = useState<LiveSnapshot | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    setSnap(readSnapshot()); // eslint-disable-line react-hooks/set-state-in-effect
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(LIVE_CHANNEL);
      channel.onmessage = (e) => setSnap(e.data as LiveSnapshot);
    } catch {}
    const onStorage = (e: StorageEvent) => e.key === LIVE_KEY && setSnap(readSnapshot());
    window.addEventListener("storage", onStorage);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      channel?.close();
      window.removeEventListener("storage", onStorage);
      clearInterval(tick);
    };
  }, []);

  const stats = useMemo(() => {
    if (!snap) return null;
    const firstSay = snap.metrics.map((m) => m.firstSayMs).filter((x): x is number => x != null).sort((a, b) => a - b);
    const done = snap.metrics.map((m) => m.doneMs).filter((x): x is number => x != null);
    return {
      turns: snap.turns.filter((t) => t.kind === "user").length,
      tools: snap.trace.length,
      medianFirstSay: firstSay.length ? firstSay[Math.floor(firstSay.length / 2)] : null,
      avgTurn: done.length ? done.reduce((a, b) => a + b, 0) / done.length : null,
    };
  }, [snap]);

  if (!snap || !stats) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="font-display text-[26px] font-semibold">No live session yet</h1>
        <p className="max-w-md text-[14px] text-ink-soft">
          Start a conversation in another tab of this browser and it will appear here as it happens.
        </p>
        <Button href="/">Open the app</Button>
      </main>
    );
  }

  const stageIdx = INTENTS.indexOf(snap.intent);
  const elapsed = snap.startedAt && now ? Math.max(0, Math.round((now - snap.startedAt) / 1000)) : 0;
  const ago = now ? Math.max(0, Math.round((now - snap.updatedAt) / 1000)) : 0;
  const liveMin = (snap.avatar?.liveSeconds ?? 0) / 60;

  return (
    <main className="min-h-full p-5 text-ink">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${ago < 10 ? "animate-pulse bg-emerald-500" : "bg-slate-400"}`} />
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{ago < 10 ? "Live session" : `Last update ${ago}s ago`}</span>
          </div>
          <h1 className="mt-1 font-display text-[28px] font-semibold tracking-tight">
            {snap.profile.name ?? "Customer"}
            {snap.profile.city && <span className="text-ink-soft"> · {snap.profile.city}</span>}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Kpi label="Session" value={fmtDuration(elapsed)} />
          <Kpi label="Customer turns" value={String(stats.turns)} />
          <Kpi label="Tool calls" value={String(stats.tools)} />
          <Kpi label="First speech (median)" value={stats.medianFirstSay != null ? `${(stats.medianFirstSay / 1000).toFixed(1)}s` : "—"} />
          <Kpi label="Guardrail hits" value={String(snap.guardHits.length)} tone={snap.guardHits.length ? "gold" : undefined} />
          <Kpi label="Avatar video" value={`${liveMin.toFixed(1)} min`} hint={snap.avatar ? `${snap.avatar.mode} · ${snap.avatar.status}` : undefined} />
        </div>
      </header>

      {/* funnel */}
      <section className="mt-5 rounded-2xl border border-line bg-card p-4">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-soft">Funnel</h2>
        <ol className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-5 lg:grid-cols-10">
          {INTENTS.map((stage, i) => {
            const state = i < stageIdx ? "done" : i === stageIdx ? "now" : "todo";
            return (
              <li
                key={stage}
                className={`relative rounded-xl px-2.5 py-2.5 text-[12px] font-semibold transition-colors duration-700 ${
                  state === "now" ? "bg-gold text-site shadow-lg" : state === "done" ? "bg-verd text-white" : "bg-line/60 text-ink-soft"
                }`}
              >
                <span className="block text-[10px] font-medium opacity-70">{String(i + 1).padStart(2, "0")}</span>
                {STAGE_LABEL[stage]}
                {state === "now" && <span className="pulse-ring absolute inset-0 rounded-xl border-2 border-[#d6a24a]" />}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-5">
          <Panel title="Profile">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
              {(
                [
                  ["Purpose", snap.profile.purpose?.replace("_", " ")],
                  ["Budget", snap.profile.budget_max ? lakh(snap.profile.budget_max, 0) : null],
                  ["Horizon", snap.profile.horizon_years ? `${snap.profile.horizon_years} years` : null],
                  ["Region", snap.profile.region],
                  ["Funding", snap.profile.funding],
                  ["On screen", snap.screen ? VIEW_LABEL[snap.screen.view as View] : "Land Advisor"],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 border-b border-line/70 pb-1.5">
                  <dt className="text-ink-soft">{k}</dt>
                  <dd className="text-right font-semibold first-letter:uppercase">{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Booking">
            {snap.booking ? (
              <div className="space-y-1 text-[13px]">
                <Line k="Plot" v={`${snap.booking.plot_no} · ${snap.booking.project_name}`} />
                <Line k="Price" v={lakh(snap.booking.price)} />
                <Line k="Token" v={`${inr(snap.booking.token_amount)} · ${snap.booking.status === "paid" ? `paid by ${snap.booking.method}` : "awaiting payment"}`} />
                <Line k="Booking ID" v={snap.booking.booking_id} />
                <Line k="KYC" v={snap.kyc ? `Verified · PAN ${snap.kyc.panMasked}` : "Pending"} />
                <Line k="Loan" v={snap.loan ? `${lakh(snap.loan.eligibleAmount)} at ${snap.loan.rate}% · in-principle${snap.loan.sanction ? ` · ${snap.loan.sanction.ref}` : ""}` : "Not started"} />
              </div>
            ) : (
              <p className="text-[13px] text-ink-soft">No booking yet.</p>
            )}
          </Panel>

          <Panel title={`Guardrails · ${snap.guardHits.length} ${snap.guardHits.length === 1 ? "hit" : "hits"}`}>
            {snap.guardHits.length === 0 ? (
              <p className="text-[13px] text-ink-soft">
                No hits yet. Every figure spoken so far traced back to a tool result, and nothing promised returns.
              </p>
            ) : (
              <ul className="space-y-2">
                {snap.guardHits.map((g, i) => (
                  <li key={i} className="rounded-xl border border-gold/40 bg-gold-soft px-3 py-2 text-[12.5px]">
                    <div className="font-semibold">
                      {new Date(g.at).toLocaleTimeString("en-IN")} · {g.action}
                    </div>
                    {g.violations.map((v, j) => (
                      <div key={j} className="mt-0.5 text-ink-soft">
                        <span className="font-semibold text-ink">{v.check === "provenance" ? "Unverified figure" : "Return language"}</span>: {v.detail}
                        {v.check === "return_language" && <span className="block italic">&ldquo;{v.text}&rdquo;</span>}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Tool trace">
            <div className="max-h-[340px] overflow-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="sticky top-0 bg-card text-[10.5px] uppercase tracking-wider text-ink-soft">
                  <tr>
                    <th className="py-1.5 pr-2 font-semibold">Turn</th>
                    <th className="py-1.5 pr-2 font-semibold">Tool</th>
                    <th className="py-1.5 pr-2 font-semibold">Arguments</th>
                    <th className="py-1.5 font-semibold">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.trace.map((t) => (
                    <tr key={t.id} className="border-t border-line/70 align-top">
                      <td className="py-1.5 pr-2 text-ink-soft">{t.turn}</td>
                      <td className="py-1.5 pr-2 font-mono font-semibold">{t.name}</td>
                      <td className="max-w-[260px] py-1.5 pr-2 font-mono text-[11px] text-ink-soft">{compactArgs(t.args)}</td>
                      <td className="py-1.5">{t.pill ?? <span className="animate-pulse text-ink-soft">running…</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {snap.trace.length === 0 && <p className="py-2 text-[13px] text-ink-soft">No tool calls yet.</p>}
            </div>
          </Panel>

          <Panel title="Transcript">
            <div className="max-h-[440px] space-y-2 overflow-auto pr-1">
              {snap.turns.map((t, i) => {
                if (t.kind === "user")
                  return (
                    <p key={i} className="text-[13px]">
                      <b className="text-verd">Customer:</b> {t.text}
                      {t.interrupted && <span className="text-ink-soft"> (interrupted)</span>}
                    </p>
                  );
                if (t.kind === "agent")
                  return (
                    <p key={i} className="text-[13px]">
                      <b>Land Advisor:</b> {t.text}
                    </p>
                  );
                if (t.kind === "event")
                  return (
                    <p key={i} className="text-[12px] font-semibold text-verd">
                      ● {t.label}
                    </p>
                  );
                if (t.kind === "show")
                  return (
                    <p key={i} className="text-[11.5px] text-gold">
                      ▣ screen → {VIEW_LABEL[t.view as View] ?? t.view}
                    </p>
                  );
                if (t.kind === "handoff")
                  return (
                    <p key={i} className="text-[12px] font-semibold text-verd">
                      ☎ handoff → {t.items.filter((it) => it.done).map((it) => it.label).join(", ") || "no context yet"}
                    </p>
                  );
                return null;
              })}
              {snap.busy && <p className="animate-pulse text-[12px] text-ink-soft">Land Advisor is working…</p>}
            </div>
          </Panel>
        </div>
      </div>

      <p className="mt-5 text-[11.5px] text-ink-soft">
        One session, mirrored from the customer&rsquo;s tab. Real: the agent&rsquo;s reasoning, tool calls, inventory, guardrails and the
        avatar stream. Simulated: OTP, payment, KYC, loan and persistence.
      </p>
    </main>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "gold" }) {
  return (
    <div className={`min-w-[108px] rounded-xl border px-3 py-2 ${tone === "gold" ? "border-gold bg-gold-soft" : "border-line bg-card"}`}>
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-ink-soft">{label}</div>
      <div className="font-display text-[20px] font-semibold leading-tight">{value}</div>
      {hint && <div className="text-[10.5px] text-ink-soft">{hint}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{title}</h2>
      {children}
    </section>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line/70 pb-1">
      <span className="text-ink-soft">{k}</span>
      <span className="text-right font-semibold">{v}</span>
    </div>
  );
}

function compactArgs(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  return Object.entries(args as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" ");
}

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
