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
// Full width at 16:9, so nothing in the films (logos, titles) is cropped.

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { ProjectVideo } from "@/lib/inventory";
import { avatar } from "@/lib/avatar/controller";
import { PlayIcon } from "@/components/icons";

const TAIL_MS = 4000; // footage after the narration ends
const GAP_MS = 700; // pause between films when the film has already ended

export function FilmStrip({
  projectName,
  videos,
  poster,
  onFinished,
}: {
  projectName: string;
  videos: ProjectVideo[];
  /** Shown once the films have all played. */
  poster: string;
  onFinished: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const flags = useRef({ narrated: false, ended: false });
  const advance = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const video = videos[index];

  const finish = useCallback(() => {
    setDone(true);
    onFinished();
    avatar.speak(`That's ${projectName}. Take a look at the details, and when you're ready, I'll take you to the plots.`);
  }, [onFinished, projectName]);

  const next = useCallback(() => {
    clearTimeout(advance.current);
    setProgress(0);
    if (index + 1 < videos.length) setIndex(index + 1);
    else finish();
  }, [index, videos.length, finish]);

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
      onStart: () => {
        void play();
      },
      onEnd: () => {
        flags.current.narrated = true;
        scheduleNext();
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
      <div className="relative aspect-video w-full overflow-hidden bg-site">
        <Image src={poster} alt={projectName} fill sizes="428px" className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
        <button
          onClick={() => {
            setIndex(0);
            setDone(false);
          }}
          className="bg-gold absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full px-5 py-3 text-[14px] font-semibold text-site shadow-lg"
        >
          <PlayIcon className="h-4 w-4" />
          Watch again
        </button>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black">
        <video
          key={video.src}
          ref={ref}
          src={video.src}
          poster={video.poster}
          muted
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
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/45" />

        <div className="pointer-events-none absolute inset-x-0 top-0 px-2.5 pt-2.5">
          <div className="flex gap-1">
            {videos.map((v, i) => (
              <span key={v.src} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                <span
                  className="block h-full rounded-full bg-white"
                  style={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%`, transition: i === index ? "width 250ms linear" : "none" }}
                />
              </span>
            ))}
          </div>
          <span className="mt-2 inline-block rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
            {index + 1}/{videos.length} · {video.title}
          </span>
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
  );
}
