import { footer, brand, ui } from '../config/site';
import Feedback from '../components/ui/Feedback';
import Logo from '../components/ui/Logo';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__feedback">
          <Feedback page="site" />
        </div>
        <div className="footer__top">
          <div className="footer__brand">
            <Logo />
            <p>{brand.tagline}.</p>
          </div>
          {footer.columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h4 className="mono">{col.title}</h4>
              {col.links.map(([label, href]) => (
                <a key={label} href={href}>{label}</a>
              ))}
            </nav>
          ))}
        </div>
        <div className="footer__bottom mono">
          <span>{footer.legal}</span>
          <a href="/status">{ui.status}</a>
        </div>
      </div>
      <div className="footer__wordmark" aria-hidden="true">rollcfluence</div>
    </footer>
  );
}
