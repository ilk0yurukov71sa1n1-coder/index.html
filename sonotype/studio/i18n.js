// English / Bulgarian switch. The page is written in English; each block of
// text is looked up by its own English wording in the Bulgarian dictionary,
// so nothing in the page needs keys. Blocks without a translation stay as
// they are. The choice is remembered on this device.
import BG from './i18n-bg.js';

const INLINE = new Set(['EM', 'BR', 'A', 'SPAN', 'STRONG', 'B', 'I']);
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CANVAS', 'VIDEO', 'svg']);
const KEY = 'rc-lang';

const norm = (s) => s.replace(/\s+/g, ' ').trim();

function isLeafBlock(el) {
  if (SKIP.has(el.tagName)) return false;
  if (!/[A-Za-z]/.test(el.textContent)) return false;
  for (const child of el.querySelectorAll('*')) {
    if (!INLINE.has(child.tagName)) return false;
    // Links the page script listens to stay as they are; only their own text changes.
    if (child.tagName === 'A' && (Object.keys(child.dataset).length || child.classList.contains('btn'))) return false;
  }
  return true;
}

// The outermost elements whose insides are only text and inline tags.
export function textBlocks(root = document.body) {
  const out = [];
  const walk = (el) => {
    for (const child of el.children) {
      if (SKIP.has(child.tagName) || child.dataset.i18nSkip !== undefined) continue;
      if (isLeafBlock(child)) out.push(child);
      else walk(child);
    }
  };
  walk(root);
  return out;
}

const ATTRS = ['aria-label', 'alt', 'title', 'content'];

export default function setupLanguage(onChange) {
  const blocks = textBlocks().map((el) => ({ el, en: el.innerHTML, key: norm(el.innerHTML) }));
  const attrEls = [...document.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(','))]
    .filter((el) => el.tagName !== 'META' || el.name === 'description');
  const attrs = attrEls.flatMap((el) =>
    ATTRS.filter((a) => el.hasAttribute(a) && /[A-Za-z]/.test(el.getAttribute(a)))
      .map((a) => ({ el, a, en: el.getAttribute(a), key: norm(el.getAttribute(a)) })),
  );
  const titleEn = document.title;
  const buttons = [...document.querySelectorAll('[data-lang]')];

  function apply(lang) {
    const bg = lang === 'bg';
    document.documentElement.lang = bg ? 'bg' : 'en';
    blocks.forEach((b) => {
      const next = bg && BG[b.key] ? BG[b.key] : b.en;
      if (b.el.innerHTML !== next) b.el.innerHTML = next;
    });
    attrs.forEach((t) => t.el.setAttribute(t.a, bg && BG[t.key] ? BG[t.key] : t.en));
    document.title = bg && BG[norm(titleEn)] ? BG[norm(titleEn)] : titleEn;
    buttons.forEach((btn) => {
      const on = btn.dataset.lang === lang;
      btn.setAttribute('aria-pressed', String(on));
      btn.closest('.lang')?.style.setProperty('--lang-x', lang === 'bg' ? '100%' : '0%');
    });
    try { localStorage.setItem(KEY, lang); } catch {}
    onChange?.(lang);
  }

  buttons.forEach((btn) => btn.addEventListener('click', () => apply(btn.dataset.lang)));

  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch {}
  if (saved === 'bg') apply('bg');
  else apply('en');
  return apply;
}
