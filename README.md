# Longtail Live — real streaming, 20 minutes to set up

Two links. You open one on your phone as the guide; your traveler opens the other in any browser. Real video, real audio, real direction prompts.

---

## 1. Get LiveKit keys (5 min, free)

1. Sign up at **cloud.livekit.io** — the free tier gives you 5,000 participant-minutes a month, roughly 100 sessions of 25 minutes. Plenty for the whole pilot.
2. Create a project. Pick the **Singapore** region — closest to Bangkok, about 25ms away.
3. Go to **Settings → Keys** and create an API key. You get three values:
   - `API Key` (starts `API...`)
   - `API Secret`
   - `WebSocket URL` (looks like `wss://your-project.livekit.cloud`)

Keep the secret out of any file you commit or share. It never touches the browser — the server holds it.

---

## 2. Run it locally first (5 min)

```bash
cd longtail-live
npm install

LIVEKIT_API_KEY=APIxxxxx \
LIVEKIT_API_SECRET=your_secret_here \
LIVEKIT_URL=wss://your-project.livekit.cloud \
npm start
```

Open `http://localhost:3000`. Type a walk code like `test-01`, join as Guide. Open a second browser tab with the traveler link and join as Traveler. You should see yourself, and prompts should fly between tabs.

**localhost works for camera access. A file:// path does not.** That's why this is a server, not a loose HTML file.

---

## 3. Put it online so your phone and your traveler can reach it (10 min)

Deploy to **Render** (free tier):

1. Push this folder to a GitHub repo
2. render.com → New → Web Service → connect the repo
3. Build command: `npm install` · Start command: `npm start`
4. Add three environment variables: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`
5. Deploy → you get an `https://` URL

**Railway, Fly.io, and Cloudflare Workers all work the same way.** You need https — browsers refuse camera access on plain http, and Render gives it to you automatically.

Render's free tier sleeps after inactivity, so the first load after a quiet period takes ~30 seconds. Open the page a minute before your session starts.

---

## 4. Run a walk

**You (guide), on your phone:**
1. Open the https URL in Chrome
2. Name, walk code (`yaowarat-01`), role **Guide**
3. Copy the traveler link that appears and send it to them
4. Tap Join → allow camera and mic → you're streaming
5. Lock rotation, hold at chest height, rear camera

**Them (traveler), anywhere:**
1. Open the link you sent
2. Type their name → Join
3. They see your street, hear you, and can tap presets or type directions

Prompts appear big on your screen with a vibration. That's the product.

---

## What it does and doesn't do

**Does:** real WebRTC video and audio, sub-second latency, direction prompts over the data channel, camera flip, mute, reconnect on signal loss, screen wake-lock, a live baht meter, 540p capped at 1.2 Mbps to protect your battery and data.

**Doesn't:** payments, guide directory, accounts, bookings, safety escalation, recording. Nothing is recorded — deliberately, and that stays true in production.

**Anyone with the walk code can join.** Fine for testing with people you've arranged sessions with. Don't post a link publicly.

---

## If something breaks

**"Could not get a token"** — server is missing env vars, or Render is still waking up.

**Camera won't open** — you're on http, not https. Or another app has the camera; force-close your video call apps.

**Traveler sees nothing** — check you both typed the exact same walk code. Case matters.

**Stream freezes while walking** — that's a finding, not a bug. Log it. It's the thing you're testing.

**Phone gets hot** — expected at 540p over 40 minutes. Note how hot and how fast; it determines your real maximum session length.

---

## Tuning

In `public/index.html`, near the top of the script:

```js
const RATE = 15;   // ฿ per minute
const FEE  = 0.12; // platform cut
```

Video quality is in the `Room` options — drop to `h360.resolution` and 800 kbps if Yaowarat's network struggles. Lower resolution is almost always better than a stuttering stream; the traveler forgives softness but not freezing.
