import * as React from "react";

/* Every piece of text fades and rises into view the first time it scrolls
   on screen (ilko asked for this on 24 Oct). Text is found, not hand-tagged,
   so new rows and dialogs get it too. Uses a data attribute rather than a
   class so React re-renders never strip it. Reduced motion: no animation. */
const BLOCKS = "h1,h2,h3,h4,p,label,th,td,li,dt,dd,button,a,figcaption,legend,option";

function hasOwnText(el: Element) {
  for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent!.trim()) return true;
  return false;
}

export function useTextReveal(root: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const host = root.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    let queue: HTMLElement[] = [], raf = 0;
    const flush = () => {
      raf = 0;
      queue.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      queue.forEach((el, i) => { el.style.setProperty("--rv-delay", Math.min(i * 28, 420) + "ms"); el.dataset.rv = "1"; });
      queue = [];
    };
    const io = new IntersectionObserver((list) => {
      for (const e of list) if (e.isIntersecting) { io.unobserve(e.target); queue.push(e.target as HTMLElement); }
      if (queue.length && !raf) raf = requestAnimationFrame(flush);
    }, { rootMargin: "0px 0px -6% 0px" });
    const tag = (scope: Element) => {
      const found: Element[] = [];
      if (scope.matches?.(BLOCKS) || (scope instanceof HTMLElement && hasOwnText(scope))) found.push(scope);
      scope.querySelectorAll("*").forEach((el) => { if (el.matches(BLOCKS) || hasOwnText(el)) found.push(el); });
      for (const el of found) {
        if (!(el instanceof HTMLElement) || el.dataset.rv || el.closest("svg,[data-rv-skip]")) continue;
        // a block inside an already revealing block moves with its parent
        if (el.parentElement?.closest("[data-rv]")) continue;
        el.dataset.rv = "0";
        io.observe(el);
      }
    };
    tag(host);
    const mo = new MutationObserver((muts) => { for (const m of muts) m.addedNodes.forEach((n) => { if (n.nodeType === 1) tag(n as Element); }); });
    mo.observe(host, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [root]);
}
