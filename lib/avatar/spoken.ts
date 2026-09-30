// Rewrites display text into what a voice should say: "₹61.94 lakh" becomes
// "61.94 lakh rupees", "sq ft" becomes "square feet", "7–10" becomes "7 to 10".
// The transcript keeps the written form.

export function forSpeech(text: string): string {
  return text
    // A link is shown as a card, never read out.
    .replace(/https?:\/\/\S+/g, "")
    .replace(/₹\s?([\d,.]+)\s*(lakh|crore)s?\b/gi, "$1 $2 rupees")
    .replace(/₹\s?([\d,.]+)/g, "$1 rupees")
    .replace(/\bsq\.?\s?ft\b/gi, "square feet")
    .replace(/(\d)\s?km\b/g, "$1 kilometres")
    .replace(/(\d)\s?m\b/g, "$1 metres")
    .replace(/(\d)\s?[–-]\s?(\d)/g, "$1 to $2")
    .replace(/\b([A-Z]{2})-(\d{2})\b/g, (_, letters: string, digits: string) => `plot ${letters.split("").join(" ")} ${digits}`)
    .replace(/\bEMI\b/g, "E M I")
    // The brand is said letter by letter: H-O-A-B-L, never "hoe-able".
    .replace(/\bHoABL\b/gi, "H O A B L");
}
