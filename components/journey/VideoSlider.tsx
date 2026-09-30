"use client";

// Horizontal slider of 9:16 clips. Touch swipes natively; with a mouse the row
// can be dragged, and arrows step through the clips.

import { useRef, useState } from "react";
import { VerticalVideo } from "@/components/journey/VerticalVideo";

export function VideoSlider({ items }: { items: { src: string; label: string }[] }) {
  const row = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  const step = (dir: 1 | -1) => {
    const el = row.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.6, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={row}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse" || !row.current) return;
          drag.current = { x: e.clientX, left: row.current.scrollLeft, moved: false };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || !row.current) return;
          if (Math.abs(e.clientX - d.x) > 3) d.moved = true;
          row.current.scrollLeft = d.left - (e.clientX - d.x);
        }}
        onPointerUp={() => {
          drag.current = null;
          setDragging(false);
        }}
        onPointerLeave={() => {
          drag.current = null;
          setDragging(false);
        }}
        className={`-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] ${
          dragging ? "cursor-grabbing select-none" : "cursor-grab snap-x snap-mandatory"
        }`}
      >
        {items.map((r) => (
          <VerticalVideo key={r.src} src={r.src} label={r.label} />
        ))}
      </div>
      <button
        onClick={() => step(-1)}
        aria-label="Previous video"
        className="absolute left-1 top-1/2 hidden h-8 w-8 -translate-y-1/2 rounded-full bg-black/50 text-white backdrop-blur [@media(hover:hover)]:block"
      >
        ‹
      </button>
      <button
        onClick={() => step(1)}
        aria-label="Next video"
        className="absolute right-1 top-1/2 hidden h-8 w-8 -translate-y-1/2 rounded-full bg-black/50 text-white backdrop-blur [@media(hover:hover)]:block"
      >
        ›
      </button>
    </div>
  );
}
