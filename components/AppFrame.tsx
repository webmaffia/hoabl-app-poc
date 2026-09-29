"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DemoReset } from "@/components/DemoReset";

// The phone frame. The console is for the presenter's laptop, so it gets a
// wide frame instead.
export function AppFrame({ children }: { children: ReactNode }) {
  const wide = usePathname().startsWith("/console");
  return (
    <div className={`app-shell ${wide ? "app-shell--wide" : ""}`}>
      <div className="app-scroll">{children}</div>
      {!wide && <DemoReset />}
    </div>
  );
}
