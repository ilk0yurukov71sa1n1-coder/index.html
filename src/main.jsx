import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as site from './config/site';
import { loadLocale } from './config/i18n';
import './styles/global.css';

// Translate the site copy first, then load the app, so every section
// (including code that runs when a module loads) sees the chosen language.
loadLocale(site).then(async () => {
  const { default: App } = await import('./App');
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
