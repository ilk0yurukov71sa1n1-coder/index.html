// Site languages. English lives in site.js; every other language is a flat
// JSON file of "path.to.string": "translation", applied onto the site.js
// objects before the app renders (main.jsx loads this first).
export const LANGS = [
  ['en', 'English'],
  ['bg', 'Български'],
  ['de', 'Deutsch'],
  ['fr', 'Français'],
  ['es', 'Español'],
];
const CODES = LANGS.map(([c]) => c);
const KEY = 'rc-lang';
const files = {
  bg: () => import('./bg.json'),
  de: () => import('./de.json'),
  fr: () => import('./fr.json'),
  es: () => import('./es.json'),
};

const stored = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

// ?lang= first (shareable links), then the visitor's last pick, then the browser.
export const currentLang = () => {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (CODES.includes(fromUrl)) return fromUrl;
  const saved = stored();
  if (CODES.includes(saved)) return saved;
  const browser = (navigator.languages || [navigator.language]).map((l) => String(l).slice(0, 2).toLowerCase());
  return browser.find((l) => CODES.includes(l)) || 'en';
};

export const setLang = (lang) => {
  if (!CODES.includes(lang)) return;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // Private mode: the ?lang link below still carries the choice.
  }
  const url = new URL(location.href);
  if (lang === 'en') url.searchParams.delete('lang');
  else url.searchParams.set('lang', lang);
  location.assign(url.toString());
};

// The English chat answers, kept before translating, so the chat helper can
// still match a visitor who types in English on a translated page.
export const english = { faq: [], extra: [] };

// Writes each translation onto the matching string in the site.js exports.
// Paths that no longer exist, or no longer point at a string, are skipped.
export const loadLocale = async (site) => {
  const lang = currentLang();
  document.documentElement.lang = lang;
  english.faq = structuredClone(site.faq.items);
  english.extra = structuredClone(site.chat.extra);
  if (lang === 'en') return lang;
  try {
    const dict = (await files[lang]()).default;
    for (const [path, text] of Object.entries(dict)) {
      const parts = path.split('.');
      const last = parts.pop();
      let obj = site[parts.shift()];
      for (const p of parts) obj = obj?.[p];
      if (obj && typeof obj[last] === 'string' && typeof text === 'string' && text) obj[last] = text;
    }
  } catch {
    document.documentElement.lang = 'en';
    return 'en';
  }
  return lang;
};
