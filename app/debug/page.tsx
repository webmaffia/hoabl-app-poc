"use client";

// Day 1: a deliberately plain chat page for exercising the agent. No avatar,
// no styling. The screen changes requested by `show` are printed inline.

import { useState } from "react";
import { useSession } from "@/lib/store";

export default function AgentPage() {
  const { turns, busy, error, profile, intent, guardHits, screen: view, send, reset, setCustomer } = useSession();
  const [text, setText] = useState("");
  const [name, setName] = useState(profile.name ?? "");
  const [showPills, setShowPills] = useState(true);

  const submit = (value: string) => {
    const v = value.trim();
    if (!v || busy) return;
    setText("");
    send(v);
  };

  const lastAgent = [...turns].reverse().find((t) => t.kind === "agent");

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif", fontSize: 14, background: "#fff", color: "#111", minHeight: "100%" }}>
      <h1>Agent debug (unstyled)</h1>

      <p>
        <label>
          Customer name{" "}
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setCustomer(name)} />
        </label>{" "}
        <button disabled={busy || turns.length > 0} onClick={() => { setCustomer(name || "Guest"); send(null); }}>
          Start (agent greets)
        </button>{" "}
        <button onClick={() => { reset(); setName(""); }}>Reset session</button>{" "}
        <label>
          <input type="checkbox" checked={showPills} onChange={(e) => setShowPills(e.target.checked)} /> tool pills
        </label>
      </p>

      <pre style={{ background: "#f4f4f4", padding: 8, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        intent: {intent} · screen: {view ? `${view.view}${view.id ? ` (${view.id})` : ""}` : "—"} · guard hits: {guardHits.length}
        {"\n"}profile: {JSON.stringify(profile)}
      </pre>

      <div>
        {turns.map((t, i) => {
          if (t.kind === "user") return <p key={i}><b>You:</b> {t.text}</p>;
          if (t.kind === "agent") return <p key={i}><b>Advisor:</b> {t.text}</p>;
          if (!showPills) return null;
          if (t.kind === "tool") return <p key={i} style={{ color: "#666" }}>⚙ {t.tool.pill ?? `${t.tool.name}…`}</p>;
          if (t.kind === "event") return <p key={i} style={{ color: "#125E52" }}>● {t.label}</p>;
          if (t.kind === "handoff")
            return (
              <p key={i} style={{ color: "#125E52" }}>
                ☎ handoff → {t.items.filter((it) => it.done).map((it) => it.label).join(", ") || "no context yet"}
              </p>
            );
          return <p key={i} style={{ color: "#125E52" }}>▣ screen → {t.view}{t.id ? ` (${t.id})` : ""}</p>;
        })}
        {busy && <p style={{ color: "#666" }}>…</p>}
        {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      </div>

      {lastAgent?.kind === "agent" && !busy && (
        <p>
          {lastAgent.chips.map((c) => (
            <button key={c} onClick={() => submit(c)} style={{ marginRight: 6 }}>{c}</button>
          ))}
        </p>
      )}

      <form onSubmit={(e) => { e.preventDefault(); submit(text); }}>
        <textarea
          rows={3}
          style={{ width: "100%" }}
          value={text}
          placeholder="investment, around 45 lakh, near Mumbai"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(text); } }}
        />
        <button type="submit" disabled={busy}>Send</button>
      </form>

      {guardHits.length > 0 && (
        <details>
          <summary>Guardrail hits ({guardHits.length})</summary>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(guardHits, null, 2)}</pre>
        </details>
      )}
    </main>
  );
}
