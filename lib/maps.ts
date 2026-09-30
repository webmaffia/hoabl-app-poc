// Google Maps for the projects that have a real site. Illustrative projects
// have no map. The embed URL is Google's own; a place link can't be framed.

export interface SiteMap {
  embed: string;
  link: string;
}

export const SITE_MAPS: Record<string, SiteMap> = {
  anjarle: {
    embed:
      "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d1168.0888899142892!2d73.07900403903743!3d17.875353268626203!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be9b7bd8e6b21d9%3A0xa5ded793c143e4f1!2sThe%20House%20of%20Abhinandan%20Lodha%2C%20Anjarle!5e1!3m2!1sen!2sin!4v1790758841816!5m2!1sen!2sin",
    link: "https://www.google.com/maps/place/The+House+of+Abhinandan+Lodha,+Anjarle/@17.8753533,73.079004,268m/data=!3m1!1e3!4m6!3m5!1s0x3be9b7bd8e6b21d9:0xa5ded793c143e4f1!8m2!3d17.8750993!4d73.0794711!16s%2Fg%2F11rp2blrl9",
  },
};

/** Pending "scroll to this section" request, consumed by the screen once it's on show. */
let pendingSection: string | null = null;

export function requestScroll(id: string) {
  pendingSection = id;
}

/** Scrolls to the pending section if its element is on the page. Returns whether it did. */
export function flushScroll(): boolean {
  if (!pendingSection) return false;
  const el = document.getElementById(pendingSection);
  if (!el) return false;
  pendingSection = null;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}
