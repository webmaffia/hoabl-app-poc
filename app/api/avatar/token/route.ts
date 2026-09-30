// POST /api/avatar/token: mints a short-lived LiveAvatar session token.
// The API key stays on the server; the browser only ever sees the token.
//
// FULL mode with no context_id runs LiveAvatar in restricted mode: its own LLM
// never answers, but it still does VAD and speech-to-text (user.transcription)
// and speaks whatever we send with repeat(). Our agent, tools and guardrails
// stay in charge of every word.

export const runtime = "nodejs";

const API = "https://api.liveavatar.com/v1";
// The only avatar sandbox sessions allow.
const SANDBOX_AVATAR = "dd73ea75-1218-4ef3-92ce-606d5f7fbc0a";

export async function POST() {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) return Response.json({ error: "HEYGEN_API_KEY is not set" }, { status: 503 });

  const sandbox = process.env.HEYGEN_SANDBOX === "true";
  const avatarId = sandbox ? SANDBOX_AVATAR : process.env.HEYGEN_AVATAR_ID;
  if (!avatarId) return Response.json({ error: "HEYGEN_AVATAR_ID is not set" }, { status: 503 });

  const res = await fetch(`${API}/sessions/token`, {
    method: "POST",
    headers: { "X-API-KEY": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      mode: "FULL",
      is_sandbox: sandbox,
      avatar_id: avatarId,
      avatar_persona: {
        ...(process.env.HEYGEN_VOICE_ID && !sandbox ? { voice_id: process.env.HEYGEN_VOICE_ID } : {}),
        language: "en",
      },
      video_settings: { quality: "high", encoding: "H264" },
      interactivity_type: "CONVERSATIONAL",
      // Sandbox caps sessions at 60s; otherwise use the account's maximum
      // (LiveAvatar rejects anything above 120s) so an abandoned tab can't
      // burn credits.
      max_session_duration: sandbox ? 60 : 120,
    }),
  });

  const body = (await res.json().catch(() => null)) as { code?: number; message?: string; data?: { session_id: string; session_token: string } } | null;
  if (!res.ok || body?.code !== 1000 || !body.data) {
    console.error("[avatar] token failed", res.status, body?.message);
    return Response.json({ error: body?.message ?? `LiveAvatar ${res.status}` }, { status: 502 });
  }

  console.log(`[avatar] token minted · session ${body.data.session_id}${sandbox ? " · sandbox" : ""}`);
  return Response.json({ session_token: body.data.session_token, session_id: body.data.session_id, sandbox });
}
