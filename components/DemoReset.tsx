"use client";

// A presenter-only escape hatch: wipes the whole session (profile, chat,
// booking, KYC, loan, screen) and drops back to the landing page, so a demo
// can be re-run from a clean slate without reloading or clearing storage by hand.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/lib/store";
import { GearIcon } from "@/components/icons";

export function DemoReset() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  return (
    // Rendered outside the phone frame so it never covers the composer: beside
    // the frame on desktop, on the top edge (status-bar area) on a real phone.
    <div className="pointer-events-none fixed right-1/2 top-1 z-50 translate-x-1/2 min-[560px]:bottom-3 min-[560px]:right-[calc(50%+214px+22px)] min-[560px]:top-auto min-[560px]:translate-x-0">
      {confirming ? (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/80 py-1.5 pl-3 pr-1.5 shadow-lg backdrop-blur">
          <span className="text-[11px] font-medium text-white/80">Reset demo?</span>
          <button
            onClick={() => {
              useSession.getState().reset();
              setConfirming(false);
              router.push("/");
            }}
            className="rounded-full bg-gold px-2.5 py-1 text-[11px] font-semibold text-site"
          >
            Reset
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="rounded-full px-2 py-1 text-[11px] font-medium text-white/60"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          aria-label="Reset demo"
          onClick={() => setConfirming(true)}
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/60 shadow-lg backdrop-blur transition active:scale-95"
        >
          <GearIcon className="h-[18px] w-[18px]" />
        </button>
      )}
    </div>
  );
}
