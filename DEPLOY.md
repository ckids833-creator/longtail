# Longtail Live — deploy from GitHub, no terminal

GitHub Pages can't work for this: it only serves static files, so `/token` returns a web page instead of JSON. That's the `Unexpected token '<'` error you saw.

Vercel serves the page **and** runs the token endpoint, deploying straight from your repo. Nothing to install, nothing to run.

---

## Rotate your API secret first

Your secret was visible in a screenshot. Before anything else:

1. **cloud.livekit.io** → your project → **Settings → Keys**
2. Delete the old key, create a new one
3. Keep the new key, secret, and WebSocket URL handy for step 3 below

---

## 1. Put these files in your repo

Your repo should look exactly like this — **`index.html` at the root**, not inside `public/`:

```
your-repo/
├── index.html
├── package.json
├── .gitignore
└── api/
    └── token.js
```

Delete `server.js`, `README.md` from the old version, and any `public/` folder. They're the terminal-based approach and you don't need them.

You can do this entirely in the GitHub web interface — "Add file → Upload files", drag them in, commit.

## 2. Connect Vercel

1. **vercel.com** → sign in with GitHub
2. **Add New → Project** → pick your repo
3. Framework preset: **Other**. Leave build and output settings empty.
4. Don't deploy yet — do step 3 first

## 3. Add your keys

Still on the setup screen (or later under **Settings → Environment Variables**), add three:

| Name | Value |
|---|---|
| `LIVEKIT_API_KEY` | `API...` from LiveKit |
| `LIVEKIT_API_SECRET` | your new secret |
| `LIVEKIT_URL` | `wss://longtail-1ic9kx5n.livekit.cloud` |

Then **Deploy**. About a minute later you have a public URL like `https://longtail-live.vercel.app`.

**If you add the variables after deploying, you must redeploy** — Deployments → ⋯ → Redeploy. Environment variables aren't picked up retroactively.

---

## Using it

Open your Vercel URL on your phone:

1. Your name, a walk code like `yaowarat-01`, role **Guide**
2. Copy the traveler link that appears, send it to whoever you're testing with
3. Join → allow camera and mic → you're live

They open the link in any browser. No app, no account, no install.

Every push to GitHub redeploys automatically. Editing `index.html` in the GitHub web editor is enough to ship a change.

---

## Why a server is still involved

The LiveKit secret can mint unlimited tokens for your account. If it were in `index.html`, anyone could view-source it and use your quota — or join walks uninvited.

`api/token.js` runs on Vercel's servers, not in the browser. It checks the request, then hands back a short-lived token scoped to one room. The secret never leaves Vercel. This is also what enforces that travelers can't publish video — that rule lives in the token, so a modified client can't bypass it.

You're not running the server. It just exists.

---

## If it still breaks

**405 on /api/token** — `api/token.js` isn't in the repo, or it's in the wrong place. It must be `api/token.js` at the repo root.

**"Server is missing LiveKit keys"** — variables not added, or added after deploying without a redeploy.

**Page loads but camera won't open** — check the URL starts `https://`. Vercel gives you that automatically, so this usually means you're still opening a local file.

**"Could not mint token"** — the secret is wrong or has a stray space. Paste it fresh from LiveKit.

**Traveler sees nothing** — you both need the exact same walk code. Case matters.
