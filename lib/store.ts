// Session state. Zustand, mirrored to localStorage so a refresh — or coming
// back after closing the browser — keeps the conversation and lets the
// customer resume where they left off, and broadcast to the console tab so it
// can follow the session live. Conversation state lives here, never in the avatar.

"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { AgentEvent } from "@/lib/agent/run";
import { emitAgentEvent, onAgentEvent } from "@/lib/bus";
import { emptyEvidence, type Evidence, type Violation } from "@/lib/agent/guard";
import { advanceIntent, emptyProfile, type Intent, type Profile } from "@/lib/agent/prompt";
import type { PlotOverrides } from "@/lib/inventory";
import type { Screen } from "@/lib/journey";
import { QUESTIONS, handoff, intro, profileFrom } from "@/lib/onboarding";

export interface ToolPill {
  id: string;
  name: string;
  pill: string | null; // null while running
}

export interface HandoffItem {
  label: string;
  done: boolean;
}

export type Turn =
  | { kind: "user"; text: string; interrupted?: boolean }
  | { kind: "agent"; text: string; chips: string[] }
  | { kind: "tool"; tool: ToolPill }
  | { kind: "show"; view: string; id: string | null }
  /** Something that happened in the app (payment, KYC), shown as a system line. */
  | { kind: "event"; label: string }
  /** Shown when the customer asks for a human advisor: what will carry over to them. */
  | { kind: "handoff"; items: HandoffItem[] };

/** Speaking to a human advisor asks for this exact line so the request is unambiguous to the model. */
export const HUMAN_REQUEST = "I'd like to speak to a human advisor, please.";

export interface GuardHit {
  at: number;
  action: string;
  violations: Violation[];
}

export interface TraceEntry {
  id: string;
  turn: number;
  name: string;
  args: unknown;
  pill: string | null;
  ms: number | null;
  at: number;
}

export interface TurnMetric {
  turn: number;
  startedAt: number;
  firstSayMs: number | null;
  doneMs: number | null;
}

export interface SearchResult {
  id: string;
  name: string;
  location: string;
  illustrative: boolean;
  entry_ticket: number;
  rate_per_sqft: number;
  cagr_range: string;
  hold: string;
  available_plots: number;
  available_in_budget: number;
  cheapest_in_budget: number | null;
  fit_score: number;
  fit_reason: string;
  hook: string;
  featured?: boolean;
}

export interface Booking {
  booking_id: string;
  plot_id: string;
  plot_no: string;
  project_id: string;
  project_name: string;
  size_sqft: number;
  price: number;
  token_amount: number;
  status: "initiated" | "paid";
  method?: string;
  paidAt?: number;
}

export interface Kyc {
  panMasked: string;
  name: string;
  verifiedAt: number;
}

export interface LoanResult {
  band: string;
  rate: number;
  eligibleAmount: number;
  emi: number;
  tenureYears: number;
  sanction?: { ref: string; amount: number; validUntil: number };
}

interface SessionState {
  profile: Profile;
  intent: Intent;
  evidence: Evidence;
  history: ChatCompletionMessageParam[];
  turns: Turn[];
  overrides: PlotOverrides;
  guardHits: GuardHit[];
  /** What the customer is looking at. `seq` bumps when the agent asks for a screen, so the layout navigates. */
  screen: Screen | null;
  screenSeq: number;
  selectedPlot: string | null;
  lastSearch: SearchResult[];
  booking: Booking | null;
  kyc: Kyc | null;
  loan: LoanResult | null;
  trace: TraceEntry[];
  metrics: TurnMetric[];
  startedAt: number | null;
  /** The scripted welcome questions, while they're running. */
  onboarding: { step: number; answers: string[] } | null;
  /** When the "finding the best options" screen went up after the welcome questions. */
  findingSince: number | null;
  /** Projects whose walkthrough films the customer has already watched or skipped. */
  introSeen: string[];
  busy: boolean;
  error: string | null;

  /** Asks the first welcome question. */
  startOnboarding: () => void;
  endFinding: () => void;
  markIntroSeen: (projectId: string) => void;
  setCustomer: (name: string, city?: string) => void;
  send: (text: string | null) => Promise<void>;
  /** Tells the advisor something happened in the app (payment, KYC) and lets it respond. */
  sendEvent: (label: string, detail: string, intent: Intent) => Promise<void>;
  /** Shows what carries over to a human advisor, then asks the Land Advisor to hand off. */
  requestHuman: () => Promise<void>;
  /** Cancels the in-flight turn (barge-in). */
  abort: () => void;
  setScreen: (screen: Screen | null) => void;
  selectPlot: (plotId: string | null) => void;
  setBooking: (booking: Booking | null) => void;
  markPaid: (method: string) => void;
  setKyc: (kyc: Kyc) => void;
  setLoan: (loan: LoanResult) => void;
  reset: () => void;
}

