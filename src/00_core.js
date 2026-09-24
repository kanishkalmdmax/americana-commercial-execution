(function () {
  const FD = globalThis.FD = globalThis.FD || {};
  // mulberry32: tiny seeded PRNG so every load produces the same demo data
  FD.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  FD.int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  FD.pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  FD.addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  FD.dow = iso => new Date(iso + 'T00:00:00Z').getUTCDay();
  FD.isSellingDay = iso => FD.dow(iso) !== 5;
  FD.daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
  FD.BASE_START = '2026-08-17'; FD.PILOT_START = '2026-10-12';
  FD.TODAY = '2026-11-18'; FD.PILOT_END = '2027-01-09';
  FD.lang = 'en'; FD.digits = 'arab';
  const subs = {};
  FD.bus = {
    on(evt, fn) { (subs[evt] = subs[evt] || []).push(fn); return () => { subs[evt] = subs[evt].filter(f => f !== fn); }; },
    emit(evt, data) { (subs[evt] || []).forEach(fn => fn(data)); }
  };
})();
