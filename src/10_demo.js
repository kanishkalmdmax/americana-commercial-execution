(function () {
  // Demo controls: presenter-only, English, visually separate. Emits store events only — never renders product UI.
  const FD = globalThis.FD;
  if (typeof document === 'undefined') return;
  const h = FD.h, I = FD.icon;
  const st = () => FD.state;
  const LS = 'fielddrive.demoPanel';
  const pos = (() => { try { return JSON.parse(localStorage.getItem(LS)) || null; } catch (e) { return null; } })();
  const D = { open: false, vsr: null, mode: 'RANDOM', coverRoute: 'R1', coverVsr: 'V4', resetArmed: false, el: null, x: pos && pos.x, y: pos && pos.y };

  function arrivedStore(vsr) {
    const s = st(); const plan = FD.planFor(s, vsr, s.clock.date);
    const a = plan.stops.find(x => x.status === 'ARRIVED');
    if (a) return a.store;
    const la = s.lastArrive; // covering salesman: the stop may sit on another route's plan
    return la && la.vsr === vsr && s.visits.some(x => x.store === la.store && x.date === s.clock.date && x.status === 'ARRIVED') ? la.store : null;
  }
  const note = text => FD.toast(null, null, { text: 'Demo · ' + text });

  function panel() {
    const s = st(); const rt = FD.route(); const v = rt.role === 'vsr' ? rt.vsr : (D.vsr || s.vsrId);
    const sel = (opts, val, on) => h('select', { class: 'select', on: { change: e => on(e.target.value) } }, opts.map(([id, lb]) => h('option', { value: id, selected: id === val }, lb)));
    const btn = (label, fn, cls = 'secondary', off) => h('button', { type: 'button', class: 'btn ' + cls, disabled: !!off, on: { click: fn } }, label);
    const nm = id => (s.world.stores.find(x => x.id === id) || {}).name;
    const plan = FD.planFor(s, v, s.clock.date); const here = arrivedStore(v); const nextStop = plan.stops.find(x => x.status === 'PLANNED');
    const waiting = Object.keys(s.pendingOrders).length; const cover = s.covers.find(c => c.date === s.clock.date && c.route === D.coverRoute);
    const onPhone = () => FD.route().role === 'vsr';
    const row = (...c) => h('div', { class: 'row wrap', style: { gap: '6px' } }, c);
    const vsrOpts = s.world.vsrs.map(x => [x.id, x.name]);
    const el = h('div', { class: 'demo-panel', role: 'dialog', 'aria-label': 'Demo controls' },
      h('header', { on: { pointerdown: drag } }, I('settings', 's16'), h('span', { class: 'grow' }, 'Demo controls'), h('span', { class: 'chip outline' }, 'Demo only'),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', style: { width: '28px', height: '28px' }, on: { click: toggle } }, I('x', 's16'))),
      h('section', null, h('h5', null, 'CLOCK · ' + s.clock.date + ' ' + s.clock.time),
        row(...[['07:00', 'Morning'], ['13:00', 'Midday'], ['19:00', 'Evening'], ['21:30', 'End of day']].map(([tm, lb]) => btn(lb, () => FD.dx('CLOCK_SET', { date: s.clock.date, time: tm }), s.clock.time === tm ? 'primary' : 'secondary'))),
        row(btn('Previous day', () => FD.dx('CLOCK_SET', { date: FD.addDays(s.clock.date, -1), time: '07:00' }), 'secondary', s.clock.date <= FD.PILOT_START), btn('Next day', () => { FD.dx('CLOCK_SET', { date: FD.addDays(s.clock.date, 1), time: '07:00' }); note('simulated the rest of the day'); }))),
      h('section', null, h('h5', null, 'SALESMAN VISIT'), sel(vsrOpts, v, x => { D.vsr = x; if (onPhone()) FD.go('#/vsr/' + x + '/today'); else redraw(); }),
        h('div', { class: 'small' }, here ? 'At store: ' + nm(here) : nextStop ? 'Next stop: ' + nm(nextStop.store) : 'All stops visited today'),
        row(btn('Arrive at next stop', () => { FD.dx('ARRIVE', { vsr: v }); const a = arrivedStore(v); if (a) { note('arrived at ' + nm(a)); if (onPhone()) FD.go('#/vsr/' + v + '/store/' + a); } }, 'primary', !nextStop || !!here)),
        sel([['RANDOM', 'Random outcome'], ['FULL', 'Sold in full'], ['PARTIAL', 'Sold partly'], ['ALT', 'Sold alternative'], ['NOT_SOLD', 'Not sold']], D.mode, x => { D.mode = x; }),
        row(btn('Simulate SalesBuzz order', () => { FD.dx('SB_ORDER', { vsr: v, store: here, mode: D.mode });
          const rs = st().recs.filter(r => r.store === here && r.date === st().clock.date && r.outcome);
          note(st().pendingOrders[here] ? 'order waiting for SalesBuzz sync' : 'order at ' + nm(here) + ': ' + rs.filter(r => FD.SOLD.includes(r.outcome)).length + ' sold, ' + rs.filter(r => !FD.SOLD.includes(r.outcome)).length + ' not sold'); }, 'primary', !here)),
        !here ? h('div', { class: 'small muted' }, 'Arrive at a store to simulate its order') : null,
        h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: s.delaySync, on: { change: e => FD.dx('SB_ORDER_DELAY', { on: e.target.checked }) } }), 'Delay SalesBuzz sync'),
        row(btn('Deliver delayed order' + (waiting ? ' (' + waiting + ')' : ''), () => { FD.dx('SB_DELIVER_DELAYED', {}); note('delayed order delivered'); }, 'secondary', !waiting), btn('Edit last order', () => { FD.dx('SB_ORDER_EDIT', {}); note('order edited, outcome re-graded'); }, 'secondary', !s.lastOrder))),
      h('section', null, h('h5', null, 'AFTER THE VISIT'),
        row(btn('Simulate return on an upsell', () => { FD.dx('RETURN_ADD', {}); note('return recorded'); })),
        (() => { const lastOf = th => th.messages[th.messages.length - 1]; const wait = s.threads.filter(x => x.messages.length && lastOf(x).by === 'SUP' && (x.team || x.vsr === v))
            .sort((a, b) => (lastOf(b).at.date + lastOf(b).at.time).localeCompare(lastOf(a).at.date + lastOf(a).at.time))[0];
          return row(btn('Simulate salesman reply', () => { const q = ['QV_OK', 'QV_DONE', 'QV_LATER', 'QV_CALL'][wait.messages.length % 4];
            FD.dx('MSG_SEND', { anchor: wait.anchor, by: v, text: FD.t(q), qr: q, replyTo: lastOf(wait).id || null }); note((s.world.vsrs.find(x => x.id === v) || {}).name + ' replied'); }, 'secondary', !wait)); })(),
        h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: s.offline, on: { change: e => FD.dx('OFFLINE_SET', { on: e.target.checked }) } }), 'Salesman phone offline')),
      h('section', null, h('h5', null, 'COVERING SALESMAN (TODAY)'),
        row(sel(s.world.routes.map(r => [r.id, 'Route ' + r.id.slice(1)]), D.coverRoute, x => { D.coverRoute = x; }), sel(vsrOpts, D.coverVsr, x => { D.coverVsr = x; })),
        row(btn('Apply', () => { FD.dx('COVER_SET', { route: D.coverRoute, vsr: D.coverVsr }); note('cover set'); }), btn('Clear', () => { FD.dx('COVER_SET', { route: D.coverRoute, vsr: null }); note('cover cleared'); }, 'secondary', !cover)),
        cover ? h('div', { class: 'small muted' }, 'Today: ' + (s.world.vsrs.find(x => x.id === cover.vsr) || {}).name + ' covers Route ' + D.coverRoute.slice(1)) : null),
      h('section', null, h('h5', null, 'PRESENTER'),
        row(btn('Engine learning (internal)', () => FD.go('#/sup/learn'))),
        row(btn('Guided demo (5 steps)', guided, 'primary'), btn('Replay tour', () => { FD.dx('TOUR_RESET'); FD.tour(FD.route().role); })),
        row(btn(D.resetArmed ? 'Click again to reset' : 'Reset demo', () => { if (!D.resetArmed) { D.resetArmed = true; redraw(); setTimeout(() => { D.resetArmed = false; redraw(); }, 3000); return; }
          D.resetArmed = false; FD.closeAllOverlays(); FD.reset(); note('reset to seed data'); }, D.resetArmed ? 'danger' : 'secondary')),
        h('div', { class: 'small muted' }, 'Ctrl + . or Esc closes this panel')));
    Object.assign(el.style, D.x != null ? { left: Math.min(D.x, innerWidth - 120) + 'px', top: Math.min(D.y, innerHeight - 60) + 'px' } : { right: '16px', top: '16px' });
    return el;
  }
  function drag(e) {
    if (e.target.closest('button')) return;
    const el = D.el; const r = el.getBoundingClientRect(); const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const move = ev => { D.x = Math.max(0, Math.min(innerWidth - 60, ev.clientX - dx)); D.y = Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy)); Object.assign(el.style, { left: D.x + 'px', top: D.y + 'px', right: 'auto', bottom: 'auto' }); };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); try { localStorage.setItem(LS, JSON.stringify({ x: D.x, y: D.y })); } catch (err) { } };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  }
  function redraw() {
    const root = document.getElementById('demo-root'); if (!root) return;
    // user request: no on-screen demo button; Ctrl + . always works, ?demo in the URL shows the button (phones have no keyboard)
    const fab = !/[?&]demo/.test(location.search) ? null : h('button', { type: 'button', class: 'demo-fab', 'aria-expanded': D.open ? 'true' : 'false', title: 'Demo controls (Ctrl + .)', on: { click: toggle } }, I('settings', 's16'), 'Demo');
    D.el = D.open ? panel() : null;
    root.replaceChildren(...(fab ? [fab] : []), ...(D.el ? [D.el] : []), ...(G.caption ? [G.caption] : []));
  }
  function toggle() { D.open = !D.open; redraw(); }
  FD.demoToggle = toggle;

  // ---------- guided demo: the full loop in 5 steps ----------
  const G = { step: 0, caption: null, store: null, rec: null };
  function guided() {
    D.open = false; FD.demoRunning = true; if (FD.tourEnd) FD.tourEnd(); FD.closeAllOverlays(); G.step = 0; G.store = null; G.rec = null;
    if (st().lang !== 'en') { /* keep the presenter's language */ }
    runStep();
  }
  const V2 = 'V2';
  const STEPS = [
    { cap: '1 / 5 · Imran starts his day. He reviews today\'s recommended products across his stops and confirms the list.', run() {
      FD.dx('CLOCK_SET', { date: st().clock.date, time: '07:00' }); FD.dx('SET_VSR', { vsr: V2 }); FD.go('#/vsr/' + V2 + '/today'); } },
    { cap: '2 / 5 · He reaches his first store. Live location triggers the notification: what this store is missing and what to offer.', run() {
      FD.dx('DAY_CONFIRM', { vsr: V2 }); FD.dx('CLOCK_SET', { date: st().clock.date, time: '09:10' });
      const plan = FD.planFor(st(), V2, st().clock.date); const stop = plan.stops.find(x => x.status === 'PLANNED' && plan.recs.some(r => r.store === x.store && r.outcome === null));
      if (!stop) return; G.store = stop.store; FD.dx('ARRIVE', { vsr: V2, store: stop.store }); setTimeout(() => FD.go('#/vsr/' + V2 + '/store/' + stop.store), 900); } },
    { cap: '3 / 5 · He sells in SalesBuzz as usual. FieldDrive reads the order: the upsell was not in it, so he taps the reason (price) in two taps.', run() {
      if (!G.store) return; FD.dx('SB_ORDER', { vsr: V2, store: G.store, mode: 'NOT_SOLD' });
      const rec = st().recs.find(r => r.store === G.store && r.date === st().clock.date && r.outcome === 'NOT_SOLD'); G.rec = rec && rec.id;
      if (rec) setTimeout(() => FD.vsr.reasonSheet(rec.id, 'NOT_SOLD'), 900);
      setTimeout(() => { const gr = G.rec && st().recs.find(r => r.id === G.rec); if (G.caption && gr && !gr.reason) { FD.sheet.closeAll(); FD.dx('REASON_SAVE', { recId: G.rec, reason: 'R_PRICE', comment: 'Owner says the box price is too high for his shop.' }); FD.toast('S_SAVED'); } }, 3200); } },
    { cap: '4 / 5 · The supervisor sees it immediately under "Why it didn\'t sell", with the reason and comment, and a drafted coaching tip.', run() {
      FD.go('#/sup/home'); setTimeout(() => FD.sup.reasonDrawer({ group: 'RG_MONEY', kind: 'NOT_SOLD' }), 500); } },
    { cap: '5 / 5 · He sends the tip in one click. Imran gets it on his phone and on the next matching card. Loop closed.', run() {
      FD.drawer.closeAll(); const rec = G.rec && st().recs.find(r => r.id === G.rec);
      FD.dx('TIP_SEND', { vsr: V2, tpl: 'K_PRICE', slots: FD.tipSlots(rec ? rec.sku : '3040421754') });
      FD.go('#/vsr/' + V2 + '/me'); } },
  ];
  function runStep() {
    const s = STEPS[G.step];
    G.caption = h('div', { class: 'demo-caption', role: 'status' }, h('span', { class: 'grow' }, s.cap),
      h('button', { type: 'button', class: 'btn ghost sm', style: { color: 'var(--paper)' }, on: { click: end } }, 'Exit'),
      h('button', { type: 'button', class: 'btn primary sm', on: { click: next } }, G.step === STEPS.length - 1 ? 'Finish' : 'Next'));
    redraw(); s.run();
  }
  function next() { G.step++; if (G.step >= STEPS.length) return end(); runStep(); }
  function end() { G.caption = null; G.rec = null; FD.demoRunning = false; redraw(); }

  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === '.') { e.preventDefault(); toggle(); } else if (e.key === 'Escape' && D.open && !document.querySelector('.coach-mark')) toggle(); });
  addEventListener('hashchange', () => { if (D.open) setTimeout(redraw, 0); });
  FD.bus.on('change', () => { if (D.open) redraw(); });
  const start = () => { if (FD.state) redraw(); else setTimeout(start, 200); };
  start();
})();
