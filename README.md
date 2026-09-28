# HoABL AI Land Advisor (prototype)

The build brief is in [BUILD.md](BUILD.md).

## Run

```bash
cp .env.example .env.local   # add OPENAI_API_KEY
pnpm install
pnpm dev --port 3100         # open /agent
pnpm test                    # tool, guard and agent-loop tests, no API key needed
```

## Where things are

- `lib/inventory.ts`: three projects and the seeded plot generator. Isle of Anjarle is real and comes from `assets/Anjarle`. Mopa and Samruddhi are illustrative.
- `lib/knowledge.ts`: per-project facts and the objection playbook. Content the source documents don't cover, such as booking and cancellation terms, is written for this POC.
- `lib/agent/tools.ts`: the six tools (strict schemas and handlers).
- `lib/agent/guard.ts`: the return-language and numeric-provenance checks.
- `lib/agent/run.ts`: one turn, which covers the tool loop (up to 4 rounds), the guard, one regeneration and the fallback.
- `app/api/agent/route.ts`: streams NDJSON events: `tool_start`, `tool_result`, `show`, `guard`, `reply`.
- `lib/store.ts`: the client session (Zustand, mirrored to sessionStorage). The server is stateless.
- `lib/agent/say-stream.ts`: releases the spoken reply one sentence at a time. A sentence with a digit waits for its provenance check.
- `lib/avatar/controller.ts`: covers the LiveAvatar session lifecycle (warm during OTP, idle, tab-hide and mode-switch close, and a seamless handover before the sandbox's 60 s cap), auto-reconnect, filler speech and barge-in. If the avatar can't load or keeps dropping, the conversation switches to chat, with a note and a way back.
- `app/api/avatar/token/route.ts`: mints LiveAvatar session tokens. The API key stays on the server.
- `/debug`: the plain Day 1 chat page, for tuning the agent without the avatar.
- `app/(journey)/`: every screen the agent can open. They share one layout (`components/journey/Shell.tsx`), so the avatar, the conversation and the composer stay mounted while screens change. On a screen, the avatar shrinks to a picture-in-picture tile (the same video element) and a dock shows the advisor's latest line.
  - `/plots`: recommendations
  - `/plots/[id]`: project detail
  - `/plots/[id]/map`: plot map
  - `/money/calculator`, `/money/loan`
  - `/booking`, `/booking/kyc`
- `lib/journey.ts`: maps the agent's `show` views to routes and back. The screen the customer is on goes back to the agent as context on every turn.
- `/console`: the presenter view. Open it in a second tab of the same browser and it follows the session live over a BroadcastChannel. It shows the funnel, profile, booking, tool trace, transcript, guardrail hits and avatar video minutes. The landing page links to it.

## Demo rules

- **Intro:** after registration, the Land Advisor introduces HoABL and itself (`intro()` in `lib/onboarding.ts`), then asks the three preset questions.
- **Featured project:** Isle of Anjarle (`FEATURED_PROJECT` in `lib/agent/tools.ts`) is always the top recommendation, whatever the answers. If it's over the customer's budget, the Land Advisor says so and offers the instalment plan and financing.
- **Walkthrough:** a project's films play automatically and muted at the top of its page. The Land Advisor narrates each one from the corner tile, and the voice sets the pace: each film starts when its narration starts, holds on its last frame if the narration runs longer, and moves on about 4 s after the narration ends (`components/journey/FilmStrip.tsx`, using `avatar.narrate()`, which matches the avatar's speech events by id). There's no Skip and no on-screen transcript.

- **Voice follows the screen:** when the customer opens a screen themselves, the Land Advisor stops talking about the last screen, drops any reply still arriving about it, and says a short scripted line about the new one (`lib/avatar/screen-lines.ts`, built from app data). When the advisor opened the screen, or a tap there asked it something, its own reply covers it. Tapping a plot on the map gets its facts read out. The property page's films stop narrating as soon as the customer leaves.
- **Back** always returns to the screen the customer was actually on before, whether they got there by a tap, a chip or the Land Advisor opening it. The shell keeps a trail of visited screens in sessionStorage, so this survives a refresh and stays in step with the phone's own back. With no earlier screen, as when a screen is opened by its link, Back goes up a level: map → project → recommendations, and loan → KYC → booking → plot map.
- **No Land Advisor strip** on the recommendations, property, plot map, booking, KYC and loan screens; the chips and input stay.

## Demo script (BUILD.md §10)

1. Register, then get greeted by name.
2. Say "investment, around 40 to 50 lakh, drive from Mumbai". The Recommendations screen opens on its own.
3. Ask "which has better connectivity?", then "the 2,000 sq ft options at Anjarle", then "which is closest to the entrance?".
4. Say "this feels expensive". The advisor offers a smaller plot, highlights it on the map, and suggests the instalment plan or financing.
5. Ask for the EMI. The calculator opens.
6. Say "I want to book this". The Booking screen opens. Pay in the sandbox.
7. Say yes to KYC, then check loan eligibility and get the in-principle sanction.
8. Open `/console`. The session sits at "Loan processing".

Payment, KYC and the loan tell the advisor what happened through `[App event]` turns, which show in the transcript as system lines. The advisor responds and guides the next step. No Aadhaar number is ever asked for, and only a masked PAN is stored.

## Avatar (LiveAvatar)

HeyGen's streaming-avatar SDK is deprecated, and its API now returns 404. The avatar runs on HeyGen's successor, LiveAvatar (`@heygen/liveavatar-web-sdk`).

- **Key:** `HEYGEN_API_KEY` must be a LiveAvatar key from app.liveavatar.com/developers. A HeyGen video key won't work.
- **Sessions:** the app uses FULL mode with no context attached, which LiveAvatar calls "restricted mode". Its LLM never replies. It does voice activity detection and transcription, and speaks what we send with `repeat()`, the equivalent of BUILD.md's REPEAT. Our agent and guardrails produce every word.
- **Sandbox:** `HEYGEN_SANDBOX=true` gives free sessions with the "Wayne" avatar, capped at 60 s. The app reconnects on demand when a session ends. Set it to `false` once the account has credits (2 credits a minute). The configured avatar is Anthony, in portrait framing.
- **Chat only:** set `NEXT_PUBLIC_AVATAR_MODE` to anything other than `heygen` to ship without the live avatar.
- **Modes:** Avatar is full screen, live-stream style. Chat is the transcript. Minimising either one shows the app screens, with the avatar as a tile in the corner or the advisor's latest line docked above the input.

## Where the demo departs from the source documents

- The payment terms follow BUILD.md: a ₹45,000 token, then 20/40/40. Anjarle's real terms are a ₹99,000 EOI and a milestone schedule.
- Prices are set so every budget bracket in the welcome question (< ₹20L, ₹20–35L, ₹35–50L, > ₹50L) has at least two available plots in every project. Anjarle keeps its four real configurations at their real list prices and adds two demo-only sizes at the same rate: 600 sq ft (about ₹17.7L) and 1,000 sq ft (about ₹29.5L). Its 1,367 and 1,506 sq ft configurations are sold out in reality; the demo keeps some available. A test checks that every bracket stays covered.
- Booking and cancellation terms are written for the POC, as are all facts about Mopa and Samruddhi.

`assets/` (1.6 GB) is git- and Vercel-ignored. Web-sized images are in `public/projects/anjarle/`.
