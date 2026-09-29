"use client";

// Full-frame layers (the film tour, the image popup) render straight into the
// phone frame, outside the scrolling screen. Inside the scroller, iOS Safari
// mis-sizes and scrolls `position: fixed` layers, so they never quite fill the
// screen. In the frame they cover it edge to edge, safe areas included.

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const noopSubscribe = () => () => {};

export function FramePortal({ children }: { children: ReactNode }) {
  const frame = useSyncExternalStore(
    noopSubscribe,
    () => document.querySelector<HTMLElement>(".app-shell"),
    () => null,
  );
  return frame ? createPortal(children, frame) : null;
}
