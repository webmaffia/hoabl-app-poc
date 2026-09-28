# BUILD.md — AI Land Sales Agent, 4-Day Demo

Definitive build brief. Self-contained — supersedes the earlier spec and demo files.

**What this is:** a mobile web app where an AI avatar sells land plots. It profiles a customer in conversation, recommends from real inventory, answers plot-level questions, handles objections, takes a ₹45,000 token payment, runs KYC and checks loan eligibility. End to end, no human.

**Who it's for:** a real-estate client evaluating whether AI can replace the first eight calls their sales team makes.

---

## 0. Decisions already made

Do not relitigate these during the build.

| Decision | Choice | Why |
| --- | --- | --- |
| Avatar | HeyGen streaming, **stock avatar** | Photoreal makes the client believe it's real in three seconds. Custom filming adds a shoot and a likeness licence for no demo value. |
| Agent brain | OpenAI, function calling | Ours, behind our guardrails. Never HeyGen's `TALK`. |
| Language | English only | Hindi lip sync is the most likely thing to look wrong and can't be fixed in four days. |
| Fallback | SVG avatar, built day 1 | Debug the journey without WebRTC in the way. A bad HeyGen day then costs the avatar, not the demo. |
| Persistence | In-memory + `sessionStorage` | No database. Four days. |
| Integrations | OTP, payment, KYC, loan all mocked | Visibly labelled in the UI. |

**Real:** the agent's reasoning, tool calling, inventory, plot-level data, guardrails, the avatar stream.
**Faked:** OTP, payment, KYC, loan, persistence.
**Not built:** Postgres, vector retrieval, follow-up scheduling, multi-session console, real auth, cross-device state.

If a feature isn't in the demo run-through (§10), don't build it.

---

## 1. Stack

Next.js App Router + TypeScript + Tailwind. Zustand for session state, mirrored to `sessionStorage` so a refresh mid-demo doesn't lose the room. OpenAI for the agent. `@heygen/streaming-avatar` for the avatar. Vercel.

```
OPENAI_API_KEY=
OPENAI_MODEL=                    # pin the current fast model
HEYGEN_API_KEY=                  # server only, never shipped to the browser
HEYGEN_AVATAR_ID=
HEYGEN_VOICE_ID=
NEXT_PUBLIC_AVATAR_MODE=svg      # flip to heygen on day 2
```

**Before day 2, paste the current HeyGen SDK docs and OpenAI function-calling docs into context.** Both surfaces move faster than any model's training data, and writing confidently against a stale API shape is the single most likely way to lose half a day.

```
app/
  page.tsx                 landing
  register/                name, mobile, OTP
  agent/                   the spine — avatar, voice, chat
  plots/                   recommendations, project detail, plot map
  money/                   calculator, loan
  booking/                 summary, payment, confirmation, kyc
  console/                 funnel + live session
  api/agent/route.ts       streaming turn + tool loop
  api/avatar/token/route.ts
lib/
  inventory.ts             projects + seeded plot generator
  knowledge.ts             policies, FAQs, objection playbook
  agent/prompt.ts
  agent/tools.ts
  agent/guard.ts
  avatar/heygen.ts         session lifecycle, speak queue, barge-in
  avatar/svg.tsx           fallback avatar
  store.ts
```

---

## 2. Day plan

Feed this to Claude Code one day at a time. Handing over all four at once produces a half-finished version of everything.

### Day 1 — Inventory and a working agent, no avatar

`lib/inventory.ts`, `lib/knowledge.ts`, six tool handlers with tests, `POST /api/agent` with the OpenAI tool loop, and a plain unstyled chat page.

**Done when:** you type "investment, around 45 lakh, near Mumbai" into an ugly textarea and get back a real shortlist with plot counts, having watched the tool calls fire in the server log.

Don't touch the avatar. Don't style anything.

### Day 2 — HeyGen, modalities, filler speech

Token proxy. Session warm-up during OTP. `REPEAT` speak with sentence chunking. Filler speech on tool calls (§8). Barge-in. Idle close. Disconnect fallback to the SVG avatar. Avatar / voice / chat on shared state. Landing and registration screens.

**Done when:** the avatar greets you by name, you interrupt mid-sentence and it stops, you switch to chat and the conversation is intact, you kill wifi and it degrades to the SVG avatar without losing state.

This is the day that can eat itself. If it does, stay on `svg` and move on — you still have a demo.

### Day 3 — The journey

Recommendations, project detail, plot map, calculator, booking summary, payment mock, confirmation, KYC, loan eligibility and mock sanction.

**Done when:** you can walk the whole journey without touching the URL bar.

### Day 4 — Console, tuning, rehearsal

