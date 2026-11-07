import { useEffect, useRef, useState } from 'react';

// Renders `children` only once the placeholder gets close to the viewport.
// Used for WebGL pieces so they don't cost anything until needed.
export default function LazyMount({ children, minHeight, margin = '400px', className = '' }) {
  const ref = useRef(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: margin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);

  return (
    <div ref={ref} className={className} style={{ minHeight }}>
      {show ? children : null}
    </div>
  );
}
