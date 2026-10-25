(function () {
  const FD = globalThis.FD;
  if (typeof document === 'undefined') return;
  // Live notifications for the supervisor: real-looking events pop up while the app is open, a different run each real day.
  // Alerts and follow-ups come from today's data; pre-orders and owner photos arrive as new WhatsApp messages.
  const h = FD.h, I = FD.icon, t = (...a) => FD.t(...a), tx = FD.tx; const S = FD.sup; const L = FD.ui.local;
  const st = () => FD.state; const storeOf = id => st().world.stores.find(s => s.id === id); const vsrOf = id => st().world.vsrs.find(v => v.id === id);
  const E2 = (en, ar) => ({ en, ar });
  const realDay = new Date().toISOString().slice(0, 10);
  let seed = [...realDay].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pickOf = a => a[Math.floor(rnd() * a.length)];
  const PO = [E2('Please bring 3 cartons of cake bars today.', 'لو سمحت أحضر ٣ كراتين كيك بار اليوم.'), E2('Need rusk, 2 cartons.', 'نحتاج بقسماط، كرتونين.'),
    E2('Add 1 carton of rolls to my order please.', 'أضف كرتون رولات لطلبي لو سمحت.'), E2('The biscuit shelf is empty, come early please.', 'رف البسكويت فاضي، تعال بدري لو سمحت.')];
  const PH = [E2('Shelf after the weekend.', 'الرف بعد نهاية الأسبوع.'), E2('Cupcakes are finished.', 'الكب كيك خلص.'), E2('Competitor put a new stand here.', 'المنافس وضع ستاند جديد هنا.')];
  const ALERT_IC = { A_MISSED: 'alert', A_OFFPLAN: 'map-pin', A_PACE: 'clock' };
  const seen = new Set();
  const on = () => st() && st().rules.liveNotifs !== false && location.hash.startsWith('#/sup');
  const planStores = () => { const d = st().clock.date; return [...new Set(st().visits.filter(v => v.date === d && v.status === 'PLANNED' && FD.salesVan(st(), v.vsr)).map(v => v.store))]; };

  function next() {
    const s = st(); const d = s.clock.date;
    for (let tries = 0; tries < 8; tries++) {
      const k = pickOf(FD.liveData(s) ? ['ALERT', 'ALERT', 'PREORDER', 'PHOTO', 'FU'] : ['PREORDER', 'PREORDER', 'PHOTO', 'FU']);
      if (k === 'ALERT') {
        const a = FD.alerts(s, d).filter(x => ALERT_IC[x.type] && !seen.has(x.type + x.van + (x.store || ''))); if (!a.length) continue;
        const x = pickOf(a); seen.add(x.type + x.van + (x.store || '')); const v = vsrOf(x.van);
        return { ic: ALERT_IC[x.type], tone: x.type === 'A_MISSED' ? 'bad' : 'warn', alert: true,
          title: x.type === 'A_PACE' ? tx('A_PACE', x.slots) : tx(x.type + '_G1', { vsrId: x.van, n: 1 }), sub: [x.store ? FD.nameOf(storeOf(x.store)) : null, v ? FD.routeArea(FD.state.world.routes.find(r => r.id === v.route)) : null].filter(Boolean).join(' · '),
          open: () => { S.vsrDrawer(x.van, false, 'day'); if (x.store) FD.flashTo('.drawer [data-store="' + x.store + '"]'); } };
      }
      if (k === 'PREORDER') {
        const ids = planStores().filter(id => !s.preorders.some(p => p.store === id)); if (!ids.length) continue;
        const id = pickOf(ids); const text = pickOf(PO); FD.dx('PREORDER_ADD', { store: id, text });
        return { ic: 'inbox', tone: 'info', alert: true, title: t('L_LIVE_PO'), sub: FD.nameOf(storeOf(id)) + ' · ' + FD.txtOf(text), open: () => { S.preordersDrawer(); FD.flashTo('.drawer [data-store="' + id + '"]'); } };
      }
      if (k === 'PHOTO' && FD.PHOTOS) {
        const ids = planStores(); if (!ids.length) continue;
        const id = pickOf(ids); const text = pickOf(PH); const photo = pickOf(FD.PHOTOS); FD.dx('OWNER_MSG_IN', { store: id, kind: 'PHOTO', photo, text });
        return { ic: 'image', tone: 'info', photo, title: t('L_LIVE_PHOTO'), sub: FD.nameOf(storeOf(id)) + ' · ' + FD.txtOf(text), open: () => { L['store:tab'] = 'whatsapp'; S.storeDrawer(id); } };
      }
      if (k === 'FU') {
        const f = FD.followUps(s).filter(x => !seen.has(x.key)); if (!f.length) continue;
        const x = f[0]; seen.add(x.key);
        return { ic: 'bell', tone: 'warn', title: t('L_LIVE_FU'), sub: tx(x.tpl, x.slots), open: () => S.openFollowUp(x) };
      }
    }
    return null;
  }

  let host = null;
  function show(n) {
    LOG.unshift(Object.assign({ key: 'live|' + FD.key(), at: st().clock.time }, n)); LOG.length = Math.min(LOG.length, 50);
    if (!host || !host.isConnected) { host = h('div', { class: 'live-stack', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(host); }
    if (n.alert) { L['live:unread'] = (L['live:unread'] || 0) + 1; if (location.hash.startsWith('#/sup/today') || location.hash === '#/sup') FD.render(); }
    let timer; const close = () => { clearTimeout(timer); card.classList.add('out'); setTimeout(() => card.remove(), 250); };
    const card = h('div', { class: 'live-card', on: { mouseenter: () => clearTimeout(timer), mouseleave: () => { timer = setTimeout(close, 6000); } } },
      h('span', { class: 'fu-ic ' + n.tone }, I(n.ic, 's16')),
      h('div', { class: 'grow', style: { minWidth: 0 } }, h('b', { class: 'live-t' }, n.title), n.sub ? h('div', { class: 'small muted live-s', dir: 'auto' }, n.sub) : null,
        h('div', { class: 'row', style: { gap: '6px', marginTop: '8px' } }, FD.btn(t('L_OPEN'), () => { close(); if (n.alert) { L['ctl:tab'] = 'ALERTS'; L['live:unread'] = 0; } n.open(); }, 'primary sm'), h('span', { class: 'small muted' }, t('L_NOW')))),
      n.photo ? h('img', { src: n.photo, alt: '', class: 'live-ph' }) : null,
      FD.iconBtn('x', t('L_CLOSE'), close));
    host.prepend(card); [...host.children].slice(3).forEach(c => c.remove());
    timer = setTimeout(close, 12000);
  }
  // ---------- notifications panel (supervisor): everything that arrived or is waiting, each one opens its screen ----------
  const LOG = L['notif:log'] = L['notif:log'] || [];
  const seenN = () => (L['notif:seen'] = L['notif:seen'] || new Set());
  FD.supNotifs = () => { const s = st(), ids = S.vans().map(v => v.id), out = LOG.slice();
    for (const th of s.threads.filter(x => x.unreadSup && x.messages.length && (x.team || ids.includes(x.vsr)))) { const m = th.messages[th.messages.length - 1];
      out.push({ key: 'th|' + th.id + '|' + th.messages.length, ic: 'message', tone: 'info', title: th.team ? t('L_WHOLE_TEAM') : tx('N_MSG_FROM', { vsrId: th.vsr }), sub: FD.chatSnippet(m, 'SUP'), at: m.at.time, open: () => FD.chatOpen(th.anchor, 'SUP') }); }
    for (const id of [...new Set((s.ownerMsgs || []).map(m => m.store))].filter(id => { const x = storeOf(id); return x && ids.includes(x.vsr) && FD.ownerUnread(s, id, 'SUP'); })) {
      out.push({ key: 'wa|' + id + '|' + FD.ownerEvents(s, id), ic: 'wa', tone: 'good', title: tx('N_WA_FROM', { storeId: id }), sub: tx('N_WA_NEW', { n: FD.fmt.num(FD.ownerUnreadN(s, id, 'SUP')) }), open: () => FD.chatOpen({ type: 'wa', id }, 'SUP') }); }
    for (const g of FD.supervisorAlertGroups(s, ids)) out.push({ key: 'al|' + g.type + g.van + g.day + '|' + g.count, ic: ALERT_IC[g.type] || 'inbox', tone: g.type === 'A_MISSED' ? 'bad' : 'warn',
      title: tx(g.type + '_G', { vsrId: g.van, n: g.count }), sub: FD.fmt.date(g.day), open: () => { if (g.type === 'A_PREORDER') return S.preordersDrawer(); S.vsrDrawer(g.van, false, 'day', { date: g.day });
        FD.flashTo(g.items.filter(a => a.store).map(a => '.drawer [data-store="' + a.store + '"]').join(',') || '.drawer'); } });
    const fu = FD.followUps(s).length; if (fu) out.push({ key: 'fu|' + fu, ic: 'bell', tone: 'warn', title: t('L_FOLLOWUPS_ALL') + ' · ' + FD.fmt.num(fu), open: () => S.followupsDrawer() });
    const seen = seenN(); return out.map(n => Object.assign(n, { unread: !seen.has(n.key) })); };
  S.openFollowUp = f => { const sel = '[data-fu="' + f.key + '"]';
    if (!S.fuVsr(f)) { L['fu:tab'] = 'open'; L['fu:type'] = 'ALL'; S.followupsDrawer(); return FD.flashTo('.drawer ' + sel); }
    L['ctl:tab'] = 'ALERTS'; L['al:type'] = 'ALL'; L['alv:' + S.fuVsr(f)] = true; if (!location.hash.startsWith('#/sup/today')) FD.go('#/sup/today'); else FD.render(); FD.flashTo(sel); };
  // "Mark all read" sits in the title bar, so the list starts at the top
  S.notifPanel = () => FD.drawer.open({ title: () => { const ns = FD.supNotifs(), seen = seenN();
      return h('span', { class: 'row', style: { gap: '8px', width: '100%' } }, h('span', { class: 'grow' }, t('L_INBOX')),
        ns.some(n => n.unread) ? FD.btn(t('N_ALL_READ'), () => { ns.forEach(n => seen.add(n.key)); FD.drawer.refresh(); FD.render(); }, 'ghost sm', 'check') : null); },
    render: () => { const ns = FD.supNotifs(), seen = seenN();
    return h('div', { class: 'stack s12' },
      h('div', { class: 'card' }, ns.length ? ns.map(n => h('button', { type: 'button', class: 'list-row click notif-row' + (n.unread ? ' un' : ''), on: { click: () => { seen.add(n.key); FD.drawer.close(); FD.render(); n.open(); } } },
        h('span', { class: 'fu-ic ' + n.tone }, n.ic === 'wa' ? FD.waLogo('s16') : I(n.ic, 's16')), h('span', { class: 'grow', style: { minWidth: 0, textAlign: 'start' } }, h('b', { class: 'notif-t' }, n.title), n.sub ? h('span', { class: 'small muted notif-s', dir: 'auto' }, n.sub) : null),
        h('span', { class: 'small muted nowrap' }, n.at || ''), n.unread ? h('span', { class: 'unread-dot', 'aria-label': t('L_UNREAD') }) : null)) : FD.empty('N_NONE', null, 'bell'))); } });
  S.notifCount = () => FD.supNotifs().filter(n => n.unread).length;

  // first one shortly after opening, then every 2 to 3 minutes
  function tick() { try { if (on() && !document.hidden) { const n = next(); if (n) show(n); } } catch (e) { console.warn(e); } setTimeout(tick, 120000 + rnd() * 60000); }
  setTimeout(tick, 12000);
  FD.liveDemo = () => { const n = next(); if (n) show(n); return n; }; // used by the click-through check
})();
