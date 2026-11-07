import { useEffect, useState } from 'react';
import LineSidebar from '../reactbits/LineSidebar';
import { pageIndex } from '../../config/site';
import './PageIndex.css';

// Fixed page index on the left (wide screens only). Clicking jumps to the
// section; scrolling highlights the section in view.
export default function PageIndex() {
  const { items, label } = pageIndex;
  const [active, setActive] = useState(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const els = items.map((it) => document.getElementById(it.id));
    const onScroll = () => {
      setShown(window.scrollY > window.innerHeight * 0.6);
      const line = window.innerHeight * 0.4;
      let current = null;
      els.forEach((el, i) => {
        if (el && el.getBoundingClientRect().top <= line) current = i;
      });
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [items]);

  const go = (i) => {
    const el = document.getElementById(items[i].id);
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', `#${items[i].id}`);
  };

  return (
    <div className={`page-index${shown ? ' is-shown' : ''}`}>
      <LineSidebar
        ariaLabel={label}
        items={items.map((it) => it.label)}
        accentColor="#7d1d20"
        textColor="#6f6764"
        markerColor="#b9b1ab"
        showIndex
        showMarker
        proximityRadius={70}
        maxShift={10}
        falloff="smooth"
        markerLength={22}
        markerGap={10}
        tickScale={0.45}
        scaleTick
        itemGap={10}
        fontSize={0.78}
        smoothing={110}
        active={active}
        onItemClick={go}
      />
    </div>
  );
}