Console funnel with the live session. Conversation tuning. Rehearsal on a throttled connection.

**Reserve the afternoon for tuning.** The agent sounding like a consultant rather than a bot is what's actually being evaluated. This is not polish.

---

## 3. Inventory

`lib/inventory.ts`. Deterministic and seeded, so every demo run is identical.

| Project | id | Location | ₹/sq ft | Sizes (sq ft) | Plots |
| --- | --- | --- | --- | --- | --- |
| Alibaug Coastal Reserve | `alibaug` | Raigad, Maharashtra | 4,200 | 1000, 1500, 2000, 3000 | 16 |
| Mopa Airport Hinterland | `mopa` | Pernem, North Goa | 3,600 | 1200, 1800, 2400, 3600 | 14 |
| Samruddhi Logistics Belt | `nagpur` | Nagpur, Maharashtra | 1,450 | 1500, 2000, 3000, 5000 | 12 |

Entry tickets ₹42 L, ₹43.2 L, ₹21.75 L. Inventory **must** exist in the ₹40–50 L band — the demo script uses that budget.

Per project: `cagr` range as text, `hold` years, `rera_no`, `hook` (one sentence on why this corridor), `connectivity` (five label + distance pairs), `features` (four bullets), `cols`, `entranceRow`, `entranceCol`.

Plot generator, seeded per project, 4 columns:

```ts
metresFromEntrance = (|col - entranceCol| + |row - entranceRow|) * 22 + 40
multiplier = 1 + (isCorner ? 0.06 : 0) + (isParkFacing ? 0.04 : 0)
               - (metresFromEntrance > 200 ? 0.03 : 0)
price = round(sizeSqft * ratePerSqft * multiplier, -3)
status: ~35% sold, ~10% held, rest available
```

Plot fields: `id`, `plotNo` (`AC-07`), `sizeSqft`, `facing`, `roadWidthM`, `gridRow`, `gridCol`, `isCorner`, `isParkFacing`, `metresFromEntrance`, `price`, `status`.

Sold plots stay visible on the map — scarcity is part of the pitch.

This data is what makes "which plot is closest to the entrance" answerable. Without plot rows, the best demo beats have nothing behind them.

---

## 4. Knowledge

`lib/knowledge.ts`. Plain objects, no embeddings — at three projects the corpus fits in the prompt and vector search buys nothing.

Per project: payment plan, booking and cancellation policy, title and approval status, development timeline, amenities, area infrastructure.

Objection playbook, retrieved through `get_knowledge`:

| Key | Approved response shape |
| --- | --- |
| `why_here` | Corridor facts, infrastructure timeline, what the developer has delivered |
| `price` | Smaller sizes, instalment plan, financing — never a discount |
| `consult_spouse` | Offer a summary, schedule a follow-up |
| `asset_class` | Approved comparison, explicit that returns aren't guaranteed |
| `finance` | Eligibility flow, indicative rates, in-principle only |
| `stall` | Capture the reason, offer a follow-up, no pressure |

---

## 5. Tools

Six. Resist adding more — each is another thing the model can pick wrongly under demo pressure.

```ts
search_projects({ budget_max?, purpose?, region?, horizon_years? })
  -> { projects: [{ id, name, location, entry_ticket, rate_per_sqft,
                    cagr_range, hold, available_plots, fit_score, fit_reason }] }

list_plots({ project_id, min_size?, max_size?, max_price?,
             sort?: "price" | "size" | "distance_from_entrance" })
  -> { plots: [...max 20], total }

get_knowledge({ project_id?, topic })
  -> { chunks: [{ text, topic }] }

calculate_payment({ price, down_payment_pct, annual_rate, tenure_years })
  -> { down_payment, loan_amount, emi, total_interest }

show({ view: "recommendations" | "project" | "plots" | "plot" | "calculator"
             | "booking" | "kyc" | "loan", id? })
  -> { ok: true }

create_booking({ plot_id })
  -> { booking_id, plot, token_amount: 45000, status: "initiated" }
```

`show` is how the agent drives the interface. When it recommends, it calls `show({view:"recommendations"})` and the screen changes on its own. **That moment is the demo** — the client watches the AI operate the app rather than print a list.

`create_booking` never takes payment. It creates an initiated booking; the customer confirms on the payment screen. An agent that can spend money without a confirmation step isn't shippable.

Render each tool call as a compact pill in the conversation — `checking availability · 9 plots in range` — with a toggle to hide it if it distracts live.

**Write tool handler tests on day 1.** Tool contract regressions are silent: the agent just starts answering slightly wrong, and you find out during the demo.

---

## 6. Agent

