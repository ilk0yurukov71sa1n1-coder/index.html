import { how } from '../config/site';
import SectionHeading from '../components/ui/SectionHeading';
import Reveal from '../components/ui/Reveal';
import './HowItWorks.css';

export default function HowItWorks({ id }) {
  const { code } = how;
  return (
    <section id={id} className="section how">
      <div className="container">
        <SectionHeading index={how.index} label={how.label} title={how.title} />

        <div className="how__grid">
          <ol className="how__steps">
            {how.steps.map((s, i) => (
              <Reveal as="li" key={s.n} delay={i * 90}>
                <span className="how__n mono">{s.n}</span>
                <h3>{s.name}</h3>
                <p>{s.text}</p>
              </Reveal>
            ))}
          </ol>

          <Reveal className="how__code" delay={150}>
            <div className="how__code-bar mono">
              {code.file}
            </div>
            <pre className="mono" aria-label="Code change: swap the base URL and key">
              <code>
                <span className="c-k">const</span> ai = <span className="c-k">new</span> OpenAI({'{\n'}
                <span className="line del">-  {code.before}</span>{'\n'}
                <span className="line add">+  {code.after}</span>{'\n'}
                <span className="line del">-  {code.beforeKey}</span>{'\n'}
                <span className="line add">+  {code.afterKey}</span>{'\n'}
                {'});'}
              </code>
            </pre>
            <div className="how__code-foot mono">
              <span className="how__ok" aria-hidden="true" />2 lines changed · nothing else to install
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
