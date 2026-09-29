"use client";

import { useEffect, useRef } from "react";
import type { Turn } from "@/lib/store";
import { VIEW_LABEL, type View } from "@/lib/journey";
import { CheckIcon, ScreenIcon } from "@/components/icons";

export function Transcript({ turns, busy, error, showPills, onRetry }: { turns: Turn[]; busy: boolean; error: string | null; showPills: boolean; onRetry: () => void }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, busy, error]);

  const waiting = busy && turns[turns.length - 1]?.kind !== "agent";

  return (
    <div className="flex flex-col gap-2.5 px-4 pb-2 pt-4">
      <div className="mx-auto mb-1 max-w-[34ch] rounded-xl border border-line bg-card px-3 py-2 text-center text-[12px] leading-snug text-ink-soft">
        You&rsquo;re talking to HoABL&rsquo;s virtual <b className="font-semibold text-ink">Land Advisor</b>. Prices and availability come from live inventory.
      </div>

      {turns.map((t, i) => {
        if (t.kind === "user")
          return (
            <div key={i} className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-gradient-to-br from-[#8b63ff] to-[#5a2fc2] px-3.5 py-2.5 text-[15px] leading-snug text-white">
              {t.text}
              {t.interrupted && <span className="mt-1 block text-[11px] text-white/65">Interrupted</span>}
            </div>
          );
        if (t.kind === "agent")
          return (
            <div key={i} className="mr-auto max-w-[88%] rounded-2xl rounded-bl-md border border-line bg-card px-3.5 py-2.5 text-[15px] leading-snug text-ink">
              {t.text}
            </div>
          );
        if (t.kind === "event")
          return (
            <div key={i} className="mx-auto flex items-center gap-2 rounded-full bg-verd-soft px-3 py-1 text-[12px] font-semibold text-verd">
              <span className="h-1.5 w-1.5 rounded-full bg-verd" />
              {t.label}
            </div>
          );
        if (t.kind === "handoff")
          return (
            <div key={i} className="mr-auto max-w-[88%] rounded-2xl border border-line bg-card p-3.5">
              <p className="text-[12.5px] leading-snug text-ink-soft">
                We&rsquo;ll connect you with a sales advisor who already has your complete context.
              </p>
              <div className="mt-2.5 flex flex-col gap-1.5 border-t border-line pt-2.5">
                {t.items.map((item) => (
                  <div key={item.label} className={`flex items-center gap-2 text-[13px] ${item.done ? "text-ink" : "text-ink-soft/60"}`}>
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${item.done ? "bg-verd text-white" : "border border-line"}`}
                    >
                      {item.done && <CheckIcon className="h-2.5 w-2.5" />}
                    </span>
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          );
        if (!showPills) return null;
        if (t.kind === "tool")
          return (
            <div key={i} className="mr-auto flex items-center gap-1.5 rounded-full bg-verd-soft px-2.5 py-1 text-[11.5px] font-medium text-verd">
              <span className={`h-1.5 w-1.5 rounded-full bg-verd ${t.tool.pill ? "" : "animate-pulse"}`} />
              {t.tool.pill ?? `${t.tool.name.replace("_", " ")}…`}
            </div>
          );
        return (
          <div key={i} className="mr-auto flex items-center gap-2 rounded-xl border border-dashed border-gold/60 bg-gold-soft px-3 py-1.5 text-[12px] text-ink">
            <ScreenIcon className="h-4 w-4 text-gold" />
            Opened <b className="font-semibold">{VIEW_LABEL[t.view as View] ?? t.view}</b>
          </div>
        );
      })}

      {waiting && (
        <div className="mr-auto flex gap-1 rounded-2xl rounded-bl-md border border-line bg-card px-4 py-3.5" aria-label="Land Advisor is thinking">
          {[0, 1, 2].map((d) => (
            <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-soft" style={{ animationDelay: `${d * 120}ms` }} />
          ))}
        </div>
      )}

      {error && (
        <div className="mr-auto rounded-xl bg-danger/10 px-3 py-2 text-[13px] text-danger">
          Something went wrong: {error}.{" "}
          <button onClick={onRetry} className="font-semibold underline">
            Try again
          </button>
        </div>
      )}
      <div ref={end} />
    </div>
  );
}