`POST /api/agent`: append the user turn, build the request from standing instructions + profile + last 12 turns, call OpenAI with the six tools, execute and loop up to 4 rounds, guard the output, stream back.

**Standing instructions must carry:**

- Senior land-investment advisor. Indian English, warm, unhurried. Two to four sentences. One question at a time. No markdown, no bullets, no emoji — this is spoken aloud.
- Never state a number, date, approval or availability that didn't come from a tool result in this conversation.
- Never promise guaranteed, assured or fixed returns. If pressed, say plainly that no one can guarantee land appreciation.
- Never offer a discount or price exception. Offer smaller plots, the instalment plan, or financing instead.
- Profile before recommending. Once purpose + budget + one more field are known, stop asking and call `search_projects`, then `show`.
- Say *why* each recommendation fits, in the customer's own terms.
- Offer a human on request, on a second refusal to decide, or on any complaint, legal or tax question.

Reply contract, enforced with structured outputs, `strict: true`:

```json
{
  "say": "spoken text, no formatting",
  "chips": ["short reply the customer might tap", "another"],
  "profile_updates": { "purpose": null, "budget_max": null,
                       "horizon_years": null, "region": null, "funding": null },
  "intent": "interested"
}
```

Chips: 2–4, under five words each, phrased as the customer would say them.

Intent stages, forward only: `visitor → interested → qualified → shortlisted → high_intent → booking_initiated → token_paid → kyc_completed → loan_processing → booking_completed`.

---

## 7. Guardrails

`lib/agent/guard.ts`. Two checks, both cheap:

1. **Return language.** Regex for guarantee / assured / fixed / promised near a return figure. Strip and regenerate once.
2. **Numeric provenance.** Every price, size and distance in the reply must appear in a tool result from this session. On failure, regenerate once, then fall back to "Let me confirm that figure for you."

Log every failure with the offending text. Showing the count in the console is worth more to the client than a suspiciously clean demo.

**Ordering matters with a streaming avatar.** A spoken sentence can't be recalled. So:

- A sentence with **no digit, date or plot number** streams to `speak()` immediately.
- A sentence carrying **any of those** waits for the provenance check first.
- If a later chunk fails, `interrupt()`, flush the queue, speak the correction.

Don't let this get simplified into speaking everything as it arrives.

---

## 8. Avatar

### Session lifecycle

- API key stays server-side. `/api/avatar/token` mints a short-lived session token; the browser gets only that.
- **`taskType: REPEAT`, always.** `TALK` routes the turn through HeyGen's own LLM and bypasses our tools, retrieval and guardrails entirely — and it will look like it's working.
- Warm the session during OTP entry. Cold start is 2–4 seconds; starting on mount means the first impression is a spinner.
- **Close on idle (60s), unmount, tab hide, and modality switch.** Billing is per streamed minute of *session*, not of speech — a customer thinking for ninety seconds costs the same as one talking for ninety seconds, and on a ₹45 lakh decision people think a lot.
- Barge-in: on user speech start, `interrupt()`, flush the speak queue, abort the in-flight completion.

### Filler speech — build this, it's not optional

A tool round adds 400–900 ms of dead air, and a visible pause is the demo's weakest moment. Fill it: the instant a tool call starts, speak a short line while the tool runs.

Client-side map, tool name → 2–3 rotating lines, spoken on the tool-start event. No extra model call, zero added latency.

```
search_projects   "Let me see what fits that range."
                  "Give me a second, I'll pull up the options."
list_plots        "Checking what's still available there."
get_knowledge     "Let me get you the exact position on that."
calculate_payment "Working that out now."
create_booking    "Let me hold that for you."
```

This is what a human salesperson does. It converts dead air into something that sounds like competence, and it's the cheapest single thing that makes the agent feel real.

### Fallback is a first-class path

On `STREAM_DISCONNECTED`, or `STREAM_READY` over six seconds: SVG avatar, browser TTS, conversation untouched. Same framing and position on screen, so a drop reads as a bad connection rather than a broken app.

Conversation state lives in Zustand. Never in the avatar session.

### Voice input

HeyGen's own voice chat mode. English only for the demo.

---

## 9. Screens

Mobile-first, 428px max, light and dark, safe-area aware.

**Landing** — brand line, one CTA, prototype notice.

**Register** — name, mobile, city, OTP. Fixed code `481902`, auto-filled after 1.2 s with a visible prototype note. Warm the HeyGen session here.

**Agent** — avatar default, voice and chat one tap away, chips under the last turn, tool pills inline, mute, "talk to a human" always reachable. **Disclose at the start that this is an AI advisor.** Partly ethics, partly that synthetic-media labelling rules are tightening — worth checking the current position with legal before launch.

