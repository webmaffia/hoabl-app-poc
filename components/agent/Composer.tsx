"use client";

import { useState } from "react";
import { avatar, useAvatar } from "@/lib/avatar/controller";
import { MicIcon, SendIcon, StopIcon } from "@/components/icons";

/**
 * The input bar. `overlay` is the live-stream look: it floats over the
 * full-screen avatar with glass chips and a pill input.
 */
export function Composer({
  chips,
  busy,
  onSend,
  overlay = false,
  leadChip = false,
}: {
  chips: string[];
  busy: boolean;
  onSend: (text: string) => void;
  overlay?: boolean;
  /** Style the first chip as the gold next step. */
  leadChip?: boolean;
}) {
  const { mode, listening, speaking } = useAvatar();
  const [text, setText] = useState("");

  const submit = (value: string) => {
    const v = value.trim();
    if (!v) return;
    setText("");
    avatar.bargeIn();
    onSend(v);
  };

  // Same glass look on every screen; only the wrapper differs (floating over
  // the avatar vs. a bar under the app screens).
  const s = {
    wrap: overlay ? "shrink-0 px-3 pb-3 pt-1" : "shrink-0 border-t border-line bg-black/40 px-3 pb-3 pt-2.5 backdrop-blur",
    chip: "border border-white/35 bg-white/15 text-white backdrop-blur-md active:bg-white/25",
    input: "rounded-full border border-white/45 bg-black/25 text-white placeholder:text-white/75 backdrop-blur-md focus:border-white/80",
    send: "bg-gold text-site",
    mic: listening ? "bg-gold text-site" : speaking ? "bg-white text-site" : "bg-white/20 text-white border border-white/45 backdrop-blur-md",
  };

  return (
    <div className={s.wrap}>
      {chips.length > 0 && !busy && (
        <div className="-mx-3 mb-2.5 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none]">
          {chips.map((c, i) => (
            <button
              key={c}
              onClick={() => submit(c)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-[13.5px] ${leadChip && i === 0 ? "bg-gold font-semibold text-site shadow-md" : `font-medium ${s.chip}`}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <textarea
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            avatar.wake();
          }}
          onFocus={() => avatar.wake()}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(text);
            }
          }}
          placeholder={mode === "chat" ? "Type your message" : "Ask your advisor…"}
          className={`max-h-28 min-h-11 flex-1 resize-none px-4 py-2.5 text-[15px] leading-snug outline-none ${s.input}`}
        />
        {text.trim() ? (
          <button type="submit" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${s.send}`} aria-label="Send">
            <SendIcon className="h-5 w-5" />
          </button>
        ) : mode !== "chat" ? (
          <button
            type="button"
            onClick={() => (speaking && !listening ? avatar.interrupt() : void avatar.toggleMic())}
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${s.mic}`}
            aria-label={listening ? "Stop listening" : speaking ? "Stop the advisor" : "Talk"}
          >
            {listening && <span className="pulse-ring absolute inset-0 rounded-full bg-[#d6a24a]" />}
            {speaking && !listening ? <StopIcon className="relative h-5 w-5" /> : <MicIcon className="relative h-5 w-5" />}
          </button>
        ) : null}
      </form>

    </div>
  );
}
