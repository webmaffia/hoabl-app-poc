// Avatar controller: owns the LiveAvatar session and turns agent events into
// speech. If the live avatar can't run, the conversation carries on in chat.
//
// The conversation lives in the session store, never here, so a dropped or
// closed avatar session loses nothing. Rules from BUILD.md §8:
// - warm the session during OTP; close it on idle (60s), tab hide and modality
//   switch, because billing runs per minute of session, not of speech
// - on repeated disconnects (three in a minute) or no stream within 20s, fall back to chat
//   with a note and a way back to the avatar
// - barge-in: when the customer starts speaking, interrupt, flush and abort the turn
// - filler speech the instant a tool call starts

"use client";

import { create } from "zustand";
import type { LiveAvatarSession } from "@heygen/liveavatar-web-sdk";
import { emitAgentEvent, onAgentEvent } from "@/lib/bus";
import { fillerFor } from "@/lib/avatar/filler";
import { forSpeech } from "@/lib/avatar/spoken";
import { reportAvatar } from "@/lib/store";

export type Mode = "avatar" | "chat";
/** off: no session. connecting/live: LiveAvatar. sleeping: closed to save minutes, reopens on demand. fallback: the avatar failed, so we're in chat. */
export type Status = "off" | "connecting" | "live" | "sleeping" | "fallback";

export interface AvatarUI {
  mode: Mode;
  status: Status;
  speaking: boolean;
  listening: boolean;
  interim: string;
  note: string | null;
  sandbox: boolean;
  liveEnabled: boolean;
}

const LIVE_ENABLED = process.env.NEXT_PUBLIC_AVATAR_MODE === "heygen";
// LiveAvatar connects in 2–14s depending on load. A slow connect isn't a
// failure (the screen says "Reconnecting…"); give up only after this long.
const READY_TIMEOUT_MS = 20_000;
const IDLE_MS = 60_000;

export const useAvatar = create<AvatarUI>(() => ({
  // Without the live avatar there's only chat.
  mode: LIVE_ENABLED ? "avatar" : "chat",
  status: LIVE_ENABLED ? "off" : "fallback",
  speaking: false,
  listening: false,
  interim: "",
  note: null,
  sandbox: false,
  liveEnabled: LIVE_ENABLED,
}));

const get = useAvatar.getState;
const set = useAvatar.setState;

// ---------------------------------------------------------------- state

/** One LiveAvatar session. There's a primary, and briefly a standby during handover. */
interface Live {
  s: LiveAvatarSession;
  gen: number;
  /** Stream up and start() resolved. The stream can report ready slightly
   *  before the session counts as connected, and repeat() fails until it does. */
  ready: boolean;
  streamReady: boolean;
  started: boolean;
  startMic: ((config?: { defaultMuted?: boolean }) => Promise<void>) | null;
}

let primary: Live | null = null;
let standby: Live | null = null;
let seq = 0; // allocates session generations
let current = 0; // generation of the primary; events from any other session are ignored
let connecting: Promise<void> | null = null;
let pending: string[] = []; // sentences waiting for the stream to come up
let video: HTMLVideoElement | null = null;
let liveSpeaking = 0;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let rotateTimer: ReturnType<typeof setTimeout> | undefined;
let keepAlive: ReturnType<typeof setInterval> | undefined;
let fillerThisTurn = false;
let drops: number[] = []; // timestamps of unexpected drops, for the give-up rule

/** A line whose start and end someone is waiting on (the film walkthrough). */
interface Narration {
  id: string | null; // repeat() event id, matched against source_event_id
  started: boolean;
  onStart: () => void;
  onEnd: () => void;
}
let narration: Narration | null = null;

let sendText: (text: string) => void = () => {};
let abortTurn: () => void = () => {};

let t0 = 0;
const trace = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") console.info(`[avatar +${Date.now() - t0}ms]`, ...args);
};

const ready = () => Boolean(primary?.ready);
const usesLive = () => LIVE_ENABLED && get().mode === "avatar" && get().status !== "fallback";
const refreshSpeaking = () => set({ speaking: liveSpeaking > 0 });

// Sandbox sessions end at 60s. Start a standby at 40s and swap at the next
// pause, so the customer never sees the cut.
const SANDBOX_ROTATE_MS = 40_000;
const SANDBOX_FORCE_SWAP_MS = 54_000;

// ---------------------------------------------------------------- lifecycle

