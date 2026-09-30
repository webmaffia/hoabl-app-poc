"use client";

// Payment calculator: value, down payment, rate and tenure as sliders, with
// EMI, loan and interest updating live, beside the instalment plan.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/store";
import { calculatePayment } from "@/lib/agent/tools";
import { findPlot, getPlots, type Plot } from "@/lib/inventory";
import { INDICATIVE_RATE, TOKEN_AMOUNT } from "@/lib/knowledge";
import { inr, lakh, sqft } from "@/lib/journey";
import { Button, Card, Disclosure, ScreenTitle, Section, StickyBar } from "@/components/journey/ui";

export default function Calculator() {
  const { selectedPlot, booking, overrides } = useSession();
  const plot =
    (selectedPlot && findPlot(selectedPlot, overrides)) ||
    (booking && findPlot(booking.plot_id, overrides)) ||
    getPlots("anjarle", overrides).find((p) => p.status === "available")!;
  // Keyed on the plot, so the sliders reset when the agent switches plots.
  return <CalculatorFor key={plot.id} plot={plot} />;
}

function CalculatorFor({ plot }: { plot: Plot }) {
  const router = useRouter();
  const { booking, send } = useSession();
  const [value, setValue] = useState(plot.price);
  const [down, setDown] = useState(20);
  const [rate, setRate] = useState(INDICATIVE_RATE);
  const [tenure, setTenure] = useState(15);

  const r = calculatePayment({ price: value, down_payment_pct: down, annual_rate: rate, tenure_years: tenure });
  const afterToken = value - TOKEN_AMOUNT;
  const plan = [
    { when: "Today", what: "Booking token", amount: TOKEN_AMOUNT },
    { when: "Within 30 days", what: "20% instalment", amount: value * 0.2 - TOKEN_AMOUNT },
    { when: "Within 90 days", what: "40% instalment", amount: value * 0.4 },
    { when: "At registration", what: "Final 40%", amount: value * 0.4 },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTitle eyebrow={`Plot ${plot.plotNo} · ${sqft(plot.sizeSqft)}`} title="What it costs you" sub="Move the sliders to see what fits." />

      <Card className="mx-4 mt-4 overflow-hidden">
        <div className="bg-site px-4 py-4 text-site-ink">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-site-ink/70">Monthly EMI</div>
          <div className="mt-0.5 font-display text-[34px] font-semibold leading-none tracking-tight">{inr(r.emi)}</div>
          <div className="mt-1.5 text-[12px] text-site-ink/70">
            for {tenure} years at {rate.toFixed(2)}% · indicative, in-principle
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line">
          <Out label="Down payment" value={lakh(r.down_payment)} />
          <Out label="Loan" value={lakh(r.loan_amount)} />
          <Out label="Total interest" value={lakh(r.total_interest)} />
        </div>
      </Card>

      <Section>
        <Card className="space-y-4 px-4 py-4">
          <Slider label="Plot value" display={lakh(value)} min={1000000} max={10000000} step={50000} value={value} onChange={setValue} />
          <Slider label="Down payment" display={`${down}% · ${lakh(r.down_payment)}`} min={10} max={100} step={5} value={down} onChange={setDown} />
          <Slider label="Interest rate" display={`${rate.toFixed(2)}%`} min={7.5} max={12} step={0.05} value={rate} onChange={setRate} />
          <Slider label="Tenure" display={`${tenure} years`} min={5} max={30} step={1} value={tenure} onChange={setTenure} />
          <p className="text-[11.5px] text-ink-soft">Partner banks finance up to 50% of the plot value. Below 50% down, the difference is due from you.</p>
        </Card>
      </Section>

      <Section title="Instalment plan">
        <Card className="divide-y divide-line">
          {plan.map((p) => (
            <div key={p.what} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <div className="text-[13.5px] font-semibold">{p.what}</div>
                <div className="text-[11.5px] text-ink-soft">{p.when}</div>
              </div>
              <div className="text-[14px] font-semibold">{inr(p.amount)}</div>
            </div>
          ))}
          <div className="flex items-center justify-between bg-paper/60 px-4 py-2.5 text-[12.5px] text-ink-soft">
            <span>Balance after token</span>
            <span className="font-semibold text-ink">{inr(afterToken)}</span>
          </div>
        </Card>
      </Section>

      <Disclosure>
        EMI figures are indicative. Loans are in-principle until a partner bank sanctions them after its own checks and property
        valuation. The indicative rate is {INDICATIVE_RATE}% a year.
      </Disclosure>

      <StickyBar className="grid grid-cols-2">
        <Button variant="secondary" onClick={() => router.push("/money/loan")}>
          Check loan eligibility
        </Button>
        <Button
          disabled={plot.status !== "available" && booking?.plot_id !== plot.id}
          onClick={() => (booking?.plot_id === plot.id ? router.push("/booking") : void send(`I want to book plot ${plot.plotNo}.`))}
        >
          {booking?.plot_id === plot.id ? "Go to booking" : "Book this plot"}
        </Button>
      </StickyBar>
    </div>
  );
}

function Out({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2.5">
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-ink-soft">{label}</div>
      <div className="text-[14.5px] font-semibold">{value}</div>
    </div>
  );
}

function Slider({ label, display, min, max, step, value, onChange }: { label: string; display: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-ink-soft">{label}</span>
        <span className="text-[14px] font-semibold">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1.5 w-full accent-[var(--verd)]" />
    </label>
  );
}
