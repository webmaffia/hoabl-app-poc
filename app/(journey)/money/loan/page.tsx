"use client";

// Loan eligibility and a mock in-principle sanction. "In-principle" appears
// wherever a loan figure does.

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/store";
import { findPlot, getPlots } from "@/lib/inventory";
import { BANDS, TENURE_YEARS, eligibility, type BandId } from "@/lib/loan";
import { dateIn, inr, lakh } from "@/lib/journey";
import { Button, Card, Disclosure, Field, SandboxTag, ScreenTitle, Section, inputClass } from "@/components/journey/ui";

const STAGES = ["Sharing your KYC with the partner bank…", "Running a soft credit check…", "Preparing your in-principle letter…"];

export default function Loan() {
  const { booking, selectedPlot, overrides, loan, setLoan, sendEvent, profile } = useSession();
  const plot =
    (booking && findPlot(booking.plot_id, overrides)) ||
    (selectedPlot && findPlot(selectedPlot, overrides)) ||
    getPlots("anjarle", overrides).find((p) => p.status === "available")!;
  const price = booking?.price ?? plot.price;

  const [income, setIncome] = useState("");
  const [obligations, setObligations] = useState("");
  const [employment, setEmployment] = useState<"Salaried" | "Self-employed">("Salaried");
  const [band, setBand] = useState<BandId>("good");
  const [stage, setStage] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const incomeN = Number(income.replace(/\D/g, "")) || 0;
  const obligationsN = Number(obligations.replace(/\D/g, "")) || 0;
  const e = eligibility({ income: incomeN, obligations: obligationsN, band, plotPrice: price });
  const ready = incomeN >= 10000;

  const apply = () => {
    setStage(0);
    STAGES.forEach((_, i) => timers.current.push(setTimeout(() => setStage(i), i * 1000)));
    timers.current.push(
      setTimeout(() => {
        const ref = `IPS-${Date.now().toString(36).toUpperCase().slice(-6)}`;
        const validUntil = Date.now() + 30 * 86400000;
        setLoan({ band: e.band.label, rate: e.band.rate, eligibleAmount: e.eligible, emi: e.emi, tenureYears: TENURE_YEARS, sanction: { ref, amount: e.eligible, validUntil } });
        setStage(null);
        void sendEvent(
          `Loan in-principle · ${ref}`,
          `The customer's in-principle loan check is done: eligible for ${lakh(e.eligible)} (${inr(e.eligible)}) at ${e.band.rate}% over ${TENURE_YEARS} years, EMI ${inr(e.emi)}. In-principle sanction reference ${ref} issued (simulated), valid 30 days, subject to the bank's final approval and property valuation.`,
          "loan_processing",
        );
      }, 3200),
    );
  };

  if (loan?.sanction) {
    return (
      <div>
        <ScreenTitle eyebrow="Home-loan partner" title="In-principle sanction" right={<SandboxTag />} />
        <Card className="mx-4 mt-4 overflow-hidden">
          <div className="bg-site px-4 py-4 text-site-ink">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-site-ink/70">In-principle amount</div>
            <div className="mt-0.5 font-display text-[32px] font-semibold leading-none">{lakh(loan.sanction.amount)}</div>
            <div className="mt-1.5 text-[12px] text-site-ink/70">
              {loan.rate}% · {loan.tenureYears} years · EMI {inr(loan.emi)} · in-principle
            </div>
          </div>
          <div className="divide-y divide-line">
            {[
              ["Reference", loan.sanction.ref],
              ["For", booking ? `${booking.plot_no}, ${booking.project_name}` : plot.plotNo],
              ["Applicant", profile.name ?? ""],
              ["Valid until", dateIn(0, loan.sanction.validUntil)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between px-4 py-2.5 text-[13.5px]">
                <span className="text-ink-soft">{k}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </Card>
        <Section title="Before final sanction">
          <Card className="px-4 py-3 text-[13px] leading-relaxed">
            The bank will ask for your last 3 months&rsquo; salary slips or 2 years&rsquo; ITR, 6 months of bank statements, and the agreement
            for sale. Your relationship manager will help with these.
          </Card>
        </Section>
        <Disclosure>
          In-principle sanction, simulated. It isn&rsquo;t a loan offer. Final sanction depends on the bank&rsquo;s credit checks, your
          documents and the property&rsquo;s legal and technical valuation.
        </Disclosure>
      </div>
    );
  }

  return (
    <div>
      <ScreenTitle eyebrow={booking ? `${booking.plot_no} · ${lakh(price)}` : `Plot value ${lakh(price)}`} title="Loan eligibility" sub="An in-principle estimate from partner banks." right={<SandboxTag />} />

      <div className="mt-4 space-y-4 px-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monthly income">
            <input value={income} onChange={(ev) => setIncome(ev.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" placeholder="1,50,000" className={inputClass} />
          </Field>
          <Field label="Existing EMIs / month">
            <input value={obligations} onChange={(ev) => setObligations(ev.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" placeholder="0" className={inputClass} />
          </Field>
        </div>

        <Field label="Employment">
          <div className="grid grid-cols-2 gap-2">
            {(["Salaried", "Self-employed"] as const).map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setEmployment(x)}
                className={`h-11 rounded-xl border text-[13.5px] font-semibold ${employment === x ? "border-verd bg-verd-soft text-verd" : "border-line bg-card"}`}
              >
                {x}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Credit score">
          <div className="grid grid-cols-4 gap-1.5">
            {BANDS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBand(b.id)}
                className={`rounded-xl border px-1 py-2 text-center ${band === b.id ? "border-verd bg-verd-soft text-verd" : "border-line bg-card"}`}
              >
                <span className="block text-[12.5px] font-semibold">{b.label}</span>
                <span className="block text-[10.5px] text-ink-soft">{b.range}</span>
              </button>
            ))}
          </div>
        </Field>
      </div>

      <Card className="mx-4 mt-5 overflow-hidden">
        <div className="bg-site px-4 py-4 text-site-ink">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-site-ink/70">You could borrow, in-principle</div>
          <div className="mt-0.5 font-display text-[32px] font-semibold leading-none">{ready ? lakh(e.eligible) : "—"}</div>
          <div className="mt-1.5 text-[12px] text-site-ink/70">
            {ready ? `${e.band.rate}% · ${TENURE_YEARS} years · EMI ${inr(e.emi)}` : "Enter your monthly income"}
          </div>
        </div>
        {ready && (
          <div className="px-4 py-3 text-[12.5px] leading-relaxed text-ink-soft">
            {e.limitedBy === "ltv" && <>Capped at 50% of the plot value. Your income supports up to {lakh(e.byIncome)}.</>}
            {e.limitedBy === "income" && (
              <>
                Based on {Math.round(e.band.foir * 100)}% of income going to EMIs ({inr(e.headroomEmi)} a month after existing EMIs). The maximum is{" "}
                {lakh(e.cap)}, 50% of the plot value.
              </>
            )}
            {e.limitedBy === "none" && <>Your existing EMIs use up the headroom for this band. A co-applicant can help.</>}
          </div>
        )}
      </Card>

      <div className="mt-4 px-4">
        {stage !== null ? (
          <Card className="px-4 py-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-verd transition-[width] duration-1000 ease-linear" style={{ width: `${((stage + 1) / STAGES.length) * 100}%` }} />
            </div>
            <p className="mt-3 text-[14px] font-semibold">{STAGES[stage]}</p>
            <p className="text-[12px] text-ink-soft">Sandbox: no bank or bureau is contacted.</p>
          </Card>
        ) : (
          <Button className="w-full" disabled={!ready || e.eligible === 0} onClick={apply}>
            Get in-principle sanction · sandbox
          </Button>
        )}
      </div>

      <Disclosure>
        In-principle estimate only. It isn&rsquo;t an offer of credit. Rates are indicative by credit band, and final terms depend on the
        bank&rsquo;s assessment. {employment === "Self-employed" ? "Self-employed applicants usually need 2 years of ITR." : ""}
      </Disclosure>
    </div>
  );
}
