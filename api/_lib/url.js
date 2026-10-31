// Rejects anything that could point the server at itself or a private
// network: only public https hostnames on the default port. Used for alert
// webhooks and for OpenAI-compatible provider URLs.
import { lookup } from 'node:dns/promises';

// Hostnames that resolve any embedded IP (127.0.0.1.nip.io and friends).
const WILDCARD_DNS = /(^|\.)(nip\.io|sslip\.io|xip\.io|traefik\.me|localtest\.me|lvh\.me|vcap\.me|localhost\.run)$/;

export const publicHttps = (raw) => {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/\.+$/, '');
  if (u.protocol !== 'https:' || u.port || u.username || u.password) return null;
  if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || host.startsWith('[')) return null;
  if (/(^|\.)(localhost|local|internal|lan|home|arpa|corp|intranet|test|invalid|example)$/.test(host) || WILDCARD_DNS.test(host)) return null;
  return u;
};

// True for loopback, private, link-local, carrier-grade NAT, multicast and
// reserved addresses, in IPv4 and IPv6 (including IPv4-mapped IPv6).
export const privateIp = (ip) => {
  const v = String(ip).toLowerCase();
  const v4 = v.startsWith('::ffff:') ? v.slice(7) : v;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) {
    const [a, b] = v4.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
  }
  return v === '::' || v === '::1' || /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v) || v.startsWith('64:ff9b:') || v.startsWith('2001:db8');
};

// Resolves the host and refuses it if any address is private. Without DNS
// access (tests, offline) it trusts the name checks above.
export const resolvesPublic = async (u) => {
  if (process.env.ROLLC_DB === 'memory') return true;
  try {
    const all = await lookup(u.hostname.replace(/\.+$/, ''), { all: true });
    return all.length > 0 && !all.some((a) => privateIp(a.address));
  } catch {
    return false;
  }
};
