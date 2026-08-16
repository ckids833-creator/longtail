/* ============================================================
   Longtail — where the frontend finds the backend.

   This is the ONLY file you edit to point the site at a different
   API. Load it before data.js.

   Local development, with the Worker running via `wrangler dev`:
       'http://127.0.0.1:8787'

   Deployed:
       'https://longtail-backend.<your-subdomain>.workers.dev'

   Empty string ('') turns the API off entirely: the pages fall back
   to the demo guides and places bundled in data.js, and the guide
   sign-in stops working. Useful for showing the UI with no backend.

   Whatever you put here must also appear in ALLOWED_ORIGINS on the
   Worker — the other direction of the same handshake.
   ============================================================ */

window.LONGTAIL_API = 'http://127.0.0.1:8787';

/* Override per-page for testing without editing this file:
     explore.html?api=https://longtail-backend.example.workers.dev   */
(function () {
  var override = new URLSearchParams(location.search).get('api');
  if (override) window.LONGTAIL_API = override.replace(/\/+$/, '');
})();
