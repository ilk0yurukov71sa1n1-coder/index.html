// Fills the status page from /api/health. Shows only up/down, never details.
const set = (key, ok, okText, badText) => {
  const el = document.querySelector(`[data-key="${key}"]`);
  if (!el) return;
  el.textContent = ok ? okText : badText;
  el.className = `pill ${ok ? 'ok' : 'bad'}`;
};

fetch('/api/health', { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
  .then((h) => {
    set('api', true, 'Operational', 'Down');
    set('storage', h.storage, 'Connected', 'Not connected yet');
    set('rateLimit', h.rateLimit, 'Connected', 'Fallback mode');
  })
  .catch(() => {
    set('api', false, 'Operational', 'Down');
    set('storage', false, '', 'Unknown');
    set('rateLimit', false, '', 'Unknown');
  })
  .finally(() => {
    document.getElementById('checked').textContent = `Checked ${new Date().toLocaleString()}`;
  });
