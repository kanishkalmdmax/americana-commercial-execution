(function () {
  const FD = globalThis.FD;
  if (typeof document === 'undefined') return;
  // Supervisor control room (R7): Today, the van day tab, Pre-orders, Data status, journey plan review.
  const h = FD.h, I = FD.icon, t = (...a) => FD.t(...a), tx = FD.tx;
  const S = FD.sup; const L = FD.ui.local;
  const st = () => FD.state; const today = () => st().clock.date;
  const storeOf = id => st().world.stores.find(s => s.id === id);
  const vsrOf = id => st().world.vsrs.find(v => v.id === id);
  const STAGE = { PLAN_READY: ['ST_PLAN_READY', 'info'], DISPATCHED: ['ST_DISPATCHED', 'info'], LIVE: ['ST_LIVE', 'good'], CLOSED: ['ST_CLOSED', ''], NO_ACTIVITY: ['ST_NO_ACTIVITY', ''] };
  const gid = (id, n) => n === 1 && FD.has(id + '1') ? id + '1' : id; // singular wording for one
  const stageChip = sg => FD.chip(t(STAGE[sg][0]), STAGE[sg][1]);
  const ALERT_IC = { A_MISSED: 'alert', A_OFFPLAN: 'map-pin', A_PACE: 'clock', A_PREORDER: 'inbox' };
  const X_IC = { X_CARRY: 'repeat', X_QUESTION: 'help', X_DUE: 'calendar', X_SKIPPED: 'alert', X_SHORT: 'truck', X_PREORDER: 'inbox' };
  S.vans = () => st().world.vsrs.filter(v => (!S.f.sup || v.sup === S.f.sup) && (!S.f.route || v.route === S.f.route));
  S.updatedLine = () => h('span', { class: 'small muted row', style: { gap: '6px' } }, I('refresh', 's14'), FD.liveData(st()) ? t('L_UPDATED', { time: FD.fmt.time(st().clock.time.slice(0, 3) + '00') }) : tx('L_DATA_UPTO', { date: FD.dataDay(st()) }));
  // what the supervisor can act on: SalesBuzz alerts from the latest data day, WhatsApp pre-orders live
  S.alertGroupsNow = () => FD.supervisorAlertGroups(st(),S.vans().map(v=>v.id));

  // ---------- van tile ----------
  const SQ = { sale: 'L_SQ_SALE', nosale: 'L_SQ_NOSALE', now: 'L_SQ_NOW', missed: 'L_SQ_MISSED', todo: 'L_SQ_TODO' };
  function vanStat(v) {
    const s = st(); const d = today(); const live = FD.liveData(s); const sg = FD.stageFor(s, v.id, d); const pd = live ? d : FD.dataDay(s); const p = FD.vanProgress(s, v.id, pd);
    return { v, sg, p, alerts: S.alertGroupsNow().filter(g => g.van === v.id).reduce((n, g) => n + g.count, 0) };
  }
  // plan adherence: a square per planned stop in route order, coloured by outcome; hover says what happened
  const stopSq = p => h('div', { class: 'stop-sq', role: 'img', 'aria-label': t('L_PLAN_ADHERENCE') + ' · ' + tx('L_STOPS_DONE', { n: p.done, m: p.planned }) },
    p.stops.map(x => h('i', { class: x.kind + (x.col ? ' ' + x.col : ''), title: [FD.nameOf(storeOf(x.store)), t(SQ[x.kind]), x.at ? FD.fmt.time(x.at) : '', colText(x)].filter(Boolean).join(' · ') })));
  // collection outcome, next to the order outcome
  const colText = x => x.col === 'paid' ? tx('L_SQ_PAID', { money: FD.fmt.money0(x.paid) }) : x.col === 'due' ? t('L_SQ_DUE') : '';
  function vanTile(v) {
    const { sg, p, alerts } = vanStat(v);
    const money = h('div', { class: 'small' }, FD.fmt.money0(p.sales), h('span', { class: 'muted' }, ' / ' + FD.fmt.money0(p.expected)));
    return h('div', { class: 'van-tile' + (sg === 'NO_ACTIVITY' ? ' quiet' : '') + (L['map:sel'] === v.id ? ' sel' : '') },
      h('button', { type: 'button', class: 'van-loc', 'aria-label': t('L_LOCATE') + ' · ' + FD.nameOf(v), title: t('L_LOCATE'), on: { click: () => S.locateVan(v.id) } }, I('map-pin', 's16')),
      h('button', { type: 'button', class: 'van-main', on: { click: () => S.vsrDrawer(v.id, false, 'day') } },
      // the salesman is the heading; route code is secondary; the badge says what it counts
      h('div', { class: 'row van-head' }, h('b', { class: 'ellipsis grow' }, FD.nameOf(v)), alerts ? h('span', { class: 'badge', title: t('L_ALERTS') + ' · ' + FD.fmt.num(alerts), 'aria-label': t('L_ALERTS') + ' · ' + FD.fmt.num(alerts) }, FD.fmt.num(alerts)) : null),
      h('div', { class: 'small muted ellipsis' }, FD.routeArea(st().world.routes.find(r => r.id === v.route))),
      h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, stageChip(sg)),
      sg === 'NO_ACTIVITY' && !p.planned ? null : h('div', { class: 'stack', style: { gap: '4px' } },
        stopSq(p),
        h('div', { class: 'small nowrap' }, tx('L_STOPS_DONE', { n: p.done, m: p.planned })), p.offPlan ? h('div', { class: 'small muted nowrap' }, '+' + FD.fmt.num(p.offPlan) + ' ' + t('L_OFF_PLAN')) : null,
        money)));
  }
  function vanList(vans) {
    return FD.table({ id: 'vanList', rows: vans.map(vanStat), onRow: r => S.vsrDrawer(r.v.id, false, 'day'), columns: [
      { key: 'n', label: t('L_COL_VSR'), render: r => h('div', { style: { minWidth: 0 } }, h('b', { class: 'ellipsis', style: { display: 'block' } }, FD.nameOf(r.v)), h('span', { class: 'small muted ellipsis', style: { display: 'block' } }, FD.routeArea(st().world.routes.find(x => x.id === r.v.route)))) },
      { key: 'sg', label: t('L_COL_STATUS'), render: r => stageChip(r.sg) },
      { key: 'sq', label: t('L_PLAN_ADHERENCE'), nosort: true, render: r => r.p.planned ? stopSq(r.p) : null },
      { key: 'st', label: t('L_COL_STOPS'), num: true, sort: (a, b) => a.p.done / (a.p.planned || 1) - b.p.done / (b.p.planned || 1), render: r => r.p.planned ? tx('L_STOPS_DONE', { n: r.p.done, m: r.p.planned }) : '—' },
      { key: 'off', label: t('L_OFF_PLAN'), num: true, sort: (a, b) => a.p.offPlan - b.p.offPlan, render: r => r.p.offPlan ? '+' + FD.fmt.num(r.p.offPlan) : '—' },
      { key: 'sales', label: t('L_COL_SALES'), num: true, sort: (a, b) => a.p.sales - b.p.sales, render: r => h('span', null, FD.fmt.money0(r.p.sales), h('span', { class: 'muted exp' }, ' / ' + FD.fmt.money0(r.p.expected))) },
      { key: 'al', label: t('L_ALERTS'), num: true, sort: (a, b) => a.alerts - b.alerts, render: r => r.alerts ? h('span', { class: 'badge' }, FD.fmt.num(r.alerts)) : '—' },
      { key: 'loc', label: '', render: r => FD.iconBtn('map-pin', t('L_LOCATE'), () => S.locateVan(r.v.id)) }] });
  }
  // vans | map split: drag the divider (or arrow keys); the ends hide one side; double-click resets; kept per browser
  const pref = (k, dflt) => { try { const v = localStorage.getItem('fd.' + k); if (v != null) return v; } catch (e) { } return L[k] != null ? L[k] : dflt; };
  const setPref = (k, v) => { L[k] = String(v); try { localStorage.setItem('fd.' + k, String(v)); } catch (e) { } };
  function ctlSplit(left, right) {
    const p = +pref('ctlSplit', 50); const set = v => { setPref('ctlSplit', v); FD.render(); };
    const grip = h('div', { class: 'ctl-split', role: 'separator', tabindex: '0', 'aria-orientation': 'vertical', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(p), 'aria-label': t('L_RESIZE_SPLIT'), title: t('L_RESIZE_SPLIT'), on: {
      pointerdown: e => { e.preventDefault(); const box = grip.parentNode, r = box.getBoundingClientRect(), rtl = getComputedStyle(box).direction === 'rtl'; let v = p;
        box.classList.remove('list-only', 'map-only');
        const move = ev => { v = Math.max(0, Math.min(100, Math.round(100 * (rtl ? r.right - ev.clientX : ev.clientX - r.left) / r.width))); box.style.setProperty('--ctl-l', Math.max(15, Math.min(85, v))); };
        const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); set(v < 12 ? 0 : v > 88 ? 100 : v); };
        addEventListener('pointermove', move); addEventListener('pointerup', up); },
      keydown: e => { const rtl = getComputedStyle(grip).direction === 'rtl'; const k = { ArrowLeft: -10, ArrowRight: 10 }[e.key]; if (k) { e.preventDefault(); set(Math.max(0, Math.min(100, p + (rtl ? -k : k)))); } else if (e.key === 'Home') set(0); else if (e.key === 'End') set(100); },
      dblclick: () => set(50) } }, h('span'));
    return h('div', { class: 'ctl split' + (p <= 0 ? ' map-only' : p >= 100 ? ' list-only' : ''), style: '--ctl-l:' + Math.max(15, Math.min(85, p)) }, left, grip, right);
  }
  // locate: the map switches to vans and the chosen van turns red
  S.locateVan = id => { L['map:mode'] = 'VANS'; L['map:sel'] = id; if (L['map:van'] && L['map:van'] !== id) L['map:van'] = ''; FD.render();
    setTimeout(() => { const m = document.querySelector('.ctl-map'); if (m) { const r = m.getBoundingClientRect(); if (r.top < 0 || r.top > innerHeight - 160) m.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 60); };

  // ---------- alerts (one row per van and type, expandable to its stops) ----------
  function alertRow(g) {
    const open = L['al:' + g.type + g.van]; const v = vsrOf(g.van);
    const head = g.type === 'A_PACE' ? tx('A_PACE', g.items[0].slots) : g.type === 'A_PREORDER' ? tx(gid('A_PREORDER_G', g.count), { n: g.count }) : tx(gid(g.type + '_G', g.count), { vsrId: g.van, n: g.count });
    const act = g.type === 'A_MISSED' ? FD.btn(t('ACT_VIEW_STOPS'), () => S.vsrDrawer(g.van, false, 'day',{date:g.day}), 'secondary sm')
      : g.type === 'A_OFFPLAN' ? FD.btn(t('ACT_ASK_WHY'), () => FD.threadSheet({ type: 'vsr', id: g.van }, 'SUP'), 'secondary sm')
      : g.type === 'A_PACE' ? FD.btn(t('L_MESSAGE'), () => FD.threadSheet({ type: 'vsr', id: g.van }, 'SUP'), 'secondary sm')
      : FD.btn(t('L_NAV_PREORDERS'), () => S.preordersDrawer(), 'secondary sm');
    const canOpen = g.type !== 'A_PACE';
    const resolve = () => { const keys = g.items.map(a => FD.alertKey(a, g.day || today())); FD.dx('ALERT_RESOLVE', { keys }); FD.toast(null, null, { text: t('L_RESOLVED'), undo: () => FD.dx('ALERT_RESOLVE', { keys, undo: true }) }); };
    return h('div', { class: 'alert-g' },
      h('div', { class: 'list-row' }, h('button', { type: 'button', class: 'row-toggle', 'aria-expanded': canOpen ? String(!!open) : null, disabled: !canOpen, on: { click: () => { if (!canOpen) return; L['al:' + g.type + g.van] = !open; FD.render(); } } },
          h('span', { class: 'fu-ic ' + (g.type === 'A_MISSED' ? 'bad' : g.type === 'A_PACE' ? 'warn' : '') }, I(ALERT_IC[g.type], 's16')),
          h('span', { class: 'grow', style: { minWidth: 0 } }, h('span', { class: 'fu-t' }, head), v ? h('span', { class: 'fu-c' }, (g.day && g.day !== today() ? FD.fmt.date(g.day) : t(STAGE[FD.stageFor(st(), v.id, today())][0]))) : null, S.leverChip(FD.leverOf(g.type))),
          canOpen ? I(open ? 'chevron-up' : 'chevron-down', 's16') : null),
        act, FD.iconBtn('check', t('L_RESOLVE'), resolve)),
      open ? h('div', { class: 'alert-items' }, g.items.slice(0, 40).map(a => h('button', { type: 'button', class: 'list-row click', on: { click: () => a.store ? S.storeDrawer(a.store) : null } },
        h('span', { class: 'grow ellipsis' }, FD.nameOf(storeOf(a.store))), a.at ? h('span', { class: 'small muted tabular' }, FD.fmt.time(a.at)) : null, I('chevron-right', 's16')))) : null);
  }

  // ---------- close the day ----------
  function closeCard(vans) {
    const s = st(); const d = today(); if (!FD.liveData(s)) return null;
    if (FD.dayClosed(s, d)) return h('div', { class: 'card', style: { padding: '14px 16px' } }, h('div', { class: 'row' }, I('check', 's16'), h('span', null, t('L_DAY_CLOSED'))));
    if (!FD.allVansClosed(s, d)) return null;
    const rows = vans.filter(v => FD.vanStage(s, v.id, d) !== 'NO_ACTIVITY').map(v => Object.assign({ v }, FD.vanProgress(s, v.id, d)));
    const pending = s.recs.filter(r => r.date === d && ['NOT_SOLD', 'NOT_OFFERED'].includes(r.outcome) && !r.reason && !r.exempted).length;
    return S.card(t('L_CLOSE_THE_DAY'), t('L_CLOSE_THE_DAY_HELP'), h('div', { class: 'stack s12' },
      FD.table({ id: 'closeDay', rows, columns: [
        { key: 'v', label: t('L_COL_SALESMAN'), render: x => h('span', null, FD.nameOf(x.v)) },
        { key: 'done', label: t('L_VISITED'), num: true, sort: (a, b) => a.done - b.done, render: x => tx('L_STOPS_DONE', { n: x.done, m: x.planned }) },
        { key: 'missed', label: t('L_MISSED'), num: true, sort: (a, b) => a.missed - b.missed, render: x => FD.fmt.num(x.missed) },
        { key: 'off', label: t('L_OFF_PLAN'), num: true, sort: (a, b) => a.offPlan - b.offPlan, render: x => FD.fmt.num(x.offPlan) },
        { key: 'sales', label: t('L_SALES_TODAY'), num: true, sort: (a, b) => a.sales - b.sales, render: x => FD.fmt.money0(x.sales) }] }),
      h('div', { class: 'row between', style: { flexWrap: 'wrap', gap: '8px' } }, pending ? FD.chip(t('L_KPI_MISSING') + ' · ' + FD.fmt.num(pending), 'bad') : h('span'),
        FD.btn(t('ACT_CLOSE_DAY'), () => { FD.dx('DAY_CLOSE', {}); FD.toast(null, null, { text: t('L_DAY_CLOSED') }); }, 'primary', 'check'))), { icon: 'check', tour: null });
  }

  // ---------- map: today's stops of the filtered vans ----------
  // map: vans by default (where each van is now); Stores shows today's stops
  function mapCard(vans) {
    const s = st(); const d = today(); const live = FD.liveData(s); const mode = live ? (L['map:mode'] || 'VANS') : 'STORES';
    const mv = L['map:van'] && vans.some(v => v.id === L['map:van']) ? L['map:van'] : ''; const shown = vans.filter(v => !mv || v.id === mv); const ids = new Set(shown.map(v => v.id));
    let pts, legend;
    const key = (cls, label) => h('span', { class: 'map-key' }, h('i', { class: 'pin-dot ' + cls }), label);
    if (mode === 'VANS') {
      const sel = L['map:sel'];
      const all = shown.map(v => { const p = FD.vanPosition(s, v.id, d); const sg = FD.vanStage(s, v.id, d); const pr = FD.vanProgress(s, v.id, d);
        const where = p.at === 'DEPOT' ? t('L_AT_DEPOT') : tx('L_VAN_AT', { storeId: p.store, time: p.time });
        return { id: v.id, lat: p.lat, lng: p.lng, van: true, sel: sel === v.id, depot: p.at === 'DEPOT', label: FD.initials(v.name), status: 'VAN ' + (p.at === 'DEPOT' ? 'DEPOT' : sg),
          name: FD.nameOf(v), sub: [t(STAGE[sg][0]), where, tx('L_STOPS_DONE', { n: pr.done, m: pr.planned })].join(' · '), open: () => S.vsrDrawer(v.id, false, 'day') }; });
      // ponytail: fixed irregular parking offsets (lat, lng); vans at the same spot are nudged so every pin stays visible
      const PARK = [[0, 0], [0.016, 0.021], [-0.014, 0.028], [0.024, -0.012], [-0.02, -0.017], [0.005, -0.03], [-0.03, 0.006], [0.033, 0.012], [0.012, 0.042], [-0.008, -0.042], [0.038, -0.03], [-0.036, 0.034]];
      let di = 0; all.forEach(x => { if (x.depot) { const o = PARK[di++ % PARK.length]; x.lat += o[0]; x.lng += o[1]; } });
      all.forEach((x, i) => { for (let j = 0; j < i; j++) if (Math.abs(all[j].lat - x.lat) < 0.006 && Math.abs(all[j].lng - x.lng) < 0.012) { x.lat += 0.007; x.lng += 0.009; } });
      pts = all;
      legend = h('div', { class: 'map-legend' }, key('VAN', t('ST_LIVE')), key('VAN-DONE', t('ST_CLOSED')), key('VAN-DEPOT', t('L_AT_DEPOT')), key('VAN-SEL', t('L_SELECTED')));
    } else {
      const missed = new Set(FD.alerts(s, d).filter(a => a.type === 'A_MISSED').map(a => a.visit));
      FD.ensureDay(s, d);
      pts = s.visits.filter(x => x.date === d && ids.has(x.vsr) && x.status !== 'SKIPPED' && (live || !x.offPlan)).map(x => { const so = storeOf(x.store); const v = vsrOf(x.vsr);
        const stt = !live ? 'PLANNED' : x.status === 'DONE' ? 'DONE' : missed.has(x.id) ? 'MISSED' : 'PLANNED';
        return { lat: so.lat, lng: so.lng, name: FD.nameOf(so), sub: FD.nameOf(v) + ' · ' + t(!live ? 'L_MAP_PLAN' : x.offPlan ? 'L_OFF_PLAN' : missed.has(x.id) ? 'L_MISSED' : x.status === 'DONE' ? 'L_VISITED' : 'L_NOT_VISITED_YET'),
          label: x.offPlan ? '+' : String(x.seq), status: stt, open: () => S.storeDrawer(x.store) }; });
      legend = h('div', { class: 'map-legend' }, live ? [key('PLANNED', t('L_NOT_VISITED_YET')), key('DONE', t('L_VISITED')), key('MISSED', t('L_MISSED')), key('OFF', '+ ' + t('L_OFF_PLAN'))] : key('PLANNED', t('L_MAP_PLAN')));
    }
    const box = h('div', { class: 'snap ctl-map' });
    setTimeout(() => { // map ends with the vans card beside it and always fits the screen, so van positions show without scrolling
      const vansCard = box.closest('.ctl') && box.closest('.ctl').querySelector('.ctl-left > section');
      if (vansCard && innerWidth > 1100) { const top = box.getBoundingClientRect().top; const fit = innerHeight - Math.max(top, 0) - 16; box.style.height = Math.max(420, vansCard.offsetParent ? Math.min(vansCard.getBoundingClientRect().bottom - top, fit) : fit) + 'px'; }
      FD.snapMap(box, pts, { onPick: p => { L['map:sel'] = p ? p.id : null; document.querySelectorAll('.van-tile.sel').forEach(e => e.classList.remove('sel')); } }); }, 0);
    const toggle = live ? FD.seg([{ id: 'VANS', label: t('L_VANS') }, { id: 'STORES', label: t('L_NAV_STORES') }], mode, x => { L['map:mode'] = x; FD.render(); }) : null;
    const pick = FD.select([{ id: '', label: t('L_ALL_VANS') }].concat(vans.map(v => ({ id: v.id, label: FD.nameOf(v) }))), mv, x => { L['map:van'] = x; FD.render(); });
    return S.card(live ? t('L_MAP') : t('L_MAP_PLAN'), null, h('div', null, h('div', { class: 'map-bar' }, toggle, pick, legend), box), { icon: 'map', flush: true, info: t('I_MAP_APPROX') });
  }

  // ================= STORE WHATSAPP (owner conversation) =================
  S.ownerChat = function (storeId, refresh, readOnly) {
    const s = st(); const msgs = FD.ownerThread(s, storeId); const store = storeOf(storeId);
    const promos = (s.world.promos || []).filter(p => p.start <= today() && p.end >= today()); const inv = FD.lastInvoice(s, storeId);
    const body = m => {
      if (m.kind === 'PROMO') { const p = s.world.promos.find(x => x.id === m.promo); return p ? h('div', null, h('div', { class: 'msg-topic' }, I('tag', 's14'), ' ', t('TYPE_PROMO')), h('div', { class: 'msg-text' }, tx('L_WA_PROMO', { promoId: p.promoId, skuCode: p.skus[0], date: p.end }))) : null; }
      if (m.kind === 'INVOICE') return h('div', { class: 'chat-file' }, h('span', { class: 'chat-file-ic' }, I('download', 's16')), h('div', null, h('b', null, tx('L_WA_INVOICE', { date: m.date })), h('div', { class: 'small' }, FD.fmt.money(m.amount))));
      return h('div', null, m.kind === 'PREORDER' ? h('div', { class: 'msg-topic' }, I('inbox', 's14'), ' ', t('L_PREORDER')) : null,
        m.photo ? h('img', { src: m.photo, alt: '', class: 'chat-img', style: { maxWidth: '220px' }, on: { click: () => FD.lightbox(m.photo) } }) : null,
        m.text ? h('div', { class: 'msg-text', dir: 'auto' }, FD.txtOf(m.text)) : null);
    };
    let lastDay = null; const nodes = [];
    for (const m of msgs) { if (m.at.date !== lastDay) { lastDay = m.at.date; nodes.push(h('div', { class: 'chat-day' }, h('span', null, FD.fmt.date(m.at.date)))); }
      const mine = m.by === 'SUP';
      nodes.push(h('div', { class: 'msg ' + (mine ? 'me' : 'them') }, h('div', { class: 'bubble ' + (mine ? 'me' : 'them') }, mine ? null : h('div', { class: 'msg-by' }, t('L_OWNER')), body(m),
        h('div', { class: 'msg-meta' }, h('time', null, FD.fmt.time(m.at.time)))))); }
    let draft = L['wa:' + storeId] || '';
    const send = (kind, extra) => { FD.dx('OWNER_MSG_SEND', Object.assign({ store: storeId, kind }, extra || {})); FD.toast('S_SENT'); refresh(); };
    const input = h('textarea', { class: 'input chat-input', rows: 1, placeholder: t('L_WA_PH'), 'aria-label': t('L_WA_PH'), value: draft, on: { input: e => { draft = L['wa:' + storeId] = e.target.value; } } });
    return h('div', { class: 'card wa-card' },
      h('div', { class: 'chat-ctx-row' }, h('span', { class: 'fu-ic', style: { width: '32px', height: '32px' } }, I('message', 's16')), h('div', { class: 'grow', style: { minWidth: 0 } }, h('b', { class: 'ellipsis' }, FD.nameOf(store)), h('div', { class: 'small muted' }, t('L_WA_HELP')))),
      h('div', { class: 'chat-msgs wa-msgs' }, nodes.length ? nodes : h('div', { class: 'chat-empty' }, FD.empty('L_WA_EMPTY', null, 'message'))),
      readOnly ? null : h('div', { class: 'chat-compose' },
        h('div', { class: 'chat-chips' },
          promos.length ? h('button', { type: 'button', class: 'chip chip-btn', 'aria-haspopup': 'menu', on: { click: e => FD.menu(e.currentTarget, promos.map(p => ({ icon: 'tag', label: t(p.promoId) + ' · ' + FD.nameOf(FD.sku(p.skus[0])), onClick: () => send('PROMO', { ref: p.id }) }))) } }, I('tag', 's14'), t('L_SEND_PROMO')) : null,
          inv ? h('button', { type: 'button', class: 'chip chip-btn', on: { click: () => send('INVOICE') } }, I('download', 's14'), t('L_SEND_INVOICE')) : null),
        h('div', { class: 'chat-row' }, input, h('button', { type: 'button', class: 'btn primary chat-send', 'aria-label': t('L_SEND'), on: { click: () => { if (!draft.trim()) return; send('TEXT', { text: draft.trim() }); L['wa:' + storeId] = ''; } } }, I('send', 's16')))));
  };

  // ================= TODAY =================
  FD.registerView('sup', 'today', () => {
    const s = st(); const d = today(); const vans = S.vans(); const dd = FD.dataDay(s);
    const ready = vans.filter(v => FD.stageFor(s, v.id, d) === 'PLAN_READY');
    const groups = S.alertGroupsNow().filter(g => vans.some(v => v.id === g.van) || g.type === 'A_PREORDER');
    // one block per salesman holds everything for him: release checks, alerts, follow-ups; the most critical salesman first
    const pendingV = vans.filter(v => ['PLAN_READY', 'DISPATCHED'].includes(FD.stageFor(s, v.id, d)) && v.kind !== 'inactive');
    const coachBy = pendingV.length ? Object.fromEntries(S.coachList(pendingV).filter(c => c.list.length).map(c => [c.v.id, c])) : {};
    const fuAll = FD.followUps(s), fuMine = fuAll.filter(f => S.fuVsr(f));
    // one optional type filter across all salesmen; the grouping per salesman stays
    const aType = L['al:type'] || 'ALL', want = k => aType === 'ALL' || aType === k;
    const blocks = vans.map(v => { const gs = groups.filter(g => g.van === v.id && want(g.type)), fs = want('FU') ? fuMine.filter(f => S.fuVsr(f) === v.id).sort((a, b) => a.pri - b.pri) : [], cx = want('REL') ? coachBy[v.id] : null;
      const crit = (gs.some(g => g.type === 'A_MISSED') ? 4 : gs.length ? 2 : 0) + (fs.some(f => f.pri === 1) ? 3 : fs.length ? 1 : 0) + (cx && cx.score >= 20 ? 2 : cx ? 1 : 0);
      return { v, gs, fs, cx, crit, n: gs.length + fs.length + (cx ? 1 : 0) }; }).filter(b => b.n).sort((a, b) => b.crit - a.crit || b.n - a.n);
    // count = salesmen needing action, plus shared alerts
    const nAlerts = blocks.length + groups.filter(g => !g.van).length; const unread = L['live:unread'] || 0; const tab = L['ctl:tab'] || 'VANS';
    const switcher = h('div', { class: 'tabs ctl-tabs', role: 'tablist' }, [['VANS', t('L_VANS'), FD.fmt.num(vans.length), ''], ['ALERTS', t('L_ALERTS'), FD.fmt.num(nAlerts), nAlerts ? ' hot' + (unread ? ' new' : '') : '']].map(([id, lb, n, hot]) =>
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === id), class: tab === id ? 'on' : '', on: { click: () => { L['ctl:tab'] = id; if (id === 'ALERTS') L['live:unread'] = 0; FD.render(); } } }, lb, h('span', { class: 'tab-n' + hot }, n))));
    const strip = h('section', { class: 'card', 'data-tour': 'sup1' },
      h('div', { class: 'card-h' }, switcher,
        h('div', { class: 'grow' }, FD.liveData(st()) ? h('div', { class: 'sub' }, S.updatedLine()) : null),
        tab === 'VANS' ? (() => { const list = pref('vanView', 'TILES') === 'LIST'; const b = FD.iconBtn(list ? 'list' : 'grid', t('L_LAYOUT') + ': ' + t(list ? 'L_LAYOUT_LIST' : 'L_LAYOUT_TILES'), () => { setPref('vanView', list ? 'TILES' : 'LIST'); FD.render(); }); b.setAttribute('aria-pressed', String(list)); return b; })() : null, // one button; its icon shows the current layout
        ready.length ? FD.btn(t('ACT_RELEASE_ALL') + ' (' + FD.fmt.num(ready.length) + ')', () => FD.dx('VAN_RELEASE_ALL', { vans: ready.map(v => v.id) }), 'primary sm', 'check') : null));
    const pill = (ic, tone, n) => h('span', { class: 'alert-type ' + tone }, I(ic, 's14'), FD.fmt.num(n));
    const vanBlock = b => { const open = L['alv:' + b.v.id];
      return h('div', { class: 'alert-van' }, h('button', { type: 'button', class: 'list-row click alert-van-h', 'aria-expanded': String(!!open), on: { click: () => { L['alv:' + b.v.id] = !open; FD.render(); } } },
        FD.avatar(b.v), h('span', { class: 'grow', style: { minWidth: 0 } }, h('span', { class: 'fu-t' }, FD.nameOf(b.v)), h('span', { class: 'row wrap alert-types' },
          b.cx ? pill('calendar', b.cx.score >= 20 ? 'bad' : 'warn', b.cx.list.reduce((a, x) => a + x[1], 0)) : null,
          b.gs.map(g => pill(ALERT_IC[g.type], g.type === 'A_MISSED' ? 'bad' : 'warn', g.count)), b.fs.length ? pill('bell', b.fs.some(f => f.pri === 1) ? 'bad' : 'warn', b.fs.length) : null)),
        I(open ? 'chevron-up' : 'chevron-down', 's16')),
        open ? h('div', { class: 'alert-van-b' },
          b.cx ? h('div', { class: 'list-row' }, h('span', { class: 'fu-ic ' + (b.cx.score >= 20 ? 'bad' : 'warn') }, I('calendar', 's16')), h('span', { class: 'grow' }, h('span', { class: 'fu-t' }, t('L_CHECK_BEFORE_RELEASE')), h('span', { class: 'fu-c', style: { display: 'block' } }, b.cx.list.map(([k, n]) => tx(gid(k + '_G', n), { n })).join(' · '))), FD.btn(t('L_OPEN_PLAN'), () => S.vsrDrawer(b.v.id, false, 'day'), 'secondary sm')) : null,
          b.gs.map(alertRow), b.fs.map(S.fuRow)) : null); };
    const common = groups.filter(g => !g.van && want(g.type));
    const typeN = { ALL: null, REL: Object.keys(coachBy).length, A_MISSED: groups.filter(g => g.type === 'A_MISSED').length, A_OFFPLAN: groups.filter(g => g.type === 'A_OFFPLAN').length, A_PACE: groups.filter(g => g.type === 'A_PACE').length, A_PREORDER: groups.filter(g => g.type === 'A_PREORDER').length, FU: fuMine.length };
    const typeBar = h('div', { class: 'al-types', role: 'group', 'aria-label': t('L_FILTERS') }, Object.entries(typeN).filter(([k, n]) => k === 'ALL' || n).map(([k, n]) => h('button', { type: 'button', class: 'al-type' + (aType === k ? ' on' : ''), 'aria-pressed': String(aType === k), on: { click: () => { L['al:type'] = k; FD.render(); } } },
      k === 'ALL' ? null : I(k === 'REL' ? 'calendar' : k === 'FU' ? 'bell' : ALERT_IC[k], 's14'), t('L_ALT_' + k), n != null ? h('span', { class: 'tabular' }, FD.fmt.num(n)) : null)));
    const alerts = h('div', { 'data-tour': 'sup2' },
      typeBar, blocks.length || common.length ? [common.map(alertRow), blocks.map(vanBlock)] : h('div', { class: 'card-b' }, FD.empty('E_NO_ALERTS', null, 'check')));
    strip.appendChild(tab === 'ALERTS' ? alerts : pref('vanView', 'TILES') === 'LIST' ? vanList(vans) : h('div', { class: 'card-b' }, h('div', { class: 'van-grid' }, vans.map(vanTile))));
    // morning: each unreleased plan with what to check, one row per van
    const top = null; // release checks now sit in each salesman's block
    const checks = top ? h('button', { type: 'button', class: 'card fu-bar', on: { click: () => S.coachDrawer() } },
      h('span', { class: 'fu-ic ' + (top.score >= 20 ? 'bad' : top.score ? 'warn' : ''), style: { width: '32px', height: '32px' } }, I('check', 's16')),
      h('span', { class: 'grow', style: { minWidth: 0 } }, h('b', null, tx(gid('L_COACH_BAR', coach.length), { n: coach.length })),
        h('span', { class: 'small muted ellipsis', style: { display: 'block' } }, top.list.length ? FD.nameOf(top.v) + ' · ' + tx(gid(top.list[0][0] + '_G', top.list[0][1]), { n: top.list[0][1] }) : t('E_NO_EXCEPTIONS'))),
      h('span', { class: 'btn secondary sm' }, t('L_VIEW_ALL', { n: FD.fmt.num(coach.length) }))) : null;
    const fu = fuAll.filter(f => !S.fuVsr(f)).sort((a, b) => a.pri - b.pri); const fuBar = fu.length ? h('button', { type: 'button', class: 'card fu-bar', on: { click: () => S.followupsDrawer() } },
      h('span', { class: 'fu-ic', style: { width: '32px', height: '32px' } }, I('bell', 's16')), h('span', { class: 'grow', style: { minWidth: 0 } }, h('b', null, tx('L_FU_WAITING', { n: fu.length })), h('span', { class: 'small muted ellipsis', style: { display: 'block' } }, ['WATCH', 'COMP', 'PROD', 'OTHER'].map(k => [k, fu.filter(f => S.fuCat(f) === k).length]).filter(x => x[1]).map(([k, n]) => t('L_FUT_' + k) + ' ' + FD.fmt.num(n)).join(' · '))),
      h('span', { class: 'btn secondary sm' }, t('L_VIEW_ALL', { n: FD.fmt.num(fu.length) }))) : null;
    // evening: tomorrow's plans with suggested changes, sent in one go
    const tm = FD.nextSellingDay(d); const nT = S.tomorrowSugs().reduce((a, x) => a + x.list.length, 0);
    const tomBar = h('button', { type: 'button', class: 'card fu-bar', on: { click: () => S.tomorrowDrawer() } },
      h('span', { class: 'fu-ic', style: { width: '32px', height: '32px' } }, I('calendar', 's16')),
      h('span', { class: 'grow', style: { minWidth: 0 } }, h('b', null, tx(gid('L_TOMORROW_BAR', nT), { n: nT, date: tm })), h('span', { class: 'small muted ellipsis', style: { display: 'block' } }, t('L_TOMORROW_SUB'))),
      h('span', { class: 'btn secondary sm' }, t('L_REVIEW')));
    // control screen: vans and what needs acting on (left), map (right); mirrors in Arabic
    return { title: t('L_NAV_TODAY'), body: [closeCard(vans), checks, fuBar, tomBar, ctlSplit(h('div', { class: 'ctl-left stack s16' }, strip), h('div', { class: 'ctl-right' }, mapCard(vans)))] };
  });
  FD.registerView('sup', 'home', r => FD.views.sup.today(r)); // old links land on Today

  // ---------- coaching for the day: unreleased vans, most urgent first ----------
  const XW = { X_PREORDER: 3, X_DUE: 2, X_SHORT: 2, X_SKIPPED: 1, X_QUESTION: 1 };
  S.coachList = vans => vans.map(v => { const by = {}; let score = 0;
    FD.dispatchExceptions(st(), v.id, today()).forEach(x => { by[x.type] = (by[x.type] || 0) + 1; score += XW[x.type] || 1; });
    return { v, score, list: Object.entries(by).sort((a, b) => b[1] * (XW[b[0]] || 1) - a[1] * (XW[a[0]] || 1)) }; }).sort((a, b) => b.score - a.score);
  S.coachDrawer = () => FD.drawer.open({ title: t('L_COACH_TITLE'), render: () => {
    const s = st(); const d = today(); const vans = S.vans().filter(v => ['PLAN_READY', 'DISPATCHED'].includes(FD.stageFor(s, v.id, d)));
    if (!vans.length) return h('div', { class: 'card' }, FD.empty('E_NO_EXCEPTIONS', null, 'check'));
    return h('div', { class: 'stack s16' }, h('div', { class: 'small muted' }, t('L_COACH_HELP')), h('div', { class: 'card' }, S.coachList(vans).map(c => { const sg = FD.stageFor(s, c.v.id, d);
      return h('div', { class: 'list-row coach-row', style: { alignItems: 'flex-start' } }, h('span', { class: 'fu-ic ' + (c.score >= 20 ? 'bad' : c.score ? 'warn' : '') }, I('truck', 's16')),
        h('div', { class: 'grow', style: { minWidth: 0 } }, h('button', { type: 'button', class: 'link fu-t', on: { click: () => S.vsrDrawer(c.v.id, false, 'day') } }, FD.nameOf(c.v)),
          h('div', { class: 'row wrap', style: { gap: '6px', marginTop: '4px' } }, c.list.length ? c.list.map(([k, n]) => FD.chip(tx(gid(k + '_G', n), { n }), 'outline')) : h('span', { class: 'small muted' }, t('E_NO_EXCEPTIONS')))),
        h('div', { class: 'row', style: { gap: '6px' } }, FD.iconBtn('message', t('L_MESSAGE'), () => FD.threadSheet({ type: 'vsr', id: c.v.id }, 'SUP')),
          sg === 'PLAN_READY' ? FD.btn(t('ACT_RELEASE'), () => { FD.dx('VAN_RELEASE', { van: c.v.id }); FD.drawer.refresh(); }, 'secondary sm', 'check') : stageChip(sg))); })));
  } });

  // ================= VAN DAY (tab in the salesman drawer) =================
  S.vanDay = function (vsrId,date) {
    if(date&&date!==today()){
      // planned stops in route order, then visits that were not on the plan; each says whether it ended in an order
      const vs=st().visits.filter(v=>v.vsr===vsrId&&v.date===date),p=FD.vanProgress(st(),vsrId,date);
      const visits=vs.filter(v=>!v.offPlan).sort((a,b)=>(a.seq||0)-(b.seq||0)).concat(vs.filter(v=>v.offPlan).sort((a,b)=>String(a.arrivedAt).localeCompare(String(b.arrivedAt))));
      const sold=new Set(st().orders.filter(o=>o.date===date&&o.vsr===vsrId).map(o=>o.store)),col={};for(const x of p.stops)col[x.store]=x;
      const outcome=v=>v.status==='DONE'?(sold.has(v.store)?FD.chip(t('L_SQ_SALE'),'good'):FD.chip(t('L_SQ_NOSALE'),'warn')):FD.chip(t('L_STATUS_'+v.status),v.offPlan?'':'bad');
      return h('div',{class:'stack s16'},p.planned?h('div',{class:'stack',style:{gap:'6px'}},stopSq(p),h('div',{class:'small'},tx('L_STOPS_DONE',{n:p.done,m:p.planned}),p.offPlan?h('span',{class:'muted'},' · +'+FD.fmt.num(p.offPlan)+' '+t('L_OFF_PLAN')):null)):null,
        h('div',{class:'card'},visits.map(v=>{const miss=v.status!=='DONE'&&!v.offPlan,out=miss?FD.missOutcome(st(),vsrId,v.store,date):null;
        return h('div',{class:'list-row'},h('div',{class:'grow',style:{minWidth:0}},h('button',{type:'button',class:'link',on:{click:()=>S.storeDrawer(v.store)}},FD.nameOf(storeOf(v.store))),
          miss?h('div',{class:'small '+(out?'ink-2':'warn-ink')},out?tx(out.id,out.slots||{}):t('L_OUT_NONE')):v.arrivedAt?h('div',{class:'small muted tabular'},FD.fmt.time(v.arrivedAt)):null),
          v.offPlan?FD.chip(t('L_OFF_PLAN'),'outline'):null,col[v.store]&&col[v.store].col?FD.chip(colText(col[v.store]),col[v.store].col==='paid'?'good':'bad'):null,outcome(v));})),FD.btn(t('L_NAV_TODAY'),()=>S.vsrDrawer(vsrId,false,'day'),'secondary'));
    }
    const s = st(); const d = today(); const v = vsrOf(vsrId); const sg = FD.stageFor(s, vsrId, d); const live = FD.liveData(s); const pd = live ? d : FD.dataDay(s); const p = FD.vanProgress(s, vsrId, pd);
    const missed = new Set(live ? FD.alerts(s, d).filter(a => a.type === 'A_MISSED' && a.van === vsrId).map(a => a.visit) : []);
    // today's plan or tomorrow's, with the changes suggested for tomorrow
    const day = v.kind === 'sales' ? (L['vd:day'] || 'TODAY') : 'TODAY';
    const daySeg = v.kind === 'sales' ? FD.seg([{ id: 'TODAY', label: t('L_NAV_TODAY') }, { id: 'TOM', label: tx('L_TOMORROW_D', { date: FD.nextSellingDay(d) }) }], day, x => { L['vd:day'] = x; FD.drawer.refresh(); FD.render(); }) : null;
    if (day === 'TOM') { const tm = FD.nextSellingDay(d); const list = FD.planSuggestions(s, vsrId, tm);
      return h('div', { class: 'stack s16' }, daySeg, h('div', { class: 'small muted' }, t('L_TOMORROW_HELP')),
        list.length ? h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('h3', null, t('L_SUGGESTED_CHANGES'))), list.map(x => S.sugRow(vsrId, x, tm))) : null,
        S.planEditor(vsrId, { date: tm })); }
    const actions = h('div', { class: 'row wrap' },
      sg === 'PLAN_READY' ? FD.btn(t('ACT_RELEASE'), () => FD.dx('VAN_RELEASE', { van: vsrId }), 'primary sm', 'check') : null,
      sg === 'LIVE' || sg === 'DISPATCHED' || sg === 'PLAN_READY' ? FD.btn(t('ACT_CLOSE_VAN'), () => S.confirm(t('ACT_CLOSE_VAN') + ' · ' + FD.nameOf(v), () => FD.dx('VAN_CLOSE', { van: vsrId })), 'secondary sm', 'lock') : null,
      sg === 'CLOSED' && s.vanClosed[vsrId + '|' + d] && !FD.dayClosed(s, d) ? FD.btn(t('ACT_REOPEN_VAN'), () => FD.dx('VAN_REOPEN', { van: vsrId }), 'ghost sm', 'undo') : null);
    const resultsHead = live ? null : h('div', { class: 'small muted' }, tx('L_RESULTS_OF', { date: pd }));
    const metric = (label, val) => h('div', { class: 'card', style: { padding: '10px 12px' } }, h('div', { class: 'small muted' }, label), h('b', { class: 'tabular' }, val));
    const metrics = h('div', { class: 'grid-3 metric-grid' },
      metric(t('L_STOPS'), tx('L_STOPS_DONE', { n: p.done, m: p.planned })),
      metric(t('L_SALES_TODAY'), FD.fmt.money0(p.sales)), metric(t('L_EXPECTED'), FD.fmt.money0(p.expected)),
      metric(t('L_OFF_PLAN'), FD.fmt.num(p.offPlan)), metric(t('L_MISSED'), FD.fmt.num(p.missed)), metric(t('L_COLLECTED'), FD.fmt.money0(p.collected)));
    // before the van starts: what to check, grouped by type
    let checks = null;
    if (sg === 'PLAN_READY' || sg === 'DISPATCHED') {
      const xs = FD.dispatchExceptions(s, vsrId, d); const by = {}; xs.forEach(x => (by[x.type] = by[x.type] || []).push(x));
      checks = h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('h3', null, t('L_CHECK_BEFORE_RELEASE'))),
        Object.keys(by).length ? Object.entries(by).map(([type, list]) => { const open = L['xg:' + vsrId + type];
          return h('div', { class: 'alert-g' }, h('div', { class: 'list-row' }, h('button', { type: 'button', class: 'row-toggle', 'aria-expanded': String(!!open), on: { click: () => { L['xg:' + vsrId + type] = !open; FD.drawer.refresh(); } } },
            h('span', { class: 'fu-ic' }, I(X_IC[type], 's16')), h('span', { class: 'grow fu-t' }, tx(gid(type + '_G', list.length), { n: list.length })), I(open ? 'chevron-up' : 'chevron-down', 's16'))),
            open ? h('div', { class: 'alert-items' }, list.map(x => h('div', { class: 'list-row' },
              h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'ellipsis', style: { fontWeight: 500 } }, x.store ? FD.nameOf(storeOf(x.store)) : FD.skuLabel(x.sku)), h('div', { class: 'small muted' }, tx(type, x.slots))),
              type === 'X_DUE' ? S.planBtn(vsrId, x, d, () => FD.drawer.refresh()) : null,
              x.store ? FD.iconBtn('chevron-right', t('L_OPEN'), () => S.storeDrawer(x.store, null, true)) : null))) : null); })
          : h('div', { class: 'card-b' }, FD.empty('E_NO_EXCEPTIONS', null, 'check')));
    }
    return h('div', { class: 'stack s16' }, daySeg, h('div', { class: 'row between', style: { flexWrap: 'wrap', gap: '8px' } }, h('div', { class: 'row', style: { gap: '8px' } }, stageChip(sg), S.updatedLine()), actions),
      checks, // what to fix before release comes first; yesterday's results are context
      sg === 'NO_ACTIVITY' && !p.planned ? h('div', { class: 'card' }, FD.empty('ST_NO_ACTIVITY', null, 'truck')) : h('div', { class: 'stack s8' }, resultsHead, metrics),
      S.planEditor(vsrId, { missed }));
  };

  // ================= PLAN TOMORROW =================
  // suggested changes per van: carry over missed stores, add stores due to order, drop stores that rarely order; then send all plans
  S.tomorrowSugs = () => { const s = st(); const tm = FD.nextSellingDay(today()); return S.vans().filter(v => v.kind === 'sales').map(v => ({ v, list: FD.planSuggestions(s, v.id, tm) })).filter(x => x.list.length); };
  // add/remove buttons show their result and undo on a second tap; the state comes from the plan itself
  S.planBtn = (vsrId, x, tm, after) => { const s = st(), done = () => { (after || FD.drawer.refresh)(); };
    if (x.type === 'X_PREORDER') return null;
    if (x.type === 'X_QUESTION') { const removed = s.visits.some(v => v.date === tm && v.store === x.store && v.status === 'SKIPPED' && v.bySup);
      return removed ? FD.btn(t('L_REMOVED'), () => { FD.dx('SUP_STOP_RESTORE', { store: x.store, date: tm }); done(); }, 'secondary sm is-done', 'check')
        : FD.btn(t('ACT_REMOVE_FROM_PLAN'), () => { FD.dx('SUP_STOP_REMOVE', { store: x.store, date: tm }); S.planActed(tm, vsrId, x); done(); }, 'ghost sm', 'trash'); }
    const added = s.visits.some(v => v.date === tm && v.store === x.store && v.supAdded && v.status === 'PLANNED');
    return added ? FD.btn(t('L_ADDED'), () => { FD.dx('SUP_STOP_UNADD', { store: x.store, date: tm }); done(); }, 'secondary sm is-done', 'check')
      : FD.btn(t('ACT_ADD_TO_PLAN'), () => { FD.dx('OFFPLAN_ADD', { vsr: vsrId, store: x.store, bySup: true, date: tm }); S.planActed(tm, vsrId, x); done(); }, 'secondary sm', 'plus'); };
  // rows the supervisor acted on stay visible (with their undo) instead of vanishing from the list
  S.planActed = (tm, vsrId, x) => { const k = 'tm:acted:' + tm; L[k] = (L[k] || []).filter(y => !(y.x.store === x.store && y.x.type === x.type)).concat([{ vsr: vsrId, x }]); };
  S.planRows = (vsrId, tm) => { const list = FD.planSuggestions(st(), vsrId, tm), acted = (L['tm:acted:' + tm] || []).filter(y => y.vsr === vsrId && !list.some(x => x.store === y.x.store && x.type === y.x.type)).map(y => y.x);
    return { list, acted, rows: list.concat(acted) }; };
  S.sugRow = (vsrId, x, tm) => h('div', { class: 'list-row sug-row' }, h('span', { class: 'fu-ic' }, I(X_IC[x.type] || 'repeat', 's16')),
      h('div', { class: 'grow', style: { minWidth: 0 } }, h('button', { type: 'button', class: 'link-btn ellipsis', style: { maxWidth: '100%', fontWeight: 500, display: 'block' }, on: { click: () => S.storeDrawer(x.store, null, true) } }, FD.nameOf(storeOf(x.store))),
        h('div', { class: 'row wrap', style: { gap: '6px', marginTop: '2px' } }, h('span', { class: 'small muted' }, tx(x.type, x.slots)), S.leverChip(FD.leverOf(x.type)))), S.planBtn(vsrId, x, tm));
  // plans for the coming selling days: pick a date, open one salesman at a time, act on suggestions
  S.planDates = () => { const out = []; let d = today(); for (let i = 0; i < 5; i++) { d = FD.nextSellingDay(d); out.push(d); } return out; };
  S.tomorrowDrawer = () => FD.drawer.open({ title: () => tx('L_TOMORROW_TITLE', { date: L['tm:date'] && S.planDates().includes(L['tm:date']) ? L['tm:date'] : FD.nextSellingDay(today()) }), render: () => {
    const s = st(); const dates = S.planDates(); const tm = dates.includes(L['tm:date']) ? L['tm:date'] : dates[0]; const vans = S.vans().filter(v => v.kind === 'sales'); const unsent = vans.filter(v => !s.released[v.id + '|' + tm]);
    const daySw = FD.seg(dates.map(d => ({ id: d, label: FD.fmt.date(d) })), tm, v => { L['tm:date'] = v; FD.drawer.refresh(); });
    return h('div', { class: 'stack s16' }, daySw, h('div', { class: 'small muted' }, t('L_TOMORROW_HELP') + ' ' + t('L_SEND_PLANS_HELP')),
      vans.map(v => { const { list, acted, rows } = S.planRows(v.id, tm); const n = FD.planFor(s, v.id, tm).stops.filter(x => x.status !== 'SKIPPED').length; const open = L['tm:open:' + v.id];
        return h('div', { class: 'card plan-van' }, h('button', { type: 'button', class: 'list-row click plan-van-h', 'aria-expanded': String(!!open), on: { click: () => { L['tm:open:' + v.id] = !open; FD.drawer.refresh(); } } },
            FD.avatar(v), h('span', { class: 'grow', style: { minWidth: 0 } }, h('b', null, FD.nameOf(v)), h('span', { class: 'small muted', style: { display: 'block' } }, t('L_PLAN_STOPS', { n: FD.fmt.num(n) }) + (list.length ? ' · ' + t('L_SUGGESTIONS_N', { n: FD.fmt.num(list.length) }) : ''))),
            !list.length && acted.length ? FD.chip([I('check', 's14'), t('L_SUGS_DONE')], 'good') : null,
            s.released[v.id + '|' + tm] ? FD.chip(t('L_SENT'), 'good') : null, I(open ? 'chevron-up' : 'chevron-down', 's16')),
          open ? h('div', null, rows.length ? rows.map(x => S.sugRow(v.id, x, tm)) : h('div', { class: 'card-b small muted' }, t('L_NO_PLAN_CHANGES')),
            tm === dates[0] ? h('div', { class: 'card-f' }, FD.btn(t('L_OPEN_PLAN'), () => { L['vd:day'] = 'TOM'; S.vsrDrawer(v.id, false, 'day'); }, 'ghost sm')) : null) : null); }),
      unsent.length ? h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, FD.btn(tx('L_SEND_PLANS', { n: unsent.length }), () => { FD.dx('VAN_RELEASE_ALL', { vans: unsent.map(v => v.id), date: tm }); FD.toast(null, null, { text: tx('L_PLANS_SENT', { date: tm }) }); FD.drawer.refresh(); }, 'primary', 'send')) : FD.chip(tx('L_PLANS_SENT', { date: tm }), 'good'));
  } });

  // ================= PRE-ORDERS =================
  // opened from Alerts in the side panel; the panel expands to its own page
  S.preorderList = () => {
    const s = st(); const d = today(); const list = s.preorders.filter(p => p.status !== 'DONE').reverse().concat(s.preorders.filter(p => p.status === 'DONE').reverse());
    const re = () => FD.drawer.refresh();
    const chip = p => FD.chip(t({ NEW: 'L_STATUS_NEW', ATTACHED: 'L_STATUS_ATTACHED', DONE: 'L_STATUS_DONE' }[p.status]), p.status === 'NEW' ? 'warn' : p.status === 'DONE' ? 'good' : 'info');
    const row = p => { const so = storeOf(p.store);
      return h('div', { class: 'list-row', style: { alignItems: 'flex-start' } }, h('span', { class: 'fu-ic' }, I('inbox', 's16')),
        h('div', { class: 'grow', style: { minWidth: 0 } },
          h('div', { class: 'row between', style: { gap: '8px' } }, h('button', { type: 'button', class: 'link ellipsis', style: { fontWeight: 500 }, on: { click: () => S.storeDrawer(p.store) } }, FD.nameOf(so)), chip(p)),
          h('div', { dir: 'auto' }, FD.txtOf(p.text)), p.photo ? h('img', { src: p.photo, alt: '', style: { maxWidth: '140px', borderRadius: '8px', marginTop: '6px', cursor: 'zoom-in' }, on: { click: () => FD.lightbox(p.photo) } }) : null,
          h('div', { class: 'small muted' }, [t('L_VIA_WHATSAPP'), FD.fmt.date(p.at.date) + ' ' + FD.fmt.time(p.at.time), p.forDate ? null : t('L_NO_UPCOMING')].filter(Boolean).join(' · ')),
          p.status === 'DONE' ? null : h('div', { class: 'row wrap', style: { gap: '6px', marginTop: '8px' } },
            p.status === 'NEW' && p.forDate ? FD.btn(tx('L_ATTACH_VISIT', { date: p.forDate }), () => { FD.dx('PREORDER_STATUS', { id: p.id, status: 'ATTACHED' }); re(); }, 'primary sm', 'calendar') : null,
            // the store's own salesman visits it today (covers follow the route owner); moving it to another van stays in the van's Today tab
            p.forDate !== d && FD.isSellingDay(d) ? FD.btn(t('L_VISIT_TODAY_DEV'), () => { FD.dx('OFFPLAN_ADD', { vsr: FD.routeOwner(s, so.route, d) || so.vsr, store: p.store, bySup: true }); FD.dx('PREORDER_STATUS', { id: p.id, status: 'ATTACHED', forDate: d }); FD.toast('S_SAVED'); re(); }, 'secondary sm', 'plus') : null,
            FD.btn(t('L_OPEN_CHAT'), () => { L['store:tab'] = 'whatsapp'; S.storeDrawer(p.store); }, 'secondary sm', 'message'),
            FD.btn(t('ACT_MARK_DONE'), () => { FD.dx('PREORDER_STATUS', { id: p.id, status: 'DONE' }); re(); }, 'ghost sm')))); };
    return h('div', { class: 'card' }, list.length ? list.map(row) : FD.empty('E_NO_PREORDERS', null, 'inbox'));
  };
  S.preordersDrawer = () => FD.drawer.open({ title: t('L_NAV_PREORDERS'), expand: '#/sup/preorders', render: () => S.preorderList() });
  FD.registerView('sup', 'preorders', () => ({ title: t('L_NAV_PREORDERS'), body: [S.preorderList()] }));

  // ================= DATA STATUS (Rules) =================
  const FEEDS = [['DF_PLAN', 'Journey_Plan', 'DS_CONNECTED', 'DS_DAILY', 'DU_PLAN'], ['DF_VISITS', 'HH_VISIT', 'DS_CONNECTED', 'DS_HOURLY', 'DU_VISITS'],
    ['DF_ORDERS', 'HH_order, HH_order_detail', 'DS_CONNECTED', 'DS_HOURLY', 'DU_ORDERS'], ['DF_RETURNS', 'HH_Returns', 'DS_CONNECTED', 'DS_HOURLY', 'DU_RETURNS'],
    ['DF_PAYMENTS', 'HH_AR_PAYMENTS', 'DS_CONNECTED', 'DS_HOURLY', 'DU_PAYMENTS'], ['DF_VANSTOCK', 'hh_carstore', 'DS_NOT', null, 'DU_VANSTOCK'],
    ['DF_STOREMASTER', 'Customer Master', 'DS_NOT', null, 'DU_STOREMASTER'], ['DF_GPS', 'Mobile app', 'DS_NOT', null, 'DU_GPS'],
    ['DF_INVOICES', 'HH_OutstandingDocuments', 'DS_NOT', null, 'DU_INVOICES'], ['DF_PREORDERS', 'WhatsApp', 'DS_NOT', null, 'DU_PREORDERS']];
  S.dataStatusCard = () => S.card(t('L_DATA_STATUS'), t('L_DATA_STATUS_HELP'), FD.table({ id: 'feeds', rows: FEEDS.map(([f, src, stt, rf, u]) => ({ f, src, stt, rf, u })), columns: [
    { key: 'f', label: t('L_FEED'), render: x => h('b', null, t(x.f)) }, { key: 'src', label: t('L_SOURCE_TABLE'), render: x => h('span', { class: 'small muted' }, x.src) },
    { key: 'stt', label: t('L_COL_STATUS'), render: x => FD.chip(t(x.stt), x.stt === 'DS_CONNECTED' ? 'good' : x.stt === 'DS_PARTLY' ? 'warn' : '') },
    { key: 'rf', label: t('L_REFRESH'), render: x => x.rf ? t(x.rf) : '—' }, { key: 'u', label: t('L_UNLOCKS'), render: x => t(x.u) }] }), { icon: 'layers', flush: true });

  // ================= JOURNEY PLAN REVIEW (Weekly) =================
  // follows the period chosen in the page header, like the rest of Analytics
  S.journeyReview = function () {
    const s = st(); const { from, to } = S.range(); const ids = new Set(S.vans().map(v => v.id));
    const planN = {}, offN = {}; for (const p of FD.REAL.plan) if (p[0] >= from && p[0] <= to && ids.has(p[1])) planN[p[2]] = (planN[p[2]] || 0) + 1;
    for (const x of s.visits) if (x.offPlan && x.status === 'DONE' && x.date >= from && x.date <= to && ids.has(x.vsr)) offN[x.store] = (offN[x.store] || 0) + 1;
    const ord = {}; for (const o of s.orders) if (o.src === 'SB' && o.date >= from && o.date <= to) (ord[o.store] || (ord[o.store] = new Set())).add(o.date);
    const pending = new Set(s.freqChanges.map(x => x.store));
    const rows = [];
    for (const [sid, n] of Object.entries(planN)) { const m = ord[sid] ? ord[sid].size : 0; if (n >= 4 && m <= 1) rows.push({ sid, n, m, off: offN[sid] || 0, freq: m ? 'FREQ_2W' : 'FREQ_M' }); }
    for (const [sid, k] of Object.entries(offN)) if (k >= 2 && !planN[sid]) rows.push({ sid, n: 0, m: ord[sid] ? ord[sid].size : 0, off: k, freq: 'FREQ_W' });
    const vans = S.vans().filter(v => v.kind !== 'inactive').map(v => { const pv = s.visits.filter(x => x.vsr === v.id && x.date >= from && x.date <= to && !x.offPlan); const k = pv.filter(x => x.status === 'DONE').length;
      return { label: FD.nameOf(v), value: pv.length ? Math.round(100 * k / pv.length) : 0, done: k, planned: pv.length }; });
    return S.card(t('L_JOURNEY_REVIEW'), t('L_JOURNEY_REVIEW_HELP'), h('div', { class: 'stack s16' },
      h('div', null, h('b', { class: 'small' }, t('L_PLAN_ADHERENCE')), h('div', { style: { marginTop: '8px' } }, FD.bars(vans.map(x => ({ label: x.label, value: x.value, display: FD.fmt.pct(x.value) + ' · ' + tx('L_STOPS_DONE', { n: x.done, m: x.planned }) }))))),
      FD.table({ id: 'jpr', rows, defaultSort: ['n', 'desc'], limit: L['jpr:all'] ? 400 : 12, columns: [
        { key: 'st', label: t('L_COL_STORE'), render: x => h('button', { type: 'button', class: 'link ellipsis', style: { maxWidth: '220px' }, on: { click: () => S.storeDrawer(x.sid) } }, FD.nameOf(storeOf(x.sid))) },
        { key: 'n', label: t('L_PLANNED_N'), num: true, sort: (a, b) => a.n - b.n, render: x => FD.fmt.num(x.n) },
        { key: 'm', label: t('L_ORDER_DAYS'), num: true, sort: (a, b) => a.m - b.m, render: x => FD.fmt.num(x.m) },
        { key: 'off', label: t('L_OFF_PLAN'), num: true, sort: (a, b) => a.off - b.off, render: x => FD.fmt.num(x.off) },
        { key: 'f', label: t('L_SUGGESTED'), render: x => t(x.freq) },
        { key: 'a', label: '', render: x => pending.has(x.sid) ? FD.chip(t('L_PENDING_SB'), 'info') : FD.btn(t('ACT_ACCEPT'), () => FD.dx('FREQ_ACCEPT', { store: x.sid, freq: x.freq }), 'secondary sm') }] }),
      rows.length > 12 ? FD.btn(L['jpr:all'] ? t('L_SHOW_LESS') : t('L_VIEW_ALL', { n: FD.fmt.num(rows.length) }), () => { L['jpr:all'] = !L['jpr:all']; FD.render(); }, 'ghost sm') : null), { icon: 'calendar', flush: false });
  };
})();
