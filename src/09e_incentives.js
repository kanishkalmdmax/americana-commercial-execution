(function () {
  // Supervisor: each salesman's KPIs, bonus and what missed visits cost (Team → KPIs and bonus), and the incentive plan (Rules → Incentives).
  const FD = globalThis.FD;
  if (typeof document === 'undefined') return;
  const h = FD.h, I = FD.icon, t = (...a) => FD.t(...a), tx = FD.tx; const S = FD.sup;
  const st = () => FD.state, today = () => st().clock.date, m0 = n => FD.fmt.money0(n);
  const KEYS = ['cake', 'grocery', 'active', 'collect'];
  const TONE = { DONE: 'good', ON_TRACK: 'good', AT_RISK: 'bad' };
  const OVERDUE_PCT = x => 100 * x.overduePct; // overdue share as a percent, against the 10% limit
  const tipHead = x => x.k === 'CAKE' ? tx('KPI_TIP_CAKE', { money: m0(x.money) }) : tx('KPI_TIP_' + x.k, { n: x.n });
  const tipSlots = x => x.k === 'CAKE' ? { money: Math.round(x.money) } : { n: x.n };

  S.kpiTeam = () => {
    const s = st(), d = today(), ids = S.fvans();
    const rows = s.world.vsrs.filter(v => v.kind === 'sales' && (!ids || ids.includes(v.id))).map(v => {
      const p = FD.kpiStatus(s, v.id, d), l = FD.lostThisMonth(s, v.id, d);
      return { v, p, l, on: KEYS.filter(k => p.parts[k].status !== 'AT_RISK').length };
    });
    const kcell = k => ({ key: k, label: t(k === 'collect' ? 'L_COL_OVERDUE' : 'KPI_SHORT_' + k.toUpperCase()), num: true, sort: (a, b) => FD.kpiProgress(a.p.parts[k]) - FD.kpiProgress(b.p.parts[k]),
      render: x => FD.chip(FD.fmt.pct(Math.round(k === 'collect' ? OVERDUE_PCT(x.p.parts[k]) : 100 * FD.kpiProgress(x.p.parts[k]))), TONE[x.p.parts[k].status]) });
    const sendTip = x => { const tip = x.p.tips[0]; FD.dx('TIP_SEND', { vsr: x.v.id, tpl: 'KPI_TIP_' + tip.k, slots: tipSlots(tip) }); FD.toast('S_SENT', { vsrId: x.v.id }); FD.render(); };
    const table = FD.table({ id: 'kpiTeam', rows, defaultSort: ['bonus', 'asc'], onRow: x => FD.go('#/sup/team/' + x.v.id), columns: [
      { key: 'n', label: t('L_COL_VSR'), sort: (a, b) => FD.nameOf(a.v).localeCompare(FD.nameOf(b.v)), render: x => h('div', null, h('b', null, FD.nameOf(x.v)), h('div', { class: 'small muted' }, tx('ME_KPI_ON_TRACK', { n: x.on }))) },
      ...KEYS.map(kcell),
      { key: 'bonus', label: t('L_COL_BONUS'), num: true, sort: (a, b) => a.p.likely - b.p.likely, render: x => h('div', null, h('b', { class: 'tabular' }, m0(x.p.likely)), h('div', { class: 'small muted' }, tx('L_KPI_OF', { total: m0(x.p.pot) }))) },
      { key: 'lost', label: t('L_COL_LOST'), num: true, sort: (a, b) => a.l.rows.length - b.l.rows.length, render: x => x.l.rows.length ? h('div', { class: 'small' }, t('ME_LOST_MISSED_TAG'), ' ', h('b', { class: 'tabular' }, FD.fmt.num(x.l.missed)), ' · ', t('ME_LOST_NOSALE_TAG'), ' ', h('b', { class: 'tabular' }, FD.fmt.num(x.l.noSale))) : '—' },
      { key: 'next', label: t('L_COL_NEXT'), nosort: true, render: x => x.p.tips[0] ? h('div', { class: 'stack', style: { gap: '6px' } }, h('span', { class: 'small' }, tipHead(x.p.tips[0])),
        h('span', { class: 'row wrap', style: { gap: '6px' } }, FD.btn(t('L_SEND_KPI_TIP'), () => sendTip(x), 'secondary sm', 'send'), FD.btn(t('L_MSG_SALESMAN'), () => FD.chatPopup({ type: 'vsr', id: x.v.id }, 'SUP'), 'ghost sm', 'message'))) : h('span', { class: 'small muted' }, t('KPI_MET')) }] });
    return S.card(t('L_TEAM_KPIS'), rows[0] ? t('ME_MONTH') + ' · ' + tx('ME_DAYS_LEFT', { n: rows[0].p.daysLeft }) : null, h('div', null, table, h('div', { class: 'small muted', style: { padding: '10px 16px' } }, t('L_KPI_TEAM_NOTE'))), { flush: true, icon: 'chart' });
  };

  // ---------- Rules → Incentives ----------
  const plan = () => FD.incentivePlan();
  S.incentivesCards = () => {
    const rows = plan();
    const live = FD.table({ id: 'incLive', rows, columns: [
      { key: 'n', label: t('INC_COL_ITEM'), nosort: true, render: x => h('b', null, t(x.name)) },
      { key: 'r', label: t('INC_COL_RULE'), nosort: true, render: x => tx(x.rule, { pct: x.pct }) },
      { key: 'a', label: t('INC_COL_AMOUNT'), num: true, nosort: true, render: x => m0(x.amount) }] });
    const foot = h('div', { class: 'small muted', style: { padding: '10px 16px' } }, tx('INC_TOTAL', { money: m0(rows.reduce((a, x) => a + x.amount, 0)) }));
    const pc = n => FD.fmt.pct(n);
    const tiers = FD.table({ id: 'incTiers', rows: [[tx('INC_T_UNDER', { pct: 85 }), pc(0)], [pc(85), pc(60)], [pc(90), pc(80)], [pc(95), pc(95)], [pc(100), pc(100)], [tx('INC_T_ABOVE', { pct: 100 }), tx('INC_T_UPTO', { pct: 150 })]],
      columns: [{ key: 'a', label: t('INC_COL_ACH'), nosort: true, render: x => x[0] }, { key: 'p', label: t('INC_COL_PAY'), num: true, nosort: true, render: x => x[1] }] });
    return [S.card(t('INC_LIVE'), null, h('div', null, live, foot), { flush: true, icon: 'wallet' }),
      S.card(t('INC_TIERS'), null, tiers, { flush: true, icon: 'chart' })];
  };
})();
