// GET /api/health  Up/down for the status page. Reports only booleans.
import { health } from './_lib/shared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  return res.status(200).json(await health());
}
