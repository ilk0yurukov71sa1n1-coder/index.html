/** App-wide settings (Module 0). Later modules add their own settings under their own keys. */
export interface CoreSettings {
  yourName: string;
  businessName: string;
  ownEmail: string;
  currency: string;
  timeZone: "Europe/Sofia";
}

export const DEFAULT_CORE_SETTINGS: CoreSettings = {
  yourName: "Ilko",
  businessName: "Rollcfluence",
  ownEmail: "",
  currency: "€",
  timeZone: "Europe/Sofia",
};

export const CURRENCIES = ["€", "$", "£"] as const;

export function cleanCoreSettings(input: Partial<CoreSettings>, old: CoreSettings): { settings: CoreSettings; problems: string[] } {
  const problems: string[] = [];
  const email = (input.ownEmail ?? old.ownEmail).trim().toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push(`"${email}" is not a valid email address.`);
  const currency = CURRENCIES.includes((input.currency ?? old.currency) as (typeof CURRENCIES)[number]) ? (input.currency ?? old.currency) : old.currency;
  const settings: CoreSettings = {
    yourName: (input.yourName ?? old.yourName).trim().slice(0, 80) || old.yourName,
    businessName: (input.businessName ?? old.businessName).trim().slice(0, 80) || old.businessName,
    ownEmail: problems.length ? old.ownEmail : email,
    currency,
    timeZone: "Europe/Sofia",
  };
  return { settings, problems };
}

/** Lists which fields changed, for the event log (never includes values that could be secret). */
export function changedFields(a: CoreSettings, b: CoreSettings): string[] {
  return (Object.keys(a) as (keyof CoreSettings)[]).filter((k) => a[k] !== b[k]);
}
