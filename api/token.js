// Vercel serverless function — POST /api/token
// This is the only server-side code. It exists so the LiveKit secret
// stays on the server and never reaches the browser.

import { AccessToken, TrackSource } from 'livekit-server-sdk';

export default async function handler(req, res) {
  // Allow a frontend hosted elsewhere (e.g. GitHub Pages) to call this.
  // Set ALLOWED_ORIGIN in Vercel to lock it to your own site.
  const origin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }

  const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } = process.env;
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
    return res.status(500).json({
      error: 'Server is missing LiveKit keys. Add them in Vercel → Settings → Environment Variables, then redeploy.'
    });
  }

  try {
    const { room, name, role } = req.body || {};

    if (!room || !name || !['guide', 'traveler'].includes(role)) {
      return res.status(400).json({ error: 'Need room, name, and role (guide|traveler)' });
    }
    if (!/^[a-zA-Z0-9_-]{3,40}$/.test(room)) {
      return res.status(400).json({ error: 'Walk code: 3-40 letters, numbers, dash, underscore' });
    }

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: `${role}-${name}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      ttl: '3h',
    });

    at.addGrant({
      room,
      roomJoin: true,
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
      // Enum values, not strings — the SDK rejects strings.
      // Guide films; traveler can only talk.
      canPublishSources: role === 'guide'
        ? [TrackSource.CAMERA, TrackSource.MICROPHONE]
        : [TrackSource.MICROPHONE],
    });

    const token = await at.toJwt();
    return res.status(200).json({ token, url: LIVEKIT_URL });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not mint token' });
  }
}
