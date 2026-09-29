"use client";

// The avatar frame, in two sizes: full-bleed behind the live overlay on the
// advisor screen, or a picture-in-picture tile over the app screens. It's the
// same element in both, so the video is never remounted and the advisor keeps
// talking while the screen changes underneath.
//
// The SVG advisor sits under the video and shows while the stream connects or
// is paused; if the live avatar fails, the controller switches to chat.

import { useEffect, useRef } from "react";
import { avatar, useAvatar } from "@/lib/avatar/controller";
import { SvgAvatar } from "@/components/SvgAvatar";
import { ExpandIcon } from "@/components/icons";

export function AvatarStage({ pip, lift = false, onExpand }: { pip: boolean; /** Sit higher, clear of a pinned bar at the bottom. */ lift?: boolean; onExpand: () => void }) {
  const { mode, status, speaking, listening } = useAvatar();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    avatar.attach(videoRef.current);
    return () => avatar.attach(null);
  }, [mode]);

  if (mode !== "avatar") return null;
  const live = status === "live";

  return (
    <div
      className={`overflow-hidden bg-site ${
        // The tile floats above everything, the walkthrough included, so the
        // Land Advisor can narrate the films.
        pip ? `absolute ${lift ? "bottom-[76px]" : "bottom-3"} right-3 z-[70] h-[118px] w-[90px] cursor-pointer rounded-2xl shadow-xl ring-2 ring-white/80` : "absolute inset-0 z-0"
      }`}
      onClick={pip ? onExpand : undefined}
      role={pip ? "button" : undefined}
      aria-label={pip ? "Back to the advisor" : undefined}
    >
      <div className={`absolute inset-0 transition-opacity duration-500 ${live ? "opacity-0" : "opacity-100"}`}>
        <SvgAvatar speaking={false} compact />
      </div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${live ? "opacity-100" : "opacity-0"}`}
      />
      {pip && (
        <>
          <span className={`absolute bottom-1.5 left-1.5 h-2 w-2 rounded-full ring-2 ring-black/30 ${speaking ? "animate-pulse bg-[#d6a24a]" : listening ? "bg-sky-300" : live ? "bg-emerald-400" : "bg-slate-300"}`} />
          <span className="absolute right-1 top-1 rounded-md bg-black/45 p-1 text-white backdrop-blur" aria-hidden="true">
            <ExpandIcon className="h-3.5 w-3.5" />
          </span>
        </>
      )}
    </div>
  );
}
