(function () {
  const FD = globalThis.FD;
  if (typeof document === 'undefined') return; // logic tests run in Node without a DOM
  const SVGNS = 'http://www.w3.org/2000/svg';
  FD.ui = FD.ui || { local: {} }; // UI-local state (sort, filters, drafts) — never dispatched

  // ---------- DOM helper ----------
  FD.h = function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'on') for (const [e, fn] of Object.entries(v)) el.addEventListener(e, fn);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    append(el, children);
    return el;
  };
  function append(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false || c === '') continue;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }
  const h = FD.h;
  FD.frag = (...children) => { const f = document.createDocumentFragment(); append(f, children); return f; };
  FD.bdi = t => h('bdi', null, t);

  // ---------- icons (Lucide paths, ISC licence) ----------
  const P = {
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    store: '<path d="M3 9 5 3h14l2 6"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v8h14v-8"/><path d="M10 21v-5h4v5"/>',
    package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    check: '<path d="M20 6 9 17l-5-5"/>', 'check-circle': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>', 'x-circle': '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>', 'chevron-left': '<path d="m15 18-6-6 6-6"/>', 'chevron-down': '<path d="m6 9 6 6 6-6"/>', 'chevron-up': '<path d="m18 15-6-6-6 6"/>',
    'arrow-up': '<path d="m5 12 7-7 7 7M12 19V5"/>', 'arrow-down': '<path d="M12 5v14M19 12l-7 7-7-7"/>', 'arrow-left': '<path d="m12 19-7-7 7-7M19 12H5"/>', 'arrow-right': '<path d="M5 12h14M12 5l7 7-7 7"/>',
    map: '<path d="M14.1 4.4 9.9 2.3a2 2 0 0 0-1.8 0L3.6 4.6A1 1 0 0 0 3 5.5v14.9a.7.7 0 0 0 1 .6l4.1-2.1a2 2 0 0 1 1.8 0l4.2 2.1a2 2 0 0 0 1.8 0l4.5-2.3a1 1 0 0 0 .6-.9V3.6a.7.7 0 0 0-1-.6l-4.1 2.1a2 2 0 0 1-1.8 0z"/><path d="M15 5.8v15M9 3.2v15"/>',
    'map-pin': '<path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    navigation: '<path d="m3 11 19-9-9 19-2-8-8-2z"/>', list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>', search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
    alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    'eye-off': '<path d="M9.9 4.2A9 9 0 0 1 12 4c7 0 10 8 10 8a13 13 0 0 1-1.7 2.7M6.6 6.6A13.5 13.5 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 5.4-1.6M2 2l20 20M14.1 14.1a3 3 0 1 1-4.2-4.2"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7"/><circle cx="12" cy="12" r="3"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    pin: '<path d="M12 17v5M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    'wifi-off': '<path d="M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 4.2-2.7M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.1-1.6M22 8.8a15 15 0 0 0-11.3-3.7M2 2l20 20"/>',
    wifi: '<path d="M12 20h.01M2 8.8a15 15 0 0 1 20 0M5 12.9a10 10 0 0 1 14 0M8.5 16.4a5 5 0 0 1 7 0"/>',
    signal: '<path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16"/>',
    battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2"/><rect x="4" y="9" width="11" height="6" rx="1" fill="currentColor" stroke="none"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r=".5"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    'trending-up': '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>', 'trending-down': '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    'user-x': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5M22 8l-5 5"/>',
    bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    chart: '<path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>',
    play: '<path d="m6 3 14 9-14 9z"/>', plus: '<path d="M5 12h14M12 5v14"/>', minus: '<path d="M5 12h14"/>',
    external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3-3a2 2 0 0 0-2.8 0L6 21"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82"/>',
    route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>', maximize: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    'sort-az': '<path d="m3 16 4 4 4-4M7 20V4M20 8h-5M15 10V6.5a2.5 2.5 0 0 1 5 0V10M15 14h5l-5 6h5"/>', repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    'check-check': '<path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>', paperclip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    reply: '<path d="m9 17-5-5 5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>', file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><path d="M14 2v6h6"/>',
    megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    'user-switch': '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6M16 14l3 3-3 3M22 17h-6"/>', 'pin-off': '<path d="M12 17v5M15 9.3V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8M2 2l20 20M9 9v1.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h11"/>', star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  };
  const FLIP = new Set(['chevron-right', 'chevron-left', 'arrow-left', 'arrow-right', 'send', 'undo']);
  FD.injectSprite = () => {
    if (document.getElementById('fd-sprite')) return;
    const div = document.createElement('div');
    div.innerHTML = '<svg id="fd-sprite" xmlns="' + SVGNS + '" style="display:none"><!-- Icons: Lucide (ISC licence) -->' +
      Object.entries(P).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('') + '</svg>';
    document.body.prepend(div.firstChild);
  };
  FD.icon = (name, cls = '') => {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('class', 'ic ' + cls + (FLIP.has(name) ? ' flip-rtl' : '')); s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS(SVGNS, 'use'); u.setAttribute('href', '#i-' + name); s.appendChild(u);
    return s;
  };
  const I = FD.icon;

  // ---------- small components ----------
  FD.chip = (content, tone = '', extra = '') => h('span', { class: 'chip ' + tone + ' ' + extra }, content);
  FD.empty = (id, slots, icon = 'inbox') => h('div', { class: 'empty' }, I(icon), h('div', null, FD.tx(id, slots)));
  // ponytail: 500ms re-entry guard per handler stops double taps from sending twice
  let lastFire = { fn: null, at: 0 };
  FD.once = fn => function (e) { const now = Date.now(); if (lastFire.fn === fn && now - lastFire.at < 500) return; lastFire = { fn, at: now }; return fn.call(this, e); };
  FD.btn = (label, onClick, cls = 'secondary', icon, attrs = {}) => h('button', Object.assign({ class: 'btn ' + cls, type: 'button', on: { click: FD.once(onClick) } }, attrs), icon ? I(icon, 's16') : null, label);
  FD.iconBtn = (icon, label, onClick, badge) => h('button', { class: 'icon-btn', type: 'button', 'aria-label': label, title: label, on: { click: FD.once(onClick) } }, I(icon), badge ? h('span', { class: 'dot' }, badge) : null);
  FD.initials = name => name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  FD.avatar = (person, cls = '') => h('span', { class: 'avatar ' + cls, 'aria-hidden': 'true' }, FD.initials(person.name));
  FD.delta = (v, opts = {}) => {
    const cls = Math.abs(v) < 0.5 ? 'flat' : v > 0 ? 'up' : 'down';
    return h('span', { class: 'delta ' + cls }, cls === 'flat' ? null : I(v > 0 ? 'arrow-up' : 'arrow-down', 's14'), opts.pp ? FD.fmt.num(Math.abs(v), 1) : FD.fmt.pct(Math.abs(v)));
  };
  FD.unitWord = (code, qty) => { const k = FD.sku(code); return FD.lang === 'ar' ? (qty > 1 ? k.units_ar : k.unit_ar) : (qty > 1 ? k.units : k.unit); };
  // credit status as a chip; the lower-case CREDIT_* ids stay for use inside sentences
  FD.creditChip = (credit, long) => FD.chip(FD.t((long ? 'CRL_' : 'CR_') + credit), credit === 'BLOCKED' ? 'bad' : credit === 'WATCH' ? 'warn' : '');
  // search box that filters while typing and keeps focus across the re-render
  let refocus = null;
  FD.searchBox = (key, placeholder, value, onChange, style) => { let tm;
    const inp = h('input', { class: 'input', type: 'search', placeholder, 'aria-label': placeholder, value: value || '', 'data-sk': key,
      on: { input: e => { const v = e.target.value, pos = e.target.selectionStart; clearTimeout(tm); tm = setTimeout(() => { refocus = { key, pos }; onChange(v); }, 160); } } });
    return h('div', { class: 'search', style }, I('search', 's16'), inp); };
  FD.restoreSearchFocus = () => { if (!refocus) return; const el = document.querySelector('[data-sk="' + refocus.key + '"]'); if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(refocus.pos, refocus.pos); } catch (e) { } } refocus = null; };
  FD.stepper = (value, min, max, onChange, label) => {
    const out = h('output', { 'aria-live': 'polite' }, FD.fmt.num(value));
    const set = v => { onChange(v); };
    return h('div', { class: 'stepper', role: 'group', 'aria-label': label || '' },
      h('button', { type: 'button', 'aria-label': '−', disabled: value <= min, on: { click: () => set(value - 1) } }, I('minus')),
      out,
      h('button', { type: 'button', 'aria-label': '+', disabled: value >= max, on: { click: () => set(value + 1) } }, I('plus')));
  };
  FD.toggle = (on, onChange, label) => h('button', { type: 'button', role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': label || '', class: 'switch' + (on ? ' on' : ''), on: { click: () => onChange(!on) } });
  // Segmented control with a sliding lens (the glass variant is the role switcher)
  FD.seg = (options, value, onChange, cls = '') => {
    const lens = h('span', { class: 'lens', 'aria-hidden': 'true' });
    const wrap = h('div', { class: 'seg ' + cls, role: 'tablist' }, lens,
      options.map(o => h('button', { type: 'button', role: 'tab', 'aria-selected': o.id === value ? 'true' : 'false', class: o.id === value ? 'on' : '', dataset: { id: o.id },
        on: { click: () => { if (o.id !== value) onChange(o.id); } } }, o.icon ? I(o.icon, 's16') : null, o.label)));
    const place = () => { const b = wrap.querySelector('button.on'); if (!b) return; lens.style.width = b.offsetWidth + 'px'; lens.style.transform = `translateX(${b.offsetLeft}px)`; };
    requestAnimationFrame(() => { lens.style.transition = 'none'; place(); requestAnimationFrame(() => { lens.style.transition = ''; }); });
    // fonts (Arabic) and wrapping change button widths after first paint: follow them
    if (typeof ResizeObserver !== 'undefined') { const ro = new ResizeObserver(() => { if (!wrap.isConnected) return ro.disconnect(); place(); }); wrap.querySelectorAll('button').forEach(b => ro.observe(b)); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    return wrap;
  };
  FD.select = (options, value, onChange, attrs = {}) => h('select', Object.assign({ class: 'select', on: { change: e => onChange(e.target.value) } }, attrs),
    options.map(o => h('option', { value: o.id, selected: o.id === value }, o.label)));

  // ---------- tooltip ----------
  let tipEl = null;
  FD.tip = {
    show(e, content) {
      if (!tipEl) { tipEl = h('div', { class: 'tip', role: 'tooltip' }); document.body.appendChild(tipEl); }
      tipEl.replaceChildren(content instanceof Node ? content : document.createTextNode(content));
      const x = e.clientX, y = e.clientY; tipEl.classList.add('on');
      const r = tipEl.getBoundingClientRect();
      tipEl.style.left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x + 12)) + 'px';
      tipEl.style.top = Math.max(8, y - r.height - 12) + 'px';
    },
    hide() { if (tipEl) tipEl.classList.remove('on'); }
  };
  FD.withTip = (el, content) => { el.addEventListener('mousemove', e => FD.tip.show(e, typeof content === 'function' ? content() : content)); el.addEventListener('mouseleave', FD.tip.hide); return el; };

  // ---------- toast ----------
  let toastHost = null;
  FD.toast = (id, slots, opts = {}) => {
    if (!toastHost) { toastHost = h('div', { class: 'toasts', 'aria-live': 'polite', role: 'status' }); document.body.appendChild(toastHost); }
    const el = h('div', { class: 'toast' }, h('span', null, opts.text || FD.tx(id, slots)),
      opts.undo ? h('button', { class: 'btn ghost sm', type: 'button', on: { click: () => { opts.undo(); el.remove(); } } }, FD.t('S_UNDO')) : null);
    toastHost.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .25s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 260); }, opts.undo ? 5000 : 2800);
  };

  // ---------- focus trap helper ----------
  function trap(container, e) {
    if (e.key !== 'Tab') return;
    const f = [...container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) return; const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  }

  // ---------- overlay history: back button steps through drawers/sheets ----------
  const OH = { depth: 0, skip: 0, after: null };
  FD.ovPending = () => OH.skip > 0;
  FD.ovAfter = hash => { OH.after = hash; }; // navigate once the in-flight history step lands
  FD.ovPush = () => { try { history.pushState({ fdo: ++OH.depth }, ''); } catch (e) { } };
  FD.ovPop = (n = 1) => { n = Math.min(n, OH.depth); if (n <= 0) return; OH.depth -= n; OH.skip++; history.go(-n); };
  FD.ovReset = () => { OH.depth = 0; };
  window.addEventListener('popstate', () => {
    if (OH.skip) { OH.skip--; if (!OH.skip && OH.after) { const x = OH.after; OH.after = null; location.hash = x; } return; }
    if (OH.depth > 0) { OH.depth--; if (S.stack.length) FD.sheet.close(true); else if (D.el) FD.drawer.back(true); return; }
    if (history.state && history.state.fdo && !S.stack.length && !D.el) history.back(); // dead overlay entry: step past it
  });
  // reload while a drawer/sheet was open: step back past those entries so the next back press leaves the page
  if (history.state && history.state.fdo) { OH.skip++; try { history.go(-history.state.fdo); } catch (e) { OH.skip--; } }
  // close every overlay with a single history step (two back-to-back history.go calls are fragile) (M13)
  FD.closeAllOverlays = () => { const n = OH.depth; while (S.stack.length) FD.sheet.close(true); FD.drawer.close(true); FD.ovPop(n); };

  // ---------- drawer (stack with back) ----------
  const D = { stack: [], el: null, scrim: null, returnFocus: null };
  FD.drawer = {
    open(cfg, opts = {}) {
      if (opts.replace) { FD.ovPop(D.stack.length); D.stack = []; }
      D.stack.push(cfg); FD.ovPush(); // opening from inside a drawer stacks, so back returns to it
      if (!D.el) {
        D.returnFocus = document.activeElement;
        D.scrim = h('div', { class: 'scrim', on: { click: () => FD.drawer.close() } });
        D.el = h('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', on: { keydown: e => { if (e.key === 'Escape') FD.drawer.close(); trap(D.el, e); } } });
        document.getElementById('overlays').append(D.scrim, D.el);
        requestAnimationFrame(() => { D.scrim.classList.add('on'); D.el.classList.add('on'); });
      }
      FD.drawer.refresh(true);
    },
    back(fromPop) { if (!fromPop) FD.ovPop(1); D.stack.pop(); if (!D.stack.length) return FD.drawer.close(true); FD.drawer.refresh(true); },
    close(fromPop) {
      if (!D.el) return; if (!fromPop) FD.ovPop(D.stack.length); const el = D.el, sc = D.scrim; D.el = D.scrim = null; D.stack = [];
      el.classList.remove('on'); sc.classList.remove('on'); el.style.pointerEvents = sc.style.pointerEvents = 'none'; setTimeout(() => { el.remove(); sc.remove(); }, 280);
      if (D.returnFocus && D.returnFocus.focus) D.returnFocus.focus();
    },
    isOpen: () => !!D.el,
    refresh(focus) {
      if (!D.el) return; const cfg = D.stack[D.stack.length - 1];
      let body; try { body = cfg.render(); } catch (err) { console.error(err); body = h('div', { class: 'err-card' }, String(err.message || err)); }
      if (body === null) return FD.drawer.back(); // subject no longer exists
      const bodyEl = h('div', { class: 'drawer-b' }, body);
      const prev = D.el.querySelector('.drawer-b'); const scroll = prev && !focus ? prev.scrollTop : 0;
      D.el.replaceChildren(
        h('div', { class: 'drawer-h' }, FD.iconBtn('arrow-left', FD.t(D.stack.length > 1 ? 'L_BACK' : 'L_CLOSE'), () => FD.drawer.back()),
          h('h2', { id: 'drawer-title', class: 'ellipsis' }, typeof cfg.title === 'function' ? cfg.title() : cfg.title), cfg.actions ? cfg.actions() : null,
          cfg.expand ? FD.iconBtn('maximize', FD.t('L_EXPAND'), () => { const hsh = typeof cfg.expand === 'function' ? cfg.expand() : cfg.expand; FD.drawer.close(); setTimeout(() => FD.go(hsh), 30); }) : null,
          FD.iconBtn('x', FD.t('L_CLOSE'), () => FD.drawer.close())), bodyEl);
      D.el.setAttribute('aria-labelledby', 'drawer-title');
      bodyEl.scrollTop = scroll;
      if (focus) setTimeout(() => { const b = D.el && D.el.querySelector('.drawer-h .icon-btn:last-child'); if (b) b.focus(); }, 50);
    },
    closeAll() { FD.drawer.close(); }
  };

  // ---------- sheets (bottom or centred; mount inside the phone when in VSR) ----------
  const S = { stack: [] };
  function sheetHost() {
    const phone = document.querySelector('.phone-screen');
    return phone && FD.state.role === 'vsr' ? phone : document.getElementById('overlays');
  }
  FD.sheet = {
    open(cfg) {
      const host = sheetHost(); const inPhone = host.classList.contains('phone-screen');
      const wrap = h('div', { class: 'sheet-host' + (inPhone ? ' in-phone' : '') });
      const scrim = h('div', { class: 'scrim', on: { click: () => FD.sheet.close() } });
      const el = h('div', { class: 'sheet' + (cfg.center && !inPhone ? ' center' : ''), role: 'dialog', 'aria-modal': 'true',
        on: { keydown: e => { if (e.key === 'Escape') { e.stopPropagation(); FD.sheet.close(); } trap(el, e); } } });
      wrap.append(scrim, el); host.appendChild(wrap);
      const entry = { cfg, wrap, el, scrim, returnFocus: document.activeElement };
      S.stack.push(entry); FD.ovPush();
      FD.sheet.draw(entry, true);
      requestAnimationFrame(() => { scrim.classList.add('on'); el.classList.add('on'); });
      return entry;
    },
    draw(entry, focus) {
      const { cfg, el } = entry; const body = cfg.render(entry);
      el.replaceChildren(...[
        cfg.center ? null : h('div', { class: 'grab', 'aria-hidden': 'true' }),
        h('div', { class: 'sheet-h' }, cfg.back ? FD.iconBtn('arrow-left', FD.t('L_BACK'), cfg.back) : null, h('h3', null, typeof cfg.title === 'function' ? cfg.title() : cfg.title), FD.iconBtn('x', FD.t('L_CLOSE'), () => FD.sheet.close())),
        h('div', { class: 'sheet-b' }, body), cfg.footer ? h('div', { class: 'sheet-f' }, cfg.footer(entry)) : null].filter(Boolean));
      if (focus) setTimeout(() => { const f = el.querySelector('.sheet-b button, .sheet-b input, .sheet-b textarea'); (f || el.querySelector('.icon-btn')).focus({ preventScroll: true }); }, 60);
    },
    redraw() { const top = S.stack[S.stack.length - 1]; if (top) FD.sheet.draw(top, false); },
    close(fromPop) {
      const top = S.stack.pop(); if (!top) return; if (!fromPop) FD.ovPop(1);
      top.el.classList.remove('on'); top.scrim.classList.remove('on'); top.wrap.style.pointerEvents = top.el.style.pointerEvents = top.scrim.style.pointerEvents = 'none'; setTimeout(() => top.wrap.remove(), 300);
      if (top.cfg.onClose) top.cfg.onClose();
      if (top.returnFocus && top.returnFocus.focus && document.contains(top.returnFocus)) top.returnFocus.focus({ preventScroll: true });
    },
    closeAll() { while (S.stack.length) FD.sheet.close(); },
    top: () => S.stack[S.stack.length - 1],
    // a re-render replaces the phone screen; move open phone sheets onto the new one
    rehost() { const ph = document.querySelector('.phone-screen'); if (!ph) return; for (const e of S.stack) if (e.wrap.classList.contains('in-phone') && !ph.contains(e.wrap)) ph.appendChild(e.wrap); },
    refreshLive() { for (const e of S.stack) if (e.cfg.live) { const target = e.el.querySelector('[data-live]'); if (target) target.replaceChildren(e.cfg.live(e)); } },
  };

  // ---------- small explanation popover ----------
  let popEl = null;
  FD.popover = (anchor, text) => {
    if (popEl) { const was = popEl.dataset.for === text; popEl.remove(); popEl = null; if (was) return; }
    popEl = h('div', { class: 'popover', role: 'tooltip' }, text); popEl.dataset.for = text; document.body.appendChild(popEl);
    const r = anchor.getBoundingClientRect(), m = popEl.getBoundingClientRect();
    const left = Math.max(8, Math.min(innerWidth - m.width - 8, r.left + r.width / 2 - m.width / 2)); let top = r.bottom + 6; if (top + m.height > innerHeight - 8) top = r.top - m.height - 6;
    Object.assign(popEl.style, { left: left + 'px', top: top + 'px' });
    const mine = popEl; setTimeout(() => { const off = e => { if (e.target === anchor || anchor.contains(e.target)) return; document.removeEventListener('click', off, true); if (popEl === mine) { popEl.remove(); popEl = null; } }; document.addEventListener('click', off, true); }, 0);
  };
  // ---------- popup menu ----------
  let menuEl = null;
  FD.menu = (anchor, items) => { items = items.filter(Boolean);
    FD.menu.close();
    menuEl = h('div', { class: 'menu', role: 'menu' }, items.map(it => it === '-' ? h('div', { class: 'sep' }) :
      h('button', { type: 'button', role: 'menuitem', style: it.danger ? { color: 'var(--bad)' } : null, on: { click: () => { FD.menu.close(); it.onClick(); } } }, it.icon ? I(it.icon, 's16') : null, it.label)));
    document.body.appendChild(menuEl);
    const r = anchor.getBoundingClientRect(), m = menuEl.getBoundingClientRect();
    const rtl = document.documentElement.dir === 'rtl';
    let left = rtl ? r.left : r.right - m.width; left = Math.max(8, Math.min(window.innerWidth - m.width - 8, left));
    let top = r.bottom + 4; if (top + m.height > window.innerHeight - 8) top = r.top - m.height - 4;
    Object.assign(menuEl.style, { left: left + 'px', top: top + 'px' });
    menuEl.querySelector('button').focus();
    const mine = menuEl; setTimeout(() => { const off = e => { if (menuEl !== mine) return document.removeEventListener('click', off, true); if (mine.contains(e.target)) return; document.removeEventListener('click', off, true); if (!anchor.contains(e.target)) FD.menu.close(); else FD.menu.close(); }; document.addEventListener('click', off, true); }, 0);
    menuEl.addEventListener('keydown', e => { if (e.key === 'Escape') { FD.menu.close(); anchor.focus(); } });
  };
  FD.menu.close = () => { if (menuEl) { menuEl.remove(); menuEl = null; } };

  // ---------- sortable table (sort state is UI-local, keyed by table id) ----------
  FD.table = function ({ id, columns, rows, onRow, defaultSort, empty = 'X_FILTER', rowClass, limit }) {
    const st = FD.ui.local['tbl:' + id] = FD.ui.local['tbl:' + id] || { key: defaultSort ? defaultSort[0] : null, dir: defaultSort ? defaultSort[1] : 'desc' };
    columns = columns.map(c => (c.sort || c.nosort || !c.label) ? c : Object.assign({}, c, { sort: textSort(c), firstDir: 'asc' }));
    const col = columns.find(c => c.key === st.key);
    let data = rows.slice();
    if (col && col.sort) data.sort((a, b) => { const r = col.sort(a, b); return st.dir === 'asc' ? r : -r; });
    if (limit) data = data.slice(0, limit);
    const head = h('tr', null, columns.map(c => {
      const sorted = st.key === c.key;
      const th = h('th', { class: (c.num ? 'n ' : '') + (c.sort ? 'sortable' : ''), scope: 'col', 'aria-sort': sorted ? (st.dir === 'asc' ? 'ascending' : 'descending') : null, tabindex: c.sort ? '0' : null, style: c.width ? { width: c.width } : null },
        c.label, c.sort ? h('span', { class: 'sort', 'aria-hidden': 'true' }, sorted ? (st.dir === 'asc' ? ' ▲' : ' ▼') : ' ↕') : null);
      if (c.sort) {
        const go = () => { if (st.key === c.key) st.dir = st.dir === 'asc' ? 'desc' : 'asc'; else { st.key = c.key; st.dir = c.firstDir || 'desc'; } FD.rerenderTable(id); };
        th.addEventListener('click', go); th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      }
      return th;
    }));
    const body = data.length ? data.map(r => h('tr', { class: (onRow ? 'click ' : '') + (rowClass ? rowClass(r) : ''), tabindex: onRow ? '0' : null,
      on: onRow ? { click: e => { if (!e.target.closest('button, a, input, select')) onRow(r); }, keydown: e => { if (e.key === 'Enter' && e.target.tagName === 'TR') onRow(r); } } : null },
      columns.map(c => h('td', { class: c.num ? 'n' : '' }, c.render ? c.render(r) : r[c.key]))))
      : h('tr', null, h('td', { colspan: columns.length }, FD.empty(empty)));
    const wrap = h('div', { class: 'table-wrap', dataset: { table: id } }, h('table', { class: 't' }, h('thead', null, head), h('tbody', null, body)));
    wrap._args = arguments[0];
    return wrap;
  };
  // A-Z / Z-A by what the cell shows (numbers compare numerically)
  function textSort(c) { const cache = new WeakMap(); const txt = r => { if (!cache.has(r)) { const v = c.render ? c.render(r) : r[c.key]; cache.set(r, (v instanceof Node ? v.textContent : String(v == null ? '' : v)).trim().replace(/(\d)[,\u066C](?=\d{3})/g, '$1')); } return cache.get(r); };
    return (a, b) => txt(a).localeCompare(txt(b), FD.lang === 'ar' ? 'ar' : 'en', { numeric: true, sensitivity: 'base' }); }
  FD.rerenderTable = id => { const old = document.querySelector(`[data-table="${id}"]`); if (old && old._args) old.replaceWith(FD.table(old._args)); };

  // ---------- charts (single hue; values in text ink; hover tooltips) ----------
  FD.bars = (items, opts = {}) => {
    const max = opts.max || Math.max(1, ...items.map(i => i.value));
    return h('div', { class: 'bars', role: 'list' }, items.map(i => {
      const row = h('div', { class: 'bar-row' + (i.onClick ? ' click' : ''), role: 'listitem', tabindex: i.onClick ? '0' : null,
        on: i.onClick ? { click: i.onClick, keydown: e => { if (e.key === 'Enter') i.onClick(); } } : null },
        h('span', { class: 'ellipsis' }, i.label),
        h('span', { class: 'track' }, h('span', { class: 'fill' + (i.muted ? ' muted' : ''), style: { width: Math.max(0, (100 * i.value) / max) + '%' } })),
        h('span', { class: 'val' }, i.display != null ? i.display : FD.fmt.num(i.value)));
      if (i.tip) FD.withTip(row, i.tip);
      return row;
    }));
  };
  FD.spark = (values, w = 84, hgt = 26) => {
    const pts = values.map((v, i) => ({ v, i })).filter(p => p.v != null);
    const s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('class', 'spark'); s.setAttribute('width', w); s.setAttribute('height', hgt); s.setAttribute('viewBox', `0 0 ${w} ${hgt}`); s.setAttribute('aria-hidden', 'true');
    if (pts.length < 2) return s;
    const min = Math.min(...pts.map(p => p.v)), max = Math.max(...pts.map(p => p.v)); const rng = max - min || 1;
    const X = i => 3 + (i / (values.length - 1)) * (w - 6), Y = v => hgt - 3 - ((v - min) / rng) * (hgt - 6);
    const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', pts.map((q, k) => (k ? 'L' : 'M') + X(q.i).toFixed(1) + ' ' + Y(q.v).toFixed(1)).join(' ')); s.appendChild(p);
    const last = pts[pts.length - 1]; const c = document.createElementNS(SVGNS, 'circle'); c.setAttribute('cx', X(last.i)); c.setAttribute('cy', Y(last.v)); c.setAttribute('r', 2.5); s.appendChild(c);
    return s;
  };
  FD.ring = (value, size = 96, stroke = 9) => {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r;
    const s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('class', 'ring'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = `<circle class="bg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/><circle class="fg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" stroke-dasharray="${(c * Math.max(0, Math.min(100, value))) / 100} ${c}"/>`;
    return s;
  };
  // Line chart: s0 solid brand, s1 dashed muted (e.g. before-pilot average). Crosshair + tooltip.
  FD.line = (series, labels, opts = {}) => {
    const W = 600, H = opts.h || 200, L = 44, R = 12, T = 12, B = 26;
    const all = series.flatMap(s => s.values).filter(v => v != null);
    const max = Math.max(1, ...all) * 1.1, min = 0;
    const X = i => L + (i / Math.max(1, labels.length - 1)) * (W - L - R), Y = v => T + (1 - (v - min) / (max - min)) * (H - T - B);
    const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'linechart'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', opts.label || '');
    let g = '<g class="grid">';
    for (let k = 0; k <= 3; k++) { const v = (max / 3) * k; g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/>`; }
    g += '</g><g class="axis">';
    for (let k = 0; k <= 3; k++) { const v = (max / 3) * k; g += `<text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${FD.fmt.num(v >= 1000 ? v / 1000 : v, v >= 1000 ? 1 : 0)}${v >= 1000 ? 'k' : ''}</text>`; }
    const step = Math.ceil(labels.length / 6);
    labels.forEach((lb, i) => { if (i % step === 0 || i === labels.length - 1) g += `<text x="${X(i)}" y="${H - 6}" text-anchor="middle">${lb}</text>`; });
    g += '</g>';
    series.forEach((s, k) => { const d = s.values.map((v, i) => v == null ? '' : ((i && s.values[i - 1] != null ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1))).join(' '); g += `<path class="s${k}" d="${d}"/>`; });
    g += `<line class="hover-line" x1="0" x2="0" y1="${T}" y2="${H - B}" opacity="0"/>`;
    svg.innerHTML = g;
    const hl = svg.querySelector('.hover-line');
    svg.addEventListener('mousemove', e => {
      const r = svg.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(labels.length - 1, Math.round(((x - L) / (W - L - R)) * (labels.length - 1))));
      hl.setAttribute('x1', X(i)); hl.setAttribute('x2', X(i)); hl.setAttribute('opacity', 1);
      FD.tip.show(e, h('div', null, h('b', null, labels[i]), series.map(s => h('div', null, s.name + ': ' + (s.values[i] == null ? '—' : (opts.fmt || FD.fmt.num)(s.values[i]))))));
    });
    svg.addEventListener('mouseleave', () => { hl.setAttribute('opacity', 0); FD.tip.hide(); });
    const legend = h('div', { class: 'legend', style: { marginTop: '6px' } }, series.map((s, k) => h('span', null, h('span', { class: 'sw', style: k ? { background: 'transparent', border: '2px dashed var(--ink-3)', height: '0', width: '14px', borderRadius: '0', verticalAlign: '3px' } : { background: 'var(--brand)', height: '3px', width: '14px', verticalAlign: '3px' } }), s.name)));
    return h('div', null, svg, series.length > 1 ? legend : null);
  };

  // ---------- photo input: downscale to 800px q0.7, reject >5MB ----------
  FD.readPhoto = file => new Promise((resolve, reject) => {
    if (!file) return reject(new Error('none'));
    if (file.size > 5 * 1024 * 1024) return reject(new Error('S_PHOTO_BIG'));
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 800 / Math.max(img.width, img.height)); const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad')); };
    img.src = url;
  });
  FD.lightbox = src => { const lb = h('div', { class: 'lightbox', role: 'dialog', tabindex: '-1', on: { click: () => lb.remove(), keydown: e => { if (e.key === 'Escape') lb.remove(); } } }, h('img', { src, alt: '' })); document.body.appendChild(lb); lb.focus(); };
  // ---------- SKU icons: professional line icons (same stroke as the UI set) + one flavour accent ----------
  // Outline in currentColor; the flavour colour fills only the key part (frosting, cream, crumb, pack band).
  const FLAV = { vanilla: '#E3B55B', chocolate: '#7A4A2E', strawberry: '#E0668A', marble: '#A0724A', fruit: '#E0892F', brown: '#A06B3B', red: '#C0463A', diet: '#6F9A3B', butter: '#2F6FD0', choco: '#6B4226' };
  function flavour(k) { const n = k.name.toLowerCase();
    if (k.group === 'GRP_RUSK') return n.includes('red') ? 'red' : n.includes('diet') ? 'diet' : 'brown';
    if (k.group === 'GRP_BUTTER') return n.includes('choco') ? 'choco' : 'butter';
    for (const f of ['strawberry', 'chocolate', 'marble', 'fruit']) if (n.includes(f)) return f; return 'vanilla'; }
  const acc = c => `fill="${c}" fill-opacity=".9" stroke="none"`;
  const SHAPE = {
    // single cupcake: frosting dome + fluted liner
    GRP_SINGLES: c => `<path d="M6.5 11.5c0-3.1 2.5-5.5 5.5-5.5s5.5 2.4 5.5 5.5z" ${acc(c)}/><path d="M6.5 11.5c0-3.1 2.5-5.5 5.5-5.5s5.5 2.4 5.5 5.5"/><path d="M5.5 11.5h13l-1.6 8.1a1 1 0 0 1-1 .9H8.1a1 1 0 0 1-1-.9z"/><path d="M9.5 11.5l.6 9M14.5 11.5l-.6 9"/>`,
    // box of cupcakes: open carton with two domes
    GRP_CUPBOX: c => `<path d="M4.5 10.5c0-1.7 1.3-3 3-3s3 1.3 3 3z" ${acc(c)}/><path d="M13.5 10.5c0-1.7 1.3-3 3-3s3 1.3 3 3z" ${acc(c)}/><path d="M4.5 10.5c0-1.7 1.3-3 3-3s3 1.3 3 3M13.5 10.5c0-1.7 1.3-3 3-3s3 1.3 3 3"/><rect x="3" y="10.5" width="18" height="9.5" rx="1.5"/><path d="M3 14h18"/>`,
    // cake bar: coated bar with cream stripe
    GRP_CAKEBAR: c => `<rect x="3" y="12" width="18" height="2.4" rx="1.2" ${acc(c)}/><rect x="3" y="8" width="18" height="8.5" rx="2.5"/><path d="M7 8v8.5M12 8v8.5M17 8v8.5" stroke-opacity=".35"/>`,
    // slice cake: wedge with layer line
    GRP_SLICE: c => `<path d="M4 17.5 19.5 9v3.2L4 20z" ${acc(c)}/><path d="M4 17.5 19.5 9v10a1 1 0 0 1-1 1H4.5a.5.5 0 0 1-.5-.5z"/><path d="M4 17.5 19.5 9"/>`,
    // swiss roll: spiral cross-section
    GRP_SWISS: c => `<circle cx="12" cy="12" r="8.5"/><path d="M12 12a1.3 1.3 0 1 1 1.3 1.3A3 3 0 1 1 15 10a5 5 0 1 1-8 1" stroke="${c}" stroke-width="2.2"/>`,
    // pound cake: loaf with crown
    GRP_POUND: c => `<path d="M4 12c0-2.8 3.6-4.8 8-4.8s8 2 8 4.8z" ${acc(c)}/><path d="M4 12c0-2.8 3.6-4.8 8-4.8s8 2 8 4.8"/><path d="M4 12h16v6.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z"/>`,
    // cookies: round tin, or pocket box for the 12 x 44 g pack
    GRP_BUTTER: (c, k) => k.unit === 'box'
      ? `<rect x="4" y="5" width="16" height="15" rx="1.5"/><path d="M4 9h16" /><rect x="4.9" y="5.9" width="14.2" height="2.2" rx=".6" ${acc(c)}/><circle cx="12" cy="14.5" r="3"/><path d="M11 13.8h.01M13 14.2h.01M11.8 15.6h.01" stroke-width="2"/>`
      : `<ellipse cx="12" cy="7" rx="8" ry="2.6" ${acc(c)}/><ellipse cx="12" cy="7" rx="8" ry="2.6"/><path d="M4 7v10c0 1.4 3.6 2.6 8 2.6s8-1.2 8-2.6V7"/><path d="M4 12c0 1.4 3.6 2.6 8 2.6s8-1.2 8-2.6" stroke-opacity=".35"/>`,
    // rusk: stand-up pouch with slice window
    GRP_RUSK: c => `<rect x="5.8" y="4.8" width="12.4" height="3.2" rx=".8" ${acc(c)}/><path d="M6 4h12l1.5 3.5V20a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V7.5z"/><rect x="8.5" y="11" width="7" height="5.5" rx="1.2"/><path d="M10.5 11v5.5M13.5 11v5.5" stroke-opacity=".45"/>`,
  };
  FD.skuIcon = (code, size = 28) => {
    const k = FD.sku(code); const c = FLAV[flavour(k)];
    const s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
    s.setAttribute('class', 'sku-ic'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.6'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.innerHTML = SHAPE[k.group](c, k);
    s.style.setProperty('--flav', c);
    return s;
  };
  FD.skuLabel = (code, sub) => h('span', { class: 'sku-lbl' }, FD.skuTile(code, 30), h('span', { class: 'ellipsis' }, FD.nameOf(FD.sku(code)), sub ? h('small', { class: 'muted', style: { display: 'block' } }, sub) : null));
  FD.skuTile = (code, size = 22, box) => { const ic = FD.skuIcon(code, size); const el = h('span', { class: 'sku-ic-wrap', style: box ? { width: box + 'px', height: box + 'px' } : null }, ic); el.style.setProperty('--flav', ic.style.getPropertyValue('--flav')); return el; };
  FD.key = () => 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
})();
