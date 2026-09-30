"use client";

// The landing page's main call to action. A returning customer's session is
// in localStorage, so instead of sending them through registration again,
// this lands them back on the screen they last had open.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/store";
import { routeFor } from "@/lib/journey";
import { ArrowIcon } from "@/components/icons";
import { Button } from "@/components/journey/ui";

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
      <Button href={resume?.href ?? "/register"} className="w-full">
        {resume?.label ?? "Get Started"}
        <ArrowIcon className="h-5 w-5" />
      </Button>
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
