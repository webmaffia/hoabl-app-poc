"use client";

// The landing page's main call to action. A returning customer's session is
// in localStorage, so instead of sending them through registration again,
// this lands them back on the screen they last had open.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/store";
import { routeFor } from "@/lib/journey";
import { ArrowIcon } from "@/components/icons";

export function ResumeCta() {
  const router = useRouter();
  const [resume, setResume] = useState<{ href: string; label: string } | null>(null);

  useEffect(() => {
    const s = useSession.getState();
    if (!s.profile.name) return;
    setResume({
      href: s.screen ? routeFor(s.screen) : "/agent",
      label: `Continue as ${s.profile.name.split(" ")[0]}`,
    });
  }, []);

  return (
    <>
      <Link
        href={resume?.href ?? "/register"}
        className="flex h-14 w-full items-center justify-between rounded-2xl bg-gold px-5 text-[16px] font-semibold text-site shadow-lg transition active:scale-[0.99]"
      >
        {resume?.label ?? "Get Started"}
        <ArrowIcon className="h-5 w-5" />
      </Link>
      {resume && (
        <button
          onClick={() => {
            useSession.getState().reset();
            router.push("/register");
          }}
          className="mt-3 w-full text-center text-[12px] font-medium text-white/65 underline underline-offset-2"
        >
          Start over instead
        </button>
      )}
    </>
  );
}
