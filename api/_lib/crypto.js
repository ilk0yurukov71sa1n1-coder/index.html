// Keys, encryption and sessions for the dashboard and the gateway.
// ENCRYPTION_KEY: 64 hex chars (32 bytes), encrypts customers' provider keys.
// VERIFY_SECRET: signs login links and the session cookie.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getMany, redisReady, setValue } from './redis.js';

const env = process.env;

// Gateway keys: rk_live_ + 32 random bytes. We keep only the SHA-256.
export const newGatewayKey = () => {
  const key = `rk_live_${randomBytes(32).toString('base64url')}`;
  return { key, prefix: key.slice(0, 12), hash: hashKey(key) };
};
export const hashKey = (key) => createHash('sha256').update(String(key)).digest('hex');

const encKey = () => {
  const hex = String(env.ENCRYPTION_KEY || '');
  return /^[0-9a-f]{64}$/i.test(hex) ? Buffer.from(hex, 'hex') : null;
};
export const encryptionReady = () => Boolean(encKey());

// AES-256-GCM. Output: v1.iv.tag.ciphertext (base64url parts).
export const encrypt = (plain) => {
  const k = encKey();
  if (!k) throw new Error('encryption_unavailable');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', k, iv);
  const data = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return ['v1', iv, c.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
};

export const decrypt = (box) => {
  const k = encKey();
  if (!k) throw new Error('encryption_unavailable');
  const [v, iv, tag, data] = String(box).split('.');
  if (v !== 'v1') throw new Error('bad_ciphertext');
  const d = createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
};

// Signed, expiring tokens: base64url(json).hmac. Used for login links and
// the session cookie, each with its own purpose so one can't stand in for the other.
const sign = (payload) => createHmac('sha256', env.VERIFY_SECRET).update(payload).digest('base64url');
export const sessionReady = () => Boolean(env.VERIFY_SECRET);

export const makeSigned = (purpose, data, ttlMs) => {
  if (!env.VERIFY_SECRET) throw new Error('secret_unavailable');
  const payload = Buffer.from(JSON.stringify({ p: purpose, d: data, e: Date.now() + ttlMs })).toString('base64url');
  return `${payload}.${sign(payload)}`;
};

export const readSigned = (purpose, token) => {
  if (!env.VERIFY_SECRET || typeof token !== 'string' || token.length > 2000) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const want = Buffer.from(sign(payload));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const { p, d, e } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return p === purpose && e > Date.now() ? d : null;
  } catch {
    return null;
  }
};

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
export const COOKIE = 'rc_session';

export const setSession = (res, email) => {
  const token = makeSigned('session', { email, iat: Date.now() }, SESSION_MS);
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MS / 1000}`);
};
export const clearSession = (res) => res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);

const sessionData = (req) => {
  const raw = String(req.headers.cookie || '');
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? readSigned('session', m[1]) : null;
};
export const readSession = (req) => sessionData(req)?.email || null;

// Signing out ends every session of that account, on every device: sessions
// issued before the sign-out time stored in Redis are refused.
const signedOutKey = (email) => `signed-out:${email}`;
export const readLiveSession = async (req) => {
  const d = sessionData(req);
  if (!d?.email) return null;
  const got = await getMany([signedOutKey(d.email)]);
  // Upstash configured but not answering: a sign-out can't be checked, so the
  // session is refused until it answers again.
  if (!got && redisReady()) return null;
  const [after] = got || [null];
  return after && !(Number(d.iat) > after) ? null : d.email;
};
export const endAllSessions = (email) => setValue(signedOutKey(email), Date.now(), SESSION_MS / 1000);

export const adminEmails = () =>
  String(env.ADMIN_EMAILS || 'rollcfluence@gmail.com')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
export const isAdmin = (email) => Boolean(email) && adminEmails().includes(email);
