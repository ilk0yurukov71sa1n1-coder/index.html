import { motion, useReducedMotion } from 'motion/react';
import './TextScanner.css';

// Text with a scan line sweeping across it (from 21st.dev "animated-text-10",
// ported to plain JS + CSS). The letters light up where the line passes.
export default function TextScanner({ text = 'SCANNER', className = '', inkColor = 'var(--text)', accentColor = 'var(--accent)', duration = 2.6 }) {
  const reduced = useReducedMotion();
  const cls = `text-scanner ${className}`.trim();
  if (reduced) return <span className={cls} style={{ color: inkColor }}>{text}</span>;

  const loop = { duration, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' };
  return (
    <motion.span
      className={cls}
      style={{
        backgroundImage: `linear-gradient(90deg, color-mix(in srgb, ${inkColor} 25%, transparent) 0 40%, ${inkColor} 50%, color-mix(in srgb, ${inkColor} 25%, transparent) 60% 100%)`,
        backgroundSize: '240% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
      }}
      animate={{ backgroundPosition: ['100% 0', '0% 0'] }}
      transition={loop}
    >
      {text}
      <motion.span
        aria-hidden="true"
        className="text-scanner__line"
        style={{ background: accentColor, boxShadow: `0 0 14px ${accentColor}` }}
        animate={{ left: ['0%', '100%'], x: ['0%', '-100%'] }}
        transition={loop}
      />
    </motion.span>
  );
}
