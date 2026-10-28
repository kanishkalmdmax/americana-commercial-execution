// Supervisor pages after the audit: stepper redraw, supervisor filter, credit on Team, route preview, snoozed list, corrections, expected sale, store facts.
const test=require('node:test'),assert=require('node:assert/strict'),load=require('./load'),path=require('node:path');
const node=(tag,attrs,...children)=>({tag,attrs:attrs||{},children:children.flat(Infinity).filter(x=>x!=null&&x!==false),querySelector(){return node('img');},appendChild(child){this.children.push(child);},addEventListener(){},style:{setProperty(){}},setAttribute(){},replaceChildren(...items){this.children=items;}});
function ui(){
 const FD=load();FD.init(7,{storage:null});global.document={};global.requestAnimationFrame=()=>{};
 let seq=0;FD.key=()=>String(++seq);FD.ui={local:{}};FD.h=node;FD.icon=k=>node('icon',{k});FD.registerView=(role,name,fn)=>{FD.views[role][name]=fn;};FD.views={sup:{},vsr:{}};
 FD.btn=(text,fn,cls)=>node('button',{on:{click:fn},class:cls},text);FD.iconBtn=(icon,text,fn)=>FD.btn(text,fn);FD.select=(options,value,change)=>node('select',{options,value,change});FD.seg=(options,value,change)=>node('group',{options,value,change});
 FD.skuLabel=code=>node('span',null,FD.nameOf(FD.sku(code)));FD.skuTile=()=>null;FD.skuIcon=()=>null;FD.chip=x=>node('span',null,x);FD.typeChip=x=>node('span',null,FD.t('TYPE_'+x));FD.productPickBar=()=>node('div');FD.searchBox=()=>node('input');FD.empty=()=>null;FD.table=cfg=>node('table',{cfg},cfg.rows.map(r=>cfg.columns.map(c=>c.render?.(r))));FD.photoButton=p=>node('button',{'aria-label':p.label},node('img',{src:p.src}));FD.sizeIcon=()=>null;FD.creditChip=()=>null;FD.avatar=()=>null;FD.ring=()=>null;FD.delta=()=>null;FD.line=()=>null;FD.spark=()=>null;FD.bars=()=>null;FD.drawer={refresh(){},open(cfg){return cfg.render();}};FD.sheet={open(cfg){FD._sheet=cfg;return cfg.render();},redraw(){},close(){}};FD.dx=FD.dispatch;
 FD.stepper=(value,min,max,onChange)=>{FD._stp={value,min,max,onChange};return node('stepper',{value,min,max});};FD.render=()=>{};FD.toast=()=>{};
 for(const f of ['08_vsr.js','08b_planogram.js','09_sup.js','09b_today.js','09d_levers.js','09e_planogram.js','09f_products.js']){const p=path.join(__dirname,'../src',f);delete require.cache[require.resolve(p)];require(p);}
 return FD;
}
const cleanup=()=>{delete global.document;delete global.requestAnimationFrame;};
const walk=n=>!n||typeof n!=='object'?[]:[n,...(n.children||[]).flatMap(walk)];
const content=n=>!n?'':typeof n!=='object'?String(n):(n.children||[]).map(content).join(' ');
const btnWith=(root,text)=>walk(root).find(n=>n.tag==='button'&&content(n).includes(text));
const tableOf=(root,id)=>walk(root).find(n=>n.tag==='table'&&n.attrs.cfg&&n.attrs.cfg.id===id);

