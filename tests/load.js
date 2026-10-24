const path = require('path');
const files = ['00_core.js', '01_text.js', '01_text_catalog.js', '01z_real_data.js', '02_data.js', '03_engine.js', '04_store.js', '05_metrics.js', '05b_followups.js', '05c_control.js', '06b_labels.js', '02b_photos.js', '02c_map.js', '02e_shelf.js'];
module.exports = function load(upTo = files.length) {
  delete globalThis.FD;
  for (const f of files.slice(0, upTo)) {
    const p = path.join(__dirname, '..', 'src', f);
    delete require.cache[require.resolve(p)];
    require(p);
    if (f === '02_data.js') { const extra = path.join(__dirname, '..', 'src', '02d_products.js'); delete require.cache[require.resolve(extra)]; require(extra); }
    if (f === '04_store.js') { const extra = path.join(__dirname, '..', 'src', '04a_planogram.js'); delete require.cache[require.resolve(extra)]; require(extra); }
    if (f === '05c_control.js') { const extra = path.join(__dirname, '..', 'src', '05d_planogram.js'); delete require.cache[require.resolve(extra)]; require(extra); const usability=path.join(__dirname,'..','src','05e_usability.js'); delete require.cache[require.resolve(usability)]; require(usability); }
  }
  return globalThis.FD;
};
module.exports.STAGES = { CORE: 1, DATA: 5, ENGINE: 6, STORE: 7, METRICS: 9, LOGIC: 11 };
