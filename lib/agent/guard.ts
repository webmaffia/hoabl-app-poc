// Output guardrails, both cheap and deterministic:
//   1. Return language: no guaranteed, assured, fixed or promised returns.
//   2. Numeric provenance: every figure spoken must have come from a tool
//      result (or from the customer) earlier in this session.

import { TOKEN_AMOUNT } from "@/lib/knowledge";

export interface Evidence {
  numbers: number[];
  refs: string[]; // plot numbers such as IA-07
}

export interface Violation {
  check: "return_language" | "provenance";
  text: string;
  detail: string;
}

export const emptyEvidence = (): Evidence => ({ numbers: [TOKEN_AMOUNT], refs: [] });

// ---------------------------------------------------------------- figures

export interface StatedFigure {
  raw: string;
  value: number;
  tolerance: number;
  hasUnit: boolean;
}

const UNIT_SCALE: [RegExp, number][] = [
  [/^(lakhs?|lacs?|l)$/i, 1e5],
  [/^(crores?|cr)$/i, 1e7],
  [/^k$/i, 1e3],
];

// Indian (12,34,567) or western (1,234,567) grouping, or plain decimals, with
// an optional unit. Letters around the number are excluded so plot numbers and
// words like "5G" don't count.
const FIGURE =
  /(₹\s?|rs\.?\s?|inr\s?)?(?<![A-Za-z\d-])(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?![\d])\s*(lakhs?|lacs?|crores?|cr\b|l\b|k\b|%|percent\b|per cent\b|sq\.?\s?ft\b|sqft\b|square feet\b|km\b|kms\b|kilometres?\b|kilometers?\b|m\b|metres?\b|meters?\b|minutes?\b|mins?\b|hours?\b|hrs?\b|years?\b|x\b|times\b|acres?\b)?/gi;

export function extractFigures(text: string): StatedFigure[] {
  const out: StatedFigure[] = [];
  for (const m of text.matchAll(FIGURE)) {
    const [raw, currency, digits, unit] = m;
    const plain = digits.replace(/,/g, "");
    const decimals = plain.includes(".") ? plain.split(".")[1].length : 0;
    const scale = unit ? UNIT_SCALE.find(([re]) => re.test(unit.trim()))?.[1] ?? 1 : 1;
    const value = parseFloat(plain) * scale;
    // Half a unit of the last digit spoken: "46 lakh" covers 45.5–46.5 lakh.
    const tolerance = scale > 1 ? 0.5 * 10 ** -decimals * scale : decimals > 0 ? 0.5 * 10 ** -decimals : 0.5;
    out.push({ raw: raw.trim(), value, tolerance, hasUnit: Boolean(currency || unit) });
  }
  return out;
}

const PLOT_REF = /\b[A-Z]{2}-\d{2}\b/g;

export function extractRefs(text: string): string[] {
  return text.match(PLOT_REF) ?? [];
}

/** Collects every figure and plot number found anywhere in a tool result or text. */
export function collectEvidence(source: unknown, into: Evidence = { numbers: [], refs: [] }): Evidence {
  if (typeof source === "number" && Number.isFinite(source)) into.numbers.push(source);
  else if (typeof source === "string") {
    into.numbers.push(...extractFigures(source).map((f) => f.value));
    into.refs.push(...extractRefs(source));
  } else if (Array.isArray(source)) {
    into.numbers.push(source.length);
    source.forEach((s) => collectEvidence(s, into));
  } else if (source && typeof source === "object") {
    Object.values(source).forEach((v) => collectEvidence(v, into));
  }
  return into;
}

export function mergeEvidence(a: Evidence, b: Evidence): Evidence {
  return {
    numbers: [...new Set([...a.numbers, ...b.numbers])],
    refs: [...new Set([...a.refs, ...b.refs])],
  };
}

// Bare small integers ("3 options", "2 questions") carry no commercial claim.
const isTrivial = (f: StatedFigure) => !f.hasUnit && Number.isInteger(f.value) && f.value <= 3;

export function checkProvenance(text: string, evidence: Evidence): Violation[] {
  const violations: Violation[] = [];
  for (const f of extractFigures(text)) {
    if (isTrivial(f)) continue;
    const backed = evidence.numbers.some((n) => Math.abs(n - f.value) <= f.tolerance);
    if (!backed) violations.push({ check: "provenance", text: f.raw, detail: `figure ${f.raw} not found in any tool result` });
  }
  for (const ref of extractRefs(text)) {
    if (!evidence.refs.includes(ref)) violations.push({ check: "provenance", text: ref, detail: `plot ${ref} not found in any tool result` });
  }
  return violations;
}

// ---------------------------------------------------------------- returns

const PROMISE = /\b(guarantee[sd]?|guaranteeing|assured|fixed|promised?|promising|sure[- ]shot|risk[- ]free)\b/gi;
const RETURN_CONTEXT = /\b(returns?|appreciat\w*|yields?|growth|grow|profits?|gains?|income|double|triple)\b|\d\s*(%|x\b|times|percent)/i;
const NEGATION = /\b(no one|nobody|not|never|cannot|can't|can not|won't|isn't|aren't|no)\b[^.?!]{0,30}$/i;

export function splitSentences(text: string): string[] {
  // Split after terminal punctuation followed by space, so "61.94 lakh" stays whole.
  return text.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean);
}

function sentencePromisesReturns(sentence: string): string | null {
  if (!RETURN_CONTEXT.test(sentence)) return null;
  for (const m of sentence.matchAll(PROMISE)) {
    const before = sentence.slice(0, m.index);
    const after = sentence.slice(m.index! + m[0].length);
    if (m[0].toLowerCase() === "fixed" && /^\s*(deposits?|rates?|interest|price|dates?)\b/i.test(after)) continue;
    if (NEGATION.test(before)) continue;
    return m[0];
  }
  return null;
}

export function checkReturnLanguage(text: string): Violation[] {
  return splitSentences(text).flatMap((s) => {
    const word = sentencePromisesReturns(s);
    return word ? [{ check: "return_language" as const, text: s, detail: `'${word}' used about returns` }] : [];
  });
}

export function stripReturnLanguage(text: string): string {
  return splitSentences(text)
    .filter((s) => !sentencePromisesReturns(s))
    .join(" ");
}

// ---------------------------------------------------------------- combined

export function checkReply(text: string, evidence: Evidence): Violation[] {
  return [...checkReturnLanguage(text), ...checkProvenance(text, evidence)];
}

export const PROVENANCE_FALLBACK = "Let me confirm that figure for you.";

/**
 * Whether a sentence must pass the provenance check before it is spoken.
 * Sentences with no digit, date or plot number can go to speak() immediately.
 */
export function needsProvenanceCheck(sentence: string): boolean {
  // Figures, dates and plot numbers all carry a digit.
  return /\d/.test(sentence);
}
