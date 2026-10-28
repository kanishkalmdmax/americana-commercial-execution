(function () {
  const FD = globalThis.FD;
  if (typeof document === 'undefined') return;
  const h = FD.h, I = FD.icon, t = (...a) => FD.t(...a), tx = FD.tx;
  const V = FD.vsr = {};
  const L = FD.ui.local;
  const st = () => FD.state;
  const today = () => st().clock.date;
  const storeOf = id => st().world.stores.find(s => s.id === id);
  const vsrOf = id => st().world.vsrs.find(v => v.id === id);
  const unitText = (code, qty) => { const s = FD.sku(code); return FD.lang === 'ar' ? (qty > 1 ? s.units_ar : s.unit_ar) : (qty > 1 ? s.units : s.unit); };
  const money = n => FD.fmt.num(n, 2);
  const SOLD = ['FULL', 'PARTIAL', 'ALT'];
  const GROUP_ICON = { RG_BUYER: 'user-x', RG_STOCK: 'package', RG_MONEY: 'wallet', RG_COMP: 'flag', RG_OURS: 'truck', R_OTHER: 'more' };
  V.GROUP_ICON = GROUP_ICON;
  const E = (en, ar) => ({ en, ar });
  // nearby places in plain words (Near school); the area-type names are for the supervisor
  const nearName = (x, all) => ((x && x.tags) || []).slice(0, all ? 9 : 1).map(g => t('TAGN_' + g.slice(4))).join(FD.lang === 'ar' ? '، ' : ', ') || null;
  const SHELF_LEVELS = ['low', 'med', 'high'];

  // ---------- phone shell ----------
  V.shell = function (r, viewFn) {
    const s = st(); const vsr = vsrOf(r.vsr);
    const view = viewFn(r, vsr);
    const unread = s.notifs.filter(n => n.vsr === vsr.id && !n.read).length;
    const todo = V.todoItems(vsr.id).length;
    const tabs = [['today', 'route', 'L_TAB_TODAY'], ['store', 'store', 'L_TAB_STORE'], ['msgs', 'message', 'L_MESSAGES'], ['todo', 'check-circle', 'L_TAB_TODO'], ['me', 'user', 'L_TAB_ME']];
    const unreadMsgs = s.threads.filter(x => (x.vsr === vsr.id && x.unreadVsr) || (x.team && (x.unreadVsrs || {})[vsr.id])).length
      + [...new Set((s.ownerMsgs || []).map(m => m.store))].filter(id => { const x = storeOf(id); return x && x.vsr === vsr.id && FD.ownerUnread(s, id, vsr.id); }).length;
    return h('div', { class: 'vsr-stage' }, h('div', { class: 'phone' }, h('div', { class: 'phone-screen' },
      h('div', { class: 'status-bar', 'aria-hidden': 'true' }, h('span', null, s.clock.time), h('span', { class: 'row', style: { gap: '6px' } }, I('signal'), I(s.offline ? 'wifi-off' : 'wifi'), I('battery'))),
      h('header', { class: 'app-bar' },
        view.back ? FD.iconBtn('arrow-left', t('L_BACK'), view.back) : null,
        h('div', { class: 'ttl' }, h('b', null, view.title), view.sub ? h('span', null, view.sub) : null),
        view.tools || null, FD.iconBtn('bell', t('L_INBOX'), () => V.inbox(vsr.id), unread ? FD.fmt.num(unread) : null)),
      s.offline ? h('div', { style: { padding: '0 16px 8px' } }, h('div', { class: 'banner warn', role: 'status' }, I('wifi-off'), h('span', null, t('S_OFFLINE')), s.queue.length ? FD.chip(FD.fmt.num(s.queue.length), 'warn') : null)) : null,
      h('main', { class: 'v-body' + (view.chat ? ' chat-body' : ''), id: 'v-body' }, view.body),
      view.cta ? h('div', { class: 'sticky-cta' }, view.cta) : null,
      h('nav', { class: 'tabbar', 'aria-label': 'Tabs' }, tabs.map(([id, icon, label]) => h('button', { type: 'button', class: r.page === id ? 'on' : '', 'aria-current': r.page === id ? 'page' : null,
        on: { click: () => FD.go('#/vsr/' + vsr.id + '/' + id) } }, I(icon), t(label), id === 'todo' && todo ? h('span', { class: 'tb-dot' }, FD.fmt.num(todo)) : null, id === 'msgs' && unreadMsgs ? h('span', { class: 'tb-dot' }, FD.fmt.num(unreadMsgs)) : null)))
    )));
  };

  // ---------- shared bits ----------
  V.area = FD.routeArea;
  V.statusChip = v => {
    const m = { PLANNED: ['L_STATUS_PLANNED', ''], ARRIVED: ['L_STATUS_ARRIVED', 'info'], DONE: ['L_STATUS_DONE', 'good'], SKIPPED: ['L_STATUS_SKIPPED', ''] }[v.status] || ['L_STATUS_PLANNED', ''];
    return FD.chip(t(v.moved && v.status === 'PLANNED' ? 'L_STATUS_MOVED' : m[0]), m[1]);
  };
  function tipFor(rec) {
    const tips = st().tips.filter(x => x.vsr === FD.recVsr(rec) && x.status === 'SENT' && FD.daysBetween(x.sentAt.date, today()) <= 14);
    return tips.reverse().find(x => (x.slots && x.slots.skuCode === rec.sku)) || tips.find(x => !x.slots || !x.slots.skuCode);
  }
  const tipText = tp => tp.text || tx(tp.tpl, tp.slots);

  // ---------- reason flow (2 screens max; comment + photo optional) ----------
  V.reasonSheet = function (recIds, mode, onDone) {
    recIds = [].concat(recIds);
    const rec = st().recs.find(r => r.id === recIds[0]); if (!rec) return;
    const key = FD.key();
    const S = { group: null, code: rec.reason || null, brand: rec.brand || null, comment: rec.comment || '', photo: rec.photo || null };
    const subset = mode === 'UNTICK' || mode === 'NOT_OFFERED' ? FD.NF : null; // not followed = salesman's call (R2-Q3)
    if (S.code) S.group = FD.groupOf(S.code);
    const title = () => mode === 'NOT_SOLD' ? t('L_WHY_SELL') : t('L_WHY_NOT_FOLLOWED');
    const save = () => {
      if (!S.code || ((S.code === 'R_OTHER' || S.code === 'NF_OTHER') && !S.comment.trim())) { FD.toast('S_COMMENT_REQ'); return; }
      const p = { reason: S.code, brand: S.code === 'R_COMPETITOR' ? (S.brand || 'BR_OTHER') : null, comment: S.comment.trim() || null, photo: S.photo };
      for (const id of recIds) {
        const r = st().recs.find(x => x.id === id);
        if (mode === 'UNTICK') FD.dispatch('REC_UNTICK', Object.assign({ key: key + id, recId: id }, p));
        else if (mode === 'NOT_OFFERED' && r.outcome !== 'NOT_OFFERED') FD.dispatch('REC_NOT_OFFERED', Object.assign({ key: key + id, recId: id }, p));
        else FD.dispatch('REASON_SAVE', Object.assign({ key: key + id, recId: id }, p));
      }
      FD.sheet.close(); FD.toast('S_SAVED'); if (onDone) onDone();
    };
    const codeBtn = c => h('button', { type: 'button', class: 'code-btn' + (S.code === c ? ' on' : ''), 'aria-pressed': S.code === c ? 'true' : 'false',
      on: { click: () => { S.code = c; if (c !== 'R_COMPETITOR') S.brand = null; FD.sheet.redraw(); } } }, h('span', { class: 'radio' }), t(c));
    FD.sheet.open({
      title,
      back: null,
      render: (entry) => {
        entry.cfg.back = S.group && !subset ? () => { S.group = null; FD.sheet.redraw(); } : null;
        const sku = FD.sku(rec.sku);
        const head = h('div', { class: 'muted small', style: { marginBottom: '10px' } }, FD.nameOf(sku) + ' · ' + FD.nameOf(storeOf(rec.store)));
        let pick;
        if (subset) pick = h('div', { class: 'code-list' }, subset.map(codeBtn));
        else if (!S.group) pick = h('div', { class: 'reason-grid' }, Object.keys(FD.REASON_GROUPS).filter(g => FD.reasonPick(g).length).map(g => h('button', { type: 'button', class: 'reason-btn', on: { click: () => { S.group = g; const cs = FD.reasonPick(g); if (cs.length === 1) S.code = cs[0]; FD.sheet.redraw(); } } }, I(GROUP_ICON[g]), t(g))),
          h('button', { type: 'button', class: 'reason-btn wide', on: { click: () => { S.group = 'R_OTHER'; S.code = 'R_OTHER'; FD.sheet.redraw(); } } }, I('more'), t('R_OTHER')));
        else if (S.group === 'R_OTHER') pick = h('div', { class: 'code-list' }, codeBtn('R_OTHER'));
        else pick = h('div', { class: 'stack s8' }, h('div', { class: 'code-list' }, FD.reasonPick(S.group).map(codeBtn)),
          S.code === 'R_COMPETITOR' ? h('div', { class: 'stack s8', style: { marginTop: '8px' } }, h('div', { class: 'small muted' }, t('L_WHICH_BRAND')),
            h('div', { class: 'row wrap' }, FD.COMP_BRANDS.map(b => h('button', { type: 'button', class: 'chip lg chip-btn' + (S.brand === b ? ' on' : ''), 'aria-pressed': S.brand === b ? 'true' : 'false', on: { click: () => { S.brand = b; FD.sheet.redraw(); } } }, t(b))))) : null);
        const showExtras = S.code || S.group;
        const ta = h('textarea', { class: 'textarea', dir: 'auto', maxlength: '200', rows: '2', placeholder: t('L_ADD_COMMENT') + (S.code === 'R_OTHER' || S.code === 'NF_OTHER' ? '' : ' · ' + t('L_OPTIONAL')), 'aria-label': t('L_ADD_COMMENT'),
          on: { input: e => { S.comment = e.target.value; counter.textContent = FD.fmt.num(S.comment.length) + '/' + FD.fmt.num(200); } } });
        ta.value = S.comment;
        const counter = h('span', { class: 'small muted' }, FD.fmt.num(S.comment.length) + '/' + FD.fmt.num(200));
        const file = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, on: { change: async e => { try { S.photo = await FD.readPhoto(e.target.files[0]); FD.sheet.redraw(); } catch (err) { FD.toast('S_PHOTO_BIG'); } } } });
        return h('div', null, head, pick, showExtras ? h('div', { class: 'stack s8', style: { marginTop: '16px' } }, ta, h('div', { class: 'row between' },
          h('div', { class: 'row' }, file, S.photo ? h('div', { class: 'photo-thumb' }, h('img', { src: S.photo, alt: '' }), h('button', { type: 'button', 'aria-label': t('L_REMOVE'), on: { click: () => { S.photo = null; FD.sheet.redraw(); } } }, I('x', 's14')))
            : h('button', { type: 'button', class: 'btn secondary', on: { click: () => file.click() } }, I('camera', 's16'), t('L_ADD_PHOTO'))), counter)) : null);
      },
      footer: () => [h('button', { type: 'button', class: 'btn primary lg block', disabled: !S.code || (S.code === 'R_COMPETITOR' && !S.brand) || ((S.code === 'R_OTHER' || S.code === 'NF_OTHER') && !S.comment.trim()), on: { click: save } }, t('L_SAVE'))]
    });
  };

  V.tipSheet = function (tipId) {
    const tp = st().tips.find(x => x.id === tipId); if (!tp) return;
    if (!tp.read) FD.dx('TIP_READ', { id: tp.id });
    FD.sheet.open({ title: tx(tp.tpl + '_T', tp.slots), render: () => h('div', { class: 'stack s16' },
      h('div', { class: 'tipbox', style: { fontSize: '15px' } }, I('bulb'), h('div', null, tipText(tp))),
      h('div', { class: 'small muted' }, FD.nameOf(st().world.supervisor) + ' · ' + FD.fmt.date(tp.sentAt.date) + ' ' + FD.fmt.time(tp.sentAt.time))),
      footer: () => [FD.btn(t('W_TIP_GOT'), () => { FD.dx('TIP_ACK', { id: tp.id }); FD.sheet.close(); }, 'primary lg block')] });
  };

  V.planChangesSheet = items => { items.forEach(n => { if (!n.read) FD.dx('NOTIF_READ', { id: n.id }); });
    FD.sheet.open({ title: tx('N_PLAN_SUP_G', { supId: 'S1', n: items.length }), render: () => h('div', { class: 'v-card' }, items.map(n => h('button', { type: 'button', class: 'list-row click', on: { click: () => { FD.sheet.closeAll(); FD.openNotifTarget(n); } } },
      h('span', { class: 'grow' }, FD.nameOf(storeOf(n.slots.storeId))), h('span', { class: 'small muted' }, FD.fmt.time(n.at.time)), I('chevron-right', 's16')))) }); };
  V.inbox = function (vsrId) {
    const list = () => {
      const all = st().notifs.filter(n => n.vsr === vsrId).slice().reverse();
      if (!all.length) return FD.empty('X_INBOX', null, 'bell');
      // plan changes from the supervisor on one day arrive as one notification that opens the list of stores
      const ns = [], seen = {};
      for (const n of all) { if (n.tpl !== 'N_PLAN_SUP') { ns.push(n); continue; } const k = n.at.date; if (seen[k]) { seen[k].items.push(n); continue; } ns.push(seen[k] = { group: true, at: n.at, items: [n], slots: n.slots }); }
      const planRow = g => { const unread = g.items.some(n => !n.read);
        return h('button', { type: 'button', class: 'list-row click', style: { width: '100%', textAlign: 'start', padding: '12px 14px', alignItems: 'flex-start' }, on: { click: () => V.planChangesSheet(g.items) } },
          h('span', { class: 'fu-ic' }, I('route', 's16')),
          h('div', { class: 'grow' }, h('div', { style: { fontWeight: unread ? 600 : 400 } }, g.items.length > 1 ? tx('N_PLAN_SUP_G', { supId: 'S1', n: g.items.length }) : FD.notifText(g.items[0]).title),
            h('div', { class: 'small muted' }, (g.at.date === today() ? '' : FD.fmt.date(g.at.date) + ' ') + FD.fmt.time(g.at.time))),
          unread ? h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand)', marginTop: '6px' }, 'aria-label': t('L_UNREAD') }) : null); };
      return h('div', { class: 'v-card' }, ns.slice(0, 60).map(n => { if (n.group) return planRow(n); const { title, body } = FD.notifText(n);
        return h('button', { type: 'button', class: 'list-row click', style: { width: '100%', textAlign: 'start', padding: '12px 14px', alignItems: 'flex-start' },
          on: { click: () => { FD.dx('NOTIF_READ', { id: n.id }); FD.sheet.close(); FD.openNotifTarget(n); } } },
          h('span', { class: 'fu-ic' + (n.tpl === 'N_NOT_SOLD' || n.tpl === 'N_EOD' ? ' p2' : '') }, I({ N_MSG: 'message', N_SOLD: 'check-circle', N_NOT_SOLD: 'alert', N_ARRIVE: 'map-pin', N_ARRIVE_ONE: 'map-pin', N_EOD: 'clock', N_REPLY: 'message', N_REPLY_STORE: 'message', N_TIP: 'bulb', N_REMOVED: 'ban' }[n.tpl] || 'bell', 's16')),
          h('div', { class: 'grow' }, h('div', { style: { fontWeight: n.read ? 400 : 600 } }, title), body ? h('div', { class: 'small muted' }, body) : null,
            h('div', { class: 'small muted' }, (n.at.date === today() ? '' : FD.fmt.date(n.at.date) + ' ') + FD.fmt.time(n.at.time))),
          n.read ? null : h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand)', marginTop: '6px' }, 'aria-label': t('L_UNREAD') }));
      }));
    };
    FD.sheet.open({ title: t('L_INBOX'), live: list, render: () => h('div', { 'data-live': '' }, list()),
      footer: () => [FD.btn(t('L_MARK_ALL'), () => FD.dx('NOTIFS_READ_ALL', { vsr: vsrId }), 'secondary block')] });
  };

  // ---------- TODAY ----------
  FD.registerView('vsr', 'today', (r, vsr) => {
    const s = st(); const d = today(); const plan = FD.planFor(s, vsr.id, d);
    const confirmed = s.dayConfirmed[vsr.id + '|' + d];
    const anyArrived = plan.stops.some(x => x.status !== 'PLANNED');
    const route = s.world.routes.find(x => x.id === vsr.route);
    const body = [];
    const hour = +s.clock.time.slice(0, 2);
    plan.covering.forEach(c => { const owner = s.world.vsrs.find(v => v.id === FD.routeOwner(s, c.route, d)) || s.world.vsrs.find(v => v.route === c.route); body.push(h('div', { class: 'banner info', style: { marginTop: '4px' } }, I('users'), h('span', null, tx('D_COVER', { vsrId: owner.id })))); });
    if (!plan.stops.length) { body.push(FD.empty('X_TODAY_NONE', null, 'calendar')); return { title: tx(hour < 12 ? 'L_GOOD_MORNING' : 'L_GOOD_DAY', { vsrId: vsr.id }), sub: FD.fmt.dateLong(d), body }; }
    // R7: the plan reaches the salesman once the supervisor releases it (or he starts his first visit)
    if (FD.vanStage(s, vsr.id, d) === 'PLAN_READY') { body.push(h('div', { class: 'v-card', style: { padding: '18px 16px', marginTop: '12px' } }, h('div', { class: 'row' }, I('clock'), h('div', null, h('b', null, t('L_PLAN_PREPARING')), h('div', { class: 'small muted' }, t('L_PLAN_PREPARING_B')))))); }
    const pay = FD.paydayNote && FD.paydayNote(d); // salary days: one small line
    if (pay && FD.has(pay)) body.push(h('div', { class: 'small muted pay-note', style: { padding: '2px 4px' } }, t(pay)));
    const recs = plan.recs;
    // morning review
    const bySku = {}; recs.forEach(x => { (bySku[x.sku] = bySku[x.sku] || []).push(x); });
    const promos = s.world.promos.filter(p => p.start <= d && p.end >= d);
    let pf = L['vsr:promoFilter']; if (pf && !promos.some(p => p.id === pf)) pf = L['vsr:promoFilter'] = null; // promo ended
    const skuRows = Object.entries(bySku).filter(([code]) => !pf || promos.find(p => p.id === pf).skus.includes(code))
      .sort((a, b) => b[1].length - a[1].length).map(([code, rs]) => {
        const sku = FD.sku(code); const live = rs.filter(x => x.outcome !== 'NOT_OFFERED');
        const units = live.reduce((a, x) => a + (x.qtyModified ?? x.qty), 0);
        const open = L['vsr:open:' + code];
        return h('div', { class: 'v-card', style: { padding: 0 } },
          h('button', { type: 'button', class: 'list-row click', style: { width: '100%', border: 0, padding: '12px 14px', textAlign: 'start' }, 'aria-expanded': open ? 'true' : 'false', on: { click: () => { L['vsr:open:' + code] = !open; FD.render(); } } },
            FD.skuTile(code, 30), h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600, fontSize: '15px' } }, FD.nameOf(sku)),
              h('div', { class: 'small muted' }, (live.length === 1 ? t('L_STORES_1') : t('L_STORES_N', { n: FD.fmt.num(live.length) })) + ' · ' + FD.fmt.num(units) + ' ' + unitText(code, units))),
            promos.some(p => p.skus.includes(code)) ? FD.chip(t('TYPE_PROMO'), 'warn') : null, I(open ? 'chevron-up' : 'chevron-down', 's16')),
          open ? h('div', { style: { borderTop: '1px solid var(--line)' } }, rs.map(x => {
            const on = x.outcome !== 'NOT_OFFERED';
            const locked = confirmed || x.outcome && x.outcome !== 'NOT_OFFERED';
            return h('label', { class: 'check list-row', style: { padding: '10px 14px' } },
              h('input', { type: 'checkbox', checked: on, disabled: !!locked, on: { change: e => { if (e.target.checked) FD.dx('REC_RETICK', { recId: x.id }); else { e.target.checked = true; V.reasonSheet(x.id, 'UNTICK'); } } } }),
              h('span', { class: 'grow' }, FD.nameOf(storeOf(x.store)), h('span', { class: 'small muted', style: { display: 'block' } }, FD.fmt.num(x.qtyModified ?? x.qty) + ' ' + unitText(code, x.qtyModified ?? x.qty) + (x.reason && !on ? ' · ' + t(x.reason) : ''))));
          })) : null);
      });
    const vanCheck = () => {
      if (!s.rules.vanFeed) return h('div', { class: 'banner warn', style: { marginTop: '10px' } }, I('info'), h('span', null, t('S_VAN_OFF')));
      const need = {}; recs.filter(x => x.outcome !== 'NOT_OFFERED').forEach(x => { need[x.sku] = (need[x.sku] || 0) + (x.qtyModified ?? x.qty); });
      const van = s.vanStock[vsr.id] || {};
      const rows = Object.entries(need).map(([code, n]) => ({ code, n, have: van[code] || 0 }));
      const short = rows.filter(x => x.have < x.n);
      const shortRecs = recs.filter(x => short.some(y => y.code === x.sku)).length;
      return h('div', { style: { marginTop: '12px' } },
        h('div', { class: 'row between', style: { marginBottom: '6px' } }, h('b', { style: { fontSize: '14px' } }, t('L_VAN_CHECK'))),
        h('div', { class: 'banner ' + (short.length ? 'warn' : 'good') }, I(short.length ? 'alert' : 'check-circle'), h('span', null, short.length ? t('L_VAN_SHORT', { n: FD.fmt.num(shortRecs) }) : t('L_VAN_OK'))),
        short.length ? h('div', { class: 'v-card', style: { marginTop: '8px' } }, short.map(x => h('div', { class: 'list-row', style: { padding: '10px 14px' } }, h('span', { class: 'grow' }, FD.skuLabel(x.code)),
          FD.chip(t('L_NEED_ON_VAN', { n: FD.fmt.num(x.n), qty: FD.fmt.num(x.have) }), 'warn')))) : null);
    };
    const review = confirmed
      ? h('div', { class: 'v-card', style: { padding: '12px 14px' }, 'data-tour': 'vsr1' }, h('div', { class: 'row' }, h('span', { class: 'fu-ic', style: { background: 'var(--good-tint)', color: 'var(--good)' } }, I('check')),
          h('div', { class: 'grow' }, h('b', null, t('L_REVIEWED', { n: FD.fmt.num(Object.keys(bySku).length) }))),
          FD.btn(t(L['vsr:showList'] ? 'L_HIDE_LIST' : 'L_VIEW_LIST'), () => { L['vsr:showList'] = !L['vsr:showList']; FD.render(); }, 'ghost sm'),
          !anyArrived ? FD.btn(t('L_EDIT'), () => FD.dx('DAY_UNCONFIRM', { vsr: vsr.id }), 'ghost sm') : null),
        L['vsr:showList'] ? h('div', { class: 'stack s8', style: { marginTop: '12px' } }, skuRows.length ? skuRows : FD.empty('X_FILTER'),
          FD.btn(t('L_ASK_SUP_CHANGE'), () => FD.threadSheet({ type: 'vsr', id: vsr.id }, 'VSR'), 'secondary sm', 'message')) : null)
      : h('div', { 'data-tour': 'vsr1' },
          h('div', { class: 'banner info' }, I('info'), h('span', null, t('T_REVIEW'))),
          promos.length ? h('div', { style: { marginTop: '12px' } }, h('div', { class: 'small muted', style: { marginBottom: '6px' } }, t('L_PROMOS_TODAY')),
            h('div', { class: 'promo-strip' }, promos.map(p => h('button', { type: 'button', class: 'chip lg chip-btn' + (pf === p.id ? ' on' : ''), 'aria-pressed': pf === p.id ? 'true' : 'false',
              on: { click: () => { L['vsr:promoFilter'] = pf === p.id ? null : p.id; FD.render(); } } }, I('tag'), t(p.promoId) + ' · ' + FD.nameOf(FD.sku(p.skus[0])))))) : null,
          h('div', { class: 'stack s8', style: { marginTop: '12px' } }, skuRows.length ? skuRows : FD.empty('X_FILTER')),
          vanCheck(),
          h('div', { style: { marginTop: '14px' } }, FD.btn(t('L_CONFIRM_LIST'), () => FD.dx('DAY_CONFIRM', { vsr: vsr.id }), 'primary lg block', 'check')));
    if (FD.vanStage(s, vsr.id, d) !== 'PLAN_READY') body.push(h('section', { class: 'v-section' }, h('h3', null, t('L_MORNING')), review));
    // progress + stops
    const done = plan.stops.filter(x => x.status === 'DONE').length;
    const ups = recs.filter(x => SOLD.includes(x.outcome)).length;
    const mode = L['vsr:stopsMode'] || 'list';
    body.push(h('section', { class: 'v-section', 'data-tour': 'vsr2' },
      h('div', { class: 'row between', style: { marginBottom: '8px' } }, h('h3', { style: { margin: 0 } }, t('L_STOPS')),
        FD.seg([{ id: 'list', label: t('L_LIST'), icon: 'list' }, { id: 'map', label: t('L_MAP'), icon: 'map' }], mode, m => { L['vsr:stopsMode'] = m; FD.render(); })),
      h('div', { class: 'small muted', style: { marginBottom: '6px' } }, t('L_PROGRESS', { n: FD.fmt.num(done), qty: FD.fmt.num(plan.stops.length), got: FD.fmt.num(ups) })),
      h('div', { class: 'progress', role: 'progressbar', 'aria-label': tx('L_STOPS_DONE', { n: done, m: plan.stops.length }), 'aria-valuenow': done, 'aria-valuemax': plan.stops.length }, h('i', { style: { width: (100 * done / plan.stops.length) + '%' } })),
      h('div', { style: { marginTop: '12px' } }, mode === 'map' ? V.map(plan, vsr) : [mode === 'map' ? h('div', { class: 'banner warn', style: { marginBottom: '10px' } }, I('wifi-off'), h('span', null, t('S_MAP_OFFLINE'))) : null, h('div', { class: 'v-card' }, plan.stops.map(stop => V.stopRow(stop, plan, vsr)))])));
    return { title: tx(hour < 12 ? 'L_GOOD_MORNING' : 'L_GOOD_DAY', { vsrId: vsr.id }), sub: FD.fmt.dateLong(d) + ' · ' + V.area(route), body };
  });

  V.stopRow = function (stop, plan, vsr) {
    const s = storeOf(stop.store); const n = plan.recs.filter(x => x.store === stop.store && x.outcome === null).length + (plan.carried || []).filter(x => x.store === stop.store).length;
    const open = () => FD.go('#/vsr/' + vsr.id + '/store/' + stop.store);
    const attn = FD.storesNeedingAttention(st(), [s.id], stop.date)[0];
    const more = e => { e.stopPropagation(); FD.menu(e.currentTarget, [
      stop.status === 'SKIPPED' && stop.skipReason === 'SK_SUP' ? null : stop.status === 'SKIPPED' ? { icon: 'undo', label: t('L_UNDO_SKIP'), onClick: () => FD.dx('STOP_UNSKIP', { store: stop.store, visitId: stop.id }) }
        : { icon: 'x-circle', label: t('L_SKIP_STOP'), onClick: () => V.skipSheet(stop, 'STOP_SKIP') },
      { icon: 'arrow-down', label: t('L_MOVE_LATER'), onClick: () => V.skipSheet(stop, 'STOP_MOVE') },
      { icon: 'repeat', label: t('L_VISIT_AGAIN'), onClick: () => V.revisitSheet(stop.store) },
      { icon: 'phone', label: t('L_CALL'), onClick: () => { location.href = 'tel:' + s.phone; } },
      { icon: 'message', label: t('L_MSG_SUP'), onClick: () => FD.threadSheet({ type: 'store', id: s.id }, 'VSR') }]); };
    return h('div', { class: 'stop ' + stop.status },
      h('button', { type: 'button', class: 'stop-main', on: { click: open } }, h('span', { class: 'seq' }, stop.status === 'DONE' ? I('check', 's16') : FD.fmt.num(plan.stops.indexOf(stop) + 1)),
      h('div', { class: 'grow' }, h('div', { class: 'nm row', style: { gap: '6px' } }, FD.sizeIcon(s.size), h('span', null, FD.nameOf(s))),
        h('div', { class: 'meta' }, [t('LBL_' + s.label), nearName(s, true)].filter(Boolean).join(' · ')),
        stop.status === 'SKIPPED' ? h('div', { class: 'meta' }, t(stop.skipReason)) : null,
        h('div', { class: 'row wrap', style: { marginTop: '6px', gap: '6px' } }, V.statusChip(stop), stop.collected ? FD.chip([I('wallet', 's14'), t('L_COLLECTED') + ' ' + FD.fmt.money0(stop.collected)], 'good') : null, stop.revisit ? FD.chip([I('repeat', 's14'), t('L_REVISIT')], 'warn') : null, st().preorders.some(p => p.store === stop.store && p.forDate === stop.date && p.status !== 'DONE') ? FD.chip([I('inbox', 's14'), t('L_PREORDER')], 'info') : null, FD.waChips(st(), stop.store, stop.date), stop.reassigned || stop.supAdded ? FD.chip([I('user', 's14'), t('SK_SUP_ADDED')], 'info') : null, stop.offPlan ? FD.chip(t('SK_OFFPLAN'), 'info') : null,
          plan.carried && plan.carried.some(r => r.store === stop.store) ? FD.chip(t('L_OPEN_SHORT'), 'warn') : null,
          !FD.invoicedThisMonth(st(), s.id, stop.date) ? FD.chip(t('L_NOT_INVOICED_M'), 'warn') : null, s.overdue > 0 ? FD.chip(tx('L_OVERDUE_AMT', { money: FD.fmt.money0(s.overdue) }), 'bad') : null,
          s.credit !== 'OK' && !(s.overdue > 0) ? FD.creditChip(s.credit, true) : null, attn ? FD.sup.attnChips(Object.assign({}, attn, { reasons: attn.reasons.slice(0, 1) })) : null,
          n ? FD.chip(tx('L_RECS_N', { n }), 'info') : FD.chip(t('L_NO_RECS'), '')))),
      h('div', { class: 'row', style: { gap: 0 } },
        h('a', { class: 'icon-btn', href: `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`, target: '_blank', rel: 'noopener', 'aria-label': t('L_NAVIGATE'), title: t('L_NAVIGATE'), on: { click: e => e.stopPropagation() } }, I('navigation')),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('L_ACTIONS'), on: { click: more } }, I('more'))));
  };

  V.skipSheet = function (stop, type) {
    let pick = null, comment = '';
    FD.sheet.open({ title: t(type === 'STOP_SKIP' ? 'L_SKIP_STOP' : 'L_MOVE_LATER'), render: () => h('div', { class: 'stack s8' },
      h('div', { class: 'muted small' }, FD.nameOf(storeOf(stop.store))),
      h('div', { class: 'code-list' }, ['SK_CLOSED', 'SK_LATER', 'SK_ROAD', 'SK_TIME', 'SK_OTHER'].map(c => h('button', { type: 'button', class: 'code-btn' + (pick === c ? ' on' : ''), on: { click: () => { pick = c; FD.sheet.redraw(); } } }, h('span', { class: 'radio' }), t(c)))),
      pick === 'SK_OTHER' ? (() => { const ta = h('textarea', { class: 'textarea', placeholder: t('L_ADD_COMMENT'), on: { input: e => { comment = e.target.value; } } }); ta.value = comment; return ta; })() : null),
      footer: () => [h('button', { type: 'button', class: 'btn primary lg block', disabled: !pick, on: { click: () => { FD.dx(type, { store: stop.store, visitId: stop.id, reason: pick, comment }); FD.sheet.close(); FD.toast('S_SAVED', null, type === 'STOP_SKIP' ? { undo: () => FD.dx('STOP_UNSKIP', { store: stop.store, visitId: stop.id }) } : {}); } } }, t('L_SAVE'))] });
  };

  // Map: embedded OpenStreetMap snapshot of Riyadh (R2-Q6) — works offline, pins approximate.
  FD.snapMap = function (box, points, opts = {}) {
    const M = FD.MAP; if (!M || !box.isConnected || !points.length) return;
    const proj = (lat, lng) => { const n = 2 ** M.z, lr = lat * Math.PI / 180; return [((lng + 180) / 360 * n - M.x0) * 256, ((1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n - M.y0) * 256]; };
    const W = box.clientWidth || 340, H = box.clientHeight || 420;
    const pts = points.map(p => Object.assign({ xy: proj(p.lat, p.lng) }, p));
    const xs = pts.map(p => p.xy[0]), ys = pts.map(p => p.xy[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const k = Math.max(0.6, Math.min(1.6, Math.min((W - 80) / Math.max(40, maxx - minx), (H - 110) / Math.max(40, maxy - miny))));
    const kk = Math.max(k, W / M.w, H / M.h); // never zoom out past the snapshot edge
    const clamp = (v, lo) => Math.min(0, Math.max(lo, v));
    const tx = clamp(W / 2 - kk * (minx + maxx) / 2, W - M.w * kk), ty = clamp(H / 2 + 10 - kk * (miny + maxy) / 2, H - M.h * kk);
    const peek = h('div', { class: 'snap-peek' });
    const img = h('img', { src: M.src, alt: '', draggable: 'false', style: { width: M.w * kk + 'px', height: M.h * kk + 'px' } });
    const inner = h('div', { class: 'snap-inner', style: { left: tx + 'px', top: ty + 'px' } }, img);
    const pins = pts.map(p => { const el = h('div', { class: 'snap-pin', style: { left: (p.xy[0] * kk + tx) + 'px', top: (p.xy[1] * kk + ty) + 'px' } },
      h('div', { class: 'pin ' + (p.status || ''), style: p.color ? { background: p.color } : null, role: 'button', tabindex: '0', 'aria-label': p.name,
        on: { click: () => show(p), keydown: e => { if (e.key === 'Enter') show(p); } } }, p.van ? I('truck', 's14') : null, h('b', null, p.label)));
      p._el = el; return el; });
    const pick = p => { box.querySelectorAll('.snap-pin.sel').forEach(e => e.classList.remove('sel')); if (p && p.van) p._el.classList.add('sel'); if (opts.onPick && (!p || p.van)) opts.onPick(p); };
    function show(p) { pick(p);
      peek.replaceChildren(h('div', { class: 'v-card', style: { padding: '12px 14px' } }, h('div', { class: 'row' }, h('b', { class: 'grow ellipsis' }, p.name), FD.iconBtn('x', FD.t('L_CLOSE'), () => { peek.replaceChildren(); pick(null); })),
        p.sub ? h('div', { class: 'small muted' }, p.sub) : null,
        h('div', { class: 'row', style: { marginTop: '8px' } }, p.open ? FD.btn(FD.t('L_OPEN'), p.open, 'primary sm') : null,
          p.van ? null : h('a', { class: 'btn secondary sm', href: `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`, target: '_blank', rel: 'noopener' }, I('navigation', 's16'), FD.t('L_NAVIGATE')))));
    }
    const here = opts.here ? (() => { const xy = proj(opts.here[0], opts.here[1]); return h('div', { class: 'here', title: FD.t('L_YOU_ARE_HERE'), style: { left: (xy[0] * kk + tx) + 'px', top: (xy[1] * kk + ty) + 'px' } }); })() : null;
    box.replaceChildren(inner, ...pins, ...(here ? [here] : []), peek, h('span', { class: 'attr' }, '© OpenStreetMap'));
    const selP = pts.find(p => p.sel); if (selP) show(selP);
  };
  V.mapUnavailable = () => false;
  V.map = function (plan, vsr) {
    const box = h('div', { class: 'snap map-box' });
    const last = plan.stops.filter(x => x.status !== 'PLANNED' && x.status !== 'SKIPPED').pop();
    const here = last ? storeOf(last.store) : null;
    requestAnimationFrame(() => FD.snapMap(box, plan.stops.map((stop, i) => { const s = storeOf(stop.store); return { lat: s.lat, lng: s.lng, label: FD.fmt.num(i + 1), status: stop.status, name: FD.nameOf(s), open: () => FD.go('#/vsr/' + vsr.id + '/store/' + s.id) }; }), { here: here ? [here.lat, here.lng] : null }));
    return box;
  };

  // ---------- STORE ----------
  FD.registerView('vsr', 'store', (r, vsr) => {
    const s = st(); const d = today(); const plan = FD.planFor(s, vsr.id, d);
    let storeId = r.id;
    if (!storeId) return V.storeList(vsr, plan);
    const store = storeOf(storeId); const visit = plan.stops.filter(x => x.store === storeId).find(x => x.status !== 'DONE' && x.status !== 'SKIPPED') || plan.stops.find(x => x.store === storeId);
    const onPlan = !!visit;
    if (L['vsr:storeTabFor'] !== storeId) { L['vsr:storeTab'] = 'offer'; L['vsr:storeTabFor'] = storeId; } // each store opens on Offer
    const tab = ['offer','profile'].includes(L['vsr:storeTab'])?L['vsr:storeTab']:'offer';
    const lastOrder = FD.SKUS.map(k => FD.lastOrder(s, storeId, k.code, d)).filter(Boolean).sort().pop();
    // two lines for every store: what it is and when it last ordered (always the same line), then today's facts with message and navigate
    // in thumb reach; area tags live in Profile. Keeps Offer high on the screen.
    const nOffer = s.recs.filter(x => x.store === storeId && x.date === d && FD.recVsr(x) === vsr.id && !x.blockedAt).length + FD.openTemps(s, storeId, d).filter(x => x.date < d).length;
    const head = h('div', { class: 'stack', style: { gap: '6px', marginTop: '2px' } },
      store.overdue > 0 ? h('div', { class: 'banner warn collect-first', role: 'status' }, I('wallet'), h('span', null, store.oldestDue ? tx('L_COLLECT_FIRST', { money: FD.fmt.money0(store.overdue), date: store.oldestDue }) : tx('L_COLLECT_FIRST_N', { money: FD.fmt.money0(store.overdue) }))) : null,
      // one compact chip row (scrolls sideways, never wraps), then the last order
      h('div', { class: 'store-chips' }, FD.chip(t('LBL_' + store.label), 'info'), FD.chip([FD.sizeIcon(store.size), t('SIZE_' + store.size)]), (store.tags || []).map(x => FD.chip(t('TAGN_' + x.slice(4)), 'outline'))),
      h('div', { class: 'small muted store-line' }, lastOrder ? t('L_LAST_VISIT', { date: FD.fmt.date(lastOrder) }) : t('SA_NO_ORDER_EVER')),
      h('div', { class: 'row store-meta' }, h('div', { class: 'row wrap grow', style: { gap: '6px', minWidth: 0 } }, visit ? V.statusChip(visit) : null,
          store.overdue > 0 ? FD.chip([I('wallet', 's14'), tx('L_OVERDUE_AMT', { money: FD.fmt.money0(store.overdue) })], 'bad') : store.credit !== 'OK' ? FD.creditChip(store.credit, true) : null,
          !FD.invoicedThisMonth(s, storeId, d) ? FD.chip(t('L_NOT_INVOICED_M'), 'warn') : null, store.relocate ? FD.chip([I('map-pin', 's14'), t('L_LOCATION_CONFIRM')], 'info') : null),
        h('button', { type: 'button', class: 'round-btn', 'aria-label': t('L_MSG_SUP'), title: t('L_MSG_SUP'), on: { click: () => FD.threadSheet({ type: 'store', id: storeId }, 'VSR') } }, I('message', 's18')),
        h('a', { class: 'round-btn', 'aria-label': t('L_NAVIGATE'), title: t('L_NAVIGATE'), href: `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`, target: '_blank', rel: 'noopener' }, I('navigation', 's18'))),
      h('div',{class:'store-tabs-row'},
        h('div',{class:'tabs store-tabs',style:{padding:0}},[['offer','L_OFFER'],['profile','L_PROFILE']].map(([id,lb])=>
          h('button',{type:'button',class:tab===id?'on':'',on:{click:()=>{L['vsr:storeTab']=id;FD.render();}}},t(lb),id==='offer'&&nOffer?h('span',{class:'pill-count'},FD.fmt.num(nOffer)):null))),
));
    const body = [head];
    if (tab === 'offer') { const rq = FD.scRequestCard({ store: storeId, visitId: visit?.id }); if (rq) body.push(rq); const sc = FD.scVisitCard({ store: storeId, visitId: visit?.id }); if (sc) body.push(sc); }
    if (tab === 'offer') s.preorders.filter(p => p.store === storeId && p.status !== 'DONE' && (!p.forDate || p.forDate === d)).forEach(p => body.push(h('div', { class: 'banner info', style: { marginTop: '12px', alignItems: 'flex-start' } }, I('inbox'),
      h('div', { class: 'grow', style: { minWidth: 0 } }, h('b', null, t('L_PREORDER_FROM_OWNER')), h('div', { dir: 'auto' }, FD.txtOf(p.text)), h('div', { class: 'small muted' }, t('L_VIA_WHATSAPP') + ' · ' + FD.fmt.time(p.at.time))),
      p.photo ? h('img', { src: p.photo, alt: '', style: { width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px', cursor: 'zoom-in' }, on: { click: () => FD.lightbox(p.photo) } }) : null)));
    const recs = s.recs.filter(x => x.store === storeId && x.date === d && FD.recVsr(x) === vsr.id).concat(FD.openTemps(s, storeId, d).filter(x => x.date < d));
    const live = recs.filter(x => !x.blockedAt);
    const due = FD.storeSkuStats(s, storeId, d).filter(x => x.cover != null && x.cover <= 2); // regular reorders, not upsells: a quiet line only
    if (due.length && live.length) body.push(h('div', { class: 'reorder-hint' }, I('repeat', 's16'), h('span', null, t('L_LIKELY_NEEDS', { label: due.slice(0, 3).map(x => FD.nameOf(FD.sku(x.code)) + ' ×' + FD.fmt.num(Math.max(1, Math.round(x.avgVisit)))).join(FD.lang === 'ar' ? '، ' : ', ') }))));
    if (!onPlan) body.push(h('div', { class: 'banner info', style: { marginTop: '12px' } }, I('calendar'), h('div', { class: 'grow' }, h('b', null, t('L_NOT_ON_PLAN')), h('div', { class: 'small' }, t('L_OFF_PLAN_NOTE'))),
      FD.isSellingDay(d) ? FD.btn(t('L_ADD_VISIT_TODAY'), () => { FD.dx('OFFPLAN_ADD', { vsr: vsr.id, store: storeId }); FD.toast('S_SAVED'); }, 'primary sm', 'plus') : null));
    let cta = null;
    if (tab === 'offer') {
      const blocked = store.credit === 'BLOCKED' || store.onboarding !== 'APPROVED';
      if (!live.length) {
        const g = FD.recommend(s, storeId, d).gated[0];
        body.push(g && blocked ? h('div', { class: 'v-card', style: { marginTop: '14px' } }, FD.empty('X_STORE_GATED', { gateId: g.gate }, 'lock')) : V.refills(storeId));
      } else body.splice(1, 0, h('section', { class: 'offer-list', style: { marginTop: '12px' } }, live.map((x, i) => V.offerRow(x, i === 0))));
      recs.filter(x => x.blockedAt).forEach(x => body.push(h('div', { class: 'v-card rec gone', style: { marginTop: '8px' } }, h('div', { class: 'row' }, I('ban'), FD.skuLabel(x.sku, t('E_BLOCKED'))))));
      const openVisit = (plan.stops || []).some(x => x.store === storeId && x.status !== 'DONE' && x.status !== 'SKIPPED');
      if (openVisit && !blocked) cta = FD.btn(t('L_OPEN_SB'), () => V.salesBuzz(storeId), 'primary lg block', 'external'); // an order can always be placed: recommendations are a hint, the store's usual refills still apply
    } else body.push(V.profile(storeId));
    const hood = FD.lang === 'ar' ? FD.HOOD_AR[store.hood] : store.hood;
    return { title: FD.nameOf(store), sub: hood && !FD.nameOf(store).includes(hood) ? hood : null, tools: FD.scCameraButton({ store: storeId, visitId: visit?.id }), back: r.id ? () => FD.go('#/vsr/' + vsr.id + (onPlan ? '/today' : '/store')) : null, body, cta };
  });

  // every store assigned to this salesman: today's plan first, then the rest (off-plan visits are tracked)
  V.storeList = function (vsr, plan) {
    const s = st(); const d = today(); const q = (L['vsr:storeQ'] || '').toLowerCase();
    const mine = s.world.stores.filter(x => x.vsr === vsr.id || FD.routeOwner(s, x.route, d) === vsr.id);
    const planned = plan.stops.map(x => x.store);
    const lastVisit = id => s.visits.filter(v => v.store === id && v.status === 'DONE' && v.date <= d).reduce((m, v) => (v.date > m ? v.date : m), '');
    const lastOrder = id => FD.SKUS.map(k => FD.lastOrder(s, id, k.code, FD.addDays(d, 1))).filter(Boolean).sort().pop();
    const match = x => !q || (x.name + ' ' + (x.name_ar || '') + ' ' + x.id + ' ' + (nearName(x, true) || '')).toLowerCase().includes(q);
    const row = x => { const lv = lastVisit(x.id), lo = lastOrder(x.id); const open = FD.openTemps(s, x.id, d).length;
      return h('button', { type: 'button', class: 'list-row click', style: { width: '100%', textAlign: 'start', padding: '12px 14px' }, on: { click: () => FD.go('#/vsr/' + vsr.id + '/store/' + x.id) } },
        h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'ellipsis', style: { fontWeight: 600 } }, FD.nameOf(x)),
          h('div', { class: 'small muted ellipsis' }, [t('LBL_' + x.label), nearName(x, true)].filter(Boolean).join(' · ')),
          h('div', { class: 'row wrap', style: { gap: '6px', marginTop: '6px' } }, FD.sup && FD.sup.visitOrder ? FD.sup.visitOrder(lv || null, lo || null) : null, open ? FD.chip(t('L_OPEN_SHORT'), 'warn') : null,
            x.overdue > 0 ? FD.chip(tx('L_OVERDUE_AMT', { money: FD.fmt.money0(x.overdue) }), 'bad') : null)), I('chevron-right', 's16')); }; // one rule: any invoice past its due date
    const today1 = mine.filter(x => planned.includes(x.id) && match(x)).sort((a, b) => planned.indexOf(a.id) - planned.indexOf(b.id));
    const others = mine.filter(x => !planned.includes(x.id) && match(x)).sort((a, b) => FD.nameOf(a).localeCompare(FD.nameOf(b)));
    const search = FD.searchBox('vsrStores', t('L_SEARCH_STORES'), L['vsr:storeQ'], q2 => { L['vsr:storeQ'] = q2; FD.render(); }, { marginTop: '4px' });
    return { title: t('L_MY_STORES'), sub: t('L_STORES_N', { n: FD.fmt.num(mine.length) }), body: [search,
      h('section', { class: 'v-section' }, h('h3', null, t('L_ON_PLAN_TODAY'), h('span', { class: 'pill-count' }, FD.fmt.num(today1.length))), today1.length ? h('div', { class: 'v-card' }, today1.map(row)) : h('div', { class: 'v-card' }, FD.empty('X_TODAY_NONE', null, 'calendar'))),
      h('section', { class: 'v-section' }, h('h3', null, t('L_OTHER_STORES'), h('span', { class: 'pill-count' }, FD.fmt.num(others.length))), others.length ? h('div', { class: 'v-card' }, others.map(row)) : h('div', { class: 'v-card' }, FD.empty('X_FILTER')))] };
  };

  // where each product group sells best in a baqala (fixed advice, both languages)
  FD.PLACEMENT = { GRP_SINGLES: 'PL_COUNTER', GRP_CUPBOX: 'PL_COUNTER', GRP_CAKEBAR: 'PL_CADDY', GRP_SLICE: 'PL_SNACK', GRP_SWISS: 'PL_SNACK', GRP_POUND: 'PL_BREAKFAST', GRP_RUSK: 'PL_BREAKFAST', GRP_BUTTER: 'PL_TEA' };
  // ponytail: competitor shelf prices from the September field photo check, by product group; refresh when a new check is done
  // parked: competitor shelf prices come from shelf-price capture (not built yet). These older group-level observations are
  // kept for reference only and are not shown; set FD.SHOW_COMPETITOR_PRICE once captured prices replace them.
  FD.SHOW_COMPETITOR_PRICE = false;
  FD.COMPETITOR = { GRP_SINGLES: ['BR_LUSINE', 1.00, 'CMP_PARITY'], GRP_CUPBOX: ['BR_LUSINE', 13.00, 'CMP_DEARER'], GRP_CAKEBAR: ['BR_7DAYS', 1.50, 'CMP_PARITY'],
    GRP_SWISS: ['BR_7DAYS', 2.00, 'CMP_CHEAPER'], GRP_RUSK: ['BR_FUCHSIA', 8.00, 'CMP_PARITY'], GRP_BUTTER: ['BR_DANISA', 24.95, 'CMP_CHEAPER'] };
  V.recCard = function (rec, first) {
    const s = st(); const sku = FD.sku(rec.sku); const q = rec.qtyModified ?? rec.qty; const store = storeOf(rec.store);
    if (rec.stage === 'SENT' && !V._viewed[rec.id]) { V._viewed[rec.id] = 1; setTimeout(() => FD.dx('REC_VIEW', { recId: rec.id }), 0); }
    const cost = q * FD.withVat(sku.cost); // what the store pays on the invoice, incl. VAT
    const promo = rec.promo ? s.world.promos.find(p => p.id === rec.promo) : FD.activePromo(s, rec.sku, today());
    const van = s.rules.vanFeed ? ((s.vanStock[FD.recVsr(rec)] || {})[rec.sku] || 0) : null;
    const tip = tipFor(rec);
    const open = rec.outcome === null;
    const th = FD.recMsgs(s, rec.id).length ? { unreadVsr: false } : null;
    const reasonSlots = Object.assign({ skuCode: rec.sku }, rec.slots, { unitOf: rec.sku });
    const outcome = (() => {
      const o = rec.outcome;
      if (o === 'WAITING') return h('div', { class: 'outcome wait' }, h('span', { class: 'skeleton', style: { width: '16px', height: '16px', borderRadius: '50%' } }), t('E_WAITING'));
      if (o === 'FULL') return h('div', { class: 'outcome good' }, I('check-circle'), h('span', { class: 'grow' }, t(rec.revisit ? 'E_REVISIT' : 'E_FULL')), rec.corrected ? FD.chip(t('E_CORRECTED'), '') : null);
      if (o === 'PARTIAL') return h('div', { class: 'outcome good' }, I('check-circle'), h('span', { class: 'grow' }, tx('E_PARTIAL', { got: rec.got, qty: q, unitOf: rec.sku })), rec.revisit ? FD.chip(t('E_REVISIT'), 'good') : null, rec.corrected ? FD.chip(t('E_CORRECTED')) : null);
      if (o === 'ALT') return h('div', { class: 'outcome good' }, I('check-circle'), h('span', { class: 'grow' }, tx('E_ALT', { altCode: rec.alt })), rec.revisit ? FD.chip(t('E_REVISIT'), 'good') : null);
      if (o === 'NOT_SOLD' && FD.TEMP.includes(rec.reason) && !rec.revisitClosed) return h('div', { class: 'outcome warn' }, I('repeat'),
        h('span', { class: 'grow' }, t('E_OPEN_NEXT'), h('span', { style: { display: 'block', fontWeight: 400, fontSize: '13px' } }, t('L_REASON_IS', { reason: t(rec.reason) }))),
        h('button', { type: 'button', class: 'btn secondary sm', on: { click: () => V.revisitSheet(rec.store) } }, t('L_VISIT_AGAIN')));
      if (o === 'NOT_SOLD' || o === 'NOT_OFFERED') {
        const label = t(o === 'NOT_SOLD' ? (rec.noOrder ? 'E_NO_ORDER' : 'E_NOT_SOLD') : 'E_NOT_FOLLOWED');
        return h('div', { class: 'outcome ' + (rec.reason ? 'warn' : 'bad') }, I(rec.reason ? 'info' : 'alert'),
          h('span', { class: 'grow' }, label, rec.reason ? h('span', { style: { display: 'block', fontWeight: 400, fontSize: '13px' } }, t('L_REASON_IS', { reason: t(rec.reason) + (rec.brand ? ' · ' + t(rec.brand) : '') })) : null,
            FD.pending(rec.id) ? h('span', { class: 'small', style: { display: 'flex', gap: '4px', alignItems: 'center' } }, I('clock', 's14'), t('S_PENDING')) : null),
          h('button', { type: 'button', class: 'btn ' + (rec.reason ? 'ghost' : 'primary') + ' sm', on: { click: () => V.reasonSheet(rec.id, o) } }, rec.reason ? t('L_CHANGE') : t('L_TELL_WHY')));
      }
      return null;
    })();
    // compact by default: product, quantity, what the store pays; the rest one tap away (store shelf price is not known, so not shown)
    const more = !!V._more[rec.id];
    return h('article', { class: 'v-card rec', 'data-tour': first ? 'vsr3' : null, 'aria-label': FD.nameOf(sku) },
      h('div', { class: 'top' }, FD.typeChip(rec.type), rec.cash ? FD.chip(t('L_CASH_SALE'), 'warn') : null, rec.pinned ? FD.chip([I('pin', 's14'), t('L_PIN')], 'brand') : null, h('span', { class: 'grow' }),
        th ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('L_MESSAGES'), on: { click: () => FD.threadSheet({ type: 'rec', id: rec.id }, 'VSR') } }, I('message'), th.unreadVsr ? h('span', { class: 'dot' }, '1') : null)
          : FD.iconBtn('message', t('L_MESSAGES'), () => FD.threadSheet({ type: 'rec', id: rec.id }, 'VSR'))),
      h('div', { class: 'row', style: { gap: '12px', alignItems: 'center' } }, FD.skuTile(rec.sku, 40), h('h4', { class: 'grow' }, FD.nameOf(sku))),
      h('div', { class: 'qty-row' }, h('div', { class: 'grow' }, h('div', { class: 'small muted' }, t('L_QTY')), h('div', { style: { fontWeight: 600 } }, tx(rec.type === 'GAP' ? 'C_FIRST_FILL' : 'C_QTY', { qty: q, unitOf: rec.sku, pcs: q * sku.pcs }))), // one quantity (rec.qty) in the row, the card, the price and the order preview
        null), // quantity is only a hint: the order is placed in SalesBuzz (R2-f)
      h('div', { class: 'rec-pays' }, h('span', { class: 'small muted' }, t('L_PITCH_COST')), h('b', null, money(cost))),
      promo ? h('div', { class: 'banner warn', style: { marginTop: '10px', fontSize: '13px' } }, I('tag', 's16'), h('span', null, tx('B_PROMO', { promoId: promo.promoId, date: promo.end }))) : null,
      van === 0 ? h('div', { class: 'rec-warn small' }, I('truck', 's14'), t('D_NOT_ON_VAN')) : null,
      h('button', { type: 'button', class: 'rec-more', 'aria-expanded': String(more), on: { click: () => { V._more[rec.id] = !more; FD.render(); } } }, t(more ? 'L_SHOW_LESS' : 'L_MORE_DETAILS'), I(more ? 'chevron-up' : 'chevron-down', 's14')),
      more ? h('div', { class: 'rec-details' },
        rec.date < today() ? h('div', { class: 'small muted' }, t('L_CARRIED_FROM', { date: FD.fmt.date(rec.date), reason: t(rec.reason) })) : null,
        h('div', { class: 'why' }, tx(rec.reasonId, reasonSlots), rec.pinned ? ' ' + t('B_PINNED') : ''),
        FD.pgOfferAdvice(rec),
        rec.supEdited ? h('div', null, FD.chip([I('user', 's14'), t(rec.supEdited.prev ? 'L_SUP_CHANGED' : 'SK_SUP_ADDED')], 'info')) : null,
      h('div', { class: 'meta-list' },
        h('div', null, I('truck', 's14'), van == null ? t('D_NOT_VERIFIED') : van > 0 ? tx('D_ON_VAN', { qty: van, unitOf: rec.sku }) : t('D_NOT_ON_VAN')),
        h('div', null, I('clock', 's14'), tx('D_DATA_AGE', { date: FD.addDays(today(), -1), time: '21:40' })),
        h('div', null, I('calendar', 's14'), t('D_EXPIRES'))),
      tip ? h('div', { class: 'tipbox' }, I('bulb', 's16'), h('span', { class: 'grow' }, tx('D_TIP', { supId: 'S1', tip: tipText(tip) })), tip.ack ? FD.chip([I('check', 's14'), t('W_TIP_GOT')], 'good') : FD.btn(t('W_TIP_GOT'), () => FD.dx('TIP_ACK', { id: tip.id }), 'secondary sm')) : null,
      // how to sell against the competitor, and where it goes on the shelf
      FD.SHOW_COMPETITOR_PRICE && FD.COMPETITOR[sku.group] ? h('div', { class: 'rec-line' }, I('target', 's16'), h('span', null, h('b', null, t('L_COMPETITOR') + ': '), tx('CMP_LINE', { brandId: FD.COMPETITOR[sku.group][0], price: FD.COMPETITOR[sku.group][1] }) + ' · ' + t(FD.COMPETITOR[sku.group][2]),
        h('span', { class: 'small muted', style: { display: 'block' } }, t('L_FIELD_CHECK')))) : null,
      FD.PLACEMENT[sku.group] ? h('div', { class: 'rec-line' }, I('layers', 's16'), h('span', null, h('b', null, t('L_WHERE_PLACE') + ': '), t(FD.PLACEMENT[sku.group]))) : null,
      ) : null,
      open ? h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { type: 'button', class: 'btn secondary sm', on: { click: () => V.reasonSheet(rec.id, 'NOT_OFFERED') } }, I('eye-off', 's16'), t('L_DIDNT_OFFER'))) : null,
      outcome);
  };
  V._viewed = {}; V._more = {}; V._open = {};
  V.offerRow = function (rec, first) {
    const q = rec.qtyModified ?? rec.qty, on = !!V._open[rec.id], o = rec.outcome;
    const qty = FD.fmt.num(q) + ' ' + unitText(rec.sku, q); // short in the row; the full wording is in the card
    const waiting = o === 'WAITING' || o === 'PENDING'; // sent to SalesBuzz, answer not back yet: not a "not sold"
    const done = o ? (waiting ? FD.chip(t('ME_UPS_WAITING'), 'info') : FD.chip(t(FD.SOLD.includes(o) ? 'L_SQ_SALE' : o === 'NOT_OFFERED' ? 'E_NOT_FOLLOWED' : 'E_NOT_SOLD'), FD.SOLD.includes(o) ? 'good' : rec.reason ? 'warn' : 'bad')) : null;
    return h('div', { class: 'v-card offer-row' + (on ? ' on' : ''), 'data-tour': first ? 'vsr3' : null },
      h('button', { type: 'button', class: 'offer-h', 'aria-expanded': String(on), on: { click: () => { V._open[rec.id] = !on; FD.render(); } } },
        FD.skuTile(rec.sku, 36), h('span', { class: 'grow', style: { minWidth: 0 } }, h('b', { class: 'ellipsis', style: { display: 'block' } }, FD.nameOf(FD.sku(rec.sku))), h('span', { class: 'row', style: { gap: '6px', marginTop: '2px' } }, FD.typeChip(rec.type), rec.cash ? FD.chip(t('L_CASH_SALE'), 'warn') : null, h('span', { class: 'small muted ellipsis' }, qty + ' · ' + money(q * FD.withVat(FD.sku(rec.sku).cost))))),
        done, I(on ? 'chevron-up' : 'chevron-down', 's16')),
      on ? V.recCard(rec, false) : null);
  };
  // Visit again: later today or on the next visit day (R2-Q4) — inserts a revisit stop into that day's plan
  V.revisitSheet = function (storeId) {
    let when = 'today';
    FD.sheet.open({ title: t('L_VISIT_AGAIN'), render: () => h('div', { class: 'stack s8' },
      h('div', { class: 'muted small' }, FD.nameOf(storeOf(storeId))),
      h('div', { class: 'code-list' }, [['today', 'L_LATER_TODAY'], ['next', 'L_NEXT_VISIT_DAY']].map(([id, lb]) => h('button', { type: 'button', class: 'code-btn' + (when === id ? ' on' : ''), on: { click: () => { when = id; FD.sheet.redraw(); } } }, h('span', { class: 'radio' }), t(lb))))),
      footer: () => [h('button', { type: 'button', class: 'btn primary lg block', on: { click: FD.once(() => { FD.dx('REVISIT_ADD', { vsr: st().vsrId, store: storeId, when }); FD.sheet.close(); FD.toast('S_SAVED'); }) } }, t('L_SAVE'))] });
  };

  // the store's usual products with the usual quantity (median of its last orders), reorders that are due first
  V.usualRefills = function (storeId) {
    const s = st(), d = today();
    const rows = FD.storeSkuStats(s, storeId, d).map(x => ({ code: x.code, due: x.cover != null && x.cover <= 2, q: FD.usual(s, storeId, x.code, d) || Math.max(1, Math.round(x.avgVisit)), stat: x }));
    return rows.filter(x => x.due).concat(rows.filter(x => !x.due));
  };
  V.refills = function (storeId) {
    const rows = V.usualRefills(storeId).slice(0, 6);
    return h('div', { class: 'v-card refills', style: { marginTop: '14px' } }, rows.length ? [h('div', { class: 'small muted', style: { padding: '10px 14px 0' } }, t('L_REFILLS_H')),
      rows.map(x => h('div', { class: 'list-row', style: { padding: '10px 14px' } }, h('div', { class: 'grow', style: { minWidth: 0 } }, FD.skuLabel(x.code, t('L_SKU_STATS', { date: FD.fmt.date(x.stat.lastDate), qty: FD.fmt.num(x.stat.lastQty), n: FD.fmt.num(x.stat.units4w) }))),
        x.due ? FD.chip(t('L_REORDER_DUE'), 'warn') : null, h('b', { class: 'tabular' }, '×' + FD.fmt.num(x.q))))] : FD.empty('L_REFILLS_NONE', null, 'inbox'));
  };
  V.salesBuzz = function (storeId) {
    const screen = document.querySelector('.phone-screen'); if (!screen) return; const s = st(), d = today();
    const offers = storeId ? s.recs.filter(r => r.store === storeId && r.date === d && !r.blockedAt && r.outcome === null).map(r => ({ sku: r.sku, q: r.qtyModified ?? r.qty, rec: true })) : [];
    const refill = storeId ? V.usualRefills(storeId).filter(x => (x.due || !offers.length) && !offers.some(o => o.sku === x.code)).slice(0, 5).map(x => ({ sku: x.code, q: x.q })) : []; // no recommendations: the store's usual products
    const list = offers.concat(refill);
    const el = h('div', { class: 'sb-hand', role: 'dialog', 'aria-modal': 'true' }, h('div', null,
      h('div', { class: 'sb-logo', 'aria-hidden': 'true' }, I('package', 's24')), h('b', { style: { fontSize: '18px' } }, t('L_ORDERS')),
      h('p', { class: 'muted', style: { maxWidth: '260px', margin: '0 auto 12px' } }, t('S_SB_OPENING')),
      list.length ? h('div', { class: 'v-card sb-list' }, list.map(x => h('div', { class: 'list-row' }, I(x.rec ? 'bulb' : 'repeat', 's16'), h('span', { class: 'grow ellipsis' }, FD.nameOf(FD.sku(x.sku))), h('b', { class: 'tabular' }, '×' + FD.fmt.num(x.q))))) : null,
      FD.btn(t('L_BACK_FD'), () => el.remove(), 'secondary lg', 'arrow-left')));
    screen.appendChild(el); el.querySelector('button').focus();
  };

  V.profile = function (storeId) {
    const s = st(); const d = today();
    const visits = s.visits.filter(v => v.store === storeId && v.status === 'DONE' && v.date < d).slice(-6);
    const recent = h('div', { class: 'v-card', style: { padding: '8px 0' } }, visits.slice().reverse().map(v => {
      const lines = FD.SKUS.flatMap(k => FD.storeOrders(s, storeId, k.code).filter(o => o.date === v.date && o.units > 0));
      return h('div', { class: 'list-row', style: { padding: '8px 14px', alignItems: 'flex-start' } }, h('span', { class: 'small', style: { width: '56px', flex: 'none', color: 'var(--ink-3)' } }, FD.fmt.date(v.date)),
        h('div', { class: 'row wrap grow', style: { gap: '4px' } }, v.collected ? FD.chip([I('wallet', 's14'), t('L_COLLECTED') + ' ' + FD.fmt.money0(v.collected)], 'good') : null, lines.length ? lines.map(l => FD.chip([FD.skuIcon(l.sku, 16), FD.nameOf(FD.sku(l.sku)) + ' ×' + FD.fmt.num(l.units)])) : v.collected ? null : h('span', { class: 'small muted' }, '—')));
    }));
    // phone: the summary stays visible; everything else is one section at a time, each header saying what is inside
    const key = 'vsr:prof:' + storeId, openId = L[key] || null, ownerN = FD.ownerThread(s, storeId).length;
    const photosN = s.photos.filter(p => p.store === storeId).length, checksN = FD.pgAssessments(s, storeId).filter(a => a.by !== 'SUP').length; // supervisor photos are not the salesman's checks
    const sec = (id, label, n, body) => h('section', { class: 'prof-sec' + (openId === id ? ' open' : '') },
      h('button', { type: 'button', class: 'prof-h', 'aria-expanded': String(openId === id), on: { click: () => { L[key] = openId === id ? null : id; FD.render(); } } },
        h('span', { class: 'grow' }, t(label)), n != null ? h('span', { class: 'pill-count' }, FD.fmt.num(n)) : null, I(openId === id ? 'chevron-up' : 'chevron-down', 's16')),
      openId === id ? h('div', { class: 'prof-b' }, body()) : null);
    return h('div', { class: 'stack s12', style: { marginTop: '14px' } },
      FD.sup.glance(storeId, true),
      h('div', { class: 'v-card prof-list' },
        sec('products', 'L_STORE_PRODUCTS', FD.storeSkuStats(s, storeId, d).length, () => V.skuStats(storeId)),
        sec('checks', 'SC_HISTORY', checksN, () => FD.scHistory(storeId)),
        sec('comp', 'CI_TITLE', FD.compIntel(s, storeId).brands.length, () => FD.compSection(storeId, { take: true })),
        sec('photos', 'L_PHOTOS', photosN, () => h('div', { class: 'stack s8' }, FD.btn(t('PG_TAKE_PHOTOS'), () => FD.pgCaptureSheet({ store: storeId }), 'secondary sm', 'camera'), FD.photoTimeline(storeId, 6))),
        ownerN ? sec('owner', 'L_OWNER_WA', ownerN, () => FD.sup.ownerChat(storeId, FD.render, true)) : null,
        sec('visits', 'L_LAST_8', visits.length, () => recent)),
      FD.btn(t('L_SUGGEST_FIX'), () => V.correctionSheet(storeId), 'ghost block', 'edit'));
  };

  // Shared shelf view (used by VSR profile and Supervisor store detail)
  FD.SHELF_ICON = { CARRIED: 'check', PENDING: 'clock', OPPORTUNITY: 'target', LAPSED: 'refresh', DECLINED: 'x', GATED: 'lock', RETURNED: 'undo', NONE: 'minus' };
  FD.shelfView = function (shelf, opts = {}) {
    const states = ['CARRIED', 'PENDING', 'OPPORTUNITY', 'LAPSED', 'DECLINED', 'GATED', 'RETURNED', 'NONE'];
    const key = 'shelf:filter:' + (opts.filterKey || 'default'), host = h('div', { class: 'shelf' });
    const groups = [...new Set(FD.SKUS.map(k => k.group))];
    const status = code => states.includes(shelf[code]) ? shelf[code] : 'NONE';
    const counts = Object.fromEntries(states.map(k => [k, FD.SKUS.filter(s => status(s.code) === k).length]));
    const draw = focus => {
      const selected = L[key] === undefined ? ['CARRIED'] : L[key];
      const visible = FD.SKUS.filter(k => selected === null || selected.includes(status(k.code)));
      const choose = k => {
        if (k === 'ALL') L[key] = null;
        else if (selected === null) L[key] = [k];
        else { const next = selected.includes(k) ? selected.filter(x => x !== k) : selected.concat(k); L[key] = next.length ? next : null; }
        draw(k);
      };
      const filter = k => h('button', { type: 'button', class: 'shelf-filter st-' + k,
        'data-status': k, 'aria-pressed': String(k === 'ALL' ? selected === null : selected !== null && selected.includes(k)),
        on: { click: () => choose(k) } },
        k === 'ALL' ? null : h('span', { class: 'sw st' + (['PENDING', 'GATED'].includes(k) ? ' hatch' : ''), 'aria-hidden': 'true' }),
        t(k === 'ALL' ? 'L_ALL' : 'SH_' + k), h('span', { class: 'shelf-filter-count' }, FD.fmt.num(k === 'ALL' ? FD.SKUS.length : counts[k])));
      host.replaceChildren(...[
        h('div', { class: 'legend shelf-filters', role: 'group', 'aria-label': t('L_ALL_STATES') }, ['ALL', ...states].map(filter)),
        h('div', { class: 'small muted shelf-result', role: 'status', 'aria-live': 'polite' }, t('L_SHELF_SHOWING', { n: FD.fmt.num(visible.length), m: FD.fmt.num(FD.SKUS.length) })),
        h('p', { class: 'small muted shelf-source' }, t('PG_HISTORY_SOURCE')),
        visible.length ? groups.map(g => {
          const products = visible.filter(k => k.group === g); if (!products.length) return null;
          return h('div', { class: 'shelf-grp' }, h('h4', null, t(g)), h('div', { class: 'tiles' }, products.map(k => {
            const state = status(k.code), blk = opts.blocked && opts.blocked[k.code];
            return h('button', { type: 'button', class: 'tile st-' + state + (blk ? ' is-blocked' : ''),
              'aria-label': FD.nameOf(k) + ', ' + t('SH_' + state) + (blk ? ', ' + t('L_BLOCKED') : ''),
              on: { click: e => opts.onTile ? opts.onTile(k.code, state, e) : null } },
              h('div', { class: 'nm' }, FD.skuIcon(k.code, 20), h('span', null, FD.nameOf(k))),
              h('div', { class: 'stt' }, I(FD.SHELF_ICON[state]), t('SH_' + state) + (state === 'GATED' && shelf.gates?.[k.code] && !blk ? ' · ' + t(shelf.gates[k.code]) : '')),
              blk ? h('div', { class: 'tile-blk' }, I('ban', 's14'), t('L_BLOCKED')) : null);
          })));
        }) : h('p', { class: 'small muted' }, t('L_SHELF_EMPTY'))].flat().filter(Boolean));
      if (focus) host.querySelector('[data-status="' + focus + '"]')?.focus?.();
    };
    draw(); return host;
  };

  // products at this store from SalesBuzz sell-in (R2-Q5): no shelf count
  V.skuStats = function (storeId) {
    const rows = FD.storeSkuStats(st(), storeId, today());
    if (!rows.length) return h('div', { class: 'v-card' }, FD.empty('X_FILTER'));
    return h('div', { class: 'v-card' }, rows.map(x => h('div', { class: 'list-row', style: { padding: '10px 12px' } }, h('div', { class: 'grow', style: { minWidth: 0 } }, FD.skuLabel(x.code, t('L_SKU_STATS', { date: FD.fmt.date(x.lastDate), qty: FD.fmt.num(x.lastQty), n: FD.fmt.num(x.units4w) }))),
      x.cover != null ? (x.cover <= 2 ? FD.chip(t('L_REORDER_DUE'), 'warn') : FD.chip(t('L_COVER_DAYS', { days: FD.fmt.num(x.cover) }))) : null)),
      h('div', { class: 'small muted', style: { padding: '10px 12px' } }, t('L_COVER_HELP')));
  };
  V.addPhotosBtn = function (storeId) {
    const file = h('input', { type: 'file', accept: 'image/*', multiple: true, capture: 'environment', hidden: true, on: { change: async e => {
      const out = []; for (const f of [...e.target.files].slice(0, 8)) { try { out.push(await FD.readPhoto(f)); } catch (err) { FD.toast('S_PHOTO_BIG'); } }
      if (out.length) { FD.dx('PHOTOS_ADD', { store: storeId, vsr: st().vsrId, photos: out }); FD.toast('S_SAVED'); } } } });
    return h('span', null, file, FD.btn(t('L_ADD_PHOTOS'), () => file.click(), 'secondary sm', 'camera'));
  };
  // shelf photos by visit date (shared with the supervisor store page)
  FD.photoTimeline = function (storeId, maxDays) {
    const s = st(); const ph = s.photos.filter(p => p.store === storeId).concat(s.recs.filter(r => r.store === storeId && r.photo).map(r => ({ id: r.id, date: (r.reasonAt || {}).date || r.date, src: r.photo })));
    if (!ph.length) return h('div', { class: 'v-card' }, FD.empty('X_PHOTOS', null, 'image'));
    const days = [...new Set(ph.map(p => p.date))].sort().reverse().slice(0, maxDays || 30);
    return h('div', { class: 'stack s8' }, days.map(d => h('div', null, h('div', { class: 'tl-day' }, FD.fmt.dateLong(d)),
      h('div', { class: 'photo-day' }, ph.filter(p => p.date === d).map(p => h('button', { type: 'button', 'aria-label': t('L_PHOTO'), on: { click: () => FD.lightbox(p.src) } }, h('img', { src: p.src, alt: '', loading: 'lazy' })))))));
  };
  V.correctionSheet = function (storeId) {
    let kind = null, value = null, comment = '';
    const store = storeOf(storeId);
    // the three kinds that fix a value offer the choices (the store's current one is left out); closed / moved need no value
    const CHOICES = { CORR_SIZE: [FD.SIZES, z => t('SIZE_' + z), store.size], CORR_SHELF: [SHELF_LEVELS, z => t('SHELFV_' + z), store.shelf], CORR_TAG: [FD.TAGS, z => t('TAGN_' + z.slice(4)), store.tags || []] }; // the salesman names what is nearby, in plain words
    const choice = (k, label) => h('button', { type: 'button', class: 'code-btn' + (value === k ? ' on' : ''), 'aria-pressed': String(value === k), on: { click: () => { value = k; FD.sheet.redraw(); } } }, h('span', { class: 'radio' }), label);
    FD.sheet.open({ title: t('L_SUGGEST_FIX'), render: () => h('div', { class: 'stack s8' },
      h('div', { class: 'code-list' }, ['CORR_SIZE', 'CORR_SHELF', 'CORR_TAG', 'CORR_CLOSED', 'CORR_MOVED'].map(c => h('button', { type: 'button', class: 'code-btn' + (kind === c ? ' on' : ''), on: { click: () => { if (kind !== c) value = null; kind = c; FD.sheet.redraw(); } } }, h('span', { class: 'radio' }), t(c)))),
      CHOICES[kind] ? h('div', { class: 'stack s8' }, h('div', { class: 'small muted' }, t('L_CORR_PICK')), h('div', { class: 'code-list' }, CHOICES[kind][0].filter(z => ![].concat(CHOICES[kind][2]).includes(z)).map(z => choice(z, CHOICES[kind][1](z))))) : null,
      (() => { const ta = h('textarea', { class: 'textarea', placeholder: t('L_ADD_COMMENT'), 'aria-label': t('L_ADD_COMMENT'), on: { input: e => { comment = e.target.value; } } }); ta.value = comment; return ta; })()),
      footer: () => [h('button', { type: 'button', class: 'btn primary lg block', disabled: !kind || (!!CHOICES[kind] && !value), on: { click: () => { FD.dx('CORRECTION_ADD', { vsr: st().vsrId, store: storeId, kind, value: CHOICES[kind] ? value : null, comment }); FD.sheet.close(); FD.toast('S_SENT', { supId: 'S1', vsr: FD.nameOf(st().world.supervisor) }); } } }, t('L_SEND'))] });
  };

  // ---------- TO-DO (seen on open; never a notification) ----------
  V.todoItems = function (vsrId) {
    const s = st(); const items = [];
    s.recs.filter(r => FD.recVsr(r) === vsrId && (r.outcome === 'NOT_SOLD' || r.outcome === 'NOT_OFFERED') && !r.reason && !r.exempted)
      .sort((a, b) => b.date.localeCompare(a.date)).forEach(r => items.push({ kind: 'reason', rec: r }));
    s.tips.filter(x => x.vsr === vsrId && x.status === 'SENT' && !x.read).forEach(x => items.push({ kind: 'tip', tip: x }));
    s.threads.filter(x => x.vsr === vsrId && x.unreadVsr).forEach(x => items.push({ kind: 'reply', thread: x }));
    s.corrections.filter(c => c.vsr === vsrId && c.status !== 'PENDING' && !c.seen).forEach(c => items.push({ kind: 'corr', corr: c }));
    const d = s.clock.date; const plan = FD.planFor(s, vsrId, d);
    const openStores = [...new Set(plan.recs.filter(r => r.outcome === 'NOT_SOLD' && FD.TEMP.includes(r.reason) && !r.revisitClosed).map(r => r.store))].filter(sid => !plan.stops.some(x => x.store === sid && x.status === 'PLANNED'));
    openStores.forEach(sid => items.push({ kind: 'revisit', store: sid, n: FD.openTemps(s, sid, d).length }));
    ((s.planogram || {}).requests || []).filter(r => r.status === 'OPEN' && (r.vsr === vsrId || plan.stops.some(x => x.store === r.store))).forEach(r => items.push({ kind: 'shelf', store: r.store, req: r }));
    plan.stops.filter(x => x.status !== 'DONE' && x.status !== 'SKIPPED').forEach(x => { const last = FD.pgAssessments(s, x.store).filter(a => a.by !== 'SUP')[0], sm = last && last.date < d && FD.scSummary(s, last.id);
      if (sm && sm.analysed && sm.findings.some(f => f.status === 'OPEN' || f.status === 'CANT_CHECK') && !items.some(i => i.kind === 'shelf' && i.store === x.store)) items.push({ kind: 'shelf', store: x.store, fix: sm.findings.filter(f => f.status === 'OPEN' || f.status === 'CANT_CHECK').length }); });
    // open fixes from earlier visits (the supervisor's shelf follow-ups), for his own stores
    (FD.pgFollowUps ? FD.pgFollowUps(s) : []).filter(f => f.slots.vsrId === vsrId || (storeOf(f.slots.storeId) || {}).vsr === vsrId).forEach(f => { const sid = f.slots.storeId, i = items.find(x => x.kind === 'shelf' && x.store === sid && !x.req);
      if (i) i.fix = Math.max(i.fix || 0, f.slots.n); else if (!items.some(x => x.kind === 'shelf' && x.store === sid)) items.push({ kind: 'shelf', store: sid, fix: f.slots.n }); });
    // products delivered to a store on today's route that are close to their end date
    plan.stops.filter(x => x.status !== 'DONE' && x.status !== 'SKIPPED').forEach(x => FD.expiryChecks(s, x.store, d).forEach(c => items.push({ kind: 'expiry', store: x.store, sku: c.sku, delivered: c.delivered, expires: c.expires })));
    if (plan.stops.length && !s.dayConfirmed[vsrId + '|' + d] && plan.stops.every(x => x.status === 'PLANNED')) items.unshift({ kind: 'review' });
    return items;
  };
  FD.registerView('vsr', 'todo', (r, vsr) => {
    const items = V.todoItems(vsr.id);
    // each section folds; the ones that need doing start open, messages and tips start closed
    const OPEN0 = { revisit: true, reason: true, shelf: true };
    const sec = (kind, label, render) => { const xs = items.filter(i => i.kind === kind); if (!xs.length) return null; const k = 'todo:' + kind, open = L[k] ?? !!OPEN0[kind];
      return h('section', { class: 'v-section' }, h('button', { type: 'button', class: 'todo-h', 'aria-expanded': String(open), on: { click: () => { L[k] = !open; FD.render(); } } },
        h('span', { class: 'grow' }, t(label)), h('span', { class: 'pill-count' }, FD.fmt.num(xs.length)), I(open ? 'chevron-up' : 'chevron-down', 's16')), open ? h('div', { class: 'v-card' }, xs.slice(0, 40).map(render)) : null); };
    const row = (icon, tone, title, sub, onClick, extra) => h('div', { class: 'list-row click', role: 'button', tabindex: '0', style: { padding: '12px 14px' }, on: { click: onClick, keydown: e => { if (e.key === 'Enter') onClick(); } } },
      h('span', { class: 'fu-ic ' + tone }, I(icon, 's16')), h('div', { class: 'grow' }, h('div', { style: { fontWeight: 500 } }, title), sub ? h('div', { class: 'small muted' }, sub) : null), extra || I('chevron-right', 's16'));
    const body = [];
    if (!items.length) body.push(h('div', { class: 'v-card', style: { marginTop: '12px' } }, FD.empty('X_TODO_DONE', null, 'check-circle')));
    if (items.some(i => i.kind === 'review')) body.push(h('div', { class: 'v-card', style: { marginTop: '8px' } }, row('list', '', t('T_REVIEW'), null, () => FD.go('#/vsr/' + vsr.id + '/today'))));
    body.push(sec('revisit', 'L_VISIT_AGAIN', i => row('repeat', 'p2', tx('T_REVISIT', { storeId: i.store, n: i.n }), null, () => V.revisitSheet(i.store))));
    // several offers missing a reason for the same outcome: one reason for all of them
    // limited to the unsold offers of one visit: the same store on the same day, never across stores or days
    const rsn = items.filter(i => i.kind === 'reason'), byOut = {}; rsn.forEach(i => (byOut[i.rec.outcome + '|' + i.rec.store + '|' + i.rec.date] = byOut[i.rec.outcome + '|' + i.rec.store + '|' + i.rec.date] || []).push(i.rec.id));
    const big = Object.entries(byOut).sort((a, b) => b[1].length - a[1].length)[0];
    if (big && big[1].length >= 2 && (L['todo:reason'] ?? true)) body.push(h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '8px' } }, FD.btn(tx('L_SAME_REASON', { n: FD.fmt.num(big[1].length) }), () => V.reasonSheet(big[1], big[0].split('|')[0]), 'secondary sm', 'check')));
    body.push(sec('reason', 'L_TODO_REASONS', i => row('alert', 'p2', tx('T_REASON', { skuCode: i.rec.sku, storeId: i.rec.store }), FD.fmt.date(i.rec.date) + ' · ' + t(i.rec.outcome === 'NOT_SOLD' ? 'E_NOT_SOLD' : 'E_NOT_OFFERED'),
      () => V.reasonSheet(i.rec.id, i.rec.outcome))));
    body.push(sec('shelf', 'SC_TODO_H', i => row('camera', i.req ? 'p2' : '', t(i.req ? 'SC_TODO_REQ' : 'SC_TODO_FIX', { store: FD.nameOf(storeOf(i.store)) }), i.req ? t('SC_REQ_VSR') : t('SC_OPEN') + ' · ' + FD.fmt.num(i.fix), () => FD.go('#/vsr/' + vsr.id + '/store/' + i.store))));
    body.push(sec('expiry', 'L_TODO_EXPIRY', i => row('calendar', 'p2', tx('T_EXPIRY', { skuCode: i.sku, date: i.delivered }), FD.nameOf(storeOf(i.store)), () => FD.go('#/vsr/' + vsr.id + '/store/' + i.store))));
    body.push(sec('tip', 'L_TODO_TIPS', i => row('bulb', '', tx('T_TIP', { tip_title: tx(i.tip.tpl + '_T', i.tip.slots) }), null, () => V.tipSheet(i.tip.id))));
    body.push(sec('reply', 'L_TODO_REPLIES', i => {
      const m = i.thread.messages[i.thread.messages.length - 1];
      return row('message', '', m.sku ? tx('T_REPLY', { supId: 'S1', skuCode: m.sku }) : m.store ? tx('T_REPLY_STORE', { supId: 'S1', storeId: m.store }) : tx('N_MSG', { supId: 'S1', snippet: '' }), h('bdi', null, (m.text || '').slice(0, 60)), () => FD.chatOpen(i.thread.anchor, 'VSR'));
    }));
    body.push(sec('corr', 'L_TODO_CORR', i => row(i.corr.status === 'ACCEPTED' ? 'check-circle' : 'x-circle', '', tx('T_CORRECTION', { storeId: i.corr.store, statusId: i.corr.status === 'ACCEPTED' ? 'ST_ACCEPTED' : 'ST_REJECTED' }), t(i.corr.kind),
      () => FD.dx('CORRECTION_SEEN', { id: i.corr.id }), h('button', { type: 'button', class: 'btn ghost sm', on: { click: e => { e.stopPropagation(); FD.dx('CORRECTION_SEEN', { id: i.corr.id }); } } }, t('L_DONE')))));
    return { title: t('L_TAB_TODO'), body };
  });

  // ---------- MESSAGES (standalone chat, R2-Q2) ----------
  FD.registerView('vsr', 'msgs', (r, vsr) => {
    const s = st();
    if (r.id) { const a = FD.chatAnchor(r.id);
      if (a && a.type === 'wa' && storeOf(a.id)) { if (FD.ownerUnread(s, a.id, vsr.id)) setTimeout(() => FD.dx('OWNER_READ', { store: a.id, who: vsr.id }));
        // full-screen thread like the supervisor's: messages scroll, the composer stays at the bottom
        return { title: FD.nameOf(storeOf(a.id)), back: () => FD.go('#/vsr/' + vsr.id + '/msgs'), chat: true, body: [h('div', { class: 'chat-pane wa-pane' }, FD.sup.ownerHead(a.id, vsr.id), FD.sup.ownerChat(a.id, () => FD.render(), false, vsr.id))] }; }
      if (a) return { title: FD.chatTitle(a, 'VSR'), sub: FD.chatSub(a, 'VSR'), back: () => FD.go('#/vsr/' + vsr.id + '/msgs'), chat: true,
      tools: h('span', { class: 'row', style: { gap: '2px' } }, FD.iconBtn('search', t('L_SEARCH_CHAT'), () => FD.chatSearchToggle(a))), body: [FD.chatView(a, 'VSR', { mode: 'full', header: false, vsr: vsr.id })] }; }
    const team = s.threads.find(x => x.team); const general = s.threads.find(x => x.anchor.type === 'vsr' && x.anchor.id === vsr.id);
    const row = (anchor, th) => { const last = th && th.messages[th.messages.length - 1]; const un = FD.chatUnreadN(th, 'VSR', vsr.id);
      return h('button', { type: 'button', class: 'list-row click chat-li', on: { click: () => FD.chatOpen(anchor, 'VSR') } },
        h('span', { class: 'chat-av' }, I(FD.chatIcon(anchor), 's16')), h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'ellipsis', style: { fontWeight: un ? 600 : 500 } }, FD.chatTitle(anchor, 'VSR')),
          h('div', { class: 'small muted ellipsis', dir: 'auto' }, last ? FD.chatSnippet(last, 'VSR', vsr.id) : FD.chatSub(anchor, 'VSR'))),
        h('div', { class: 'chat-li-end' }, last ? h('span', { class: 'small muted' }, last.at.date === today() ? FD.fmt.time(last.at.time) : FD.fmt.date(last.at.date)) : null, FD.unreadN(un))); };
    const waRow = id => { const ms = FD.ownerThread(s, id), m = ms[ms.length - 1], un = FD.ownerUnreadN(s, id, vsr.id);
      return h('button', { type: 'button', class: 'list-row click chat-li', on: { click: () => FD.chatOpen({ type: 'wa', id }, 'VSR') } }, h('span', { class: 'chat-av wa' }, FD.waLogo('s20')),
        h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'ellipsis', style: { fontWeight: un ? 600 : 500 } }, FD.nameOf(storeOf(id))), h('div', { class: 'small muted ellipsis', dir: 'auto' }, !m ? (FD.lang === 'ar' ? FD.HOOD_AR[storeOf(id).hood] : storeOf(id).hood) : m.kind === 'CARD' ? t('W_CARD_' + m.card) : FD.txtOf(m.text) || t('L_PREORDER'))),
        h('div', { class: 'chat-li-end' }, FD.unreadN(un))); };
    // search: store chats by store name or message text; with a search, his stores with no chat yet show too so he can start one
    const q = (L['vsr:msgq'] || '').trim().toLowerCase(), hit = id => { const x = storeOf(id); return (x.name + ' ' + (x.name_ar || '') + ' ' + FD.ownerThread(s, id).map(m => FD.txtOf(m.text) || '').join(' ')).toLowerCase().includes(q); };
    const withChat = new Set((s.ownerMsgs || []).map(m => m.store));
    const mine = (q ? s.world.stores.filter(x => x.vsr === vsr.id).map(x => x.id) : [...withChat]).filter(id => { const x = storeOf(id); return x && x.vsr === vsr.id && (!q || hit(id)); })
      .sort((a, b) => FD.waLastAt(s, b).localeCompare(FD.waLastAt(s, a)));
    return { title: t('L_MESSAGES'), body: [h('div', { style: { padding: '8px 0 0' } }, FD.searchBox('vsrMsgs', t('L_SEARCH_CHATS'), L['vsr:msgq'] || '', v => { L['vsr:msgq'] = v; FD.render(); })),
      h('section', { class: 'v-section' }, h('div', { class: 'v-card' }, row({ type: 'vsr', id: vsr.id }, general), row({ type: 'team', id: 'ALL' }, team))),
      mine.length ? h('section', { class: 'v-section' }, h('h3', { class: 'row', style: { gap: '6px' } }, FD.waLogo('s16'), t('L_F_STORES')), h('div', { class: 'v-card' }, mine.slice(0, 30).map(waRow))) : q ? h('div', { class: 'v-card' }, FD.empty('X_FILTER')) : null,
      h('div', { class: 'small muted', style: { padding: '0 4px' } }, t('L_TAG_NOTE'))] };
  });

  // ---------- ME: summary cards that open KPIs, results, upsells, tips and settings ----------
  // Data is next-day (02:00 load), so results open on the last selling day, never "today".
  const KPI_TONE = { DONE: 'good', ON_TRACK: 'info', AT_RISK: 'bad' };
  const KPI_STATUS = { DONE: 'KPI_MET', ON_TRACK: 'KPI_ON_TRACK', AT_RISK: 'KPI_BEHIND' };
  const KPI_KEYS = ['cake', 'grocery', 'active', 'collect'];
  const m0 = n => FD.fmt.money0(n);
  const bar = (done, goal, tone) => h('div', { class: 'progress pay-bar' }, h('i', { class: tone, style: { width: Math.min(100, goal ? 100 * done / goal : 0) + '%' } }));
  const vsTarget = (v, goal) => v >= goal ? h('span', { class: 'delta up' }, tx('ME_ABOVE', { money: m0(v - goal) })) : h('span', { class: 'delta down' }, tx('ME_BELOW', { money: m0(goal - v) }));
  const meGo = (vsr, sub) => () => FD.go('#/vsr/' + vsr.id + '/me' + (sub ? '/' + sub : ''));
  const sub = (vsr, title, subtitle, body) => ({ title, sub: subtitle, back: meGo(vsr), body });
  V.mePeriod = () => {
    const y = FD.prevSellingDay(today()), k = L['vsr:mePeriod'] || 'YDAY';
    if (k === 'WEEK') return { k, from: FD.addDays(y, -6), to: y };
    if (k === 'MONTH') return { k, from: y.slice(0, 8) + '01', to: y };
    if (/^\d{4}-\d\d-\d\d$/.test(k) && k >= FD.HIST_START && k < today()) return { k: 'DAY', from: k, to: k };
    return { k: 'YDAY', from: y, to: y };
  };
  // one switch: Yesterday / 7 days / This month / a picked day (the native date picker opens from the fourth option)
  const periodSwitch = per => { const pick = per.k === 'DAY';
    const set = v => { L['vsr:mePeriod'] = v; FD.render(); };
    const btn = (id, label) => h('button', { type: 'button', class: per.k === id ? 'on' : '', 'aria-pressed': String(per.k === id), on: { click: () => per.k !== id && set(id) } }, label);
    return h('div', { class: 'me-period' }, h('div', { class: 'seg me-seg', role: 'group', 'aria-label': t('ME_RESULTS') },
      btn('YDAY', t('ME_YDAY')), btn('WEEK', t('ME_WEEK')), btn('MONTH', t('ME_MONTH')),
      h('button', { type: 'button', class: 'me-pick' + (pick ? ' on' : ''), 'aria-label': t('ME_PICK'), on: { click: () => FD.datePick({ title: t('ME_PICK'), value: pick ? per.from : null, min: FD.HIST_START, max: FD.addDays(today(), -1), onPick: set }) } },
        I('calendar', 's16'), h('span', null, pick ? FD.fmt.date(per.from) : t('ME_DAY'))))); };
  const periodLabel = per => per.from === per.to ? FD.fmt.dateLong(per.from) : FD.fmt.date(per.from) + ' - ' + FD.fmt.date(per.to);
  const tipHead = x => x.k === 'CAKE' ? tx('KPI_TIP_CAKE', { money: m0(x.money) }) : tx('KPI_TIP_' + x.k, { n: x.n });
  const TIP_KPI = { UNVISITED: 'active', NOBUY: 'active', GROCERY: 'grocery', CAKE: 'cake', RANGE: 'cake', COLLECT: 'collect' };
  V.kpiStores = (vsr, tip) => FD.sheet.open({ title: tipHead(tip), render: () => h('div', { class: 'v-card' }, tip.stores.map(id => { const x = storeOf(id);
    return h('button', { type: 'button', class: 'list-row click', style: { width: '100%', textAlign: 'start' }, on: { click: () => { FD.sheet.close(); FD.go('#/vsr/' + vsr.id + '/store/' + id); } } },
      h('div', { class: 'grow' }, h('div', { style: { fontWeight: 500 } }, FD.nameOf(x)), h('div', { class: 'small muted' }, tip.k === 'COLLECT' ? m0(x.overdue) : x.hood)), I('chevron-right', 's16')); })) });
  // four tracks, each filled by progress toward its KPI (not by bonus earned)
  const kpiTracks = P => h('div', { class: 'pay-segs' }, KPI_KEYS.map(k => { const pr = Math.round(100 * FD.kpiProgress(P[k]));
    return h('div', { class: 'pay-seg ' + KPI_TONE[P[k].status], 'aria-label': t('KPI_SHORT_' + k.toUpperCase()) + ' ' + FD.fmt.pct(pr) + ', ' + t(KPI_STATUS[P[k].status]) },
      h('div', { class: 'pay-seg-track' }, h('i', { style: { width: pr + '%' } })), h('div', { class: 'pay-seg-l' }, t('KPI_SHORT_' + k.toUpperCase()))); }));
  const onTrack = P => KPI_KEYS.filter(k => P[k].status !== 'AT_RISK').length;

  // landing
  FD.registerView('vsr', 'me', (r, vsr) => {
    const s = st(); const p = FD.kpiStatus(s, vsr.id, today()), P = p.parts;
    if (r.id === 'kpi') return V.meKpi(vsr, p);
    if (r.id === 'results') return V.meResults(vsr);
    if (r.id === 'upsells') return V.meUpsells(vsr);
    if (r.id === 'settings') return V.meSettings(vsr);
    const y = FD.prevSellingDay(today()), ys = FD.periodSales(s, vsr.id, y, y), ym = FD.vsrMetrics(s, vsr.id, y, y);
    const monthSold = s.recs.filter(x => x.vsr === vsr.id && SOLD.includes(x.outcome) && x.date >= today().slice(0, 8) + '01' && x.date < today());
    const month = monthSold.filter(FD.isUpsell), re = V.reorderTotals(monthSold); // reorders are not upsells: a line of their own
    const top = p.tips[0];
    const card = (cls, go, ...kids) => h('button', { type: 'button', class: 'v-card me-card ' + cls, on: { click: go } }, ...kids);
    const cardHead = label => h('div', { class: 'row between me-card-h' }, h('span', null, label), I('chevron-right', 's16'));
    // each count opens this month's upsells already filtered to it
    const openUps = filt => () => { L['vsr:mePeriod'] = 'MONTH'; L['vsr:upsFilter'] = filt; meGo(vsr, 'upsells')(); };
    const stat = (n, label, tone, filt) => h('button', { type: 'button', class: 'me-stat', on: { click: openUps(filt) } }, h('b', { class: 'tabular' + (tone ? ' ' + tone : '') }, FD.fmt.num(n)), h('span', null, t(label)));
    const body = [
      card('pay-hero', meGo(vsr, 'kpi'), cardHead(t('ME_KPI_CARD')),
        h('div', { class: 'pay-hero-n' }, tx('ME_KPI_ON_TRACK', { n: onTrack(P) })),
        h('div', { class: 'small' }, tx('ME_DAYS_LEFT', { n: p.daysLeft })),
        kpiTracks(P),
        h('div', { class: 'me-bonus small' }, tx('ME_BONUS_EXPECTED', { money: m0(p.likely), total: m0(p.pot) })),
        top ? h('div', { class: 'me-next' }, h('b', null, tx('ME_NEXT', { tip: tipHead(top) })), p.tips.length > 1 ? h('span', { class: 'small' }, tx('ME_MORE_TODO', { n: p.tips.length - 1 })) : null) : null),
      card('me-sales', () => { L['vsr:mePeriod'] = 'YDAY'; meGo(vsr, 'results')(); }, cardHead(tx('ME_YDAY_CARD', { date: y })),
        h('div', { class: 'row between' }, h('span', { class: 'pay-big tabular' }, m0(ys.sales)), ys.target ? vsTarget(ys.sales, ys.target) : null),
        ys.target ? bar(ys.sales, ys.target, ys.sales >= ys.target ? 'good' : 'bad') : null,
        h('div', { class: 'small muted' }, tx('ME_STORES_BOUGHT', { done: FD.fmt.num(ym.productive), need: FD.fmt.num(ym.genuine) }))),
      h('div', { class: 'v-card me-card me-ups' },
        h('button', { type: 'button', class: 'me-ups-h', on: { click: openUps('ALL') } }, cardHead(t('ME_UPS_CARD'))),
        h('div', { class: 'me-stats' }, stat(month.length, 'ME_UPS_SOLD', '', 'ALL'), stat(month.filter(x => x.maturity === 'SUSTAINED').length, 'ME_UPS_REORDERED', '', 'SUSTAINED'), stat(month.filter(x => x.maturity === 'RETURNED').length, 'ME_UPS_RETURNED', 'bad-ink', 'RETURNED')),
        h('div', { class: 'small muted me-reorders', style: { padding: '0 14px 12px' } }, V.reorderLine(re))),
    ];
    return { title: FD.nameOf(vsr), sub: tx('ME_UPDATED', { date: FD.addDays(today(), -1) }), tools: FD.iconBtn('settings', t('L_SETTINGS'), meGo(vsr, 'settings')), body };
  });

  // KPIs: each condition, its bonus, then what to do next
  V.meKpi = (vsr, p) => {
    const P = p.parts;
    const kpi = (k, line, side, done, goal) => h('div', { class: 'pay-part' },
      h('div', { class: 'row between' }, h('b', null, t('KPI_' + k.toUpperCase())), FD.chip(t(KPI_STATUS[P[k].status]), KPI_TONE[P[k].status])),
      bar(done, goal, KPI_TONE[P[k].status]),
      h('div', { class: 'row between small' }, h('span', null, line), side ? h('span', { class: 'muted' }, side) : null),
      h('div', { class: 'small muted' }, P[k].pay != null ? tx('KPI_BONUS_PACE', { money: m0(P[k].pay), pct: Math.round(P[k].projAch) })
        : [tx('KPI_BONUS_WHEN_MET', { money: m0(FD.BONUS[k]) }), k === 'collect' ? ' · ' + t('KPI_OVERDUE_CLOSE') : '']));
    const sales = k => kpi(k, tx('KPI_SALES_LINE', { done: m0(P[k].done), target: m0(P[k].goal) }), P[k].status === 'DONE' ? null : tx('KPI_SELL_DAY', { money: m0(P[k].needDay) }), P[k].done, P[k].goal);
    const tipRow = x => {
      const go = x.k === 'CAKE' ? () => FD.go('#/vsr/' + vsr.id + '/today') : () => V.kpiStores(vsr, x); // cake is sold through today's offers
      return h('button', { type: 'button', class: 'list-row click', style: { width: '100%', textAlign: 'start', alignItems: 'flex-start' }, on: { click: go } },
        h('span', { class: 'fu-ic' }, I(x.k === 'COLLECT' ? 'wallet' : ['CAKE', 'GROCERY', 'RANGE'].includes(x.k) ? 'package' : 'map-pin', 's16')),
        h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, tipHead(x)), x.k === 'CAKE' && x.n ? h('div', { class: 'small muted' }, tx('KPI_TIP_CAKE_B', { n: x.n })) : null,
          h('div', { class: 'small', style: { marginTop: '2px', color: x.risk ? 'var(--bad)' : 'var(--ink-2)' } }, tx('KPI_FOR', { kpi: t('KPI_' + TIP_KPI[x.k].toUpperCase()), money: m0(x.stake) }))),
        I('chevron-right', 's16'));
    };
    return sub(vsr, t('ME_KPI_CARD'), tx('ME_DAYS_LEFT', { n: p.daysLeft }), [
      h('div', { class: 'v-card pay-hero', style: { marginTop: '4px' } },
        h('div', { class: 'pay-hero-n' }, tx('ME_KPI_ON_TRACK', { n: onTrack(P) })), kpiTracks(P),
        h('div', { class: 'me-bonus small' }, tx('ME_BONUS_EXPECTED', { money: m0(p.likely), total: m0(p.pot) }))),
      h('div', { class: 'v-card', style: { marginTop: '10px' } }, sales('cake'), sales('grocery'),
        kpi('active', tx('KPI_ACTIVE_LINE', { done: FD.fmt.num(P.active.done), need: FD.fmt.num(P.active.need) }), P.active.status === 'DONE' ? null : tx('KPI_ACTIVE_LEFT', { n: P.active.need - P.active.done }), P.active.done, P.active.need),
        kpi('collect', tx('KPI_OVERDUE', { money: m0(P.collect.overdue) }), tx('KPI_LIMIT', { money: m0(P.collect.limit) }), FD.kpiProgress(P.collect), 1)), // bar = progress, like the other KPIs
      // leading indicator: range per store, before recommendations -> last 4 weeks
      (() => { const r = FD.vsrRange(st(), vsr.id, today()); return r.now == null ? null : h('div', { class: 'v-card', style: { marginTop: '10px' } }, h('div', { class: 'pay-part' },
        h('div', { class: 'row between' }, h('b', null, t('KPI_RANGE')), h('b', { class: 'tabular' }, FD.fmt.num(r.before, 1) + (FD.lang === 'ar' ? ' ← ' : ' → ') + FD.fmt.num(r.now, 1))),
        h('div', { class: 'small muted' }, t('KPI_RANGE_SUB')))); })(),
      h('section', { class: 'v-section' }, h('h3', null, t('KPI_NEXT')), h('div', { class: 'v-card' }, p.tips.length ? p.tips.slice(0, 5).map(tipRow)
        : h('div', { class: 'tipbox', style: { margin: '14px' } }, I('bulb', 's16'), h('span', null, tx('KPI_TIP_KEEP', { money: m0(p.yesterday.target) }))))),
    ]);
  };

  // results for a chosen period: sales vs target and the pilot scorecard in simple numbers
  V.meResults = vsr => {
    const s = st(), per = V.mePeriod(), ps = FD.periodSales(s, vsr.id, per.from, per.to), m = FD.vsrMetrics(s, vsr.id, per.from, per.to);
    const sees = Object.assign({ rank: true }, s.rules.vsrSees || {}), off = s.rules.metricsOff || {};
    const show = k => sees[k] !== false && !off[k];
    const base = m.hasBaseline ? m.base : null, gross = m.net + m.goodReturns;
    // change against his own level before the pilot; returns: less is better
    const diff = (d, money, lessIsGood) => { if (d == null) return null; const r = money ? Math.round(d) : Math.round(d * 10) / 10;
      if (!r) return h('span', { class: 'small muted' }, t('ME_SAME'));
      const good = lessIsGood ? r < 0 : r > 0, key = (r > 0 ? 'ME_MORE_' : money ? 'ME_LESS_' : 'ME_LESS_') + (money ? 'MONEY' : 'N');
      return h('span', { class: 'small ' + (good ? 'up-ink' : 'bad-ink') }, tx(key, money ? { money: m0(Math.abs(r)) } : { n: Math.abs(r) })); };
    const row = (label, value, d) => h('div', { class: 'me-k' }, h('span', null, t(label)), h('b', { class: 'tabular' }, value), d);
    const drift = k => !m.base[k] ? null : (k === 'returns' ? -1 : 1) * (m.lev[k] - m.base[k]) / m.base[k];
    const weakest = ['visits', 'withSale', 'avgSale', 'returns'].filter(k => show(k) && drift(k) != null).sort((a, b2) => drift(a) - drift(b2))[0] || 'avgSale';
    const cue = { visits: ['Q_CUE_VISITS', {}], withSale: ['Q_CUE_PVR', {}], avgSale: ['Q_CUE_DROP', {}], returns: ['Q_CUE_XSELL', { unit: unitText(FD.SKUS[0].code, 1) }] }[weakest];
    return sub(vsr, t('ME_RESULTS'), tx('ME_UPDATED', { date: FD.addDays(today(), -1) }), [
      periodSwitch(per),
      h('div', { class: 'v-card me-sales' },
        h('div', { class: 'small muted' }, periodLabel(per)),
        h('div', { class: 'row between' }, h('span', { class: 'pay-big tabular' }, m0(ps.sales)), ps.target ? vsTarget(ps.sales, ps.target) : null),
        ps.target ? bar(ps.sales, ps.target, ps.sales >= ps.target ? 'good' : 'bad') : null,
        h('div', { class: 'small muted' }, !ps.days ? t('ME_NO_SELLING') : tx(ps.days === 1 ? 'ME_DAY_TARGET' : 'ME_TARGET', { money: m0(ps.target) }))),
      m.days ? h('div', { class: 'v-card', style: { marginTop: '10px' } },
        row('ME_K_SALES', m0(m.lev.primary || 0), base && diff((m.lev.primary || 0) - (base.primary || 0), true)),
        show('visits') ? row('ME_K_VISITS', FD.fmt.num(m.lev.visits, Number.isInteger(Math.round(m.lev.visits * 10) / 10) ? 0 : 1), base && diff(m.lev.visits - base.visits, false)) : null,
        show('withSale') ? row('ME_K_BOUGHT', tx('KPI_SALES_LINE', { done: FD.fmt.num(m.productive), target: FD.fmt.num(m.genuine) }), base && diff(m.productive - base.withSale / 100 * m.genuine, false)) : null,
        show('avgSale') ? row('ME_K_AVG', m0(m.lev.avgSale), base && diff(m.lev.avgSale - base.avgSale, true)) : null,
        show('returns') ? row('ME_K_RETURNS', m0(m.returnsValue), base && diff(m.returnsValue - base.returns / 100 * gross, true, true)) : null,
        h('div', { class: 'tipbox', style: { margin: '4px 14px 14px' } }, I('bulb', 's16'), h('span', null, tx(cue[0], cue[1])))) : null,
    ]);
  };

  // upsells sold in a chosen period, filtered by what happened next
  V.reorderTotals = recs => { const rs = recs.filter(x => x.type === 'LAPSED' && SOLD.includes(x.outcome)); return { n: rs.length, value: rs.reduce((a, x) => a + (x.got || 0) * FD.sku(x.alt || x.sku).cost, 0) }; };
  V.reorderLine = re => t('ME_REORDERS_SOLD') + ': ' + FD.fmt.num(re.n) + ' · ' + m0(re.value);
  V.meUpsells = vsr => {
    const s = st(), per = V.mePeriod(), filt = L['vsr:upsFilter'] || 'ALL';
    const inPeriod = s.recs.filter(x => x.vsr === vsr.id && SOLD.includes(x.outcome) && x.date >= per.from && x.date <= per.to).sort((a, b2) => b2.date.localeCompare(a.date));
    const sold = inPeriod.filter(FD.isUpsell), re = V.reorderTotals(inPeriod); // plain reorders are reported on their own line
    const ups = sold.filter(x => filt === 'ALL' || x.maturity === filt);
    const tile = (id, label, n) => h('button', { type: 'button', class: 'ups-tile' + (filt === id ? ' on' : ''), 'aria-pressed': String(filt === id), on: { click: () => { L['vsr:upsFilter'] = filt === id ? 'ALL' : id; FD.render(); } } },
      h('b', { class: 'tabular' }, FD.fmt.num(n)), h('span', null, t(label)));
    const count = mt => sold.filter(x => x.maturity === mt).length;
    return sub(vsr, t('ME_UPS_TITLE'), periodLabel(per), [
      periodSwitch(per),
      // four states (tap the active one again to see all): Waiting, Reordered, Not reordered, Returned
      h('div', { class: 'ups-tiles' }, tile('PENDING', 'ME_UPS_WAITING', count('PENDING')), tile('SUSTAINED', 'ME_UPS_REORDERED', count('SUSTAINED')), tile('NOT_REORDERED', 'NOT_REORDERED', count('NOT_REORDERED')), tile('RETURNED', 'ME_UPS_RETURNED', count('RETURNED'))),
      h('div', { class: 'small muted', style: { padding: '8px 4px 0' } }, [t('ME_UPS_SOLD') + ': ' + FD.fmt.num(sold.length), t('ME_UPS_VALUE') + ': ' + m0(sold.reduce((a, x) => a + FD.upsellValue(x), 0)), V.reorderLine(re)].join(' · ')),
      ups.length ? h('div', { class: 'v-card', style: { marginTop: '8px' } }, ups.slice(0, 40).map(x => { const wait = x.maturity === 'PENDING';
        const line = [FD.nameOf(storeOf(x.store)), FD.fmt.date(x.date), wait ? tx('ME_UPS_DAYS_LEFT', { n: Math.max(0, FD.catWindow(x.alt || x.sku) - FD.daysBetween(x.soldOn || x.date, today())) }) : null,
          x.type === 'LAPSED' && x.extra > 0 ? tx('ME_UPS_ABOVE', { n: x.extra }) : null, m0(FD.upsellValue(x))].filter(Boolean).join(' · ');
        return h('div', { class: 'list-row', style: { padding: '10px 14px' } }, h('div', { class: 'grow', style: { minWidth: 0 } }, FD.skuLabel(x.alt || x.sku, line)),
          FD.chip(t(wait ? 'ME_UPS_WAITING' : x.maturity === 'RETURNED' ? 'ME_UPS_RETURNED' : x.maturity === 'NOT_REORDERED' ? 'NOT_REORDERED' : 'ME_UPS_REORDERED'), x.maturity === 'RETURNED' ? 'bad' : x.maturity === 'NOT_REORDERED' ? 'warn' : wait ? 'info' : 'good')); }))
        : h('div', { class: 'v-card', style: { marginTop: '8px' } }, FD.empty(sold.length ? 'X_FILTER' : 'ME_UPS_EMPTY')),
    ]);
  };

  V.meSettings = vsr => { const s = st();
    const setRow = (label, ctl) => h('div', { class: 'metric-row', style: { gridTemplateColumns: '1fr auto' } }, h('span', null, t(label)), ctl);
    return sub(vsr, t('L_SETTINGS'), null, [h('div', { class: 'v-card', style: { marginTop: '4px' } },
      setRow('L_LANGUAGE', FD.seg([{ id: 'en', label: 'English' }, { id: 'ar', label: 'العربية' }], s.lang, v => FD.dx('SET_LANG', { lang: v }))),
      s.lang === 'ar' ? setRow('L_DIGITS', FD.seg([{ id: 'arab', label: t('L_DIGITS_AR') }, { id: 'latn', label: t('L_DIGITS_LAT') }], s.digits, v => FD.dx('SET_DIGITS', { digits: v }))) : null,
      setRow('L_TEXT_SIZE', FD.seg([{ id: 'normal', label: t('L_NORMAL') }, { id: 'large', label: t('L_LARGE') }], s.textSize, v => FD.dx('SET_TEXT_SIZE', { size: v }))),
      setRow('L_THEME', FD.seg([{ id: 'auto', label: t('L_AUTO') }, { id: 'light', label: t('L_LIGHT') }, { id: 'dark', label: t('L_DARK') }], s.theme, v => FD.dx('SET_THEME', { theme: v }))),
      h('div', { class: 'metric-row', style: { gridTemplateColumns: '1fr' } }, FD.btn(t('L_HELP'), () => V.help(), 'secondary', 'help')),
      h('div', { style: { padding: '8px 14px 14px' } }, FD.btn(t('L_LOG_OUT'), () => FD.signOut(), 'ghost block', 'arrow-left')))]); };
  V.help = () => FD.sheet.open({ title: t('L_HELP'), render: () => h('div', { class: 'stack s16' },
    h('div', { class: 'stack s8' }, ['O_V1', 'O_V2', 'O_V3'].map((k, i) => h('div', { class: 'row', style: { alignItems: 'flex-start' } }, h('span', { class: 'seq' }, FD.fmt.num(i + 1)), h('span', null, t(k))))),
    h('div', null, h('b', null, t('L_R_CODES')), h('div', { class: 'stack s8', style: { marginTop: '8px' } }, Object.keys(FD.REASON_GROUPS).map(g => [g, FD.reasonPick(g)]).filter(([, cs]) => cs.length).map(([g, codes]) => h('div', { class: 'row', style: { alignItems: 'flex-start' } }, I(GROUP_ICON[g]),
      h('div', null, h('div', { style: { fontWeight: 500 } }, t(g)), h('div', { class: 'small muted' }, codes.map(c => t(c)).join(' · ')))))))) });
})();
