import GlassSurface from '../reactbits/GlassSurface';
import './GlassButton.css';

// A link that sits on React Bits GlassSurface. The glass bends what is behind
// it in Chromium; Safari and Firefox get the frosted version of the same look.
// tone="red" adds the brand red on top so the main action still stands out.
export default function GlassButton({ href, tone = 'clear', className = '', children, ...rest }) {
  return (
    <a href={href} className={`glass-btn glass-btn--${tone} ${className}`.trim()} {...rest}>
      <GlassSurface
        className="glass-btn__glass"
        width="100%"
        height="100%"
        borderRadius={24}
        borderWidth={0.09}
        distortionScale={-120}
        blur={9}
        backgroundOpacity={tone === 'red' ? 0 : 0.08}
        saturation={1.4}
      />
      <span className="glass-btn__label">{children}</span>
    </a>
  );
}
