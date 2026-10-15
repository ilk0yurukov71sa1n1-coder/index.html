"use client";

/**
 * Rollcfluence effects kit: thin wrappers around the vendored React Bits components that
 * (1) use the Oxblood palette, (2) switch off when macOS "Reduce motion" is on, and
 * (3) pause the background when the tab is hidden. Screen readers always get plain text.
 */
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import BlurText from "./bits/BlurText/BlurText.tsx";
import CountUp from "./bits/CountUp/CountUp.tsx";
import SpotlightCard from "./bits/SpotlightCard/SpotlightCard.tsx";
import StarBorder from "./bits/StarBorder/StarBorder.tsx";
import ShinyText from "./bits/ShinyText/ShinyText.tsx";
import DecryptedText from "./bits/DecryptedText/DecryptedText.tsx";
import RotatingText from "./bits/RotatingText/RotatingText.tsx";

const Aurora = lazy(() => import("./bits/Aurora/Aurora.tsx"));

export const BRAND = {
  oxblood: "#2b0508",
  deep: "#5e0a10",
  blood: "#9b0f18",
  bright: "#cf2430",
  bone: "#ede8e0",
  tint: "#f2b3ad",
} as const;

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/** The one WebGL background per screen: loaded lazily, paused when hidden, a still gradient for "Reduce motion". */
export function AuroraBackdrop() {
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  return (
    <div className="aurora-backdrop" aria-hidden="true">
      {reduced ? (
        <div className="aurora-static" />
      ) : (
        <Suspense fallback={<div className="aurora-static" />}>
          <Aurora colorStops={[BRAND.oxblood, BRAND.blood, BRAND.bright]} amplitude={0.9} blend={0.62} speed={0.45} paused={!visible} />
        </Suspense>
      )}
    </div>
  );
}

/** Page headline: an optional eyebrow line, then words that fade in from a blur once. */
export function PageTitle({ text, sub, eyebrow }: { text: string; sub?: ReactNode; eyebrow?: string }) {
  const reduced = useReducedMotion();
  return (
    <header className="page-title">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      {reduced ? (
        <h1>{text}</h1>
      ) : (
        <>
          {/* The animation is drawn with block elements, which can't live inside a heading, so the real <h1> is for screen readers. */}
          <h1 className="sr-only">{text}</h1>
          <div className="h1" aria-hidden="true">
            <BlurText text={text} delay={55} animateBy="words" direction="top" className="blur-title" />
          </div>
        </>
      )}
      {sub && <p className="muted">{sub}</p>}
    </header>
  );
}

/** A number that counts up when it appears. Screen readers get the final value straight away. */
export function Num({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const reduced = useReducedMotion();
  const text = value.toLocaleString("en-GB", { maximumFractionDigits: decimals });
  if (reduced) return <span className="num">{text}</span>;
  return (
    <span className="num">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        <CountUp to={value} duration={1.1} separator="," />
      </span>
    </span>
  );
}

/** A word that decodes into place when it appears, e.g. the verdict. */
export function Decrypt({ text, className = "" }: { text: string; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <span className={className}>{text}</span>;
  // Screen readers get the real word at once; the scramble is visual only.
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        <DecryptedText
          key={text}
          text={text}
          animateOn="view"
          sequential
          revealDirection="start"
          speed={38}
          maxIterations={14}
          characters="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*"
          encryptedClassName="decrypt-encrypted"
        />
      </span>
    </span>
  );
}

/** A phrase that cycles through options (e.g. today's priorities). Shows the first one, still, for "Reduce motion". */
export function Rotating({ texts, className = "" }: { texts: string[]; className?: string }) {
  const reduced = useReducedMotion();
  const list = texts.length ? texts : [""];
  if (reduced || list.length === 1) return <span className={className}>{list[0]}</span>;
  return (
    <RotatingText
      texts={list}
      mainClassName={className}
      splitBy="words"
      staggerDuration={0.03}
      staggerFrom="first"
      rotationInterval={3200}
      initial={{ y: "70%", opacity: 0, filter: "blur(6px)" }}
      animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
      exit={{ y: "-60%", opacity: 0, filter: "blur(6px)" }}
      transition={{ type: "spring", damping: 28, stiffness: 260 }}
    />
  );
}

/** A glowing card. Becomes a button when onClick is given. */
export function GlowCard({ children, className = "", onClick, label }: { children: ReactNode; className?: string; onClick?: () => void; label?: string }) {
  const body = (
    <SpotlightCard className={`glow-card ${className}`} spotlightColor="rgba(207, 36, 48, 0.24)" intensity={0.45} borderGlow={0.65} spotlightSize={280}>
      {children}
    </SpotlightCard>
  );
  if (!onClick) return body;
  return (
    <button type="button" className="card-button" onClick={onClick} aria-label={label}>
      {body}
    </button>
  );
}

/** The main action on a screen: a button with light travelling around its border. */
export function PrimaryButton({ children, onClick, disabled, type = "button" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  const reduced = useReducedMotion();
  if (reduced) {
    return (
      <button type={type} className="primary" onClick={onClick} disabled={disabled}>
        {children}
      </button>
    );
  }
  return (
    <StarBorder
      as="button"
      type={type}
      className="primary-star"
      onClick={onClick}
      disabled={disabled}
      color={BRAND.bright}
      trailColor={BRAND.deep}
      backgroundColor="#1a0b0c"
      textColor={BRAND.bone}
      borderColor="rgba(207, 36, 48, 0.42)"
      radius={10}
      duration={4.2}
    >
      {children}
    </StarBorder>
  );
}

/** The product name with a slow, pale light sweep. */
export function BrandName({ text = "Rollcfluence HQ" }: { text?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <strong className="brand-name">{text}</strong>;
  return <ShinyText text={text} className="brand-name" color={BRAND.bone} shineColor={BRAND.tint} speed={5} />;
}
