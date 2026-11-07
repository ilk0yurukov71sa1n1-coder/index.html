// IP allow-list matching. Entries are single IPv4/IPv6 addresses or IPv4
// CIDR ranges like 203.0.113.0/24.
const v4 = (s) => {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
};
const v6 = (s) => /^[0-9a-f:]+$/i.test(s) && s.includes(':') && s.length <= 39;

// Normalises one allow-list entry, or returns null if it is not valid.
export const cleanEntry = (raw) => {
  const s = String(raw).trim().toLowerCase();
  const [addr, bits, extra] = s.split('/');
  if (extra !== undefined) return null;
  if (v4(addr) !== null) {
    if (bits === undefined) return addr;
    const n = Number(bits);
    return /^\d{1,2}$/.test(bits) && n >= 8 && n <= 32 ? `${addr}/${n}` : null;
  }
  return bits === undefined && v6(addr) ? addr : null;
};

export const ipAllowed = (ip, list) => {
  const addr = String(ip || '').trim().toLowerCase().replace(/^::ffff:/, '');
  if (!addr) return false;
  const n = v4(addr);
  return list.some((entry) => {
    const [base, bits] = entry.split('/');
    if (bits === undefined) return base === addr;
    if (n === null) return false;
    const b = v4(base);
    const mask = Number(bits) === 32 ? 0xffffffff : (~((1 << (32 - Number(bits))) - 1)) >>> 0;
    return ((n & mask) >>> 0) === ((b & mask) >>> 0);
  });
};
