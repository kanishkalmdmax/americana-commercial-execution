(function () {
  const FD = globalThis.FD;
  if (typeof document === 'undefined') return;
  const h = FD.h, I = FD.icon, t = (...a) => FD.t(...a), tx = FD.tx;
  const S = FD.sup = {};
  const L = FD.ui.local;
  const st = () => FD.state;
  const today = () => st().clock.date;
  const storeOf = id => st().world.stores.find(s => s.id === id);
  const vsrOf = id => st().world.vsrs.find(v => v.id === id);
  const SOLD = ['FULL', 'PARTIAL', 'ALT'];
  const pct = (a, b) => (b ? (100 * a) / b : 0);
  const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0);

  // ---------- filters (UI-local) ----------
  S.f = L['sup:f'] = L['sup:f'] || { route: '', sup: null, period: 'PILOT', from: null, to: null }; // sup null = the signed-in supervisor, set on first render
  // periods end on the latest day SalesBuzz has sent (yesterday unless live data is on)
  S.range = () => {
    const d = FD.dataDay(st()); const f = S.f;
    if (f.period === 'TODAY') return { from: d, to: d };
    if (f.period === 'WEEK') return { from: FD.addDays(d, -6), to: d };
    if (f.period === 'CUSTOM' && f.from && f.to) return { from: f.from < f.to ? f.from : f.to, to: f.from < f.to ? f.to : f.from };
    return { from: FD.PILOT_START, to: d };
  };
  S.vsrs = () => st().world.vsrs.filter(v => v.kind === 'sales' && (!S.f.route || v.route === S.f.route) && (!S.f.sup || v.sup === S.f.sup));
  S.stores = () => st().world.stores.filter(s => (!S.f.route || s.route === S.f.route) && (!S.f.sup || (st().world.vsrs.find(v => v.id === s.vsr) || {}).sup === S.f.sup));
  S.recs = extra => { const { from, to } = S.range(); return FD.recsIn(st(), Object.assign({ from, to, route: S.f.route || null }, extra || {})); };

  // ---------- layout ----------
  const NAV = [['today', 'truck', 'L_NAV_TODAY'], ['team', 'users', 'L_NAV_TEAM'], ['stores', 'store', 'L_NAV_STORES'], ['msgs', 'message', 'L_MESSAGES'], ['weekly', 'chart', 'L_NAV_WEEKLY'], ['skus', 'package', 'L_NAV_SKUS'], ['opps', 'target', 'L_NAV_OPPS'], ['rules', 'sliders', 'L_NAV_RULES']];
  const FILTERS = { today: ['sup', 'route'], home: ['sup', 'route'], weekly: ['sup', 'route', 'period'], team: ['sup', 'period'], learn: ['route', 'period'], stores: ['sup', 'route'], opps: ['sup', 'route'] };
  const pinned = () => { try { return localStorage.getItem('fd.navPinned') === '1'; } catch (e) { return !!L['nav:pinned']; } };
  const setPinned = v => { L['nav:pinned'] = v; try { localStorage.setItem('fd.navPinned', v ? '1' : '0'); } catch (e) { } FD.render(); };
  S.layout = function (r, viewFn) {
    const s = st();
    const uses = r.page === 'stores' && r.id ? [] : FILTERS[r.page] || []; // only the filters a page shows
    // a filter set on another page must not narrow a page that does not show it
    if (S.f.sup == null) S.f.sup = s.world.supervisor.id;
    const kept = S.f; S.f = Object.assign({}, kept, uses.includes('route') ? null : { route: '' }, uses.includes('sup') ? null : { sup: '' });
    let view; try { view = viewFn(r); } finally { S.f = kept; }
    const counts=FD.supervisorBadgeCounts(s,S.vans().map(v=>v.id)); const badge=id=>counts[id]||0;
    const nav = NAV.map(([id, icon, label]) => { const n = badge(id); return h('a', { class: 'nav-item' + (r.page === id || (id === 'today' && r.page === 'home') ? ' on' : ''), href: '#/sup/' + id, 'aria-current': r.page === id ? 'page' : null, title: t(label), 'data-tour': id === 'weekly' ? 'sup3' : null },
      I(icon), h('span', null, t(label)), n ? h('span', { class: 'badge' }, FD.fmt.num(n)) : null); });
    const periodSeg = FD.seg([{ id: 'TODAY', label: t(FD.liveData(st()) ? 'L_P_TODAY' : 'L_METRICS_DAY') }, { id: 'WEEK', label: t('L_P_WEEK') }, { id: 'PILOT', label: t('L_P_PILOT') }, { id: 'CUSTOM', label: t('L_P_CUSTOM') }], S.f.period, v => { S.f.period = v; if (v === 'CUSTOM' && !S.f.from) { S.f.from = FD.addDays(today(), -13); S.f.to = today(); } FD.render(); });
    const supSel = FD.select([{ id: '', label: t('L_ALL_SUPS') }].concat(s.world.sups.map(x => ({ id: x.id, label: FD.nameOf(x) }))), S.f.sup, v => { S.f.sup = v; FD.render(); }, { 'aria-label': t('L_SUPERVISOR') });
    const routeSel = FD.select([{ id: '', label: t('L_ALL_ROUTES') }].concat(s.world.routes.map(x => ({ id: x.id, label: FD.routeArea(x) }))), S.f.route, v => { S.f.route = v; FD.render(); }, { 'aria-label': t('L_ROUTE') });
    const custom = S.f.period === 'CUSTOM' ? h('div', { class: 'row' },
      FD.dateBtn({ label: t('L_FROM'), value: S.f.from, min: FD.BASE_START, max: S.f.to || today(), onPick: v => { S.f.from = v; FD.render(); } }),
      h('span', { class: 'muted' }, '–'),
      FD.dateBtn({ label: t('L_TO'), value: S.f.to, min: S.f.from || FD.BASE_START, max: today(), onPick: v => { S.f.to = v; FD.render(); } })) : null;
    return h('div', { class: 'sup' + (pinned() ? ' nav-pinned' : '') },
      h('aside', { class: 'side', 'aria-label': 'Main' },
        h('div', { class: 'brand' }, h('span', { class: 'logo-dot' }, I('route', 's16')), h('span', null, 'FieldDrive', h('small', null, t('L_RIYADH_TT')))),
        h('nav', { class: 'stack', style: { gap: '4px' } }, nav), h('div', { class: 'spacer' }),
        h('button', { type: 'button', class: 'pin-nav', 'aria-pressed': pinned() ? 'true' : 'false', on: { click: () => setPinned(!pinned()) } }, I(pinned() ? 'pin-off' : 'pin'), h('span', null, t(pinned() ? 'L_UNPIN_NAV' : 'L_PIN_NAV'))),
        h('button', { type: 'button', class: 'me', 'aria-haspopup': 'menu', on: { click: e => FD.menu(e.currentTarget, [
          { icon: 'globe', label: t('L_LANGUAGE') + ' · ' + (FD.state.lang === 'ar' ? 'English' : 'العربية'), onClick: () => FD.dx('SET_LANG', { lang: FD.state.lang === 'ar' ? 'en' : 'ar' }) },
          { icon: 'moon', label: t('L_THEME') + ' · ' + t(FD.state.theme === 'dark' ? 'L_LIGHT' : 'L_DARK'), onClick: () => FD.dx('SET_THEME', { theme: FD.state.theme === 'dark' ? 'light' : 'dark' }) },
          { icon: 'play', label: t('L_REPLAY_TOUR'), onClick: () => { FD.dx('TOUR_RESET'); FD.go('#/sup/today'); setTimeout(() => FD.tour('sup'), 300); } }, '-',
          { icon: 'arrow-left', label: t('L_LOG_OUT'), danger: true, onClick: () => FD.signOut() }]) } },
          h('span', { class: 'avatar' }, FD.initials(s.world.supervisor.name)), h('div', null, FD.nameOf(s.world.supervisor), h('small', null, t('L_SUPERVISOR'))))),
      h('div', { class: 'main' },
        h('header', { class: 'topbar' },
          h('div', { class: 'tb-title' }, view.back ? FD.iconBtn('arrow-left', t('L_BACK'), view.back) : null, h('div', null, h('h1', r.page==='stores'?{'aria-live':'polite'}:null, view.title), h('div', { class: 'date' }, FD.fmt.dateLong(today()) + (FD.liveData(s) ? ' · ' + t('L_UPDATED', { time: FD.fmt.time(s.clock.time.slice(0, 3) + '00') }) : '')))),
          h('div', { class: 'spacer' }), S.search(), S.notifCount ? (n => h('button', { type: 'button', class: 'notif-btn', 'aria-label': t('L_INBOX') + (n ? ' · ' + FD.fmt.num(n) : ''), title: t('L_INBOX'), on: { click: () => S.notifPanel() } }, I('bell', 's20'), n ? h('span', { class: 'notif-n' }, n > 99 ? '99+' : FD.fmt.num(n)) : null))(S.notifCount()) : null,
          (b => (b.classList.add('mob-only'), b))(FD.iconBtn('search', t('L_SEARCH_PH'), () => { const tb = document.querySelector('.topbar'); tb.classList.toggle('m-search'); const i = tb.querySelector('.search input'); if (i && tb.classList.contains('m-search')) i.focus(); })),
          !uses.length && !view.bar ? null : h('div', { class: 'filters', style: { flexBasis: '100%' } }, uses.length ? FD.btn(t('L_FILTER') + (S.f.sup || S.f.route ? ' · ' + FD.fmt.num(!!S.f.sup + !!S.f.route) : ''), () => S.filtersSheet(uses), 'secondary sm mob-only', 'filter') : null, uses.includes('sup') ? supSel : null, uses.includes('route') ? routeSel : null, uses.includes('period') ? periodSeg : null, uses.includes('period') ? custom : null, view.bar ? h('button', { type: 'button', class: 'btn secondary sm filters-btn', on: { click: () => S.filtersSheet(view) } }, I('filter', 's16'), t('L_FILTERS')) : null),
          view.bar ? h('div', { class: 'page-bar' }, view.bar()) : null),
        h('main', { class: 'page' + (view.full ? ' page-full' : ''), id: 'sup-page' }, view.body)),
      h('nav', { class: 'mobile-nav', 'aria-label': 'Main' }, NAV.slice(0, 4).map(([id, icon, label]) => h('a', { href: '#/sup/' + id, class: r.page === id ? 'on' : '', 'aria-current': r.page === id ? 'page' : null }, I(icon), t(label), badge(id) ? h('span', { class: 'mn-dot' }, FD.fmt.num(badge(id))) : null)),
        h('button', { type: 'button', class: NAV.slice(4).some(n => n[0] === r.page) ? 'on' : '', on: { click: () => S.moreSheet(r) } }, I('menu'), t('L_MORE'))));
  };
  // phone width: page filters move into a sheet so the sticky bar stays one line
  S.filtersSheet = function (uses) { const s = st();
    const set = (k, v) => { S.f[k] = v; FD.render(); FD.sheet.redraw(); };
    FD.sheet.open({ title: t('L_FILTER'), render: () => h('div', { class: 'stack s16 filters-stack' },
      uses.includes('sup') ? h('div', { class: 'field' }, h('label', null, t('L_SUPERVISOR')), FD.select([{ id: '', label: t('L_ALL_SUPS') }].concat(s.world.sups.map(x => ({ id: x.id, label: FD.nameOf(x) }))), S.f.sup, v => set('sup', v))) : null,
      uses.includes('route') ? h('div', { class: 'field' }, h('label', null, t('L_ROUTE')), FD.select([{ id: '', label: t('L_ALL_ROUTES') }].concat(s.world.routes.map(x => ({ id: x.id, label: FD.routeArea(x) }))), S.f.route, v => set('route', v))) : null),
      footer: () => [h('span', { class: 'grow' }), FD.btn(t('L_DONE'), () => FD.sheet.close(), 'primary')] }); };
  // Phone-width "More": remaining pages, filters and settings in one sheet
  S.moreSheet = function (r) {
    const s = st();
    FD.sheet.open({ title: t('L_MORE'), render: () => h('div', { class: 'stack s16' },
      h('div', { class: 'stack s8' }, NAV.slice(4).map(([id, icon, label]) => h('a', { class: 'list-row click', href: '#/sup/' + id, style: { border: '1px solid var(--line)', borderRadius: '12px' }, on: { click: e => { e.preventDefault(); FD.sheet.close(); FD.go('#/sup/' + id); } } }, I(icon), h('span', { class: 'grow' }, t(label)), I('chevron-right', 's16')))),
      h('div', { class: 'field' }, h('label', null, t('L_ROUTE')), FD.select([{ id: '', label: t('L_ALL_ROUTES') }].concat(s.world.routes.map(x => ({ id: x.id, label: FD.routeArea(x) }))), S.f.route, v => { S.f.route = v; FD.render(); })),
      h('div', { class: 'field' }, h('label', null, t('L_THEME')), FD.seg([{ id: 'auto', label: t('L_AUTO') }, { id: 'light', label: t('L_LIGHT') }, { id: 'dark', label: t('L_DARK') }], s.theme, v => { FD.dx('SET_THEME', { theme: v }); FD.sheet.redraw(); })),
      FD.btn(t('L_REPLAY_TOUR'), () => { FD.sheet.close(); FD.dx('TOUR_RESET'); FD.go('#/sup/today'); setTimeout(() => FD.tour('sup'), 300); }, 'secondary block', 'play'),
      FD.btn(t('L_LOG_OUT'), () => { FD.sheet.close(); FD.signOut(); }, 'ghost block', 'arrow-left'),
      ) });
  };

  // ---------- global search (stores, products, salesmen) ----------
  S.search = function () {
    const box = h('div', { class: 'search', style: { width: '300px', maxWidth: '40vw', position: 'relative' } });
    const res = h('div', { class: 'menu', style: { position: 'absolute', top: '44px', insetInlineStart: 0, width: '100%', display: 'none', maxHeight: '360px', overflow: 'auto' } });
    const input = h('input', { class: 'input', type: 'search', placeholder: t('L_SEARCH_PH'), 'aria-label': t('L_SEARCH_PH'), value: L['sup:q'] || '',
      on: { input: e => { L['sup:q'] = e.target.value; draw(); }, focus: () => draw(), keydown: e => { if (e.key === 'Escape') { res.style.display = 'none'; } if (e.key === 'ArrowDown') { const b = res.querySelector('button'); if (b) { e.preventDefault(); b.focus(); } } } } });
    function draw() {
      const q = (L['sup:q'] || '').trim().toLowerCase(); if (q.length < 2) { res.style.display = 'none'; return; }
      const m = x => (x.name + ' ' + (x.name_ar || '') + ' ' + (x.code || x.id || '')).toLowerCase().includes(q);
      const items = [
        ...st().world.vsrs.filter(m).map(v => ({ icon: 'user', label: FD.nameOf(v), go: () => S.vsrDrawer(v.id) })),
        ...st().world.stores.filter(m).slice(0, 8).map(s => ({ icon: 'store', label: FD.nameOf(s), go: () => S.storeDrawer(s.id) })),
        ...FD.SKUS.filter(m).slice(0, 6).map(k => ({ icon: 'package', label: FD.nameOf(k), go: () => S.skuDrawer(k.code) }))];
      res.replaceChildren(...(items.length ? items.map(it => h('button', { type: 'button', on: { click: () => { res.style.display = 'none'; it.go(); } } }, I(it.icon, 's16'), h('span', { class: 'ellipsis' }, it.label))) : [FD.empty('X_FILTER')]));
      res.style.display = 'block';
    }
    box.append(I('search', 's16'), input, res);
    box.addEventListener('focusout', e => { if (!box.contains(e.relatedTarget)) res.style.display = 'none'; });
    return box;
  };

  // ---------- small helpers ----------
  // "?" next to a card title opens a short explanation (hover shows it too)
  S.info = text => { const b = h('button', { type: 'button', class: 'info-btn', 'aria-label': t('L_WHAT_IS_THIS'), title: text, on: { click: e => { e.stopPropagation(); FD.popover(b, text); } } }, I('help', 's14')); return b; };
  const card = (title, sub, body, opts = {}) => h('section', { class: 'card' + (opts.cls ? ' ' + opts.cls : ''), 'data-tour': opts.tour || null },
    h('div', { class: 'card-h' }, opts.icon ? h('span', { class: 'fu-ic', style: { width: '32px', height: '32px' } }, I(opts.icon, 's16')) : null,
      h('div', { class: 'grow' }, h('h2', null, opts.link ? h('a', { href: opts.link[1] }, title) : title, opts.info ? S.info(opts.info) : null), sub ? h('div', { class: 'sub' }, sub) : null), opts.right || null),
    h('div', { class: opts.flush ? '' : 'card-b' }, body),
    opts.link ? h('div', { class: 'card-f' }, h('a', { class: 'btn ghost sm', href: opts.link[1] }, t(opts.link[0]), I('chevron-right', 's16'))) : null);
  S.card = card;
  const who = v => h('div', { class: 'who' }, FD.avatar(v), h('div', { style: { minWidth: 0 } }, h('div', { class: 'ellipsis', style: { fontWeight: 500 } }, FD.nameOf(v)), h('div', { class: 'small muted ellipsis' }, FD.routeArea(st().world.routes.find(r => r.id === v.route)))));
  // store row: type icon + name; route and ID underneath (salesman is implied by the route)
  const storeCell = s => h('div', { class: 'store-cell' }, FD.sizeIcon(s.size), h('div', { style: { minWidth: 0 } }, h('div', { class: 'ellipsis', style: { fontWeight: 500, maxWidth: '260px' } }, FD.nameOf(s)),
    h('div', { class: 'small muted nowrap' }, t('LBL_' + s.label) + ' · ' + t('SIZE_' + s.size)))); // no store IDs or route codes on screen
  S.ago = d => d == null ? '—' : d === 0 ? t('L_TODAY_W') : d === 1 ? t('L_YESTERDAY') : tx('L_DAYS_AGO', { days: d });
  S.attnChips = x => h('div', { class: 'row wrap', style: { gap: '4px' } }, x.reasons.map(r => FD.chip(r === 'SA_WASTED' ? tx('SA_WASTED', { n: x.g.wasted28 }) : r === 'SA_RETURNS' ? tx('SA_RETURNS', { pct: x.g.returnsPct }) : x.g.daysSinceOrder == null ? t('SA_NO_ORDER_EVER') : tx('SA_NO_ORDER', { days: x.g.daysSinceOrder }), r === 'SA_RETURNS' ? 'bad' : 'warn')));
  S.demandChip = g => FD.chip(t('DEM_' + g.demand), { STEADY: 'good', IRREGULAR: 'warn', NONE: '' }[g.demand]);
  // the store at a glance: plain numbers a supervisor reads in one second
  S.glance = (storeId, compact) => { const g = FD.storeGlance(st(), storeId, today());
    const cell = (label, val, tone) => h('div', { class: 'card glance-cell' + (tone ? ' ' + tone : '') }, h('div', { class: 'small muted' }, label), h('b', null, val));
    return h('div', { class: 'glance' + (compact ? ' compact' : '') },
      cell(t('L_G_LAST_VISIT'), S.ago(g.daysSinceVisit)), cell(t('L_G_LAST_ORDER'), S.ago(g.daysSinceOrder), g.daysSinceOrder == null || g.daysSinceOrder >= 21 ? 'warn' : ''),
      cell(t('L_G_ORDER_DAYS'), FD.fmt.num(g.orderDays28)), cell(t('L_G_AVG'), g.avgOrder ? FD.fmt.money0(g.avgOrder) : '—'),
      cell(t('L_G_WASTED'), FD.fmt.num(g.wasted28), g.wasted28 >= 2 ? 'warn' : ''), cell(t('L_G_RETURNS'), g.sales28 ? FD.fmt.pct(g.returnsPct) : '—', g.sales28 >= 200 && g.returnsPct >= 20 ? 'bad' : ''),
      cell(t('L_G_DEMAND'), t('DEM_' + g.demand)), cell(t('L_G_PRODUCTS'), FD.fmt.num(g.products28))); };
  const band = b => FD.chip(t({ GOOD: 'L_BAND_GOOD', WATCH: 'L_BAND_WATCH', LOW: 'L_BAND_LOW' }[b]), { GOOD: 'good', WATCH: 'warn', LOW: 'bad' }[b]);
  const outcomeChip = r => {
    const m = { FULL: ['E_FULL', 'good'], PARTIAL: ['E_FULL', 'good'], ALT: ['E_ALT', 'good'], NOT_SOLD: ['E_NOT_SOLD', 'bad'], NOT_OFFERED: ['E_NOT_OFFERED', 'warn'], WAITING: ['E_WAITING', ''], CARRIED: ['SK_CLOSED', ''] }[r.outcome] || ['ST_SENT', 'info'];
    const text = r.outcome === 'PARTIAL' ? tx('E_PARTIAL', { got: r.got, qty: r.qtyModified ?? r.qty, unitOf: r.sku }) : r.outcome === 'ALT' ? tx('E_ALT', { altCode: r.alt }) : t(m[0]);
    return FD.chip(text, m[1]);
  };
  const matChip = r => r.maturity ? FD.chip(r.maturity === 'PENDING' ? tx('E_PENDING', { days: Math.max(0, st().rules.maturityDays - FD.daysBetween(r.date, today())) }) : t(r.maturity === 'RETURNED' ? 'E_RETURNED' : 'E_SUSTAINED'), r.maturity === 'RETURNED' ? 'bad' : r.maturity === 'SUSTAINED' ? 'good' : 'info') : h('span', { class: 'muted' }, '—');
  const reasonCell = r => r.exempted ? FD.chip(t('E_EXEMPTED'), 'info') : r.reason ? h('span', null, t(r.reason) + (r.brand ? ' · ' + t(r.brand) : '')) : SOLD.includes(r.outcome) ? h('span', { class: 'muted' }, '—') : FD.chip(t('E_NO_REASON'), 'bad');
  S.outcomeChip = outcomeChip; S.matChip = matChip; S.reasonCell = reasonCell; S.who = who; S.storeCell = storeCell; S.band = band;

  // ---------- aggregate KPIs for current filters ----------
  // ---------- follow-up actions ----------
  S.act = function (f, el) {
    const a = f.action; const s = st();
    const snap = { tpl: f.tpl, slots: f.slots, action: f.action.label };
    const done = () => { FD.dx('FOLLOWUP_DONE', { fu: f.key, how: f.action.label, snap }); };
    const animateOut = cb => { const row = el && el.closest('.fu-row'); if (row) { row.classList.add('out'); setTimeout(cb, 260); } else cb(); };
    switch (a.kind) {
      case 'remind':
        FD.dx('MSG_SEND', { anchor: { type: 'fu', id: f.key }, by: 'SUP', text: t('MSG_REMIND'), vsr: a.vsr });
        animateOut(() => { done(); FD.toast('S_SENT', { vsrId: a.vsr }, { undo: () => FD.dx('FOLLOWUP_UNDO', { fu: f.key }) }); }); break;
      case 'tip': S.tipComposer(a.vsr, FD.K_BY_REASON[a.reason] || 'K_REASONS', FD.tipSlots(a.sku), null, () => done()); break;
      case 'pin': { const n0 = st().pins.length; FD.dx('PIN_ADD', { sku: a.sku, scope: a.scope || null, id: a.id || null, until: a.until || FD.addDays(today(), 14) });
        animateOut(() => { done(); FD.toast('S_PINNED', { date: a.until || FD.addDays(today(), 14) }, { undo: () => { const p = st().pins[n0]; if (p) FD.dx('PIN_REMOVE', { pinId: p.pinId }); FD.dx('FOLLOWUP_UNDO', { fu: f.key }); } }); }); break; }
      case 'correction': S.correctionSheet(a.id); break;
      case 'thread': { const th = s.threads.find(x => x.id === a.thread); const lm = th.messages.filter(m => m.by !== 'SUP').pop(); FD.chatPopup(th.anchor, 'SUP', lm && lm.store ? { store: lm.store } : null, lm && lm.store ? { store: lm.store, sku: lm.sku, rec: lm.rec } : null); break; }
      case 'store': S.storeDrawer(a.store); break;
      case 'sku': S.skuDrawer(a.sku); break;
      case 'unwatch': FD.dx('WATCH_REMOVE', { sku: a.sku }); animateOut(() => { done(); FD.toast('S_SAVED'); }); break;
      case 'planogram': S.pgOpen(a.store,a.assessmentId); break;
      case 'vsr': S.vsrDrawer(a.vsr); break;
      case 'rec': S.recDrawer(a.rec); break;
      case 'reasons': S.reasonDrawer(Object.assign({ kind: null }, a.filter)); break;
      case 'learn': FD.go('#/sup/learn'); break;
      case 'wa': FD.chatOpen({ type: 'wa', id: a.store }, 'SUP'); break;
    }
  };
  const FU_ICON = S.FU_ICON = { F_WATCH_OK: 'check-circle', F_WATCH_BAD: 'alert', F_RETURN_UPSELL: 'undo', F_MISSING_REASONS: 'list', F_REPEAT_DECLINE: 'x-circle', F_COMPETITOR: 'flag', F_GAP_CLUSTER: 'target', F_VSR_BELOW: 'trending-down', F_NOT_OFFERED: 'eye-off',
    F_CREDIT: 'wallet', F_CORRECTION: 'edit', F_VSR_COMMENT: 'message', F_VSR_STORE_MSG: 'message', F_PLANOGRAM:'camera', F_PHOTO: 'camera', F_ENGINE_MISS: 'trending-up', F_WATCHLIST: 'eye', F_SKIPPED: 'x', F_PROMO_LOW: 'tag', F_COVER: 'user-switch' };
  S.fuRow = f => {
    const row = h('div', { class: 'fu-row', dataset: { fu: f.key } },
      h('span', { class: 'fu-ic p' + f.pri }, I(FU_ICON[f.tpl] || 'info', 's16')),
      h('button', { type: 'button', class: 'grow fu-open', style: { minWidth: 0, textAlign: 'start' }, 'aria-label': tx(f.tpl, f.slots), on: { click: () => S.fuDetail(f) } }, h('div', { class: 'fu-t' }, tx(f.tpl, f.slots)), h('div', { class: 'fu-c ellipsis' }, tx(f.tpl + '_C', f.slots))),
      h('button', { type: 'button', class: 'btn secondary sm', on: { click: e => S.act(f, e.currentTarget) } }, t(f.action.label)),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('L_ACTIONS'), on: { click: e => { e.stopPropagation(); const btn = e.currentTarget; FD.menu(btn, [
        { icon: 'clock', label: t('L_SNOOZE'), onClick: () => { FD.dx('FOLLOWUP_SNOOZE', { fu: f.key, snap: { tpl: f.tpl, slots: f.slots } }); FD.toast(null, null, { text: t('L_SNOOZE'), undo: () => FD.dx('FOLLOWUP_UNDO', { fu: f.key }) }); } },
        '-',
        { icon: 'check', label: t('L_DISMISS') + ' · ' + t('FU_HANDLED'), onClick: () => { FD.dx('FOLLOWUP_DISMISS', { fu: f.key, why: 'FU_HANDLED', snap: { tpl: f.tpl, slots: f.slots } }); FD.toast(null, null, { text: t('FU_HANDLED'), undo: () => FD.dx('FOLLOWUP_UNDO', { fu: f.key }) }); } },
        { icon: 'x', label: t('L_DISMISS') + ' · ' + t('FU_IRRELEVANT'), onClick: () => { FD.dx('FOLLOWUP_DISMISS', { fu: f.key, why: 'FU_IRRELEVANT', snap: { tpl: f.tpl, slots: f.slots } }); FD.toast(null, null, { text: t('FU_IRRELEVANT'), undo: () => FD.dx('FOLLOWUP_UNDO', { fu: f.key }) }); } }]); } } }, I('more')));
    return row;
  };
  const inRoute = f => { if (!S.f.route) return true; const sl = f.slots; const s = st();
    if (sl.vsrId) return vsrOf(sl.vsrId).route === S.f.route; if (sl.storeId) return storeOf(sl.storeId).route === S.f.route; return true; };
  S.homeFollowUps = () => { const seen = new Set(); return FD.followUps(st()).filter(inRoute).filter(f => { if (seen.has(f.tpl)) return false; seen.add(f.tpl); return true; }).slice(0, 5); };

  S.analyticsTrend=({ids,from,to})=>{
    const step=Math.max(1,Math.ceil((FD.daysBetween(from,to)+1)/28)),labels=[],values=[];
    for(let date=from;date<=to;date=FD.addDays(date,step)){
      const end=FD.addDays(date,step-1),last=end<to?end:to;
      labels.push(FD.fmt.date(date));values.push(FD.teamLevers(st(),ids,date,last).primary);
    }
    return card(t('L_ANALYTICS_TREND'),FD.fmt.date(from)+' - '+FD.fmt.date(to),
      FD.line([{name:t('M_PRIMARY'),values}],labels,{h:220,fit:true,fmt:FD.fmt.money0,label:t('M_PRIMARY')}));
  };

  // ================= HOME =================
  FD.registerView('sup', 'weekly', () => {
    const s = st(); const { from, to } = S.range();
    const kpis = S.leverStrip({ ids: S.vsrs().map(v => v.id), from, to, prev: from === to ? { from: FD.prevSellingDay(from), to: FD.prevSellingDay(from) } : FD.prevRange(from, to) });
    const rank = FD.teamCompare(s, from, to).filter(x => !S.f.route || vsrOf(x.vsr).route === S.f.route);
    const team = card(t('L_P_TEAM'), null, S.teamTable('homeRank', rank, false),
      { flush: true, icon: 'users', info: t('I_TEAM'), link: ['L_OPEN_TEAM', '#/sup/team'] });
    const whyKind = L['sup:whyKind'] || 'NOT_SOLD';
    const rb = FD.reasonBreakdown(s, { kind: whyKind, from, to, route: S.f.route || null }).filter(g => g.count > 0 || g.group !== 'R_OTHER');
    const why = card(t('L_P_WHY'), null, rb.every(g => !g.count) ? FD.empty('X_FILTER') : FD.bars(rb.map(g => ({ label: h('span', { class: 'row', style: { gap: '6px' } }, I(FD.vsr.GROUP_ICON[g.group] || (g.group === 'R_NONE' ? 'alert' : g.group.startsWith('NF_') ? 'eye-off' : 'more'), 's16'), t(g.group === 'R_OTHER' ? 'SK_OTHER' : g.group)),
        value: g.count, muted: g.group === 'R_NONE', onClick: () => S.reasonDrawer({ group: g.group, kind: whyKind }), label2: null,
        tip: () => h('div', null, g.codes.map(c => h('div', null, t(c.code) + ': ' + FD.fmt.num(c.count)))) }))),
      { icon: 'x-circle', info: t('I_WHY'), right: FD.seg([{ id: 'NOT_SOLD', label: t('E_NOT_SOLD') }, { id: 'NOT_OFFERED', label: t('E_NOT_FOLLOWED') }], whyKind, v => { L['sup:whyKind'] = v; FD.render(); }) });
    const opps = FD.opportunities(s, { route: S.f.route || null }).slice(0, 5);
    const oppCard = card(t('L_P_OPPS'), null, FD.table({ id: 'homeOpps', rows: opps, onRow: o => S.storeDrawer(o.store, o.sku), empty: 'X_FILTER', columns: [
      { key: 's', label: t('L_COL_STORE'), render: o => storeCell(storeOf(o.store)) },
      { key: 'p', label: t('L_COL_PRODUCT'), render: o => h('div', { class: 'opp-prod' }, FD.skuLabel(o.sku), FD.typeChip(o.type)) },
      { key: 'ev', label: t('L_EST_MARGIN'), num: true, sort: (a, b) => a.ev - b.ev, render: o => FD.fmt.money0(o.ev) },
      { key: 'a', label: '', render: o => h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: 0 } },
        FD.iconBtn('pin', t('L_PIN'), () => { const n0 = st().pins.length; FD.dx('PIN_ADD', { sku: o.sku, scope: 'store', id: o.store, until: FD.addDays(today(), 7) }); FD.toast('S_PINNED', { date: FD.addDays(today(), 7) }, { undo: () => { const p = st().pins[n0]; if (p) FD.dx('PIN_REMOVE', { pinId: p.pinId }); } }); }),
        FD.iconBtn('ban', t('L_BLOCK'), () => { const n0 = st().blocks.length; FD.dx('BLOCK_ADD', { store: o.store, sku: o.sku }); FD.toast('S_BLOCKED', { vsrId: storeOf(o.store).vsr }, { undo: () => { const b = st().blocks[n0]; if (b) FD.dx('BLOCK_REMOVE', { blockId: b.id }); } }); })) }] }),
      { flush: true, cls: 'home-opps', icon: 'target', info: t('I_OPPS'), link: ['L_OPEN_OPPS', '#/sup/opps'] });
    const sp = FD.skuPerf(s, from, to).slice().sort((a, b) => b.sales - a.sales).slice(0, 6);
    const skuCard = card(t('L_P_SKU'), null, FD.table({ id: 'homeSku', rows: sp, onRow: x => S.skuDrawer(x.code), columns: [
      { key: 'p', label: t('L_COL_PRODUCT'), render: x => h('div', { class: 'row' }, FD.skuLabel(x.code), x.watch ? FD.chip(t('L_WATCHLIST_FLAG'), 'warn') : null) },
      { key: 'c', label: t('L_COL_CARRYING'), num: true, sort: (a, b) => a.carrying - b.carrying, render: x => FD.fmt.num(x.carrying) },
      { key: 'v', label: t('L_COL_CONV'), num: true, sort: (a, b) => a.conv - b.conv, render: x => x.attempts ? FD.fmt.pct(x.conv) : '—' },
      { key: 'r', label: t('L_COL_RETURNS'), num: true, sort: (a, b) => a.returnRate - b.returnRate, render: x => h('span', { style: x.returnRate >= 8 ? { color: 'var(--bad)', fontWeight: 600 } : null }, FD.fmt.pct(x.returnRate)) }] }),
      { flush: true, icon: 'package', info: t('I_SKUS'), link: ['L_OPEN_SKUS', '#/sup/skus'] });
    const attn = FD.storesNeedingAttention(s, S.stores().map(x => x.id), today()).slice(0, 5).map(x => Object.assign({ s: storeOf(x.id) }, x));
    const storeCard = card(t('L_P_STORES'), null, FD.table({ id: 'homeStores', rows: attn, onRow: x => S.storeDrawer(x.s.id), columns: [
      // reasons under the store name so the card never scrolls sideways
      { key: 's', label: t('L_COL_STORE'), render: x => h('div', { class: 'attn-cell' }, storeCell(x.s), S.attnChips(x)) }] }),
      { flush: true, icon: 'store', info: t('I_ATTN'), link: ['L_OPEN_STORES', '#/sup/stores'] });
    const ins = (FD.insights(s)).slice(0, 3);
    const insCard = card(t('L_P_INSIGHTS'), null, h('div', { class: 'stack s8' }, ins.map(i => h('button', { type: 'button', class: 'insight', on: { click: () => S.insightDrawer(i) } },
      h('div', { class: 'ttl' }, tx(i.tpl, i.slots)),
      h('div', { class: 'mini-bars' }, i.chart.values.map((v, j) => h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'small muted', style: { width: '120px', flex: 'none' } }, t(i.chart.labels[j])),
        h('span', { class: 'grow' }, h('span', { class: 'b' + (j ? ' o' : ''), style: { display: 'block', width: (100 * v / Math.max(...i.chart.values)) + '%' } })), h('span', { class: 'small tabular' }, FD.fmt.num(v, 1)))))))), { icon: 'bulb', info: t('I_INSIGHTS') });
    // read top-down the way a supervisor asks: how are we doing, what needs me, how is the team, where to act, what sells
    const sec = id => h('h3', { class: 'sec-h rules-sec', id: 'sec-' + id }, t(id));
    return { title: t('L_NAV_WEEKLY'), body: [S.jumpBar(['L_PILOT_KPIS', 'L_SEC_TEAM', 'L_SEC_ACT', 'L_SEC_SELLS', 'L_JOURNEY_REVIEW']), h('h2', { class: 'sec-h', id: 'sec-L_PILOT_KPIS' }, t('L_PILOT_KPIS')), kpis, S.analyticsTrend({ids:S.vsrs().map(v=>v.id),from,to}),
      sec('L_SEC_TEAM'), h('div', { class: 'grid-eq wide-first' }, team, h('div', { class: 'stack s16' }, why, S.scTeamCard(S.vsrs().map(v => v.id), from, to, true))),
      sec('L_SEC_ACT'), h('div', { class: 'grid-eq wide-first' }, oppCard, storeCard),
      sec('L_SEC_SELLS'), h('div', { class: 'grid-eq' }, skuCard, insCard), sec('L_JOURNEY_REVIEW'), S.journeyReview()] };
  });

  // long pages: a sticky row of section chips; each heading carries an id to scroll to
  S.jumpBar = ids => { requestAnimationFrame(() => { const tb = document.querySelector('.topbar'); if (tb && getComputedStyle(tb).position === 'sticky') document.documentElement.style.setProperty('--tb-h', tb.offsetHeight + 'px'); else document.documentElement.style.removeProperty('--tb-h'); });
    const mark = id => document.querySelectorAll('.jump-bar .al-type').forEach(b => { const on = b.dataset.sec === id; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'true' : 'false'); if (on) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
    if (typeof addEventListener === 'function') { if (S._spy) removeEventListener('scroll', S._spy);
      S._spy = () => { if (S._spyHold > Date.now()) return; const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tb-h')) || 0) + 90; let cur = ids[0];
      for (const id of ids) { const el = document.getElementById('sec-' + id); if (el && el.getBoundingClientRect().top <= top) cur = id; } mark(cur); };
    addEventListener('scroll', S._spy, { passive: true }); requestAnimationFrame(S._spy); }
    return h('nav', { class: 'jump-bar', 'aria-label': t('L_JUMP_TO') }, ids.map(id => h('button', { type: 'button', class: 'al-type', 'data-sec': id, on: { click: () => { const el = document.getElementById('sec-' + id); mark(id); S._spyHold = Date.now() + 900; if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); } } }, t(id)))); };
  // credit watch: per salesman, the share of open invoices past due against the 10% line, what to collect to get under it, and from whom
  S.creditWatch = () => { const s = st(), d = today();
    const rows = S.vans().filter(v => v.kind === 'sales').map(v => { const c = FD.kpiStatus(s, v.id, d).parts.collect;
      const need = Math.max(0, (c.overdue - FD.KPI_RULE.overdueMax * c.owed) / (1 - FD.KPI_RULE.overdueMax));
      const top = s.world.stores.filter(x => x.vsr === v.id && x.overdue > 0).sort((a, b) => b.overdue - a.overdue).slice(0, 3);
      return { v, c, need, top }; }).sort((a, b) => b.c.overduePct - a.c.overduePct);
    return S.card(t('L_CREDIT_WATCH'), t('L_CREDIT_WATCH_D'), FD.table({ id: 'creditWatch', rows, onRow: r => S.vsrDrawer(r.v.id, false, 'overview'), columns: [
      { key: 'v', label: t('L_COL_VSR'), render: r => h('b', null, FD.nameOf(r.v)) },
      { key: 'p', label: t('L_COL_OVERDUE'), num: true, sort: (a, b) => a.c.overduePct - b.c.overduePct, render: r => FD.chip(FD.fmt.pct(r.c.overduePct * 100) + ' · ' + FD.fmt.money0(r.c.overdue), r.c.overduePct >= FD.KPI_RULE.overdueMax ? 'bad' : 'good') },
      { key: 'n', label: t('L_COL_TO_COLLECT'), num: true, sort: (a, b) => a.need - b.need, render: r => r.need > 0 ? h('b', null, FD.fmt.money0(r.need)) : '—' },
      { key: 's', label: t('L_COL_COLLECT_FROM'), nosort: true, render: r => r.top.length ? h('span', { class: 'small' }, r.top.map(x => FD.nameOf(x) + ' ' + FD.fmt.money0(x.overdue)).join(' · ')) : '—' }] }), { flush: true, icon: 'wallet' }); };
  S.fuVsr = f => (f.slots && f.slots.vsrId) || null;
  // ================= DRAWERS =================
  S.fuCat = f => ({ F_WATCH_OK: 'WATCH', F_WATCH_BAD: 'WATCH', F_WATCHLIST: 'WATCH', F_COMPETITOR: 'COMP', F_GAP_CLUSTER: 'COMP', F_ENGINE_MISS: 'PROD', F_PROMO_LOW: 'PROD', F_CREDIT: 'CREDIT', F_WA_PAID: 'CREDIT' })[f.tpl] || 'OTHER';
  S.followupsDrawer = () => FD.drawer.open({ title: t('L_FOLLOWUPS_ALL'), render: () => {
    // shared items only: anything for one salesman lives in that salesman's block on Today
    const shared = FD.followUps(st()).filter(inRoute).filter(f => !S.fuVsr(f)).sort((a, b) => a.pri - b.pri);
    const CAT = S.fuCat;
    const fType = L['fu:type'] || 'ALL', all = shared.filter(f => fType === 'ALL' || CAT(f) === fType);
    const typeBar = h('div', { class: 'al-types', style: { padding: '0 0 4px', border: 0 } }, ['ALL', 'PROD', 'COMP', 'WATCH', 'CREDIT', 'OTHER'].map(k => [k, k === 'ALL' ? shared.length : shared.filter(f => CAT(f) === k).length]).filter(([k, n]) => k === 'ALL' || n)
      .map(([k, n]) => h('button', { type: 'button', class: 'al-type' + (fType === k ? ' on' : ''), 'aria-pressed': String(fType === k), on: { click: () => { L['fu:type'] = k; FD.drawer.refresh(); } } }, t('L_FUT_' + k), h('span', { class: 'tabular' }, FD.fmt.num(n)))));
    const drafts = FD.coachDrafts(st()).filter(d => !S.f.route || vsrOf(d.vsr).route === S.f.route);
    if (drafts.length) typeBar.appendChild(h('button', { type: 'button', class: 'al-type fu-jump', on: { click: () => { const el = document.getElementById('fu-tips'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } } },
      I('bulb', 's14'), t('L_TIP_DRAFTS'), h('span', { class: 'tabular' }, FD.fmt.num(drafts.length)), I('arrow-down', 's14')));
    const tab = L['fu:tab'] || 'open';
    const tabs = h('div', { class: 'tabs', style: { padding: 0 } }, [['open', 'L_FU_OPEN', all.length], ['done', 'L_FU_DONE', st().fuHistory.length]].map(([id, lb, n]) => h('button', { type: 'button', class: tab === id ? 'on' : '', on: { click: () => { L['fu:tab'] = id; FD.drawer.refresh(); } } }, t(lb), ' ', h('span', { class: 'pill-count' }, FD.fmt.num(n)))));
    if (tab === 'done') return h('div', { class: 'stack s16' }, tabs, S.fuHistoryList(null));
    return h('div', { class: 'stack s16' }, tabs, shared.length || drafts.length ? typeBar : null, h('div', { class: 'card' }, all.length ? all.map(S.fuRow) : FD.empty('X_FU_DONE', { time: '' })),
      drafts.length ? h('div', { id: 'fu-tips', style: { scrollMarginTop: '8px' } }, h('h3', { style: { fontSize: '14px', margin: '0 0 8px' } }, t('L_TIP_DRAFTS')), h('div', { class: 'card' }, S.draftGroups(drafts))) : null);
  } });
  // ---- follow-up detail: what happened, what is pending, what was done ----
  const HOW_TEXT = h2 => FD.has(h2) ? t(h2) : h2;
  S.fuHistoryList = function (key) {
    const hist = st().fuHistory.filter(x => !key || x.key === key).slice().reverse();
    if (!hist.length) return h('div', { class: 'card' }, FD.empty('L_NONE_YET', null, 'clock'));
    return h('div', { class: 'card' }, hist.slice(0, 80).map(x => h('div', { class: 'list-row', style: { alignItems: 'flex-start' } },
      h('span', { class: 'fu-ic' }, I(x.how === 'L_SNOOZE' ? 'clock' : x.how === 'FU_UNDO' ? 'undo' : x.how === 'FU_IRRELEVANT' ? 'x' : 'check', 's16')),
      h('div', { class: 'grow', style: { minWidth: 0 } }, key ? null : h('div', { class: 'fu-t' }, x.snap ? tx(x.snap.tpl, x.snap.slots) : x.key.split('|')[0]),
        h('div', { class: 'fu-c' }, t('L_DONE_VIA', { status: HOW_TEXT(x.how), date: FD.fmt.date(x.at.date), time: FD.fmt.time(x.at.time) }))),
      !key && st().followupDone[x.key] ? FD.btn(t('S_UNDO'), () => FD.dx('FOLLOWUP_UNDO', { fu: x.key }), 'ghost sm') : null)));
  };
  S.fuEvidence = function (f) {
    const s = st(); const sl = f.slots; const recRow = r => h('button', { type: 'button', class: 'list-row click', style: { width: '100%', textAlign: 'start' }, on: { click: () => S.recDrawer(r.id, true) } },
      h('div', { class: 'grow', style: { minWidth: 0 } }, FD.skuLabel(r.sku, FD.nameOf(storeOf(r.store)) + ' · ' + FD.fmt.date(r.date))), S.outcomeChip(r), I('chevron-right', 's16'));
    const storeRow = id => h('button', { type: 'button', class: 'list-row click', style: { width: '100%', textAlign: 'start' }, on: { click: () => S.storeDrawer(id, null, true) } }, h('div', { class: 'grow' }, storeCell(storeOf(id))), I('chevron-right', 's16'));
    const last7 = r => r.date <= today() && FD.daysBetween(r.date, today()) < 7;
    let items = [], pending = 0;
    switch (f.tpl) {
      case 'F_PLANOGRAM': items=[S.pgContent(sl.storeId,{assessmentId:f.action.assessmentId})];pending=sl.n;break;
      case 'F_MISSING_REASONS': items = s.recs.filter(r => FD.recVsr(r) === sl.vsrId && ['NOT_SOLD', 'NOT_OFFERED'].includes(r.outcome) && !r.reason && !r.exempted && r.date < today()).sort((a, b) => b.date.localeCompare(a.date)); pending = items.length; items = items.slice(0, 25).map(recRow); break;
      case 'F_REPEAT_DECLINE': items = s.recs.filter(r => r.sku === sl.skuCode && r.reason === sl.reasonCode && r.outcome === 'NOT_SOLD' && last7(r)).map(recRow); break;
      case 'F_COMPETITOR': items = s.recs.filter(r => r.reason === 'R_COMPETITOR' && r.brand === sl.brandId && last7(r)).map(recRow); break;
      case 'F_RETURN_UPSELL': items = s.recs.filter(r => r.store === sl.storeId && r.maturity === 'RETURNED').map(recRow); break;
      case 'F_GAP_CLUSTER': items = (f.action.stores || []).map(storeRow); pending = (f.action.stores || []).length; break;
      case 'F_CREDIT': case 'F_ASSIGN_PENDING': items = [storeRow(sl.storeId)]; break;
      case 'F_WATCH_OK': case 'F_WATCH_BAD': items = [S.watchCard(sl.skuCode)]; break;
      case 'F_ENGINE_MISS': items = s.misses.filter(m => m.sku === sl.skuCode && m.type === 'UNREC' && last7(m)).map(m => storeRow(m.store)); break;
      case 'F_SKIPPED': items = FD.planFor(s, sl.vsrId, today()).stops.filter(x => x.status === 'SKIPPED').map(x => storeRow(x.store)); break;
      case 'F_CORRECTION': { const c = s.corrections.find(x => x.id === f.action.id); items = [h('div', { class: 'list-row' }, h('div', null, h('b', null, t(c.kind)), c.comment ? h('div', { class: 'small', dir: 'auto' }, c.comment) : null))]; pending = c.status === 'PENDING' ? 1 : 0; break; }
      case 'F_VSR_MSG': case 'F_VSR_STORE_MSG': case 'F_VSR_COMMENT': { const th = s.threads.find(x => x.id === f.action.thread); items = th ? th.messages.slice(-4).map(m => h('div', { class: 'list-row' }, h('div', { class: 'grow', dir: 'auto' }, m.text || t('L_PHOTO')), h('span', { class: 'small muted' }, FD.fmt.time(m.at.time)))) : []; pending = th && th.unreadSup ? 1 : 0; break; }
      default: items = sl.storeId ? [storeRow(sl.storeId)] : [];
    }
    return { items, pending };
  };
  S.fuDetail = function (f) {
    FD.drawer.open({ title: () => tx(f.tpl, f.slots), render: () => {
      const ev = S.fuEvidence(f); const still = FD.followUps(st()).find(x => x.key === f.key);
      return h('div', { class: 'stack s16' },
        h('div', { class: 'row', style: { gap: '12px' } }, h('span', { class: 'fu-ic p' + f.pri }, I('info', 's16')), h('div', { class: 'grow' }, h('div', { class: 'fu-c', style: { fontSize: '13px' } }, tx(f.tpl + '_C', f.slots)))),
        h('div', { class: 'row wrap' }, still ? FD.btn(t(f.action.label), e => S.act(f, e.currentTarget), 'primary sm') : FD.chip(t('L_FU_DONE'), 'good'),
          still ? FD.btn(t('L_SNOOZE'), () => { FD.dx('FOLLOWUP_SNOOZE', { fu: f.key, snap: { tpl: f.tpl, slots: f.slots } }); FD.drawer.close(); }, 'secondary sm', 'clock') : null,
          still ? FD.btn(t('L_DISMISS'), () => { FD.dx('FOLLOWUP_DISMISS', { fu: f.key, why: 'FU_HANDLED', snap: { tpl: f.tpl, slots: f.slots } }); FD.drawer.close(); }, 'ghost sm', 'check') : null),
        h('div', null, h('h3', { class: 'sec-h' }, t('L_WHAT_HAPPENED')), ev.items.length ? h('div', { class: 'card' }, ev.items) : h('div', { class: 'card' }, FD.empty('X_FILTER'))),
        h('div', null, h('h3', { class: 'sec-h' }, t('L_STILL_PENDING')), h('div', { class: 'card', style: { padding: '12px 14px' } }, still ? (ev.pending ? t('L_PENDING_N', { n: FD.fmt.num(ev.pending) }) : tx(f.tpl + '_C', f.slots)) : t('L_NOTHING_PENDING'))),
        h('div', null, h('h3', { class: 'sec-h' }, t('L_ACTIONS_TAKEN')), S.fuHistoryList(f.key)));
    } }, {});
  };
  S.draftRow = (d, inVsr) => h('div', { class: 'fu-row' }, inVsr ? h('span', { class: 'fu-ic' }, I('bulb', 's16')) : FD.avatar(vsrOf(d.vsr)),
    h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'fu-t' }, tx(d.tpl + '_T', d.slots)), h('div', { class: 'fu-c', style: { whiteSpace: 'normal' } }, (inVsr ? '' : FD.nameOf(vsrOf(d.vsr)) + ' · ') + tx(d.tpl, d.slots))),
    FD.btn(t('L_SEND'), () => S.tipComposer(d.vsr, d.tpl, d.slots, d.key, () => FD.sheet.redraw()), 'secondary sm'), FD.iconBtn('edit', t('L_TIP_MODE_OWN'), () => S.tipComposer(d.vsr, 'K_CUSTOM', {}, d.key)),
    FD.iconBtn('x', t('L_DISMISS'), () => { FD.dx('TIP_DISMISS', { draftKey: d.key }); FD.toast(null, null, { text: t('L_DISMISS') }); FD.sheet.redraw(); }));

  // Suggested tips go to one salesman at a time, so they are listed that way: salesman · n tips → open → review → send
  S.draftGroups = drafts => { const by = []; for (const d of drafts) { let g = by.find(x => x.vsr === d.vsr); if (!g) by.push(g = { vsr: d.vsr, ds: [] }); g.ds.push(d); }
    return h('div', null, by.map(g => h('button', { type: 'button', class: 'list-row click draft-group', on: { click: () => S.draftSheet(g.vsr) } },
      FD.avatar(vsrOf(g.vsr)), h('span', { class: 'grow' }, h('span', { class: 'fu-t', style: { display: 'block' } }, FD.nameOf(vsrOf(g.vsr))), h('span', { class: 'fu-c', style: { display: 'block' } }, t(g.ds.length === 1 ? 'L_TIPS_1' : 'L_TIPS_N', { n: FD.fmt.num(g.ds.length) }))),
      h('button', { type: 'button', class: 'btn secondary sm', on: { click: e => { e.stopPropagation(); S.sendDrafts(g.vsr); } } }, I('send', 's14'), t('L_SEND_ALL', { n: FD.fmt.num(g.ds.length) }))))); };
  S.tipsDrawer = () => FD.drawer.open({ title: t('L_TIP_DRAFTS'), render: () => { const ds = FD.coachDrafts(st()).filter(d => !S.f.route || vsrOf(d.vsr).route === S.f.route);
    return ds.length ? h('div', { class: 'card' }, S.draftGroups(ds)) : h('div', { class: 'card' }, FD.empty('L_TIPS_DONE', null, 'check-circle')); } });
  S.sendDrafts = vsrId => { const ds = FD.coachDrafts(st()).filter(d => d.vsr === vsrId); ds.forEach(d => FD.dx('TIP_SEND', { vsr: d.vsr, tpl: d.tpl, slots: d.slots, draftKey: d.key })); FD.toast('S_SENT', { vsrId }); FD.render(); FD.drawer.refresh(false); };
  S.draftSheet = vsrId => FD.sheet.open({ center: true, title: () => t('L_TIP_DRAFTS') + ' · ' + FD.nameOf(vsrOf(vsrId)), render: () => { const ds = FD.coachDrafts(st()).filter(d => d.vsr === vsrId);
      return ds.length ? h('div', { class: 'card' }, ds.map(d => S.draftRow(d, true))) : FD.empty('L_NONE_YET', null, 'check'); },
    footer: () => { const ds = FD.coachDrafts(st()).filter(d => d.vsr === vsrId); return [FD.btn(t('L_CANCEL'), () => FD.sheet.close(), 'secondary'), h('span', { class: 'grow' }),
      ds.length ? FD.btn(t('L_SEND_ALL', { n: FD.fmt.num(ds.length) }), () => { FD.sheet.close(); S.sendDrafts(vsrId); }, 'primary', 'send') : null]; } });
  S.tipComposer = function (vsrId, tpl, slots, draftKey, onSent, preset={}) {
    const templates = ['K_PRICE', 'K_ENOUGH', 'K_NO_SHELF', 'K_BUYER_NO', 'K_COMPETITOR', 'K_BUYER_ABSENT', 'K_NOT_OFFERED', 'K_REASONS', 'K_RETURN', 'K_PROMO', 'K_GOOD'];
    const X = { vsr: vsrId, tpl, text: preset.text||null, title: preset.title||'', slots: Object.assign({}, slots) };
    const fill = () => { const sl = X.slots; if (!sl.skuCode && ['K_PRICE', 'K_COMPETITOR'].includes(X.tpl)) Object.assign(sl, FD.tipSlots('3040421754')); if (X.tpl === 'K_COMPETITOR' && !sl.brandId) sl.brandId = 'BR_LUSINE';
      if (X.tpl === 'K_BUYER_ABSENT' && !sl.storeId) { sl.storeId = st().world.stores.find(s => s.vsr === X.vsr).id; sl.n = sl.n || 3; } if (X.tpl === 'K_RETURN' && !sl.unitOf) sl.unitOf = '3040421754';
      if (X.tpl === 'K_PROMO' && !sl.promoId) { const p = st().world.promos.find(q => q.end >= today()); sl.promoId = p.promoId; sl.date = p.end; } if (X.tpl === 'K_GOOD' && sl.pct == null) sl.pct = 10; };
    fill();
    FD.sheet.open({ center: true, title: t('L_SEND_TIP'), render: () => {
      const custom = X.tpl === 'K_CUSTOM';
      const ta = h('textarea', { class: 'textarea', dir: 'auto', rows: '4', 'aria-label': t('L_EDIT_TEXT'), placeholder: custom ? t('L_TIP_BODY') : '', on: { input: e => { X.text = e.target.value; } } }); ta.value = X.text ?? (custom ? '' : tx(X.tpl, X.slots));
      const ti = h('input', { class: 'input', dir: 'auto', placeholder: t('L_TIP_TITLE'), 'aria-label': t('L_TIP_TITLE'), value: X.title, on: { input: e => { X.title = e.target.value; } } });
      return h('div', { class: 'stack s16' },
        h('div', { class: 'field' }, h('label', null, t('L_TO_VSR')), FD.select(st().world.vsrs.map(v => ({ id: v.id, label: FD.nameOf(v) })), X.vsr, v => { X.vsr = v; })),
        FD.seg([{ id: 'tpl', label: t('L_TIP_MODE_TPL') }, { id: 'own', label: t('L_TIP_MODE_OWN') }], custom ? 'own' : 'tpl', v => { if (v === 'own') { X.last = X.tpl; X.tpl = 'K_CUSTOM'; } else X.tpl = X.last && X.last !== 'K_CUSTOM' ? X.last : 'K_REASONS'; X.text = null; fill(); FD.sheet.redraw(); }),
        custom ? null : h('div', { class: 'field' }, h('label', null, t('L_TEMPLATE')), FD.select(templates.map(k => ({ id: k, label: t(k + '_T').replace(/\{\w+\}/g, '…') })), X.tpl, v => { X.tpl = v; X.text = null; fill(); FD.sheet.redraw(); })),
        custom ? h('div', { class: 'field' }, h('label', null, t('L_TIP_TITLE')), ti) : null,
        h('div', { class: 'field' }, h('label', null, t('L_EDIT_TEXT')), ta));
    }, footer: () => [FD.btn(t('L_CANCEL'), () => FD.sheet.close(), 'secondary'), h('span', { class: 'grow' }),
      FD.btn(t('L_SEND'), () => { if (X.tpl === 'K_CUSTOM') { if (!X.title.trim() || !(X.text || '').trim()) return FD.toast('S_COMMENT_REQ'); X.slots = { tip_title: X.title.trim(), tip: X.text.trim() }; }
        const edited = X.tpl !== 'K_CUSTOM' && X.text != null && X.text.trim() !== tx(X.tpl, X.slots) ? X.text.trim() : null;
        FD.dx('TIP_SEND', { vsr: X.vsr, tpl: X.tpl, slots: X.slots, text: edited, draftKey }); FD.sheet.close(); FD.toast('S_SENT', { vsrId: X.vsr }); if (onSent) onSent(); setTimeout(() => FD.chatPopup({ type: 'vsr', id: X.vsr }, 'SUP'), 340); }, 'primary', 'send')] });
  };

  S.correctionSheet = function (id) {
    const c = st().corrections.find(x => x.id === id);
    FD.sheet.open({ center: true, title: tx('F_CORRECTION', { vsrId: c.vsr, storeId: c.store }), render: () => h('div', { class: 'stack s8' },
      h('div', null, h('b', null, t(c.kind))), c.comment ? h('div', { class: 'bubble them', dir: 'auto' }, c.comment) : null,
      h('div', { class: 'small muted' }, FD.fmt.date(c.at.date) + ' ' + FD.fmt.time(c.at.time))),
      footer: () => [FD.btn(t('L_REJECT'), () => { FD.dx('CORRECTION_DECIDE', { id, accept: false }); FD.sheet.close(); FD.toast('S_SAVED'); }, 'secondary'), h('span', { class: 'grow' }),
        FD.btn(t('L_EDIT') + ' · ' + t('L_NAV_STORES'), () => { FD.sheet.close(); S.storeEditSheet(c.store); }, 'ghost'),
        FD.btn(t('L_ACCEPT'), () => { FD.dx('CORRECTION_DECIDE', { id, accept: true }); FD.sheet.close(); FD.toast('S_SAVED'); }, 'primary', 'check')] });
  };



  // Why-not-sold drawer with inline actions (Exempt, Reply, Tip)
  S.reasonDrawer = function (filter) {
    FD.drawer.open({ title: () => filter.group ? t(filter.group) : filter.reason ? t(filter.reason) : t('L_P_WHY'), render: () => {
      const loc = L['rd:f'] = L['rd:f'] || {};
      let rs = S.recs().filter(r => ['NOT_SOLD', 'NOT_OFFERED'].includes(r.outcome) && (!filter.kind || r.outcome === filter.kind));
      if (filter.group === 'R_NONE') rs = rs.filter(r => !r.reason && !r.exempted);
      else if (filter.group === 'R_OTHER') rs = rs.filter(r => r.reason === 'R_OTHER');
      else if (filter.group) rs = rs.filter(r => (FD.REASON_GROUPS[filter.group] || []).includes(r.reason));
      if (filter.reason) rs = rs.filter(r => r.reason === filter.reason);
      if (filter.brand) rs = rs.filter(r => r.brand === filter.brand);
      if (loc.vsr) rs = rs.filter(r => FD.recVsr(r) === loc.vsr); if (loc.sku) rs = rs.filter(r => r.sku === loc.sku);
      rs.sort((a, b) => b.date.localeCompare(a.date));
      const codes = {}; rs.forEach(r => { const k = r.reason || 'R_NONE'; codes[k] = (codes[k] || 0) + 1; });
      const skusIn = [...new Set(rs.map(r => r.sku))];
      return h('div', { class: 'stack s16' },
        Object.keys(codes).length > 1 ? FD.bars(Object.entries(codes).sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ label: t(c), value: n }))) : null,
        h('div', { class: 'filters' }, FD.select([{ id: '', label: t('L_ALL_VSRS') }].concat(S.vsrs().map(v => ({ id: v.id, label: FD.nameOf(v) }))), loc.vsr || '', v => { loc.vsr = v; FD.drawer.refresh(); }),
          FD.select([{ id: '', label: t('L_OPEN_SKUS') }].concat(skusIn.map(c => ({ id: c, label: FD.nameOf(FD.sku(c)) }))), loc.sku || '', v => { loc.sku = v; FD.drawer.refresh(); }),
          FD.chip(FD.fmt.num(rs.length), 'info')),
        rs.length ? h('div', { class: 'card' }, rs.slice(0, 60).map(r => h('div', { class: 'list-row', style: { alignItems: 'flex-start' } },
          h('div', { class: 'grow', style: { minWidth: 0 } }, FD.skuLabel(r.sku),
            h('div', { class: 'small muted ellipsis' }, FD.nameOf(storeOf(r.store)) + ' · ' + FD.nameOf(vsrOf(FD.recVsr(r))) + ' · ' + FD.fmt.date(r.date)),
            h('div', { class: 'row wrap', style: { marginTop: '6px', gap: '6px' } }, outcomeChip(r), reasonCell(r), r.comment ? FD.chip([I('message', 's14'), h('bdi', null, r.comment.slice(0, 40))], 'outline') : null, r.photo ? h('button', { type: 'button', class: 'chip chip-btn', on: { click: () => FD.lightbox(r.photo) } }, I('image', 's14'), t('L_PHOTO')) : null)),
          h('div', { class: 'row', style: { gap: 0 } },
            r.exempted ? FD.iconBtn('undo', t('L_UNEXEMPT'), () => FD.dx('UNEXEMPT', { recId: r.id })) : FD.iconBtn('check', t('L_EXEMPT'), () => S.exemptSheet(r.id)),
            FD.iconBtn('message', t('L_REPLY'), () => FD.threadSheet({ type: 'rec', id: r.id }, 'SUP')),
            FD.iconBtn('bulb', t('L_SEND_TIP'), () => S.tipComposer(FD.recVsr(r), FD.K_BY_REASON[r.reason] || 'K_REASONS', FD.tipSlots(r.sku))),
            FD.iconBtn('chevron-right', t('L_OPEN'), () => S.recDrawer(r.id, true)))))) : FD.empty('X_FILTER'));
    } });
  };
  S.exemptSheet = function (recId) {
    let note = '';
    FD.sheet.open({ center: true, title: t('L_EXEMPT'), render: () => h('div', { class: 'field' }, h('label', null, t('L_EXEMPT_NOTE')), h('textarea', { class: 'textarea', on: { input: e => { note = e.target.value; } } })),
      footer: () => [FD.btn(t('L_CANCEL'), () => FD.sheet.close(), 'secondary'), h('span', { class: 'grow' }), FD.btn(t('L_EXEMPT'), () => { FD.dx('EXEMPT', { recId, note }); FD.sheet.close(); FD.toast('S_EXEMPTED', null, { undo: () => FD.dx('UNEXEMPT', { recId }) }); }, 'primary')] });
  };

  // Recommendation drawer: journey timeline + actions
  S.recDrawer = function (recId, push) {
    FD.drawer.open({ title: () => { const r = st().recs.find(x => x.id === recId); return r ? FD.nameOf(FD.sku(r.sku)) : ''; }, render: () => {
      const s = st(); const r = s.recs.find(x => x.id === recId); if (!r) return null;
      const sku = FD.sku(r.sku); const q = r.qtyModified ?? r.qty;
      const steps = [['ST_GEN', true, FD.fmt.date(r.date) + ' 07:00'], ['ST_SENT', true, ''], ['ST_VIEWED', r.stage === 'VIEWED' || !!r.outcome, r.viewedAt ? FD.fmt.time(r.viewedAt) : ''],
        ['ST_OFFERED', r.outcome && r.outcome !== 'NOT_OFFERED', ''], ['ST_OUTCOME', !!r.outcome && r.outcome !== 'WAITING', r.gradedAt ? FD.fmt.time(r.gradedAt) : ''], ['ST_MATURITY', r.maturity === 'SUSTAINED' || r.maturity === 'RETURNED', r.maturity ? '' : '']];
      const recM = FD.recMsgs(s, r.id);
      return h('div', { class: 'stack s16' },
        h('div', { class: 'row', style: { gap: '10px' } }, FD.skuTile(r.sku, 32), h('span', { class: 'muted' }, FD.nameOf(storeOf(r.store)))),
        h('div', { class: 'row wrap' }, FD.typeChip(r.type), outcomeChip(r), matChip(r), r.corrected ? FD.chip(t('E_CORRECTED')) : null, r.blockedAt ? FD.chip(t('E_BLOCKED'), 'bad') : null, r.exempted ? FD.chip(t('E_EXEMPTED'), 'info') : null),
        h('div', { class: 'card', style: { padding: '14px' } }, h('div', { style: { marginBottom: '8px' } }, tx(r.reasonId, Object.assign({ skuCode: r.sku }, r.slots, { unitOf: r.sku }))),
          h('dl', { class: 'kv' }, h('dt', null, t('L_STORE')), h('dd', null, h('a', { href: '#', on: { click: e => { e.preventDefault(); S.storeDrawer(r.store, r.sku, true); } } }, FD.nameOf(storeOf(r.store)))),
            h('dt', null, t('L_COL_VSR')), h('dd', null, FD.nameOf(vsrOf(FD.recVsr(r))) + (r.coveredBy ? ' · ' + tx('D_COVER', { vsrId: r.vsr }) : '')),
            h('dt', null, t('L_QTY_SUGGESTED')), h('dd', null, tx('C_QTY', { qty: r.qty, unitOf: r.sku, pcs: r.qty * sku.pcs }).replace(/^[^:]*:s*/, '')),
            r.qtyModified ? h('dt', null, t('L_QTY_CHANGED')) : null, r.qtyModified ? h('dd', null, FD.fmt.num(r.qtyModified)) : null,
            h('dt', null, t('L_EST_MARGIN')), h('dd', null, FD.fmt.money(r.ev)),
            r.prevOutcome ? h('dt', null, t('E_CORRECTED')) : null, r.prevOutcome ? h('dd', null, t('L_PREV_OUTCOME', { status: t('E_' + (r.prevOutcome === 'NOT_SOLD' ? 'NOT_SOLD' : 'FULL')) })) : null,
            (r.reason || r.exempted || ['NOT_SOLD', 'NOT_OFFERED'].includes(r.outcome)) ? h('dt', null, t('L_REASON')) : null, (r.reason || r.exempted || ['NOT_SOLD', 'NOT_OFFERED'].includes(r.outcome)) ? h('dd', null, reasonCell(r)) : null,
            r.exemptNote ? h('dt', null, t('L_NOTE')) : null, r.exemptNote ? h('dd', { dir: 'auto' }, r.exemptNote) : null,
            r.comment ? h('dt', null, t('L_COMMENT')) : null, r.comment ? h('dd', { dir: 'auto' }, r.comment) : null),
          r.photo ? h('img', { src: r.photo, alt: '', style: { marginTop: '10px', maxWidth: '100%', borderRadius: '10px', cursor: 'zoom-in' }, on: { click: () => FD.lightbox(r.photo) } }) : null),
        h('div', null, h('h3', { style: { fontSize: '14px', margin: '0 0 10px' } }, t('L_STAGES')), h('div', { class: 'timeline' }, steps.map(([id, done, when]) =>
          h('div', { class: 'tl' + (done ? ' done' : '') }, h('span', { class: 'd' }, done ? I('check') : null), h('span', null, t(id)), h('span', { class: 'small muted' }, when))))),
        h('div', { class: 'row wrap' },
          FD.btn(recM.length ? t('L_MESSAGES') + ' (' + FD.fmt.num(recM.length) + ')' : t('L_REPLY'), () => FD.threadSheet({ type: 'rec', id: r.id }, 'SUP'), 'secondary', 'message'),
          ['NOT_SOLD', 'NOT_OFFERED'].includes(r.outcome) ? (r.exempted ? FD.btn(t('L_UNEXEMPT'), () => FD.dx('UNEXEMPT', { recId: r.id }), 'secondary', 'undo') : FD.btn(t('L_EXEMPT'), () => S.exemptSheet(r.id), 'secondary', 'check')) : null,
          r.date === today() && r.outcome === null && !r.blockedAt ? FD.btn(t('L_BLOCK_REC'), () => { FD.dx('BLOCK_ADD', { recId: r.id }); FD.toast('S_BLOCKED', { vsrId: FD.recVsr(r) }, { undo: () => { const b = st().blocks.find(x => x.recId === r.id); if (b) FD.dx('BLOCK_REMOVE', { blockId: b.id }); } }); }, 'danger', 'ban') : null,
          (() => { if (!(['NOT_SOLD', 'NOT_OFFERED'].includes(r.outcome) && r.reason && !FD.NO_COOLDOWN.includes(r.reason))) return null; const until = FD.addDays(r.date, s.rules.cooldownDays);
            if ((s.cooldownOverrides || []).includes(r.store + '|' + r.sku)) return FD.chip([I('check', 's14'), t('L_ALLOWED_AGAIN')], 'good');
            if (today() >= until) return null;
            return h('div', { class: 'hold-box' }, h('div', { class: 'small' }, I('clock', 's14'), ' ', t('L_ON_HOLD_UNTIL', { date: FD.fmt.date(until), label: FD.fmt.date(r.date) })),
              FD.btn(t('L_OVERRIDE_CD'), () => { FD.dx('COOLDOWN_OVERRIDE', { store: r.store, sku: r.sku }); FD.toast('S_SAVED'); }, 'secondary sm', 'refresh')); })()));
    } }, { push });
  };

  // VSR drawer / page content
  // ---------- supervisor edits a salesman's plan for today ----------
  S.recEditSheet = function (o) { const s = st(); const r = o.recId && s.recs.find(x => x.id === o.recId); const store = r ? r.store : o.store;
    const here = s.recs.filter(x => x.store === store && x.date === today() && (!x.blockedAt || x.supRemoved) && (!r || x.id !== r.id)).map(x => x.sku);
    const X = { sku: r ? r.sku : (FD.SKUS.find(k => !here.includes(k.code) && !FD.carries(s, store, k.code, today())) || FD.SKUS[0]).code, qty: r ? (r.qtyModified ?? r.qty) : 1 };
    FD.sheet.open({ center: true, title: t(r ? 'L_CHANGE_REC' : 'L_ADD_PRODUCT') + ' · ' + FD.nameOf(storeOf(store)), render: () => h('div', { class: 'stack s16' },
      h('div', { class: 'field' }, h('label', null, t('L_PRODUCT')), FD.select(FD.SKUS.filter(k => !here.includes(k.code)).map(k => ({ id: k.code, label: FD.nameOf(k) + (FD.carries(s, store, k.code, today()) ? ' · ' + t('L_CARRIED_HERE') : '') })), X.sku, v => { X.sku = v; FD.sheet.redraw(); })),
      h('div', { class: 'row between' }, FD.skuLabel(X.sku), FD.stepper(X.qty, 1, 20, v => { X.qty = Math.max(1, Math.min(20, v)); }, t('L_COL_QTY'))),
      h('div', { class: 'small muted' }, t('L_PLAN_NOTE'))),
      footer: () => [FD.btn(t('L_CANCEL'), () => FD.sheet.close(), 'secondary'), h('span', { class: 'grow' }), FD.btn(t('L_SAVE'), () => {
        if (r) FD.dx('SUP_REC_EDIT', { recId: r.id, sku: X.sku !== r.sku ? X.sku : null, qty: X.qty }); else FD.dx('SUP_REC_ADD', { store, sku: X.sku, qty: X.qty });
        FD.sheet.close(); FD.toast('S_SAVED'); }, 'primary')] }); };
  S.addVisitSheet = function (vsrId, day) { const s = st(); const d = day || today(); const inPlan = new Set(FD.planFor(s, vsrId, d).stops.filter(x => x.status !== 'SKIPPED').map(x => x.store));
    const opts = s.world.stores.filter(x => (x.vsr === vsrId || FD.routeOwner(s, x.route, d) === vsrId) && !inPlan.has(x.id)).sort((a, b) => FD.nameOf(a).localeCompare(FD.nameOf(b)));
    if (!opts.length) return FD.toast(null, null, { text: t('X_FILTER') });
    let pick = opts[0].id;
    FD.sheet.open({ center: true, title: t('L_ADD_STORE_VISIT'), render: () => h('div', { class: 'stack s16' }, h('div', { class: 'field' }, h('label', null, t('L_STORE')), FD.select(opts.map(x => ({ id: x.id, label: FD.nameOf(x) })), pick, v => { pick = v; })), h('div', { class: 'small muted' }, t('L_PLAN_NOTE'))),
      footer: () => [FD.btn(t('L_CANCEL'), () => FD.sheet.close(), 'secondary'), h('span', { class: 'grow' }), FD.btn(t('L_ADD'), () => { FD.dx('OFFPLAN_ADD', { vsr: vsrId, store: pick, bySup: true, date: d }); FD.sheet.close(); FD.drawer.refresh(); FD.toast('S_SAVED'); }, 'primary', 'plus')] }); };
  S.planEditor = function (vsrId, o = {}) {
    const s = st(); const d = o.date || today(); const others = s.world.vsrs.filter(x => x.id !== vsrId && x.kind === 'sales');
    const sales = sid => s.orders.filter(q => q.date === d && q.store === sid && q.vsr === vsrId).reduce((a, q) => a + q.value, 0);
    if (!FD.isSellingDay(d)) return FD.empty('L_NO_PLAN_TODAY', null, 'calendar');
    const plan = FD.planFor(s, vsrId, d); const confirmed = s.dayConfirmed[vsrId + '|' + d];
    // arrows move a stop past the next still-planned stop (visited stops keep their place)
    const near = (j, dir) => { for (let k = j + dir; k >= 0 && k < plan.stops.length; k += dir) if (plan.stops[k].status === 'PLANNED') return k; return -1; };
    const move = (j, dir) => { const k = near(j, dir); if (k >= 0) FD.dx('STOP_SWAP', { a: plan.stops[j].id, b: plan.stops[k].id }); };
    // drag a planned stop by its handle; cards move as you drag, the new order is saved on release
    // the card follows the pointer while held; the others make room as it passes them
    const drag = e => { const card = e.currentTarget.closest('.plan-stop'), list = card.parentNode; e.preventDefault(); card.classList.add('dragging');
      const grab = e.clientY - card.getBoundingClientRect().top;
      const follow = y => { card.style.transform = ''; card.style.transform = 'translateY(' + (y - grab - card.getBoundingClientRect().top) + 'px)'; };
      const over = ev => { lastY = ev.clientY; const tgt = [...list.querySelectorAll('.plan-stop[data-planned]')].find(c => c !== card && (r => ev.clientY > r.top && ev.clientY < r.bottom)(c.getBoundingClientRect()));
        if (tgt) { const r = tgt.getBoundingClientRect(); list.insertBefore(card, ev.clientY < r.top + r.height / 2 ? tgt : tgt.nextSibling); }
        follow(ev.clientY); };
      // near the top or bottom edge of the scrolling area the list scrolls on its own (faster closer to the edge), so a stop can go anywhere
      let lastY = e.clientY, sc = list; while (sc && sc !== document.body && !(/(auto|scroll)/.test(getComputedStyle(sc).overflowY) && sc.scrollHeight > sc.clientHeight)) sc = sc.parentElement;
      if (!sc || sc === document.body) sc = document.scrollingElement;
      const auto = setInterval(() => { const box = sc === document.scrollingElement ? { top: 0, bottom: innerHeight } : sc.getBoundingClientRect(), edge = 70;
        const v = lastY < box.top + edge ? -(box.top + edge - lastY) : lastY > box.bottom - edge ? lastY - (box.bottom - edge) : 0;
        if (v) { sc.scrollTop += Math.max(-24, Math.min(24, v / 3)); over({ clientY: lastY }); } }, 16);
      const up = () => { clearInterval(auto); removeEventListener('pointermove', over); removeEventListener('pointerup', up); card.classList.remove('dragging'); card.style.transform = '';
        FD.dx('STOP_ORDER', { ids: [...list.querySelectorAll('.plan-stop[data-planned]')].map(c => c.dataset.stop) }); };
      addEventListener('pointermove', over); addEventListener('pointerup', up); };
    const recRow = r => { const removed = r.supRemoved; const open = r.outcome === null && !r.blockedAt;
      return h('div', { class: 'list-row plan-rec' + (removed ? ' removed' : '') }, h('div', { class: 'grow', style: { minWidth: 0 } }, FD.skuLabel(r.sku, h('span', { class: 'row', style: { gap: '6px' } }, FD.typeChip(r.type), FD.fmt.num(r.qtyModified ?? r.qty) + ' ' + FD.unitWord(r.sku, r.qtyModified ?? r.qty)))),
        removed ? FD.chip(t('L_REMOVED'), 'bad') : r.supEdited ? FD.chip(t(r.supEdited.prev ? 'L_CHANGED_BY_YOU' : 'L_ADDED_BY_YOU'), 'info') : null,
        r.outcome ? outcomeChip(r) : null,
        removed ? FD.btn(t('L_RESTORE'), () => FD.dx('SUP_REC_RESTORE', { recId: r.id }), 'ghost sm', 'undo') : open ? h('div', { class: 'row', style: { gap: '2px' } },
          FD.iconBtn('edit', t('L_CHANGE_REC'), () => S.recEditSheet({ recId: r.id })), FD.iconBtn('trash', t('L_REMOVE'), () => { FD.dx('SUP_REC_REMOVE', { recId: r.id }); FD.toast('S_SAVED', null, { undo: () => FD.dx('SUP_REC_RESTORE', { recId: r.id }) }); })) : null); };
    const stopCard = (x, i) => { const recs = s.recs.filter(r => r.store === x.store && r.date === d && FD.recVsr(r) === vsrId && (!r.blockedAt || r.supRemoved));
      const editable = x.status === 'PLANNED' || x.status === 'ARRIVED';
      return h('div', { class: 'card plan-stop' + (x.status === 'SKIPPED' ? ' skipped' : ''), dataset: Object.assign({ stop: x.id, store: x.store }, x.status === 'PLANNED' ? { planned: '' } : {}) },
        h('div', { class: 'plan-stop-h' },
          h('span', { class: 'plan-seq' }, FD.fmt.num(i + 1)), // number, then the name flush left; store type joins the class line; actions and the drag handle on the right
          h('div', { class: 'grow', style: { minWidth: 0 } }, // name on top, details and chips below so the name never gets squeezed
            h('button', { type: 'button', class: 'link-btn', style: { maxWidth: '100%', textAlign: 'start' }, on: { click: () => S.storeDrawer(x.store, null, true) } }, h('b', { class: 'ellipsis', style: { display: 'block' } }, FD.nameOf(storeOf(x.store)))),
            h('div', { class: 'row wrap', style: { gap: '6px', marginTop: '4px' } }, h('span', { class: 'small muted' }, [t('LBL_' + storeOf(x.store).label), t('SIZE_' + storeOf(x.store).size), x.skipReason ? t(x.skipReason) : null, x.arrivedAt ? FD.fmt.time(x.arrivedAt) : null, sales(x.store) ? FD.fmt.money0(sales(x.store)) : null].filter(Boolean).join(' · ')),
              o.missed && o.missed.has(x.id) ? FD.chip(t('L_MISSED'), 'bad') : x.offPlan ? FD.chip(t('L_OFF_PLAN'), 'warn') : x.supAdded && x.status === 'PLANNED' ? FD.chip(t('L_ADDED_BY_YOU'), 'info') : FD.vsr.statusChip(x),
              s.preorders.some(p => p.store === x.store && p.forDate === d && p.status !== 'DONE') ? FD.chip([I('inbox', 's14'), t('L_PREORDER')], 'info') : null, FD.waChips(s, x.store, d))),
          x.status === 'PLANNED' && others.length ? FD.iconBtn('user-switch', t('ACT_MOVE_VAN'), e => FD.menu(e.currentTarget, others.map(q => ({ icon: 'truck', label: FD.nameOf(q), onClick: () => FD.dx('STOP_REASSIGN', { visitId: x.id, toVan: q.id }) })))) : null,
          x.status === 'PLANNED' ? FD.iconBtn('trash', t('L_REMOVE_STOP'), () => { FD.dx('SUP_STOP_REMOVE', { store: x.store, date: d }); FD.toast('S_SAVED', null, { undo: () => FD.dx('SUP_STOP_RESTORE', { store: x.store, date: d }) }); })
            : x.status === 'SKIPPED' && x.bySup ? FD.btn(t('L_RESTORE'), () => FD.dx('SUP_STOP_RESTORE', { store: x.store, date: d }), 'ghost sm', 'undo') : null,
          x.status === 'PLANNED' ? h('button', { type: 'button', class: 'icon-btn plan-grip', 'aria-label': t('L_DRAG_STOP'), title: t('L_DRAG_STOP'), on: { pointerdown: drag, keydown: e => { const dir = { ArrowUp: -1, ArrowDown: 1 }[e.key]; if (dir) { e.preventDefault(); move(i, dir); } } } }, I('grip')) : null),
        recs.length ? h('div', null, recs.map(recRow)) : null,
        editable ? h('div', { class: 'plan-add' }, FD.btn(t('L_ADD_PRODUCT'), () => S.recEditSheet({ store: x.store }), 'ghost sm', 'plus')) : null); };
    return h('div', { class: 'stack s12' },
      h('div', { class: 'row between wrap' }, h('div', null, h('b', null, t('L_PLAN_STOPS', { n: FD.fmt.num(plan.stops.filter(x => x.status !== 'SKIPPED').length) })),
          h('div', { class: 'small', style: { color: confirmed ? 'var(--good)' : 'var(--ink-3)' } }, t(confirmed ? 'L_PLAN_CONFIRMED' : 'L_PLAN_NOT_CONFIRMED'))),
        FD.btn(t('L_ADD_STORE_VISIT'), () => S.addVisitSheet(vsrId, d), 'secondary sm', 'plus')),
      h('div', { class: 'small muted' }, t('L_PLAN_NOTE')),
      // the order app caps stores visited off the salesman's route per day (outOfRouteLimit); stops past the cap will not sync
      (v => { const n = plan.stops.filter(x => (x.supAdded || x.offPlan) && x.status !== 'SKIPPED' && storeOf(x.store).route !== vsrOf(vsrId).route).length;
        return v && n > v ? h('div', { class: 'banner warn' }, I('alert'), h('span', null, tx('L_OUT_ROUTE_OVER', { n: FD.fmt.num(n), m: FD.fmt.num(v) }))) : null; })(vsrOf(vsrId).outOfRoute),
      plan.stops.length ? plan.stops.map(stopCard) : FD.empty('X_TODAY_NONE', null, 'calendar'));
  };

  S.vsrContent = function (vsrId, full, {date}={}) {
    const s = st(); const { from, to } = S.range(); const m = FD.vsrMetrics(s, vsrId, from, to); const b = FD.baseline(s, vsrId); const v = vsrOf(vsrId);
    const rank = FD.ranking(s, 'ABS', from, to).find(x => x.vsr === vsrId);
    const tab = L['vsr:tab'] || 'day';
    const metric = (label,val,sc,dl) => h('div',{class:'card metric-cell'},h('div',{class:'metric-label small muted'},label),h('b',{class:'metric-value'},val),dl!=null?h('div',{class:'metric-reference small muted'},FD.delta(dl),h('span',null,t('L_COL_CHANGE'))):null);
    // daily net: pilot days vs before-pilot average
    const days = []; for (let d = FD.PILOT_START; d <= today(); d = FD.addDays(d, 1)) if (FD.isSellingDay(d)) days.push(d);
    const myStores = s.world.stores.filter(x => x.vsr === vsrId);
    const daily = days.map(d => sum(myStores, x => sum(FD.SKUS, k => sum(FD.storeOrders(s, x.id, k.code).filter(o => o.date === d), o => o.value))));
    const recs = s.recs.filter(r => r.vsr === vsrId && r.outcome && r.outcome !== 'CARRIED' && r.date >= from && r.date <= to);
    const typeF = L['vsr:type'] || '', outF = L['vsr:out'] || '';
    const hist = recs.filter(r => (!typeF || r.type === typeF) && (!outF || (outF === 'SOLD' ? SOLD.includes(r.outcome) : r.outcome === outF)));
    const tabs = h('div', { class: 'tabs', style: { padding: 0 } }, [['day', date && date !== today() ? null : 'L_NAV_TODAY'], ['overview', 'L_OVERVIEW'], ['history', 'L_HISTORY'], ['coach', 'L_TIPS_SENT']].filter(x => v.kind === 'sales' || x[0] === 'day' || x[0] === 'history').map(([id, lb]) => h('button', { type: 'button', class: tab === id ? 'on' : '', on: { click: () => { L['vsr:tab'] = id; full ? FD.render() : FD.drawer.refresh(); } } }, lb ? t(lb) : FD.fmt.date(date))));
    let body;
    if (tab === 'day' || tab === 'plan' || v.kind !== 'sales' && tab !== 'history') {
      body = S.vanDay(vsrId,date);
    } else if (tab === 'overview') {
      const rb = FD.reasonBreakdown(s, { vsr: vsrId, from, to });
      const skips = s.visits.filter(x => x.vsr === vsrId && (x.status === 'SKIPPED' || x.moved) && x.date >= from && x.date <= to);
      // stores where nothing was offered stay folded, so the charts below are not pushed off screen
      const respRows = s.world.stores.filter(x => x.vsr === vsrId).map(x => Object.assign({ s: x }, FD.storeResponse(s, x.id, vsrId))); const quiet = respRows.filter(x => !x.offered).length;
      body = h('div', { class: 'stack s16' },
        h('div', { class: 'grid-3 metric-grid' },
          // Primary pilot KPI and four supporting KPIs, matching the approved deck.
          FD.PILOT_METRICS.map(mt => h('button', { type: 'button', class: 'card lever-card', title: t(mt.info), on: { click: () => S.metricDrawer(mt.k, { ids: [vsrId], from, to, prev: { from: FD.BASE_START, to: FD.addDays(FD.PILOT_START, -1) } }) } },
            h('div', { class: 'metric-label small muted' }, t(mt.label)), h('b', {class:'metric-value'}, FD.metricText(mt.k, m.lev[mt.k])),
              mt.k === 'upsell' ? h('div', { class: 'metric-reference small muted' }, t('L_TARGET_V', { money: FD.fmt.money0(m.target.upsell) })) : h('div', { class: 'metric-reference small muted' }, S.leverDelta(mt.k, m.lev[mt.k], m.base[mt.k]), h('span', null, t('L_KPI_VS_BASE')))))),
        h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('h3', null, t('L_REC_RESPONSE_STORES'))), FD.table({ id: 'vsrResp' + (full ? 'P' : 'D'), rows: respRows.filter(x => x.offered || L['vsrResp:all']), onRow: x => S.storeDrawer(x.s.id), defaultSort: ['conv', 'desc'], columns: [
          { key: 'st', label: t('L_COL_STORE'), render: x => h('span', { class: 'ellipsis', style: { display: 'block', maxWidth: '190px' } }, FD.nameOf(x.s)) },
          { key: 'off', label: t('L_COL_ATTEMPTS'), num: true, sort: (a, c) => a.offered - c.offered, render: x => FD.fmt.num(x.offered) },
          { key: 'conv', label: t('L_COL_CONV'), num: true, sort: (a, c) => a.conv - c.conv, render: x => x.offered ? FD.fmt.pct(x.conv) : '—' },
          { key: 'nf', label: t('L_NOT_FOLLOWED_PCT'), num: true, sort: (a, c) => a.notFollowed - c.notFollowed, render: x => FD.fmt.pct(x.notFollowed) },
          { key: 'seg', label: t('L_RESPONSE'), render: x => S.segChip(x.segment) }] }),
          quiet ? h('div', { class: 'card-f' }, FD.btn(L['vsrResp:all'] ? t('L_SHOW_LESS') : tx('L_SHOW_NOT_OFFERED', { n: quiet }), () => { L['vsrResp:all'] = !L['vsrResp:all']; full ? FD.render() : FD.drawer.refresh(); }, 'ghost sm')) : null),
        h('div', { class: 'card', style: { padding: '14px' } }, h('div', { class: 'row between', style: { marginBottom: '6px' } }, h('b', { class: 'row', style: { gap: '4px' } }, t('L_FOL_TITLE'), S.info(t('L_FOL_EXPL')))), m.followed.pending ? h('div', { class: 'small muted', style: { marginBottom: '6px' } }, t('L_EARLY_CHECK')) : null,
          [[t('L_COL_FOL_CHG'), m.followed.withRecs], [t('INS_OTHERS'), m.followed.without]].map(([lb, v]) => h('div', { class: 'row between', style: { padding: '6px 0' } }, h('span', null, lb), h('b', { class: 'tabular' }, FD.fmt.signedPct(v))))),
        h('div', { class: 'card', style: { padding: '14px' } }, h('b', null, t('L_DAILY_NET')), FD.line([{ name: t('L_PILOT'), values: daily }, { name: t('L_BASE_AVG'), values: days.map(() => b.perDay) }], days.map(d => FD.fmt.date(d)), { h: 180, fmt: v => FD.fmt.money0(v), label: t('L_DAILY_NET') })),
        h('div', { class: 'card', style: { padding: '14px' } }, h('b', null, t('L_REASON_MIX')), h('div', { style: { marginTop: '10px' } }, FD.bars(rb.filter(g => g.count).map(g => ({ label: t(g.group === 'R_OTHER' ? 'SK_OTHER' : g.group), value: g.count, muted: g.group === 'R_NONE', onClick: () => { L['rd:f'] = { vsr: vsrId }; S.reasonDrawer({ group: g.group }); } }))))),
        skips.length ? h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('h3', null, t('L_SKIPS'))), skips.slice(-10).reverse().map(x => h('div', { class: 'list-row' }, h('span', { class: 'grow' }, FD.nameOf(storeOf(x.store))), h('span', { class: 'small muted' }, FD.fmt.date(x.date)), FD.chip(t(x.skipReason || x.moveReason || 'SK_OTHER'))))) : null);
    } else if (tab === 'history') {
      body = h('div', { class: 'stack s8' }, h('div', { class: 'filters' },
        FD.select([{ id: '', label: t('L_COL_TYPE') + ': ' + t('L_ALL') }].concat(['LAPSED', 'GAP', 'UPGRADE', 'PROMO', 'SUP'].map(x => ({ id: x, label: t('TYPE_' + x) }))), typeF, v => { L['vsr:type'] = v; full ? FD.render() : FD.drawer.refresh(); }),
        FD.select([{ id: '', label: t('L_COL_OUTCOME') + ': ' + t('L_ALL') }, { id: 'SOLD', label: t('E_FULL') }, { id: 'NOT_SOLD', label: t('E_NOT_SOLD') }, { id: 'NOT_OFFERED', label: t('E_NOT_OFFERED') }], outF, v => { L['vsr:out'] = v; full ? FD.render() : FD.drawer.refresh(); }),
        FD.chip(FD.fmt.num(hist.length), 'info')),
        h('div', { class: 'card' }, FD.table({ id: 'vsrHist' + (full ? 'P' : 'D'), rows: hist, onRow: r => S.recDrawer(r.id, !full), defaultSort: ['date', 'desc'], limit: 120, columns: [
          { key: 'date', label: t('L_COL_DATE'), sort: (a, b) => a.date.localeCompare(b.date), render: r => FD.fmt.date(r.date) },
          { key: 'store', label: t('L_COL_STORE'), render: r => h('span', { class: 'ellipsis', style: { display: 'block', maxWidth: '160px' } }, FD.nameOf(storeOf(r.store))) },
          { key: 'sku', label: t('L_COL_PRODUCT'), render: r => FD.skuLabel(r.sku) },
          { key: 'type', label: t('L_COL_TYPE'), render: r => t('TYPE_' + r.type) },
          { key: 'out', label: t('L_COL_OUTCOME'), render: outcomeChip },
          { key: 'reason', label: t('L_COL_REASON'), render: reasonCell },
          { key: 'mat', label: t('L_COL_CHECK2'), render: matChip }] })));
    } else {
      const drafts = FD.coachDrafts(s).filter(d => d.vsr === vsrId);
      const sent = s.tips.filter(x => x.vsr === vsrId).slice().reverse();
      body = h('div', { class: 'stack s16' }, h('div', null, FD.btn(t('L_SEND_TIP'), () => S.tipComposer(vsrId, drafts[0] ? drafts[0].tpl : 'K_REASONS', drafts[0] ? drafts[0].slots : {}, drafts[0] ? drafts[0].key : null), 'primary', 'bulb')),
        drafts.length ? h('div', null, h('h3', { style: { fontSize: '14px', margin: '0 0 8px' } }, t('L_TIP_DRAFTS')), h('div', { class: 'card' }, drafts.map(d => S.draftRow(d, true)))) : null,
        h('div', null, h('h3', { style: { fontSize: '14px', margin: '0 0 8px' } }, t('L_TIPS_SENT')), sent.length ? h('div', { class: 'card' }, sent.map(x => h('div', { class: 'list-row', style: { alignItems: 'flex-start' } }, h('span', { class: 'fu-ic' }, I('bulb', 's16')),
          h('div', { class: 'grow' }, h('div', { style: { fontWeight: 500 } }, tx(x.tpl + '_T', x.slots)), h('div', { class: 'small muted' }, x.text || tx(x.tpl, x.slots))), h('div', { class: 'small muted' }, FD.fmt.date(x.sentAt.date)), x.read ? FD.chip(t('ST_VIEWED'), 'good') : FD.chip(t('L_UNREAD'))))) : h('div', { class: 'card' }, FD.empty('X_TIPS', null, 'bulb'))));
    }
    return h('div', { class: 'stack s16' },
      // ranking sits on the tabs row (rank, change vs own baseline, its meaning one tap away): no block of empty space above the tabs
      h('div', { class: 'row vsr-tabs-row' }, h('div', { class: 'grow', style: { minWidth: 0 } }, tabs),
        rank ? h('div', { class: 'row vsr-rank' }, h('span', { class: 'small muted row', style: { gap: '4px' } }, t('L_COL_VS_BASE'), S.info(t('L_VS_MY_BASE'))), S.baseDelta(rank.m, true),
          rank.m.hasBaseline ? h('span', { class: 'rank r' + rank.rank, style: { width: '30px', height: '30px', fontSize: '13px' } }, '#' + FD.fmt.num(rank.rank)) : null) : FD.chip(t('ST_NO_ACTIVITY'), 'outline')),
      rank && rank.context.length ? h('div', { class: 'row wrap' }, rank.context.map(c => FD.chip(tx(c.id, c.slots), 'outline'))) : null,
      body);
  };
  S.vsrDrawer = (vsrId, push, tab, {date}={}) => { if (tab) L['vsr:tab'] = tab; if (L['map:sel'] && L['map:sel'] !== vsrId) { L['map:sel'] = vsrId; FD.render(); } return FD.drawer.open({ title: () => { const v = vsrOf(vsrId);
      return h('span', { class: 'row vsr-title', style: { gap: '10px' } }, FD.avatar(v), h('span', { class: 'stack', style: { gap: 0, minWidth: 0 } }, h('span', { class: 'ellipsis' }, FD.nameOf(v)), h('span', { class: 'small muted ellipsis', style: { fontWeight: 400 } }, FD.routeArea(st().world.routes.find(x => x.id === v.route)))),
        FD.iconBtn('message', t('L_MESSAGE'), () => FD.threadSheet({ type: 'vsr', id: vsrId }, 'SUP')),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('L_MORE'), title: t('L_MORE'), 'aria-haspopup': 'menu', on: { click: e => FD.menu(e.currentTarget, [
          v.kind === 'sales' ? { icon: 'bulb', label: t('L_SEND_TIP'), onClick: () => S.tipComposer(vsrId, 'K_CUSTOM', {}) } : null,
          { icon: 'map', label: t('L_VIEW_ROUTE'), onClick: () => S.routeMap(vsrId) }, '-',
          { icon: 'user-switch', label: t('L_CHANGE_ROUTE'), onClick: () => S.routeAssignSheet(vsrId) }].filter(Boolean)) } }, I('more', 's16'))); }, expand: '#/sup/team/' + vsrId, render: () => S.vsrContent(vsrId, false,{date}) }, { push }); };
  S.segChip = seg => FD.chip(t(seg), { SEG_RECEPTIVE: 'good', SEG_SELECTIVE: 'warn', SEG_RESISTANT: 'bad', SEG_NEW: '' }[seg]);
  S.routeAssignSheet = function (vsrId) {
    const from = FD.addDays(today(), 1); let route = st().world.routes.find(r => FD.routeOwner(st(), r.id, from) === vsrId).id;
    FD.sheet.open({ center: true, title: t('L_CHANGE_ROUTE') + ' · ' + FD.nameOf(vsrOf(vsrId)), render: () => h('div', { class: 'stack s16' },
      h('div', { class: 'field' }, h('label', null, t('L_ROUTE')), FD.select(st().world.routes.map(r => ({ id: r.id, label: FD.nameOf(r) + ' · ' + FD.nameOf(vsrOf(FD.routeOwner(st(), r.id, from))) })), route, v => { route = v; })),
      h('div', { class: 'banner info' }, I('info'), h('span', null, t('L_ASSIGN_NOTE')))),
      footer: () => [FD.btn(t('L_CANCEL'), () => FD.sheet.close(), 'secondary'), h('span', { class: 'grow' }), FD.btn(t('L_SAVE'), () => { FD.dx('ROUTE_ASSIGN', { route, vsr: vsrId }); FD.sheet.close(); FD.toast('S_SAVED'); }, 'primary')] });
  };
  S.storeAssignSheet = function (storeId) {
    let vsr = storeOf(storeId).vsr;
    FD.sheet.open({ center: true, title: t('L_REASSIGN') + ' · ' + FD.nameOf(storeOf(storeId)), render: () => h('div', { class: 'stack s16' },
      h('div', { class: 'field' }, h('label', null, t('L_COL_VSR')), FD.select(st().world.vsrs.map(v => ({ id: v.id, label: FD.nameOf(v) })), vsr, v => { vsr = v; })),
      h('div', { class: 'banner info' }, I('info'), h('span', null, t('L_ASSIGN_NOTE')))),
      footer: () => [FD.btn(t('L_CANCEL'), () => FD.sheet.close(), 'secondary'), h('span', { class: 'grow' }), FD.btn(t('L_SAVE'), () => { if (vsr !== storeOf(storeId).vsr) FD.dx('STORE_ASSIGN', { store: storeId, vsr }); FD.sheet.close(); FD.toast('S_SAVED'); }, 'primary')] });
  };
  S.routeMap = function (vsrId) {
    const route = st().world.routes.find(r => FD.routeOwner(st(), r.id, today()) === vsrId) || st().world.routes.find(r => r.id === vsrOf(vsrId).route);
    const stores = st().world.stores.filter(s => s.route === route.id); const attnIds = new Set(FD.storesNeedingAttention(st(), stores.map(s => s.id), today()).map(x => x.id));
    const box = h('div', { class: 'snap map-box', style: { height: '460px' } });
    FD.sheet.open({ center: true, title: FD.nameOf(route), render: () => { setTimeout(() => FD.snapMap(box, stores.map((s, i) => {
      const need = attnIds.has(s.id); const g = FD.storeGlance(st(), s.id, today());
      return { lat: s.lat, lng: s.lng, label: FD.fmt.num(i + 1), color: need ? FD.tok('bad') : FD.tok('brand'), name: FD.nameOf(s), sub: t('L_G_LAST_ORDER') + ' · ' + S.ago(g.daysSinceOrder), open: () => { FD.sheet.close(); S.storeDrawer(s.id); } };
    })), 60); return h('div', null, box, h('div', { class: 'legend', style: { marginTop: '8px' } }, [['var(--brand)', 'L_ALL_STORES'], ['var(--bad)', 'L_ATTN_ONLY']].map(([c, k]) => h('span', null, h('span', { class: 'sw', style: { background: c } }), t(k))))); } });
  };

  // Returns watchlist: status, before vs since, what it holds back, and the review decision
  S.watchChip = w => w.due ? FD.chip(t(w.improved ? 'L_WATCH_IMPROVED' : 'L_WATCH_NOT_IMPROVED'), w.improved ? 'good' : 'warn') : FD.chip(t('L_WATCH_DAY', { days: FD.fmt.num(w.days), n: FD.fmt.num(FD.WATCH_DAYS) }), 'info');
  S.watchCard = function (code) {
    const s = st(); const on = s.watchlist.includes(code); const past = s.watchHistory.filter(x => x.sku === code).slice().reverse();
    const range = x => FD.fmt.date(x.since) + ' ' + t('L_TO') + ' ' + FD.fmt.date(x.until) + ' · ' + t('L_COL_RETURNS') + ' ' + FD.fmt.pct(x.before || 0) + ' → ' + (x.after == null ? '—' : FD.fmt.pct(x.after));
    const pastList = past.length ? h('div', null, h('div', { class: 'small muted', style: { margin: '6px 0 2px' } }, t('L_WATCH_PAST')), past.map(x => h('div', { class: 'small' }, range(x)))) : null;
    if (!on) return h('div', { class: 'card', style: { padding: '12px 14px' } }, pastList);
    const w = FD.watchStats(s, code); const held = s.world.stores.filter(x => FD.shelf(s, x.id, today()).gates[code] === 'GATE_WATCH').length;
    const stat = (lb, v) => h('div', { class: 'card', style: { padding: '10px 12px', boxShadow: 'none' } }, h('div', { class: 'small muted' }, lb), h('b', null, v));
    return h('div', { class: 'card watch-card' },
      h('div', { class: 'blk-h', style: { color: 'var(--warn-ink)' } }, I('alert', 's16'), h('b', { class: 'grow' }, t('L_R_WATCH')), w.due ? S.watchChip(w) : FD.chip(t('L_WATCH_REVIEW_ON', { date: FD.fmt.date(w.review) }), 'info')),
      h('div', { class: 'stack s8', style: { padding: '4px 14px 14px' } },
        h('div', { class: 'small muted' }, t('L_WATCH_NOTE', { date: FD.fmt.date(w.since) })),
        h('div', { class: 'progress', style: { height: '4px' } }, h('i', { style: { width: Math.min(100, w.days / FD.WATCH_DAYS * 100) + '%' } })),
        h('div', { class: 'grid-3' }, stat(t('L_WATCH_BEFORE'), FD.fmt.pct(w.before)), stat(t('L_WATCH_SINCE'), w.after == null ? '—' : FD.fmt.pct(w.after)), stat(t('L_WATCH_HELD'), FD.fmt.num(held))),
        h('div', { class: 'small muted' }, t('L_WATCH_SETTLED')),
        h('div', { class: 'row wrap' }, FD.btn(t('ACT_UNWATCH'), () => { FD.dx('WATCH_REMOVE', { sku: code }); FD.toast('S_SAVED'); }, w.due && w.improved ? 'primary sm' : 'secondary sm', 'check'),
          w.due ? FD.btn(t('L_WATCH_KEEP'), () => { FD.dx('WATCH_KEEP', { sku: code }); FD.toast('S_SAVED'); }, 'secondary sm', 'clock') : null,
          w.due && !w.improved && !FD.skuBlocks(s, code).some(b => !b.store) ? FD.btn(t('L_BLOCK_EVERY'), () => S.confirm(t('L_BLOCK_EVERY') + ' · ' + FD.nameOf(FD.sku(code)), () => { FD.dx('BLOCK_ADD', { sku: code }); FD.toast('S_SAVED'); }), 'danger sm', 'ban') : null),
        pastList));
  };

  // Reason codes: groups are fixed; reasons can be renamed, hidden, added (English and Arabic names)
  S.reasonSheet = (group, id) => { const X = { en: '', ar: '' }; if (id) { const c = FD.CATALOG[id] || {}; const ov = st().reasonEdit && ((st().reasonEdit.custom || {})[id] || (st().reasonEdit.names || {})[id]) || {}; X.en = ov.en || c.en || ''; X.ar = ov.ar || c.ar || ''; }
    FD.sheet.open({ center: true, title: t(id ? 'L_EDIT_REASON' : 'L_NEW_REASON') + ' · ' + t(group), render: () => h('div', { class: 'stack s16' },
      h('div', { class: 'field' }, h('label', null, t('L_REASON_AR')), h('input', { class: 'input', dir: 'rtl', lang: 'ar', value: X.ar, on: { input: e => { X.ar = e.target.value; } } })),
      h('div', { class: 'field' }, h('label', null, t('L_REASON_EN')), h('input', { class: 'input', dir: 'ltr', value: X.en, on: { input: e => { X.en = e.target.value; } } })),
      h('div', { class: 'small muted' }, t('L_REASON_AR_HINT'))),
      footer: () => [FD.btn(t('L_CANCEL'), () => FD.sheet.close(), 'secondary'), h('span', { class: 'grow' }), FD.btn(t('L_SAVE'), () => { if (!X.en.trim() && !X.ar.trim()) return FD.toast('S_COMMENT_REQ');
        FD.dx(id ? 'REASON_RENAME' : 'REASON_ADD', { id, group, en: X.en, ar: X.ar }); FD.sheet.close(); FD.toast('S_SAVED'); }, 'primary')] }); };
  S.reasonCodes = () => { const e = st().reasonEdit || { custom: {}, hidden: [] };
    return h('div', null, Object.keys(FD.REASON_GROUPS).map(g => { const codes = FD.REASON_GROUPS[g].filter(c => !(e.custom[c] || {}).deleted);
      return h('details', { class: 'rc-grp', open: !!L['rc:' + g], on: { toggle: ev => { L['rc:' + g] = ev.currentTarget.open; } } },
        h('summary', null, h('span', { class: 'fu-ic' }, I(FD.vsr.GROUP_ICON[g], 's16')), h('b', { class: 'grow' }, t(g)), h('span', { class: 'small muted' }, t('L_N_REASONS', { n: FD.fmt.num(codes.filter(c => !e.hidden.includes(c)).length) })), I('chevron-down', 's16')),
        h('div', { class: 'rc-body' }, codes.map(c => { const hidden = e.hidden.includes(c); const custom = FD.reasonIsCustom(c);
            return h('div', { class: 'list-row' + (hidden ? ' muted' : '') }, h('span', { class: 'grow' }, t(c)), custom ? FD.chip(t('L_CUSTOM'), 'info') : null, hidden ? FD.chip(t('L_HIDDEN')) : null,
              FD.iconBtn('edit', t('L_EDIT_REASON'), () => S.reasonSheet(g, c)),
              custom ? FD.iconBtn('trash', t('L_DELETE'), () => { FD.dx('REASON_HIDE', { id: c, hide: true }); FD.toast('S_SAVED', null, { undo: () => FD.dx('REASON_HIDE', { id: c, hide: false }) }); })
                : FD.btn(t(hidden ? 'L_SHOW' : 'L_HIDE'), () => FD.dx('REASON_HIDE', { id: c, hide: !hidden }), 'ghost sm')); }),
          h('div', { class: 'list-row' }, FD.btn(t('L_NEW_REASON'), () => S.reasonSheet(g), 'ghost sm', 'plus')))); })); };

  // Store drawer / page content
  S.storeContent = function (storeId, focusSku, full) {
    const s = st(); const store = storeOf(storeId); const shelf = FD.shelf(s, storeId, today());
    const tab = ['overview', 'products', 'timeline', 'whatsapp'].includes(L['store:tab']) ? L['store:tab'] : 'overview';
    const ba = FD.blocksAt(s, storeId); const blocked = ba.store;
    const refresh = () => full ? FD.render() : FD.drawer.refresh();
    const blockedCard = () => { const skuBs = Object.entries(ba.skus); if (!skuBs.length) return null;
      return h('div', { class: 'card blk-card' }, h('div', { class: 'blk-h' }, I('ban', 's16'), h('b', null, t('L_R_BLOCKS')), h('span', { class: 'pill-count' }, FD.fmt.num(skuBs.length))),
        skuBs.map(([code, b]) => h('div', { class: 'list-row' }, h('div', { class: 'grow', style: { minWidth: 0 } }, FD.skuLabel(code, t(b.store ? 'L_BLOCKED_HERE_T' : 'L_BLOCKED_ALL_T') + ' · ' + t('L_COL_SINCE') + ' ' + FD.fmt.date(b.at.date))),
          FD.btn(t('L_UNBLOCK'), () => FD.dx('BLOCK_REMOVE', { blockId: b.id }), 'secondary sm')))); };
    const onTile = (code, state, e) => FD.menu(e.currentTarget, [
      { icon: 'pin', label: t('L_PIN_HERE'), onClick: () => { FD.dx('PIN_ADD', { sku: code, scope: 'store', id: storeId, until: FD.addDays(today(), 7) }); FD.toast('S_PINNED', { date: FD.addDays(today(), 7) }); } },
      ba.skus[code] ? { icon: 'check', label: t('L_UNBLOCK'), onClick: () => { FD.dx('BLOCK_REMOVE', { blockId: ba.skus[code].id }); FD.toast('S_SAVED'); } } :
      { icon: 'ban', label: t('L_BLOCK_SKU_HERE'), onClick: () => { const n0 = st().blocks.length; FD.dx('BLOCK_ADD', { store: storeId, sku: code }); FD.toast('S_BLOCKED', { vsrId: store.vsr }, { undo: () => { const b = st().blocks[n0]; if (b) FD.dx('BLOCK_REMOVE', { blockId: b.id }); } }); } },
      state === 'DECLINED' ? { icon: 'refresh', label: t('L_OVERRIDE_CD'), onClick: () => { FD.dx('COOLDOWN_OVERRIDE', { store: storeId, sku: code }); FD.toast('S_SAVED'); } } : null,
      { icon: 'package', label: t('L_OPEN') + ' · ' + FD.nameOf(FD.sku(code)), onClick: () => S.skuDrawer(code, !full) }].filter(Boolean));
    const storeMsgs = s.threads.flatMap(x => x.messages.filter(m => m.store === storeId).map(m => ({ m, th: x })));
    const tabs = h('div', { class: 'tabs store-sections', style: { padding: 0 } }, [['overview', 'L_OVERVIEW'], ['products', 'L_NAV_SKUS'], ['timeline', 'L_TIMELINE'], ['whatsapp', 'L_WHATSAPP']].map(([id, lb]) => h('button', { type: 'button', class: tab === id ? 'on' : '', on: { click: () => { L['store:tab'] = id; L['store:sc:' + storeId] = null; refresh(); } } }, t(lb))));
    let body;
    if (tab === 'overview' && L['store:sc:' + storeId]) {
      body = S.scFull(storeId);
    } else if (tab === 'overview') {
      const pending = s.corrections.filter(c => c.store === storeId && c.status === 'PENDING');
      body = h('div', { class: 'stack s16' },
        pending.map(c => h('div', { class: 'banner info' }, I('edit'), h('span', { class: 'grow' }, tx('F_CORRECTION', { vsrId: c.vsr, storeId }) + ' · ' + t(c.kind)), FD.btn(t('ACT_DECIDE'), () => S.correctionSheet(c.id), 'secondary sm'))),
        blocked ? h('div', { class: 'banner bad' }, I('ban'), h('span', { class: 'grow' }, t('L_BLOCKED_STORE')), FD.btn(t('L_UNBLOCK'), () => FD.dx('BLOCK_REMOVE', { blockId: blocked.id }), 'secondary sm')) : null,
        S.glance(storeId),
        S.scCard(storeId) || S.latestPhotos(storeId, () => { L['store:tab'] = 'timeline'; refresh(); }),
        FD.compIntel(s, storeId).brands.length ? h('section', { class: 'card', style: { padding: '14px' } }, h('h3', { style: { fontSize: '14px', margin: '0 0 8px' } }, t('CI_TITLE')), FD.compSection(storeId, { flat: true })) : null,
        blockedCard(),
        S.responseCard(storeId));
    } else if (tab === 'whatsapp') {
      if (FD.ownerUnread(st(), storeId, 'SUP')) setTimeout(() => FD.dx('OWNER_READ', { store: storeId, who: 'SUP' }));
      body = h('div', { class: 'stack s12' }, S.ownerHead(storeId, 'SUP'), S.ownerChat(storeId, refresh, false, 'SUP'));
    } else if (tab === 'products') {
      const rows = FD.storeSkuStats(s, storeId, today());
      body = h('div', { class: 'stack s16' }, blockedCard(), h('div', null, h('h3', { style: { fontSize: '14px', margin: '0 0 8px' } }, t('L_SHELF')), FD.shelfView(shelf, { onTile, blocked: ba.skus, filterKey: 'sup:' + storeId })), h('div', { class: 'card' }, FD.table({ id: 'storeSkus' + (full ? 'P' : 'D'), rows, defaultSort: ['u4', 'desc'], empty: 'L_NO_STORE_ORDERS', columns: [
        { key: 'p', label: t('L_COL_PRODUCT'), render: x => h('div', { class: 'row' }, FD.skuLabel(x.code), ba.skus[x.code] ? FD.chip([I('ban', 's14'), t('L_BLOCKED')], 'bad') : null) },
        { key: 'last', label: t('L_COL_LAST'), sort: (a, c) => a.lastDate.localeCompare(c.lastDate), render: x => h('span', { class: 'nowrap' }, FD.fmt.date(x.lastDate)) },
        { key: 'lq', label: t('L_COL_LAST_QTY'), num: true, sort: (a, c) => a.lastQty - c.lastQty, render: x => FD.fmt.num(x.lastQty) },
        { key: 'u4', label: t('L_COL_UNITS_4W'), num: true, sort: (a, c) => a.units4w - c.units4w, render: x => FD.fmt.num(x.units4w) },
        { key: 'avg', label: t('L_COL_AVG_VISIT'), num: true, sort: (a, c) => a.avgVisit - c.avgVisit, render: x => FD.fmt.num(x.avgVisit, 1) },
        { key: 'cov', label: h('span', { class: 'row', style: { gap: '4px' } }, t('L_COL_COVER'), S.info(t('L_COVER_HELP'))), num: true, sort: (a, c) => (a.cover ?? -1) - (c.cover ?? -1), render: x => x.cover == null ? '—' : x.cover <= 2 ? FD.chip(t('L_REORDER_DUE'), 'warn') : FD.chip(t('L_COVER_DAYS', { days: FD.fmt.num(x.cover) })) }] })));
    } else if (tab === 'timeline') {
      body = S.timeline(storeId);
    } else if (tab === 'orders') {
      const visits = s.visits.filter(v => v.store === storeId && v.status === 'DONE' && v.date <= today()).slice(-20).reverse();
      body = h('div', { class: 'card' }, visits.map(v => { const lines = FD.SKUS.flatMap(k => FD.storeOrders(s, storeId, k.code).filter(o => o.date === v.date && o.units > 0));
        return h('div', { class: 'list-row', style: { alignItems: 'flex-start' } }, h('div', { style: { width: '90px', flex: 'none' } }, h('b', null, FD.fmt.date(v.date)), h('div', { class: 'small muted' }, FD.fmt.money0(sum(lines, l => l.value)))),
          h('div', { class: 'row wrap grow', style: { gap: '4px' } }, lines.map(l => FD.chip([FD.skuIcon(l.sku, 16), FD.nameOf(FD.sku(l.sku)) + ' ×' + FD.fmt.num(l.units)], l.edited ? 'warn' : ''))));
      }));
    } else {
      body = h('div', { class: 'stack s8' }, FD.btn(tx('L_MSG_VSR', { vsrId: store.vsr }), () => FD.threadSheet({ type: 'store', id: storeId }, 'SUP'), 'primary', 'message'),
        storeMsgs.length ? h('div', { class: 'card' }, storeMsgs.slice(-6).reverse().map(({ m, th }) => h('button', { type: 'button', class: 'list-row click', style: { width: '100%', textAlign: 'start' }, on: { click: () => FD.chatOpen(th.anchor, 'SUP', { store: storeId }) } },
          h('span', { class: 'fu-ic' }, I('message', 's16')), h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'small muted' }, (m.by === 'SUP' ? t('L_YOU') : FD.nameOf(vsrOf(m.by))) + ' · ' + FD.fmt.date(m.at.date) + (m.sku ? ' · ' + FD.nameOf(FD.sku(m.sku)) : '')),
            h('div', { class: 'ellipsis', dir: 'auto' }, m.text || t('L_ATTACHMENT')))))) : h('div', { class: 'card' }, FD.empty('X_THREAD', null, 'message')));
    }
    return h('div', { class: 'stack s12' },
      h('div', { class: 'store-summary' },
        h('div', { class: 'store-owner' }, h('b', null, FD.nameOf(vsrOf(store.vsr))), h('span', { class: 'small muted' }, FD.routeArea(s.world.routes.find(r => r.id === store.route)))),
        h('div', { class: 'store-actions' }, FD.btn(t('L_MESSAGE'), () => FD.threadSheet({ type: 'store', id: storeId }, 'SUP'), 'secondary sm', 'message'),
          h('button', { type: 'button', class: 'btn ghost sm store-more', 'aria-haspopup': 'menu', on: { click: e => FD.menu(e.currentTarget, [
            { icon: 'edit', label: t('L_EDIT'), onClick: () => S.storeEditSheet(storeId) },
            { icon: 'user-switch', label: t('L_REASSIGN'), onClick: () => S.storeAssignSheet(storeId) },
            blocked ? { icon: 'check', label: t('L_UNBLOCK'), onClick: () => FD.dx('BLOCK_REMOVE', { blockId: blocked.id }) } :
              { icon: 'ban', label: t('L_BLOCK_STORE'), danger: true, onClick: () => S.confirm(tx('L_BLOCK_STORE_Q', { storeId }), () => { FD.dx('BLOCK_ADD', { store: storeId }); FD.toast('S_BLOCKED', { vsrId: store.vsr }); }) }
          ]) } }, I('more', 's16'), t('L_MORE')))),
      store.credit !== 'OK' || store.onboarding !== 'APPROVED' || s.sbPending.some(p => p.store === storeId) ? h('div', { class: 'row wrap', style: { gap: '6px' } },
        store.credit !== 'OK' ? FD.creditChip(store.credit, true) : null,
        store.onboarding !== 'APPROVED' ? FD.chip(t('GATE_ONBOARD'), 'warn') : null,
        s.sbPending.some(p => p.store === storeId) ? FD.chip(t('L_PENDING_SB'), 'warn') : null) : null,
      // what kind of store this is, always visible: folding it saved no space
      h('div', { class: 'row wrap store-tags', style: { gap: '6px' } }, FD.chip(t('LBL_' + store.label), 'info'), FD.chip([FD.sizeIcon(store.size), t('SIZE_' + store.size)]), store.tags.map(x => FD.chip(t('TAGN_' + x.slice(4)), 'outline'))),
      tabs, body);
  };
  S.storeDrawer = (storeId, focusSku, push) => FD.drawer.open({ title: () => FD.nameOf(storeOf(storeId)), expand: '#/sup/stores/' + storeId, render: () => S.storeContent(storeId, focusSku, false) }, { push });
  S.visitOrder = (visit, order) => {
    if (!visit && !order) return h('span', { class: 'muted' }, '—');
    if (visit && order && visit === order) return FD.chip([I('check', 's14'), t('L_VISIT_ORDER_SAME', { date: FD.fmt.date(visit) })], 'good');
    return h('span', { class: 'vo' }, visit ? FD.chip(t('L_VISIT_ON', { date: FD.fmt.date(visit) }), 'info') : null, order ? FD.chip(t('L_ORDER_ON', { date: FD.fmt.date(order) }), order < (visit || '') ? 'warn' : '') : null);
  };
  S.responseCard = function (storeId) {
    const s = st(); const r = FD.storeResponse(s, storeId); if (!r.offered) return null; // nothing offered yet: no card of zeros
    const cell = (label, val) => h('div', { class: 'card', style: { padding: '10px 12px', boxShadow: 'none' } }, h('div', { class: 'small muted' }, label), h('b', null, val));
    return h('div', { class: 'card', style: { padding: '14px' } }, h('div', { class: 'row between', style: { marginBottom: '10px' } }, h('b', null, t('L_REC_RESPONSE')), S.segChip(r.segment)),
      h('div', { class: 'metric-grid grid-3' }, cell(t('L_COL_ATTEMPTS'), FD.fmt.num(r.offered)), cell(t('L_COL_CONV'), r.offered ? FD.fmt.pct(r.conv) : '—'), cell(t('L_NOT_FOLLOWED_PCT'), FD.fmt.pct(r.notFollowed)),
        cell(t('L_COL_CHECK2'), r.sold ? FD.fmt.pct(r.confirmed) : '—'), cell(t('E_REVISIT'), FD.fmt.num(r.revisits)), cell(t('L_COL_UPS'), FD.fmt.num(r.sold))),
      h('div', { class: 'small muted', style: { marginTop: '8px' } }, t('L_RESPONSE_NOTE')));
  };
  // last 4 shelf photos of a store, newest first; tap opens full size
  S.latestPhotos = function (storeId, all) {
    const s = st(); const ph = s.photos.filter(p => p.store === storeId).concat(s.recs.filter(r => r.store === storeId && r.photo).map(r => ({ date: (r.reasonAt || {}).date || r.date, src: r.photo })));
    if (!ph.length) return null; ph.sort((a, b) => b.date.localeCompare(a.date));
    return h('div', null, h('div', { class: 'row between', style: { marginBottom: '8px' } }, h('h3', { style: { fontSize: '14px', margin: 0 } }, t('L_PHOTOS') + ' · ' + FD.fmt.date(ph[0].date)),
      ph.length > 4 ? FD.btn(t('L_VIEW_ALL') + ' · ' + FD.fmt.num(ph.length), all, 'secondary sm') : null),
      h('div', { class: 'photo-day' }, ph.slice(0, 4).map(p => h('button', { type: 'button', 'aria-label': t('L_PHOTO'), on: { click: () => FD.lightbox(p.src) } }, h('img', { src: p.src, alt: '', loading: 'lazy' })))));
  };
  // everything that happened at a store, newest first (visits, orders, recommendations, returns, photos, messages)
  S.timeline = function (storeId) {
    const s = st(); const from = FD.addDays(today(), -35); const ev = [];
    s.visits.filter(v => v.store === storeId && v.date >= from && v.date <= today()).forEach(v => ev.push({ d: v.date, tm: v.arrivedAt || '07:00', ic: v.status === 'SKIPPED' ? 'x' : v.status === 'MISSED' ? 'x-circle' : v.revisit ? 'repeat' : 'map-pin', tone: v.status === 'SKIPPED' ? 'warn' : v.status === 'MISSED' ? 'bad' : '',
      text: (v.revisit ? t('L_REVISIT') : t('L_VISIT')) + ' · ' + t('L_STATUS_' + (v.status === 'ARRIVED' ? 'ARRIVED' : v.status)) + (v.skipReason ? ' · ' + t(v.skipReason) : ''), sub: FD.nameOf(vsrOf(v.vsr)), visit: v.status === 'DONE' || v.status === 'ARRIVED' }));
    const days = {}; for (const k of FD.SKUS) for (const o of FD.storeOrders(s, storeId, k.code)) if (o.date >= from && o.date <= today() && o.units > 0) (days[o.date] = days[o.date] || []).push(o);
    Object.entries(days).forEach(([d, os]) => ev.push({ d, tm: '12:00', ic: 'package', tone: 'good', kind: 'order', text: t('L_ORDER_LINE', { n: FD.fmt.num(os.length), money: FD.fmt.money0(sum(os, o => o.value)) }), chips: os.slice(0, 6).map(o => FD.skuLabel(o.sku)) }));
    FD.storeRecs(s, storeId).filter(r => r.date >= from && r.outcome && r.outcome !== 'CARRIED').forEach(r => ev.push({ d: r.soldOn || r.date, tm: r.gradedAt || '12:30', ic: FD.SOLD.includes(r.outcome) ? 'check-circle' : r.outcome === 'NOT_OFFERED' ? 'eye-off' : 'x-circle', tone: FD.SOLD.includes(r.outcome) ? 'good' : r.outcome === 'NOT_OFFERED' ? 'warn' : 'bad', kind: FD.SOLD.includes(r.outcome) ? 'sold' : r.outcome === 'NOT_OFFERED' ? 'notoffered' : 'notsold',
      sku: r.sku, text: FD.nameOf(FD.sku(r.sku)) + ' · ' + (r.revisit ? t('E_REVISIT') : r.outcome === 'NOT_OFFERED' ? t('E_NOT_FOLLOWED') : S.outcomeChip(r).textContent), sub: r.reason ? t(r.reason) : null, rec: r.id }));
    s.returns.filter(x => x.store === storeId && x.date >= from && x.date <= today()).forEach(x => ev.push({ d: x.date, tm: '13:00', ic: 'undo', tone: 'bad', kind: 'return', sku: x.sku, text: t('E_RETURNED') + ' · ' + FD.nameOf(FD.sku(x.sku)), sub: FD.fmt.money0(x.value) }));
    // a Shelf Check shows as its result; other photos stay a photo strip
    FD.pgAssessments(s, storeId).filter(a => a.date >= from).forEach(a => { const x = FD.scSummary(s, a.id); if (!x || !x.analysed || !x.current) return;
      ev.push({ d: a.date, tm: a.time, ic: 'camera', text: t('SC_TITLE') + ' · ' + (x.current.none ? t('SC_NO_OURS') : t('SC_OPEN') + ' ' + FD.fmt.num(x.open)), chips: x.current.none ? null : x.before && x.after ? [FD.scChip(x.before), I('arrow-right', 's14'), FD.scChip(x.after)] : [FD.scChip(x.current)], open: () => { L['store:tab'] = 'overview'; L['store:sc:' + storeId] = a.id; FD.drawer.refresh(false); FD.render(); } }); });
    const ph = s.photos.filter(p => p.store === storeId && p.date >= from && !(p.assessmentId && FD.scSummary(s, p.assessmentId)?.current)); [...new Set(ph.map(p => p.date))].forEach(d => ev.push({ d, tm: '12:10', ic: 'camera', text: t('L_PHOTOS') + ' · ' + FD.fmt.num(ph.filter(p => p.date === d).length), photos: ph.filter(p => p.date === d) }));
    s.threads.forEach(th => th.messages.filter(m => m.store === storeId && m.at.date >= from).forEach(m => ev.push({ d: m.at.date, tm: m.at.time, ic: 'message', text: (m.by === 'SUP' ? FD.nameOf(s.world.supervisor) : FD.nameOf(vsrOf(m.by))) + ': ' + (m.text || t('L_PHOTO')) })));
    ev.sort((a, b) => (b.d + b.tm).localeCompare(a.d + a.tm));
    if (!ev.length) return h('div', { class: 'card' }, FD.empty('X_FILTER'));
    // everything from a visited day hangs under that visit, so one visit reads as one story
    const grouped = new Set();
    for (const v of ev.filter(e => e.visit)) { v.kids = ev.filter(e => !e.visit && !grouped.has(e) && e.d === v.d && e.ic !== 'message'); v.kids.forEach(k => grouped.add(k)); }
    // a visit's outcome at a glance: green for orders and sales, red for no sale and returns, amber for not offered
    const SUM = [['order', 'package', 'good', 'L_TL_ORDER'], ['sold', 'check-circle', 'good', 'L_TL_SOLD'], ['notsold', 'x-circle', 'bad', 'L_TL_NOTSOLD'], ['notoffered', 'eye-off', 'warn', 'L_TL_NOTOFFERED'], ['return', 'undo', 'bad', 'L_TL_RETURN']];
    const summary = kids => { const xs = SUM.map(([k, ic, tone, lb]) => [kids.filter(x => x.kind === k).length, ic, tone, lb]).filter(x => x[0]);
      return xs.length ? h('div', { class: 'row wrap tl-sum' }, xs.map(([n, ic, tone, lb]) => h('span', { class: 'tl-pill ' + tone }, I(ic, 's14'), t(lb, { n: FD.fmt.num(n) })))) : null; };
    const item = (e, nested) => h('div', { class: 'tl-item' + (nested ? ' nested' : '') + (e.tone ? ' tone-' + e.tone : '') + (e.rec || e.open ? ' click' : ''), style: e.rec || e.open ? { cursor: 'pointer' } : null, on: e.rec || e.open ? { click: ev2 => { ev2.stopPropagation(); e.open ? e.open() : S.recDrawer(e.rec, true); } } : null },
        e.sku ? h('span', { class: 'tl-ic sku' }, FD.skuIcon(e.sku, nested ? 18 : 22)) : h('span', { class: 'tl-ic ' + (e.tone || '') }, I(e.ic, nested ? 's14' : 's16')),
        h('div', { style: { minWidth: 0 } }, h('div', { dir: 'auto' }, e.text), e.sub ? h('div', { class: 'small muted' }, e.sub) : null,
          e.chips ? h('div', { class: 'row wrap', style: { gap: '6px', marginTop: '6px' } }, e.chips) : null,
          e.photos ? h('div', { class: 'photo-day', style: { marginTop: '6px' } }, e.photos.map(p => h('button', { type: 'button', 'aria-label':t('PG_PHOTO_LABEL'), on: { click: () => FD.lightbox(p.src) } }, h('img', { src: p.src, alt: '', loading: 'lazy' })))) : null,
          e.kids && e.kids.length ? [summary(e.kids), h('div', { class: 'tl-kids' }, e.kids.map(k => item(k, true)))] : null),
        nested ? null : h('span', { class: 'small muted' }, FD.fmt.time(e.tm)));
    const out = []; let day = null;
    for (const e of ev.filter(e => !grouped.has(e)).slice(0, 120)) {
      if (e.d !== day) { day = e.d; out.push(h('div', { class: 'tl-day' }, FD.fmt.dateLong(e.d))); }
      out.push(item(e));
    }
    return h('div', { class: 'card', style: { padding: '4px 14px 10px' } }, h('div', { class: 'tline' }, out));
  };
  S.confirm = (text, yes) => FD.sheet.open({ center: true, title: t('L_CONFIRM'), render: () => h('p', null, text), footer: () => [FD.btn(t('L_CANCEL'), () => FD.sheet.close(), 'secondary'), h('span', { class: 'grow' }), FD.btn(t('L_CONFIRM'), () => { FD.sheet.close(); yes(); }, 'danger')] });
  S.storeEditSheet = function (storeId) {
    const store = storeOf(storeId); const X = { label: store.label, size: store.size, tags: store.tags.slice(), shelf: store.shelf };
    FD.sheet.open({ center: true, title: t('L_EDIT') + ' · ' + FD.nameOf(store), render: () => h('div', { class: 'stack s16' },
      h('div', { class: 'field' }, h('label', null, t('L_COL_LABEL')), FD.select(FD.LABELS.map(l => ({ id: l, label: t('LBL_' + l) })), X.label, v => { X.label = v; })),
      h('div', { class: 'field' }, h('label', null, t('L_COL_SIZE')), FD.select(FD.SIZES.map(z => ({ id: z, label: t('SIZE_' + z) })), X.size, v => { X.size = v; })),
      h('div', { class: 'field' }, h('label', null, t('L_COL_TAGS')), h('div', { class: 'row wrap' }, FD.TAGS.map(tg => h('button', { type: 'button', class: 'chip lg chip-btn' + (X.tags.includes(tg) ? ' on' : ''), 'aria-pressed': X.tags.includes(tg) ? 'true' : 'false',
        on: { click: () => { X.tags = X.tags.includes(tg) ? X.tags.filter(x => x !== tg) : X.tags.concat(tg); FD.sheet.redraw(); } } }, t('TAGN_' + tg.slice(4))))))),
      footer: () => [FD.btn(t('L_CANCEL'), () => FD.sheet.close(), 'secondary'), h('span', { class: 'grow' }), FD.btn(t('L_SAVE'), () => { if (!X.tags.length) return; FD.dx('STORE_EDIT', { store: storeId, patch: { label: X.label, size: X.size, tags: X.tags } }); FD.sheet.close(); FD.toast('S_SAVED'); }, 'primary')] });
  };

  // SKU drawer
  S.skuDrawer = (code, push) => FD.drawer.open({ title: () => FD.nameOf(FD.sku(code)), render: () => {
    const s = st(); const { from, to } = S.range(); const k = FD.sku(code); const p = FD.skuPerf(s, from, to).find(x => x.code === code);
    const stores = S.stores(); const pcs = st2 => { let n = 0; for (const o of FD.storeOrders(s, st2.id, code)) if (o.date > FD.addDays(today(), -56) && o.date <= today() && o.units > 0) n += o.units * k.pcs; return n / 8; };
    const avgBy = (keys, pred, label) => keys.map(x => { const ss = stores.filter(st2 => pred(st2, x)); return { label: label(x), value: ss.length ? sum(ss, pcs) / ss.length : 0, n: ss.length }; }).filter(x => x.n);
    const rb = FD.reasonBreakdown(s, { sku: code, from, to, route: S.f.route || null }).filter(g => g.count);
    const opps = FD.opportunities(s, { route: S.f.route || null }).filter(o => o.sku === code);
    const promo = s.world.promos.find(x => x.skus.includes(code) && x.start <= today() && x.end >= today());
    const watched = s.watchlist.includes(code);
    const kbs = FD.skuBlocks(s, code); const kAll = kbs.find(b => !b.store);
    const f1 = v => FD.fmt.num(v, 1);
    return h('div', { class: 'stack s16' },
      h('div', { class: 'row wrap', style: { gap: '10px' } }, FD.skuTile(code, 40), FD.chip(t(k.group)), watched ? FD.chip(t('L_WATCHLIST_FLAG'), 'warn') : null, promo ? FD.chip([I('tag', 's14'), t(promo.promoId)], 'warn') : null,
        kAll ? FD.chip([I('ban', 's14'), t('L_BLOCKED_ALL_T')], 'bad') : kbs.length ? FD.chip([I('ban', 's14'), t('L_BLOCKED_IN_N', { n: FD.fmt.num(kbs.length) })], 'bad') : null),
      kbs.length ? h('div', { class: 'card blk-card' }, h('div', { class: 'blk-h' }, I('ban', 's16'), h('b', null, t('L_R_BLOCKS')), h('span', { class: 'pill-count' }, FD.fmt.num(kbs.length))),
        kbs.map(b => h('div', { class: 'list-row' }, h('span', { class: 'grow' }, b.store ? FD.nameOf(storeOf(b.store)) : t('L_EVERYWHERE'), h('span', { class: 'small muted' }, ' · ' + t('L_COL_SINCE') + ' ' + FD.fmt.date(b.at.date))),
          FD.btn(t('L_UNBLOCK'), () => FD.dx('BLOCK_REMOVE', { blockId: b.id }), 'secondary sm')))) : null,
      S.productPriceDetails(code),
      watched || s.watchHistory.some(x => x.sku === code) ? S.watchCard(code) : null,
      h('div', { class: 'grid-3 metric-grid' },
        [[t('L_COL_CARRYING'), FD.fmt.num(p.carrying) + ' · ' + FD.fmt.pct(p.carryingPct)], [t('L_COL_CONV'), p.attempts ? FD.fmt.pct(p.conv) : '—'], [t('L_COL_RETURNS'), FD.fmt.pct(p.returnRate)],
          [t('L_COL_SALES'), FD.fmt.money0(p.sales)], [t('L_COL_SUSTAINED'), p.attempts ? FD.fmt.pct(p.sustainedPct) : '—'], [t('L_PROMO_UPTAKE'), p.promoUptake != null ? FD.fmt.pct(p.promoUptake) : '—']]
          .map(([a, b]) => h('div', { class: 'card', style: { padding: '10px 12px' } }, h('div', { class: 'small muted' }, a), h('b', null, b)))),
      h('div', { class: 'row wrap' }, watched ? null : FD.btn(t('L_WATCH_ADD'), () => FD.dx('WATCH_ADD', { sku: code }), 'secondary sm', 'alert'),
        FD.btn(t('L_PIN_TAG'), () => S.pinSheet(code), 'secondary sm', 'pin'),
        kAll ? null : FD.btn(t('L_BLOCK_EVERY'), () => S.confirm(t('L_BLOCK_EVERY') + ' · ' + FD.nameOf(k), () => { FD.dx('BLOCK_ADD', { sku: code }); FD.toast('S_BLOCKED', { vsrId: 'V1' }); }), 'danger sm', 'ban')),
      h('div', { class: 'card', style: { padding: '14px' } }, h('b', null, t('L_WHERE_SELLS')),
        h('div', { class: 'small muted', style: { margin: '8px 0 4px' } }, t('L_BY_LABEL')), FD.bars(avgBy(FD.LABELS, (x, l) => x.label === l, l => t('LBL_' + l)).map(x => ({ label: x.label, value: x.value, display: f1(x.value) }))),
        h('div', { class: 'small muted', style: { margin: '12px 0 4px' } }, t('L_BY_TAG')), FD.bars(avgBy(FD.TAGS, (x, tg) => x.tags.includes(tg), tg => t('TAGN_' + tg.slice(4))).sort((a, b) => b.value - a.value).map(x => ({ label: x.label, value: x.value, display: f1(x.value) }))),
        h('div', { class: 'small muted', style: { margin: '12px 0 4px' } }, t('L_BY_SIZE')), FD.bars(avgBy(FD.SIZES, (x, z) => x.size === z, z => t('SIZE_' + z)).map(x => ({ label: x.label, value: x.value, display: f1(x.value) }))),
        h('div', { class: 'small muted', style: { marginTop: '6px' } }, t('L_PCS_WEEK'))),
      rb.length ? h('div', { class: 'card', style: { padding: '14px' } }, h('b', null, t('L_DECLINES')), h('div', { style: { marginTop: '8px' } }, FD.bars(rb.map(g => ({ label: t(g.group === 'R_OTHER' ? 'SK_OTHER' : g.group), value: g.count, muted: g.group === 'R_NONE', onClick: () => { L['rd:f'] = { sku: code }; S.reasonDrawer({ group: g.group }); } }))))) : null,
      h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('h3', null, t('L_OPEN_OPP_STORES')), h('span', { class: 'pill-count' }, FD.fmt.num(opps.length))),
        opps.length ? opps.slice(0, 12).map(o => h('button', { type: 'button', class: 'list-row click', style: { width: '100%', textAlign: 'start' }, on: { click: () => S.storeDrawer(o.store, code, true) } }, h('div', { class: 'grow' }, storeCell(storeOf(o.store))), FD.typeChip(o.type), h('span', { class: 'tabular' }, FD.fmt.money0(o.ev)))) : FD.empty('X_FILTER')));
  } }, { push });
  S.pinSheet = function (code, preset) {
    const X = Object.assign({ scope: 'tag', id: FD.TAGS[0], until: FD.addDays(today(), 14) }, preset);
    FD.sheet.open({ center: true, title: t('L_PIN') + ' · ' + FD.nameOf(FD.sku(code)), render: () => {
      const opts = { all: [], tag: FD.TAGS.map(x => ({ id: x, label: t('TAGN_' + x.slice(4)) })), label: FD.LABELS.map(x => ({ id: x, label: t('LBL_' + x) })), route: st().world.routes.map(x => ({ id: x.id, label: FD.nameOf(x) })) };
      return h('div', { class: 'stack s16' },
        h('div', { class: 'field' }, h('label', null, t('L_SCOPE')), FD.seg([{ id: 'all', label: t('L_SCOPE_ALL') }, { id: 'tag', label: t('L_SCOPE_TAG') }, { id: 'label', label: t('L_SCOPE_LABEL') }, { id: 'route', label: t('L_SCOPE_ROUTE') }], X.scope, v => { X.scope = v; X.id = (opts[v][0] || {}).id; FD.sheet.redraw(); })),
        X.scope !== 'all' ? h('div', { class: 'field' }, h('label', null, t('L_CHOOSE')), FD.select(opts[X.scope], X.id, v => { X.id = v; })) : null,
        h('div', { class: 'field' }, h('label', null, t('L_UNTIL')), h('input', { class: 'input', type: 'date', min: today(), value: X.until, on: { change: e => { X.until = e.target.value; } } })));
    }, footer: () => [FD.btn(t('L_CANCEL'), () => FD.sheet.close(), 'secondary'), h('span', { class: 'grow' }), FD.btn(t('L_PIN'), () => { FD.dx('PIN_ADD', { sku: code, scope: X.scope === 'all' ? null : X.scope, id: X.scope === 'all' ? null : X.id, until: X.until }); FD.sheet.close(); FD.toast('S_PINNED', { date: X.until }); }, 'primary', 'pin')] });
  };

  S.insightDrawer = i => FD.drawer.open({ title: () => tx(i.tpl, i.slots), render: () => {
    const s = st(); const f = i.filter; const groupSkus = f.group ? FD.SKUS.filter(k => k.group === f.group).map(k => k.code) : [];
    const inGroup = S.stores().filter(x => (!f.tag || x.tags.includes(f.tag)) && (!f.label || x.label === f.label) && (!f.size || x.size === f.size));
    const missing = groupSkus.length ? inGroup.filter(x => !groupSkus.some(c => FD.carries(s, x.id, c, today()))) : [];
    return h('div', { class: 'stack s16' },
      h('div', { class: 'card', style: { padding: '14px' } }, FD.bars(i.chart.values.map((v, j) => ({ label: t(i.chart.labels[j]), value: v, display: FD.fmt.num(v, 1), muted: j === 1 }))), h('div', { class: 'small muted', style: { marginTop: '6px' } }, t('L_PCS_WEEK'))),
      groupSkus.length ? h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('h3', null, t('L_STORES_MISSING')), h('span', { class: 'pill-count' }, FD.fmt.num(missing.length))),
        missing.length ? missing.map(x => h('button', { type: 'button', class: 'list-row click', style: { width: '100%', textAlign: 'start' }, on: { click: () => S.storeDrawer(x.id, null, true) } }, h('div', { class: 'grow' }, storeCell(x)), I('chevron-right', 's16'))) : FD.empty('X_FILTER'),
        missing.length ? h('div', { class: 'card-f' }, FD.btn(t('ACT_PIN_STORES'), () => S.pinSheet(groupSkus[0], f.tag ? { scope: 'tag', id: f.tag } : f.label ? { scope: 'label', id: f.label } : {}), 'primary sm', 'pin')) : null) : null);
  } });

  // ================= MESSAGES (one inbox: salesmen and team on our platform, store owners on WhatsApp) =================
  FD.registerView('sup', 'msgs', r => {
    const s = st(); const F = L['msgs:f'] = L['msgs:f'] || { kind: 'ALL', q: '' };
    const anchor = r.id && FD.chatAnchor(r.id);
    const q = (F.q || '').trim().toLowerCase();
    const scope = new Set(S.stores().map(x => x.id));
    const lastOf = m => m ? m.at.date + m.at.time : '';
    // internal threads: team + one per salesman
    const internal = [{ type: 'team', id: 'ALL' }].concat(s.world.vsrs.map(v => ({ type: 'vsr', id: v.id }))).map(a => { const th = FD.chatFind(a); const last = th && th.messages[th.messages.length - 1];
      return { a, th, un: FD.chatUnreadN(th, 'SUP'), last: lastOf(last), title: FD.chatTitle(a, 'SUP'), snip: last ? (last.store ? FD.nameOf(storeOf(last.store)) + ': ' : '') + (last.tip ? t('W_TIP') : FD.chatSnippet(last, 'SUP')) : FD.chatSub(a, 'SUP'),
        hay: th ? th.messages.map(m => (m.text || '') + ' ' + (m.store ? FD.nameOf(storeOf(m.store)) : '')).join(' ') : '' }; });
    // store owner threads (WhatsApp), only stores in the current filter
    const stores = [...new Set((s.ownerMsgs || []).map(m => m.store))].filter(id => scope.has(id)).map(id => { const ms = FD.ownerThread(s, id); const m = ms[ms.length - 1]; const rp = ms.filter(x => x.reply).sort((a, b) => lastOf(a.reply).localeCompare(lastOf(b.reply))).pop();
      const latest = rp && lastOf(rp.reply) > lastOf(m) ? { text: FD.waReplyText(rp.reply), at: rp.reply.at } : { text: m.kind === 'CARD' ? t('W_CARD_' + m.card) : m.kind === 'PREORDER' ? t('L_PREORDER') : m.text ? FD.txtOf(m.text) : t('L_ATTACHMENT'), at: m.at };
      return { a: { type: 'wa', id }, wa: true, un: FD.ownerUnreadN(s, id, 'SUP'), last: lastOf(latest), at: latest.at, title: FD.nameOf(storeOf(id)), snip: latest.text, hay: ms.map(x => FD.txtOf(x.text) || '').join(' ') }; });
    const nUn = internal.concat(stores).filter(x => x.un).length;
    // unread threads per group, as app-style count badges on the filters (counted before the filter narrows the lists)
    const nV = internal.filter(x => x.un).length, nS = stores.filter(x => x.un).length, badge = n => n ? h('span', { class: 'unread-n seg-n' }, n > 99 ? '99+' : FD.fmt.num(n)) : null;
    const rows = (F.kind === 'STORES' ? stores : F.kind === 'VSR' ? internal : internal.concat(stores)).filter(x => F.kind !== 'UNREAD' || x.un).filter(x => !q || (x.title + ' ' + x.hay).toLowerCase().includes(q))
      .sort((x, y) => (y.a.type === 'team') - (x.a.type === 'team') || (!!y.un - !!x.un) || y.last.localeCompare(x.last));
    const item = x => { const on = anchor && x.a.type === anchor.type && x.a.id === anchor.id; const at = x.at || (x.th && x.th.messages.length && x.th.messages[x.th.messages.length - 1].at);
      return h('button', { type: 'button', class: 'chat-li' + (on ? ' on' : ''), 'aria-current': on ? 'true' : null, on: { click: () => FD.chatOpen(x.a, 'SUP') } },
        x.a.type === 'vsr' ? FD.avatar(vsrOf(x.a.id)) : h('span', { class: 'chat-av' + (x.wa ? ' wa' : '') }, x.wa ? FD.waLogo('s20') : I(FD.chatIcon(x.a), 's16')),
        h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'row between', style: { gap: '8px' } }, h('b', { class: 'ellipsis', style: { fontWeight: x.un ? 700 : 600 } }, x.title),
            at ? h('span', { class: 'small muted nowrap' }, at.date === today() ? FD.fmt.time(at.time) : FD.fmt.date(at.date)) : null),
          h('div', { class: 'row between', style: { gap: '8px' } }, h('span', { class: 'small ellipsis', dir: 'auto', style: { color: x.un ? 'var(--ink)' : 'var(--ink-3)' } }, x.snip),
            FD.unreadN(x.un)))); };
    const listPane = h('div', { class: 'chat-list' },
      h('div', { class: 'chat-list-h' }, // the page title already says Messages
        FD.searchBox('supChats', t('L_SEARCH_CHATS'), F.q, x => { F.q = x; FD.render(); }),
        FD.seg([{ id: 'ALL', label: t('L_F_ALL') }, { id: 'VSR', label: [t('W_F_VSRS'), badge(nV)] }, { id: 'STORES', label: [t('L_F_STORES'), badge(nS)] }, { id: 'UNREAD', label: [t('L_F_UNREAD'), badge(nUn)] }], F.kind, x => { F.kind = x; FD.render(); })),
      h('div', { class: 'chat-list-b' }, rows.length ? rows.map(item) : FD.empty('X_FILTER')));
    let pane;
    if (anchor && anchor.type === 'wa' && storeOf(anchor.id)) {
      if (FD.ownerUnread(s, anchor.id, 'SUP')) setTimeout(() => FD.dx('OWNER_READ', { store: anchor.id, who: 'SUP' }));
      pane = h('div', { class: 'chat-pane wa-pane' }, S.ownerHead(anchor.id, 'SUP', { name: true, back: () => FD.go('#/sup/msgs') }), S.ownerChat(anchor.id, () => FD.render(), false, 'SUP'));
    } else pane = h('div', { class: 'chat-pane' }, anchor ? FD.chatView(anchor, 'SUP', { mode: 'full', onBack: () => FD.go('#/sup/msgs') }) : h('div', { class: 'chat-none' }, FD.empty('L_CHOOSE_CHAT', null, 'message')));
    return { title: t('L_MESSAGES'), full: true, body: [h('div', { class: 'chat-shell' + (anchor ? ' has-thread' : '') }, listPane, pane)] };
  });

  // value with its change against the previous period of the same length underneath
  const cmp = (val, d) => h('div', { class: 'cmp' }, h('div', null, val), d ? h('div', { class: 'cmp-d' }, d) : null);
  const SHORT = { primary: 'MT_PRIMARY', visits: 'MT_VISITS', withSale: 'MT_WITHSALE', avgSale: 'MT_AVGSALE', returns: 'MT_RETURNS' };
  S.teamColumns = (full, rowsPartial, prePilot = false) => { const up = x => !x.prePilot; const num = (key, label, get, render) => ({ key, label, num: true, sort: (a, b) => get(a) - get(b), render });
    return [
      { key: 'rank', label: t('L_COL_RANK'), sort: (a, b) => b.rank - a.rank, firstDir: 'desc', render: x => !x.m.hasBaseline ? null : h('div', { class: 'row', style: { gap: '4px' } }, h('span', { class: 'rank r' + x.rank }, FD.fmt.num(x.rank)), x.move ? h('span', { class: 'delta ' + (x.move > 0 ? 'up' : 'down') }, I(x.move > 0 ? 'arrow-up' : 'arrow-down', 's14'), FD.fmt.num(Math.abs(x.move))) : null) },
      { key: 'vsr', label: t('L_COL_VSR'), sort: (a, b) => FD.nameOf(vsrOf(a.vsr)).localeCompare(FD.nameOf(vsrOf(b.vsr))), render: x => h('div', null, who(vsrOf(x.vsr)), full && x.context.length ? h('div', { class: 'row wrap', style: { marginTop: '4px', gap: '4px' } }, x.context.slice(0, 2).map(c => FD.chip(tx(c.id, c.slots), 'outline'))) : null) },
      full ? num('score', t('L_COL_VS_BASE'), x => x.m.hasBaseline ? x.m.vsBaseline : -Infinity, x => S.baseDelta(x.m)) : null,
      // the five sales metrics, each with its change against the comparison period
      ...FD.PILOT_METRICS.map(mt => Object.assign(num(mt.k, t(SHORT[mt.k] || mt.label), x => x.m.lev[mt.k], x => cmp(h('b', null, FD.metricText(mt.k, x.m.lev[mt.k])), up(x) || mt.k !== 'upsell' ? S.leverDelta(mt.k, x.m.lev[mt.k], x.prev.lev[mt.k]) : null)), { hint: mt.k === 'upsell' && prePilot ? t('L_NO_PRIOR_UPSELL') : null })),
      full && { key: 'trend', label: t('L_COL_TREND'), render: x => (x.spark || []).filter(v => v != null).length < 3 ? null : h('span', { title: t(x.trendStep === 1 ? 'L_TREND_DAYS' : 'L_TREND_WEEKS') }, FD.spark(x.spark)) }].filter(Boolean)
      // nothing synced from SalesBuzz yet today for this salesman: show a dash, not a fake drop
      .map(c => ['rank', 'vsr', 'trend'].includes(c.key) ? c : Object.assign({}, c, { render: x => x.partial && !x.m.genuine ? h('span', { class: 'small muted', title: t('L_NO_VISITS_YET') }, '—') : c.render(x) })); };

  S.teamTable = (id, rows, full) => {
    const metric = FD.PILOT_METRICS.some(m => m.k === L['team:metric']) ? L['team:metric'] : 'primary';
    const labels = Object.fromEntries(FD.PILOT_METRICS.map(m => [m.k, m.label]));
    const columns = S.teamColumns(full, rows[0]?.partial, rows[0]?.prePilot);
    const metricColumn = S.teamColumns(true, rows[0]?.partial, rows[0]?.prePilot).find(c => c.key === metric);
    const compact = [
      { key: 'rank', label: t('L_COL_RANK'), width: '34px', nosort: true, render: x => x.m.hasBaseline ? h('span', { class: 'rank r' + x.rank }, FD.fmt.num(x.rank)) : null }, // no baseline: unranked
      { key: 'vsr', label: t('L_COL_VSR'), nosort: true, render: x => h('div', { class: 'team-person' }, h('b', null, FD.nameOf(vsrOf(x.vsr))), h('span', { class: 'small muted' }, FD.routeArea(st().world.routes.find(r => r.id === vsrOf(x.vsr).route)))) },
      { key: 'score', label: t('L_COL_VS_BASE'), width: '64px', num: true, nosort: true, render: x => S.baseDelta(x.m) },
      Object.assign({}, metricColumn, { label: t('L_PILOT_VALUE'), hint: null, width: '96px' })
    ];
    const onRow = x => S.vsrDrawer(x.vsr);
    return h('div', { class: 'team-comparison' },
      h('div', { class: 'team-wide' }, FD.table({ id, rows, onRow, defaultSort: null, columns })),
      h('div', { class: 'team-compact' },
        h('label', { class: 'team-metric-control' }, h('span', { class: 'small muted' }, t('L_COMPARE_METRIC')),
          FD.select(FD.PILOT_METRICS.map(m => ({ id: m.k, label: t(labels[m.k]) })), metric, value => { L['team:metric'] = value; FD.render(); }, { 'aria-label': t('L_CHOOSE_METRIC'), 'data-focus': 'team-metric:' + id })),
        FD.table({ id: id + 'Compact', rows, onRow, defaultSort: null, columns: compact })));
  };

  // ================= TEAM =================
  FD.registerView('sup', 'team', r => {
    if (r.id) { const v = vsrOf(r.id); if (v) return { title: FD.nameOf(v), back: () => FD.go('#/sup/team'), body: [h('div', { class: 'card', style: { padding: '20px' } }, S.vsrContent(v.id, true))] }; }
    const s = st(); const { from, to } = S.range();
    const rows = FD.teamCompare(s, from, to).filter(x => !S.f.route || vsrOf(x.vsr).route === S.f.route);
    const table = S.teamTable('teamFull', rows, true);
    const p = rows[0] && rows[0].prevRange;
    // suggested tips: one collapsed bar on top (like Today's bars); it opens the per-salesman list and is gone once all are sent
    const drafts = FD.coachDrafts(s).filter(d => !S.f.route || vsrOf(d.vsr).route === S.f.route), nV = new Set(drafts.map(d => d.vsr)).size;
    const tipBar = drafts.length ? h('button', { type: 'button', class: 'card fu-bar', on: { click: () => S.tipsDrawer() } },
      h('span', { class: 'fu-ic', style: { width: '32px', height: '32px' } }, I('bulb', 's16')),
      h('span', { class: 'grow', style: { minWidth: 0 } }, h('b', null, t('L_TIPS_BAR', { n: FD.fmt.num(drafts.length), m: FD.fmt.num(nV) })), h('span', { class: 'small muted ellipsis', style: { display: 'block' } }, t('L_TIPS_BAR_SUB'))),
      h('span', { class: 'btn secondary sm' }, t('L_REVIEW'))) : null;
    return { title: t('L_NAV_TEAM'), body: [tipBar, card(t('L_P_TEAM'), null, h('div', null, table, p ? h('div', { class: 'small muted', style: { padding: '10px 16px' } }, (rows[0].partial ? t('L_CMP_TODAY', { date: FD.fmt.date(p.to), time: FD.fmt.time(s.clock.time) }) : t(rows[0].prePilot ? 'L_CMP_NOTE_PRE' : 'L_CMP_NOTE', { date: FD.fmt.date(p.from), label: FD.fmt.date(p.to) }))) : null), { flush: true, icon: 'users', info: t('I_TEAM') })] };
  });

  // ================= STORES =================
  FD.registerView('sup', 'stores', r => {
    if (r.id && storeOf(r.id)) return { title: FD.nameOf(storeOf(r.id)), back: () => FD.go('#/sup/stores'), body: [h('div', { class: 'card', style: { padding: '20px' } }, S.storeContent(r.id, null, true))] };
    const s = st(); const F = L['stores:f'] = L['stores:f'] || {}; if (L['stores:band']) { F.attn = true; L['stores:band'] = null; }
    const rows=FD.visibleStoreRows(s,F,S.vans().map(v=>v.id));
    const filters = () => h('div', { class: 'filters' },
      FD.searchBox('supStores', t('L_COL_STORE'), F.q, v => { F.q = v; L['stores:n'] = 50; FD.render(); }, { width: '240px' }),
      FD.seg([{ id: '', label: t('L_ALL_STORES') }, { id: 'A', label: t('L_ATTN_ONLY') }], F.attn ? 'A' : '', v => { F.attn = !!v; L['stores:n'] = 50; FD.render(); }),
      FD.select([{ id: '', label: t('L_ALL_LABELS') }].concat(FD.LABELS.map(x => ({ id: x, label: t('LBL_' + x) }))), F.label || '', v => { F.label = v; L['stores:n']=50; FD.render(); }),
      FD.select([{ id: '', label: t('L_ALL_TAGS') }].concat(FD.TAGS.map(x => ({ id: x, label: t('TAGN_' + x.slice(4)) }))), F.tag || '', v => { F.tag = v; L['stores:n']=50; FD.render(); }),
      FD.select([{ id: '', label: t('L_ALL_SIZES') }].concat(FD.SIZES.map(x => ({ id: x, label: t('SIZE_' + x) }))), F.size || '', v => { F.size = v; L['stores:n']=50; FD.render(); }));
    const shown = L['stores:n'] || 50; // page of 50, stores needing attention first
    const num = (v, f) => v == null ? '—' : f(v);
    const table = FD.table({ id: 'storesFull', rows, limit: shown, onRow: x => S.storeDrawer(x.s.id), defaultSort: ['attn', 'desc'], columns: [
      { key: 'name', label: t('L_COL_STORE'), sort: (a, b) => FD.nameOf(a.s).localeCompare(FD.nameOf(b.s)), render: x => storeCell(x.s) },
      { key: 'attn', label: t('L_COL_WHY'), sort: (a, b) => a.score - b.score, firstDir: 'desc', render: x => x.a ? S.attnChips(x.a) : h('span', { class: 'muted' }, '—') },
      { key: 'last', label: t('L_COL_VISIT_ORDER'), sort: (a, b) => String(a.g.lastVisit).localeCompare(String(b.g.lastVisit)), render: x => S.visitOrder(x.g.lastVisit, x.g.lastOrder) },
      { key: 'od', label: t('L_ORDER_DAYS'), hint:t('L_PERIOD_4W'), num: true, sort: (a, b) => a.g.orderDays28 - b.g.orderDays28, render: x => FD.fmt.num(x.g.orderDays28) },
      { key: 'avg', label: t('L_G_AVG'), num: true, sort: (a, b) => a.g.avgOrder - b.g.avgOrder, render: x => x.g.avgOrder ? FD.fmt.money0(x.g.avgOrder) : '—' },
      // ponytail: visits without an order is already the first Why chip, so no column of its own
      { key: 'ret', label: t('L_COL_RETURNS'), hint:t('L_PERIOD_4W'), num: true, sort: (a, b) => a.g.returnsPct - b.g.returnsPct, render: x => num(x.g.sales28 ? x.g.returnsPct : null, FD.fmt.pct) },
      { key: 'dem', label: t('L_G_DEMAND'), sort: (a, b) => a.g.orderDays28 - b.g.orderDays28, render: x => S.demandChip(x.g) },
      { key: 'resp', label: t('L_RESPONSE'), sort: (a, b) => a.resp.conv - b.resp.conv, render: x => S.segChip(x.resp.segment) }] });
    const more=h('div',{class:'card-f pager'},h('span',{class:'small muted'},t('PG_SHOWING',{n:FD.fmt.num(Math.min(shown,rows.length)),m:FD.fmt.num(rows.length)})),rows.length>shown?FD.btn(t('L_SHOW_MORE'),()=>{L['stores:n']=shown+50;FD.render();},'ghost sm','chevron-down'):null);
    return { title: t('PG_STORE_COUNT',{n:FD.fmt.num(rows.length)}), bar: filters, body: [h('div', { class: 'card' }, table, more)] };
  });

  // ================= PRODUCTS =================
  FD.registerView('sup', 'skus', () => S.productPage());
  // ================= OPPORTUNITIES (list + outlet × product grid) =================
  FD.registerView('sup', 'opps', () => {
    const s = st(); const mode = 'list'; const F = L['opps:f'] = L['opps:f'] || {}; F.prod = F.prod || { path: [], query: '' }; // the store × product grid was cut: store and product drawers show it
    const reset = () => { L['opps:n'] = 50; FD.render(); };
    // three controls only: search, a Stores panel (class, area) and a Products panel (category > family > flavour > pack size);
    // what is set shows as chips that remove with one tap
    const PF = ['PF_CATEGORIES', 'PF_FAMILIES', 'PF_FLAVOURS', 'PF_PACKS'], pick = (on, label, click) => h('button', { type: 'button', class: 'chip chip-btn' + (on ? ' on' : ''), 'aria-pressed': String(on), on: { click } }, label);
    const panel = (title, body) => FD.sheet.open({ center: true, title, render: () => h('div', { class: 'stack s16 opp-panel' }, body()), footer: () => [FD.btn(t('L_DONE'), () => FD.sheet.close(), 'primary block')] });
    const storePanel = () => panel(t('L_COL_STORE'), () => [
      h('div', null, h('div', { class: 'small muted' }, t('L_ALL_LABELS')), h('div', { class: 'row wrap' }, FD.LABELS.map(x => pick(F.label === x, t('LBL_' + x), () => { F.label = F.label === x ? '' : x; reset(); FD.sheet.redraw(); })))),
      h('div', null, h('div', { class: 'small muted' }, t('L_ALL_TAGS')), h('div', { class: 'row wrap' }, FD.TAGS.map(x => pick(F.tag === x, t('TAGN_' + x.slice(4)), () => { F.tag = F.tag === x ? '' : x; reset(); FD.sheet.redraw(); }))))]);
    const nStore = !!F.label + !!F.tag;
    const active = [F.label ? [t('LBL_' + F.label), () => { F.label = ''; }] : null, F.tag ? [t('TAGN_' + F.tag.slice(4)), () => { F.tag = ''; }] : null].filter(Boolean);
    const filters = () => h('div', { class: 'filters' },
      FD.searchBox('supOpps', t('L_COL_STORE') + ' / ' + t('L_COL_PRODUCT'), F.q, v => { F.q = v; reset(); }, { width: '240px' }),
      FD.btn(t('L_COL_STORE') + (nStore ? ' · ' + FD.fmt.num(nStore) : ''), storePanel, nStore ? 'primary sm' : 'secondary sm', 'store'),
      active.map(([label, clear]) => h('button', { type: 'button', class: 'chip chip-btn on', 'aria-label': t('L_REMOVE') + ' · ' + label, on: { click: () => { clear(); reset(); } } }, label, I('x', 's14'))),
      FD.productPickBar(F.prod, reset));
    if (mode === 'list') {
      const q = (F.q || '').trim().toLowerCase();
      const prodOk = new Set(FD.productFilter(FD.SKUS.map(k => k.code), F.prod));
      const rows = FD.opportunities(s, { route: S.f.route || null, label: F.label || null, tag: F.tag || null }).filter(o => prodOk.has(o.sku))
        .filter(o => !q || (FD.nameOf(storeOf(o.store)) + ' ' + FD.nameOf(FD.sku(o.sku))).toLowerCase().includes(q));
      const shown = L['opps:n'] || 50; // page of 50, highest store margin first
      const more = h('div', { class: 'card-f pager' }, h('span', { class: 'small muted' }, t('PG_SHOWING_OPPS', { n: FD.fmt.num(Math.min(shown, rows.length)), m: FD.fmt.num(rows.length) })),
        rows.length > shown ? FD.btn(t('L_SHOW_MORE'), () => { L['opps:n'] = shown + 50; FD.render(); }, 'ghost sm', 'chevron-down') : null);
      return { title: t('L_NAV_OPPS') + ' · ' + FD.fmt.num(rows.length), bar: filters, body: [h('div', { class: 'card' }, FD.table({ id: 'oppsFull', rows, limit: shown, onRow: o => S.storeDrawer(o.store, o.sku), defaultSort: ['ev', 'desc'], columns: [
        { key: 's', label: t('L_COL_STORE'), sort: (a, b) => FD.nameOf(storeOf(a.store)).localeCompare(FD.nameOf(storeOf(b.store))), render: o => storeCell(storeOf(o.store)) },
        { key: 'v', label: t('L_COL_VSR'), render: o => FD.nameOf(vsrOf(storeOf(o.store).vsr)) },
        { key: 'p', label: t('L_COL_PRODUCT'), sort: (a, b) => FD.nameOf(FD.sku(a.sku)).localeCompare(FD.nameOf(FD.sku(b.sku))), render: o => FD.skuLabel(o.sku) },
        { key: 't', label: t('L_COL_TYPE'), sort: (a, b) => a.type.localeCompare(b.type), render: o => FD.typeChip(o.type) },
        { key: 'why', label: t('L_WHY'), render: o => h('span', { class: 'small muted', style: { display: 'block', minWidth: '200px', maxWidth: '320px' } }, tx(o.reasonId, Object.assign({ skuCode: o.sku }, o.slots, { unitOf: o.sku }))) },
        { key: 'q', label: t('L_COL_QTY'), num: true, sort: (a, b) => a.qty - b.qty, render: o => FD.fmt.num(o.qty) },
        { key: 'ev', label: t('L_EST_MARGIN'), num: true, sort: (a, b) => a.ev - b.ev, render: o => h('b', null, FD.fmt.money0(o.ev)) }] }), more)] };
    }
  });

  // ================= ENGINE LEARNING =================
  FD.registerView('sup', 'learn', () => {
    const s = st(); const { from, to } = S.range();
    const misses = s.misses.filter(m => m.date >= from && m.date <= to && (!S.f.route || storeOf(m.store).route === S.f.route) && m.mark !== 'IGNORE').sort((a, b) => b.date.localeCompare(a.date));
    const acc = FD.recAccuracy(s);
    const exportCsv = () => {
      const esc = v => { const x = v == null ? '' : String(v); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
      const head = ['event', 'id', 'date', 'store', 'salesman', 'product_code', 'product', 'type', 'qty', 'outcome', 'got', 'alternative', 'reason', 'brand', 'check_28d', 'exempted', 'corrected'];
      const rows = s.recs.filter(r => r.outcome && r.outcome !== 'CARRIED').map(r => ['recommendation', r.id, r.date, r.store, FD.recVsr(r), r.sku, FD.sku(r.sku).name, r.type, r.qtyModified ?? r.qty, r.outcome, r.got, r.alt, r.reason, r.brand, r.maturity, r.exempted, r.corrected]);
      s.misses.forEach(m => rows.push(['engine_miss_' + m.type.toLowerCase(), m.id, m.date, m.store, m.vsr, m.sku, FD.sku(m.sku).name, '', '', '', '', m.recSku, '', '', '', '', m.mark || '']));
      const blob = new Blob(['﻿' + [head, ...rows].map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = h('a', { href: URL.createObjectURL(blob), download: 'fielddrive_training_events_' + today() + '.csv' }); document.body.appendChild(a); a.click(); a.remove();
      FD.toast('S_EXPORTED');
    };
    const bySku = {}; misses.forEach(m => { (bySku[m.sku] = bySku[m.sku] || []).push(m); });
    return { title: t('L_NAV_LEARN'), body: [h('div', { class: 'banner info' }, I('lock'), h('span', null, t('L_INTERNAL'))),
      h('div', { class: 'grid-2' },
        card(t('L_ACCURACY'), null, FD.bars(acc.map(a => ({ label: t('TYPE_' + a.type), value: a.conv, display: FD.fmt.pct(a.conv), tip: tx('M_ACC', { typeId: a.type, pct: a.conv, n: a.sent }) }))), { icon: 'chart' }),
        card(t('L_MISSES'), t('L_MISSES_D'), FD.bars(Object.entries(bySku).sort((a, b) => b[1].length - a[1].length).slice(0, 8).map(([code, ms]) => ({ label: FD.nameOf(FD.sku(code)), value: ms.length }))), { icon: 'cpu', right: FD.btn(t('L_EXPORT'), exportCsv, 'secondary sm', 'download') })),
      h('div', { class: 'card' }, misses.length ? FD.table({ id: 'misses', rows: misses, limit: L['learn:n'] || 25, columns: [
        { key: 'd', label: t('L_COL_DATE'), sort: (a, b) => a.date.localeCompare(b.date), render: m => FD.fmt.date(m.date) },
        { key: 'what', label: t('L_WHY'), render: m => m.type === 'ALT' ? tx('M_ALT', { skuCode: m.recSku, altCode: m.sku, storeId: m.store }) : tx('M_UNREC', { vsrId: m.vsr, skuCode: m.sku, storeId: m.store }) },
        { key: 'ty', label: t('L_COL_TYPE'), render: m => FD.chip(t(m.type === 'ALT' ? 'L_MISS_ALT' : 'L_MISS_UNREC'), m.type === 'ALT' ? 'info' : 'warn') },
        { key: 'tags', label: t('L_COL_TAGS'), render: m => storeOf(m.store).tags.map(x => t('TAGN_' + x.slice(4))).join(', ') },
        { key: 'a', label: '', render: m => m.mark === 'USEFUL' ? FD.chip([I('check', 's14'), t('M_USEFUL')], 'good') : h('div', { class: 'row', style: { justifyContent: 'flex-end' } },
          FD.btn(t('L_MARK_USEFUL'), () => FD.dx('MISS_MARK', { id: m.id, mark: 'USEFUL' }), 'secondary sm'), FD.btn(t('L_IGNORE'), () => FD.dx('MISS_MARK', { id: m.id, mark: 'IGNORE' }), 'ghost sm')) }] }) : FD.empty('X_LEARN', null, 'cpu'),
        // page of 25, same pattern as Stores and Opportunities
        misses.length > (L['learn:n'] || 25) ? h('div', { class: 'card-f pager' }, h('span', { class: 'small muted' }, t('PG_SHOWING_N', { n: FD.fmt.num(L['learn:n'] || 25), m: FD.fmt.num(misses.length) })),
          FD.btn(t('L_SHOW_MORE_25'), () => { L['learn:n'] = (L['learn:n'] || 25) + 25; FD.render(); }, 'ghost sm', 'chevron-down')) : null)] };
  });

  // ================= RULES =================
  FD.registerView('sup', 'rules', () => {
    const s = st(); const R = s.rules;
    const num = (label, key, min, max) => h('div', { class: 'list-row' }, h('span', { class: 'grow' }, t(label)), FD.stepper(R[key], min, max, v => { if (v >= min && v <= max) FD.dx('RULE_SET', { rule: key, value: v }); }, t(label)));
    const blockText = b => b.recId ? FD.nameOf(FD.sku(b.sku)) + ' · ' + FD.nameOf(storeOf(b.store)) + ' · ' + FD.fmt.date(b.date) : [b.sku ? FD.nameOf(FD.sku(b.sku)) : null, b.store ? FD.nameOf(storeOf(b.store)) : t('L_EVERYWHERE')].filter(Boolean).join(' · ');
    const pinScope = p => !p.scope ? t('L_SCOPE_ALL') : p.scope === 'tag' ? t('TAGN_' + p.id.slice(4)) : p.scope === 'label' ? t('LBL_' + p.id) : p.scope === 'route' ? FD.nameOf(s.world.routes.find(r => r.id === p.id)) : FD.nameOf(storeOf(p.id));
    const mgroup = L['rules:mgroup'] || 'B';
    const mustKeys = FD.LABELS.map(l => ({ id: l, label: t('LBL_' + l) })).concat(FD.TAGS.map(x => ({ id: x, label: t('TAGN_' + x.slice(4)) })));
    const addBlock = () => { const X = { kind: 'sku', sku: FD.SKUS[0].code, store: s.world.stores[0].id };
      FD.sheet.open({ center: true, title: t('L_ADD') + ' · ' + t('L_R_BLOCKS'), render: () => h('div', { class: 'stack s16' },
        FD.seg([{ id: 'sku', label: t('L_PRODUCT') }, { id: 'store', label: t('L_STORE') }, { id: 'both', label: t('L_PRODUCT') + ' + ' + t('L_STORE') }], X.kind, v => { X.kind = v; FD.sheet.redraw(); }),
        X.kind !== 'store' ? h('div', { class: 'field' }, h('label', null, t('L_PRODUCT')), FD.select(FD.SKUS.map(k => ({ id: k.code, label: FD.nameOf(k) })), X.sku, v => { X.sku = v; })) : null,
        X.kind !== 'sku' ? h('div', { class: 'field' }, h('label', null, t('L_STORE')), FD.select(s.world.stores.map(x => ({ id: x.id, label: FD.nameOf(x) })), X.store, v => { X.store = v; })) : null),
        footer: () => [FD.btn(t('L_CANCEL'), () => FD.sheet.close(), 'secondary'), h('span', { class: 'grow' }), FD.btn(t('L_ADD'), () => { FD.dx('BLOCK_ADD', { sku: X.kind !== 'store' ? X.sku : null, store: X.kind !== 'sku' ? X.store : null }); FD.sheet.close(); FD.toast('S_SAVED'); }, 'primary')] }); };
    const addPin = () => { let code = FD.SKUS[0].code; FD.sheet.open({ center: true, title: t('L_ADD') + ' · ' + t('L_R_PINS'), render: () => h('div', { class: 'field' }, h('label', null, t('L_PRODUCT')), FD.select(FD.SKUS.map(k => ({ id: k.code, label: FD.nameOf(k) })), code, v => { code = v; })),
      footer: () => [FD.btn(t('L_CANCEL'), () => FD.sheet.close(), 'secondary'), h('span', { class: 'grow' }), FD.btn(t('L_CHOOSE'), () => { FD.sheet.close(); setTimeout(() => S.pinSheet(code), 320); }, 'primary')] }); };
    const addWatch = () => { let code = FD.SKUS.find(k => !s.watchlist.includes(k.code)).code; FD.sheet.open({ center: true, title: t('L_WATCH_ADD'), render: () => h('div', { class: 'field' }, h('label', null, t('L_PRODUCT')), FD.select(FD.SKUS.filter(k => !s.watchlist.includes(k.code)).map(k => ({ id: k.code, label: FD.nameOf(k) })), code, v => { code = v; })),
      footer: () => [FD.btn(t('L_CANCEL'), () => FD.sheet.close(), 'secondary'), h('span', { class: 'grow' }), FD.btn(t('L_ADD'), () => { FD.dx('WATCH_ADD', { sku: code }); FD.sheet.close(); FD.toast('S_SAVED'); }, 'primary')] }); };
    const auditAll = s.audit.slice().reverse(); const auditList = L['rules:auditAll'] ? auditAll : auditAll.slice(0, 10);
    const mustList = R.mustStock[mgroup] || [];
    const blockRows = s.blocks.slice().reverse();
    const blocksTable = blockRows.length ? FD.table({ id: 'rulesBlocks', rows: blockRows, onRow: b => b.store ? S.storeDrawer(b.store) : S.skuDrawer(b.sku), columns: [
      { key: 'p', label: t('L_COL_PRODUCT'), sort: (x, y) => (x.sku ? FD.nameOf(FD.sku(x.sku)) : '').localeCompare(y.sku ? FD.nameOf(FD.sku(y.sku)) : ''), render: b => b.sku ? FD.skuLabel(b.sku) : h('span', { class: 'row' }, I('ban', 's16'), t('L_ALL_PRODUCTS')) },
      { key: 'w', label: t('L_COL_WHERE'), sort: (x, y) => (x.store || '').localeCompare(y.store || ''), render: b => h('div', null, h('div', null, b.store ? FD.nameOf(storeOf(b.store)) : t('L_EVERYWHERE')), b.recId ? h('div', { class: 'small muted' }, t('L_ONE_REC') + ' · ' + FD.fmt.date(b.date)) : null) },
      { key: 'd', label: t('L_COL_SINCE'), sort: (x, y) => (x.at.date + x.at.time).localeCompare(y.at.date + y.at.time), render: b => h('span', { class: 'nowrap' }, FD.fmt.date(b.at.date)) },
      { key: 'x', label: '', render: b => FD.btn(t('L_UNBLOCK'), () => FD.dx('BLOCK_REMOVE', { blockId: b.id }), 'ghost sm') }] }) : FD.empty('L_NONE_YET', null, 'ban');
    // settings-style layout: a list of sections, one section shown at a time (phone: list first, then the section)
    const SECS = [
      ['recs', 'L_R_NUMBERS', 'sliders', null, () => [card(t('L_R_NUMBERS'), null, h('div', null, num('L_R_LAPSED', 'lapsedDays', 7, 60), num('L_R_COOLDOWN', 'cooldownDays', 0, 60), num('L_R_MATURITY', 'maturityDays', 7, 56), num('L_R_MAX', 'maxPerStore', 1, 3), num('L_R_FIRST', 'firstFillMax', 1, 3),
          h('div', { class: 'list-row' }, h('div', { class: 'grow' }, h('div', null, t('L_R_VANFEED')), h('div', { class: 'small muted' }, t('L_R_VANFEED_D'))), FD.toggle(R.vanFeed, v => FD.dx('VANFEED_SET', { on: v }), t('L_R_VANFEED')))), { flush: true, icon: 'sliders', info: t('I_RULES') })]],
      ['blocked', 'L_SEC_BLOCKPIN', 'ban', s.blocks.length + s.pins.length, () => [card(t('L_R_BLOCKS'), t('L_BLOCKS_NOTE'), h('div', { class: 'rules-scroll' }, blocksTable), { flush: true, icon: 'ban', right: FD.btn(t('L_ADD'), addBlock, 'secondary sm', 'plus') }), card(t('L_R_PINS'), null, s.pins.length ? h('div', null, s.pins.slice().reverse().map(p => h('div', { class: 'list-row' }, h('div', { class: 'grow', style: { minWidth: 0 } }, FD.skuLabel(p.sku, pinScope(p) + (p.until ? ' · ' + t('L_UNTIL') + ' ' + FD.fmt.date(p.until) : ''))), FD.btn(t('L_REMOVE'), () => FD.dx('PIN_REMOVE', { pinId: p.pinId }), 'ghost sm')))) : FD.empty('L_NONE_YET', null, 'pin'),
          { flush: true, icon: 'pin', info: t('I_PINS'), right: FD.btn(t('L_ADD'), addPin, 'secondary sm', 'plus') })]],
      ['watch', 'L_SEC_WATCH', 'eye', s.watchlist.length, () => [S.creditWatch(), card(t('L_R_WATCH'), t('L_WATCH_HOW'), s.watchlist.length ? h('div', null, s.watchlist.map(c => { const w = FD.watchStats(s, c);
            return h('div', { class: 'list-row click', on: { click: e => { if (!e.target.closest('button')) S.skuDrawer(c); } } }, h('div', { class: 'grow', style: { minWidth: 0 } }, FD.skuLabel(c, t('L_COL_SINCE') + ' ' + FD.fmt.date(w.since) + ' · ' + FD.fmt.pct(w.before) + ' → ' + (w.after == null ? '—' : FD.fmt.pct(w.after)))), S.watchChip(w), FD.btn(t('L_REMOVE'), () => FD.dx('WATCH_REMOVE', { sku: c }), 'ghost sm')); })) : FD.empty('L_NONE_YET', null, 'alert'),
          { cls: 'watch-card', flush: true, icon: 'alert', right: FD.btn(t('L_ADD'), addWatch, 'secondary sm', 'plus') })]],
      ['sees', 'L_SEC_SEES', 'eye', null, () => [(() => { const shelf = L['rules:score'] === 'shelf'; // one card: the scorecard by default, Shelf Score weights on the switch
          const sw = FD.seg([{ id: 'card', label: t('L_SCORECARD_SETUP') }, { id: 'shelf', label: t('SC_SCORE') }], shelf ? 'shelf' : 'card', v => { L['rules:score'] = v; FD.render(); });
          return card(t(shelf ? 'SC_SETTINGS' : 'L_SCORECARD_SETUP'), t(shelf ? 'SC_SETTINGS_D' : 'L_SEES_NOTE'), shelf ? S.scWeightsBody() : (() => { const sees = R.vsrSees || {}; // ranking uses net sales per selling day vs own baseline; only visibility is set here
            const seeT = (k, lb) => FD.toggle(sees[k] !== false, v => FD.dx('VISIBILITY_SET', { sees: { [k]: v } }), t('L_COL_SEES') + ': ' + t(lb));
            return h('div', null, FD.PILOT_METRICS.map(mt => [mt.label, mt.k]).concat([['L_SEE_RANK', 'rank']]).map(([lb, k]) => h('div', { class: 'list-row' }, h('span', { class: 'grow' }, t(lb)), h('span', { class: 'small muted' }, t('L_COL_SEES')), seeT(k, lb))));
          })(), { icon: shelf ? 'camera' : 'chart', right: sw, flush: shelf }); })()]],
      ['wa', 'W_RULES', 'message', null, () => [card(t('W_RULES'), t('W_RULES_D'), FD.table({ id: 'waRules', columns: [
          { key: 'c', label: t('W_COL_CARD'), nosort: true, render: x => x.first ? h('b', null, t('W_CARD_' + x.card)) : '' },
          { key: 'r', label: t('W_COL_REPLY'), nosort: true, render: x => h('span', { class: x.sub ? 'muted' : '' }, (x.sub ? '↳ ' : '') + t(x.sub || x.reply)) },
          { key: 'e', label: t('W_COL_DOES'), nosort: true, render: x => t(FD.WA_EFFECT[x.reply]) }],
        rows: Object.entries(FD.WA_CARDS).flatMap(([card, d]) => d.replies.flatMap((reply, i) => [{ card, reply, first: i === 0 }].concat(((d.subs || {})[reply] || []).map(sub => ({ card, reply, sub }))))) }), { flush: true, icon: 'message' })]],
      ['codes', 'L_R_CODES', 'message', null, () => [card(t('L_R_CODES'), t('L_REASONS_NOTE'), S.reasonCodes(), { flush: true, icon: 'message' })]],
      ['area', 'L_AREA_ASSORT', 'grid', null, () => [card(t('L_AREA_ASSORT'), t('L_AREA_ASSORT_D'), h('div', { class: 'stack s16' }, h('div', { class: 'row wrap' }, h('select', { class: 'select', style: { maxWidth: '280px' }, 'aria-label': t('L_R_MUST'), on: { change: e => { L['rules:mgroup'] = e.target.value; FD.render(); } } },
          h('optgroup', { label: t('L_STORE_TYPE') }, FD.LABELS.map(l => h('option', { value: l, selected: l === mgroup }, t('LBL_' + l)))),
          h('optgroup', { label: t('L_LOCATION_TYPE') }, FD.TAGS.map(x => h('option', { value: x, selected: x === mgroup }, t('TAGN_' + x.slice(4)))))), FD.btn(t('L_RECALC'), () => { FD.dx('MUSTSTOCK_RECALC', {}); FD.toast('S_SAVED'); }, 'secondary sm', 'refresh')),
        h('div', { class: 'tiles', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' } }, FD.SKUS.map(k => h('label', { class: 'check card', style: { padding: '8px 10px', boxShadow: 'none' } }, h('input', { type: 'checkbox', checked: mustList.includes(k.code), on: { change: e => FD.dx('MUSTSTOCK_SET', { group: mgroup, sku: k.code, on: e.target.checked }) } }), FD.skuTile(k.code, 26), h('span', { class: 'small' }, FD.nameOf(k)))))), { icon: 'layers', info: t('I_AREA') })]],
      ['log', 'L_R_AUDIT', 'refresh', null, () => [card(t('L_R_AUDIT'), null, auditList.length ? h('div', { class: 'audit-list' }, auditList.map(a => h('div', { class: 'list-row' }, I('edit', 's16'), h('span', { class: 'grow small' }, t(a.id) + (a.slots && a.slots.skuCode ? ' · ' + FD.nameOf(FD.sku(a.slots.skuCode)) : '') + (a.slots && a.slots.storeId ? ' · ' + FD.nameOf(storeOf(a.slots.storeId)) : '')),
        h('span', { class: 'small muted' }, t('L_CHANGED_BY', { sup: FD.nameOf(s.world.supervisor), date: FD.fmt.date(a.at.date), time: FD.fmt.time(a.at.time) })))), auditAll.length > 10 ? h('div', { class: 'list-row', style: { justifyContent: 'center' } }, FD.btn(L['rules:auditAll'] ? t('L_SHOW_LESS') : t('L_SHOW_ALL_N', { n: FD.fmt.num(auditAll.length) }), () => { L['rules:auditAll'] = !L['rules:auditAll']; FD.render(); }, 'ghost sm')) : null) : FD.empty('L_NONE_YET', null, 'edit'), { flush: true, icon: 'clock', info: t('I_AUDIT') })]]];
    const picked = L['rules:sec'], cur = SECS.find(x => x[0] === picked) || SECS[0];
    const go = id => { L['rules:sec'] = id; FD.render(); const pg = document.getElementById('sup-page'); if (pg) pg.scrollTop = 0; };
    return { title: t('L_NAV_RULES'), body: [h('div', { class: 'rules-split' + (picked ? ' picked' : '') },
      h('nav', { class: 'rules-nav', 'aria-label': t('L_NAV_RULES') }, SECS.map(([id, label, icon, n]) => h('button', { type: 'button', class: id === cur[0] ? 'on' : '', 'aria-current': id === cur[0] ? 'true' : null, on: { click: () => go(id) } },
        I(icon, 's16'), h('span', { class: 'grow' }, t(label)), n ? h('span', { class: 'pill-count' }, FD.fmt.num(n)) : null, h('span', { class: 'mob-only' }, I('chevron-right', 's16'))))),
      h('div', { class: 'rules-pane' }, h('button', { type: 'button', class: 'btn ghost sm mob-only rules-back', on: { click: () => { L['rules:sec'] = null; FD.render(); } } }, I('arrow-left', 's16'), t('L_NAV_RULES')), ...cur[4]()))] };
  });
})();
