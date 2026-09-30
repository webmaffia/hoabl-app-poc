"use client";

// The project films, inline at the top of the property page, narrated by the
// Land Advisor. They play automatically, muted, one after another, and the
// avatar's voice drives the pace so words and pictures stay together:
//
//   1. cue    the film waits on its first frame while the narration is sent
//   2. play   the film starts the moment the Land Advisor starts speaking
//   3. hold   if the film ends before the narration, it rests on its last frame
//   4. next   once the narration ends, a few more seconds of footage, then the
//             next film (straight away if this one has already ended)
//
// The films play full screen, inside the phone frame. Skip (or the last film
// ending) leaves the hero with a "Take me on the tour" button, and the Land
// Advisor asks where the customer wants to start, with quick replies below.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectVideo } from "@/lib/inventory";
import { avatar } from "@/lib/avatar/controller";
import { useSession } from "@/lib/store";
import { PlayIcon } from "@/components/icons";
import { FramePortal } from "@/components/journey/FramePortal";

const TAIL_MS = 800; // footage after the narration ends, if the film is still running
const GAP_MS = 250; // pause between films when the film has already ended

const guideLine = (projectName: string, skipped: boolean) =>
  `${skipped ? "No problem, we can skip the tour." : `That's ${projectName}.`} Quick question: are you looking at this as an investment, or as a getaway you'd enjoy yourself? Just tell me.`;

export function FilmStrip({
  projectName,
  videos,
  poster,
  onFinished,
  startDone = false,
  returnLine,
}: {
  projectName: string;
  videos: ProjectVideo[];
  /** Shown once the films have all played. */
  poster: string;
  onFinished: () => void;
  /** The customer has already had the tour: open on the hero, not full screen. */
  startDone?: boolean;
  /** Said when the page opens on the hero because the tour was already seen. */
  returnLine?: string;
}) {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(startDone);
  const [progress, setProgress] = useState(0);
  const [loopIndex, setLoopIndex] = useState(0);
  // The silent background loop leaves out the customer-story film.
  const loop = videos.filter((v) => !v.sound);
  const [blocked, setBlocked] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const flags = useRef({ narrated: false, ended: false });
  const advance = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const video = videos[index];
  const upcoming = videos[index + 1];

  const finish = useCallback(
    (skipped = false) => {
      clearTimeout(advance.current);
      avatar.interrupt();
      setDone(true);
      onFinished();
      avatar.speak(guideLine(projectName, skipped));
    },
    [onFinished, projectName],
  );

  const next = useCallback(() => {
    clearTimeout(advance.current);
    setProgress(0);
    if (index + 1 < videos.length) setIndex(index + 1);
    else finish(false);
  }, [index, videos.length, finish]);

  const goTo = useCallback(
    (i: number) => {
      if (i === index || i < 0 || i >= videos.length) return;
      clearTimeout(advance.current);
      setProgress(0);
      setIndex(i);
    },
    [index, videos.length],
  );

  // Swipe left for the next film, right for the previous one.
  const swipeFrom = useRef<{ x: number; y: number } | null>(null);
  const onSwipeEnd = (x: number, y: number) => {
    const from = swipeFrom.current;
    swipeFrom.current = null;
    if (!from) return;
    const dx = x - from.x;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(y - from.y)) return;
    if (dx < 0) next();
    else goTo(index - 1);
  };

  const scheduleNext = useCallback(() => {
    clearTimeout(advance.current);
    advance.current = setTimeout(next, flags.current.ended ? GAP_MS : TAIL_MS);
  }, [next]);

  const play = () =>
    ref.current?.play().then(
      () => setBlocked(false),
      (err: DOMException) => setBlocked(err?.name === "NotAllowedError"),
    );

  // Leaving the page stops the narration: the voice follows the screen.
  useEffect(() => () => avatar.interrupt(), []);

  // Once the tour has started it counts as seen, so leaving and coming back
  // (maximising the advisor, say) doesn't replay it full screen. On the way
  // back the advisor still speaks, so the page never sits silent.
  useEffect(() => {
    if (!startDone) onFinished();
    else if (returnLine && !useSession.getState().busy && !useSession.getState().onboarding) {
      avatar.interrupt();
      avatar.speak(returnLine);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each film: cue it, narrate it, let the voice set the pace.
  useEffect(() => {
    if (done) return;
    flags.current = { narrated: false, ended: false };
    const el = ref.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    const cancel = avatar.narrate(video.narration, {
      // A film with its own sound waits for the advisor to finish, then plays
      // with audio and runs to its end, so the customer hears every word.
      onStart: () => {
        if (!video.sound) void play();
      },
      onEnd: () => {
        flags.current.narrated = true;
        if (video.sound) void play();
        else scheduleNext();
      },
    });
    return () => {
      cancel();
      clearTimeout(advance.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, done]);

  if (done) {
    return (
      <>
        <div className="relative aspect-video w-full overflow-hidden bg-site">
          {/* The films keep running silently behind the button, one after another, on a loop. */}
          <video
            key={loopIndex}
            src={loop[loopIndex % loop.length].src}
            poster={loop[loopIndex % loop.length].poster || poster}
            autoPlay
            muted
            playsInline
            preload="auto"
            onEnded={() => setLoopIndex((i) => (i + 1) % loop.length)}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
          <button
            onClick={() => {
              setIndex(0);
              setDone(false);
            }}
            className="bg-gold absolute bottom-3 right-3 flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[12px] font-semibold text-site shadow-lg"
          >
            <PlayIcon className="h-3 w-3" />
            Take me on the tour
          </button>
        </div>
      </>
    );
  }

  return (
    // The hero keeps its place in the page; the film itself fills the phone frame.
    <div className="aspect-video w-full bg-black">
      <FramePortal>
      <div
        className="absolute inset-0 z-[60] touch-pan-y select-none overflow-hidden bg-black"
        onPointerDown={(e) => (swipeFrom.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => onSwipeEnd(e.clientX, e.clientY)}
        onPointerCancel={() => (swipeFrom.current = null)}
      >
        {upcoming && <video key={upcoming.src} src={upcoming.src} preload="auto" muted className="hidden" />}
        {/* Whole frame, never cropped; a soft blur of the poster fills the bars. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={video.poster} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
        <video
          key={video.src}
          ref={ref}
          src={video.src}
          poster={video.poster}
          muted={!video.sound}
          playsInline
          preload="auto"
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.duration) setProgress(el.currentTime / el.duration);
          }}
          onEnded={() => {
            flags.current.ended = true;
            // Hold on the last frame until the Land Advisor has finished.
            if (flags.current.narrated) scheduleNext();
          }}
          className="absolute inset-0 h-full w-full object-contain"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/45" />

        <div className="absolute inset-x-0 top-0 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex gap-1">
            {videos.map((v, i) => (
              // A tall tap target around a thin bar.
              <button key={v.src} onClick={() => goTo(i)} aria-label={`Go to ${v.title}`} className="flex-1 py-2.5">
                <span className="block h-[3px] overflow-hidden rounded-full bg-white/30">
                  <span
                    className="block h-full rounded-full bg-white"
                    style={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%`, transition: i === index ? "width 250ms linear" : "none" }}
                  />
                </span>
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="pointer-events-none rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
              {index + 1}/{videos.length} · {video.title}
            </span>
            <button
              onClick={() => finish(true)}
              className="rounded-full bg-black/45 px-4 py-1.5 text-[13px] font-semibold text-white ring-1 ring-white/40 backdrop-blur active:bg-black/70"
            >
              Skip
            </button>
          </div>
        </div>

        {blocked && (
          <button
            onClick={() => void play()}
            className="bg-gold absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full px-5 py-3 text-[14px] font-semibold text-site shadow-lg"
          >
            <PlayIcon className="h-4 w-4" />
            Play
          </button>
        )}
      </div>
      </FramePortal>
    </div>
  );
}
