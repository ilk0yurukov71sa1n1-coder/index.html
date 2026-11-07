import { useEffect, useRef, useState } from 'react';

// Content is simply there as you scroll: no fade-ins on scroll (one of the
// site rules). Only the hero passes `animate`, so the first screen fades up
// once on load.
export default function Reveal({ as: Tag = 'div', delay = 0, className = '', animate = false, children, ...rest }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!animate) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [animate]);

  if (!animate) {
    return (
      <Tag ref={ref} className={className || undefined} {...rest}>
        {children}
      </Tag>
    );
  }

  return (
    <Tag
      ref={ref}
      className={`reveal ${inView ? 'is-in' : ''} ${className}`}
      style={{ '--delay': `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
