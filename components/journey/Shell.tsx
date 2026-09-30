"use client";

// The spine of the journey. It stays mounted across every journey route, so
// the avatar session, the conversation and the composer persist while screens
// change underneath. When the agent calls `show`, the shell navigates. When
// the customer navigates, the shell tells the store, and the screen goes back
// to the agent as context on the next turn.
//
// Two views:
// - the advisor (/agent): the avatar full screen, live-stream style, or the
//   chat transcript
// - the app screens: the avatar shrinks to a tile in the corner (or, in chat,
//   the advisor's latest line docks above the input); minimising the advisor
//   lands here, and tapping the tile or the dock goes back

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { nextPlanStep, useSession } from "@/lib/store";
import { avatar, useAvatar } from "@/lib/avatar/controller";
import { flushScroll, requestScroll } from "@/lib/maps";
import { routeFor, screenFromPath, VIEW_LABEL, type View } from "@/lib/journey";
import { findPlot } from "@/lib/inventory";
import { AvatarStage } from "@/components/agent/AvatarStage";
import { Transcript } from "@/components/agent/Transcript";
import { Composer } from "@/components/agent/Composer";
import { LiveOverlay } from "@/components/agent/LiveOverlay";
import { BackIcon, MinimizeIcon, PhoneIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { screenCue } from "@/lib/avatar/screen-lines";
import { FindingOverlay } from "@/components/journey/FindingOverlay";

// Next steps on the property page: the plot map first, then the questions
// buyers usually ask about a project.
const SHOW_PLOTS = "Take me to the plots";
const BOOK_PLOT = "Book this plot";
const WORK_OUT_EMI = "Work out EMI";

const TRAIL_KEY = "hoabl-trail";

function readTrail(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(TRAIL_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function saveTrail(v: string[]): void {
  try {
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify(v.slice(-50)));
  } catch {}
}

/** One level up, for Back when there's no earlier screen in this session. */
function parentOf(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "plots" && parts[2] === "map") return `/plots/${parts[1]}`;
  if (parts[0] === "plots" && parts[1]) return "/plots";
  // The booking journey steps back the way it came: loan → KYC → booking → plots.
  if (parts[0] === "money" && parts[1] === "loan") return "/booking/kyc";
  if (parts[0] === "booking" && parts[1] === "plan") return "/booking/kyc";
  if (parts[0] === "booking" && parts[1] === "kyc") return "/booking";
  if (parts[0] === "booking" || parts[0] === "money") {
    const plot = useSession.getState().selectedPlot;
    const project = (plot && findPlot(plot)?.projectId) || "anjarle";
    return `/plots/${project}/map`;
  }
  return "/agent";
}
const PROJECT_NEXT_STEPS = [
  SHOW_PLOTS,
  WORK_OUT_EMI,
  "What's the price range?",
  "Is it RERA registered?",
  "When is possession?",
  "What amenities are there?",
  "How far is it from Mumbai?",
  "What's the payment plan?",
];
// Chips for the post-KYC steps, keyed by the step that's next.
const PLAN_CHIPS: Record<string, string[]> = {
  i20: ["Take me to the 20% instalment", "What happens next?", "Check my loan eligibility"],
  allotment: ["Get my allotment letter", "What is an allotment letter?"],
  i40: ["Take me to the 40% instalment", "What happens next?"],
  registration: ["Take me to registration", "What do I get at registration?"],
  done: [],
};
const noopSubscribe = () => () => {};

export function JourneyShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // sessionStorage only exists in the browser, so render after hydration.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const { turns, busy, error, profile, send, requestHuman, screen, screenSeq, selectedPlot, overrides, onboarding, booking, kyc, plan } = useSession();
  const { mode, note, liveEnabled } = useAvatar();
  const showPills = true; // the toggle is gone: the advisor's checks always show
  const greeted = useRef(false);
  const lastSeq = useRef(screenSeq);
  /**
   * The screens visited in this tab, oldest first, mirroring the browser's own
   * history. Kept in sessionStorage so a refresh doesn't forget where the
   * customer came from.
   */
  const trail = useRef<string[] | null>(null);
  /** Set when the browser moved through its history (Back, or the phone's back). */
  const popped = useRef(false);
  const content = useRef<HTMLDivElement>(null);
  const lastScreenPath = useRef<string | null>(null);
  /** The route the Land Advisor itself navigated to, so its own reply covers it. */
  const agentNav = useRef<string | null>(null);

  const onScreen = pathname !== "/agent";
  const immersive = !onScreen && mode === "avatar";

  // Boot: bind the avatar to the conversation, warm it, greet once.
  useEffect(() => {
    if (!mounted) return;
    if (!useSession.getState().profile.name) {
      router.replace("/register");
      return;
    }
    avatar.bind({ send: (t) => void useSession.getState().send(t), abort: () => useSession.getState().abort() });
    void avatar.warm();
    // Greet on the next tick, so React's dev double-mount (mount, unmount,
    // mount) can't flush the intro out of the avatar's queue before it's said.
    const greet = setTimeout(() => {
      const s = useSession.getState();
      if (greeted.current || s.turns.length > 0 || s.busy) return;
      greeted.current = true;
      s.startOnboarding();
    }, 0);
    return () => {
      clearTimeout(greet);
      avatar.shutdown();
    };
  }, [mounted, router]);

  // The agent asked for a screen: go there. Nobody clicked anything.
  useEffect(() => {
    if (screenSeq === lastSeq.current) return;
    lastSeq.current = screenSeq;
    if (!screen) return;
    const target = routeFor(screen);
    if (screen.view === "location") requestScroll("location");
    if (target !== pathname) {
      agentNav.current = target;
      router.push(target);
    } else flushScroll();
  }, [screenSeq, screen, pathname, router]);

  useEffect(() => {
    const onPop = () => (popped.current = true);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // The customer navigated: record what they're looking at, and start the
  // new screen at the top (the scroll container outlives the route).
  useEffect(() => {
    const s = useSession.getState();
    trail.current ??= readTrail();
    const v = trail.current;
    // Back never opens the full-screen advisor. If the browser's history moved
    // onto the advisor entry, step past it to the screen before, or stay put.
    if (popped.current && pathname === "/agent" && lastScreenPath.current) {
      if (v.lastIndexOf("/agent", v.length - 2) >= 1) window.history.go(-1);
      else {
        popped.current = false;
        router.replace(lastScreenPath.current);
      }
      return;
    }
    s.setScreen(screenFromPath(pathname, s.selectedPlot));
    if (pathname !== "/agent") lastScreenPath.current = pathname;
    // A history move onto the screen before the last one is a step back (the
    // arrow, or the phone's own back); anything else is a step forward.
    // Back may skip several entries (the advisor page is never a Back target),
    // so cut the trail down to wherever the history landed.
    const at = popped.current ? v.lastIndexOf(pathname, v.length - 2) : -1;
    popped.current = false;
    if (at >= 0) v.length = at + 1;
    else if (v[v.length - 1] !== pathname) v.push(pathname);
    saveTrail(v);
    content.current?.scrollTo({ top: 0 });

    // Keep the voice on the screen. If the Land Advisor opened this screen,
    // its reply is already about it. Otherwise the customer did: stop talking
    // about the last screen, drop any reply still coming about it, and say a
    // line about this one (unless a tap here just asked the advisor something).
    if (agentNav.current === pathname) {
      agentNav.current = null;
      return;
    }
    agentNav.current = null;
    const cue = screenCue(pathname, {
      firstName: s.profile.name?.split(" ")[0] ?? null,
      booking: s.booking && { plot_no: s.booking.plot_no, status: s.booking.status },
      kycDone: Boolean(s.kyc),
      plan: nextPlanStep(s.plan),
    });
    const lastTurn = s.metrics[s.metrics.length - 1];
    const askedJustNow = s.busy && lastTurn && Date.now() - lastTurn.startedAt < 1500;
    if (pathname !== "/agent" && s.busy && !askedJustNow) s.abort();
    if (!askedJustNow) {
      if (cue.interrupt) avatar.interrupt();
      if (cue.line && !s.onboarding) avatar.speak(cue.line);
    }
  }, [pathname]);

  if (!mounted || !profile.name) return <div className="h-full" />;

  const last = turns[turns.length - 1];
  // On the property page the chips are the next steps, led by the plot map.
  const onProject = onScreen && screen?.view === "project";
  // Screens with a pinned CTA bar: the avatar tile lifts above it and the page needs no bottom padding.
  const pinnedBar =
    onProject || (onScreen && (screen?.view === "calculator" || screen?.view === "booking" || screen?.view === "kyc" || screen?.view === "loan" || screen?.view === "plan"));
  // Screens that speak for themselves: no Land Advisor strip with its latest line.
  const hideDock =
    onProject || (onScreen && (screen?.view === "recommendations" || screen?.view === "plots" || screen?.view === "plot" || screen?.view === "booking" || screen?.view === "kyc" || screen?.view === "loan" || screen?.view === "plan"));
  // On the plot map, a selected plot that's free to book leads with "Book this plot".
  const onMap = onScreen && (screen?.view === "plots" || screen?.view === "plot");
  const picked = onMap && selectedPlot ? findPlot(selectedPlot, overrides) : undefined;
  const bookable = picked?.status === "available" && picked.projectId === pathname.split("/")[2];
  const agentChips = last?.kind === "agent" ? last.chips : [];
  // The booking journey runs in order (token, KYC, loan): only offer the step that's next.
  const paid = booking?.status === "paid";
  const journeyChips =
    onScreen && screen?.view === "booking"
      ? !booking
        ? undefined
        : !paid
          ? ["How do I pay the token?", "Is the token refundable?", "Explain my contribution"]
          : !kyc
            ? ["Start my KYC", "Why is KYC needed?", "What happens next?"]
            : PLAN_CHIPS[nextPlanStep(plan) ?? "done"]
      : onScreen && screen?.view === "kyc"
        ? !paid
          ? ["How do I pay the token?", "Is the token refundable?"]
          : !kyc
            ? ["What do I need for KYC?", "Is my data safe?"]
            : ["Continue to my payment plan", "Check my loan eligibility"]
        : onScreen && screen?.view === "plan"
          ? !paid
            ? ["How do I pay the token?"]
            : !kyc
              ? ["Start my KYC", "Why is KYC needed?"]
              : PLAN_CHIPS[nextPlanStep(plan) ?? "done"]
          : undefined;
  const chips = journeyChips
    ? journeyChips
    : onProject
    ? PROJECT_NEXT_STEPS
    : bookable
      ? [BOOK_PLOT, WORK_OUT_EMI, ...agentChips.filter((c) => !/book|emi/i.test(c))].slice(0, 4)
      : agentChips;
  const lastAgent = [...turns].reverse().find((t) => t.kind === "agent");
  const running = [...turns].reverse().find((t) => t.kind === "tool" && !t.tool.pill);
  const lastShow = [...turns].reverse().find((t) => t.kind === "show");

  const humanRequest = () => {
    avatar.bargeIn();
    void requestHuman();
  };
  // Minimise: back to the app, on the screen the customer last had open, else
  // the last one the advisor showed, else recommendations.
  // The conversation carries on across the minimise: mark the route as the
  // advisor's own so the screen cue doesn't cut off or talk over its reply.
  const minimise = () => {
    const target = lastScreenPath.current ?? (lastShow?.kind === "show" ? routeFor({ view: lastShow.view as View, id: lastShow.id }) : "/plots");
    agentNav.current = target;
    router.push(target);
  };
  const toAdvisor = () => router.push("/agent");
  // Back goes to the screen the customer was actually on before. Opened
  // straight onto a screen, it steps up a level instead.
  const goBack = () => {
    const v = trail.current ?? readTrail();
    // Skip the advisor page (the tile reopens it) and the landing page (its welcome screen is not a place to go Back to).
    let i = v.length - 2;
    while (i >= 0 && (v[i] === "/agent" || v[i] === "/" || v[i] === pathname)) i--;
    // Go to the screen by route, not by history offset: the trail outlives the
    // tab's history, so an offset can overshoot onto the landing page.
    const trailTarget = v[i];
    if (i >= 0) {
      v.length = i; // the effect above re-adds the screen on arrival
      saveTrail(v);
      router.replace(trailTarget);
    } else {
      const up = parentOf(pathname);
      if (up !== "/agent") router.push(up); // nothing earlier: stay, never open the advisor
    }
  };
  const sendFromComposer = (text: string) => {
    // The lead next step opens the plot map right away; the Land Advisor then
    // talks the customer through it.
    if (onProject && text === SHOW_PLOTS && screen?.id) router.push(`/plots/${screen.id}/map`);
    // Straight to the calculator; it picks a plot itself if none is chosen.
    if ((onProject || bookable) && text === WORK_OUT_EMI) return void router.push("/money/calculator");
    // Name the plot, so the Land Advisor books the one on screen.
    if (text === BOOK_PLOT && picked) return void send(`Book plot ${picked.plotNo} for me.`);
    void send(text);
  };

  return (
    // Any touch counts as activity: reopen a paused avatar before they speak.
    <main className={`relative flex h-full flex-col ${immersive ? "bg-site" : ""}`} onPointerDown={() => avatar.wake()}>
      {!immersive && (
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-paper/80 px-3 py-2 backdrop-blur">
          <div className="flex min-w-0 items-center gap-1">
            {onScreen && (
              <button onClick={goBack} className="-ml-1 rounded-full p-1.5 text-ink-soft" aria-label="Back">
                <BackIcon className="h-5 w-5" />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {onScreen ? (
                  <span className="truncate font-display text-[16.5px] font-semibold tracking-tight">{screen ? VIEW_LABEL[screen.view] : ""}</span>
                ) : (
                  <>
                    <Logo className="h-7" />
                    <span className="border-l border-line pl-1.5 font-display text-[15px] font-semibold tracking-tight">Land Advisor</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={humanRequest}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/45 bg-white/20 text-white backdrop-blur-md"
              aria-label="Talk to a human advisor"
              title="Talk to a human advisor"
            >
              <PhoneIcon className="h-[18px] w-[18px]" />
            </button>
            {!onScreen && (
              <button
                onClick={minimise}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-ink"
                aria-label="Minimise the advisor and show the app"
                title="Minimise"
              >
                <MinimizeIcon className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>
        </header>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col">
        <AvatarStage pip={onScreen} lift={pinnedBar} onExpand={toAdvisor} />

        {immersive ? (
          <LiveOverlay
            turns={turns}
            busy={busy}
            error={error}
            name={profile.name ?? ""}
            chips={chips}
            showPills={showPills}
            onSend={(t) => void send(t)}
            onHuman={humanRequest}
            onMinimise={minimise}
            canMinimise={!onboarding}
          />
        ) : onScreen ? (
          // Bottom padding keeps the end of every screen clear of the avatar tile.
          <div ref={content} className={`min-h-0 flex-1 overflow-y-auto ${pinnedBar ? "" : "pb-36"}`}>
            {children}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Transcript turns={turns} busy={busy} error={error} showPills={showPills} onRetry={() => void send(lastUserText(turns))} />
          </div>
        )}
      </div>

      {onScreen && !hideDock && (
        <>
          <button onClick={toAdvisor} className="shrink-0 border-t border-line bg-card px-4 py-2.5 text-left" aria-label="Back to the advisor">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-verd">
              <span className={`h-1.5 w-1.5 rounded-full bg-verd ${busy ? "animate-pulse" : ""}`} />
              {busy ? (running?.kind === "tool" ? `${running.tool.name.replace("_", " ")}…` : "Land Advisor is thinking…") : "Land Advisor"}
              <span className="ml-auto font-medium normal-case tracking-normal text-ink-soft">{mode === "avatar" ? "Open Land Advisor" : "Open chat"}</span>
            </div>
            {lastAgent?.kind === "agent" && <p className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-ink">{lastAgent.text}</p>}
          </button>
        </>
      )}

      {/* Pinned above the input so it never scrolls away. */}
      {!immersive && note && mode === "chat" && <FallbackNote note={note} liveEnabled={liveEnabled} />}
      {!immersive && <Composer chips={chips} busy={busy} onSend={sendFromComposer} />}
      <FindingOverlay />
    </main>
  );
}

/** Shown in chat after the live avatar failed, with a way back to it. */
function FallbackNote({ note, liveEnabled }: { note: string; liveEnabled: boolean }) {
  return (
    <div className="mx-3 my-2 flex shrink-0 items-start gap-3 rounded-xl border border-gold/50 bg-gold-soft px-3 py-2.5 text-[12.5px] leading-snug text-ink">
      <span className="flex-1">{note}</span>
      <span className="flex shrink-0 flex-col items-end gap-1 text-[12px] font-semibold">
        {liveEnabled && (
          <button onClick={() => avatar.retryLive()} className="text-verd">
            Try the avatar again
          </button>
        )}
        <button onClick={() => avatar.clearNote()} className="text-ink-soft">
          Dismiss
        </button>
      </span>
    </div>
  );
}

function lastUserText(turns: ReturnType<typeof useSession.getState>["turns"]): string | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t.kind === "user") return t.text;
  }
  return null;
}
