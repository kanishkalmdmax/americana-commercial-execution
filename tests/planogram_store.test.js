const test=require('node:test'); const assert=require('node:assert/strict'); const load=require('./load');
const boot=(storage=null)=>{ const FD=load(); FD.init(7,{storage}); return FD; };
const start=FD=>{ const s=FD.state, store=s.world.stores[0]; FD.dispatch('PG_START',{key:'start',id:'A1',store:store.id,vsr:store.vsr,visitId:'visit'}); return store; };

test('a photo quota failure leaves later ordinary actions persistable',()=>{
 let saved=null;const storage={getItem:()=>saved,setItem:(key,value)=>{if(value.length>5000)throw Error('quota');saved=value;},removeItem:()=>{saved=null;}};
 const FD=boot(storage);start(FD);const ok=FD.tryPhotoBatch({id:'A1',photos:[{id:'big',phase:'BEFORE',src:'x'.repeat(6000)}]});
 assert.equal(ok,false);assert.equal(FD.state.photos.some(p=>p.id==='big'),false);
 FD.dispatch('PRODUCT_COLUMNS_SET',{keys:['per100g']});FD.flushPersistence();FD.init(7,{storage});
 assert.deepEqual(FD.state.planogram.columnPrefs.products,['name','per100g']);assert.equal(FD.state.log.some(e=>e.type==='PG_PHOTOS_ADD'),false);
});
test('linked visit salesman owns captured evidence',()=>{
 const FD=boot(),s=FD.state,so=s.world.stores[0],cover=s.world.vsrs.find(v=>v.id!==so.vsr&&v.kind==='sales');
 s.visits.push({id:'covered',store:so.id,date:s.clock.date,vsr:cover.id});
 FD.dispatch('PG_START',{id:'cover',store:so.id,visitId:'covered'});FD.dispatch('PG_PHOTOS_ADD',{id:'cover',photos:[{id:'cp',src:'x',phase:'BEFORE'}]});
 assert.equal(FD.pgAssessment(s,'cover').vsr,cover.id);assert.equal(s.photos.find(p=>p.id==='cp').vsr,cover.id);
});
test('a check holds any number of Before and After photos and never touches the visit',()=>{
 const FD=boot(); start(FD); const s=FD.state,before=s.visits.map(x=>x.status);
 const photos=Array.from({length:12},(_,i)=>({id:'P'+i,src:'data:image/jpeg;base64,x',phase:i===11?'AFTER':'BEFORE'}));
 FD.dispatch('PG_PHOTOS_ADD',{key:'photos',id:'A1',photos}); FD.dispatch('PG_PHOTOS_ADD',{key:'photos',id:'A1',photos});
 FD.dispatch('PG_PHOTOS_ADD',{id:'A1',photos:[{id:'X',src:'x',phase:'CONTEXT'}]});
 assert.equal(FD.pgAssessment(s,'A1').photoIds.length,12); assert.deepEqual(s.visits.map(x=>x.status),before);
});
test('new and old photo events replay without inventing metadata; column choices persist',()=>{
 let raw; const storage={getItem:()=>raw,setItem:(k,v)=>raw=v,removeItem:()=>{raw=null;}};
 let FD=boot(storage); const so=start(FD);
 FD.dispatch('PHOTOS_ADD',{key:'old',store:so.id,vsr:so.vsr,photos:['legacy']});
 FD.dispatch('PG_PHOTOS_ADD',{key:'new',id:'A1',photos:[{id:'P1',phase:'BEFORE',src:'new'}]});
 FD.dispatch('SC_ACTION_SET',{key:'act',id:'A1',check:'FIND_HIDDEN',outcome:'DONE'});
 FD.dispatch('PRODUCT_COLUMNS_SET',{key:'cols',keys:['name','per100g','per100g','bogus']});
 FD=boot(storage); assert.deepEqual(FD.state.planogram.columnPrefs.products,['name','per100g']);
 const legacy=FD.state.photos.find(p=>p.src==='legacy'); assert.equal(legacy.assessmentId,undefined);
 assert.equal(FD.pgAssessment(FD.state,'A1').photoIds.length,1);assert.equal(FD.pgAssessment(FD.state,'A1').actions.FIND_HIDDEN,'DONE');
 assert.throws(()=>FD.registerReducer('PG_START',()=>{}));
});
test('a competitor photo is kept out of Shelf Check and shows in the store competition',()=>{
 const FD=boot(),s=FD.state,so=s.world.stores[1],before=FD.compIntel(s,so.id);
 FD.dispatch('COMP_PHOTO_ADD',{id:'c1',store:so.id,src:'x',brand:'BR_SWITZ',seen:['CI_PRICE','BAD'],note:' new stand '});
 FD.dispatch('COMP_PHOTO_ADD',{id:'c1',store:so.id,src:'y',brand:'BR_SWITZ'});
 const p=s.photos.filter(x=>x.id==='c1');assert.equal(p.length,1);assert.deepEqual(p[0].seen,['CI_PRICE']);assert.equal(p[0].note,'new stand');assert.equal(p[0].assessmentId,undefined);
 const C=FD.compIntel(s,so.id),b=C.brands.find(x=>x.brand==='BR_SWITZ');
 assert.equal(C.photos[0].id,'c1');assert.ok(b.photos>=1&&b.signals.includes('CI_PRICE'));assert.equal(C.photos.length,before.photos.length+1);
 FD.dispatch('COMP_PHOTO_ADD',{id:'c2',store:so.id,src:'z',brand:'NOPE'});assert.equal(s.photos.find(x=>x.id==='c2').brand,'BR_OTHER');
});
test('demo stores carry competitor photos and Shelf Check brands use the same names',()=>{
 const FD=boot(),s=FD.state,withPhotos=s.world.stores.filter(so=>FD.compIntel(s,so.id).photos.length);
 assert.ok(withPhotos.length>0);
 for(const so of s.world.stores)for(const b of FD.compIntel(s,so.id).brands)assert.ok(FD.COMP_BRANDS.includes(b.brand),b.brand);
});
