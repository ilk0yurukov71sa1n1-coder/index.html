import { footer, brand } from '../config/site';
import Logo from '../components/ui/Logo';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
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
          <span><span className="footer__dot" aria-hidden="true" />All systems normal</span>
        </div>
      </div>
      <div className="footer__wordmark" aria-hidden="true">rollcfluence</div>
    </footer>
  );
}
