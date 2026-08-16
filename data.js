/* ============================================================
   Longtail — API client, fallback data, shared helpers
   Loaded as a plain script (no modules) so the pages also work
   when opened straight off the filesystem.

   Live data comes from the Worker at window.LONGTAIL_API (see
   config.js). The GUIDES and PLACES arrays below are the offline
   fallback used when that call fails, so the site still renders
   with the backend down.

   >>> EVERY GUIDE BELOW IS FAKE except the one marked real:true.
   >>> Rows from the API carry their own demo flag, straight from
   >>> the is_demo column. The UI stamps a DEMO badge on any of
   >>> them and shows a bar at the bottom of the page. Do not turn
   >>> that off until the directory is real people — showing
   >>> invented "LIVE NOW" guides to a paying tester without
   >>> saying so is the kind of thing that ends a pilot badly.
   ============================================================ */

var LT = (function () {
  'use strict';

  var DEMO_MODE = true;   // recomputed by load() once real rows arrive
  var OFFLINE   = false;  // true when the API could not be reached

  /* ---- economics: single source of truth, mirrors index.html ---- */
  var RATE_BAHT_PER_MIN = 15;
  var PILOT_PRICE_BAHT  = 200;   // the validation offer
  var PILOT_MINUTES     = 25;

  /* ------------------------------------------------------------
     Thailand outline — simplified boundary, ~95 points.
     Used for the glowing country highlight on the globe. It is an
     approximation for display, not a survey-grade border.
     ------------------------------------------------------------ */
  var THAILAND_RING = [
    [100.10,20.45],[100.55,20.35],[100.90,20.20],[101.15,19.60],[101.05,19.05],
    [101.55,18.70],[101.90,18.35],[102.10,18.20],[102.60,17.85],[103.10,18.35],
    [103.90,18.30],[104.35,17.85],[104.75,17.45],[104.80,16.90],[105.05,16.55],
    [105.40,16.00],[105.55,15.55],[105.60,15.35],[105.20,14.90],[104.70,14.40],
    [104.20,14.35],[103.60,14.40],[103.15,14.35],[102.60,13.90],[102.35,13.55],
    [102.55,12.60],[102.35,12.25],[102.90,11.75],[102.30,12.40],[101.70,12.60],
    [101.00,12.60],[100.90,13.40],[100.55,13.50],[100.00,13.50],[99.95,13.10],
    [100.05,12.60],[99.95,12.20],[99.60,11.60],[99.35,10.90],[99.20,10.30],
    [99.50,9.90],[99.90,9.40],[100.05,8.90],[100.20,8.40],[100.40,7.90],
    [100.60,7.40],[100.85,6.85],[101.40,6.55],[101.85,6.45],[101.50,6.25],
    [101.05,6.25],[100.80,6.45],[100.35,6.55],[100.15,6.70],[99.90,6.85],
    [99.65,7.05],[99.35,7.40],[99.00,7.90],[98.60,8.20],[98.35,8.40],
    [98.25,9.00],[98.50,9.50],[98.55,10.00],[98.75,10.60],[98.90,11.40],
    [99.15,12.10],[99.20,12.60],[99.05,13.20],[98.60,14.00],[98.25,14.80],
    [98.40,15.30],[98.90,15.90],[98.55,16.40],[98.30,16.70],[98.60,17.30],
    [97.75,17.80],[97.35,18.55],[97.75,18.60],[98.05,19.35],[97.85,19.60],
    [98.25,19.75],[98.90,19.80],[99.05,20.10],[99.50,20.35],[100.10,20.45]
  ];

  var THAILAND_GEOJSON = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { name: 'Thailand' },
      geometry: { type: 'Polygon', coordinates: [THAILAND_RING] }
    }]
  };

  // generous box — the camera is kept inside this once you land
  var THAILAND_BOUNDS = [[96.2, 4.6], [107.0, 21.4]];
  var THAILAND_CENTER = [101.0, 13.4];

  /* ------------------------------------------------------------
     Guides. rate is baht per minute. room is the LiveKit walk code
     — the one field that connects this page to the live app.
     ------------------------------------------------------------ */
  var GUIDES = [
    {
      id:'g-nont', real:true, name:'Nont', initial:'N',
      city:'Bangkok', area:'Yaowarat, Chinatown',
      lat:13.7398, lng:100.5104,
      topic:'Yaowarat at dusk — the whole street waking up',
      blurb:'I start at Wat Traimit and walk the length of Yaowarat as the stalls light up. Tell me where to stop. Best around 18:00 when the food carts come out and the neon starts.',
      rate:15, live:true, rating:null, sessions:0,
      langs:['English','ไทย'], hue:150,
      tags:['Street food','Night','Walking'],
      room:'yaowarat'
    },
    {
      id:'g-ploy', name:'Ploy', initial:'P',
      city:'Bangkok', area:'Talad Noi & the river',
      lat:13.7362, lng:100.5142,
      topic:'Old engine shops, alley cats, and the ferry across',
      blurb:'Talad Noi is scrap metal workshops and hundred-year-old shophouses. We finish on the Chao Phraya ferry at golden hour.',
      rate:15, live:true, rating:4.9, sessions:34,
      langs:['English','ไทย'], hue:168,
      tags:['Neighbourhood','River','Photo'],
      room:'taladnoi'
    },
    {
      id:'g-kai', name:'Kai', initial:'K',
      city:'Chiang Mai', area:'Old City & Sunday walking street',
      lat:18.7883, lng:98.9853,
      topic:'Inside the moat — temples, then the night market',
      blurb:'Slow loop through the old city walls. Wat Chedi Luang, coffee, then whichever market is running that evening.',
      rate:15, live:true, rating:4.8, sessions:51,
      langs:['English','ไทย','Deutsch'], hue:135,
      tags:['Temples','Market','Slow'],
      room:'cmoldcity'
    },
    {
      id:'g-mai', name:'Mai', initial:'M',
      city:'Bangkok', area:'Chatuchak Weekend Market',
      lat:13.7999, lng:100.5501,
      topic:'27 acres of market — you pick the turns',
      blurb:'Chatuchak has 15,000 stalls and no logic. That is the fun. Point me down a row and I will go.',
      rate:15, live:false, rating:4.7, sessions:22,
      langs:['English','ไทย'], hue:186,
      tags:['Market','Weekend','Shopping'],
      room:'chatuchak'
    },
    {
      id:'g-som', name:'Som', initial:'S',
      city:'Ayutthaya', area:'Historical park',
      lat:14.3567, lng:100.5340,
      topic:'Ruins by bicycle — the old capital',
      blurb:'I ride between the temple ruins with the phone on a mount. Wat Mahathat, Wat Chaiwatthanaram at sunset if we time it.',
      rate:15, live:false, rating:5.0, sessions:12,
      langs:['English','ไทย'], hue:44,
      tags:['History','Ruins','Cycling'],
      room:'ayutthaya'
    },
    {
      id:'g-tan', name:'Tan', initial:'T',
      city:'Phuket', area:'Old Town, Thalang Road',
      lat:7.8848, lng:98.3880,
      topic:'Sino-Portuguese shophouses and the coffee lanes',
      blurb:'Phuket Old Town is pastel shophouses and very good coffee. Quiet in the morning, busy Sunday evening.',
      rate:15, live:false, rating:4.6, sessions:18,
      langs:['English','ไทย'], hue:22,
      tags:['Architecture','Coffee','Slow'],
      room:'phukettown'
    },
    {
      id:'g-fon', name:'Fon', initial:'F',
      city:'Krabi', area:'Ao Nang & Railay',
      lat:8.0324, lng:98.8210,
      topic:'Longtail boat out to the limestone cliffs',
      blurb:'We take a longtail from Ao Nang to Railay. Signal is patchy on the water — I tell you when we are about to lose it.',
      rate:15, live:false, rating:4.9, sessions:9,
      langs:['English','ไทย'], hue:196,
      tags:['Coast','Boat','Nature'],
      room:'railay'
    },
    {
      id:'g-bee', name:'Bee', initial:'B',
      city:'Bangkok', area:'Wang Lang & Siriraj',
      lat:13.7570, lng:100.4855,
      topic:'The market locals actually shop at',
      blurb:'Wang Lang is where nurses and students eat. No tourist pricing, no English menus. I translate.',
      rate:15, live:true, rating:4.8, sessions:41,
      langs:['English','ไทย'], hue:158,
      tags:['Street food','Local','Market'],
      room:'wanglang'
    },
    {
      id:'g-lek', name:'Lek', initial:'L',
      city:'Kanchanaburi', area:'River Kwai & the bridge',
      lat:14.0410, lng:99.5030,
      topic:'The bridge, the railway, the cemetery',
      blurb:'Heavy history walked slowly. I will tell you what is here and what is missing from the signs.',
      rate:15, live:false, rating:4.9, sessions:7,
      langs:['English','ไทย'], hue:206,
      tags:['History','River','Slow'],
      room:'kanchanaburi'
    },
    {
      id:'g-nim', name:'Nim', initial:'N',
      city:'Chiang Rai', area:'Wat Rong Khun & town',
      lat:19.9105, lng:99.8406,
      topic:'The White Temple, then somewhere quieter',
      blurb:'Rong Khun is crowded and worth it. Afterwards I walk you through the night bazaar where nobody is filming.',
      rate:15, live:false, rating:4.7, sessions:15,
      langs:['English','ไทย'], hue:120,
      tags:['Temples','Art','Night'],
      room:'chiangrai'
    },
    {
      id:'g-jun', name:'Jun', initial:'J',
      city:'Samut Songkhram', area:'Maeklong Railway Market',
      lat:13.4098, lng:99.9994,
      topic:'The market that folds up when the train comes',
      blurb:'Awnings come down, train passes a foot from the vegetables, awnings go back up. Eight times a day. I will get you the timing.',
      rate:15, live:false, rating:5.0, sessions:11,
      langs:['English','ไทย'], hue:36,
      tags:['Market','Trains','Unusual'],
      room:'maeklong'
    },
    {
      id:'g-ake', name:'Ake', initial:'A',
      city:'Sukhothai', area:'Historical park, central zone',
      lat:17.0206, lng:99.7036,
      topic:'Where the country started, on foot',
      blurb:'Sukhothai at opening time is nearly empty. Sitting Buddhas, lotus ponds, almost no one else.',
      rate:15, live:false, rating:4.8, sessions:6,
      langs:['English','ไทย'], hue:52,
      tags:['History','Ruins','Quiet'],
      room:'sukhothai'
    }
  ];

  /* ------------------------------------------------------------
     Places of interest
     ------------------------------------------------------------ */
  var PLACES = [
    { id:'p-yaowarat', name:'Yaowarat (Chinatown)', city:'Bangkok', cat:'Street food',
      lat:13.7398, lng:100.5104, hue:14, icon:'🏮',
      blurb:'A kilometre of neon, gold shops and food carts. Comes alive after dark and does not stop until 2am.',
      best:'18:00 – 22:00, any night', near:['g-nont','g-ploy'] },

    { id:'p-watarun', name:'Wat Arun', city:'Bangkok', cat:'Temples',
      lat:13.7437, lng:100.4889, hue:196, icon:'🛕',
      blurb:'The Temple of Dawn, covered in broken Chinese porcelain. Best seen from the far bank as the sun drops behind it.',
      best:'Sunset, from the Thonburi side', near:['g-ploy','g-bee'] },

    { id:'p-grandpalace', name:'Grand Palace & Wat Phra Kaew', city:'Bangkok', cat:'Temples',
      lat:13.7500, lng:100.4913, hue:44, icon:'👑',
      blurb:'Gold, mirrors and the Emerald Buddha. Dense, crowded, and unlike anything else in the country.',
      best:'08:30 opening, before the heat', near:['g-bee','g-ploy'] },

    { id:'p-chatuchak', name:'Chatuchak Weekend Market', city:'Bangkok', cat:'Markets',
      lat:13.7999, lng:100.5501, hue:186, icon:'🛍️',
      blurb:'15,000 stalls across 27 sections. Plants, vintage denim, ceramics, puppies, and food you will not find elsewhere.',
      best:'Sat & Sun, 10:00 – 18:00', near:['g-mai'] },

    { id:'p-wanglang', name:'Wang Lang Market', city:'Bangkok', cat:'Street food',
      lat:13.7570, lng:100.4855, hue:158, icon:'🍜',
      blurb:'A hospital-district market where the pricing is local and the queues are Thai. The opposite of a tourist food street.',
      best:'11:00 – 14:00 on a weekday', near:['g-bee'] },

    { id:'p-taladnoi', name:'Talad Noi', city:'Bangkok', cat:'Neighbourhoods',
      lat:13.7362, lng:100.5142, hue:168, icon:'🔧',
      blurb:'Engine-part workshops wedged between shrines and century-old shophouses. Cats everywhere. Excellent to wander.',
      best:'Late afternoon', near:['g-ploy','g-nont'] },

    { id:'p-khaosan', name:'Khao San Road', city:'Bangkok', cat:'Nightlife',
      lat:13.7590, lng:100.4977, hue:288, icon:'🎧',
      blurb:'Loud, cheap, chaotic, and famous for it. Worth seeing once, ideally through someone who can steer you off it.',
      best:'After 21:00', near:['g-bee'] },

    { id:'p-erawan', name:'Erawan Shrine', city:'Bangkok', cat:'Temples',
      lat:13.7443, lng:100.5405, hue:52, icon:'🪷',
      blurb:'A working shrine on a shopping-mall corner, with resident dancers and constant incense. City noise on all four sides.',
      best:'Early evening', near:['g-bee'] },

    { id:'p-lumphini', name:'Lumphini Park', city:'Bangkok', cat:'Nature',
      lat:13.7307, lng:100.5418, hue:130, icon:'🌳',
      blurb:'Monitor lizards, outdoor aerobics classes and paddle boats, ringed by the financial district.',
      best:'06:30 or 17:30', near:['g-bee'] },

    { id:'p-maeklong', name:'Maeklong Railway Market', city:'Samut Songkhram', cat:'Markets',
      lat:13.4098, lng:99.9994, hue:36, icon:'🚂',
      blurb:'Stalls set up on live railway tracks. When the train comes, everything folds away, then reopens behind it.',
      best:'Train times: 08:30, 11:10, 14:30, 17:40', near:['g-jun'] },

    { id:'p-ayutthaya', name:'Ayutthaya Historical Park', city:'Ayutthaya', cat:'History',
      lat:14.3567, lng:100.5340, hue:30, icon:'🏛️',
      blurb:'The former capital, sacked in 1767 and left as brick and headless stone. Big enough to need wheels.',
      best:'Sunset at Wat Chaiwatthanaram', near:['g-som'] },

    { id:'p-sukhothai', name:'Sukhothai Historical Park', city:'Sukhothai', cat:'History',
      lat:17.0206, lng:99.7036, hue:52, icon:'🪔',
      blurb:'Thailand’s first capital. Quieter and greener than Ayutthaya, with lotus ponds between the ruins.',
      best:'06:30 opening', near:['g-ake'] },

    { id:'p-cmoldcity', name:'Chiang Mai Old City', city:'Chiang Mai', cat:'Neighbourhoods',
      lat:18.7883, lng:98.9853, hue:135, icon:'🧱',
      blurb:'A square kilometre inside a moat, holding around thirty temples and most of the city’s good coffee.',
      best:'Sunday afternoon into the walking street', near:['g-kai'] },

    { id:'p-doisuthep', name:'Wat Phra That Doi Suthep', city:'Chiang Mai', cat:'Temples',
      lat:18.8048, lng:98.9217, hue:44, icon:'⛰️',
      blurb:'306 steps up a naga staircase to a golden chedi, with the whole valley behind you.',
      best:'Early morning, before the haze', near:['g-kai'] },

    { id:'p-rongkhun', name:'Wat Rong Khun (White Temple)', city:'Chiang Rai', cat:'Temples',
      lat:19.8242, lng:99.7633, hue:200, icon:'🤍',
      blurb:'A contemporary temple in white and mirror glass, with a deliberately unsettling approach across reaching hands.',
      best:'Opening time, 08:00', near:['g-nim'] },

    { id:'p-kwai', name:'Bridge over the River Kwai', city:'Kanchanaburi', cat:'History',
      lat:14.0410, lng:99.5030, hue:206, icon:'🌉',
      blurb:'The Death Railway crossing, plus the war cemetery and museum. Not a light morning.',
      best:'Morning, then the museum', near:['g-lek'] },

    { id:'p-railay', name:'Railay & Ao Nang', city:'Krabi', cat:'Nature',
      lat:8.0086, lng:98.8375, hue:196, icon:'🛶',
      blurb:'Limestone cliffs dropping straight into the sea, reachable only by longtail boat.',
      best:'Morning, calmer water', near:['g-fon'] },

    { id:'p-phukettown', name:'Phuket Old Town', city:'Phuket', cat:'Neighbourhoods',
      lat:7.8848, lng:98.3880, hue:22, icon:'🏘️',
      blurb:'Sino-Portuguese shophouses in mint, ochre and pink. A completely different island to the beach strip.',
      best:'Sunday evening walking street', near:['g-tan'] }
  ];

  var CATEGORIES = ['All','Street food','Temples','Markets','History','Neighbourhoods','Nature','Nightlife'];

  /* ============================================================
     API client
     ============================================================ */

  var TOKEN_KEY = 'lt_token';

  function apiBase(){ return (window.LONGTAIL_API || '').replace(/\/+$/, ''); }
  function token(){ try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function setToken(t){
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); }
    catch (e) { /* private mode */ }
  }

  /**
   * Every call goes through here. Rejects with an Error whose .message is
   * the server's own wording and whose .field names the offending input,
   * so forms can point at the right box.
   */
  function api(method, path, body){
    var base = apiBase();
    if (!base) return Promise.reject(new Error('No API configured. Set window.LONGTAIL_API in config.js.'));

    var headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    var t = token();
    if (t) headers['Authorization'] = 'Bearer ' + t;

    return fetch(base + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      var ctype = res.headers.get('content-type') || '';
      if (ctype.indexOf('application/json') === -1) {
        throw new Error('The server returned ' + res.status + ' instead of JSON.');
      }
      return res.json().then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error || ('Request failed (' + res.status + ')'));
          err.status = res.status;
          err.field = data.field;
          // A dead session should not leave a stale token lying around.
          if (res.status === 401 && t) setToken('');
          throw err;
        }
        return data;
      });
    });
  }

  /* rows from the API use satang and a demo flag; the pages want baht */
  function adaptGuide(g){
    return {
      id: g.id, name: g.name, initial: g.initial, city: g.city, area: g.area,
      lat: g.lat, lng: g.lng, topic: g.topic, blurb: g.blurb,
      rate: (g.rate_satang || 0) / 100,
      rate_satang: g.rate_satang,
      langs: g.langs || [], tags: g.tags || [], hue: g.hue,
      room: g.room, live: !!g.live, real: !g.demo,
      rating: g.rating, sessions: g.sessions
    };
  }

  function replace(arr, next){
    arr.length = 0;
    for (var i = 0; i < next.length; i++) arr.push(next[i]);
  }

  /**
   * Pull the directory. Resolves either way — a backend that is down
   * degrades to the bundled demo rows rather than an empty page.
   */
  function load(){
    if (!apiBase()){
      OFFLINE = true;
      return Promise.resolve({ online: false, reason: 'No API configured.' });
    }
    return Promise.all([ api('GET', '/api/guides'), api('GET', '/api/places') ])
      .then(function (res) {
        var guides = (res[0].guides || []).map(adaptGuide);
        if (guides.length) replace(GUIDES, guides);
        if ((res[1].places || []).length) replace(PLACES, res[1].places);
        OFFLINE = false;
        DEMO_MODE = GUIDES.some(function (g) { return !g.real; });
        return { online: true };
      })
      .catch(function (err) {
        OFFLINE = true;
        DEMO_MODE = true;
        return { online: false, reason: err.message };
      });
  }

  /* ---- guide auth ---- */
  var auth = {
    token: token,
    signedIn: function(){ return !!token(); },
    signup: function(payload){
      return api('POST', '/api/auth/signup', payload).then(function (d) {
        setToken(d.token); return d.guide;
      });
    },
    login: function(email, password){
      return api('POST', '/api/auth/login', { email: email, password: password })
        .then(function (d) { setToken(d.token); return d.guide; });
    },
    me: function(){ return api('GET', '/api/auth/me').then(function (d) { return d.guide; }); },
    logout: function(){
      return api('POST', '/api/auth/logout').catch(function(){ /* already dead */ })
        .then(function(){ setToken(''); });
    }
  };

  /* ------------------------------------------------------------
     helpers
     ------------------------------------------------------------ */
  function byId(list, id){ for (var i=0;i<list.length;i++) if (list[i].id===id) return list[i]; return null; }
  function guide(id){ return byId(GUIDES,id); }
  function place(id){ return byId(PLACES,id); }
  function liveGuides(){ return GUIDES.filter(function(g){ return g.live; }); }

  function guidesNear(lat,lng,km){
    km = km || 40;
    return GUIDES.filter(function(g){ return distKm(lat,lng,g.lat,g.lng) <= km; })
                 .sort(function(a,b){ return (b.live?1:0)-(a.live?1:0); });
  }

  function distKm(a1,o1,a2,o2){
    var R=6371, dLa=(a2-a1)*Math.PI/180, dLo=(o2-o1)*Math.PI/180;
    var s=Math.sin(dLa/2)*Math.sin(dLa/2)+
          Math.cos(a1*Math.PI/180)*Math.cos(a2*Math.PI/180)*Math.sin(dLo/2)*Math.sin(dLo/2);
    return R*2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s));
  }

  function baht(n){ return '฿' + Number(n).toLocaleString('en-US'); }

  /* walk codes must satisfy api/token.js: 3-40 of [A-Za-z0-9_-] */
  var CODE_RE = /^[a-zA-Z0-9_-]{3,40}$/;
  function validCode(c){ return CODE_RE.test(String(c||'').trim()); }

  /**
   * watch.html already accepts ?api= to override its token endpoint, so we
   * hand it the Worker rather than editing that file. Without this the
   * traveller would fall back to the old Vercel /api/token.
   */
  function watchUrl(code){
    var url = 'watch.html?room=' + encodeURIComponent(String(code).trim());
    var base = apiBase();
    if (base) url += '&api=' + encodeURIComponent(base + '/api/token');
    return url;
  }

  /* search across both lists */
  function search(q){
    q = String(q||'').trim().toLowerCase();
    if (!q) return { places:[], guides:[] };
    var hit = function(hay){ return String(hay||'').toLowerCase().indexOf(q) !== -1; };
    return {
      places: PLACES.filter(function(p){
        return hit(p.name)||hit(p.city)||hit(p.cat)||hit(p.blurb);
      }).slice(0,6),
      guides: GUIDES.filter(function(g){
        return hit(g.name)||hit(g.city)||hit(g.area)||hit(g.topic)||g.tags.some(hit);
      }).slice(0,6)
    };
  }

  function avatarStyle(hue){
    return 'background:linear-gradient(140deg,hsl('+hue+',62%,68%),hsl('+((hue+34)%360)+',52%,42%));';
  }

  /* ---------- tiny DOM helpers shared by all three pages ---------- */
  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  var toastTimer;
  function toast(msg, kind){
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast on' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ el.className = 'toast'; }, 4200);
  }

  /* nav — rendered from one place so the three pages cannot drift */
  function nav(current){
    var links = [
      { href:'explore.html',  key:'explore',  label:'Explore' },
      { href:'interest.html', key:'interest', label:'Interest' },
      { href:'guides.html',   key:'guides',   label:'Join guides' }
    ];
    return '<nav class="nav">' +
      '<a class="brand" href="explore.html" aria-label="Longtail home">' +
        '<span class="mark">L</span><b>Longtail</b>' +
      '</a>' +
      '<div class="navlinks">' +
        links.map(function(l){
          return '<a class="navlink' + (l.key===current?' on':'') + '" href="' + l.href + '"' +
                 (l.key===current?' aria-current="page"':'') + '>' + l.label + '</a>';
        }).join('') +
      '</div></nav>';
  }

  function demoBar(){
    if (!DEMO_MODE && !OFFLINE) return '';
    var msg = OFFLINE
      ? '<b>Backend unreachable.</b> Showing bundled sample data — nothing on this page is live. ' +
        'Check window.LONGTAIL_API in config.js and the Worker\'s ALLOWED_ORIGINS.'
      : '<b>Demo data.</b> Guides marked DEMO are placeholders. Nothing here charges a card.';
    return '<div class="demo-bar" id="demoBar">' + msg + '</div>';
  }

  /** Redraw the bar after load() has learned whether the API answered. */
  function refreshDemoBar(){
    var existing = document.getElementById('demoBar');
    if (existing) existing.remove();
    document.body.classList.toggle('has-demo', DEMO_MODE || OFFLINE);
    var html = demoBar();
    if (html) document.body.insertAdjacentHTML('beforeend', html);
    document.documentElement.style.setProperty(
      '--demo-h', (DEMO_MODE || OFFLINE) ? '38px' : '0px');
  }

  /* fade-up on scroll */
  function watchReveals(root){
    var els = (root||document).querySelectorAll('.reveal:not(.in)');
    if (!('IntersectionObserver' in window)){
      els.forEach(function(e){ e.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin:'0px 0px -8% 0px', threshold:.08 });
    els.forEach(function(e){ io.observe(e); });
  }

  /* pointer-tracked highlight for .glass-hover cards */
  function trackGlass(root){
    (root||document).addEventListener('pointermove', function(e){
      var card = e.target.closest && e.target.closest('.glass-hover');
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX-r.left)/r.width*100) + '%');
      card.style.setProperty('--my', ((e.clientY-r.top)/r.height*100) + '%');
    }, { passive:true });
  }

  /* close the topmost open sheet on Escape */
  function escClose(fn){
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') fn(); });
  }

  function boot(current){
    if (DEMO_MODE) document.body.classList.add('has-demo');
    document.body.insertAdjacentHTML('afterbegin', '<div class="aurora"></div>' + nav(current));
    document.body.insertAdjacentHTML('beforeend',
      '<div class="toast" id="toast" role="status" aria-live="polite"></div>' + demoBar());
    watchReveals();
    trackGlass();
  }

  return {
    /* DEMO_MODE and OFFLINE change after load(), so read them through these
       rather than destructuring once at page start. */
    get DEMO_MODE(){ return DEMO_MODE; },
    get OFFLINE(){ return OFFLINE; },
    RATE_BAHT_PER_MIN: RATE_BAHT_PER_MIN,
    PILOT_PRICE_BAHT: PILOT_PRICE_BAHT,
    PILOT_MINUTES: PILOT_MINUTES,
    GUIDES: GUIDES, PLACES: PLACES, CATEGORIES: CATEGORIES,
    THAILAND_GEOJSON: THAILAND_GEOJSON,
    THAILAND_BOUNDS: THAILAND_BOUNDS,
    THAILAND_CENTER: THAILAND_CENTER,
    guide: guide, place: place, liveGuides: liveGuides, guidesNear: guidesNear,
    distKm: distKm, baht: baht, validCode: validCode, watchUrl: watchUrl,
    search: search, avatarStyle: avatarStyle, esc: esc,
    toast: toast, boot: boot, watchReveals: watchReveals, escClose: escClose,
    api: api, load: load, auth: auth, refreshDemoBar: refreshDemoBar,
    apiBase: apiBase
  };
})();