const initial = () => ({
  profile: emptyProfile(),
  intent: "visitor" as Intent,
  evidence: emptyEvidence(),
  history: [] as ChatCompletionMessageParam[],
  turns: [] as Turn[],
  overrides: {} as PlotOverrides,
  guardHits: [] as GuardHit[],
  screen: null as Screen | null,
  screenSeq: 0,
  selectedPlot: null as string | null,
  lastSearch: [] as SearchResult[],
  booking: null as Booking | null,
  kyc: null as Kyc | null,
  loan: null as LoanResult | null,
  trace: [] as TraceEntry[],
  metrics: [] as TurnMetric[],
  startedAt: null as number | null,
  onboarding: null as { step: number; answers: string[] } | null,
  findingSince: null as number | null,
  introSeen: [] as string[],
  busy: false,
  error: null as string | null,
});

export const useSession = create<SessionState>()(
  persist(
    (set, get) => {
      async function runTurn(user: string | null, visible: Turn | null) {
        // A new message while a turn is running replaces that turn.
        if (get().busy) get().abort();
        const { history, profile, intent, evidence, overrides, screen, booking, kyc, loan } = get();
        const controller = new AbortController();
        inflight = controller;
        const turnNo = get().metrics.length + 1;
        const t0 = Date.now();
        set((s) => ({
          busy: true,
          error: null,
          startedAt: s.startedAt ?? t0,
          turns: visible ? [...s.turns, visible] : s.turns,
          metrics: [...s.metrics, { turn: turnNo, startedAt: t0, firstSayMs: null, doneMs: null }],
        }));
        emitAgentEvent({ type: "turn_start" });

        const metric = (patch: Partial<TurnMetric>) =>
          set((s) => ({ metrics: s.metrics.map((m) => (m.turn === turnNo ? { ...m, ...patch } : m)) }));

        try {
          const res = await fetch("/api/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              history,
              user,
              profile,
              intent,
              evidence,
              overrides,
              context: { screen, booking: booking && { ...booking }, kyc: Boolean(kyc), loan: loan && { eligibleAmount: loan.eligibleAmount, rate: loan.rate, sanctioned: Boolean(loan.sanction) } },
            }),
            signal: controller.signal,
          });
          if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);

          for await (const event of readEvents(res.body)) {
            if (controller.signal.aborted) break;
            handle(event);
            emitAgentEvent(event);
          }
          metric({ doneMs: Date.now() - t0 });
        } catch (err) {
          if (!controller.signal.aborted) set({ error: err instanceof Error ? err.message : String(err) });
        } finally {
          if (inflight === controller) {
            inflight = null;
            set({ busy: false });
          }
        }

        function handle(event: AgentEvent) {
          switch (event.type) {
            case "tool_start":
              set((s) => ({
                turns: [...s.turns, { kind: "tool", tool: { id: event.id, name: event.name, pill: null } }],
                trace: [...s.trace, { id: event.id, turn: turnNo, name: event.name, args: event.args, pill: null, ms: null, at: Date.now() }],
              }));
              break;
            case "tool_result":
              set((s) => ({
                turns: s.turns.map((t) => (t.kind === "tool" && t.tool.id === event.id ? { ...t, tool: { ...t.tool, pill: event.pill } } : t)),
                trace: s.trace.map((t) => (t.id === event.id ? { ...t, pill: event.pill, ms: event.ms } : t)),
              }));
              absorbToolResult(event.name, event.result);
              break;
            case "show":
              set((s) => ({
                screen: { view: event.view as Screen["view"], id: event.id },
                screenSeq: s.screenSeq + 1,
                // Any view that names a plot makes it the plot in focus.
                selectedPlot: event.id && /^[a-z]+-\d+$/.test(event.id) ? event.id : s.selectedPlot,
                turns: [...s.turns, { kind: "show", view: event.view, id: event.id }],
              }));
              break;
            case "say":
              if (get().metrics.find((m) => m.turn === turnNo)?.firstSayMs == null) metric({ firstSayMs: Date.now() - t0 });
              break;
            case "guard":
              set((s) => ({ guardHits: [...s.guardHits, { at: Date.now(), action: event.action, violations: event.violations }] }));
              break;
            case "reply":
              set((s) => ({
                profile: event.profile,
                intent: advanceIntent(s.intent, event.intent),
                evidence: event.evidence,
                history: [...s.history, ...event.messages],
                turns: [...s.turns, { kind: "agent", text: event.reply.say, chips: event.reply.chips }],
              }));
              break;
            case "error":
              set({ error: event.message });
              break;
          }
        }
      }

      function absorbToolResult(name: string, result: unknown) {
        const r = result as Record<string, unknown>;
        if (!r || "error" in r) return;
        if (name === "search_projects") set({ lastSearch: r.projects as SearchResult[] });
        if (name === "create_booking") {
          const plot = r.plot as { id: string; plot_no: string; project_id: string; project_name: string; size_sqft: number; price: number };
          set({
            booking: {
              booking_id: r.booking_id as string,
              plot_id: plot.id,
              plot_no: plot.plot_no,
              project_id: plot.project_id,
              project_name: plot.project_name,
              size_sqft: plot.size_sqft,
              price: plot.price,
              token_amount: r.token_amount as number,
              status: "initiated",
            },
            selectedPlot: plot.id,
          });
        }
      }

      return {
        ...initial(),

        setCustomer: (name, city) => set((s) => ({ profile: { ...s.profile, name, city: city ?? null } })),

        reset: () => {
          get().abort();
          set(initial());
          try {
            sessionStorage.removeItem("hoabl-live-seconds");
            sessionStorage.removeItem("hoabl-trail");
          } catch {}
        },

        abort: () => {
          if (!inflight) return;
          inflight.abort();
          inflight = null;
          // The cut-off turn never reaches history; mark it in the transcript.
          set((s) => {
            const turns = [...s.turns];
            for (let i = turns.length - 1; i >= 0; i--) {
              const t = turns[i];
              if (t.kind === "user") {
                turns[i] = { ...t, interrupted: true };
                break;
              }
            }
            return { turns, busy: false };
          });
        },

        startOnboarding: () => {
          const name = get().profile.name ?? null;
          const welcome = intro(name);
          const q = QUESTIONS[0];
          const ask = q.ask(name);
          // The intro first; the first question once the advisor has finished
          // saying it, as a person would. In chat (nothing spoken) it follows a
          // beat later, and it never waits more than 8s for speech to begin.
          const showFirstQuestion = () => {
            const ob = get().onboarding;
            if (!ob || ob.answers.length) return;
            set((s) => ({ turns: [...s.turns, { kind: "agent", text: ask, chips: q.options }] }));
            emitAgentEvent({ type: "say", text: ask });
          };
          let started = false;
          let done = false;
          const finish = (delay: number) => {
            if (done) return;
            done = true;
            off();
            clearTimeout(noSpeech);
            clearTimeout(cap);
            setTimeout(showFirstQuestion, delay);
          };
          const off = onAgentEvent((e) => {
            if (e.type === "speech_start") started = true;
            else if (e.type === "speech_idle" && started) finish(350);
            else if (e.type === "speech_skipped") finish(1200);
          });
          const noSpeech = setTimeout(() => !started && finish(0), 8000);
          const cap = setTimeout(() => finish(0), 40_000);

          set((s) => ({
            onboarding: { step: 0, answers: [] },
            startedAt: s.startedAt ?? Date.now(),
            turns: [...s.turns, { kind: "agent", text: welcome, chips: [] }],
          }));
          emitAgentEvent({ type: "turn_start" });
          emitAgentEvent({ type: "say", text: welcome });
        },

        send: (text) => {
          let ob = get().onboarding;
          // Off the advisor screen, anything that isn't one of the question's
          // options means the customer has moved on: stop the welcome questions
          // and let the Land Advisor handle it.
          if (ob && text !== null && get().screen && !QUESTIONS[ob.answers.length]?.options.includes(text)) {
            set({ onboarding: null });
            ob = null;
          }
          // During the welcome questions, whatever the customer says or taps
          // is the answer; the model isn't involved until all three are in.
          if (ob && text !== null) {
            const answers = [...ob.answers, text];
            const next = QUESTIONS[answers.length];
            set((s) => ({ turns: [...s.turns, { kind: "user", text }] }));
            emitAgentEvent({ type: "turn_start" });
            if (next) {
              const ask = next.ask(get().profile.name ?? null);
              set((s) => ({ onboarding: { step: answers.length, answers }, turns: [...s.turns, { kind: "agent", text: ask, chips: next.options }] }));
              emitAgentEvent({ type: "say", text: ask });
              return Promise.resolve();
            }
            set((s) => ({
              onboarding: null,
              findingSince: Date.now(),
              profile: { ...s.profile, ...profileFrom(answers) },
              intent: advanceIntent(s.intent, "qualified"),
            }));
            return runTurn(handoff(answers), null);
          }
          return runTurn(text, text === null ? null : { kind: "user", text });
        },

        sendEvent: (label, detail, intent) => {
          set((s) => ({ intent: advanceIntent(s.intent, intent) }));
          return runTurn(`[App event] ${detail}`, { kind: "event", label });
        },

        requestHuman: () => {
          const s = get();
          const items: HandoffItem[] = [
            { label: "Buyer profile", done: Boolean(s.profile.purpose || s.profile.budget_max) },
            { label: "Project viewed", done: s.introSeen.length > 0 || s.lastSearch.length > 0 },
            { label: "Plots viewed & shortlisted", done: Boolean(s.selectedPlot) },
            { label: "KYC verified", done: Boolean(s.kyc) },
            { label: "Token payment completed", done: s.booking?.status === "paid" },
          ];
          set((st) => ({ turns: [...st.turns, { kind: "handoff", items }] }));
          return get().send(HUMAN_REQUEST);
        },

        endFinding: () => set({ findingSince: null }),
        markIntroSeen: (projectId) => set((s) => ({ introSeen: s.introSeen.includes(projectId) ? s.introSeen : [...s.introSeen, projectId] })),
        setScreen: (screen) => set({ screen }),
        selectPlot: (plotId) => set({ selectedPlot: plotId }),
        setBooking: (booking) => set({ booking }),

        markPaid: (method) =>
          set((s) =>
            s.booking
              ? {
                  booking: { ...s.booking, status: "paid", method, paidAt: Date.now() },
                  overrides: { ...s.overrides, [s.booking.plot_id]: "held" },
                }
              : {},
          ),

        setKyc: (kyc) => set({ kyc }),
        setLoan: (loan) => set({ loan }),
      };
    },
    {
      name: "hoabl-session",
      storage: createJSONStorage(() => localStorage),
      // busy and error are per-request and shouldn't survive a refresh.
      partialize: (s) => ({
        profile: s.profile,
        intent: s.intent,
        evidence: s.evidence,
        history: s.history,
        turns: s.turns,
        overrides: s.overrides,
        guardHits: s.guardHits,
        screen: s.screen,
        selectedPlot: s.selectedPlot,
        lastSearch: s.lastSearch,
        booking: s.booking,
        kyc: s.kyc,
        loan: s.loan,
        trace: s.trace,
        metrics: s.metrics,
        startedAt: s.startedAt,
        onboarding: s.onboarding,
        introSeen: s.introSeen,
      }),
    },
  ),
);

