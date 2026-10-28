// TODAY agent: damaged-stock alert, reviewed vans, payday line, photo requests, supervisor capture, older follow-ups.
const test=require('node:test'),assert=require('node:assert/strict'),load=require('./load'),path=require('node:path');
const node=(tag,attrs,...children)=>({tag,attrs:attrs||{},children:children.flat(Infinity).filter(x=>x!=null&&x!==false),querySelector(){return node('img');},appendChild(child){this.children.push(child);},addEventListener(){},style:{setProperty(){}},setAttribute(){},replaceChildren(...items){this.children=items;}});
// stub DOM harness copied from planogram_views.test.js
function ui(shelf){
 const FD=load();if(shelf)FD.SHELF_RESULTS=shelf(FD);FD.init(7,{storage:null});global.document={};global.requestAnimationFrame=()=>{};
 let seq=0;FD.key=()=>String(++seq);FD.ui={local:{}};FD.h=node;FD.icon=k=>node('icon',{k});FD.registerView=(role,name,fn)=>{FD.views[role][name]=fn;};FD.views={sup:{},vsr:{}};
 FD.btn=(text,fn,cls)=>node('button',{on:{click:fn},class:cls},text);FD.iconBtn=(icon,text,fn)=>FD.btn(text,fn);FD.select=(options,value,change)=>node('select',{options,value,change});FD.seg=(options,value,change)=>node('group',{options,value,change});
 FD.skuLabel=code=>node('span',null,FD.nameOf(FD.sku(code)));FD.skuTile=()=>null;FD.skuIcon=()=>null;FD.chip=x=>node('span',null,x);FD.typeChip=x=>node('span',null,FD.t('TYPE_'+x));FD.productPickBar=()=>node('div');FD.searchBox=()=>node('input');FD.empty=()=>null;FD.table=cfg=>node('table',{cfg},cfg.rows.map(r=>cfg.columns.map(c=>c.render?.(r))));FD.photoButton=p=>node('button',{'aria-label':p.label},node('img',{src:p.src}));FD.sizeIcon=()=>null;FD.creditChip=()=>null;FD.avatar=()=>null;FD.ring=()=>null;FD.delta=()=>null;FD.line=()=>null;FD.spark=()=>null;FD.bars=()=>null;FD.drawer={refresh(){},open(cfg){return cfg.render();}};FD.sheet={open(cfg){FD._sheet=cfg;return cfg.render();},redraw(){},close(){}};FD.dx=FD.dispatch;FD.toast=()=>{};
 for(const f of ['08_vsr.js','08b_planogram.js','09_sup.js','09b_today.js','09d_levers.js','09e_planogram.js','09f_products.js']){const p=path.join(__dirname,'../src',f);delete require.cache[require.resolve(p)];require(p);}
 return FD;
}
const cleanup=()=>{delete global.document;delete global.requestAnimationFrame;};
const walk=n=>!n||typeof n!=='object'?[]:[n,...(n.children||[]).flatMap(walk)];
const content=n=>!n?'':typeof n!=='object'?String(n):(n.children||[]).map(content).join(' ');
const result=(FD,status='OK')=>({scope:'AMBIENT_SHELF',photo:{status,reasons:[],display:'RACK'},checks:Object.fromEntries(FD.SC_CHECKS.map(c=>[c,c==='FULL_EMPTY_SPACE'?{result:'FAIL'}:{result:'PASS'}])),findings:[{check:'FULL_EMPTY_SPACE',box_2d:[1,1,2,2]}],americana_seen:['CUPCAKE'],competition:[],confidence:'HIGH'});
const shelf=FD=>({model:'t',groups:[],photos:{0:{file:'ok.jpeg',result:result(FD)},1:{file:'blur.jpeg',result:result(FD,'RETAKE')}}});
const add=(FD,id,store,photos,by)=>{if(!FD.pgAssessment(FD.state,id))FD.dispatch('PG_START',{id,store,by});FD.dispatch('PG_PHOTOS_ADD',{id,photos});};

test('D04: a damaged-stock line (no store, no product) renders in the van day',()=>{try{
 const FD=ui(),s=FD.state,van=s.world.vsrs.find(v=>v.kind==='sales'&&(FD.REAL.vanDamaged||{})[v.id]);assert.ok(van);
 const x=FD.dispatchExceptions(s,van.id,s.clock.date).find(e=>e.type==='X_DAMAGED');assert.ok(x&&!x.store&&!x.sku);
 FD.ui.local['xg:'+van.id+'X_DAMAGED']=true;FD.sup.planEditor=()=>node('div'); // the editor needs the full UI kit
 for(const lang of ['en','ar']){FD.lang=lang;const text=content(FD.sup.vanDay(van.id));assert.ok(text.includes(FD.tx('X_DAMAGED',x.slots)));}
}finally{cleanup();}});

