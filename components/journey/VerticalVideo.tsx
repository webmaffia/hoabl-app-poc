"use client";

// A 9:16 card for a slider on the property page. It plays silently on a loop
// while mostly on screen and pauses when swiped away.

import { useEffect, useRef } from "react";

export function VerticalVideo({ src, label }: { src: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="relative aspect-[9/16] w-[58%] shrink-0 snap-start overflow-hidden rounded-2xl bg-site shadow-md">
      <video
        ref={ref}
        src={`${encodeURI(src)}#t=0.1`}
        aria-label={label}
        muted
        loop
        playsInline
        preload="metadata"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
