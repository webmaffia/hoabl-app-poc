"use client";

// Shown when a returning customer lands on the site again. The session lives in
// localStorage, so this reads their stored journey back to them as a checklist
// and offers to pick up on the screen they last had open.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/store";
import { routeFor } from "@/lib/journey";
import { findPlot, getProject } from "@/lib/inventory";
import { Logo } from "@/components/Logo";

interface Step {
  label: string;
  done: boolean;
  note?: string;
}

interface Summary {
  first: string;
  href: string;
  steps: Step[];
}

function summarise(): Summary | null {
  const s = useSession.getState();
  if (!s.profile.name) return null;

  const plot = s.selectedPlot ? findPlot(s.selectedPlot) : undefined;
  const projectId = plot?.projectId ?? s.booking?.project_id ?? (s.screen?.view === "project" || s.screen?.view === "plots" ? s.screen.id : null) ?? s.lastSearch[0]?.id;
  const project = projectId ? getProject(projectId) : undefined;
  const explored = Boolean(project) || s.introSeen.length > 0;
  const viewed = s.lastSearch.length;

  return {
    first: s.profile.name.split(" ")[0],
    href: s.screen ? routeFor(s.screen) : "/agent",
    steps: [
      { label: project ? `Exploring ${project.name}` : "Exploring HoABL projects", done: explored },
      { label: "Projects viewed", done: viewed > 0, note: viewed > 0 ? `${viewed} viewed` : undefined },
      { label: "Plot shortlisted", done: Boolean(s.selectedPlot), note: plot ? `Plot ${plot.plotNo}` : undefined },
      { label: "Token payment", done: s.booking?.status === "paid" },
      { label: "KYC", done: Boolean(s.kyc) },
    ],
  };
}

export function WelcomeBack() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    setSummary(summarise());
  }, []);

  if (!summary) return null;

  return (
    <div
      role="dialog"
      aria-label="Welcome back"
      className="absolute inset-0 z-30 flex flex-col justify-center px-6 py-8"
      style={{ background: "var(--brand-gradient), var(--paper)" }}
    >
      <div className="mb-6 flex justify-center">
        <Logo className="h-14" />
      </div>
      <h2 className="text-center font-display text-[28px] font-semibold leading-tight tracking-tight">Welcome back, {summary.first}!</h2>
      <p className="mx-auto mt-2 max-w-[30ch] text-center text-[14px] leading-relaxed text-white/70">Here&rsquo;s where things stand in your journey:</p>

      <ul className="mt-6 space-y-3.5 rounded-3xl border border-line bg-card px-5 py-5">
        {summary.steps.map((step) => (
          <li key={step.label} className="flex items-center gap-3 text-[15px]">
            <span
              aria-hidden
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                step.done ? "bg-gold text-site" : "border border-line text-transparent"
              }`}
            >
              ✓
            </span>
            <span className={step.done ? "text-white" : "text-white/45"}>{step.label}</span>
            {step.done && step.note && <span className="ml-auto text-[12px] text-white/50">{step.note}</span>}
          </li>
        ))}
      </ul>

      <button
        onClick={() => router.push(summary.href)}
        className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-gold px-5 text-[16px] font-semibold text-site shadow-lg transition active:scale-[0.99]"
      >
        Continue where I left off →
      </button>
      <button
        onClick={() => {
          useSession.getState().reset();
          router.push("/register");
        }}
        className="mt-3 w-full text-center text-[12px] font-medium text-white/65 underline underline-offset-2"
      >
        Start over instead
      </button>
    </div>
  );
}
