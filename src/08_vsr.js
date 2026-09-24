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

  // ---------- phone shell ----------
  V.shell = function (r, viewFn) {
    const s = st(); const vsr = vsrOf(r.vsr);
    const view = viewFn(r, vsr);
    const unread = s.notifs.filter(n => n.vsr === vsr.id && !n.read).length;
    const todo = V.todoItems(vsr.id).length;
    const tabs = [['today', 'route', 'L_TAB_TODAY'], ['store', 'store', 'L_TAB_STORE'], ['msgs', 'message', 'L_MESSAGES'], ['todo', 'check-circle', 'L_TAB_TODO'], ['me', 'user', 'L_TAB_ME']];
    const unreadMsgs = s.threads.filter(x => (x.vsr === vsr.id && x.unreadVsr) || (x.team && (x.unreadVsrs || {})[vsr.id])).length;
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
  V.statusChip = v => {
    const m = { PLANNED: ['L_STATUS_PLANNED', ''], ARRIVED: ['L_STATUS_ARRIVED', 'info'], DONE: ['L_STATUS_DONE', 'good'], SKIPPED: ['L_STATUS_SKIPPED', ''] }[v.status] || ['L_STATUS_PLANNED', ''];
    return FD.chip(t(v.moved && v.status === 'PLANNED' ? 'L_STATUS_MOVED' : m[0]), m[1]);
  };
  V.promoEarn = (rec, sku, qty) => {
    const p = rec.promo && st().world.promos.find(x => x.id === rec.promo) || FD.activePromo(st(), rec.sku, today());
    if (!p) return null;
    const base = qty * (sku.retail - sku.cost);
    if (p.promoId === 'PROMO_CB_51') return base + Math.floor(qty / 5) * sku.retail;
    if (p.promoId === 'PROMO_BC_1OFF') return base + qty * 1;
    if (p.promoId === 'PROMO_SR_10') return base + qty * sku.cost * 0.1;
    return base;
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
            h('div', { class: 'row wrap' }, ['BR_LUSINE', 'BR_7DAYS', 'BR_SABAHOO', 'BR_OTHER'].map(b => h('button', { type: 'button', class: 'chip lg chip-btn' + (S.brand === b ? ' on' : ''), 'aria-pressed': S.brand === b ? 'true' : 'false', on: { click: () => { S.brand = b; FD.sheet.redraw(); } } }, t(b))))) : null);
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
      footer: () => [FD.btn(t('L_DONE'), () => FD.sheet.close(), 'primary lg block')] });
  };

  V.inbox = function (vsrId) {
    const list = () => {
      const ns = st().notifs.filter(n => n.vsr === vsrId).slice().reverse();
      if (!ns.length) return FD.empty('X_INBOX', null, 'bell');
      return h('div', { class: 'v-card' }, ns.slice(0, 60).map(n => { const { title, body } = FD.notifText(n);
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
        h('div', { class: 'row between', style: { marginBottom: '6px' } }, h('b', { style: { fontSize: '14px' } }, t('L_VAN_CHECK')), FD.chip(t('L_VAN_FEED_NOTE'), 'outline')),
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
    body.push(h('section', { class: 'v-section' }, h('h3', null, t('L_MORNING')), review));
    // progress + stops
    const done = plan.stops.filter(x => x.status === 'DONE').length;
    const ups = recs.filter(x => SOLD.includes(x.outcome)).length;
    const mode = L['vsr:stopsMode'] || 'list';
    body.push(h('section', { class: 'v-section', 'data-tour': 'vsr2' },
      h('div', { class: 'row between', style: { marginBottom: '8px' } }, h('h3', { style: { margin: 0 } }, t('L_STOPS')),
        FD.seg([{ id: 'list', label: t('L_LIST'), icon: 'list' }, { id: 'map', label: t('L_MAP'), icon: 'map' }], mode, m => { L['vsr:stopsMode'] = m; FD.render(); })),
      h('div', { class: 'small muted', style: { marginBottom: '6px' } }, t('L_PROGRESS', { n: FD.fmt.num(done), qty: FD.fmt.num(plan.stops.length), got: FD.fmt.num(ups) })),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': done, 'aria-valuemax': plan.stops.length }, h('i', { style: { width: (100 * done / plan.stops.length) + '%' } })),
      h('div', { style: { marginTop: '12px' } }, mode === 'map' ? V.map(plan, vsr) : [mode === 'map' ? h('div', { class: 'banner warn', style: { marginBottom: '10px' } }, I('wifi-off'), h('span', null, t('S_MAP_OFFLINE'))) : null, h('div', { class: 'v-card' }, plan.stops.map(stop => V.stopRow(stop, plan, vsr)))])));
    return { title: tx(hour < 12 ? 'L_GOOD_MORNING' : 'L_GOOD_DAY', { vsrId: vsr.id }), sub: FD.fmt.dateLong(d) + ' · ' + FD.nameOf(route), body };
  });

  V.stopRow = function (stop, plan, vsr) {
    const s = storeOf(stop.store); const n = plan.recs.filter(x => x.store === stop.store && x.outcome === null).length + (plan.carried || []).filter(x => x.store === stop.store).length;
    const open = () => FD.go('#/vsr/' + vsr.id + '/store/' + stop.store);
    const more = e => { e.stopPropagation(); FD.menu(e.currentTarget, [
      stop.status === 'SKIPPED' && stop.skipReason === 'SK_SUP' ? null : stop.status === 'SKIPPED' ? { icon: 'undo', label: t('L_UNDO_SKIP'), onClick: () => FD.dx('STOP_UNSKIP', { store: stop.store, visitId: stop.id }) }
        : { icon: 'x-circle', label: t('L_SKIP_STOP'), onClick: () => V.skipSheet(stop, 'STOP_SKIP') },
      { icon: 'arrow-down', label: t('L_MOVE_LATER'), onClick: () => V.skipSheet(stop, 'STOP_MOVE') },
      { icon: 'repeat', label: t('L_VISIT_AGAIN'), onClick: () => V.revisitSheet(stop.store) },
      { icon: 'phone', label: t('L_CALL'), onClick: () => { location.href = 'tel:' + s.phone; } },
      { icon: 'message', label: t('L_MSG_SUP'), onClick: () => FD.threadSheet({ type: 'store', id: s.id }, 'VSR') }]); };
    return h('div', { class: 'stop ' + stop.status, role: 'button', tabindex: '0', on: { click: open, keydown: e => { if (e.key === 'Enter' && e.target === e.currentTarget) open(); } } },
      h('span', { class: 'seq' }, stop.status === 'DONE' ? I('check', 's16') : FD.fmt.num(plan.stops.indexOf(stop) + 1)),
      h('div', { class: 'grow' }, h('div', { class: 'nm' }, FD.nameOf(s)),
        h('div', { class: 'meta' }, t('LBL_' + s.label) + ' · ' + s.tags.map(x => t('TAGN_' + x.slice(4))).join(FD.lang === 'ar' ? '، ' : ', ')),
        stop.status === 'SKIPPED' ? h('div', { class: 'meta' }, t(stop.skipReason)) : null,
        h('div', { class: 'row wrap', style: { marginTop: '6px', gap: '6px' } }, V.statusChip(stop), stop.revisit ? FD.chip([I('repeat', 's14'), t('L_REVISIT')], 'warn') : null, stop.offPlan ? FD.chip(t('SK_OFFPLAN'), 'info') : null,
          plan.carried && plan.carried.some(r => r.store === stop.store) ? FD.chip(t('L_OPEN_SHORT'), 'warn') : null,
          s.credit !== 'OK' ? FD.creditChip(s.credit, true) : null,
          n ? FD.chip(tx('L_RECS_N', { n }), 'info') : FD.chip(t('L_NO_RECS'), ''))),
      h('div', { class: 'row', style: { gap: 0 } },
        h('a', { class: 'icon-btn', href: `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`, target: '_blank', rel: 'noopener', 'aria-label': t('L_NAVIGATE'), title: t('L_NAVIGATE'), on: { click: e => e.stopPropagation() } }, I('navigation')),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('L_ACTIONS'), on: { click: more } }, I('more'))));
  };

  V.skipSheet = function (stop, type) {
    let pick = null, comment = '';
    FD.sheet.open({ title: t(type === 'STOP_SKIP' ? 'L_SKIP_STOP' : 'L_MOVE_LATER'), render: () => h('div', { class: 'stack s8' },
      h('div', { class: 'muted small' }, FD.nameOf(storeOf(stop.store))),
      h('div', { class: 'code-list' }, ['SK_CLOSED', 'SK_LATER', 'SK_ROAD', 'SK_COLLECT', 'SK_TIME', 'SK_OTHER'].map(c => h('button', { type: 'button', class: 'code-btn' + (pick === c ? ' on' : ''), on: { click: () => { pick = c; FD.sheet.redraw(); } } }, h('span', { class: 'radio' }), t(c)))),
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
    const tx = W / 2 - k * (minx + maxx) / 2, ty = H / 2 + 10 - k * (miny + maxy) / 2;
    const peek = h('div', { class: 'snap-peek' });
    const img = h('img', { src: M.src, alt: '', draggable: 'false', style: { width: M.w * k + 'px', height: M.h * k + 'px' } });
    const inner = h('div', { class: 'snap-inner', style: { left: tx + 'px', top: ty + 'px' } }, img);
    const pins = pts.map(p => { const el = h('div', { class: 'snap-pin', style: { left: (p.xy[0] * k + tx) + 'px', top: (p.xy[1] * k + ty) + 'px' } },
      h('div', { class: 'pin ' + (p.status || ''), style: p.color ? { background: p.color } : null, role: 'button', tabindex: '0', 'aria-label': p.name,
        on: { click: () => show(p), keydown: e => { if (e.key === 'Enter') show(p); } } }, h('b', null, p.label)));
      return el; });
    function show(p) {
      peek.replaceChildren(h('div', { class: 'v-card', style: { padding: '12px 14px' } }, h('div', { class: 'row' }, h('b', { class: 'grow ellipsis' }, p.name), FD.iconBtn('x', FD.t('L_CLOSE'), () => peek.replaceChildren())),
        p.sub ? h('div', { class: 'small muted' }, p.sub) : null,
        h('div', { class: 'row', style: { marginTop: '8px' } }, p.open ? FD.btn(FD.t('L_OPEN'), p.open, 'primary sm') : null,
          h('a', { class: 'btn secondary sm', href: `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`, target: '_blank', rel: 'noopener' }, I('navigation', 's16'), FD.t('L_NAVIGATE')))));
    }
    const here = opts.here ? (() => { const xy = proj(opts.here[0], opts.here[1]); return h('div', { class: 'here', title: FD.t('L_YOU_ARE_HERE'), style: { left: (xy[0] * k + tx) + 'px', top: (xy[1] * k + ty) + 'px' } }); })() : null;
    box.replaceChildren(inner, ...pins, ...(here ? [here] : []), peek, h('span', { class: 'attr' }, '© OpenStreetMap'));
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
    const tab = L['vsr:storeTab'] || 'offer';
    const lastOrder = FD.SKUS.map(k => FD.lastOrder(s, storeId, k.code, d)).filter(Boolean).sort().pop();
    const head = h('div', { class: 'stack s8', style: { marginTop: '2px' } },
      h('div', { class: 'row wrap', style: { gap: '6px' } }, FD.chip(t('LBL_' + store.label), 'info'), FD.chip(t('SIZE_' + store.size)), store.tags.map(x => FD.chip(t('TAGN_' + x.slice(4)), 'outline')),
        store.credit !== 'OK' ? FD.creditChip(store.credit, true) : null),
      h('div', { class: 'row between' }, h('span', { class: 'small muted' }, lastOrder ? t('L_LAST_VISIT', { date: FD.fmt.date(lastOrder) }) : ''), visit ? V.statusChip(visit) : null),
      h('div', { class: 'row' }, FD.btn(t('L_MSG_SUP'), () => FD.threadSheet({ type: 'store', id: storeId }, 'VSR'), 'secondary sm', 'message'),
        h('a', { class: 'btn secondary sm', href: `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`, target: '_blank', rel: 'noopener' }, I('navigation', 's16'), t('L_NAVIGATE'))),
      h('div', { class: 'tabs', style: { padding: 0, marginTop: '6px' } }, [['offer', 'L_OFFER'], ['profile', 'L_PROFILE']].map(([id, lb]) => h('button', { type: 'button', class: tab === id ? 'on' : '', on: { click: () => { L['vsr:storeTab'] = id; FD.render(); } } }, t(lb)))));
    const body = [head];
    const due = FD.storeSkuStats(s, storeId, d).filter(x => x.cover != null && x.cover <= 2); // regular reorders, not upsells: a quiet line only
    if (due.length) body.push(h('div', { class: 'reorder-hint' }, I('repeat', 's16'), h('span', null, t('L_LIKELY_NEEDS', { label: due.slice(0, 3).map(x => FD.nameOf(FD.sku(x.code))).join(FD.lang === 'ar' ? '، ' : ', ') }))));
    if (!onPlan) body.push(h('div', { class: 'banner info', style: { marginTop: '12px' } }, I('calendar'), h('div', { class: 'grow' }, h('b', null, t('L_NOT_ON_PLAN')), h('div', { class: 'small' }, t('L_OFF_PLAN_NOTE'))),
      FD.isSellingDay(d) ? FD.btn(t('L_ADD_VISIT_TODAY'), () => { FD.dx('OFFPLAN_ADD', { vsr: vsr.id, store: storeId }); FD.toast('S_SAVED'); }, 'primary sm', 'plus') : null));
    let cta = null;
    if (tab === 'offer') {
      const recs = s.recs.filter(x => x.store === storeId && x.date === d && FD.recVsr(x) === vsr.id).concat(FD.openTemps(s, storeId, d).filter(x => x.date < d));
      const live = recs.filter(x => !x.blockedAt);
      if (!live.length) {
        const g = FD.recommend(s, storeId, d).gated[0];
        body.push(h('div', { class: 'v-card', style: { marginTop: '14px' } }, g && (store.credit === 'BLOCKED' || store.onboarding !== 'APPROVED') ? FD.empty('X_STORE_GATED', { gateId: g.gate }, 'lock') : FD.empty('X_STORE_WELL', null, 'check-circle')));
      } else body.push(h('div', { class: 'stack s8', style: { marginTop: '14px' } }, live.map((x, i) => V.recCard(x, i === 0))));
      recs.filter(x => x.blockedAt).forEach(x => body.push(h('div', { class: 'v-card rec gone', style: { marginTop: '8px' } }, h('div', { class: 'row' }, I('ban'), FD.skuLabel(x.sku, t('E_BLOCKED'))))));
      const openVisit = (plan.stops || []).some(x => x.store === storeId && x.status !== 'DONE' && x.status !== 'SKIPPED');
      if (openVisit && (live.some(x => x.outcome === null) || FD.openTemps(s, storeId, d).length)) cta = FD.btn(t('L_OPEN_SB'), () => V.salesBuzz(), 'primary lg block', 'external');
    } else body.push(V.profile(storeId));
    return { title: FD.nameOf(store), sub: FD.lang === 'ar' ? FD.HOOD_AR[store.hood] : store.hood, back: r.id ? () => FD.go('#/vsr/' + vsr.id + (onPlan ? '/today' : '/store')) : null, body, cta };
  });

  // every store assigned to this salesman: today's plan first, then the rest (off-plan visits are tracked)
  V.storeList = function (vsr, plan) {
    const s = st(); const d = today(); const q = (L['vsr:storeQ'] || '').toLowerCase();
    const mine = s.world.stores.filter(x => x.vsr === vsr.id || FD.routeOwner(s, x.route, d) === vsr.id);
    const planned = plan.stops.map(x => x.store);
    const lastVisit = id => s.visits.filter(v => v.store === id && v.status === 'DONE' && v.date <= d).reduce((m, v) => (v.date > m ? v.date : m), '');
    const lastOrder = id => FD.SKUS.map(k => FD.lastOrder(s, id, k.code, FD.addDays(d, 1))).filter(Boolean).sort().pop();
    const match = x => !q || (x.name + ' ' + (x.name_ar || '') + ' ' + x.id + ' ' + x.tags.map(g => t('TAGN_' + g.slice(4))).join(' ')).toLowerCase().includes(q);
    const row = x => { const lv = lastVisit(x.id), lo = lastOrder(x.id); const open = FD.openTemps(s, x.id, d).length;
      return h('button', { type: 'button', class: 'list-row click', style: { width: '100%', textAlign: 'start', padding: '12px 14px' }, on: { click: () => FD.go('#/vsr/' + vsr.id + '/store/' + x.id) } },
        h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'ellipsis', style: { fontWeight: 600 } }, FD.nameOf(x)),
          h('div', { class: 'small muted ellipsis' }, t('LBL_' + x.label) + ' · ' + x.tags.map(g => t('TAGN_' + g.slice(4))).join(FD.lang === 'ar' ? '، ' : ', ')),
          h('div', { class: 'row wrap', style: { gap: '6px', marginTop: '6px' } }, FD.sup && FD.sup.visitOrder ? FD.sup.visitOrder(lv || null, lo || null) : null, open ? FD.chip(t('L_OPEN_SHORT'), 'warn') : null,
            x.credit !== 'OK' ? FD.creditChip(x.credit, true) : null)), I('chevron-right', 's16')); };
    const today1 = mine.filter(x => planned.includes(x.id) && match(x)).sort((a, b) => planned.indexOf(a.id) - planned.indexOf(b.id));
    const others = mine.filter(x => !planned.includes(x.id) && match(x)).sort((a, b) => FD.nameOf(a).localeCompare(FD.nameOf(b)));
    const search = FD.searchBox('vsrStores', t('L_SEARCH_STORES'), L['vsr:storeQ'], q2 => { L['vsr:storeQ'] = q2; FD.render(); }, { marginTop: '4px' });
    return { title: t('L_MY_STORES'), sub: t('L_STORES_N', { n: FD.fmt.num(mine.length) }), body: [search,
      h('section', { class: 'v-section' }, h('h3', null, t('L_ON_PLAN_TODAY'), h('span', { class: 'pill-count' }, FD.fmt.num(today1.length))), today1.length ? h('div', { class: 'v-card' }, today1.map(row)) : h('div', { class: 'v-card' }, FD.empty('X_TODAY_NONE', null, 'calendar'))),
      h('section', { class: 'v-section' }, h('h3', null, t('L_OTHER_STORES'), h('span', { class: 'pill-count' }, FD.fmt.num(others.length))), others.length ? h('div', { class: 'v-card' }, others.map(row)) : h('div', { class: 'v-card' }, FD.empty('X_FILTER')))] };
  };

  V.recCard = function (rec, first) {
    const s = st(); const sku = FD.sku(rec.sku); const q = rec.qtyModified ?? rec.qty; const store = storeOf(rec.store);
    if (rec.stage === 'SENT' && !V._viewed[rec.id]) { V._viewed[rec.id] = 1; setTimeout(() => FD.dx('REC_VIEW', { recId: rec.id }), 0); }
    const cost = q * sku.cost, rev = q * sku.retail, earn = rev - cost;
    const promoEarn = V.promoEarn(rec, sku, q);
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
    return h('article', { class: 'v-card rec', 'data-tour': first ? 'vsr3' : null, 'aria-label': FD.nameOf(sku) },
      h('div', { class: 'top' }, FD.chip(t('TYPE_' + rec.type), rec.type === 'PROMO' ? 'warn' : 'info'), rec.pinned ? FD.chip([I('pin', 's14'), t('L_PIN')], 'brand') : null, h('span', { class: 'grow' }),
        th ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('L_MESSAGES'), on: { click: () => FD.threadSheet({ type: 'rec', id: rec.id }, 'VSR') } }, I('message'), th.unreadVsr ? h('span', { class: 'dot' }, '1') : null)
          : FD.iconBtn('message', t('L_MESSAGES'), () => FD.threadSheet({ type: 'rec', id: rec.id }, 'VSR'))),
      h('div', { class: 'row', style: { gap: '12px', alignItems: 'center' } }, FD.skuTile(rec.sku, 40), h('h4', { class: 'grow' }, FD.nameOf(sku))),
      rec.date < today() ? h('div', { class: 'small muted', style: { marginTop: '4px' } }, t('L_CARRIED_FROM', { date: FD.fmt.date(rec.date), reason: t(rec.reason) })) : null,
      h('div', { class: 'why' }, tx(rec.reasonId, reasonSlots), rec.pinned ? ' ' + t('B_PINNED') : ''),
      rec.supEdited ? h('div', { style: { marginTop: '6px' } }, FD.chip([I('user', 's14'), t(rec.supEdited.prev ? 'L_SUP_CHANGED' : 'SK_SUP_ADDED')], 'info')) : null,
      h('div', { class: 'pitch', role: 'group', 'aria-label': tx('C_PITCH', { cost, rev, earn }) },
        h('div', null, h('span', null, t('L_PITCH_COST')), h('b', null, money(cost))), h('div', null, h('span', null, t('L_PITCH_SELLS')), h('b', null, money(rev))),
        h('div', { class: 'earn' }, h('span', null, t('L_PITCH_EARN')), h('b', null, money(promoEarn ?? earn)))),
      h('div', { class: 'small muted', style: { marginTop: '6px', textAlign: 'center' } }, tx('C_PITCH_PC', { price: sku.street, pcs: sku.pcs, unitOf: sku.code })),
      promo ? h('div', { class: 'banner warn', style: { marginTop: '10px', fontSize: '13px' } }, I('tag', 's16'), h('span', null, tx('B_PROMO', { promoId: promo.promoId, date: promo.end }) + (promoEarn != null ? ' ' + tx('C_PITCH_PROMO', { earn: promoEarn }) : ''))) : null,
      h('div', { class: 'qty-row' }, h('div', { class: 'grow' }, h('div', { class: 'small muted' }, t('L_QTY')), h('div', { style: { fontWeight: 600 } }, rec.type === 'GAP' ? t('C_FIRST_FILL', { unit: unitText(rec.sku, 1) }) : tx('C_QTY', { qty: q, unitOf: rec.sku, pcs: q * sku.pcs }))),
        null), // quantity is only a hint: the order is placed in SalesBuzz (R2-f)
      h('div', { class: 'meta-list' },
        h('div', null, I('truck', 's14'), van == null ? t('D_NOT_VERIFIED') : van > 0 ? tx('D_ON_VAN', { qty: van, unitOf: rec.sku }) : t('D_NOT_ON_VAN')),
        h('div', null, I('clock', 's14'), tx('D_DATA_AGE', { date: FD.addDays(today(), -1), time: '21:40' })),
        h('div', null, I('calendar', 's14'), t('D_EXPIRES'))),
      tip ? h('div', { class: 'tipbox' }, I('bulb', 's16'), h('span', null, tx('D_TIP', { supId: 'S1', tip: tipText(tip) }))) : null,
      open ? h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { type: 'button', class: 'btn secondary sm', on: { click: () => V.reasonSheet(rec.id, 'NOT_OFFERED') } }, I('eye-off', 's16'), t('L_DIDNT_OFFER'))) : null,
      outcome);
  };
  V._viewed = {};
  // Visit again: later today or on the next visit day (R2-Q4) — inserts a revisit stop into that day's plan
  V.revisitSheet = function (storeId) {
    let when = 'today';
    FD.sheet.open({ title: t('L_VISIT_AGAIN'), render: () => h('div', { class: 'stack s8' },
      h('div', { class: 'muted small' }, FD.nameOf(storeOf(storeId))),
      h('div', { class: 'code-list' }, [['today', 'L_LATER_TODAY'], ['next', 'L_NEXT_VISIT_DAY']].map(([id, lb]) => h('button', { type: 'button', class: 'code-btn' + (when === id ? ' on' : ''), on: { click: () => { when = id; FD.sheet.redraw(); } } }, h('span', { class: 'radio' }), t(lb))))),
      footer: () => [h('button', { type: 'button', class: 'btn primary lg block', on: { click: FD.once(() => { FD.dx('REVISIT_ADD', { vsr: st().vsrId, store: storeId, when }); FD.sheet.close(); FD.toast('S_SAVED'); }) } }, t('L_SAVE'))] });
  };

  V.salesBuzz = function () {
    const screen = document.querySelector('.phone-screen'); if (!screen) return;
    const el = h('div', { class: 'sb-hand', role: 'dialog', 'aria-modal': 'true' }, h('div', null,
      h('div', { class: 'sb-logo', 'aria-hidden': 'true' }, 'SB'), h('b', { style: { fontSize: '18px' } }, 'SalesBuzz'), h('div', { class: 'spinner', 'aria-hidden': 'true' }),
      h('p', { class: 'muted', style: { maxWidth: '260px', margin: '0 auto 20px' } }, t('S_SB_OPENING')),
      FD.btn(t('L_BACK_FD'), () => el.remove(), 'secondary lg', 'arrow-left')));
    screen.appendChild(el); el.querySelector('button').focus();
  };

  V.profile = function (storeId) {
    const s = st(); const d = today(); const hl = FD.storeHealth(s, storeId, d); const shelf = FD.shelf(s, storeId, d);
    const band = { GOOD: ['L_BAND_GOOD', 'good'], WATCH: ['L_BAND_WATCH', 'warn'], LOW: ['L_BAND_LOW', 'bad'] }[hl.band];
    const parts = [['coverage', 'L_H_COVERAGE'], ['fresh', 'L_H_FRESH'], ['consistency', 'L_H_CONSIST'], ['uptake', 'L_H_UPTAKE']];
    const visits = s.visits.filter(v => v.store === storeId && v.status === 'DONE' && v.date < d).slice(-6);
    const recent = h('div', { class: 'v-card', style: { padding: '8px 0' } }, visits.slice().reverse().map(v => {
      const lines = FD.SKUS.flatMap(k => FD.storeOrders(s, storeId, k.code).filter(o => o.date === v.date && o.units > 0));
      return h('div', { class: 'list-row', style: { padding: '8px 14px', alignItems: 'flex-start' } }, h('span', { class: 'small', style: { width: '56px', flex: 'none', color: 'var(--ink-3)' } }, FD.fmt.date(v.date)),
        h('div', { class: 'row wrap grow', style: { gap: '4px' } }, lines.length ? lines.map(l => FD.chip([FD.skuIcon(l.sku, 16), FD.nameOf(FD.sku(l.sku)) + ' ×' + FD.fmt.num(l.units)])) : h('span', { class: 'small muted' }, '—')));
    }));
    return h('div', { class: 'stack s16', style: { marginTop: '14px' } },
      h('div', { class: 'v-card', style: { padding: '16px' } }, h('div', { class: 'row', style: { gap: '16px' } },
        h('div', { class: 'score-ring' }, FD.ring(hl.score), h('b', null, FD.fmt.num(hl.score))),
        h('div', { class: 'grow stack s8' }, h('div', { class: 'row between' }, h('b', null, t('L_HEALTH')), FD.chip(t(band[0]), band[1])),
          parts.map(([k, lb]) => h('div', null, h('div', { class: 'row between small' }, h('span', { class: 'muted' }, t(lb)), h('span', null, FD.fmt.pct(hl.parts[k]))),
            h('div', { class: 'progress', style: { height: '4px' } }, h('i', { style: { width: hl.parts[k] + '%' } }))))))),
      h('section', null, h('h3', { class: 'small muted', style: { margin: '0 0 8px' } }, t('L_SHELF')), FD.shelfView(shelf, { compact: true })),
      h('section', null, h('h3', { class: 'small muted', style: { margin: '0 0 8px' } }, t('L_STORE_PRODUCTS')), V.skuStats(storeId)),
      h('section', null, h('div', { class: 'row between', style: { marginBottom: '8px' } }, h('h3', { class: 'small muted', style: { margin: 0 } }, t('L_PHOTOS')), V.addPhotosBtn(storeId)), FD.photoTimeline(storeId, 6)),
      h('section', null, h('h3', { class: 'small muted', style: { margin: '0 0 8px' } }, t('L_LAST_8')), recent),
      FD.btn(t('L_SUGGEST_FIX'), () => V.correctionSheet(storeId), 'secondary block', 'edit'));
  };

  // Shared shelf view (used by VSR profile and Supervisor store detail)
  FD.SHELF_ICON = { CARRIED: 'check', PENDING: 'clock', OPPORTUNITY: 'target', LAPSED: 'refresh', DECLINED: 'x', GATED: 'lock', RETURNED: 'undo', NONE: 'minus' };
  FD.shelfView = function (shelf, opts = {}) {
    const groups = ['GRP_SINGLES', 'GRP_CUPBOX', 'GRP_CAKEBAR', 'GRP_SLICE', 'GRP_SWISS', 'GRP_POUND', 'GRP_BUTTER', 'GRP_RUSK'];
    const legend = h('div', { class: 'legend' }, ['CARRIED', 'PENDING', 'OPPORTUNITY', 'LAPSED', 'DECLINED', 'GATED', 'RETURNED'].map(k => h('span', { class: 'st-' + k }, h('span', { class: 'sw st' + (k === 'PENDING' || k === 'GATED' ? ' hatch' : '') }), t('SH_' + k))));
    return h('div', { class: 'shelf' }, legend, groups.map(g => h('div', { class: 'shelf-grp' }, h('h4', null, t(g).replace(/^./, c => c.toUpperCase())),
      h('div', { class: 'tiles' }, FD.SKUS.filter(k => k.group === g).map(k => {
        const state = shelf[k.code];
        const blk = opts.blocked && opts.blocked[k.code];
        const tile = h('button', { type: 'button', class: 'tile st-' + state + (blk ? ' is-blocked' : ''), 'aria-label': FD.nameOf(k) + ', ' + t('SH_' + state) + (blk ? ', ' + t('L_BLOCKED') : ''), on: { click: e => opts.onTile ? opts.onTile(k.code, state, e) : null } },
          h('div', { class: 'nm' }, FD.skuIcon(k.code, 20), h('span', null, FD.nameOf(k))), h('div', { class: 'stt' }, I(FD.SHELF_ICON[state]), t('SH_' + state) + (state === 'GATED' && shelf.gates[k.code] && !blk ? ' · ' + t(shelf.gates[k.code]) : '')),
          blk ? h('div', { class: 'tile-blk' }, I('ban', 's14'), t('L_BLOCKED')) : null);
        return tile;
      })))));
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
    let kind = null, comment = '';
    FD.sheet.open({ title: t('L_SUGGEST_FIX'), render: () => h('div', { class: 'stack s8' },
      h('div', { class: 'code-list' }, ['CORR_TAG', 'CORR_LABEL', 'CORR_CLOSED', 'CORR_MOVED'].map(c => h('button', { type: 'button', class: 'code-btn' + (kind === c ? ' on' : ''), on: { click: () => { kind = c; FD.sheet.redraw(); } } }, h('span', { class: 'radio' }), t(c)))),
      (() => { const ta = h('textarea', { class: 'textarea', placeholder: t('L_ADD_COMMENT'), 'aria-label': t('L_ADD_COMMENT'), on: { input: e => { comment = e.target.value; } } }); ta.value = comment; return ta; })()),
      footer: () => [h('button', { type: 'button', class: 'btn primary lg block', disabled: !kind, on: { click: () => { FD.dx('CORRECTION_ADD', { vsr: st().vsrId, store: storeId, kind, comment }); FD.sheet.close(); FD.toast('S_SENT', { supId: 'S1', vsr: FD.nameOf(st().world.supervisor) }); } } }, t('L_SEND'))] });
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
    if (plan.stops.length && !s.dayConfirmed[vsrId + '|' + d] && plan.stops.every(x => x.status === 'PLANNED')) items.unshift({ kind: 'review' });
    return items;
  };
  FD.registerView('vsr', 'todo', (r, vsr) => {
    const items = V.todoItems(vsr.id);
    const sec = (kind, label, render) => { const xs = items.filter(i => i.kind === kind); return xs.length ? h('section', { class: 'v-section' }, h('h3', null, t(label), h('span', { class: 'pill-count' }, FD.fmt.num(xs.length))), h('div', { class: 'v-card' }, xs.slice(0, 40).map(render))) : null; };
    const row = (icon, tone, title, sub, onClick, extra) => h('div', { class: 'list-row click', role: 'button', tabindex: '0', style: { padding: '12px 14px' }, on: { click: onClick, keydown: e => { if (e.key === 'Enter') onClick(); } } },
      h('span', { class: 'fu-ic ' + tone }, I(icon, 's16')), h('div', { class: 'grow' }, h('div', { style: { fontWeight: 500 } }, title), sub ? h('div', { class: 'small muted' }, sub) : null), extra || I('chevron-right', 's16'));
    const body = [];
    if (!items.length) body.push(h('div', { class: 'v-card', style: { marginTop: '12px' } }, FD.empty('X_TODO_DONE', null, 'check-circle')));
    if (items.some(i => i.kind === 'review')) body.push(h('div', { class: 'v-card', style: { marginTop: '8px' } }, row('list', '', t('T_REVIEW'), null, () => FD.go('#/vsr/' + vsr.id + '/today'))));
    body.push(sec('revisit', 'L_VISIT_AGAIN', i => row('repeat', 'p2', tx('T_REVISIT', { storeId: i.store, n: i.n }), null, () => V.revisitSheet(i.store))));
    body.push(sec('reason', 'L_TODO_REASONS', i => row('alert', 'p2', tx('T_REASON', { skuCode: i.rec.sku, storeId: i.rec.store }), FD.fmt.date(i.rec.date) + ' · ' + t(i.rec.outcome === 'NOT_SOLD' ? 'E_NOT_SOLD' : 'E_NOT_OFFERED'),
      () => V.reasonSheet(i.rec.id, i.rec.outcome))));
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
    if (r.id) { const a = FD.chatAnchor(r.id); if (a) return { title: FD.chatTitle(a, 'VSR'), sub: FD.chatSub(a, 'VSR'), back: () => FD.go('#/vsr/' + vsr.id + '/msgs'), chat: true,
      tools: h('span', { class: 'row', style: { gap: '2px' } }, FD.iconBtn('search', t('L_SEARCH_CHAT'), () => FD.chatSearchToggle(a))), body: [FD.chatView(a, 'VSR', { mode: 'full', header: false, vsr: vsr.id })] }; }
    const team = s.threads.find(x => x.team); const general = s.threads.find(x => x.anchor.type === 'vsr' && x.anchor.id === vsr.id);
    const row = (anchor, th) => { const last = th && th.messages[th.messages.length - 1]; const un = th && FD.chatUnread(th, 'VSR', vsr.id);
      return h('button', { type: 'button', class: 'list-row click chat-li', on: { click: () => FD.chatOpen(anchor, 'VSR') } },
        h('span', { class: 'chat-av' }, I(FD.chatIcon(anchor), 's16')), h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'ellipsis', style: { fontWeight: un ? 600 : 500 } }, FD.chatTitle(anchor, 'VSR')),
          h('div', { class: 'small muted ellipsis', dir: 'auto' }, last ? FD.chatSnippet(last, 'VSR', vsr.id) : FD.chatSub(anchor, 'VSR'))),
        h('div', { class: 'chat-li-end' }, last ? h('span', { class: 'small muted' }, last.at.date === today() ? FD.fmt.time(last.at.time) : FD.fmt.date(last.at.date)) : null, un ? h('span', { class: 'unread-dot', 'aria-label': t('L_UNREAD') }) : null)); };
    return { title: t('L_MESSAGES'), body: [h('section', { class: 'v-section' }, h('div', { class: 'v-card' }, row({ type: 'vsr', id: vsr.id }, general), row({ type: 'team', id: 'ALL' }, team))),
      h('div', { class: 'small muted', style: { padding: '0 4px' } }, t('L_TAG_NOTE'))] };
  });

  // ---------- ME ----------
  FD.registerView('vsr', 'me', (r, vsr) => {
    const s = st(); const m = FD.vsrMetrics(s, vsr.id, FD.PILOT_START, today()); const b = FD.baseline(s, vsr.id);
    const rank = FD.ranking(s, 'ABS', FD.PILOT_START, today()).find(x => x.vsr === vsr.id);
    const sees = Object.assign({ rank: true, upval: true, net: true, pvr: true, drop: true, xsell: true, action: true }, s.rules.vsrSees || {}); // set by the supervisor in Rules
    const moveTxt = rank.move > 0 ? t('L_MOVE_UP', { n: FD.fmt.num(rank.move) }) : rank.move < 0 ? t('L_MOVE_DOWN', { n: FD.fmt.num(-rank.move) }) : t('L_MOVE_SAME');
    const off = s.rules.metricsOff || {};
    const rows = [
      ['Q_NET', m.score.net, FD.fmt.money0(m.net), m.vsBaseline, 'net'],
      ['Q_PVR', m.score.pvr, FD.fmt.pct(m.pvr), m.pvr - b.pvr, 'pvr'],
      ['Q_DROP', m.score.drop, FD.fmt.money0(m.drop), b.drop ? 100 * (m.drop - b.drop) / b.drop : 0, 'drop'],
      ['Q_XSELL', m.score.xsell, FD.fmt.pct(m.xsell), null, 'xsell'],
      ['Q_ACTION', m.score.action, FD.fmt.pct(m.action), null, 'action']].filter(r => sees[r[4]] && !off[r[4]]);
    const weakest = rows.length ? rows.slice().sort((a, b2) => a[1] - b2[1])[0][0] : 'Q_ACTION';
    const cue = { Q_NET: ['Q_CUE_NET', { pct: Math.max(0, -m.vsBaseline) }], Q_PVR: ['Q_CUE_PVR', {}], Q_DROP: ['Q_CUE_DROP', {}], Q_XSELL: ['Q_CUE_XSELL', { unit: unitText('3040421754', 1) }], Q_ACTION: ['Q_CUE_ACTION', { n: m.missingReasons }] }[weakest];
    const filt = L['vsr:upsFilter'] || 'ALL';
    const ups = s.recs.filter(x => x.vsr === vsr.id && SOLD.includes(x.outcome)).filter(x => filt === 'ALL' || x.maturity === filt).sort((a, b2) => b2.date.localeCompare(a.date));
    const tips = s.tips.filter(x => x.vsr === vsr.id && x.status === 'SENT').slice().reverse();
    const threads = s.threads.filter(x => x.vsr === vsr.id).sort((a, b2) => (b2.unreadVsr - a.unreadVsr));
    const setRow = (label, ctl) => h('div', { class: 'metric-row', style: { gridTemplateColumns: '1fr auto' } }, h('span', null, t(label)), ctl);
    const spark = rank.spark;
    const body = [
      !sees.upval ? null : h('div', { class: 'v-card', style: { padding: '16px', marginTop: '4px', background: 'linear-gradient(135deg, var(--navy), var(--navy-2))', color: '#fff', border: 0 } },
        h('div', { class: 'small', style: { color: '#A9BDDC' } }, t('L_UPSELL_VALUE_YOU')),
        h('div', { style: { fontSize: '30px', fontWeight: 600, letterSpacing: '-.02em' } }, FD.fmt.money0(m.upsellValue)),
        h('div', { class: 'row', style: { marginTop: '4px', color: '#A9BDDC', fontSize: '13px' } }, t('L_KPI_FOOT_UPS', { n: FD.fmt.num(m.sold), pct: FD.fmt.num(Math.round(m.upsellConv)) }))),
      h('section', { class: 'v-section' }, h('h3', null, t('L_MY_SCORE')),
        h('div', { class: 'v-card' }, h('div', { class: 'row', style: { padding: '16px', gap: '16px' } },
          h('div', { class: 'score-ring' }, FD.ring(m.composite), h('b', null, FD.fmt.num(Math.round(m.composite)))),
          h('div', { class: 'grow stack s8' }, sees.rank ? h('b', { style: { fontSize: '18px' } }, tx('Q_RANK', { rank: rank.rank, n: 6, move: moveTxt })) : null, FD.spark(spark, 160, 34), h('div', { class: 'small muted' }, t('Q_WEIGHTS') + ' · ' + ['net', 'pvr', 'drop', 'xsell', 'action'].map(k => FD.fmt.num(FD.weights(s)[k])).join('/')))),
          h('div', { style: { borderTop: '1px solid var(--line)' } }, rows.map(([id, sc, val, dl]) => h('div', { class: 'metric-row' }, h('span', null, t(id)), h('b', { class: 'tabular' }, val), dl == null ? h('span', { class: 'small muted' }, FD.fmt.num(Math.round(sc))) : FD.delta(dl)))),
          h('div', { class: 'tipbox', style: { margin: '0 14px 14px' } }, I('bulb', 's16'), h('span', null, tx(cue[0], cue[1]))))),
      h('section', { class: 'v-section' }, h('h3', null, t('L_TIPS_RECEIVED')), tips.length ? h('div', { class: 'v-card' }, tips.slice(0, 10).map(x => h('button', { type: 'button', class: 'list-row click', style: { width: '100%', textAlign: 'start' }, on: { click: () => V.tipSheet(x.id) } },
        h('span', { class: 'fu-ic' }, I('bulb', 's16')), h('div', { class: 'grow' }, h('div', { style: { fontWeight: x.read ? 400 : 600 } }, tx(x.tpl + '_T', x.slots)), h('div', { class: 'small muted' }, FD.fmt.date(x.sentAt.date))), I('chevron-right', 's16')))) : h('div', { class: 'v-card' }, FD.empty('X_TIPS', null, 'bulb'))),
      h('section', { class: 'v-section' }, h('div', { class: 'row between', style: { marginBottom: '8px' } }, h('h3', { style: { margin: 0 } }, t('L_MY_UPSELLS')),
        FD.seg([{ id: 'ALL', label: t('L_ALL') }, { id: 'PENDING', label: t('L_FILTER_PENDING') }, { id: 'SUSTAINED', label: t('L_FILTER_SUSTAINED') }, { id: 'RETURNED', label: t('L_FILTER_RETURNED') }], filt, v => { L['vsr:upsFilter'] = v; FD.render(); })),
        ups.length ? h('div', { class: 'v-card' }, ups.slice(0, 25).map(x => h('div', { class: 'list-row', style: { padding: '10px 14px' } },
          h('div', { class: 'grow', style: { minWidth: 0 } }, FD.skuLabel(x.alt || x.sku, FD.nameOf(storeOf(x.store)) + ' · ' + FD.fmt.date(x.date))),
          FD.chip(x.maturity === 'PENDING' ? tx('E_PENDING', { days: Math.max(0, s.rules.maturityDays - FD.daysBetween(x.date, today())) }) : t(x.maturity === 'RETURNED' ? 'E_RETURNED' : 'E_SUSTAINED'), x.maturity === 'RETURNED' ? 'bad' : x.maturity === 'SUSTAINED' ? 'good' : 'info')))) : h('div', { class: 'v-card' }, FD.empty('X_FILTER'))),
      h('section', { class: 'v-section' }, h('h3', null, t('L_SETTINGS')), h('div', { class: 'v-card' },
        setRow('L_LANGUAGE', FD.seg([{ id: 'en', label: 'English' }, { id: 'ar', label: 'العربية' }], s.lang, v => FD.dx('SET_LANG', { lang: v }))),
        s.lang === 'ar' ? setRow('L_DIGITS', FD.seg([{ id: 'arab', label: t('L_DIGITS_AR') }, { id: 'latn', label: t('L_DIGITS_LAT') }], s.digits, v => FD.dx('SET_DIGITS', { digits: v }))) : null,
        setRow('L_TEXT_SIZE', FD.seg([{ id: 'normal', label: t('L_NORMAL') }, { id: 'large', label: t('L_LARGE') }], s.textSize, v => FD.dx('SET_TEXT_SIZE', { size: v }))),
        setRow('L_THEME', FD.seg([{ id: 'auto', label: t('L_AUTO') }, { id: 'light', label: t('L_LIGHT') }, { id: 'dark', label: t('L_DARK') }], s.theme, v => FD.dx('SET_THEME', { theme: v }))),
        h('div', { class: 'metric-row', style: { gridTemplateColumns: '1fr 1fr' } }, FD.btn(t('L_REPLAY_TOUR'), () => { FD.dx('TOUR_RESET'); FD.go('#/vsr/' + vsr.id + '/today'); setTimeout(() => FD.tour('vsr'), 200); }, 'secondary', 'play'),
          FD.btn(t('L_HELP'), () => V.help(), 'secondary', 'help')),
        h('div', { style: { padding: '8px 14px 14px' } }, FD.btn(t('L_LOG_OUT'), () => FD.signOut(), 'ghost block', 'arrow-left')))),
    ];
    return { title: FD.nameOf(vsr), sub: FD.nameOf(s.world.routes.find(x => x.id === vsr.route)), body };
  });
  V.help = () => FD.sheet.open({ title: t('L_HELP'), render: () => h('div', { class: 'stack s16' },
    h('div', { class: 'stack s8' }, ['O_V1', 'O_V2', 'O_V3'].map((k, i) => h('div', { class: 'row', style: { alignItems: 'flex-start' } }, h('span', { class: 'seq' }, FD.fmt.num(i + 1)), h('span', null, t(k))))),
    h('div', null, h('b', null, t('L_R_CODES')), h('div', { class: 'stack s8', style: { marginTop: '8px' } }, Object.keys(FD.REASON_GROUPS).map(g => [g, FD.reasonPick(g)]).filter(([, cs]) => cs.length).map(([g, codes]) => h('div', { class: 'row', style: { alignItems: 'flex-start' } }, I(GROUP_ICON[g]),
      h('div', null, h('div', { style: { fontWeight: 500 } }, t(g)), h('div', { class: 'small muted' }, codes.map(c => t(c)).join(' · ')))))))) });
})();
