import { history } from '../config/site';
import Timeline from '../components/ui/Timeline';

// Where AI key abuse came from, and the goals Rollcfluence is building toward.
export default function History({ id }) {
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