test('a reviewed van locks the plan editor, says it is waiting for data and can be reopened',()=>{try{
 const FD=ui(),s=FD.state,van=s.world.vsrs.find(v=>v.kind==='sales'),d=s.clock.date;let editors=0;FD.sup.planEditor=()=>{editors++;return node('div');};
 const open=FD.sup.vanDay(van.id);assert.equal(editors,1,'open van: editor shown');
 assert.ok(walk(open).some(n=>n.tag==='button'&&content(n)===FD.t('ACT_CLOSE_VAN')),'close action is labelled as review');
 assert.equal(FD.t('ACT_CLOSE_VAN'),'Mark as reviewed');
 FD.dispatch('VAN_CLOSE',{van:van.id});assert.ok(FD.vanLocked(s,van.id,d));assert.ok(FD.waitingData(s,van.id,d));
 editors=0;const closed=FD.sup.vanDay(van.id),text=content(closed);
 assert.equal(editors,0,'plan editor hidden for a locked van');assert.ok(text.includes(FD.t('VAN_WAITING')));assert.ok(text.includes(FD.t('VAN_LOCK_NOTE')));assert.ok(text.includes(FD.t('VAN_REVIEWED')));
 assert.ok(walk(closed).some(n=>n.tag==='button'&&content(n)===FD.t('ACT_REOPEN_VAN')),'reopen stays');
 assert.ok(!walk(closed).some(n=>n.tag==='button'&&content(n)===FD.t('ACT_CLOSE_VAN')));
 FD.dispatch('VAN_REOPEN',{van:van.id});editors=0;FD.sup.vanDay(van.id);assert.equal(editors,1);
 for(const lang of ['en','ar']){FD.lang=lang;for(const k of ['VAN_WAITING','VAN_LOCK_NOTE','VAN_REVIEWED','PAY_COLLECT','PAY_BIG','SC_REQ_PHOTO'])assert.ok(FD.t(k).length>0);}
}finally{cleanup();}});

test('Today shows one payday line on days 27-31 and 1-7 only',()=>{const timer=global.setTimeout;try{
 const FD=ui();global.setTimeout=()=>0;global.innerWidth=1440;
 for(const [date,key] of [['2026-10-29','PAY_COLLECT'],['2026-10-03','PAY_BIG'],['2026-10-15',null]]){FD.state.clock.date=date;
  const text=FD.views.sup.today().body.map(content).join(' ');
  for(const k of ['PAY_COLLECT','PAY_BIG'])assert.equal(text.includes(FD.t(k)),k===key,date+' '+k);}
}finally{global.setTimeout=timer;cleanup();}});

test('a request stays open after an unusable photo, shows photoReceived, and closes on an analysed one',()=>{
 const FD=load();FD.SHELF_RESULTS=shelf(FD);FD.init(7,{storage:null});const s=FD.state,store=s.world.stores[0].id;
 FD.dispatch('SC_REQUEST',{store});assert.equal(FD.scRequest(s,store).photoReceived,false);
 add(FD,'u',store,[{id:'p1',src:'x',phase:'BEFORE',ref:null}]);                       // no analysis
 add(FD,'u2',store,[{id:'p2',src:'x',phase:'BEFORE',ref:1}]);                          // photo says retake
 let r=FD.scRequest(s,store);assert.equal(r.status,'OPEN');assert.equal(r.photoReceived,true);
 add(FD,'ok',store,[{id:'p3',src:'x',phase:'BEFORE',ref:0}]);
 r=FD.scRequest(s,store);assert.equal(r.status,'DONE');assert.equal(r.assessmentId,'ok');assert.equal(r.photoReceived,false);
});

test('request line: photo-received text on both roles and the salesman is never blocked',()=>{try{
 const FD=ui(shelf),s=FD.state,store=s.world.stores[0].id;
 FD.dispatch('SC_REQUEST',{store});add(FD,'u',store,[{id:'p1',src:'x',phase:'BEFORE',ref:null}]);
 for(const lang of ['en','ar']){FD.lang=lang;
  assert.ok(content(FD.sup.scRequestLine(store)).includes(FD.t('SC_REQ_PHOTO')));
  const card=FD.scRequestCard({store});assert.ok(content(card).includes(FD.t('SC_REQ_PHOTO')));
  assert.ok(walk(card).some(n=>n.tag==='button'&&content(n)===FD.t('SC_REQ_TAKE')),'take-photo button still there');}
}finally{cleanup();}});

