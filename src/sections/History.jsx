import { history } from '../config/site';
import Timeline from '../components/ui/Timeline';

// Where AI key abuse came from, and the goals Rollcfluence is building toward.
export default function History({ id }) {
  return (
    <Timeline
      id={id}
      title={history.title}
      periodLabel={history.period}
      top={history.top}
      bottom={history.bottom}
      textColor="#1e1615"
      mutedTextColor="#685c59"
      activeColor="#7d1d20"
      imageUrl="/media/rc-glass.jpg"
      imageAlt="The Rollcfluence RC mark in glass"
      duration={1.4}
    />
  );
}
