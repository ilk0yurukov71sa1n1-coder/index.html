// Sends one email through Resend. Without RESEND_API_KEY nothing is sent.
// STUDIO_DB=memory records the emails instead, for the tests.
const env = process.env;
export const outbox = [];
export const mailReady = () => env.STUDIO_DB === 'memory' || Boolean(env.RESEND_API_KEY);

export const send = async ({ to, subject, html, replyTo }) => {
  if (env.STUDIO_DB === 'memory') {
    outbox.push({ to, subject, html });
    return true;
  }
  if (!env.RESEND_API_KEY) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM || 'Rollcfluence <onboarding@resend.dev>', to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) console.error(`mail failed: ${r.status}`);
    return r.ok;
  } catch {
    console.error('mail failed: network');
    return false;
  }
};
