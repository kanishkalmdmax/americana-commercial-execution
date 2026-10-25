// Source-level component composition. This is not a browser or a layout pass.
const test=require('node:test'),assert=require('node:assert/strict'),load=require('./load'),path=require('node:path');
const node=(tag,attrs,...children)=>({tag,attrs:attrs||{},children:children.flat(Infinity).filter(x=>x!=null&&x!==false),querySelector(){return node('img');},appendChild(child){this.children.push(child);},addEventListener(){},style:{setProperty(){}},setAttribute(){},replaceChildren(...items){assert.ok(items.every(x=>x!=null&&!Array.isArray(x)),'native replaceChildren requires individual nodes');this.children=items;}});
function ui(){
 const FD=load();FD.init(7,{storage:null});global.document={};global.requestAnimationFrame=()=>{};
 let seq=0;FD.key=()=>String(++seq);FD.ui={local:{}};FD.h=node;FD.icon=k=>node('icon',{k});FD.registerView=(role,name,fn)=>{FD.views[role][name]=fn;};FD.views={sup:{},vsr:{}};
 FD.btn=(text,fn,cls)=>node('button',{on:{click:fn},class:cls},text);FD.iconBtn=(icon,text,fn)=>FD.btn(text,fn);FD.select=(options,value,change)=>node('select',{options,value,change});FD.seg=(options,value,change)=>node('group',{options,value,change});
 FD.skuLabel=code=>node('span',null,FD.nameOf(FD.sku(code)));FD.skuTile=()=>null;FD.skuIcon=()=>null;FD.chip=x=>node('span',null,x);FD.typeChip=x=>node('span',null,FD.t('TYPE_'+x));FD.productPickBar=()=>node('div');FD.searchBox=()=>node('input');FD.empty=()=>null;FD.table=cfg=>node('table',{cfg},cfg.rows.map(r=>cfg.columns.map(c=>c.render?.(r))));FD.photoButton=p=>node('button',{'aria-label':p.label},node('img',{src:p.src}));FD.sizeIcon=()=>null;FD.creditChip=()=>null;FD.avatar=()=>null;FD.ring=()=>null;FD.delta=()=>null;FD.line=()=>null;FD.spark=()=>null;FD.bars=()=>null;FD.drawer={refresh(){},open(cfg){return cfg.render();}};FD.sheet={open(cfg){FD._sheet=cfg;return cfg.render();},redraw(){},close(){}};FD.dx=FD.dispatch;
 for(const f of ['08_vsr.js','08b_planogram.js','09_sup.js','09b_today.js','09d_levers.js','09e_planogram.js','09f_products.js']){const p=path.join(__dirname,'../src',f);delete require.cache[require.resolve(p)];require(p);}
 return FD;
}
const cleanup=()=>{delete global.document;delete global.requestAnimationFrame;};
const walk=n=>!n||typeof n!=='object'?[]:[n,...(n.children||[]).flatMap(walk)];
const content=n=>!n?'':typeof n!=='object'?String(n):(n.children||[]).map(content).join(' ');
test('phone Team compares one selectable metric with rank, salesman and score',()=>{try{
 const FD=ui();FD.render=()=>{};const range=FD.sup.range(),rows=FD.teamCompare(FD.state,range.from,range.to);
 for(const id of ['teamFull','homeRank']){
  const view=FD.sup.teamTable(id,rows,id==='teamFull'),nodes=walk(view),compact=nodes.find(n=>n.tag==='table'&&n.attrs.cfg.id===id+'Compact');
  assert.deepEqual(compact.attrs.cfg.columns.map(c=>c.key),['rank','vsr','score','primary']);
  nodes.find(n=>n.tag==='select').attrs.change('returns');
  const next=walk(FD.sup.teamTable(id,rows,id==='teamFull')).find(n=>n.tag==='table'&&n.attrs.cfg.id===id+'Compact');
  assert.equal(next.attrs.cfg.columns.at(-1).key,'returns');FD.ui.local['team:metric']='upsell';
 }
}finally{cleanup();}});
test('supervisor store header shows store type openly, no IDs, occasional actions in More',()=>{try{
 const FD=ui(),store=FD.state.world.stores[0];FD.menu=(anchor,items)=>{FD._menu=items;};
 for(const lang of ['en','ar']){FD.lang=lang;const view=FD.sup.storeContent(store.id,null,true),nodes=walk(view);
  assert.ok(!nodes.some(n=>n.tag==='details'),'store facts are visible, not folded');assert.ok(content(nodes.find(n=>/store-tags/.test(n.attrs.class||''))).includes(FD.t('SIZE_'+store.size)));assert.ok(!content(view).includes(store.id),'no store ID');
  const summary=nodes.find(n=>n.attrs.class==='store-summary');assert.ok(summary);assert.ok(!walk(summary).some(n=>n.tag==='dl'));
  const more=walk(summary).find(n=>(n.attrs.class||'').includes('store-more'));more.attrs.on.click({currentTarget:more});assert.equal(FD._menu.length,3);
  const tabs=nodes.find(n=>n.attrs.class==='tabs store-sections');assert.deepEqual(tabs.children.map(content),['L_OVERVIEW','L_NAV_SKUS','L_TIMELINE','L_WHATSAPP'].map(k=>FD.t(k)));
 }
}finally{cleanup();}});
test('photo capture is one hint and the add button; several photos, no tips block',()=>{try{
 const FD=ui();FD.pgCaptureSheet({store:FD.state.world.stores[0].id,phase:'BEFORE'});
 const nodes=walk(FD._sheet.render());
 assert.ok(!nodes.some(n=>n.tag==='details'&&n.attrs.class==='capture-options'));assert.ok(nodes.find(n=>n.tag==='input'&&n.attrs.type==='file').attrs.multiple);
 assert.ok(nodes.some(n=>n.tag==='input'&&n.attrs.type==='file'));
}finally{cleanup();}});
test('extreme relative changes show their precise small baseline without adding normal comparison text',()=>{try{
 const FD=ui(),extreme=FD.sup.leverDelta('upsell',71,0.58),normal=FD.sup.leverDelta('upsell',100,90);
 assert.ok(content(extreme).includes(FD.fmt.money(0.58)));assert.ok(walk(extreme).some(n=>n.attrs.class==='delta-baseline'));
 assert.ok(!walk(normal).some(n=>n.attrs.class==='delta-baseline'));
}finally{cleanup();}});
test('salesman and supervisor comparisons use percent changes, with previous-value context',()=>{try{
 const FD=ui();
 for(const lang of ['en','ar']){FD.lang=lang;
  const sale=FD.sup.leverDelta('withSale',59,51.1),returns=FD.sup.leverDelta('returns',7,9.9);
  assert.ok(content(sale).includes(FD.fmt.pct(15.45988258)));assert.match(sale.attrs.class,/up/);
  assert.ok(content(returns).includes(FD.fmt.pct(29.29292929)));assert.match(returns.attrs.class,/up/);
  assert.ok(sale.attrs.title.includes(FD.metricText('withSale',51.1)));
  assert.ok(content(FD.sup.leverDelta('visits',5,5)).includes(FD.fmt.pct(0)));
  assert.ok(!/Infinity|NaN/.test(content(FD.sup.leverDelta('withSale',5,0))));
 }
}finally{cleanup();}});
test('Team ranks by net sales per selling day against each salesman own baseline',()=>{try{
 const FD=ui(),row={prePilot:true,m:{lev:{primary:638},genuine:true,hasBaseline:true,vsBaseline:12.4},prev:{lev:{primary:0}}};
 const col=FD.sup.teamColumns(true,false,true).find(c=>c.key==='primary');
 assert.ok(content(col.render(row)).startsWith(FD.fmt.money0(638)));assert.doesNotMatch(content(col.render(row)),/NaN|Infinity/);
 const base=FD.sup.teamColumns(true,false,false).find(c=>c.key==='score');assert.equal(base.label,FD.t('L_COL_VS_BASE'));
 assert.ok(content(base.render(row)).includes(FD.fmt.pct(12.4)));
 row.m.hasBaseline=false;assert.ok(content(base.render(row)).includes(FD.t('L_NO_BASELINE')));
 const rk=FD.sup.teamColumns(true,false,false).find(c=>c.key==='rank');assert.equal(rk.render({...row,rank:3,move:1}),null,'no baseline: unranked');
 assert.match(FD.t('I_TEAM'),/own baseline/);assert.doesNotMatch(FD.t('I_TEAM'),/weight|[Uu]psell/);
 const s=FD.state,r=FD.ranking(s,'ABS',FD.PILOT_START,s.clock.date),ok=r.filter(x=>x.m.hasBaseline);
 for(let i=1;i<ok.length;i++)assert.ok(ok[i-1].m.vsBaseline>=ok[i].m.vsBaseline,'ranked by own-baseline change');
 assert.ok(r.slice(ok.length).every(x=>!x.m.hasBaseline),'salesmen without a baseline rank last');
}finally{cleanup();}});
test('Analytics, Team and salesman KPI views follow the same five pilot measures',()=>{try{
 const FD=ui(),s=FD.state,range=FD.sup.range(),ids=s.world.vsrs.filter(v=>v.kind==='sales').map(v=>v.id);
 for(const lang of ['en','ar']){FD.lang=lang;
  const strip=FD.sup.leverStrip({ids,from:range.from,to:range.to});
  const tiles=walk(strip).filter(n=>n.tag==='button'&&(n.attrs.class||'').includes('kpi'));
  assert.equal(tiles.length,5);
  assert.deepEqual(tiles.map(n=>n.attrs['aria-label']),FD.PILOT_METRICS.map(m=>FD.t(m.label)));
  assert.ok(content(tiles[0]).includes(FD.metricText('primary',FD.teamLevers(s,ids,range.from,range.to).perDay)));
  const columns=FD.sup.teamColumns(true,false,false);
  assert.deepEqual(columns.filter(c=>FD.PILOT_METRICS.some(m=>m.k===c.key)).map(c=>c.key),['primary','visits','withSale','avgSale','returns']);
  // salesman Results screen: the same five measures in the salesman's simpler wording
  const salesman=FD.views.vsr.me({id:'results'},s.world.vsrs.find(v=>v.kind==='sales'));
  const text=salesman.body.map(content).join(' ');
  for(const k of ['ME_K_SALES','ME_K_VISITS','ME_K_BOUGHT','ME_K_AVG','ME_K_RETURNS'])assert.ok(text.includes(FD.t(k)),k);
 }
}finally{cleanup();}});

