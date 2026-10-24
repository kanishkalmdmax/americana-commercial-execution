(function(){
 const FD=globalThis.FD;if(typeof document==='undefined')return;
 const S=FD.sup,h=FD.h,t=(...a)=>FD.t(...a),L=FD.ui.local;
 S.productPriceDetails=code=>{const p=FD.productPrice(code);return h('section',null,h('div',{class:'row wrap'},h('div',null,h('div',{class:'row',style:{gap:'4px'}},t('PG_PACK_COST'),S.info(t('PG_PRICE_BASIS'))),h('b',{style:{display:'block'}},FD.fmt.money(p.packCost))),h('div',null,t('PG_100G'),h('b',{style:{display:'block'}},p.per100g==null?'\u2014':FD.fmt.money(p.per100g)))));};
 S.productPage=()=>{
  const state=FD.state,{from,to}=S.range(),f=L['products:browse']||(L['products:browse']={path:[],query:''});
  const all=FD.SKUS.map(k=>k.code),matched=new Set(FD.productFilter(all,f));
  const cols=[
   {key:'name',label:t('L_COL_PRODUCT'),sort:(a,b)=>FD.nameOf(FD.sku(a.code)).localeCompare(FD.nameOf(FD.sku(b.code))),render:x=>FD.skuLabel(x.code)},
   ...[['carrying','L_COL_CARRYING','carrying',FD.fmt.num],['sales','L_COL_SALES','sales',FD.fmt.money0],['att','L_COL_ATTEMPTS','attempts',FD.fmt.num],['conv','L_COL_CONV','conv',FD.fmt.pct],['sus','L_COL_SUSTAINED','sustainedPct',FD.fmt.pct],['ret','L_COL_RETURNS','returnRate',FD.fmt.pct],['promo','L_PROMO_UPTAKE','promoUptake',FD.fmt.pct]].map(([key,label,field,fmt])=>({key,label:t(label),num:true,sort:(a,b)=>(a[field]??-1)-(b[field]??-1),render:x=>x[field]==null?'—':fmt(x[field])})),
   ...[['packCost','PG_PACK_COST'],['per100g','PG_100G']].map(([key,label])=>({key,label:t(label),num:true,sort:(a,b)=>(FD.productPrice(a.code)[key]??Infinity)-(FD.productPrice(b.code)[key]??Infinity),render:x=>{const p=FD.productPrice(x.code);return p[key]==null?'—':FD.fmt.money(p[key]);}}))];
  const selected=FD.productColumns(state.planogram?.columnPrefs.products),rows=FD.skuPerf(state,from,to).filter(x=>matched.has(x.code));
  const columnsSheet=()=>FD.sheet.open({center:true,title:t('PG_COLUMNS'),render:()=>h('div',{class:'stack s8'},cols.map(c=>h('label',{class:'check'},h('input',{type:'checkbox','data-focus':'product-column-'+c.key,checked:FD.productColumns(FD.state.planogram?.columnPrefs.products).includes(c.key),disabled:c.key==='name',on:{change:e=>{const current=FD.productColumns(FD.state.planogram?.columnPrefs.products);FD.dx('PRODUCT_COLUMNS_SET',{keys:e.target.checked?current.concat(c.key):current.filter(k=>k!==c.key)});FD.sheet.redraw();}}}),c.label))),footer:()=>[FD.btn(t('L_DONE'),()=>FD.sheet.close(),'primary block')]});
  const facetLabels=['PF_CATEGORIES','PF_FAMILIES','PF_FLAVOURS','PF_PACKS'];
  const filters=()=>h('div',{class:'filters product-filters'},
    FD.searchBox('products',t('PG_SEARCH_PRODUCTS'),f.query,v=>{f.query=v;FD.render();}),
    FD.productFacets(all,f).map((options,index)=>FD.select(
      [{id:'',label:t(facetLabels[index])}].concat(options.map(o=>({id:o.id,label:t(o.labelId)+' ('+FD.fmt.num(o.count)+')'}))),
      f.path[index]||'',value=>{f.path=FD.setProductPath(f.path,index,value);FD.render();FD.sheet.redraw();},
      {'aria-label':t(facetLabels[index]),'data-focus':'product-filter-'+index})),
    FD.btn(t('PG_COLUMNS'),columnsSheet,'secondary sm'),
    f.path.some(Boolean)||f.query?FD.btn(t('PG_RESET'),()=>{f.path=[];f.query='';FD.render();FD.sheet.redraw();},'ghost sm'):null);
  return {title:t('L_NAV_SKUS'),bar:filters,body:[h('section',{class:'product-results'},
    h('div',{class:'product-result-count small muted','aria-live':'polite'},t('PG_PRODUCT_COUNT',{n:FD.fmt.num(rows.length)})),
    h('div',{class:'card'},FD.table({id:'products',rows,onRow:x=>S.skuDrawer(x.code),defaultSort:['sales','desc'],columns:cols.filter(c=>selected.includes(c.key))})))]};
 };
})();