async function openSession(gen: number, role: "primary" | "standby"): Promise<Live> {
  const res = await fetch("/api/avatar/token", { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `token ${res.status}`);
  set({ sandbox: Boolean(body.sandbox) });

  const sdk = await import("@heygen/liveavatar-web-sdk");
  // Our own keep-alive stops with the session; the SDK's keeps pinging a
  // closed session and logs errors.
  const s = new sdk.LiveAvatarSession(body.session_token, { voiceChat: { defaultMuted: true }, autoKeepAlive: false });
  const live: Live = { s, gen, ready: false, streamReady: false, started: false, startMic: s.voiceChat.start.bind(s.voiceChat) };
  // SDK 0.0.19 always opens the microphone at connect, which puts a permission
  // prompt on the OTP screen and can stall the connect where capture is
  // blocked. Defer it: the real start runs on the first mic tap.
  s.voiceChat.start = async () => {};

  const active = () => gen === current;
  let stopReason = "";

  const markReady = () => {
    if (live.ready || !live.streamReady || !live.started) return;
    live.ready = true;
    if (role === "primary" && active()) onPrimaryReady(live);
    if (role === "standby" && standby === live) tryPromote();
  };

  s.on(sdk.SessionEvent.SESSION_STREAM_READY, () => {
    live.streamReady = true;
    trace("stream ready", { gen, role });
    markReady();
  });
  s.on(sdk.AgentEventsEnum.SESSION_STOPPED, (e) => {
    const ev = e as { stop_reason?: string; end_reason?: string }; // docs: end_reason; types: stop_reason
    stopReason = ev.end_reason ?? ev.stop_reason ?? "";
    trace("stopped", { gen, stopReason });
    if (active()) onPrimaryDrop(stopReason);
    else if (standby === live) standby = null;
  });
  s.on(sdk.SessionEvent.SESSION_DISCONNECTED, (reason) => {
    if (reason === sdk.SessionDisconnectReason.CLIENT_INITIATED) return;
    trace("disconnected", { gen, reason, stopReason });
    if (active()) onPrimaryDrop(stopReason || String(reason));
    else if (standby === live) standby = null;
  });
  // A narration matches its own events by id; if the server leaves the id
  // out, the next start/end after the line is sent counts.
  const isNarration = (e: { source_event_id?: string }) => narration && (!e.source_event_id || !narration.id || e.source_event_id === narration.id);
  s.on(sdk.AgentEventsEnum.AVATAR_SPEAK_STARTED, (e) => {
    if (!active()) return;
    liveSpeaking++;
    refreshSpeaking();
    emitAgentEvent({ type: "speech_start" });
    if (narration && !narration.started && isNarration(e)) {
      trace("narration start", { id: narration.id, source: e.source_event_id });
      narration.started = true;
      narration.onStart();
    }
  });
  s.on(sdk.AgentEventsEnum.AVATAR_SPEAK_ENDED, (e) => {
    if (!active()) return;
    liveSpeaking = Math.max(0, liveSpeaking - 1);
    refreshSpeaking();
    touch();
    if (liveSpeaking === 0 && pending.length === 0) emitAgentEvent({ type: "speech_idle" });
    if (narration?.started && isNarration(e)) {
      trace("narration end", { id: narration.id, source: e.source_event_id });
      const n = narration;
      narration = null;
      n.onEnd();
    }
  });
  s.on(sdk.AgentEventsEnum.USER_SPEAK_STARTED, () => {
    if (!active()) return;
    touch();
    bargeIn();
  });
  s.on(sdk.AgentEventsEnum.USER_TRANSCRIPTION_CHUNK, (e) => {
    if (active()) set({ interim: e.text });
  });
  s.on(sdk.AgentEventsEnum.USER_TRANSCRIPTION, (e) => {
    if (!active()) return;
    set({ interim: "" });
    if (e.text?.trim()) sendText(e.text.trim());
  });

  await s.start();
  trace("start() resolved", { gen, role });
  live.started = true;
  markReady();
  return live;
}

async function warm(): Promise<void> {
  if (!usesLive()) return;
  if (ready() || connecting) return connecting ?? undefined;

  const gen = ++seq;
  current = gen;
  t0 = Date.now();
  trace("warm", { gen });
  set({ status: "connecting", note: null });
  const readyTimer = setTimeout(() => {
    if (gen === current && !ready()) onPrimaryDrop("no stream after 20s");
  }, READY_TIMEOUT_MS);

  connecting = (async () => {
    try {
      const live = await openSession(gen, "primary");
      if (gen !== current) {
        live.s.stop().catch(() => {});
        return;
      }
      primary = live;
      if (live.ready) onPrimaryReady(live);
    } catch (err) {
      if (gen !== current) return;
      console.warn("[avatar] live session failed", err);
      onPrimaryDrop("failed to start");
    } finally {
      clearTimeout(readyTimer);
      if (gen === current) connecting = null;
    }
  })();
  return connecting;
}

let announced: Live | null = null;

function onPrimaryReady(live: Live, opts: { promoted?: boolean } = {}): void {
  // Stream-ready can fire before start() resolves; announce each session once.
  if (announced === live) return;
  announced = live;
  if (!primary) primary = live;
  if (video) attachVideo(video);
  set({ status: "live", note: null });
  clearInterval(keepAlive);
  keepAlive = setInterval(() => {
    if (primary === live) live.s.keepAlive().catch(() => {});
  }, 45_000);
  scheduleRotation();
  const queued = pending;
  pending = [];
  queued.forEach(speak);
  // A handover isn't customer activity; it mustn't keep an idle session alive.
  if (!opts.promoted) touch();
}

function scheduleRotation(): void {
  clearTimeout(rotateTimer);
  if (!get().sandbox) return;
  const born = Date.now();
  rotateTimer = setTimeout(() => void startStandby(born), SANDBOX_ROTATE_MS);
}

async function startStandby(born: number): Promise<void> {
  if (!primary || standby || !usesLive()) return;
  // Nobody has done anything for a while: let the idle close happen instead.
  if (Date.now() - lastActivity > 40_000) return;
  const gen = ++seq;
  trace("standby", { gen });
  try {
    const live = await openSession(gen, "standby");
    if (!primary) {
      live.s.stop().catch(() => {});
      return;
    }
    standby = live;
    if (live.ready) tryPromote(born);
  } catch (err) {
    trace("standby failed", err);
    standby = null;
  }
}

/** Swap to the standby once the avatar pauses, or at the deadline regardless. */
function tryPromote(born = Date.now() - SANDBOX_ROTATE_MS): void {
  const next = standby;
  if (!next?.ready) return;
  const quiet = liveSpeaking === 0 && pending.length === 0;
  if (!quiet && Date.now() - born < SANDBOX_FORCE_SWAP_MS) {
    setTimeout(() => tryPromote(born), 250);
    return;
  }
  const old = primary;
  const wasListening = get().listening;
  current = next.gen;
  primary = next;
  standby = null;
  liveSpeaking = 0;
  refreshSpeaking();
  trace("promoted", { gen: next.gen });
  if (video) attachVideo(video);
  if (old) old.s.stop().catch(() => {});
  if (wasListening && next.startMic) next.startMic({ defaultMuted: false }).catch(() => set({ listening: false }));
  onPrimaryReady(next, { promoted: true });
}

/** The primary ended. Hand over to a ready standby, reconnect, or fall back. */
function onPrimaryDrop(reason: string): void {
  if (standby?.ready) {
    trace("drop → standby", reason);
    tryPromote(0);
    return;
  }
  const expected = /IDLE|MAX_DURATION/i.test(reason);
  closeLive();
  if (expected) {
    set({ status: "sleeping", listening: false, interim: "" });
    if (pending.length) void warm();
    return;
  }
  // A background tab just pauses; it reconnects when it's visible again.
  if (document.hidden) {
    set({ status: "sleeping", listening: false, interim: "" });
    return;
  }
  const now = Date.now();
  drops = [...drops.filter((t) => now - t < 60_000), now];
  // Up to two reconnects a minute before settling on chat.
  if (drops.length <= 2 && usesLive() && navigator.onLine) {
    trace("drop → reconnect", reason);
    set({ status: "off" });
    void warm();
    return;
  }
  fallback("The video advisor couldn't stay connected, so we've switched to chat. Nothing is lost.");
}

/** Closes the live sessions without changing the engine. */
function closeLive(): void {
  if (primary || standby) trace("close", { gen: current });
  clearInterval(keepAlive);
  clearTimeout(rotateTimer);
  current = ++seq;
  const sessions = [primary, standby];
  primary = null;
  standby = null;
  connecting = null;
  liveSpeaking = 0;
  refreshSpeaking();
  sessions.forEach((l) => l?.s.stop().catch(() => {}));
}

function sleep(status: "sleeping" | "off"): void {
  closeLive();
  set({ status, listening: false, interim: "" });
}

/** The avatar can't run: carry on in chat. Everything said is already in the transcript. */
function fallback(note: string): void {
  trace("fallback:", note);
  closeLive();
  pending = [];
  set({ status: "fallback", mode: "chat", note, listening: false, interim: "" });
}

let lastActivity = Date.now();

function touch(): void {
  lastActivity = Date.now();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    // Close even with the mic open: a customer thinking in silence costs the
    // same per minute as one talking.
    if (ready() && liveSpeaking === 0) sleep("sleeping");
  }, IDLE_MS);
}