test('shared shelf filters count statuses, default to carried, and keep each role selection separate',()=>{try{
 const FD=ui(),shelf={gates:{}};FD.SKUS.forEach((k,i)=>shelf[k.code]=i===0?'CARRIED':i===1?'PENDING':'NONE');
 const tiles=tree=>walk(tree).filter(n=>(n.attrs.class||'').split(' ').includes('tile'));
 const filter=(tree,key)=>walk(tree).find(n=>n.attrs['data-status']===key);
 for(const lang of ['en','ar']){FD.lang=lang;
  const sales=FD.shelfView(shelf,{filterKey:'vsr:'+lang}),sup=FD.shelfView(shelf,{filterKey:'sup:'+lang});
  assert.equal(tiles(sales).length,1);assert.equal(tiles(sup).length,1);
  assert.equal(filter(sales,'CARRIED').attrs['aria-pressed'],'true');
  assert.ok(content(filter(sales,'NONE')).includes(FD.fmt.num(FD.SKUS.length-2)));
  filter(sales,'PENDING').attrs.on.click();assert.equal(tiles(sales).length,2);assert.equal(tiles(sup).length,1);
  filter(sales,'ALL').attrs.on.click();assert.equal(tiles(sales).length,FD.SKUS.length);
  filter(sales,'PENDING').attrs.on.click();assert.equal(tiles(sales).length,1);
  filter(sales,'PENDING').attrs.on.click();assert.equal(tiles(sales).length,FD.SKUS.length);
 }
}finally{cleanup();}});
test('the store app bar has one camera that offers Before, After and Competitor, ticks a taken phase and shows no IDs',()=>{try{
 const FD=ui(),s=FD.state,vsr=s.world.vsrs.find(v=>v.kind==='sales');s.vsrId=vsr.id;
 const visit=FD.planFor(s,vsr.id,s.clock.date).stops[0];assert.ok(visit);const store=s.world.stores.find(x=>x.id===visit.store);
 FD.vsr.recCard=()=>node('article',{class:'offer-item'});const captured=[];FD.pgCaptureSheet=opts=>captured.push(opts);const comp=[];FD.compCaptureSheet=opts=>comp.push(opts);let items;FD.menu=(a,list)=>{items=list;};
 for(const lang of ['en','ar']){
  FD.lang=lang;const view=FD.views.vsr.store({id:visit.store},vsr),nodes=view.body.flatMap(walk);
  const tabs=nodes.find(n=>n.attrs.class==='tabs store-tabs');assert.ok(tabs);assert.equal(tabs.children.length,2);
  assert.equal(nodes.filter(n=>(n.attrs.class||'').includes('offer-camera-action')).length,0);
  assert.ok(!view.body.map(content).join(' ').includes(store.id),'store id hidden from the salesman');
  view.tools.attrs.on.click({currentTarget:view.tools});assert.equal(items.length,3);items.forEach(i=>i.onClick());
  assert.equal(comp.at(-1).store,visit.store,'third option takes a competitor photo');
  assert.deepEqual(captured.slice(-2).map(x=>x.phase),['BEFORE','AFTER']);assert.ok(captured.slice(-2).every(x=>x.store===visit.store&&x.visitId===visit.id));
 }
 FD.dispatch('PG_START',{id:'c',store:visit.store,visitId:visit.id});FD.dispatch('PG_PHOTOS_ADD',{id:'c',photos:[{id:'p',src:'x',phase:'BEFORE'}]});
 const btn=FD.views.vsr.store({id:visit.store},vsr).tools;assert.match(btn.attrs.class,/has/);btn.attrs.on.click({currentTarget:btn});
 assert.equal(items[0].icon,'check-circle');assert.equal(items[1].icon,'camera');
}finally{cleanup();}});
test('Today shows operational work while Analytics owns the performance strip',()=>{const timer=global.setTimeout;try{
 const FD=ui();global.setTimeout=()=>0;global.innerWidth=1440;let strips=0;FD.sup.leverStrip=()=>{strips++;return node('div',{class:'analytics-kpis'});};
 const today=FD.views.sup.today();assert.ok(today.body.length);assert.equal(strips,0);
 const analytics=FD.views.sup.weekly();assert.equal(strips,1);assert.ok(analytics.body.length);
 assert.equal(analytics.body.flatMap(walk).filter(n=>(n.attrs.class||'').split(' ').includes('fu-row')).length,0);
}finally{global.setTimeout=timer;delete global.innerWidth;cleanup();}});
test('product filters: one picker button above one full-width list; picks narrow the list',()=>{try{
 const FD=ui();FD.render=()=>{};
 for(const lang of ['en','ar']){
  FD.lang=lang;const page=FD.sup.productPage(),bar=page.bar(),body=page.body;
  assert.equal(walk(bar).filter(n=>n.tag==='select').length,0);
  assert.equal(body.flatMap(walk).filter(n=>n.tag==='aside'||n.tag==='nav').length,0);
  FD.ui.local['products:browse'].path=[['biscuit']];
  const rows=FD.sup.productPage().body.flatMap(walk).find(n=>n.tag==='table').attrs.cfg.rows;
  assert.ok(rows.length&&rows.every(x=>FD.sku(x.code).category==='biscuit'));FD.ui.local['products:browse']={path:[],query:''};
 }
}finally{cleanup();}});
test('capture identifies failed files and attributes off-plan captures to the active salesman',async()=>{try{
 const FD=ui(),s=FD.state,so=s.world.stores[0],active=s.world.vsrs.find(v=>v.kind==='sales'&&v.id!==so.vsr);s.vsrId=active.id;
 FD.readPhoto=async file=>{if(file.name==='bad.jpg')throw Error('bad');return 'data:image/jpeg;base64,x';};
 FD.pgCaptureSheet({store:so.id});const tree=FD._sheet.render(),input=walk(tree).find(n=>n.tag==='input'&&n.attrs.type==='file');
 await input.attrs.on.change({target:{files:[{name:'good.jpg',type:'image/jpeg'},{name:'bad.jpg',type:'image/jpeg'}]}});
 assert.match(content(FD._sheet.render()),/bad\.jpg/);assert.equal(FD.pgAssessments(s,so.id)[0].vsr,active.id);
}finally{cleanup();}});
const shelf=(FD,checks)=>({scope:'AMBIENT_SHELF',photo:{status:'PARTLY',reasons:['GLARE'],display:'RACK'},checks:Object.fromEntries(FD.SC_CHECKS.map(c=>[c,checks[c]||{result:'PASS'}])),
 findings:Object.keys(checks).map(check=>({check,box_2d:[100,100,500,500]})),americana_seen:['SWISS_ROLL'],competition:[{signal:'COMP_TRAY',brand:'SEVEN_DAYS',box_2d:[1,1,200,200]}],confidence:'HIGH'});
