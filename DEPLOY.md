# Longtail — solo guide build

Two pages. `index.html` is yours. `watch.html` is theirs.
You are always the guide; there is no role to pick, and nothing for
your traveler to configure.

```
index.html      ← you (guide). Bookmark this one.
watch.html      ← your traveler. They only get this via your link.
api/token.js    ← runs on Vercel. You never touch it.
package.json
.gitignore
```

---

## Deploy (once, ~5 minutes)

1. Put these files in your GitHub repo, **at the root** — not inside a folder
2. **vercel.com** → sign in with GitHub → Add New → Project → pick the repo
3. Framework preset: **Other**. Leave build settings empty.
4. **Settings → Environment Variables**, add three:
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
   - `LIVEKIT_URL` — e.g. `wss://longtail-1ic9kx5n.livekit.cloud`
5. **Deploy**

Your guide page is `https://your-project.vercel.app/`
Bookmark it on your phone home screen.

**If you add the env variables after the first deploy, redeploy** —
Deployments → ⋯ → Redeploy. Vercel does not apply them retroactively.

---

## Running a walk

**You, before you leave the house:**
1. Open your guide page
2. Type a walk code — `yaowarat-01`, then `-02` next time
3. Tap **Copy link** or **Share…** and send it to your traveler
4. Tap **Start walking** → allow camera and mic

**Them, at the agreed time:**
1. Open your link
2. Type their name
3. Tap **Join the walk**

They see your street. They tap a direction or type one, and it lands
big on your screen with a buzz.

---

## What's on your screen while walking

- **TIME / EARNED / BATT** — battery is the one to watch on your first walk
- **Four tap buttons** — Stuttered, Lost signal, Went quiet, Great bit.
  Tap them as things happen; they go into your session file.
- **Mute / Flip / End walk**

When you end, you get a summary: time, what they'd have been charged,
your cut, battery used, and your tallies. Fill in the three debrief
questions and tap **Download this session** — it saves a JSON file.

**Download it every time.** Nothing is stored anywhere.

---

## First walk

Go alone first. Same setup, just don't send the link. Walk 45 minutes
down Yaowarat around 18:00 and narrate the whole way as if someone were
watching.

You're testing three things:
- Does the stream hold for 45 minutes while moving?
- How much battery does it cost, and how hot does the phone get?
- Can you talk continuously for 45 minutes? (Harder than it sounds.)

That walk tells you your real maximum session length. Everything else
is downstream of it.

---

## Practical

- Phone at 100%, power bank in your pocket
- Mobile data, not street wifi
- Wired earbuds with a mic — otherwise they hear Yaowarat, not you
- Lock rotation, phone at chest height
- Rear camera. If you see yourself, tap **Flip**.

---

## If something breaks

| Message | Fix |
|---|---|
| "The token server is not at that address" | You're on GitHub Pages, not Vercel. Use the Vercel URL. |
| "Server is missing LiveKit keys" | Env variables missing, or added without redeploying. |
| "This link is missing its walk code" | Traveler opened `watch.html` directly. Send the full link. |
| Camera won't open | Page must be `https://`. Close other camera apps. |
| They see nothing | They opened an old link with a different walk code. |

Anyone with the link can join. Fine for arranged tests — don't post it publicly.

---

## Changing your rate

In `index.html`, near the top of the script:

```js
const RATE = 15, FEE = 0.12;
```