test('supervisor capture opens the Before flow; an analysed photo closes the request and is not the salesman own check',()=>{try{
 const FD=ui(shelf),s=FD.state,so=s.world.stores[0],store=so.id;
 FD.dispatch('SC_REQUEST',{store});
 const line=FD.sup.scRequestLine(store),snap=walk(line).find(n=>n.tag==='button'&&content(n)===FD.t('PG_TAKE_PHOTOS'));assert.ok(snap,'capture button next to the request line');
 const opened=[];const real=FD.pgCaptureSheet;FD.pgCaptureSheet=o=>{opened.push(o);return real(o);};snap.attrs.on.click();
 assert.equal(opened[0].store,store);assert.equal(opened[0].phase,'BEFORE');assert.equal(opened[0].by,'SUP');
 assert.ok(FD._sheet,'same capture sheet opened');
 // the photo goes through the same reducers, flagged as the supervisor's
 add(FD,'sup1',store,[{id:'sp',src:'x',phase:'BEFORE',ref:0}],'SUP');
 const a=FD.pgAssessment(s,'sup1');assert.equal(a.by,'SUP');assert.equal(a.vsr,so.vsr);
 const r=FD.scRequest(s,store);assert.equal(r.status,'DONE');assert.equal(r.by,'SUP');
 assert.ok(FD.scSummary(s,'sup1').analysed);
 assert.equal(FD.scTeam(s,s.clock.date,s.clock.date,[a.vsr])[0].stores,0,'not credited to the salesman Shelf Check count');
 add(FD,'own',store,[{id:'op',src:'x',phase:'BEFORE',ref:0}]);
 assert.equal(FD.scTeam(s,s.clock.date,s.clock.date,[a.vsr])[0].stores,1);
}finally{cleanup();}});

test('pgFollowUps keeps an older open fix until a later check clears it',()=>{
 const FD=load();FD.SHELF_RESULTS=shelf(FD);FD.init(7,{storage:null});const s=FD.state,store=s.world.stores[0].id;
 add(FD,'old',store,[{id:'b',src:'x',phase:'BEFORE',ref:0}]);
 FD.dispatch('SC_ACTION_SET',{id:'old',check:'FULL_EMPTY_SPACE',outcome:'NOT_IN_VAN'});
 assert.equal(FD.pgFollowUps(s).filter(f=>f.action.assessmentId==='old').length,1);
 FD.pgAssessment(s,'old').date=FD.addDays(s.clock.date,-9);                        // an old visit, not yesterday or today
 const fu=FD.pgFollowUps(s).find(f=>f.action.assessmentId==='old');assert.ok(fu,'still listed after 9 days');
 assert.deepEqual(Object.keys(fu).sort(),['action','at','key','pri','slots','tpl']);assert.equal(fu.slots.storeId,store);assert.equal(fu.slots.n,1);
 // a later unanalysed photo does not clear it; a later clean check of the same store does
 FD.SHELF_RESULTS.photos[5]={file:'fine.jpeg',result:{...result(FD),checks:Object.fromEntries(FD.SC_CHECKS.map(c=>[c,{result:'PASS'}])),findings:[]}};
 add(FD,'new',store,[{id:'nb',src:'x',phase:'BEFORE',ref:null}]);
 assert.ok(FD.pgFollowUps(s).some(f=>f.action.assessmentId==='old'),'an unanalysed later photo does not clear it');
 add(FD,'new2',store,[{id:'nb2',src:'x',phase:'BEFORE',ref:5}]);
 assert.ok(!FD.pgFollowUps(s).some(f=>f.action.assessmentId==='old'),'a later clean check clears it');
});

test('collection-only visits read Collected, closed stores are not missed',()=>{try{
 const FD=ui(),s=FD.state,van=s.world.vsrs.find(v=>v.kind==='sales'),d=FD.addDays(s.clock.date,-1);FD.ensureDay(s,d);
 const miss=s.visits.filter(v=>v.vsr===van.id&&v.date===d&&!v.offPlan);assert.ok(miss.length>=2);
 miss[0].status='DONE';miss[0].collected=250;miss[1].status='MISSED';s.world.stores.find(x=>x.id===miss[1].store).closed=FD.addDays(d,-1);
 const text=content(FD.sup.vanDay(van.id,d));
 assert.ok(text.includes(FD.t('L_COLLECTED')));assert.ok(text.includes(FD.t('L_STORE_CLOSED')));
 for(const g of FD.sup.alertGroupsNow())if(g.type==='A_MISSED')for(const a of g.items)assert.ok(!s.world.stores.find(x=>x.id===a.store).closed);
}finally{cleanup();}});