test('D01 stepper redraws its number on every click and keeps a value above 20',()=>{
 // the real FD.stepper on a minimal fake DOM
 class N{constructor(){this.children=[];}appendChild(c){this.children.push(c);return c;}}
 class T extends N{constructor(x){super();this.t=String(x);}get textContent(){return this.t;}set textContent(v){this.t=String(v);}}
 class E extends N{constructor(tag){super();this.tag=tag;this.listeners={};this.style={};this.dataset={};this.disabled=false;}setAttribute(){}addEventListener(e,f){this.listeners[e]=f;}get textContent(){return this.children.map(c=>c.textContent).join('');}set textContent(v){this.children=[new T(v)];}}
 global.Node=N;global.window=global;global.document=new Proxy({createElement:t=>new E(t),createElementNS:(n,t)=>new E(t),createTextNode:x=>new T(x),addEventListener(){},documentElement:new E('html'),body:new E('body')},{get:(o,k)=>k in o?o[k]:()=>null});
 global.matchMedia=()=>({matches:false,addEventListener(){}});global.getComputedStyle=()=>({});global.addEventListener=()=>{};global.localStorage={getItem(){return null;},setItem(){}};
 try{
  const FD=load();const p=path.join(__dirname,'../src/06_ui_kit.js');delete require.cache[require.resolve(p)];try{require(p);}catch(e){/* later parts of the kit need a real browser */}
  const seen=[],w=FD.stepper(72,1,9999,v=>seen.push(v),'qty'),[dec,out,inc]=w.children;
  assert.equal(out.textContent,'72');
  inc.listeners.click();assert.equal(out.textContent,'73');assert.deepEqual(seen,[73]);
  dec.listeners.click();dec.listeners.click();assert.equal(out.textContent,'71');assert.deepEqual(seen,[73,72,71],'each click steps from the shown value');
  const low=FD.stepper(2,1,5,()=>{});low.children[0].listeners.click();assert.equal(low.children[0].disabled,true,'minus disables at the minimum');
 }finally{for(const k of ['Node','window','document','matchMedia','getComputedStyle','addEventListener','localStorage'])delete global[k];}
});
test('D01 changing a recommendation keeps 72 and no longer caps at 20',()=>{try{
 const FD=ui(),s=FD.state,r=s.recs.find(x=>x.date===s.clock.date&&x.outcome===null&&!x.blockedAt);assert.ok(r);r.qtyModified=72;
 const calls=[];FD.dx=(a,p)=>{calls.push([a,p]);};
 FD.sup.recEditSheet({recId:r.id});FD._sheet.render();
 assert.equal(FD._stp.value,72);assert.equal(FD._stp.min,1);assert.ok(FD._stp.max>=72,'no 20 cap');
 FD._stp.onChange(73);btnWith({children:FD._sheet.footer()},FD.t('L_SAVE')).attrs.on.click();
 assert.equal(calls.find(c=>c[0]==='SUP_REC_EDIT')[1].qty,73);
}finally{cleanup();}});
test('D05 the supervisor filter narrows the weekly and Team views',()=>{try{
 const FD=ui(),S=FD.sup,s=FD.state,sales=s.world.vsrs.filter(v=>v.kind==='sales'),sup=s.world.sups.find(x=>sales.some(v=>v.sup===x.id)&&sales.some(v=>v.sup!==x.id));
 S.f.sup=sup.id;S.f.route='';
 const mine=sales.filter(v=>v.sup===sup.id).map(v=>v.id).sort();
 assert.deepEqual(S.fvans().sort(),mine);assert.ok(mine.length<sales.length);
 const team=FD.views.sup.team({}),t1=tableOf({children:team.body},'teamFull');
 assert.deepEqual(t1.attrs.cfg.rows.map(r=>r.vsr).sort(),mine,'Team uses the supervisor filter');
 assert.deepEqual(t1.attrs.cfg.rows.map(r=>r.rank).sort(),t1.attrs.cfg.rows.map((_,i)=>i+1),'ranks are counted inside the filter');
 const weekly=FD.views.sup.weekly({}),home=tableOf({children:weekly.body},'homeRank');
 assert.deepEqual(home.attrs.cfg.rows.map(r=>r.vsr).sort(),mine,'weekly ranking uses it too');
 const {from,to}=S.range(),full=FD.reasonBreakdown(s,{from,to}),part=FD.reasonBreakdown(s,{from,to,vans:mine});
 assert.ok(part.reduce((a,g)=>a+g.count,0)<full.reduce((a,g)=>a+g.count,0));
 assert.ok(FD.opportunities(s,{vans:mine}).length<FD.opportunities(s,{}).length,'opportunities narrow');
 S.f.sup='';assert.equal(S.fvans(),null);
}finally{cleanup();}});
test('Credit watch sits on Team under the team table, not in Rules; each van drawer has one credit line',()=>{try{
 const FD=ui(),S=FD.sup,s=FD.state;S.f.sup='';S.f.route='';
 const body=FD.views.sup.team({}).body.filter(Boolean),ti=body.findIndex(n=>tableOf(n,'teamFull')),ci=body.findIndex(n=>tableOf(n,'creditWatch'));
 assert.ok(ti>=0&&ci===ti+1,'credit card is directly under the team table');
 const tbl=tableOf(body[ci],'creditWatch'),rows=tbl.attrs.cfg.rows,row=rows.find(r=>r.toCollect>0);assert.ok(row);
 assert.equal(row.toCollect,FD.vanCredit(s,row.v.id).toCollect);
 assert.deepEqual(tbl.attrs.cfg.columns.map(c=>c.key),['v','p','n','w','s']);
 assert.ok(content(tbl.attrs.cfg.columns.find(c=>c.key==='n').render(row)).includes(FD.fmt.money0(row.toCollect)));
 const w=rows.find(r=>r.pending>0);if(w)assert.ok(content(tbl.attrs.cfg.columns.find(c=>c.key==='w').render(w)).includes(FD.fmt.money0(w.pending)));
 FD.ui.local['rules:sec']='watch';
 assert.ok(!tableOf({children:FD.views.sup.rules({}).body},'creditWatch'),'gone from Rules');
 FD.ui.local['vsr:tab']='overview';const v=s.world.vsrs.find(x=>x.kind==='sales'),c=FD.vanCredit(s,v.id),text=content(S.vsrContent(v.id,false));
 assert.ok(text.includes(FD.t('L_CRL_OVERDUE',{pct:FD.fmt.pct(c.overduePct)})));
 if(c.toCollect>0)assert.ok(text.includes(FD.fmt.money0(c.toCollect)));
}finally{cleanup();}});
test('D13 route change shows both moves and the date before Save; store move shows its date',()=>{try{
 const FD=ui(),S=FD.sup,s=FD.state,a=s.world.vsrs.find(v=>v.kind==='sales'),b=s.world.vsrs.find(v=>v.kind==='sales'&&v.id!==a.id);
 S.routeAssignSheet(a.id);let sel=walk(FD._sheet.render()).find(n=>n.tag==='select');sel.attrs.change(b.route);
 const pv=FD.routeSwapPreview(s,b.route,a.id),text=content(walk(FD._sheet.render()).find(n=>(n.attrs.class||'').includes('swap-preview')));
 assert.equal(pv.moves.length,2);
 assert.ok(text.includes(FD.nameOf(a))&&text.includes(FD.nameOf(b))&&text.includes(FD.fmt.date(pv.from)),text);
 assert.ok(!/RYD_/.test(content(FD._sheet.render())),'no route codes');
 const store=s.world.stores.find(x=>x.vsr===a.id);S.storeAssignSheet(store.id);sel=walk(FD._sheet.render()).find(n=>n.tag==='select');sel.attrs.change(b.id);
 assert.ok(content(FD._sheet.render()).includes(FD.t('L_MOVES_TO',{vsr:FD.nameOf(b),date:FD.fmt.date(FD.addDays(s.clock.date,1))})));
 store.pend={vsr:b.id,route:b.route,from:FD.addDays(s.clock.date,1)};
 assert.ok(content(S.storeContent(store.id,null,false)).includes(FD.t('L_MOVES_TO',{vsr:FD.nameOf(b),date:FD.fmt.date(store.pend.from)})));
}finally{cleanup();}});
test('D10 snoozed follow-ups leave Done and can be restored',()=>{try{
 const FD=ui(),S=FD.sup,s=FD.state,f=FD.followUps(s)[0];assert.ok(f);
 FD.dispatch('FOLLOWUP_SNOOZE',{fu:f.key,snap:{tpl:f.tpl,slots:f.slots}});
 s.fuHistory.push({key:f.key,how:'L_SNOOZE',at:{date:s.clock.date,time:'09:00'},snap:{tpl:f.tpl,slots:f.slots}}); // an entry from an older saved state
 assert.ok(!content(S.fuHistoryList(null)).includes(FD.tx(f.tpl,f.slots)),'not under Done');
 assert.equal(S.fuHistoryAll().filter(x=>x.how==='L_SNOOZE').length,0);
 const list=S.snoozedList();assert.ok(content(list).includes(FD.t('L_SNOOZED_N',{n:FD.fmt.num(FD.snoozedFollowUps(s).length)})));
 assert.ok(content(list).includes(FD.tx(f.tpl,f.slots)));
 btnWith(list,FD.t('L_RESTORE')).attrs.on.click();
 assert.equal(FD.snoozedFollowUps(s).length,0);assert.ok(FD.followUps(s).some(x=>x.key===f.key),'back in the open list');assert.equal(S.snoozedList(),null);
}finally{cleanup();}});
test('D14 correction sheet shows the reported value; Accept applies it; the Edit shortcut is gone for these kinds',()=>{try{
 const FD=ui(),S=FD.sup,s=FD.state,v=s.world.vsrs.find(x=>x.kind==='sales'),store=s.world.stores.find(x=>x.vsr===v.id&&x.size!=='LARGE');
 const add=(kind,value)=>{FD.dispatch('CORRECTION_ADD',{vsr:v.id,store:store.id,kind,value,comment:''});return s.corrections[s.corrections.length-1].id;};
 let id=add('CORR_SIZE','LARGE');S.correctionSheet(id);let text=content(FD._sheet.render());
 assert.ok(text.includes(FD.t('SIZE_LARGE'))&&text.includes(FD.t('L_REPORTED')));
 const foot={children:FD._sheet.footer()};assert.ok(!btnWith(foot,FD.t('L_NAV_STORES')),'no Edit shortcut');
 btnWith(foot,FD.t('L_ACCEPT')).attrs.on.click();assert.equal(store.size,'LARGE');
 const prof=FD.PROFILES.find(p=>p!==store.profile);id=add('CORR_PROFILE',prof);S.correctionSheet(id);assert.ok(content(FD._sheet.render()).includes(FD.t('PROFN_'+prof)));
 id=add('CORR_SHELF','high');S.correctionSheet(id);assert.ok(content(FD._sheet.render()).includes(FD.t('SHELFV_high')));
 id=add('CORR_CLOSED',null);S.correctionSheet(id);assert.ok(content(FD._sheet.render()).includes(FD.t('L_CV_CLOSED')));
 id=add('CORR_MOVED',null);S.correctionSheet(id);assert.ok(content(FD._sheet.render()).includes(FD.t('L_CV_MOVED')));
 const tg=FD.TAGS.find(g=>!(store.tags||[]).includes(g));id=add('CORR_TAG',tg);S.correctionSheet(id);assert.ok(content(FD._sheet.render()).includes(FD.t('TAGN_'+tg.slice(4))));btnWith({children:FD._sheet.footer()},FD.t('L_ACCEPT')).attrs.on.click();assert.ok(store.tags.includes(tg),'accept adds the nearby place');
 id=add('CORR_LABEL',null);S.correctionSheet(id);assert.ok(btnWith({children:FD._sheet.footer()},FD.t('L_NAV_STORES')),'older kinds keep the shortcut');
}finally{cleanup();}});
test('Expected sale replaces the store-margin label everywhere it was shown',()=>{try{
 const FD=ui(),S=FD.sup,s=FD.state;S.f.sup='';S.f.route='';
 for(const lang of ['en','ar']){FD.lang=lang;
  assert.ok(!/margin|هامش/i.test(FD.t('L_EST_MARGIN')));
  const cols=[...walk({children:FD.views.sup.weekly({}).body}),...walk({children:FD.views.sup.opps({}).body})].filter(n=>n.tag==='table'&&n.attrs.cfg).flatMap(n=>n.attrs.cfg.columns.map(c=>c.label));
  assert.ok(cols.includes(FD.t('L_EXPECTED_SALE')));assert.ok(!cols.some(l=>/margin|هامش/i.test(String(l))));
  const r=s.recs.find(x=>x.ev);assert.ok(r);let out;FD.drawer.open=cfg=>{out=cfg.render();};S.recDrawer(r.id);const labels=walk(out).filter(n=>n.tag==='dt').map(content);assert.ok(labels.includes(FD.t('L_EXPECTED_SALE')));assert.ok(!labels.some(l=>/margin|هامش/i.test(l)));
 }
 assert.doesNotMatch(FD.CATALOG.I_OPPS.en,/margin/i);
}finally{cleanup();}});
test('maturity shows four states and the days left come from the category window',()=>{try{
 const FD=ui(),S=FD.sup,s=FD.state,sku=FD.SKUS[0].code,today=s.clock.date;
 assert.ok(content(S.matChip({maturity:'NOT_REORDERED'})).includes('Not reordered'));
 assert.ok(content(S.matChip({maturity:'SUSTAINED'})).includes(FD.t('E_SUSTAINED')));assert.ok(content(S.matChip({maturity:'RETURNED'})).includes(FD.t('E_RETURNED')));
 for(const k of FD.SKUS.map(x=>x.code).slice(0,40)){const left=FD.catWindow(k)-3;assert.ok(content(S.matChip({maturity:'PENDING',sku:k,date:FD.addDays(today,-3)})).includes(FD.tx('E_PENDING',{days:left})));}
 assert.ok(content(S.matChip({maturity:'PENDING',sku,date:FD.addDays(today,-3),soldOn:FD.addDays(today,-1)})).includes(FD.tx('E_PENDING',{days:FD.catWindow(sku)-1})),'counts from the sale date');
}finally{cleanup();}});
test('store facts: area type name, location to confirm, closed; no tag pins',()=>{try{
 const FD=ui(),S=FD.sup,s=FD.state,store=s.world.stores[0];
 let text=content(S.storeContent(store.id,null,false));assert.ok(text.includes(FD.t('PROFN_'+store.profile)));assert.ok(!text.includes(FD.t('L_LOC_CONFIRM')));
 store.relocate=true;store.closed=s.clock.date;text=content(S.storeContent(store.id,null,false));
 assert.ok(text.includes(FD.t('L_LOC_CONFIRM'))&&text.includes(FD.t('L_CV_CLOSED')));
 for(const preset of [undefined,{scope:'tag',id:'TAG_SCHOOL'}]){S.pinSheet(FD.SKUS[0].code,preset);
  const seg=walk(FD._sheet.render()).find(n=>n.tag==='group');assert.ok(!seg.attrs.options.some(o=>o.id==='tag'));assert.equal(seg.attrs.value,'all');}
 S.storeEditSheet(store.id);assert.ok(!/TAGN_|TAG_/.test(JSON.stringify(walk(FD._sheet.render()).map(n=>n.attrs.options||null))));
}finally{cleanup();}});
test('baseline figures print their dates; Visits with a sale shows the collected count; Rules lose the dead sliders',()=>{try{
 const FD=ui(),S=FD.sup,s=FD.state;S.f.sup='';
 for(const lang of ['en','ar']){FD.lang=lang;for(const k of ['L_COL_VS_BASE','L_KPI_VS_BASE']){const txt=FD.t(k);assert.ok(txt.length>0&&!/\d/.test(txt),txt);}}
 FD.lang='en';
 const range=S.range(),rows=FD.teamCompare(s,range.from,range.to),row=Object.assign({},rows.find(r=>r.m.collected>0),{partial:false});assert.ok(row.m);
 const col=S.teamColumns(true,false,false).find(c=>c.key==='withSale');assert.ok(content(col.render(row)).includes(FD.t('L_COLLECTED_N',{n:FD.fmt.num(row.m.collected)})));
 const ids=rows.map(r=>r.vsr),strip=S.leverStrip({ids,from:range.from,to:range.to});assert.ok(content(strip).includes(FD.t('L_COLLECTED_N',{n:FD.fmt.num(FD.teamLevers(s,ids,range.from,range.to).collected)})));
 FD.toggle=()=>node('switch');const text=content({children:FD.views.sup.rules({}).body});assert.ok(!text.includes(FD.t('L_R_LAPSED'))&&!text.includes(FD.t('L_R_MATURITY')),'dead sliders gone');
 assert.ok(text.includes(FD.t('L_R_CAT_GAP'))&&text.includes(FD.t('L_R_CAT_WIN')));
 FD.ui.local['vsr:tab']='overview';const v=s.world.vsrs.find(x=>x.kind==='sales'),o=content(S.vsrContent(v.id,false));
 assert.ok(o.includes(FD.t('L_REORDERS_SOLD'))&&o.includes(FD.t('L_KPI_UPSELLS')));
}finally{cleanup();}});
test('credit text matches the cash-sale rule',()=>{const FD=load();for(const l of ['en','ar']){FD.lang=l;assert.doesNotMatch(FD.t('F_CREDIT_C'),/paused|توقف/);assert.doesNotMatch(FD.t('PB_S3_D'),/credit limit|blocked|الموقوف/i);}FD.lang='en';assert.match(FD.t('F_CREDIT_C'),/cash sale/);});
