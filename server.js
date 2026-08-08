// Longtail — minimal token server + static host
// One process: serves the app AND mints LiveKit tokens.

import express from 'express';
import { AccessToken, TrackSource } from 'livekit-server-sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
  LIVEKIT_URL,
  PORT = 3000,
} = process.env;

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
  console.error('\nMissing env vars. You need all three:');
  console.error('  LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL\n');
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// The client asks for a token. The secret never leaves this server.
app.post('/token', async (req, res) => {
  try {
    const { room, name, role } = req.body || {};

    if (!room || !name || !['guide', 'traveler'].includes(role)) {
      return res.status(400).json({ error: 'Need room, name, and role (guide|traveler)' });
    }
    // Keep room names sane — they end up in URLs.
    if (!/^[a-zA-Z0-9_-]{3,40}$/.test(room)) {
      return res.status(400).json({ error: 'Room name: 3-40 letters, numbers, dash, underscore' });
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
      // Guide sends camera + mic. Traveler sends mic only — they're watching, not filming.
      // Must be TrackSource enum values, not strings — the SDK throws on strings.
      canPublishSources: role === 'guide'
        ? [TrackSource.CAMERA, TrackSource.MICROPHONE]
        : [TrackSource.MICROPHONE],
    });

    // v2 of the server SDK returns a Promise here.
    const token = await at.toJwt();
    res.json({ token, url: LIVEKIT_URL });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not mint token' });
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`\n  Longtail running on http://localhost:${PORT}`);
  console.log(`  LiveKit: ${LIVEKIT_URL}\n`);
});
