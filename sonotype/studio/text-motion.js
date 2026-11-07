// Big headings rise in word by word (the "Rise" effect from ilko's Text
// Motion Lab). Each word slides up from behind its own mask, once, when the
// heading comes into view; the hero headings play each time their chapter
// opens. <em> and <br> are kept, so the styling stays the same.
// The split breaks the language lookup (it reads the plain heading), so it
// runs after every language change via refresh().
const SELECTOR = '.panel__heading, .section-title, .timeline__title';

function splitInto(target, source, counter) {
  source.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { target.appendChild(document.createTextNode(' ')); return; }
        const u = document.createElement('span');
        u.className = 'tm-u';
        u.setAttribute('aria-hidden', 'true');
        u.style.setProperty('--i', counter.i++);
        const inner = document.createElement('span');
        inner.className = 'tm-in';
        inner.textContent = part;
        u.appendChild(inner);
        target.appendChild(u);
      });
    } else if (node.nodeName === 'BR') {
      target.appendChild(document.createElement('br'));
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const copy = node.cloneNode(false);
      splitInto(copy, node, counter);
      target.appendChild(copy);
    }
  });
}

export default function textMotion() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const els = [...document.querySelectorAll(SELECTOR)];
  if (reduce || !els.length) return () => {};

  const seen = new WeakSet();
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        seen.add(e.target);
        e.target.classList.add('is-on');
        io.unobserve(e.target);
      });
    }, { threshold: 0.35 })
    : null;

  return function refresh() {
    els.forEach((el) => {
      const copy = el.cloneNode(true);
      copy.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
      const label = copy.textContent.replace(/\s+/g, ' ').trim();
      const frag = document.createDocumentFragment();
      splitInto(frag, el, { i: 0 });
      el.textContent = '';
      el.appendChild(frag);
      el.setAttribute('aria-label', label);
      el.classList.add('tm');
      // Hero headings are driven by their chapter; the rest by scrolling.
      if (el.closest('.panel')) return;
      if (seen.has(el) || !io) el.classList.add('is-on');
      else io.observe(el);
    });
  };
}
