// Blur in, from ilko's Text Motion Lab: each letter comes into focus in turn.
// Words never break in the middle; screen readers get the plain text once.
export default function BlurText({ text, from = 0 }) {
  let i = 0;
  return (
    <span className="bk-blur" aria-label={text} style={{ '--from': `${from}ms` }}>
      {text.split(' ').map((word, w) => (
        <span key={w} aria-hidden="true">
          {w > 0 && ' '}
          <span className="bk-blur__w">
            {[...word].map((ch, c) => (
              <span key={c} className="bk-blur__c" style={{ '--i': i++ }}>
                {ch}
              </span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}
