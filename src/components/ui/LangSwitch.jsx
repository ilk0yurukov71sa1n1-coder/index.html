import { ui } from '../../config/site';
import { LANGS, currentLang, setLang } from '../../config/i18n';
import './LangSwitch.css';

// Language picker. Choosing one reloads the page in that language.
export default function LangSwitch({ className = '' }) {
  const lang = currentLang();
  return (
    <label className={`lang ${className}`}>
      <span className="lang__code mono" aria-hidden="true">{lang.toUpperCase()}</span>
      <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={ui.language}>
        {LANGS.map(([code, name]) => (
          <option key={code} value={code} lang={code}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
