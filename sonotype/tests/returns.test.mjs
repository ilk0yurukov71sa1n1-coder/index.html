// "Clients who return": who gets which email, the run, and the stop link.
// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.STUDIO_DB = 'memory';
process.env.CRON_SECRET = 'cron-test-secret';
process.env.RETURNS_SECRET = 'returns-test-secret';

const { pickEmails, addDays, todayIn, stopToken, readStopToken, emailHash, compose } = await import('../api/_lib/returns.js');
const { DEMO } = await import('../api/_lib/businesses.js');
const { mem } = await import('../api/_lib/store.js');
const { outbox } = await import('../api/_lib/mail.js');
const returns = (await import('../api/returns.js')).default;
const stop = (await import('../api/stop.js')).default;

const NOW = new Date('2026-11-10T12:00:00Z');
const TODAY = todayIn(DEMO.tz, NOW); // 2026-11-10 in Sofia
const BIZ = { ...DEMO, reviewUrl: 'https://g.page/r/example/review' };
let id = 0;
const row = (o) => ({ id: ++id, business: BIZ.id, service: 'cut-men', start_min: 600, name: 'Ivan Petrov', email: 'ivan@example.com', lang: 'bg', status: 'confirmed', email_consent: true, reminded_at: null, review_asked_at: null, winback_at: null, ...o });

test('reminder goes out the day before, once, to anyone with an email', () => {
  const rows = [
    row({ day: addDays(TODAY, 1) }),
    row({ day: addDays(TODAY, 1), email: null }),
    row({ day: addDays(TODAY, 1), email: 'a@example.com', reminded_at: '2026-11-09T15:00:00Z' }),
    row({ day: addDays(TODAY, 1), email: 'b@example.com', status: 'cancelled' }),
    row({ day: addDays(TODAY, 2), email: 'c@example.com' }),
    row({ day: addDays(TODAY, 1), email: 'd@example.com', email_consent: false }),
  ];
  const { reminders } = pickEmails(BIZ, rows, new Set(), NOW);
  assert.deepEqual(reminders.map((r) => r.email), ['ivan@example.com', 'd@example.com']);
});

test('review request needs consent, a Google link, a real visit, and only once per 90 days', () => {
  const rows = [
    row({ day: addDays(TODAY, -1), email: 'yes@example.com' }),
    row({ day: addDays(TODAY, -1), email: 'noconsent@example.com', email_consent: false }),
    row({ day: addDays(TODAY, -1), email: 'noshow@example.com', status: 'no_show' }),
    row({ day: addDays(TODAY, -1), email: 'asked@example.com' }),
    row({ day: addDays(TODAY, -40), email: 'asked@example.com', review_asked_at: new Date(NOW - 39 * 864e5).toISOString() }),
    row({ day: TODAY, email: 'today@example.com' }),
    row({ day: addDays(TODAY, -9), email: 'old@example.com' }),
  ];
  assert.deepEqual(pickEmails(BIZ, rows, new Set(), NOW).reviews.map((r) => r.email), ['yes@example.com']);
  assert.equal(pickEmails(DEMO, rows, new Set(), NOW).reviews.length, 0, 'no review link, no review emails');
});

test('win-back when the service is due, with consent, and nothing booked yet', () => {
  const rows = [
    row({ day: addDays(TODAY, -28), email: 'due@example.com' }),
    row({ day: addDays(TODAY, -28), email: 'booked@example.com' }),
    row({ day: addDays(TODAY, 5), email: 'booked@example.com' }),
    row({ day: addDays(TODAY, -10), email: 'early@example.com' }),
    row({ day: addDays(TODAY, -28), email: 'blowdry@example.com', service: 'blow-dry' }),
    row({ day: addDays(TODAY, -28), email: 'nope@example.com', email_consent: false }),
    row({ day: addDays(TODAY, -60), email: 'came@example.com' }),
    row({ day: addDays(TODAY, -28), email: 'came@example.com', winback_at: null }),
    row({ day: addDays(TODAY, -29), email: 'recent@example.com' }),
    row({ day: addDays(TODAY, -80), email: 'recent@example.com', winback_at: new Date(NOW - 20 * 864e5).toISOString() }),
  ];
  assert.deepEqual(pickEmails(BIZ, rows, new Set(), NOW).winbacks.map((r) => r.email).sort(), ['came@example.com', 'due@example.com']);
});

