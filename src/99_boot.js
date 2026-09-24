(function () {
  const FD = globalThis.FD;
  if (typeof document === 'undefined') return;
  FD.selfTest = function () {
    const ok = [], bad = [];
    const eq = (name, a, b) => (JSON.stringify(a) === JSON.stringify(b) ? ok : bad).push(name);
    const rec = { sku: '3040430754', qty: 2 };
    eq('grade full', FD.grade(rec, [{ sku: '3040430754', units: 2 }], []).outcome, 'FULL');
    eq('grade partial', FD.grade(rec, [{ sku: '3040430754', units: 1 }], []).outcome, 'PARTIAL');
    eq('grade alternative', FD.grade(rec, [{ sku: '3040430756', units: 1 }], []).outcome, 'ALT');
    eq('grade not sold', FD.grade(rec, [], []).outcome, 'NOT_SOLD');
    const st = FD.state;
    eq('max 3 per store today', st.recs.filter(r => r.date === st.clock.date).reduce((m, r) => { m[r.store] = (m[r.store] || 0) + 1; return m; }, {}) && Math.max(0, ...Object.values(st.recs.filter(r => r.date === st.clock.date && !r.blockedAt).reduce((m, r) => { m[r.store] = (m[r.store] || 0) + 1; return m; }, {}))) <= st.rules.maxPerStore, true);
    eq('promo only last slot', st.world.stores.every(s => { const rs = FD.recommend(st, s.id, st.clock.date).recs; return rs.every((r, i) => r.type !== 'PROMO' || i === rs.length - 1); }), true);
    eq('no blocked credit recs', st.recs.some(r => r.date === st.clock.date && r.store === 'ST-047'), false);
    const msg = `selfTest: ${ok.length} passed${bad.length ? ', FAILED: ' + bad.join(', ') : ''}`;
    console.log(msg); FD.toast(null, null, { text: msg });
    return bad.length === 0;
  };
  function boot() {
    FD.injectSprite();
    FD.init(7);
    FD.applyPrefs();
    FD.subscribe(() => FD.schedule());
    FD.bus.on('toast', t => FD.toast(t.id, t.slots));
    FD.bus.on('notif', n => { const r = FD.route(); if (r.role === 'vsr' && FD.recVsr ? n.vsr === FD.state.vsrId : false) setTimeout(() => FD.notifyBanner(n), 120); });
    window.addEventListener('hashchange', () => { if (FD.tourEnd) FD.tourEnd(); FD.ovReset(); FD.sheet.closeAll(); FD.drawer.close(true); FD.menu.close(); FD.render(); });
    if (!location.hash) history.replaceState(null, '', '#/sup/home');
    FD.render();
    const sp = document.getElementById('splash'); if (sp) { sp.style.opacity = '0'; setTimeout(() => sp.remove(), 320); }
    setTimeout(() => FD.maybeTour(FD.route()), 400);
    if (/[?&]test\b/.test(location.search)) setTimeout(FD.selfTest, 600);
  }
  // let the splash paint before the ~1s data build
  requestAnimationFrame(() => setTimeout(boot, 30));
})();
