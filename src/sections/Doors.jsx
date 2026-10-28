import { doors } from "../config/site";
import SectionHeading from "../components/ui/SectionHeading";
import Reveal from "../components/ui/Reveal";
import "./Doors.css";

// Three ways in: a custom-design site, a landing page and Shield for agencies.
// Shown in this order; the data keeps agency at index 1 so translations stay put.
const ORDER = [0, 2, 1];
export default function Doors({ id }) {
  return (
    <section id={id} className="section doors">
      <div className="container">
        <SectionHeading
          index={doors.index}
          label={doors.label}
          title={doors.title}
        >
          {doors.body}
        </SectionHeading>

        <div className="doors__grid">
          {ORDER.filter((i) => doors.items[i]).map((i, n) => {
            const d = doors.items[i];
            return (
              <Reveal
                key={d.title}
                as="article"
                className={`doors__card${i === 0 ? " doors__card--local" : ""}`}
                delay={80 + n * 80}
              >
                <span className="doors__tag mono">{d.tag}</span>
                <h3>{d.title}</h3>
                <p className="doors__text">{d.text}</p>
                <ul>
                  {d.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <div className="doors__foot">
                  <a
                    className={`btn ${i === 0 ? "btn--primary" : "btn--ghost"}`}
                    href={d.cta.href}
                  >
                    {d.cta.label}{" "}
                    <span className="btn__arrow" aria-hidden="true">
                      →
                    </span>
                  </a>
                  <span className="doors__note">{d.note}</span>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
