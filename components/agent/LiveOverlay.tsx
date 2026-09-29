"use client";

// Full-screen avatar mode, in the style of a live stream: the video fills the
// frame, the conversation scrolls up the bottom-left like live comments and
// fades out towards the top, and the controls float over the video.

import { useEffect, useRef } from "react";
import type { Turn } from "@/lib/store";
import { avatar, useAvatar } from "@/lib/avatar/controller";
import { VIEW_LABEL, type View } from "@/lib/journey";
import { Composer } from "@/components/agent/Composer";
import { MinimizeIcon, PhoneIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";

const SHADOW = "[text-shadow:0_1px_3px_rgb(0_0_0/0.65)]";

export function LiveOverlay({
  turns,
  busy,
  error,
  name,
  chips,
  showPills,
  onSend,
  onHuman,
  onMinimise,
  canMinimise = true,
}: {
  turns: Turn[];
  busy: boolean;
  error: string | null;
  name: string;
  chips: string[];
  showPills: boolean;
  onSend: (text: string) => void;
  onHuman: () => void;
  /** Minimise to the app screens, avatar in the corner. */
  onMinimise: () => void;
  /** Hidden while the welcome questions run. */
  canMinimise?: boolean;
}) {
  const { status, sandbox, listening, interim, note } = useAvatar();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, busy, interim]);

  const badge =
    status === "live"
      ? { label: "Live", cls: "bg-[#e0245e] text-white" }
      : status === "connecting"
        ? { label: "Connecting", cls: "bg-amber-400 text-site animate-pulse" }
        : { label: "Paused", cls: "bg-white/25 text-white" };
  const initial = name.trim()[0]?.toUpperCase() ?? "Y";
  const waiting = busy && turns[turns.length - 1]?.kind !== "agent";

  return (
    <>
      {/* legibility scrims */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-black/55 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[62%] bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-3 pt-3 text-white">
        <Logo className="h-9 shrink-0 [filter:drop-shadow(0_1px_3px_rgb(0_0_0/0.5))]" />
        <div className="min-w-0 border-l border-white/30 pl-2 leading-tight">
          <div className={`text-[13.5px] font-semibold ${SHADOW}`}>Land Advisor</div>
          <div className={`text-[11px] text-white/80 ${SHADOW}`}>HoABL</div>
        </div>
        <span className={`ml-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${badge.cls}`}>{badge.label}</span>
        {status === "live" && sandbox && (
          <span className="rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur">Sandbox</span>
        )}
        {canMinimise && (
          <button
            onClick={onMinimise}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/30 backdrop-blur-md"
            aria-label="Minimise the advisor and show the app"
            title="Minimise"
          >
            <MinimizeIcon className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      {(status === "sleeping" || status === "off") && !note && (
        <button
          onClick={() => avatar.wake()}
          className="absolute left-1/2 top-[38%] z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/55 px-4 py-2.5 text-[13px] font-semibold text-white backdrop-blur-md"
        >
          <span className="h-2 w-2 rounded-full bg-white/70" />
          Paused to save minutes · tap to resume
        </button>
      )}
      {status === "connecting" && (
        <div className="pointer-events-none absolute left-1/2 top-[38%] z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/45 px-4 py-2.5 text-[13px] font-semibold text-white backdrop-blur-md">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" />
          Reconnecting…
        </div>
      )}

      {note && (
        <div className="absolute inset-x-3 top-16 z-20 rounded-2xl bg-black/55 px-3 py-2.5 text-[12.5px] leading-snug text-white backdrop-blur-md">
          {note}
          <div className="mt-1.5 flex gap-3 text-[12px] font-semibold">
            <button onClick={() => avatar.clearNote()} className="text-white/70">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* bottom: comments, rail, composer */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col">
        <div className="flex items-end gap-2 pl-3 pr-2">
          <div
            className="max-h-[36dvh] min-w-0 flex-1 overflow-y-auto pb-1 [scrollbar-width:none] [mask-image:linear-gradient(to_bottom,transparent,black_28%)]"
            aria-live="polite"
          >
            <div className="flex flex-col gap-2 pt-10">
              {turns.map((t, i) => (
                <Comment key={i} turn={t} initial={initial} showPills={showPills} />
              ))}
              {(listening || interim) && (
                <div className="flex items-start gap-2">
                  <Avatar you initial={initial} />
                  <p className={`text-[13.5px] leading-snug text-white ${SHADOW}`}>
                    <b className="mr-1 font-semibold">You</b>
                    <span className="text-white/85">{interim || "Listening…"}</span>
                    <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-[#d6a24a]" />
                  </p>
                </div>
              )}
              {waiting && (
                <div className="flex items-center gap-2">
                  <Avatar />
                  <span className="flex gap-1 rounded-full bg-black/30 px-2.5 py-1.5 backdrop-blur">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/85" style={{ animationDelay: `${d * 120}ms` }} />
                    ))}
                  </span>
                </div>
              )}
              {error && <p className={`text-[12.5px] text-[#ffb3a8] ${SHADOW}`}>Something went wrong: {error}</p>}
              <div ref={end} />
            </div>
          </div>

          {/* right rail */}
          <div className="flex shrink-0 flex-col items-center pb-2 text-white">
            <button
              onClick={onHuman}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/45 bg-white/20 text-white backdrop-blur-md shadow-lg [filter:drop-shadow(0_1px_2px_rgb(0_0_0/0.5))]"
              aria-label="Talk to a human advisor"
              title="Talk to a human advisor"
            >
              <PhoneIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <Composer chips={chips} busy={busy} onSend={onSend} overlay />
      </div>
    </>
  );
}

function Comment({ turn, initial, showPills }: { turn: Turn; initial: string; showPills: boolean }) {
  if (turn.kind === "user")
    return (
      <div className="flex items-start gap-2">
        <Avatar you initial={initial} />
        <p className={`text-[13.5px] leading-snug text-white ${SHADOW}`}>
          <b className="mr-1 font-semibold">You</b>
          <span className="text-white/90">{turn.text}</span>
          {turn.interrupted && <span className="ml-1 text-[11px] text-white/60">(interrupted)</span>}
        </p>
      </div>
    );
  if (turn.kind === "agent")
    return (
      <div className="flex items-start gap-2">
        <Avatar />
        <p className={`text-[14px] leading-snug text-white ${SHADOW}`}>
          <b className="mr-1 font-semibold">Land Advisor</b>
          <span className="text-white/95">{turn.text}</span>
        </p>
      </div>
    );
  if (turn.kind === "event")
    return (
      <div className="ml-9 w-fit rounded-full bg-[#8b63ff]/80 px-2.5 py-1 text-[11.5px] font-semibold text-white backdrop-blur">✓ {turn.label}</div>
    );
  if (turn.kind === "handoff")
    return (
      <div className={`ml-9 max-w-[85%] rounded-xl bg-black/45 p-2.5 text-[12px] leading-snug text-white backdrop-blur ${SHADOW}`}>
        <p className="text-white/85">We&rsquo;ll connect you with a sales advisor who already has your complete context.</p>
        <div className="mt-1.5 flex flex-col gap-1 border-t border-white/20 pt-1.5">
          {turn.items.map((item) => (
            <span key={item.label} className={item.done ? "text-white" : "text-white/45"}>
              {item.done ? "✓" : "○"} {item.label}
            </span>
          ))}
        </div>
      </div>
    );
  if (!showPills) return null;
  if (turn.kind === "tool")
    return (
      <div className="ml-9 w-fit rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur">
        {turn.tool.pill ?? `${turn.tool.name.replace("_", " ")}…`}
      </div>
    );
  return (
    <div className="ml-9 w-fit rounded-full border border-white/30 bg-black/25 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur">
      Opened {VIEW_LABEL[turn.view as View] ?? turn.view}
    </div>
  );
}

function Avatar({ you = false, initial = "" }: { you?: boolean; initial?: string }) {
  return you ? (
    <span className="mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/85 text-[12px] font-bold text-site">{initial}</span>
  ) : (
    <span className="mt-px h-7 w-7 shrink-0 rounded-full bg-gradient-to-tr from-[#d6a24a] to-[#e0245e] p-[1.5px]">
      <span className="flex h-full w-full items-center justify-center rounded-full bg-site font-display text-[11px] font-bold text-white">H</span>
    </span>
  );
}
