const path = require('path');
const files = ['00_core.js', '01_text.js', '01_text_catalog.js', '02_data.js', '03_engine.js', '04_store.js', '05_metrics.js', '05b_followups.js', '06b_labels.js', '02b_photos.js', '02c_map.js'];
module.exports = function load(upTo = files.length) {
  delete globalThis.FD;
  for (const f of files.slice(0, upTo)) {
    const p = path.join(__dirname, '..', 'src', f);
    delete require.cache[require.resolve(p)];
    require(p);
  }
  return globalThis.FD;
};
