"use client";

/**
 * HQ's effects kit: thin wrappers around the vendored React Bits components that
 * (1) use the Rollcfluence colours, (2) switch off for "Reduce motion", and (3) pause when the tab is hidden.
 */
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import BlurText from "./bits/BlurText/BlurText.tsx";
import CountUp from "./bits/CountUp/CountUp.tsx";
import SpotlightCard from "./bits/SpotlightCard/SpotlightCard.tsx";
import StarBorder from "./bits/StarBorder/StarBorder.tsx";
import ShinyText from "./bits/ShinyText/ShinyText.tsx";

const Aurora = lazy(() => import("./bits/Aurora/Aurora.tsx"));

export const BRAND = { violet: "#8b5cf6", rose: "#f43f5e", deep: "#3b0764" } as const;

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

/** The one WebGL background per screen. Loaded lazily, paused when hidden, static gradient for "Reduce motion". */
export function AuroraBackdrop() {
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  return (
    <div className="aurora-backdrop" aria-hidden="true">
      {reduced ? (
        <div className="aurora-static" />
      ) : (
        <Suspense fallback={<div className="aurora-static" />}>
          <Aurora colorStops={[BRAND.deep, BRAND.violet, BRAND.rose]} amplitude={1.1} blend={0.55} speed={0.6} paused={!visible} />
        </Suspense>
      )}
    </div>
  );
}

/** Page headline: words fade in from a blur once, when the page opens. */
export function PageTitle({ text, sub }: { text: string; sub?: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <header className="page-title">
      {reduced ? <h1>{text}</h1> : <h1 aria-label={text}><BlurText text={text} delay={60} animateBy="words" direction="top" className="blur-title" /></h1>}
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
    <span className="num" aria-label={text}>
      <span aria-hidden="true">
        <CountUp to={value} duration={1.1} separator="," />
      </span>
    </span>
  );
}

/** A glowing card. Clickable when onClick is given. */
export function GlowCard({ children, className = "", onClick, label }: { children: ReactNode; className?: string; onClick?: () => void; label?: string }) {
  const body = (
    <SpotlightCard className={`glow-card ${className}`} spotlightColor="rgba(168, 85, 247, 0.32)" intensity={0.5} borderGlow={0.7} spotlightSize={260}>
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

/** The main action on a screen: a button with a travelling light border. */
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
      color={BRAND.rose}
      trailColor={BRAND.violet}
      backgroundColor="#1d1530"
      textColor="#f5f3ff"
      borderColor="rgba(168, 85, 247, 0.35)"
      radius={10}
      duration={4}
    >
      {children}
    </StarBorder>
  );
}

/** The brand name with a slow light sweep. */
export function BrandName() {
  const reduced = useReducedMotion();
  if (reduced) return <strong className="brand-name">Rollcfluence HQ</strong>;
  return <ShinyText text="Rollcfluence HQ" className="brand-name" color="#ece9f5" shineColor="#f9a8d4" speed={4} />;
}
