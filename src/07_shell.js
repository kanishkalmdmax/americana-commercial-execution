(function () {
  const FD = globalThis.FD;
  if (typeof document === 'undefined') return;
  const h = FD.h, I = FD.icon;
  FD.views = { sup: {}, vsr: {} };
  FD.registerView = (role, name, fn) => { FD.views[role][name] = fn; };

  // ---------- routing: #/sup/<page>[/<id>]  ·  #/vsr/<vsrId>/<tab>[/<id>] ----------
  FD.route = () => {
    const parts = (location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    if (parts[0] === 'vsr' && FD.state.world.vsrs.some(v => v.id === parts[1])) return { role: 'vsr', vsr: parts[1], page: parts[2] || 'today', id: parts[3] || null, parts };
    return { role: 'sup', page: parts[1] || 'home', id: parts[2] || null, parts };
  };
  FD.go = hash => { if (FD.ovPending && FD.ovPending()) return FD.ovAfter(hash); if (location.hash !== hash) location.hash = hash; else FD.render(); };
  FD.dx = (type, payload = {}) => FD.dispatch(type, Object.assign({ key: FD.key() }, payload)); // UI dispatch with idempotency key

  // ---------- render loop (rebuilds #app only; overlays refresh their own bodies) ----------
  const scrollMem = {};
  let lastKey = null, queued = false;
  FD.schedule = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; FD.render(); }); };
  FD.applyPrefs = () => {
    const st = FD.state; FD.lang = st.lang; FD.digits = st.digits;
    const root = document.documentElement;
    root.lang = st.lang; root.dir = st.lang === 'ar' ? 'rtl' : 'ltr';
    if (st.theme === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = st.theme;
    if (st.textSize === 'large') root.dataset.text = 'large'; else root.removeAttribute('data-text');
  };
  // signed-out state lives in this browser only; the demo data stays as it was
  const OUT = 'fd.signedOut';
  FD.isSignedOut = () => { try { return localStorage.getItem(OUT) === '1'; } catch (e) { return !!FD._out; } };
  FD.signOut = () => { try { localStorage.setItem(OUT, '1'); } catch (e) { FD._out = true; } if (FD.chatClose) FD.chatClose(); if (FD.closeAllOverlays) FD.closeAllOverlays(); FD.render(); };
  FD.signIn = hash => { try { localStorage.removeItem(OUT); } catch (e) { FD._out = false; } location.hash = hash; FD.render(); };
  function signInView() { const st = FD.state; let who = st.role === 'vsr' ? st.vsrId : 'SUP';
    return h('div', { class: 'signin' }, h('div', { class: 'signin-card card' },
      h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'logo-dot' }, FD.icon('route', 's16')), h('b', { style: { fontSize: '18px' } }, 'FieldDrive')),
      h('div', { class: 'muted small' }, FD.t('L_SIGNED_OUT')),
      h('div', { class: 'field' }, h('label', null, FD.t('L_SIGN_IN_AS')), FD.select([{ id: 'SUP', label: FD.nameOf(st.world.supervisor) + ' · ' + FD.t('L_SUPERVISOR') }].concat(st.world.vsrs.map(v => ({ id: v.id, label: FD.nameOf(v) + ' · ' + FD.t('L_ROLE_VSR') }))), who, x => { who = x; })),
      FD.btn(FD.t('L_SIGN_IN'), () => FD.signIn(who === 'SUP' ? '#/sup/home' : '#/vsr/' + who + '/today'), 'primary lg block')));
  }
  FD.render = function () {
    const st = FD.state; if (!st) return;
    if (FD.isSignedOut()) { FD.applyPrefs(); document.getElementById('app').replaceChildren(signInView()); const c = document.getElementById('chrome'); if (c) c.replaceChildren(); document.body.classList.remove('vsr-mode'); return; }
    FD.applyPrefs();
    const r = FD.route();
    if (st.role !== r.role) st.role = r.role; // mirrors the URL; UI-local
    if (r.role === 'vsr' && st.vsrId !== r.vsr) st.vsrId = r.vsr;
    const key = location.hash;
    const scroller = () => r.role === 'vsr' ? document.querySelector('.v-body') : document.scrollingElement;
    if (lastKey) { const s = document.querySelector(lastKey.startsWith('#/vsr') ? '.v-body' : 'html'); if (s) scrollMem[lastKey] = s.scrollTop; }
    const app = document.getElementById('app');
    let view;
    try {
      const fn = FD.views[r.role][r.page] || FD.views[r.role][r.role === 'vsr' ? 'today' : 'home'];
      view = r.role === 'vsr' ? FD.vsr.shell(r, fn) : FD.sup.layout(r, fn);
    } catch (err) {
      console.error(err);
      view = h('div', { class: 'err-card' }, h('b', null, 'Something went wrong on this screen. '), String(err && err.message || err), ' ', FD.btn('Home', () => FD.go('#/sup/home'), 'secondary sm'));
    }
    app.replaceChildren(view);
    document.body.classList.toggle('vsr-mode', r.role === 'vsr');
    renderChrome(r);
    const s = scroller(); if (s) s.scrollTop = key === lastKey ? (scrollMem[key] || 0) : (scrollMem[key] || 0);
    lastKey = key;
    FD.drawer.refresh(false);
    FD.sheet.rehost(); FD.sheet.refreshLive(); FD.restoreSearchFocus();
    if (FD.afterRender) FD.afterRender(r);
  };

  // ---------- global chrome: liquid-glass role switcher + language ----------
  function renderChrome(r) {
    let c = document.getElementById('chrome');
    if (!c) { c = h('div', { id: 'chrome', class: 'chrome' }); document.body.appendChild(c); }
    const sw = FD.seg([{ id: 'sup', label: FD.t('L_ROLE_SUP'), icon: 'chart' }, { id: 'vsr', label: FD.t('L_ROLE_VSR'), icon: 'phone' }], r.role, id => {
      if (id === 'sup') FD.go('#/sup/home'); else openAsSheet();
    }, 'glass');
    sw.setAttribute('aria-label', 'Role');
    const lang = h('button', { class: 'lang-btn glass', type: 'button', 'aria-label': FD.t('L_LANGUAGE'), title: FD.t('L_LANGUAGE'),
      on: { click: () => FD.dx('SET_LANG', { lang: FD.state.lang === 'ar' ? 'en' : 'ar' }) } }, FD.state.lang === 'ar' ? 'EN' : 'ع');
    c.replaceChildren(sw, lang);
  }
  function openAsSheet() {
    const st = FD.state;
    FD.sheet.open({ center: true, title: FD.t('L_OPEN_AS'), render: () => h('div', { class: 'stack s8' },
      st.world.vsrs.map(v => {
        const plan = FD.planFor(st, v.id, st.clock.date); const route = st.world.routes.find(x => x.id === v.route);
        return h('button', { type: 'button', class: 'list-row click', style: { borderRadius: '12px', border: '1px solid var(--line)' }, on: { click: () => { FD.sheet.close(); FD.dx('SET_VSR', { vsr: v.id }); FD.go('#/vsr/' + v.id + '/today'); } } },
          FD.avatar(v), h('div', { class: 'grow', style: { textAlign: 'start' } }, h('div', { style: { fontWeight: 600 } }, FD.nameOf(v)), h('div', { class: 'muted small ellipsis' }, FD.nameOf(route))),
          FD.chip(FD.t('L_TODAY_STOPS', { n: FD.fmt.num(plan.stops.length) }), v.id === st.vsrId ? 'info' : ''), I('chevron-right', 's16'));
      })) });
  }
  FD.openAsSheet = openAsSheet;

  // ---------- notification banner (inside the phone) ----------
  FD.notifText = n => ({ title: FD.tx(n.tpl, n.slots), body: FD.has(n.tpl + '_B') ? FD.tx(n.tpl + '_B', n.slots) : '' });
  FD.notifyBanner = function (n) {
    const screen = document.querySelector('.phone-screen'); if (!screen) return;
    const old = screen.querySelector('.notif-banner'); if (old) old.remove();
    const { title, body } = FD.notifText(n);
    const b = h('div', { class: 'notif-banner glass', role: 'alert', tabindex: '0' },
      h('span', { class: 'app-ic' }, I('bell', 's16')),
      h('div', { class: 'grow' }, h('small', null, 'FieldDrive · ' + FD.t('L_NOW')), h('b', null, title), body ? h('span', null, body) : null),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': FD.t('L_CLOSE'), style: { width: '32px', height: '32px' }, on: { click: e => { e.stopPropagation(); hide(); } } }, I('x', 's16')));
    const open = () => { hide(); FD.dx('NOTIF_READ', { id: n.id }); FD.openNotifTarget(n); };
    b.addEventListener('click', open); b.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
    let y0 = null; b.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
    b.addEventListener('touchmove', e => { if (y0 != null && e.touches[0].clientY - y0 < -20) hide(); }, { passive: true });
    screen.appendChild(b);
    requestAnimationFrame(() => b.classList.add('on'));
    const t = setTimeout(hide, 6000);
    function hide() { clearTimeout(t); b.classList.remove('on'); setTimeout(() => b.remove(), 350); }
  };
  FD.openNotifTarget = n => {
    const v = FD.state.vsrId, tg = n.target || {};
    if (tg.screen === 'store') { FD.go('#/vsr/' + v + '/store/' + tg.store); if (tg.reason && tg.rec) setTimeout(() => FD.vsr.reasonSheet(tg.rec, 'NOT_SOLD'), 350); }
    else if (tg.screen === 'todo') FD.go('#/vsr/' + v + '/todo');
    else if (tg.screen === 'tip') { FD.go('#/vsr/' + v + '/me'); setTimeout(() => FD.vsr.tipSheet(tg.tip), 300); }
    else if (tg.screen === 'thread') { const th = FD.state.threads.find(t => t.id === tg.thread); if (th) FD.chatOpen(th.anchor, 'VSR'); }
  };

  // ---------- first-run tour (coach marks) ----------
  FD.tour = function (role) {
    const steps = role === 'vsr' ? ['O_V1', 'O_V2', 'O_V3'] : ['O_S1', 'O_S2', 'O_S3'];
    let i = 0, ring = null, card = null;
    if (FD.tourEnd) FD.tourEnd(); // never two tours stacked
    let raf = 0; const onScroll = () => { if (card && !raf) raf = requestAnimationFrame(() => { raf = 0; if (card) show(true); }); };
    const end = () => { if (ring) ring.remove(); if (card) card.remove(); ring = card = null; document.removeEventListener('keydown', onKey); removeEventListener('resize', onResize); removeEventListener('scroll', onScroll, true); if (FD.tourEnd === end) FD.tourEnd = null; FD.dx('TOUR_SEEN', { role }); };
    FD.tourEnd = end; addEventListener('scroll', onScroll, true);
    const onResize = () => { if (card) show(); }; addEventListener('resize', onResize);
    document.querySelectorAll('.coach-mark,.coach-ring').forEach(x => x.remove()); // never two tours stacked
    const onKey = e => { if (e.key === 'Escape') end(); };
    document.addEventListener('keydown', onKey);
    function show(quiet) {
      if (ring) ring.remove(); if (card) card.remove();
      const target = document.querySelector(`[data-tour="${role}${i + 1}"]`);
      // bring the target on screen first, otherwise the card can land below the fold on short windows
      if (target && !quiet) target.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r0 = target ? target.getBoundingClientRect() : null;
      const r = r0 ? { left: r0.left, top: Math.max(8, r0.top), width: r0.width, height: Math.min(r0.height, innerHeight - 180), bottom: Math.min(r0.bottom, innerHeight - 170) } : { left: innerWidth / 2 - 100, top: innerHeight / 2 - 40, width: 200, height: 80, bottom: innerHeight / 2 + 40 };
      if (target) { ring = h('div', { class: 'coach-ring' }); Object.assign(ring.style, { left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' }); document.body.appendChild(ring); }
      card = h('div', { class: 'coach-mark', role: 'dialog', 'aria-live': 'polite' },
        h('div', { class: 'small', style: { opacity: .7, marginBottom: '4px' } }, FD.fmt.num(i + 1) + ' / ' + FD.fmt.num(steps.length)), h('div', null, FD.t(steps[i])),
        h('div', { class: 'row between' }, h('button', { class: 'btn ghost sm', type: 'button', on: { click: end } }, FD.t('O_SKIP')),
          h('button', { class: 'btn primary sm', type: 'button', on: { click: () => { i++; if (i >= steps.length) end(); else show(); } } }, FD.t(i === steps.length - 1 ? 'O_DONE' : 'O_NEXT'))));
      document.body.appendChild(card);
      const cr = card.getBoundingClientRect();
      let top = r.bottom + 14; if (top + cr.height > innerHeight - 12) top = r.top - cr.height - 14;
      top = Math.max(12, Math.min(innerHeight - cr.height - 12, top)); // always fully visible
      const left = Math.max(12, Math.min(innerWidth - cr.width - 12, r.left + r.width / 2 - cr.width / 2));
      Object.assign(card.style, { top: top + 'px', left: left + 'px' });
      if (!quiet) card.querySelector('.btn.primary').focus();
    }
    setTimeout(show, 350);
  };
  FD.maybeTour = r => { if (!FD.state.tourSeen[r.role] && !document.querySelector('.coach-mark') && !FD.demoRunning) FD.tour(r.role); };

  // ---------- shared thread sheet (recommendation, store or follow-up anchor) ----------
  // chat lives in 07b_chat.js
})();
