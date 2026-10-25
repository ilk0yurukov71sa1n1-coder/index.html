import { useEffect, useRef } from 'react';
import { createLiquid, liquidSupported } from './liquid';

const fontOf = () => {
  try {
    return getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  } catch {
    return 'system-ui, sans-serif';
  }
};

// Checked once: every Liquid Glass piece needs WebGL2 with float targets.
export const CAN_LIQUID = typeof window !== 'undefined' && liquidSupported();

// A click or touch reaches the water only on empty page: never on a control, a card or the bars.
const SOLID = 'a, button, input, textarea, select, label, form, [role="dialog"], .bk-step, .bk-bar, .bk-demo, .bk-ai, .bk-ai-open';
const touchable = (e) => !e.target?.closest?.(SOLID);

// The whole page background: the Liquid Glass scene, moved by the visitor's own scrolling.
export function LiquidBackdrop({ text }) {
  const ref = useRef(null);
  useEffect(() => {
    const scene = createLiquid(ref.current, { text, font: fontOf(), touchable });
    return () => scene?.dispose();
  }, [text]);
  return (
    <div className="bk-liquid" aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}