let inflight: AbortController | null = null;

async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<AgentEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) yield JSON.parse(line) as AgentEvent;
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as AgentEvent;
}

// ---------------------------------------------------------------- live mirror

/** What the console tab sees. Written to localStorage and broadcast on every change. */
export type LiveSnapshot = Pick<
  SessionState,
  "profile" | "intent" | "turns" | "guardHits" | "trace" | "metrics" | "booking" | "kyc" | "loan" | "screen" | "startedAt" | "busy"
> & { avatar?: { status: string; mode: string; liveSeconds: number }; updatedAt: number };

export const LIVE_KEY = "hoabl-live";
export const LIVE_CHANNEL = "hoabl-live";

let extra: LiveSnapshot["avatar"] | undefined;
/** The avatar controller reports its state here so the console can show it. */
export function reportAvatar(avatar: NonNullable<LiveSnapshot["avatar"]>): void {
  extra = avatar;
  publish();
}

let channel: BroadcastChannel | null = null;
let pendingPublish: ReturnType<typeof setTimeout> | undefined;

function publish(): void {
  if (typeof window === "undefined") return;
  clearTimeout(pendingPublish);
  pendingPublish = setTimeout(() => {
    const s = useSession.getState();
    const snap: LiveSnapshot = {
      profile: s.profile,
      intent: s.intent,
      turns: s.turns,
      guardHits: s.guardHits,
      trace: s.trace,
      metrics: s.metrics,
      booking: s.booking,
      kyc: s.kyc,
      loan: s.loan,
      screen: s.screen,
      startedAt: s.startedAt,
      busy: s.busy,
      avatar: extra,
      updatedAt: Date.now(),
    };
    try {
      localStorage.setItem(LIVE_KEY, JSON.stringify(snap));
    } catch {}
    try {
      channel ??= new BroadcastChannel(LIVE_CHANNEL);
      channel.postMessage(snap);
    } catch {}
  }, 150);
}

if (typeof window !== "undefined") useSession.subscribe(publish);
