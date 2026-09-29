"use client";

// A full-frame popup slider for a set of pictures: swipe or use the arrows,
// tap the backdrop or the cross to close.

import { useEffect, useRef, useState } from "react";

export type LightboxImage = { src: string; label: string };

export function Lightbox({ images, start, onClose }: { images: LightboxImage[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const swipeFrom = useRef<number | null>(null);
  const many = images.length > 1;
  const go = (d: number) => setI((v) => (v + d + images.length) % images.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (many && e.key === "ArrowRight") go(1);
      else if (many && e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const img = images[i];
  const arrow = "absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur active:bg-black/70";

  return (
    <div
      className="fixed inset-0 z-[80] touch-pan-y select-none bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={img.label}
      onClick={onClose}
      onPointerDown={(e) => (swipeFrom.current = e.clientX)}
      onPointerUp={(e) => {
        const from = swipeFrom.current;
        swipeFrom.current = null;
        if (many && from !== null && Math.abs(e.clientX - from) > 50) go(e.clientX < from ? 1 : -1);
      }}
    >
      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white">
          {many ? `${i + 1}/${images.length} · ` : ""}
          {img.label}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/30 active:bg-black/70"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={img.src}
        src={img.src}
        alt={img.label}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-1/2 top-1/2 max-h-[80%] max-w-full -translate-x-1/2 -translate-y-1/2 object-contain"
      />

      {many && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label="Previous"
            className={`${arrow} left-2`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            aria-label="Next"
            className={`${arrow} right-2`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