const withShelf=FD=>{FD.SHELF_RESULTS={model:'test',photos:{0:{file:'b.jpeg',result:shelf(FD,{FULL_EMPTY_SPACE:{result:'FAIL'},FIND_WRONG_AREA:{result:'FAIL'},COND_DAMAGED_PACK:{result:'FAIL'}})},1:{file:'a.jpeg',result:shelf(FD,{FIND_WRONG_AREA:{result:'FAIL'},FIND_FACING:{result:'FAIL'}})}},groups:[[0,1]]};FD.init(7,{storage:null});return FD;};
const check=(FD,id,store)=>{FD.dispatch('PG_START',{id,store});FD.dispatch('PG_PHOTOS_ADD',{id,photos:[{id:id+'-b',src:'x',phase:'BEFORE',ref:0},{id:id+'-a',src:'x',phase:'AFTER',ref:1}]});};
test('coaching uses the fixed actions of the check being reviewed',()=>{try{
 const FD=withShelf(ui()),s=FD.state,store=s.world.stores[0].id;
 s.clock.time='10:00';FD.dispatch('PG_START',{id:'old',store});FD.dispatch('PG_PHOTOS_ADD',{id:'old',photos:[{id:'o',src:'x',phase:'BEFORE',ref:0}]});
 s.clock.time='14:00';FD.dispatch('PG_START',{id:'new',store});FD.dispatch('PG_PHOTOS_ADD',{id:'new',photos:[{id:'n',src:'x',phase:'BEFORE',ref:1}]});
 let preset;FD.sup.tipComposer=(...args)=>{preset=args[5];};FD.sup.pgCoach(store,false,'old');
 assert.ok(preset.text.includes(FD.t('SC_DO_FIND_WRONG_AREA')),'still open on the next visit');assert.ok(!preset.text.includes(FD.t('SC_DO_FULL_EMPTY_SPACE')),'fixed by the next visit');
}finally{cleanup();}});
test('Shelf Check screens compose in both languages and never show internal check IDs',()=>{try{
 const FD=withShelf(ui()),s=FD.state,store=s.world.stores[0],range=FD.sup.range();check(FD,'sc',store.id);FD.stepper=v=>node('output',null,String(v));
 const leak=/\b(FULL|FIND|COND|COMP|SC|PG|BR)_[A-Z_]+\b|\b[PFLATCGSEKQ]\d{2}\b|AMBIENT_SHELF|NOT_SHELF|box_2d/;
 for(const lang of ['en','ar']){FD.lang=lang;
  const screens=[FD.scPanel('sc',{role:'VSR',editable:true}),FD.scPanel('sc',{role:'SUP'}),FD.sup.pgContent(store.id),FD.sup.scCard(store.id),FD.sup.storeContent(store.id,null,true),FD.scHistory(store.id),
   FD.sup.scTeamCard([store.vsr],range.from,FD.state.clock.date),FD.sup.scWeightsBody()];
  FD.pgCaptureSheet({store:store.id,assessmentId:'sc'});screens.push(FD._sheet.render());
  for(const v of screens){assert.ok(v);const text=content(v);assert.doesNotMatch(text,leak,text.match(leak)?.[0]);if(lang==='ar')assert.match(text,/[؀-ۿ]/);}
 }
 const compact=walk(FD.sup.scTeamCard([store.vsr],range.from,FD.state.clock.date)).find(n=>n.tag==='table'&&n.attrs.cfg.id==='scTeamCompact');
 assert.deepEqual(compact.attrs.cfg.columns.map(c=>c.key),['v','s','f','o']);assert.ok(!compact.attrs.cfg.columns.some(c=>/rank/i.test(c.key)));
 FD.lang='en';const panel=content(FD.scPanel('sc',{role:'VSR',editable:true}));
 for(const id of ['SC_CHK_COND_DAMAGED_PACK','SC_DO_FIND_WRONG_AREA','SC_ST_FIXED','SC_ST_STILL','SC_ST_NEW','SC_WHY_GLARE','SC_COMP_TRAY','BR_SEVEN_DAYS','SC_FAM_SWISS_ROLL'])assert.ok(panel.includes(FD.t(id)),id);
}finally{cleanup();}});
test('salesman outcome buttons follow the action type and the Offer card points to the next fix',()=>{try{
 const FD=withShelf(ui()),s=FD.state,store=s.world.stores[0];check(FD,'sc',store.id);
 const buttons=walk(FD.scPanel('sc',{role:'VSR',editable:true,redraw(){}})).filter(n=>n.attrs.class&&String(n.attrs.class).startsWith('sc-out'));
 const labels=buttons.map(b=>content(b));assert.ok(labels.includes(FD.t('SC_OUT_OWNER_NO')));let menu;FD.menu=(x,items)=>{menu=items;};
 buttons.find(b=>content(b).includes(FD.t('SC_OUT_CANT'))).attrs.on.click({currentTarget:{}});assert.deepEqual(menu.map(i=>i.label),['SC_OUT_NOT_IN_VAN','SC_OUT_OWNER_NO','SC_OUT_NEED_HELP'].map(k=>FD.t(k)));
 menu[0].onClick();assert.equal(FD.pgAssessment(s,'sc').actions.COND_DAMAGED_PACK,'NOT_IN_VAN');
 buttons.find(b=>content(b)===FD.t('SC_OUT_OWNER_YES')).attrs.on.click();assert.equal(FD.pgAssessment(s,'sc').actions.FIND_WRONG_AREA,'OWNER_YES');
 assert.equal(walk(FD.scPanel('sc',{role:'SUP'})).filter(n=>String(n.attrs.class||'').startsWith('sc-out')).length,0,'supervisor view is read-only');
 const card=FD.scVisitCard({store:store.id});assert.ok(content(card).includes(FD.t('SC_TITLE')));
}finally{cleanup();}});
test('photo reader retains every successful file and reports partial failure',async()=>{try{
 const FD=ui();FD.readPhoto=async f=>{if(f.name==='bad')throw Error('bad');return 'image:'+f.name;};
 const result=await FD.pgReadPhotos(Array.from({length:12},(_,i)=>({type:'image/jpeg',name:i===4?'bad':String(i)})));
 assert.equal(result.savedInputs.length,11);assert.equal(result.failed.length,1);
}finally{cleanup();}});
test('store timeline hangs a visit day under its visit, with Shelf Check as a result',()=>{try{
 const FD=withShelf(ui()),s=FD.state,v=s.visits.find(x=>x.status==='DONE'&&x.date===FD.addDays(s.clock.date,-1));
 const d=s.clock.date;s.clock.date=v.date;FD.dispatch('PG_START',{id:'tl',store:v.store});FD.dispatch('PG_PHOTOS_ADD',{id:'tl',photos:[{id:'tlb',src:'x',phase:'BEFORE',ref:0}]});s.clock.date=d;
 const tree=walk(FD.sup.timeline(v.store)),kids=tree.filter(n=>n.attrs.class==='tl-kids');
 assert.ok(kids.some(k=>content(k).includes(FD.t('SC_TITLE'))),'Shelf Check sits inside its visit');
 assert.ok(!tree.some(n=>/^tl-item($| )/.test(n.attrs.class||'')&&!n.attrs.class.includes('nested')&&content(n).startsWith(FD.t('L_PHOTOS'))),'no loose photo entry for an analysed check');
}finally{cleanup();}});
test('salesman follow-ups live in that salesman block; the shared queue keeps the rest, critical first',()=>{try{
 const FD=ui(),s=FD.state,fu=FD.followUps(s),shared=fu.filter(f=>!(f.slots&&f.slots.vsrId));
 const rows=walk(FD.sup.followupsDrawer()).filter(n=>n.attrs.class==='fu-row');assert.equal(rows.length,shared.length);
 const pri=rows.map(r=>shared.find(f=>content(r).includes(FD.tx(f.tpl,f.slots))).pri);assert.deepEqual(pri,pri.slice().sort((a,b)=>a-b));
}finally{cleanup();}});
test('compare view: labelled Before and After, a placeholder when none, the next visit photo when it exists',()=>{try{
 const FD=withShelf(ui()),s=FD.state,store=s.world.stores[0].id;
 FD.dispatch('PG_START',{id:'c1',store});FD.dispatch('PG_PHOTOS_ADD',{id:'c1',photos:[{id:'c1b',src:'b1',phase:'BEFORE',ref:0}]});
 let tree=walk(FD.scPanel('c1',{role:'SUP'}));assert.ok(tree.some(n=>/sc-col-empty/.test(n.attrs.class||'')));assert.ok(content({children:tree}).includes(FD.t('SC_NO_AFTER')));
 s.clock.time='23:00';FD.dispatch('PG_START',{id:'c2',store});FD.dispatch('PG_PHOTOS_ADD',{id:'c2',photos:[{id:'c2b',src:'b2',phase:'BEFORE',ref:1}]});
 tree=walk(FD.scPanel('c1',{role:'SUP'}));const cols=tree.filter(n=>/^sc-col( |$)/.test(n.attrs.class||''));
 assert.equal(cols.length,2);assert.ok(content(cols[1]).includes(FD.t('SC_NEXT_LABEL')));assert.ok(walk(cols[1]).some(n=>n.tag==='img'&&n.attrs.src==='b2'),'next visit photo on the After side');
 assert.ok(content(cols[0]).includes(FD.t('PG_BEFORE')));assert.ok(tree.some(n=>/sc-next/.test(n.attrs.class||'')),'each issue says its next step');
}finally{cleanup();}});
test('salesman store page: compact product cards, Profile sections closed, owner pre-order only on Offer',()=>{try{
 const FD=ui();FD.render=()=>{};const s=FD.state,vsr=s.world.vsrs.find(v=>v.kind==='sales');s.vsrId=vsr.id;
 const rec=s.recs.find(r=>FD.recVsr(r)===vsr.id&&r.date===s.clock.date)||s.recs.find(r=>FD.recVsr(r)===vsr.id);
 let card=FD.vsr.recCard(rec);assert.ok(!walk(card).some(n=>n.attrs.class==='why'),'reason hidden until More');assert.ok(!walk(card).some(n=>n.attrs.class==='pitch'),'no store shelf price');
 walk(card).find(n=>n.attrs.class==='rec-more').attrs.on.click();card=FD.vsr.recCard(rec);assert.ok(walk(card).some(n=>n.attrs.class==='why'));
 const store=rec.store;FD.dispatch('PREORDER_ADD',{store,text:'Need 2 cartons'});
 FD.ui.local['vsr:storeTabFor']=store;FD.ui.local['vsr:storeTab']='profile';
 const prof=FD.views.vsr.store({id:store},vsr).body.flatMap(walk);
 assert.ok(!prof.some(n=>/banner info/.test(n.attrs.class||'')&&content(n).includes(FD.t('L_PREORDER_FROM_OWNER'))),'pre-order not repeated on Profile');
 assert.ok(prof.some(n=>n.attrs.class==='prof-h'));assert.ok(!prof.some(n=>n.attrs.class==='prof-b'),'all sections start closed');
}finally{cleanup();}});
test('send all tips, alert type filter, metric playbooks, grouped plan notifications and folding To-do',()=>{try{
 const FD=ui();FD.render=()=>{};FD.toast=()=>{};FD.go=()=>{};FD.notifText=n=>({title:n.tpl,body:''});const s=FD.state;
 const d=FD.coachDrafts(s)[0];if(d){const row=walk(FD.sup.draftGroups([d])).find(n=>/draft-group/.test(n.attrs.class||''));const btn=walk(row).find(n=>n!==row&&n.tag==='button');btn.attrs.on.click({stopPropagation(){}});assert.ok(s.tipDone[d.key],'sent without opening');}
 const pb=walk(FD.sup.playbook('visits'));assert.ok(content({children:pb}).includes(FD.t('PB_V1')));assert.equal(pb.filter(n=>/pb-n/.test(n.attrs.class||'')).length,5);
 const vsr=s.world.vsrs.find(v=>v.kind==='sales');s.vsrId=vsr.id;const store=s.world.stores.find(x=>x.vsr===vsr.id).id;
 const tm=FD.nextSellingDay(s.clock.date);for(const sid of s.world.stores.filter(x=>x.vsr===vsr.id).slice(1,4).map(x=>x.id))FD.dispatch('OFFPLAN_ADD',{vsr:vsr.id,store:sid,bySup:true,date:tm});
 FD.vsr.inbox(vsr.id);const inbox=content(FD._sheet.render());assert.ok(inbox.includes(FD.tx('N_PLAN_SUP_G',{supId:'S1',n:3})),'one grouped plan notification');
 const todo=FD.views.vsr.todo({},vsr).body.flatMap(walk);assert.ok(todo.some(n=>n.attrs.class==='todo-h'),'sections fold');
}finally{cleanup();}});
test('a written tip shows a title, and Team offers tips as one bar that opens the per-salesman list',()=>{try{
 const FD=ui();FD.render=()=>{};const s=FD.state,v=s.world.vsrs.find(x=>x.kind==='sales');
 FD.dispatch('TIP_SEND',{vsr:v.id,tpl:'K_CUSTOM',slots:{},text:'Fill the empty space.'});
 FD.ui.local['vsr:tab']='tips';const tree=FD.sup.vsrContent(v.id,false);assert.ok(content(tree).includes(FD.t('K_CUSTOM_T')),'written tip has a title');
 const team=FD.views.sup.team({page:'team'});const bar=team.body.find(x=>x&&/fu-bar/.test(x.attrs.class||''));
 if(FD.coachDrafts(s).length){assert.ok(bar,'tips bar on top');assert.ok(!team.body.filter(Boolean).flatMap(walk).some(n=>/draft-group/.test(n.attrs.class||'')),'no long list on the page');}
}finally{cleanup();}});
test('metric Open now groups work by category, opens to salesmen, with one bulk action per category',()=>{try{
 const FD=ui();FD.render=()=>{};FD.toast=()=>{};const s=FD.state,range=FD.sup.range(),ids=s.world.vsrs.filter(v=>v.kind==='sales').map(v=>v.id);
 const cats=FD.sup.leverActions('visits',{ids,from:range.from,to:range.to});assert.ok(cats.length,'visits has open work');
 assert.ok(cats.every(c=>FD.CATALOG['CAT_'+c.key]),'every category has a name');assert.ok(cats.every(c=>c.n===c.items.reduce((t,i)=>t+i.n,0)));
 const view=walk(FD.sup.openNow(cats));assert.equal(view.filter(n=>n.attrs.class==='on-cat').length,cats.length);
 const missed=cats.find(c=>c.key==='A_MISSED');if(missed){const btn=view.find(n=>n.tag==='button'&&content(n)===FD.t('L_CARRY_ALL'));btn.attrs.on.click();const it=missed.items[0],a=it.alert.items[0];
  assert.ok(FD.state.visits.some(v=>v.store===a.store&&v.supAdded&&v.date>it.alert.day),'missed stop is on a later plan');
  assert.ok(!FD.sup.leverActions('visits',{ids,from:range.from,to:range.to}).some(c=>c.key==='A_MISSED'),'category cleared');
  assert.equal(FD.missOutcome(FD.state,it.vsr,a.store,it.alert.day).id,'L_OUT_REPLANNED','the day view can say what was done');}

}finally{cleanup();}});
