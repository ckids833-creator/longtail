/* ============================================================
   Longtail service worker

   Its only job is walk requests. The Worker sends a payload-less
   push; this fetches the detail and shows a real notification
   naming who is asking. That keeps traveller names out of a push
   service's queue and avoids payload encryption entirely.

   The bearer token is kept in a tiny IndexedDB store, written by
   the page when it subscribes, because a service worker cannot
   read localStorage.
   ============================================================ */

const DB_NAME = 'longtail';
const STORE = 'kv';

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function kvGet(key) {
  try {
    const db = await idb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      tx.onsuccess = () => resolve(tx.result || null);
      tx.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

/* ------------------------------------------------------------------ push */

self.addEventListener('push', (event) => {
  event.waitUntil(handlePush());
});

async function handlePush() {
  const base = await kvGet('api');
  const token = await kvGet('token');

  let title = 'Someone wants a walk';
  let body = 'Tap to answer.';
  let count = 1;

  // Fetch who it is. If this fails the notification still shows — a vague
  // alert a guide can act on beats a silent drop.
  if (base && token) {
    try {
      const res = await fetch(base + '/api/guides/me/alerts', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (res.ok) {
        const data = await res.json();
        const pending = (data.bookings || []).filter((b) => b.status === 'requested');
        count = pending.length || 1;
        const b = pending[0];
        if (b) {
          const baht = Math.round(b.hold_satang / 100).toLocaleString('en-US');
          title = count > 1 ? count + ' travellers want a walk' : 'Someone wants a walk';
          body = b.traveler_name + ' — ' + b.minutes + ' minutes, ฿' + baht + ' held, not charged';
        }
      }
    } catch { /* offline between push and fetch */ }
  }

  return self.registration.showNotification(title, {
    body,
    tag: 'walk-request',        // one notification, replaced, never a stack
    renotify: true,             // but still buzz for a new one
    requireInteraction: true,   // stays until the guide deals with it
    vibrate: [200, 100, 200, 100, 200],
    badge: '/longtail/icon-badge.png',
    icon: '/longtail/icon-192.png',
    data: { url: 'studio.html' },
    actions: [{ action: 'open', title: 'Open Studio' }]
  });
}

/* ---------------------------------------------------------------- clicks */

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || 'studio.html';

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Reuse a tab that is already open rather than piling up new ones.
    for (const client of all) {
      if (client.url.includes('studio.html') && 'focus' in client) return client.focus();
    }
    for (const client of all) {
      if ('navigate' in client && 'focus' in client) {
        try { await client.navigate(target); return client.focus(); } catch { /* fall through */ }
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});

/* The browser can rotate an endpoint. Tell the page so it re-subscribes. */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    all.forEach((c) => c.postMessage({ type: 'resubscribe' }));
  })());
});
