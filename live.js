/* ============================================================
   Longtail — realtime

   A socket to the guide's hub. It never carries data, only "look
   again": when a request, an answer, a join or a leave happens,
   onChange runs and the page re-reads its own state from the API.
   So what a page shows always comes from the same place, pushed
   or polled, and a page that misses a push catches up on its
   (now slow) fallback poll.

   Used by camera.html, studio.html and watch.html. No modules,
   no dependencies, so it loads like every other script here.

     LTLive({
       api:      'https://…',            the API base
       token:    () => 'bearer token',
       body:     {} | { booking_id },    whose hub: yours as a guide,
                                         or the guide of your request
       onChange: (what) => …             'request' | 'answer' | 'joined' | …
                                         and 'open' / 'visible' to catch up
     }) -> { stop(), connected }
   ============================================================ */
window.LTLive = function (opts) {
  'use strict';
  var stopped = false, ws = null, wait = 1000, pingT = null, openT = null;

  function retry() {
    if (stopped) return;
    clearTimeout(openT);
    openT = setTimeout(open, wait);
    wait = Math.min(wait * 2, 30000);     // back off, so a dead server is not hammered
  }

  function open() {
    if (stopped) return;
    var tok = opts.token && opts.token();
    if (!tok || !opts.api) return retry();
    // A browser socket cannot carry an Authorization header, and a session
    // token in a URL ends up in logs: trade it for a one-minute ticket.
    fetch(opts.api + '/api/live/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: JSON.stringify(opts.body || {})
    }).then(function (r) {
      if (r.status === 401 || r.status === 403) { stopped = true; throw 0; }   // not ours to watch
      return r.json();
    }).then(function (d) {
      if (stopped || !d || !d.ticket) return retry();
      ws = new WebSocket(opts.api.replace(/^http/, 'ws') + '/api/live?ticket=' + encodeURIComponent(d.ticket));
      ws.onopen = function () {
        wait = 1000;
        clearInterval(pingT);
        // Answered by the server without waking anything; keeps mobile
        // networks from quietly dropping an idle socket.
        pingT = setInterval(function () { try { ws.send('ping'); } catch (e) {} }, 25000);
        opts.onChange('open');   // catch up on anything missed while disconnected
      };
      ws.onmessage = function (e) {
        if (e.data === 'pong') return;
        try {
          var m = JSON.parse(e.data);
          if (m.type === 'changed') opts.onChange(m.what || 'changed');
        } catch (err) { /* not for us */ }
      };
      ws.onclose = function () { clearInterval(pingT); ws = null; retry(); };
    }).catch(function () { retry(); });
  }

  // Back on the tab: phones freeze background sockets, so look again at once.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden || stopped) return;
    opts.onChange('visible');
    if (!ws) { wait = 1000; open(); }
  });

  open();
  return {
    stop: function () {
      stopped = true;
      clearTimeout(openT); clearInterval(pingT);
      try { if (ws) ws.close(); } catch (e) {}
    },
    get connected() { return !!ws && ws.readyState === 1; }
  };
};
