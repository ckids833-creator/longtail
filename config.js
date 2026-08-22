/* ============================================================
   Longtail — where the frontend finds the backend.

   This is the ONLY file you edit to point the site at a
   different API. Load it before data.js.
   ============================================================ */

/* 1. PRODUCTION API — set this after `npm run deploy` in the
      longtail-backend repo. It prints the URL when it finishes.

      e.g. 'https://longtail-backend.your-name.workers.dev'

      Leave it empty and the public site has no backend: every
      page will say so plainly rather than pretending. */
var PROD_API = 'https://longtail-backend.ckids833.workers.dev';

/* 2. Local development. Nothing to change. */
var DEV_API = 'http://127.0.0.1:8787';

/* Pick automatically, so nobody has to remember to flip it back
   before pushing. Served from localhost -> local Worker;
   served from anywhere else -> the deployed one. */
var IS_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

window.LONGTAIL_API = (IS_LOCAL ? DEV_API : PROD_API).replace(/\/+$/, '');

/* 3. When the API cannot be reached, may the site fall back to the
      sample guides bundled in data.js?

      Locally: yes, it keeps the UI workable offline.
      Publicly: NO. Those guides are invented. Showing them to a
      real visitor as though they were people waiting to walk with
      them is a lie, even during an outage. Real places are still
      shown — those are factual. */
window.LONGTAIL_ALLOW_DEMO_FALLBACK = IS_LOCAL;

/* Override per-page for testing without editing this file:
     explore.html?api=https://longtail-backend.example.workers.dev */
(function () {
  var override = new URLSearchParams(location.search).get('api');
  if (override) window.LONGTAIL_API = override.replace(/\/+$/, '');
})();
