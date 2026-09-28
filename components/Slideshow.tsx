"use client";

// A slow background slideshow: each photo holds for a few seconds with a
// gentle zoom, then crossfades into the next.

import { useEffect, useState } from "react";
import Image from "next/image";

export interface Slide {
  src: string;
  alt: string;
  caption?: string;
}

const HOLD_MS = 6500;

export function Slideshow({ slides, className = "" }: { slides: Slide[]; className?: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), HOLD_MS);
    return () => clearInterval(t);
  }, [slides.length]);

  const current = slides[index];

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {slides.map((s, i) => {
        const on = i === index;
        return (
          <div key={s.src} className={`absolute inset-0 transition-opacity duration-[1800ms] ease-in-out ${on ? "opacity-100" : "opacity-0"}`}>
            <Image
              src={s.src}
              alt={s.alt}
              fill
              sizes="428px"
              priority={i === 0}
              className={`object-cover ${on ? "slide-zoom" : ""}`}
            />
          </div>
        );
      })}
      {current.caption && (
        <span key={current.src} className="slide-caption absolute right-4 top-16 z-10 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-medium text-white/85 backdrop-blur">
          {current.caption}
        </span>
      )}
    </div>
  );
}
