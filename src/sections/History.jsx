import { useSyncExternalStore } from 'react';
import { history } from '../config/site';
import Timeline from '../components/ui/Timeline';
import TimelineList from '../components/ui/TimelineList';

const PHONE = '(max-width: 699px)';
const subscribe = (cb) => {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const isPhone = () => window.matchMedia(PHONE).matches;

// Where AI key abuse came from, and the goals Rollcfluence is building toward.
// Phones get a vertical list; wider screens get the sideways scroll timeline.
export default function History({ id }) {
  const phone = useSyncExternalStore(subscribe, isPhone, () => false);
  if (phone) {
    return (
      <TimelineList
        id={id}
        label={history.label}
        title={history.title}
        periodLabel={history.period}
        items={[...history.top, ...history.bottom].sort((a, b) => a.order - b.order)}
        imageUrl="/media/rc-glass.jpg"
        imageAlt="The Rollcfluence RC mark in glass"
      />
    );
  }
  return (
    <Timeline
      id={id}
      title={history.title}
      label={history.label}
      hint={history.hint}
      periodLabel={history.period}
      top={history.top}
      bottom={history.bottom}
      textColor="#f4f1ec"
      mutedTextColor="rgba(244, 241, 236, 0.7)"
      activeColor="#c23a42"
      backgroundColor="#150b0b"
      imageUrl="/media/rc-glass.jpg"
      imageAlt="The Rollcfluence RC mark in glass"
      duration={1.4}
    />
  );
}