function attachVideo(el: HTMLVideoElement): void {
  if (!primary?.ready) return;
  primary.s.attach(el);
  el.muted = false;
  el.play().catch(() => {});
}

// ---------------------------------------------------------------- speech

function speak(text: string): void {
  if (!usesLive()) {
    emitAgentEvent({ type: "speech_skipped" }); // chat: the transcript is the reply
    return;
  }
  touch();
  if (primary?.ready) {
    try {
      primary.s.repeat(forSpeech(text));
      return;
    } catch {
      // Only a session that has actually ended counts as a drop; one that's
      // still settling just queues the line.
      const state = String(primary.s.state);
      pending.push(text);
      if (state === "DISCONNECTED" || state === "INACTIVE") onPrimaryDrop("repeat failed");
      else setTimeout(flushPending, 400);
      return;
    }
  }
  pending.push(text);
  void warm();
}

function flushPending(): void {
  const queued = pending;
  pending = [];
  queued.forEach(speak);
}

function interrupt(): void {
  pending = [];
  if (primary?.ready) {
    try {
      primary.s.interrupt();
    } catch {}
  }
  liveSpeaking = 0;
  refreshSpeaking();
}

/** The customer started talking: stop speaking, flush, and abort the in-flight turn. */
function bargeIn(): void {
  if (get().speaking || pending.length) interrupt();
  abortTurn();
}

