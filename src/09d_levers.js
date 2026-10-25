(function () {
  const FD = globalThis.FD;
  if (typeof document === 'undefined') return;
  const h = FD.h, I = FD.icon, t = (...a) => FD.t(...a), tx = FD.tx; const S = FD.sup; const L = FD.ui.local;
  const st = () => FD.state; const vsrOf = id => st().world.vsrs.find(v => v.id === id);
  const meta = k => FD.PILOT_METRICS.find(m => m.k === k) || FD.METRICS.find(m => m.k === k);
  // change against an earlier value; green means better (for returns, lower is better)
  S.comparisonDelta = (now, before, format, lowerBetter = false) => {
    const d = FD.relativeChange(now, before);
    const context = Number.isFinite(before) ? t('L_BEFORE_V', { money: format(before) }) : '';
    if (d == null) return h('span', { class: 'delta flat', title: context, 'aria-label': context || null }, '—');
    const flat = Math.abs(d) < 0.5, good = lowerBetter ? d < 0 : d > 0;
    const text = FD.fmt.pct(flat ? 0 : Math.abs(d));
    return h('span', { class: 'delta ' + (flat ? 'flat' : good ? 'up' : 'down') + (Math.abs(d) >= 1000 ? ' has-baseline' : ''), title: context,
      'aria-label': (flat ? '' : t(d > 0 ? 'L_CHANGE_INCREASE' : 'L_CHANGE_DECREASE') + ' ') + text + (context ? ', ' + context : '') },
      Math.abs(d) >= 1000 ? h('span', { class: 'delta-value' }, I(d > 0 ? 'arrow-up' : 'arrow-down', 's14'), text) : [flat ? null : I(d > 0 ? 'arrow-up' : 'arrow-down', 's14'), text],
      Math.abs(d) >= 1000 ? h('span', { class: 'delta-baseline' }, context) : null);
  };
  S.leverDelta = (k, now, before) => S.comparisonDelta(now, before, value => {
    if (value !== 0 && Math.abs(value) < 1) {
      if (k === 'upsell' || k === 'avgSale') return FD.fmt.money(value);
      if (k === 'withSale' || k === 'returns') return FD.fmt.num(value, 2) + (FD.lang === 'ar' ? '٪' : '%');
    }
    return FD.metricText(k, value);
  }, meta(k).lowerBetter);
  // the ranking measure: change in net sales per selling day against the salesman's own baseline
  S.baseDelta = (m, big) => !m || !m.hasBaseline ? FD.chip(t('L_NO_BASELINE'), 'outline')
    : h('span', { class: 'delta ' + (Math.abs(m.vsBaseline) < 0.5 ? 'flat' : m.vsBaseline > 0 ? 'up' : 'down') + (big ? ' big' : ''), title: t('L_VS_MY_BASE') },
      Math.abs(m.vsBaseline) < 0.5 ? null : I(m.vsBaseline > 0 ? 'arrow-up' : 'arrow-down', big ? 's20' : 's14'), FD.fmt.pct(Math.abs(m.vsBaseline)));
  // What moves each metric: a short, fixed playbook from the pilot plan and field visits; each move opens where it is done
  const PLAY = {
    primary: [['PB_P1', 'weekly'], ['PB_P2', 'plans'], ['PB_P3', 'opps'], ['PB_P4', 'rules']],
    visits: [['PB_V1', 'plans'], ['PB_V2', 'plans'], ['PB_V3', 'today'], ['PB_V4', 'msgs'], ['PB_V5', 'today']],
    withSale: [['PB_S1', 'team'], ['PB_S2', 'stores'], ['PB_S3', 'stores'], ['PB_S4', 'today'], ['PB_S5', 'weekly']],
    avgSale: [['PB_A1', 'opps'], ['PB_A2', 'opps'], ['PB_A3', 'skus'], ['PB_A4', 'today'], ['PB_A5', 'weekly']],
    returns: [['PB_R1', 'rules'], ['PB_R2', 'rules'], ['PB_R3', 'stores'], ['PB_R4', 'skus']] };
  const GO = { plans: () => S.tomorrowDrawer(), weekly: '#/sup/weekly', today: '#/sup/today', opps: '#/sup/opps', rules: '#/sup/rules', msgs: '#/sup/msgs', team: '#/sup/team', stores: '#/sup/stores', skus: '#/sup/skus' };
  S.playbook = k => !PLAY[k] ? null : h('section', null, h('div', { class: 'card playbook' },
    PLAY[k].map(([id, go], i) => h('button', { type: 'button', class: 'list-row click', on: { click: () => { const g = GO[go]; FD.sheet.closeAll(); FD.drawer.close(); typeof g === 'function' ? setTimeout(g, 320) : FD.go(g); } } },
      h('span', { class: 'pb-n' }, FD.fmt.num(i + 1)), h('span', { class: 'grow' }, h('span', { class: 'fu-t', style: { display: 'block' } }, t(id)), h('span', { class: 'fu-c', style: { display: 'block', whiteSpace: 'normal' } }, t(id + '_D'))), I('chevron-right', 's16')))));
  S.playbookSheet = (k, label) => FD.sheet.open({ center: true, title: t('L_PLAYBOOK') + ' · ' + label, render: () => S.playbook(k) });
  S.leverChip = k => k ? h('span', { class: 'chip lever lv-' + k, title: t(meta(k).info) }, I(meta(k).icon, 's14'), t(meta(k).label)) : null;

  // The same primary KPI and four supporting KPIs as the approved deck.
  S.leverStrip = ({ ids, from, to, prev, onOpen }) => {
    const s = st(); const now = FD.teamLevers(s, ids, from, to); const was = prev ? FD.teamLevers(s, ids, prev.from, prev.to) : null;
    const open = k => onOpen ? onOpen(k) : S.metricDrawer(k, { ids, from, to, prev });
    const tile = (k, label, val, foot, cls, info) => h('button', { type: 'button', class: 'card kpi ' + (cls || ''), title: info, 'aria-label': label, on: { click: () => open(k) } },
      h('span', { class: 'lbl' }, k === 'net' ? I('chart', 's16') : I(meta(k).icon, 's16'), label), h('span', { class: 'val' }, val), h('span', { class: 'foot' }, foot));
    return h('div', { class: 'kpis levers pilot-kpis' },
      FD.PILOT_METRICS.map(m => tile(m.k, t(m.label), FD.metricText(m.k, now[m.k]), was && was.days ? [S.leverDelta(m.k, now[m.k], was[m.k]), ' ', t('L_COL_CHANGE')] : (m.lowerBetter ? t('L_LOWER_BETTER') : ''), m.k === 'primary' ? 'hero' : '', t(m.info))));
  };

  // open items that move one metric: today's alerts and checks, and follow-ups
  // Open now, by category: one row per kind of work with its count; it opens to the salesmen involved; a bulk action where one is safe
  const CAT_IC = { X_OWNER_NOT: 'message', A_MISSED: 'alert', A_OFFPLAN: 'map-pin', A_PACE: 'clock', A_PREORDER: 'inbox', X_CARRY: 'repeat', X_PREORDER: 'inbox', X_DUE: 'calendar', X_QUESTION: 'help', X_SKIPPED: 'alert', X_SHORT: 'truck', X_DAMAGED: 'package' };
  const inLever = (type, k) => { const l = FD.leverOf(type); return l === k || (k === 'avgSale' && l === 'upsell'); }; // extra lines and upsells move the average sale
  S.leverActions = (k, ctx) => {
    const s = st(), context = FD.metricActionContext(s, ctx), dd = context.to, cats = new Map();
    const cat = (key, tone, icon) => { if (!cats.has(key)) cats.set(key, { key, tone, icon, items: [] }); return cats.get(key); };
    for (const g of context.groups.filter(g => g.type !== 'A_PREORDER' && inLever(g.type, k)))
      cat(g.type, g.type === 'A_MISSED' ? 'bad' : 'warn', CAT_IC[g.type]).items.push({ vsr: g.van, n: g.count, open: () => S.vsrDrawer(g.van, false, 'day', { date: g.day }), alert: g });
    const po = FD.alerts(s, dd).filter(a => a.type === 'A_PREORDER' && context.ids.includes(a.van));
    if (po.length && inLever('A_PREORDER', k)) cat('A_PREORDER', 'info', 'inbox').items.push({ vsr: null, n: po.length, label: tx(po.length === 1 ? 'A_PREORDER_G1' : 'A_PREORDER_G', { n: po.length }), open: () => S.preordersDrawer() });
    for (const v of s.world.vsrs.filter(x => x.kind === 'sales' && context.ids.includes(x.id))) {
      const by = {}; for (const x of FD.dispatchExceptions(s, v.id, dd)) if (inLever(x.type, k)) (by[x.type] = by[x.type] || []).push(x);
      for (const [type, xs] of Object.entries(by)) cat(type, 'warn', CAT_IC[type] || 'list').items.push({ vsr: v.id, n: xs.length, open: () => S.vsrDrawer(v.id, false, 'day', { date: dd }), exc: xs, date: dd });
    }
    for (const f of context.followUps.filter(f => inLever(f.tpl, k)))
      cat(f.tpl, f.pri === 1 ? 'bad' : 'warn', FU_ICON_OF(f.tpl)).items.push({ vsr: S.fuVsr(f), n: 1, label: S.fuVsr(f) ? null : tx(f.tpl, f.slots), open: () => S.fuDetail(f), fu: f });
    const order = { bad: 0, warn: 1, info: 2 };
    return [...cats.values()].map(c => Object.assign(c, { n: c.items.reduce((t, i) => t + i.n, 0) })).sort((a, b) => order[a.tone] - order[b.tone] || b.n - a.n);
  };
  const FU_ICON_OF = tpl => (S.FU_ICON || {})[tpl] || 'bell';
  // the one safe bulk action per category (same idea as Send all on tips)
  const bulkOf = c => {
    const keysOf = i => i.alert.items.map(a => FD.alertKey(a, i.alert.day || st().clock.date));
    // missed stops: the playbook step is to put them on the next plan
    if (c.key === 'A_MISSED') return { label: 'L_CARRY_ALL', run: () => { const nd = FD.nextSellingDay(st().clock.date); c.items.forEach(i => { i.alert.items.forEach(a => FD.dx('OFFPLAN_ADD', { vsr: i.vsr, store: a.store, date: nd, bySup: true })); FD.dx('ALERT_RESOLVE', { keys: keysOf(i), how: 'REPLANNED' }); }); } };
    // visits off the plan: ask each salesman why, once
    if (c.key === 'A_OFFPLAN') return { label: 'L_ASK_ALL_WHY', run: () => c.items.forEach(i => { FD.dx('MSG_SEND', { anchor: { type: 'vsr', id: i.vsr }, by: 'SUP', text: tx('MSG_ASK_OFFPLAN', { n: i.n }) }); FD.dx('ALERT_RESOLVE', { keys: keysOf(i), how: 'ASKED' }); }) };
    if (c.items.some(i => i.alert)) return null; // pace: message one salesman at a time
    if (c.key === 'X_DUE' || c.key === 'X_CARRY') return { label: 'L_ADD_ALL_PLAN', run: () => c.items.forEach(i => i.exc.forEach(x => FD.dx('OFFPLAN_ADD', { vsr: i.vsr, store: x.store, bySup: true }))) };
    if (c.items.some(i => i.fu)) return { label: 'L_HANDLED_ALL', run: () => c.items.forEach(i => FD.dx('FOLLOWUP_DISMISS', { fu: i.fu.key, why: 'FU_HANDLED', snap: { tpl: i.fu.tpl, slots: i.fu.slots } })) };
    if (c.key === 'A_PREORDER') return { label: 'L_NAV_PREORDERS', run: () => S.preordersDrawer() };
    return null; };
  S.openNow = cats => !cats.length ? FD.empty('L_METRIC_MOVES_NONE', null, 'check-circle') : h('div', { class: 'card', style: { padding: 0 } }, cats.map(c => {
    const k = 'on:' + c.key, open = FD.ui.local[k], bulk = bulkOf(c);
    return h('div', { class: 'on-cat' }, h('div', { class: 'list-row on-cat-h' },
      h('button', { type: 'button', class: 'row-toggle grow', 'aria-expanded': String(!!open), on: { click: () => { FD.ui.local[k] = !open; FD.drawer.refresh(false); } } },
        h('span', { class: 'fu-ic ' + c.tone }, I(c.icon, 's16')), h('span', { class: 'grow fu-t' }, t('CAT_' + c.key)), h('span', { class: 'pill-count' }, FD.fmt.num(c.n)), I(open ? 'chevron-up' : 'chevron-down', 's16')),
      bulk ? FD.btn(t(bulk.label), () => { bulk.run(); FD.toast(null, null, { text: t(bulk.label + '_DONE') }); FD.drawer.refresh(false); FD.render(); }, 'secondary sm') : null),
      open ? h('div', { class: 'on-items' }, c.items.map(i => h('button', { type: 'button', class: 'list-row click', on: { click: i.open } },
        i.vsr ? FD.avatar(vsrOf(i.vsr)) : null, h('span', { class: 'grow' }, i.label || FD.nameOf(vsrOf(i.vsr))), i.n > 1 ? h('span', { class: 'small muted tabular' }, FD.fmt.num(i.n)) : null, I('chevron-right', 's16')))) : null); }));
  S.metricDrawer = (k, ctx) => FD.drawer.open({ title: t(k === 'net' ? 'L_NET_RESULT' : meta(k).label), render: () => {
    const s = st(); const ids = ctx.ids; const lk = k === 'net' || k === 'primary' ? null : k;
    const now = FD.teamLevers(s, ids, ctx.from, ctx.to); const was = ctx.prev ? FD.teamLevers(s, ids, ctx.prev.from, ctx.prev.to) : null;
    const fmt = v => k === 'net' ? FD.fmt.money0(v) : FD.metricText(k, v);
    const days = []; for (let d = FD.addDays(ctx.to, -20); d <= ctx.to; d = FD.addDays(d, 1)) if (FD.isSellingDay(d) && d >= FD.BASE_START) days.push(d);
    const series = days.map(d => { const x = FD.teamLevers(s, ids, d, d); return x.days ? x[k] : null; });
    const rows = ids.map(id => { const m = FD.vsrMetrics(s, id, ctx.from, ctx.to); const v = k === 'net' ? m.net : m.lev[k]; return { id, v, base: k === 'net' ? null : m.base[k] }; }).filter(x => x.v != null);
    const acts = lk ? S.leverActions(lk, ctx) : [];
    return h('div', { class: 'stack s16' },
      h('div', { class: 'card', style: { padding: '14px' } },
        h('div', { class: 'row between wrap' }, h('div', null, h('div', { class: 'row', style: { gap: '6px' } }, h('div', { class: 'kpi-big' }, fmt(now[k])), S.info(t(k === 'net' ? 'L_NET_RESULT_D' : meta(k).info) + (k !== 'net' && meta(k).formula ? ' ' + t(meta(k).formula) : ''))), was ? h('div', { class: 'small muted row', style: { gap: '6px' } }, S.leverDelta(lk || 'avgSale', now[k], was[k]), t('PG_PREVIOUS_PERIOD'), ': ', fmt(was[k])) : null),
          h('div', { class: 'row wrap', style: { gap: '8px' } }, lk && meta(lk).lowerBetter ? FD.chip(t('L_LOWER_BETTER'), 'outline') : null,
            FD.btn(t('L_PLAYBOOK'), () => S.playbookSheet(k === 'primary' || k === 'net' ? 'primary' : lk, t(k === 'net' ? 'L_NET_RESULT' : meta(k).label)), 'secondary sm', 'bulb'))),
        null), // definition and formula live in the (i) beside the value
      // one card: the trend or each salesman, switched in place so nothing sits far below
      (() => { const by = FD.ui.local['metric:view'] === 'vsr', lb = t(k === 'net' ? 'L_NET_RESULT' : meta(k).label);
        const sw = FD.seg([{ id: 'trend', label: t('L_COL_TREND') }, { id: 'vsr', label: t('L_BY_VSR') }], by ? 'vsr' : 'trend', v => { FD.ui.local['metric:view'] = v; FD.drawer.refresh(false); });
        return h('div', { class: 'card', style: { padding: '14px' } }, h('div', { class: 'row', style: { marginBottom: '10px' } }, sw),
          by ? FD.bars(rows.sort((a, b) => meta(lk || 'avgSale').lowerBetter ? a.v - b.v : b.v - a.v).map(r => ({ label: FD.nameOf(vsrOf(r.id)), value: r.v,
              display: h('span', { class: 'row', style: { gap: '6px', justifyContent: 'flex-end' } }, fmt(r.v), r.base ? S.leverDelta(lk || 'avgSale', r.v, r.base) : null), onClick: () => S.vsrDrawer(r.id, true) })))
            : FD.line([{ name: lb, values: series }], days.map(d => FD.fmt.date(d)), { h: 170, fmt, label: lb })); })(),
      // actions follow the chart (user preference: trend / by salesman directly under the value)
      lk ? h('section', null, h('h3', { class: 'sec-h' }, t('L_METRIC_OPEN_NOW')), S.openNow(acts)) : null,
      null);
  } });

})();
