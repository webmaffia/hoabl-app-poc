"use client";

// Shown right after the welcome questions while the Land Advisor searches:
// at least 2.5s, and it lifts when the recommendations screen opens (or at
// 7s, so it never outstays a slow turn).

import { useEffect, useState } from "react";
import { useSession } from "@/lib/store";
import { Logo } from "@/components/Logo";

const MIN_MS = 2500;
const MAX_MS = 7000;
const STEPS = ["Matching your budget", "Checking live availability", "Comparing locations"];

export function FindingOverlay() {
  const { findingSince, screen, busy, endFinding } = useSession();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (findingSince == null) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 900);
    return () => clearInterval(t);
  }, [findingSince]);

  useEffect(() => {
    if (findingSince == null) return;
    const ready = screen?.view === "recommendations" || !busy;
    const elapsed = Date.now() - findingSince;
    const wait = ready ? Math.max(0, MIN_MS - elapsed) : Math.max(0, MAX_MS - elapsed);
    const t = setTimeout(endFinding, wait);
    return () => clearTimeout(t);
  }, [findingSince, screen, busy, endFinding]);

  if (findingSince == null) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center px-8 text-center" style={{ background: "var(--brand-gradient), var(--paper)" }} role="status" aria-live="polite">
      <Logo className="absolute left-6 top-6 h-10" />
      <div className="relative h-28 w-28">
        <span className="absolute inset-0 rounded-full border-2 border-white/10" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-gold [animation-duration:1.4s]" />
        <span className="absolute inset-3 animate-spin rounded-full border-2 border-transparent border-b-[#8b63ff] [animation-direction:reverse] [animation-duration:2.2s]" />
        <span className="absolute inset-[42%] rounded-full bg-gold/90 shadow-[0_0_24px_6px_rgba(216,169,73,0.45)]" />
      </div>
      <h2 className="mt-8 font-display text-[24px] font-semibold leading-tight tracking-tight text-white">We&rsquo;re finding the best options for you…</h2>
      <ul className="mt-5 space-y-2 text-[14px]">
        {STEPS.map((s, i) => (
          <li key={s} className={`flex items-center justify-center gap-2 transition-colors duration-500 ${i <= step ? "text-white" : "text-white/35"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${i < step ? "bg-gold" : i === step ? "animate-pulse bg-gold" : "bg-white/25"}`} />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