test('opted-out addresses get nothing at all', () => {
  const rows = [row({ day: addDays(TODAY, 1), email: 'Out@Example.com' }), row({ day: addDays(TODAY, -1), email: 'out@example.com' })];
  const out = new Set([emailHash(BIZ.id, 'out@example.com')]);
  const p = pickEmails(BIZ, rows, out, NOW);
  assert.equal(p.reminders.length + p.reviews.length + p.winbacks.length, 0);
});

test('emails never carry the free-text note and always have a stop link', () => {
  const b = row({ day: addDays(TODAY, 1), note: 'call me <script>' , name: '<b>Ivan</b>' });
  for (const kind of ['reminder', 'review', 'winback']) {
    const m = compose(kind, BIZ, b, 'https://x.test/api/stop?t=abc');
    assert.ok(!m.html.includes('call me'));
    assert.ok(!m.html.includes('<b>Ivan'));
    assert.ok(m.html.includes('/api/stop?t=abc'));
  }
});

test('stop tokens are signed and cannot be forged', () => {
  const t = stopToken('s', 'demo-salon', 'A@B.com');
  assert.deepEqual(readStopToken('s', t), { business: 'demo-salon', email: 'a@b.com' });
  assert.equal(readStopToken('other', t), null);
  assert.equal(readStopToken('s', t.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'))), null);
  assert.equal(readStopToken('s', 'nope'), null);
});

const fakeRes = () => {
  const r = { code: 0, body: null, headers: {} };
  r.status = (c) => ((r.code = c), r);
  r.json = (b) => ((r.body = b), r);
  r.send = (b) => ((r.body = b), r);
  r.setHeader = (k, v) => (r.headers[k] = v);
  return r;
};

test('the daily run needs the cron secret, sends, and marks so it never repeats', async () => {
  const today = todayIn(DEMO.tz);
  mem.bookings.push(row({ day: addDays(today, 1), email: 'run@example.com' }));
  let res = fakeRes();
  await returns({ headers: { authorization: 'Bearer wrong' } }, res);
  assert.equal(res.code, 401);
  res = fakeRes();
  await returns({ headers: { authorization: 'Bearer cron-test-secret' } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.sent['demo-salon'].reminder, 1);
  assert.equal(outbox.at(-1).to, 'run@example.com');
  res = fakeRes();
  await returns({ headers: { authorization: 'Bearer cron-test-secret' } }, res);
  assert.equal(res.body.sent['demo-salon'].reminder, 0, 'second run sends nothing new');
});

test('two runs at the same moment send each email once', async () => {
  const today = todayIn(DEMO.tz);
  mem.bookings.push(row({ day: addDays(today, 1), email: 'twice@example.com' }));
  const before = outbox.length;
  const a = fakeRes();
  const b = fakeRes();
  await Promise.all([returns({ headers: { authorization: 'Bearer cron-test-secret' } }, a), returns({ headers: { authorization: 'Bearer cron-test-secret' } }, b)]);
  assert.equal(outbox.slice(before).filter((m) => m.to === 'twice@example.com').length, 1);
});

test('stop link: GET only asks, POST opts out', async () => {
  const t = stopToken('returns-test-secret', 'demo-salon', 'stop@example.com');
  let res = fakeRes();
  await stop({ method: 'GET', query: { t } }, res);
  assert.equal(res.code, 200);
  assert.equal(mem.optouts.length, 0);
  res = fakeRes();
  await stop({ method: 'POST', body: { t } }, res);
  assert.equal(res.code, 200);
  assert.equal(mem.optouts[0].email_hash, emailHash('demo-salon', 'stop@example.com'));
  res = fakeRes();
  await stop({ method: 'POST', body: { t: 'forged.token' } }, res);
  assert.equal(res.code, 400);
});
