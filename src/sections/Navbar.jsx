import { useEffect, useState } from 'react';
import { brand, nav, links, ui } from '../config/site';
import LangSwitch from '../components/ui/LangSwitch';
import Logo from '../components/ui/Logo';
import './Navbar.css';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className={`nav ${scrolled ? 'is-scrolled' : ''} ${open ? 'is-open' : ''}`}>
      <div className="container nav__inner">
        <a href="#top" className="nav__brand" aria-label={`${brand.name} ${brand.product}, home`} onClick={close}>
          <Logo />
        </a>

        <nav className="nav__links" aria-label="Primary">
          {nav.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="nav__actions">
          <LangSwitch className="nav__lang" />
          <a href="/app" className="nav__login">{ui.signIn}</a>
          <a href={links.getKey} className="btn btn--primary btn--sm">{ui.join}</a>
          <button
            type="button"
            className="nav__toggle"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? ui.closeMenu : ui.openMenu}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>

      <div id="mobile-menu" className="nav__sheet" hidden={!open}>
        <nav className="container" aria-label="Mobile">
          {nav.map((item, i) => (
            <a key={item.href} href={item.href} onClick={close} style={{ '--i': i }}>
              <span className="mono">{String(i + 1).padStart(2, '0')}</span>
              {item.label}
            </a>
          ))}
          <a href={links.getKey} onClick={close} className="btn btn--primary">{ui.join}</a>
        </nav>
      </div>
    </header>
  );
}
