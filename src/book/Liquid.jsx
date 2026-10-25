import { useEffect, useRef, useState } from 'react';
import { INTRO_SECONDS, createLiquid, liquidSupported } from './liquid';

const fontOf = () => {
  try {
    return getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  } catch {
    return 'system-ui, sans-serif';
  }
};

// Checked once: every Liquid Glass piece needs WebGL2 with float targets.
export const CAN_LIQUID = typeof window !== 'undefined' && liquidSupported();

// The swirling glass orb in the hero, in front of the salon name.
export function LiquidOrb({ text, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const scene = createLiquid(ref.current, { mode: 'orb', text, font: fontOf() });
    return () => scene?.dispose();
  }, [text]);
  return <canvas ref={ref} className="bk-orb" role="img" aria-label={label} />;
}

// Once per visit: the water gathers into a drop that falls and ripples open into the page.
const SEEN = 'bk-drop-seen';
export const introWanted = () => {
  if (!CAN_LIQUID) return false;
  try {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData) return false;
    if (sessionStorage.getItem(SEEN)) return false;
    sessionStorage.setItem(SEEN, '1');
  } catch {}
  return true;
};

export function LiquidIntro({ text, skip, onDone }) {
  const ref = useRef(null);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const scene = createLiquid(ref.current, { mode: 'intro', text, font: fontOf(), onDone });
    if (!scene) onDone();
    const safety = setTimeout(onDone, (INTRO_SECONDS + 1.5) * 1000);
    const esc = (e) => e.key === 'Escape' && onDone();
    addEventListener('keydown', esc);
    return () => {
      clearTimeout(safety);
      removeEventListener('keydown', esc);
      scene?.dispose();
    };
  }, [text, onDone]);
  return (
    <div className={`bk-intro${leaving ? ' is-leaving' : ''}`}>
      <canvas ref={ref} aria-hidden="true" />
      <button
        type="button"
        className="bk-intro__skip"
        onClick={() => {
          setLeaving(true);
          setTimeout(onDone, 250);
        }}
      >
        {skip}
      </button>
    </div>
  );
}