// Live-video seconds, for the console's cost line (BUILD.md §12: measure
// streamed minutes rather than assume them).
// Kept in sessionStorage so a refresh mid-demo doesn't reset the count.
let liveSeconds = readLiveSeconds();
let liveSince: number | null = null;

function readLiveSeconds(): number {
  try {
    return Number(sessionStorage.getItem("hoabl-live-seconds")) || 0;
  } catch {
    return 0;
  }
}

function saveLiveSeconds(total: number): void {
  try {
    sessionStorage.setItem("hoabl-live-seconds", String(Math.round(total)));
  } catch {}
}
const unsubscribeReport = useAvatar.subscribe((state, prev) => {
  if (state.status === "live" && prev.status !== "live") liveSince = Date.now();
  if (state.status !== "live" && prev.status === "live" && liveSince) {
    liveSeconds += (Date.now() - liveSince) / 1000;
    liveSince = null;
  }
  if (state.status !== prev.status || state.mode !== prev.mode) {
    reportAvatar({ status: state.status, mode: state.mode, liveSeconds: Math.round(liveSeconds) });
  }
});
const reportTimer = typeof window !== "undefined"
  ? setInterval(() => {
      const current = liveSeconds + (liveSince ? (Date.now() - liveSince) / 1000 : 0);
      saveLiveSeconds(current);
      reportAvatar({ status: get().status, mode: get().mode, liveSeconds: Math.round(current) });
    }, 5000)
  : undefined;

// Hot reload re-runs this module; close the previous instance's session and
// listeners so dev never has two controllers (and two billed sessions).
const hot = globalThis as unknown as { __avatarDispose?: () => void };
hot.__avatarDispose?.();

const unsubscribe = onAgentEvent((event) => {
  switch (event.type) {
    case "turn_start":
      fillerThisTurn = false;
      touch();
      // Reopen a paused avatar while the model thinks, not when the reply lands.
      if (usesLive() && !ready() && !connecting) void warm();
      break;
    case "tool_start": {
      if (fillerThisTurn || get().speaking) break;
      const line = fillerFor(event.name);
      if (line) {
        fillerThisTurn = true;
        speak(line);
      }
      break;
    }
    case "say":
      speak(event.text);
      break;
    case "retract":
      interrupt();
      break;
  }
});

// ---------------------------------------------------------------- mic

async function toggleMic(): Promise<void> {
  const { listening } = get();
  if (usesLive() && (ready() || connecting)) {
    // LiveAvatar's own voice chat: VAD and transcription on their side.
    if (!ready()) await connecting;
    const live = primary;
    if (!live?.ready) return toggleMic(); // fell back while connecting
    const s = live.s;
    if (listening) {
      await s.voiceChat.mute();
      set({ listening: false, interim: "" });
    } else {
      bargeIn();
      try {
        if (s.voiceChat.state === "ACTIVE") await s.voiceChat.unmute();
        else if (live.startMic) await live.startMic({ defaultMuted: false });
      } catch {
        set({ note: "Microphone access is blocked. Allow it in the browser, or type instead." });
        return;
      }
      set({ listening: true });
      touch();
    }
    return;
  }
  // Paused or not up yet: start it; the next tap talks.
  void warm();
}

// ---------------------------------------------------------------- public API

