// Timeline from Hyperiux Vault (https://vault.hyperiux.com), via 21st.dev.
// Ported from TSX + Tailwind to JSX + plain CSS (Timeline.css). The scroll
// and reveal logic is unchanged; the milestones now come in through props.
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import './Timeline.css';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

/* Inline stand-in for @gsap/react's useGSAP. One gsap.context lives for the
   component's lifetime, the callback is re-added when dependencies change,
   and the context is reverted only on unmount. */
function useGSAP(callback, options) {
  const deps = options?.dependencies ?? [];
  const scope = options?.scope;
  const ctxRef = useRef(null);
  const cleanupRef = useRef(undefined);

  useLayoutEffect(() => {
    const el = scope && typeof scope === 'object' && 'current' in scope ? scope.current : scope;
    ctxRef.current = gsap.context(() => {}, el ?? undefined);
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = undefined;
      ctxRef.current?.revert();
      ctxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!ctxRef.current) return;
    cleanupRef.current?.();
    const ret = ctxRef.current.add(callback);
    cleanupRef.current = typeof ret === 'function' ? ret : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeToReducedMotion(callback) {
  if (typeof window === 'undefined') return () => {};
  const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQueryList.addEventListener('change', callback);
  return () => mediaQueryList.removeEventListener('change', callback);
}

const getReducedMotionSnapshot = () =>
  typeof window === 'undefined' ? false : window.matchMedia?.(REDUCED_MOTION_QUERY)?.matches ?? false;

const usePrefersReducedMotion = () => useSyncExternalStore(subscribeToReducedMotion, getReducedMotionSnapshot, () => false);

export default function Timeline({
  id = 'journey',
  title = 'Product Storyline',
  periodLabel = '2020-2026',
  top = [],
  bottom = [],
  textColor = '#000000',
  mutedTextColor = '#3f3f46',
  activeColor = '#ff5f00',
  backgroundColor = 'transparent',
  imageUrl,
  imageAlt = '',
  duration,
  scrollDuration = 1.2,
}) {
  const sectionRef = useRef(null);
  const wholeSliderRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();
  const normalizedDuration = Math.max(0.2, duration ?? scrollDuration);
  const allItems = [...top, ...bottom].sort((a, b) => a.order - b.order);
  const activeStyle = { backgroundColor: activeColor };
  const mutedTextStyle = { color: mutedTextColor };

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const isMobile = window.innerWidth < 600;
      const slidePercent = isMobile ? -57 : -65;
      const lineWidth = isMobile ? '65%' : '98%';
      const lineStart = isMobile ? 'top 30%' : 'top 25%';
      const slideEnd = isMobile ? '82% 50%' : '92% bottom';
      const lineEnd = isMobile ? '80% 50%' : '92% bottom';

      const tl = gsap.timeline({
        scrollTrigger: { trigger: section, start: 'top top', end: slideEnd, scrub: true },
        defaults: { ease: 'none' },
      });
      tl.fromTo(wholeSliderRef.current, { xPercent: 0 }, { xPercent: slidePercent });

      if (reducedMotion) {
        gsap.set('.journey-line', { width: lineWidth });
        return;
      }

      gsap.to('.journey-line', {
        width: lineWidth,
        ease: 'none',
        scrollTrigger: { trigger: section, start: lineStart, end: lineEnd, scrub: true },
      });
    },
    { dependencies: [reducedMotion], scope: sectionRef }
  );

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      if (reducedMotion) {
        allItems.forEach((item) => {
          gsap.set(`.jl-${item.id}`, { scaleY: 1 });
          gsap.set(`.jd-${item.id}`, { scale: 1 });
          gsap.set(`.title-${item.id}`, { opacity: 1, clearProps: 'transform' });
          gsap.set(`.description-${item.id}`, { opacity: 1, clearProps: 'transform' });
        });
        return;
      }

      allItems.forEach((item) => {
        gsap.set(`.jl-${item.id}`, { scaleY: 0, transformOrigin: 'bottom bottom' });
        gsap.set(`.jd-${item.id}`, { scale: 0 });
        gsap.set(`.title-${item.id}`, { opacity: 1 });
        gsap.set(`.description-${item.id}`, { opacity: 1 });
      });

      const titleSplits = {};
      const descriptionSplits = {};
      allItems.forEach((item) => {
        titleSplits[item.id] = new SplitText(`.title-${item.id}`, { type: 'chars, words, lines', mask: 'lines' });
        descriptionSplits[item.id] = new SplitText(`.description-${item.id}`, { type: 'chars, words, lines', mask: 'lines' });
      });

      const createItemTimeline = (item, startPos, endPos) => {
        const lineSelector = `.jl-${item.id}`;
        const dotSelector = `.jd-${item.id}`;
        const titleLines = titleSplits[item.id]?.lines || [];
        const descriptionLines = descriptionSplits[item.id]?.lines || [];
        const isTop = top.some((topItem) => topItem.id === item.id);

        if (!isTop) gsap.set(lineSelector, { transformOrigin: 'top top' });

        const timeline = gsap.timeline({
          scrollTrigger: { trigger: section, start: `${startPos}% 30%`, end: `${endPos}% 50%`, scrub: true },
        });

        timeline
          .to(lineSelector, { scaleY: 1, duration: normalizedDuration * 0.4 })
          .to(dotSelector, { scale: 1, duration: normalizedDuration * 0.4 }, '<')
          .fromTo(
            titleLines,
            { y: 100 },
            { y: 0, delay: -0.8 * normalizedDuration, duration: normalizedDuration, stagger: 0.02, ease: 'power2.out' }
          )
          .fromTo(descriptionLines, { y: 100 }, { y: 0, duration: normalizedDuration, stagger: 0.02, ease: 'power2.out' }, '<');

        return timeline;
      };

      const positions =
        window.innerWidth < 600
          ? [[22, 32], [28, 38], [36, 46], [45, 55], [52, 62], [60, 70], [69, 79]]
          : [[6, 26], [16, 36], [26, 46], [35, 55], [45, 65], [55, 75], [65, 85]];

      allItems.forEach((item, index) => {
        const [startPos, endPos] = positions[index] ?? positions[positions.length - 1];
        createItemTimeline(item, startPos, endPos);
      });

      const handleResize = () => ScrollTrigger.refresh();
      window.addEventListener('resize', handleResize);

      return () => {
        Object.values(titleSplits).forEach((split) => split?.revert?.());
        Object.values(descriptionSplits).forEach((split) => split?.revert?.());
        window.removeEventListener('resize', handleResize);
      };
    },
    { dependencies: [normalizedDuration, reducedMotion], scope: sectionRef }
  );

  return (
    <section ref={sectionRef} id={id} className="tl" style={{ color: textColor, backgroundColor }}>
      <div className="tl__sticky">
        <div ref={wholeSliderRef} className="tl__slider">
          {imageUrl ? (
            <div className="tl__image">
              <img src={imageUrl} alt={imageAlt} draggable={false} loading="lazy" decoding="async" />
            </div>
          ) : null}

          <div className="tl__track">
            <div className="tl__axis">
              <div className="tl__axis-dot" style={activeStyle}></div>
              <div className="tl__axis-line journey-line" style={activeStyle}></div>
              <div className="tl__axis-dot" style={activeStyle}></div>
            </div>

            <div className="tl__half tl__half--top">
              <div className="tl__title-col">
                <h2 className="tl__title">{title}</h2>
              </div>
              <div className="tl__items tl__items--top">
                {top.map((item) => (
                  <div key={`top-${item.id}`} className="tl__item tl__item--top">
                    <div className="tl__stem">
                      <div className={`tl__dot jd-${item.id}`} style={activeStyle}></div>
                      <div className={`tl__line tl__line--up jl-${item.id}`} style={activeStyle}></div>
                    </div>
                    <div className="tl__text tl__text--top">
                      <h3 className={`tl__heading title-${item.id}`}>{item.heading}</h3>
                      <p className={`tl__desc description-${item.id}`} style={mutedTextStyle}>
                        {item.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="tl__half tl__half--bottom">
              <div className="tl__period-col">
                <p className="tl__period" style={mutedTextStyle}>{periodLabel}</p>
              </div>
              <div className="tl__items tl__items--bottom">
                {bottom.map((item) => (
                  <div key={`bottom-${item.id}`} className="tl__item tl__item--bottom">
                    <div className="tl__stem tl__stem--bottom">
                      <div className={`tl__line tl__line--down jl-${item.id}`} style={activeStyle}></div>
                      <div className={`tl__dot jd-${item.id}`} style={activeStyle}></div>
                    </div>
                    <div className="tl__text tl__text--bottom">
                      <h3 className={`tl__heading title-${item.id}`}>{item.heading}</h3>
                      <p className={`tl__desc description-${item.id}`} style={mutedTextStyle}>
                        {item.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
