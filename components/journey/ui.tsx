// Shared building blocks for the journey screens.

import type { ReactNode } from "react";

export function ScreenTitle({ eyebrow, title, sub, right }: { eyebrow?: string; title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4">
      <div className="min-w-0">
        {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">{eyebrow}</p>}
        <h1 className="mt-0.5 font-display text-[24px] font-semibold leading-tight tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-[13.5px] leading-snug text-ink-soft">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Section({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`px-4 pt-5 ${className}`}>
      {title && <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{title}</h2>}
      {children}
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card ${className}`}>{children}</div>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">{label}</div>
      <div className="mt-0.5 truncate font-display text-[17px] font-semibold tracking-tight">{value}</div>
      {hint && <div className="text-[11px] text-ink-soft">{hint}</div>}
    </div>
  );
}

export function SandboxTag({ label = "Sandbox" }: { label?: string }) {
  return (
    <span className="shrink-0 rounded-full border border-gold px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">{label}</span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "gold";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = {
    primary: "bg-gold text-site",
    secondary: "border border-line bg-card text-ink",
    gold: "bg-gold text-site",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-[14.5px] font-semibold transition active:scale-[0.99] disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = "verd" }: { children: ReactNode; tone?: "verd" | "gold" | "muted" }) {
  const styles = { verd: "bg-verd-soft text-verd", gold: "bg-gold-soft text-gold", muted: "bg-line text-ink-soft" }[tone];
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${styles}`}>{children}</span>;
}

/** Small print that must stay visible: risk, in-principle, sandbox. */
export function Disclosure({ children }: { children: ReactNode }) {
  return <p className="mx-4 mt-6 rounded-xl border border-dashed border-line px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-soft">{children}</p>;
}

export function Steps({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 px-4 pt-3" aria-label={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1 flex-1 rounded-full ${i < current ? "bg-verd" : "bg-line"}`} />
      ))}
    </div>
  );
}

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string | null }) {
  return (
    <label className="block text-[12.5px] font-medium text-ink-soft">
      {label}
      <div className="mt-1.5">{children}</div>
      {error ? <span className="mt-1 block text-[12px] text-danger">{error}</span> : hint ? <span className="mt-1 block text-[11.5px]">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "h-12 w-full rounded-xl border border-line bg-card px-3.5 text-[15px] text-ink outline-none placeholder:text-ink-soft/60 focus:border-verd";
