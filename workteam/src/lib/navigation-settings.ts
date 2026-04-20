/** Left navigation visibility (workspace shell). Admin link is not configurable and always shown to admins. */
export const NAV_MENU_KEYS = [
  "dashboard",
  "chat",
  "tasks",
  "calendar",
  "meeting_notes",
  "activity_feed",
  "archive"
] as const;

export type NavMenuKey = (typeof NAV_MENU_KEYS)[number];

export type NavMenuVisibility = Record<NavMenuKey, boolean>;

export const DEFAULT_NAV_VISIBILITY: NavMenuVisibility = {
  dashboard: true,
  chat: true,
  tasks: true,
  calendar: true,
  meeting_notes: true,
  activity_feed: true,
  archive: true
};

export function mergeNavVisibility(raw: unknown): NavMenuVisibility {
  const out: NavMenuVisibility = { ...DEFAULT_NAV_VISIBILITY };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    for (const k of NAV_MENU_KEYS) {
      const v = o[k];
      if (typeof v === "boolean") {
        out[k] = v;
      }
    }
  }
  return out;
}