export const avatar = {
  /** Connects the controller to the conversation store. */
  bind(handlers: { send: (text: string) => void; abort: () => void }): void {
    sendText = handlers.send;
    abortTurn = handlers.abort;
  },

  warm,
  speak,
  interrupt,
  bargeIn,
  toggleMic,

  attach(el: HTMLVideoElement | null): void {
    video = el;
    if (el) attachVideo(el);
  },

  setMode(mode: Mode): void {
    const prev = get().mode;
    if (prev === mode) return;
    interrupt();
    set({ mode, listening: false, interim: "" });
    if (mode === "avatar") {
      drops = [];
      set({ status: "off", note: null });
      void warm();
    } else if (primary || connecting) {
      // Switching away closes the live session: a minute of chat shouldn't
      // be billed as a minute of video.
      sleep("off");
    }
  },

  /** After a fallback, try the live avatar again. */
  retryLive(): void {
    if (!LIVE_ENABLED) return;
    avatar.setMode("avatar");
  },

  clearNote(): void {
    set({ note: null });
  },

  shutdown(): void {
    interrupt();
    if (primary || connecting) sleep("off");
  },

  /**
   * Speaks one line and reports when it actually starts and ends, so what's
   * on screen can follow the voice. Falls back to reading-speed timing when
   * the avatar isn't live, or if it never reports back. Returns a cancel.
   */
  narrate(text: string, handlers: { onStart: () => void; onEnd: () => void }): () => void {
    let cancelled = false;
    let started = false;
    let ended = false;
    const estimateMs = Math.max(3500, (text.split(/\s+/).length / 2.6) * 1000);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const start = () => {
      if (cancelled || started) return;
      started = true;
      handlers.onStart();
      // Safety net: if the end event never comes, finish at a generous estimate.
      timers.push(setTimeout(end, estimateMs * 1.6 + 3000));
    };
    const end = () => {
      if (cancelled || ended) return;
      if (!started) start();
      ended = true;
      timers.forEach(clearTimeout);
      handlers.onEnd();
    };

    interrupt();
    narration = null;
    if (!usesLive()) {
      // Chat: nothing is spoken, so the caption reads at speaking pace.
      start();
      timers.push(setTimeout(end, estimateMs));
    } else {
      const say = () => {
        if (cancelled) return;
        if (!primary?.ready) return false;
        narration = { id: null, started: false, onStart: start, onEnd: end };
        try {
          narration.id = primary.s.repeat(forSpeech(text));
          touch();
        } catch {
          narration = null;
          return false;
        }
        return true;
      };
      // A cold avatar (paused, or still connecting) needs several seconds to
      // come up; the first film waits for it rather than playing in silence.
      const waitMs = primary?.ready ? 6000 : READY_TIMEOUT_MS + 2000;
      if (!say()) {
        // Not connected yet: reconnect and send the line as soon as it's up.
        void warm();
        const poll = setInterval(() => {
          if (cancelled) return clearInterval(poll);
          if (say()) return clearInterval(poll);
          if (!usesLive()) {
            // The avatar gave up and fell back to chat: read at speaking pace.
            clearInterval(poll);
            start();
            timers.push(setTimeout(end, estimateMs));
          }
        }, 250);
        timers.push(poll as unknown as ReturnType<typeof setTimeout>);
      }
      // If the voice still hasn't started, don't hold the films hostage.
      timers.push(setTimeout(() => !started && start(), waitMs));
      timers.push(setTimeout(() => !ended && started && end(), waitMs + estimateMs * 1.6 + 3000));
    }

    return () => {
      cancelled = true;
      timers.forEach((t) => {
        clearTimeout(t);
        clearInterval(t as unknown as ReturnType<typeof setInterval>);
      });
      if (narration?.onEnd === end) narration = null;
    };
  },

  /** The customer is about to say something: reopen a paused avatar now. */
  wake(): void {
    if (!usesLive()) return;
    if (ready()) touch(); // activity keeps a live session open
    else if (!connecting) void warm();
  },
};

// Tab hidden: close the session (it bills per minute). Visible again: reopen.
function onVisibility(): void {
  if (document.hidden) {
    interrupt();
    if (primary || connecting) sleep("sleeping");
  } else if (get().mode === "avatar" && get().status === "sleeping") {
    void warm();
  }
}

function onOffline(): void {
  if (primary || connecting) fallback("You seem to be offline, so we've switched to chat. Nothing is lost.");
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("offline", onOffline);
}

hot.__avatarDispose = () => {
  unsubscribe();
  unsubscribeReport();
  clearInterval(reportTimer);
  avatar.shutdown();
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("offline", onOffline);
  }
};
