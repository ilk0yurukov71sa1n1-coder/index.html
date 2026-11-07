import GhostFibers from '../reactbits/GhostFibers';

const isSmall = typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// GhostFibers fixed behind the whole page, in the logo's oxblood on off-white.
export default function SiteBackground() {
  return (
    <div className="site-bg" aria-hidden="true">
      <GhostFibers
        lightMode
        glowColor="#7d1d20"
        secondaryColor="#c9a59c"
        gradient="along"
        fiberStyle="dots"
        threads={isSmall ? 40 : 72}
        layers={isSmall ? 2 : 3}
        speed={0.25}
        scale={1.15}
        rotation={18}
        depthOfField={0.9}
        particles={0.2}
        sparkle={0.15}
        glow={0.6}
        vignette={0}
        grain={0.03}
        mouseInteraction={false}
        paused={reduce}
        dpr={isSmall ? 1 : 1.5}
      />
    </div>
  );
}
