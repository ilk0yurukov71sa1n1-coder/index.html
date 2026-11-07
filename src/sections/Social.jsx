import { social, links } from '../config/site';
import Reveal from '../components/ui/Reveal';
import './Social.css';

// Instagram: what we share there, with the official QR code.
export default function Social({ id }) {
  return (
    <section id={id} className="section social">
      <div className="container">
        <Reveal className="social__card">
          <div className="social__copy">
            <p className="kicker">
              <span className="kicker__index">IG</span>
              <span className="kicker__rule" aria-hidden="true" />
              <span>{social.label}</span>
            </p>
            <h2 className="social__title">{social.title}</h2>
            <p className="social__body">{social.body}</p>
            <ul className="social__points">
              {social.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <a className="btn btn--primary" href={links.instagram} target="_blank" rel="noopener noreferrer">
              {social.cta} <span className="social__handle">{social.handle}</span>
            </a>
          </div>
          <a className="social__qr" href={links.instagram} target="_blank" rel="noopener noreferrer">
            <img src="/media/instagram-qr.png" alt={social.qrAlt} width="640" height="735" loading="lazy" decoding="async" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
