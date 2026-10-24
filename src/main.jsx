import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as site from './config/site';
import { loadLocale } from './config/i18n';
import ErrorBoundary, { CrashPage } from './components/ui/ErrorBoundary';
import './styles/global.css';

const root = createRoot(document.getElementById('root'));

// Translate the site copy first, then load the app, so every section
// (including code that runs when a module loads) sees the chosen language.
// If the translation fails the site still opens in English.
loadLocale(site)
  .catch(() => {})
  .then(() => import('./App'))
  .then(({ default: App }) => {
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>
    );
    try {
      sessionStorage.removeItem('rc-reloaded');
    } catch {}
  })
  .catch(() => {
    // Usually a stale tab after a new release: reload once to get fresh files.
    let tried = false;
    try {
      tried = sessionStorage.getItem('rc-reloaded') === '1';
      sessionStorage.setItem('rc-reloaded', '1');
    } catch {
      tried = true;
    }
    if (tried) root.render(<CrashPage />);
    else window.location.reload();
  });
