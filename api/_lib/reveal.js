// One-time key reveal. The welcome email links to /app#reveal=<token>
// instead of carrying the key. The key waits in Redis, encrypted, for 7 days,
// and the signed-in account it belongs to can read it exactly once.
import { randomBytes } from 'node:crypto';
import { decrypt, encrypt, hashKey } from './crypto.js';
import { getText, once, peek, setText } from './redis.js';

export const REVEAL_S = 7 * 86400;
const slot = (token) => `reveal:${hashKey(token)}`;

// Stores the key and returns the token for the link.
export const holdKey = async (accountId, key) => {
  const token = randomBytes(24).toString('base64url');
  await setText(slot(token), encrypt(JSON.stringify({ a: accountId, k: key })), REVEAL_S);
  return token;
};

// Wipes a waiting key (used when the email could not be sent).
export const dropKey = (token) => setText(slot(token), '', 1);

// Returns { secret } once, or { error }: not_found for a wrong or expired
// token or another account, reveal_used after the first time.
export const takeKey = async (accountId, token) => {
  if (typeof token !== 'string' || !/^[\w-]{20,64}$/.test(token)) return { error: 'not_found' };
  const stored = await getText(slot(token));
  if (!stored) return { error: (await peek(`revealed:${hashKey(token)}`)) ? 'reveal_used' : 'not_found' };
  let held;
  try {
    held = JSON.parse(decrypt(stored));
  } catch {
    return { error: 'not_found' };
  }
  if (held.a !== accountId) return { error: 'not_found' };
  if (!(await once(`revealed:${hashKey(token)}`, REVEAL_S))) return { error: 'reveal_used' };
  await dropKey(token);
  return { secret: held.k };
};
