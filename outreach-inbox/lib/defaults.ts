import { DEFAULT_SETTINGS, type Store } from "./types.ts";
import { DEFAULT_TEMPLATES } from "./templates.ts";

/** A fresh, empty store (safe to use in the browser). */
export function emptyStore(): Store {
  return { version: 1, leads: [], templates: DEFAULT_TEMPLATES.map((t) => ({ ...t })), sent: [], replies: [], suppressed: [], settings: { ...DEFAULT_SETTINGS, targets: { ...DEFAULT_SETTINGS.targets } } };
}
