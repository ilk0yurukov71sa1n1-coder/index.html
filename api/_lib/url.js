// Rejects anything that could point the server at itself or a private
// network: only public https hostnames on the default port. Used for alert
// webhooks and for OpenAI-compatible provider URLs.
export const publicHttps = (raw) => {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.port || u.username || u.password) return null;
  if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || host.startsWith('[')) return null;
  if (/(^|\.)(localhost|local|internal|lan|home|arpa)$/.test(host)) return null;
  return u;
};
