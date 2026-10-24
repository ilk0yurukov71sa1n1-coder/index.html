import { useEffect, useState } from 'react';
import CometDial from '../components/reactbits/CometDial';

// The React Bits dial in the dashboard's colours: 200px on desktop, 170px
// on phones. Values are whole steps from 1 to `steps`; the caller shows the
// step's name next to it.
const PHONE = '(max-width: 520px)';
const phone = () => typeof window !== 'undefined' && window.matchMedia?.(PHONE).matches;

export default function Dial({ value, steps = 4, label, onChange }) {
  const [small, setSmall] = useState(phone);
  useEffect(() => {
    const mq = window.matchMedia?.(PHONE);
    if (!mq) return undefined;
    const on = () => setSmall(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  return (
    <CometDial
      className="dial"
      value={value}
      min={1}
      max={steps}
      step={1}
      unit={`/${steps}`}
      label={label}
      accent="#7d1d20"
      ink="#1e1615"
      size={small ? 170 : 200}
      sweep={280}
      thickness={6}
      speed={30}
      onChange={onChange}
      onChangeEnd={onChange}
    />
  );
}