**Recommendations** — 2–3 project cards, fit score, the reason in the agent's words.

**Project detail** — site plan hero, stats strip, why-recommended, connectivity as a distance ladder, features, paperwork. Risk disclosure at the foot, not buried.

**Plot map** — selectable grid coloured by status, entrance marked, size and price filters. Tap a plot for number, size, facing, road width, distance from entrance, price.

**Calculator** — value, down payment, rate, tenure as sliders; EMI, loan and total interest live. Instalment plan alongside: ₹45,000 token, then 20 / 40 / 40.

**Booking** — summary, payment method, 4-second mock with staged status text, confirmation with booking ID and a dated next-steps ladder.

**KYC** — PAN with format validation, mock Aadhaar consent screen, DOB, address, liveness animation, mock verdict. Never store a raw Aadhaar number, even in the mock.

**Loan** — income, obligations, employment, credit band → eligibility. FOIR by band: 0.55 / 0.50 / 0.45 / 0.38, annuitised at band rate over 15 years. Label **in-principle** everywhere the number appears.

**Console** — funnel with the live session highlighted as it moves, plus profile, transcript, tool trace and guardrail hits. One session, not a cohort.

Sandbox labels on every mock screen. The client must never be unsure which parts are real.

**Design** — land-record vernacular: contour lines, plot-grid diagrams, connectivity ladder. No stock photography; generated site plans are more honest and more distinctive.

```
--ink #16212A   --paper #EDEFEA   --card #FFFFFF   --line #D7DBD3
--verd #125E52  --gold #A8761A    --site #12232B   --site-ink #E6EDE9
```

Display type Bricolage Grotesque, UI Instrument Sans, tabular figures on every number.

---

## 10. Demo run-through

The acceptance test and the script you perform. Every step must work with nobody touching anything.

1. **Land and register.** Name, mobile, OTP. Avatar warms in the background.
2. **Avatar greets by name** and asks what they're looking for.
3. **Free-text answer** — "I'm looking at an investment, around 40 to 50 lakh." Agent profiles conversationally, not in a fixed order.
4. **Agent recommends and the screen changes on its own.** Say out loud that nobody clicked anything. This is the moment.
5. **Comparison question** — "which one has better connectivity?" Answered from retrieved data.
6. **Switch to chat mid-conversation.** Context intact. Switch back.
7. **Plot-level questions** — "show me the 2,000 sq ft options", then "which is closest to the entrance?" Both answered from plot rows.
8. **Price objection** — "this feels expensive." Agent offers smaller sizes, the instalment plan and financing. No discount. Worth pausing on.
9. **Calculator.** Adjust down payment and tenure.
10. **"I want to book this."** Agent confirms the plot by name and the ₹45,000 token, routes to payment.
11. **Pay in sandbox.** Confirmation, plot flips to held.
12. **KYC**, then **loan eligibility** and mock sanction.
13. **Console.** The session sits at `loan_processing` with transcript, tool trace and guardrail count.

Rehearse twice on a throttled connection. Then rehearse the failure: kill wifi at step 5 and show the fallback holding the conversation. Volunteering that is more convincing than hoping it doesn't happen.

---

## 11. If a day slips

Cut in this order. Each is roughly half a day.

1. Compare view — the agent can compare in conversation.
2. Console funnel animation — a static funnel still lands.
3. Loan application step — stop at the eligibility number.
4. Plot map filters — the map alone answers the demo questions.
5. Dark mode.
6. `NEXT_PUBLIC_AVATAR_MODE=svg` — ships without HeyGen entirely.

**Never cut:** conversation tuning, the guardrails, the fallback path, filler speech. Those four are what make it look built rather than demoed.

---

## 12. Known risks

**HeyGen eats day 2.** The most likely single failure. Days 1 and 3 give a complete journey without the avatar, so there's always something to show.

**Stale API shapes.** Claude Code will write confidently against last year's HeyGen SDK and OpenAI model ids. Paste current docs in first.

**Wrong tool under pressure.** Six tools, tight descriptions, handler tests from day 1.

**Streamed-minute cost.** Measure minutes per conversation during the build rather than assuming the ten-minute estimate holds.

---

## 13. For the client conversation

Don't pitch photoreal as settled. Pitch it as what you're testing: the demo runs on HeyGen, production ships with both behind a flag and a split test in the console. You're offering to find out which converts rather than charging them ₹300 a conversation on an assumption.

Say plainly that at their lead volumes the avatar stream is the dominant cost line. Better that comes from you than from their finance team in month three.

Vendor pricing and model ids here are approximate and pre-date my knowledge cutoff — verify against current docs before any figure reaches a proposal.
