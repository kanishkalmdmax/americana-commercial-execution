(function () {
  const FD = globalThis.FD;
  const E = (en, ar) => ({ en, ar });
  const labels = {
    cake:E('Cakes','الكيك'), biscuit:E('Cookies','البسكويت'), rusk:E('Rusks','الشابورة'), other:E('Canned','المعلبات'), // nuts: family label below doubles as the category label
    soft:E('Soft cookies','كوكيز طرية'), butter:E('Butter cookies','بسكويت الزبدة'), choco:E('Choco cookies','كوكيز الشوكولاتة'), hershey:E("Hershey's cookies",'كوكيز هيرشيز'), peanut:E('Peanut butter cookies','كوكيز زبدة الفول السوداني'),
    swiss:E('Rolls','الرولات'), cupcake:E('Cupcakes','الكب كيك'), cakebar:E('Cake bars','كيك بار'), slice:E('Slice cakes','كيك شرائح'), pound:E('Pound cakes','الباوند كيك'), rusks:E('Fresh rusks','الشابورة'),
    tuna:E('Tuna','التونة'), beans:E('Beans','الفول والفاصوليا'), chickpeas:E('Chickpeas','الحمص'), corn:E('Sweet corn','الذرة الحلوة'), nuts:E('Nuts','المكسرات'),
    unspecified:E('Not specified','غير محدد'), vanilla:E('Vanilla','فانيلا'), chocolate:E('Chocolate','شوكولاتة'), strawberry:E('Strawberry','فراولة'), marble:E('Marble','رخامي'), fruit:E('Fruit','فواكه'), original:E('Original','أصلي'), raspberry:E('Raspberry','توت'),
    cocoa_vanilla:E('Cocoa & vanilla','كاكاو وفانيلا'), vanilla_strawberry:E('Vanilla & strawberry','فانيلا وفراولة'), chocolate_vanilla:E('Chocolate & vanilla','شوكولاتة وفانيلا'), chocolate_chips:E('Chocolate chips','رقائق الشوكولاتة'),
    red:E('Red','حمراء'), brown:E('Brown','بر'), diet:E('Whole wheat','قمح كامل'), cheese:E('Cheese','جبنة'), himalayan_salt:E('Himalayan salt','ملح هيمالايا'), sour_cream:E('Sour cream','قشدة حامضة'), sweet_chili:E('Sweet chili','فلفل حلو'),
    vegetable_oil:E('Vegetable oil','زيت نباتي'), sunflower_oil:E('Sunflower oil','زيت دوار الشمس'), tin:E('Tin','علبة معدنية'), pack:E('Pack','عبوة'), three_piece:E('3 pieces','٣ قطع'), jar:E('Jar','مرطبان')
  };
  Object.entries(labels).forEach(([k,v]) => { FD.CATALOG['PT_' + k.toUpperCase()] = v; });
  const cache = new Map();
  const grams = n => { const m = n.match(/\b(\d+(?:\.\d+)?)\s*g\b/i); return m ? +m[1] : null; };
  FD.productMeta = code => {
    if (cache.has(code)) return cache.get(code);
    const k = FD.sku(code); if (!k) return null;
    const n = k.name.toLowerCase(); let family;
    if (k.category === 'biscuit') family = n.includes('hershey') ? 'hershey' : n.includes('peanut butter') ? 'peanut' : /soft|brookie/.test(n) ? 'soft' : n.includes('choco cookies') ? 'choco' : 'butter';
    else if (k.category === 'other') family = n.includes('tuna') ? 'tuna' : n.includes('chickpea') ? 'chickpeas' : n.includes('corn') ? 'corn' : n.includes('nuts') ? 'nuts' : 'beans';
    else family = ({GRP_SWISS:'swiss',GRP_CUPBOX:'cupcake',GRP_SINGLES:'cupcake',GRP_CAKEBAR:'cakebar',GRP_SLICE:'slice',GRP_POUND:'pound',GRP_RUSK:'rusks',GRP_NUTS:'nuts'})[k.group] || 'unspecified';
    const flavours = ['chocolate chips','cocoa vanilla','vanilla strawberry','chocolate vanilla','himalayan salt','sour cream','sweet chili','vegetable oil','sunflower oil','vanilla','chocolate','strawberry','marble','fruit','original','peanut','raspberry','diet','brown','red','cheese'];
    const flavour = (flavours.find(f => n.includes(f)) || 'unspecified').replace(/ /g,'_');
    // A carton alias does not establish the mass of the selling unit. Leave it unknown.
    const netGrams = /[×*]\s*\d+/.test(n) ? null : grams(n);
    const format = n.includes('tin') ? 'tin' : n.includes('3 pieces') ? 'three_piece' : n.includes('jar') ? 'jar' : 'pack';
    const packKey = format + (netGrams ? ':' + netGrams : ':unspecified');
    const packLabelId = 'PT_PACK_' + packKey.replace(/[^a-z0-9]/gi,'_').toUpperCase();
    if (!FD.CATALOG[packLabelId]) FD.CATALOG[packLabelId] = E(labels[format].en + (netGrams ? ' · ' + netGrams + 'g' : ''), labels[format].ar + (netGrams ? ' · ' + netGrams + ' غ' : ''));
    const m = {code,category:k.category,family,flavour,packKey,packLabelId,netGrams,weightSource:netGrams ? 'catalogue-name' : null}; cache.set(code,m); return m;
  };
  FD.productTree = codes => {
    const build = (xs,depth,path) => {
      const groups = new Map();
      for (const code of [...new Set(xs)]) { const m = FD.productMeta(code); if (!m) continue; const id = [m.category,m.family,m.flavour,m.packKey][depth]; if (!groups.has(id)) groups.set(id,[]); groups.get(id).push(code); }
      return [...groups].map(([id,cs]) => ({id,path:path.concat(id),labelId:depth===3 ? FD.productMeta(cs[0]).packLabelId : 'PT_'+id.toUpperCase(),count:cs.length,codes:cs,children:depth<3?build(cs,depth+1,path.concat(id)):[]}));
    }; return build(codes,0,[]);
  };
  FD.productFilter = (codes,{path=[],query=''}={}) => { const q=query.trim().toLocaleLowerCase(); return [...new Set(codes)].filter(code => { const m=FD.productMeta(code), k=FD.sku(code); return m && path.every((v,i)=>{const x=[m.category,m.family,m.flavour,m.packKey][i];return !v||(Array.isArray(v)?!v.length||v.includes(x):x===v);}) && (!q || (k.name+' '+k.name_ar+' '+code).toLocaleLowerCase().includes(q)); }); };
  FD.setProductPath = (path,index,value) => {
    const next=Array.from({length:index+1},(_,i)=>i===index?value:(path[i]||''));
    while(next.length&&!next[next.length-1])next.pop();
    return next;
  };
  FD.productFacets = (codes,{path=[],query=''}={}) => ['category','family','flavour','packKey'].map((field,index)=>{
    const options=new Map(),prefix=path.slice(0,index);
    const option=code=>{const m=FD.productMeta(code),id=m[field];return {id,labelId:index===3?m.packLabelId:'PT_'+id.toUpperCase(),count:0};};
    for(const code of FD.productFilter(codes,{path:prefix,query})){
      const value=option(code);if(!options.has(value.id))options.set(value.id,value);options.get(value.id).count++;
    }
    for(const want of [].concat(path[index]||[]))if(!options.has(want)){
      const sample=codes.find(code=>FD.productMeta(code)?.[field]===want);
      if(sample)options.set(want,option(sample));
    }
    return [...options.values()].sort((a,b)=>FD.t(a.labelId).localeCompare(FD.t(b.labelId),FD.lang));
  });
  FD.productPrice = code => { const k=FD.sku(code), m=FD.productMeta(code); if (!k||!m) return null; const c=FD.withVat?FD.withVat(k.cost):k.cost; return {...m,packCost:c,basis:'acquisition',per100g:m.netGrams>0&&c>0?c/m.netGrams*100:null,comparable:!!m.netGrams}; };
  FD.packValueComparison = (from,to) => {
    const a=typeof from==='string'?FD.productPrice(from):from, b=typeof to==='string'?FD.productPrice(to):to;
    if (!a||!b||a.basis!==b.basis||a.category!==b.category||a.family!==b.family||a.flavour!==b.flavour||!(a.netGrams>0)||!(b.netGrams>a.netGrams)||!(a.packCost>0)||!(b.packCost>0)) return null;
    const ap=a.packCost/a.netGrams*100,bp=b.packCost/b.netGrams*100; if (bp>=ap) return null;
    return {fromPer100g:ap,toPer100g:bp,savingPct:+((1-bp/ap)*100).toFixed(1)};
  };
  FD.productColumns = keys => ['name',...new Set((Array.isArray(keys)?keys:['carrying','sales','conv','ret']).filter(k=>['carrying','sales','att','conv','sus','ret','promo','packCost','per100g'].includes(k)))];
})();
