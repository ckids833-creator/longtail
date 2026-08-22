/* ============================================================
   Longtail — push subscription + the ringing alert

   Two separate things, both needed:

   1. Web Push, so a request reaches a phone with the app closed.
      The page registers the service worker, subscribes, and hands
      the token to the worker via IndexedDB so it can name who is
      asking.

   2. A ring while a page IS open — a repeating chime rather than
      one chirp, because a guide is usually carrying the phone,
      not watching it.

   Honest limits, so nobody is surprised:
     - A web page cannot ring like a phone call. The OS decides
       what a notification sounds like and plays it once.
     - Safari on iPhone only allows push when the site has been
       added to the Home Screen (iOS 16.4+).
   ============================================================ */

window.LTPush = (function () {
  'use strict';

  var DB_NAME = 'longtail', STORE = 'kv';
  var ringTimer = null, ringCtx = null;

  function apiBase(){ return (window.LONGTAIL_API || '').replace(/\/+$/, ''); }
  function token(){ try { return localStorage.getItem('lt_token') || ''; } catch (e) { return ''; } }

  /* ---- tiny IndexedDB, the only storage a service worker can read ---- */
  function idb(){
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function kvSet(key, value){
    return idb().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key);
        tx.onsuccess = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      });
    }).catch(function () { return false; });
  }

  /* ---- capability ---- */
  function supported(){
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  /** iOS only allows push from an installed PWA, and says so nowhere. */
  function iosNeedsInstall(){
    var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var installed = window.matchMedia('(display-mode: standalone)').matches ||
                    window.navigator.standalone === true;
    return ios && !installed;
  }

  function urlB64ToUint8Array(base64){
    var padding = '='.repeat((4 - (base64.length % 4)) % 4);
    var raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, function (c) { return c.charCodeAt(0); });
  }

  /* ---- registration + subscription ---- */

  function register(){
    if (!supported()) return Promise.resolve(null);
    // Scope matters on GitHub Pages, where the site lives under /longtail/.
    var scope = location.pathname.replace(/[^/]*$/, '');
    return navigator.serviceWorker.register(scope + 'sw.js', { scope: scope })
      .catch(function (e) { console.warn('[push] service worker refused:', e.message); return null; });
  }

  /**
   * Full path: permission -> subscribe -> tell the server.
   * Must be called from a click; browsers refuse permission otherwise.
   */
  function enable(){
    if (!supported()){
      return Promise.resolve({ ok: false, reason: 'This browser cannot do background notifications.' });
    }
    if (iosNeedsInstall()){
      return Promise.resolve({
        ok: false,
        reason: 'On iPhone, add Longtail to your Home Screen first — Safari only allows ' +
                'notifications for installed apps. Share → Add to Home Screen, then open it from there.'
      });
    }

    var base = apiBase();
    if (!base) return Promise.resolve({ ok: false, reason: 'No API configured.' });

    return Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted'){
        return { ok: false, reason: perm === 'denied'
          ? 'Notifications are blocked for this site. Allow them in your browser settings.'
          : 'Notification permission was not granted.' };
      }
      return fetch(base + '/api/push/key').then(function (r) { return r.json(); })
        .then(function (cfg) {
          if (!cfg.enabled || !cfg.key){
            return { ok: false, reason: 'Push is not switched on for this server yet.' };
          }
          return register().then(function (reg) {
            if (!reg) return { ok: false, reason: 'Could not register the background worker.' };
            return navigator.serviceWorker.ready.then(function (ready) {
              return ready.pushManager.getSubscription().then(function (existing) {
                return existing || ready.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlB64ToUint8Array(cfg.key)
                });
              });
            });
          }).then(function (sub) {
            if (!sub || sub.ok === false) return sub;
            var json = sub.toJSON();
            // The worker needs these to fetch who is asking.
            return Promise.all([kvSet('api', base), kvSet('token', token())])
              .then(function () {
                return fetch(base + '/api/push/subscribe', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
                  body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys })
                });
              })
              .then(function (res) {
                if (!res.ok) return { ok: false, reason: 'The server refused the subscription.' };
                return { ok: true };
              });
          });
        });
    }).catch(function (e) {
      return { ok: false, reason: e.message };
    });
  }

  function disable(){
    if (!supported()) return Promise.resolve({ ok: true });
    return navigator.serviceWorker.ready
      .then(function (reg) { return reg.pushManager.getSubscription(); })
      .then(function (sub) {
        if (!sub) return { ok: true };
        var endpoint = sub.endpoint;
        return sub.unsubscribe().then(function () {
          return fetch(apiBase() + '/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
            body: JSON.stringify({ endpoint: endpoint })
          });
        }).then(function () { return { ok: true }; });
      })
      .catch(function () { return { ok: true }; });
  }

  function status(){
    if (!supported()) return Promise.resolve({ supported: false, subscribed: false });
    return navigator.serviceWorker.ready
      .then(function (reg) { return reg.pushManager.getSubscription(); })
      .then(function (sub) {
        return {
          supported: true,
          permission: Notification.permission,
          subscribed: !!sub,
          iosNeedsInstall: iosNeedsInstall()
        };
      })
      .catch(function () {
        return { supported: true, permission: Notification.permission, subscribed: false };
      });
  }

  /** Ask the server to push us, so a guide can prove it works. */
  function test(){
    return fetch(apiBase() + '/api/push/test', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token() }
    }).then(function (r) { return r.json(); });
  }

  /* ---- the ring ----
     Repeats until answered. This is the "like a call" part, and it only
     works while a page is open — the OS owns the sound once it is closed. */

  function ringOnce(){
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ringCtx = ringCtx || new Ctx();
      if (ringCtx.state === 'suspended') ringCtx.resume();
      // Two rising pairs, like a handset.
      [[880, 0], [1180, 0.18], [880, 0.5], [1180, 0.68]].forEach(function (pair) {
        var osc = ringCtx.createOscillator(), gain = ringCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = pair[0];
        var t = ringCtx.currentTime + pair[1];
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        osc.connect(gain); gain.connect(ringCtx.destination);
        osc.start(t); osc.stop(t + 0.18);
      });
    } catch (e) { /* audio blocked until a gesture */ }
  }

  function startRinging(opts){
    opts = opts || {};
    stopRinging();
    if (!opts.silent) ringOnce();
    if (navigator.vibrate){ try { navigator.vibrate([300, 200, 300]); } catch (e) {} }
    ringTimer = setInterval(function () {
      if (!opts.silent) ringOnce();
      if (navigator.vibrate){ try { navigator.vibrate([300, 200, 300]); } catch (e) {} }
    }, 3000);
    // Never ring forever at someone.
    setTimeout(stopRinging, 45000);
  }

  function stopRinging(){
    if (ringTimer){ clearInterval(ringTimer); ringTimer = null; }
    if (navigator.vibrate){ try { navigator.vibrate(0); } catch (e) {} }
  }

  /* Keep the worker's copy of the token fresh, e.g. after a re-login. */
  function syncToken(){
    if (!supported()) return Promise.resolve();
    return Promise.all([kvSet('api', apiBase()), kvSet('token', token())]);
  }

  if (supported()){
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'resubscribe') enable();
    });
  }

  return {
    supported: supported,
    iosNeedsInstall: iosNeedsInstall,
    register: register,
    enable: enable,
    disable: disable,
    status: status,
    test: test,
    syncToken: syncToken,
    startRinging: startRinging,
    stopRinging: stopRinging,
    ringOnce: ringOnce
  };
})();
