const test=require('node:test'),assert=require('node:assert/strict'),load=require('./load');
test('ending the tour cancels its delayed first card when the user changes screens',()=>{
 const FD=load(),saved={};const names=['document','setTimeout','clearTimeout','addEventListener','removeEventListener'];for(const key of names)saved[key]=global[key];
 const scheduled=[],cleared=[];let created=0;FD.h=()=>{created++;};FD.ui={local:{}};
 global.document={querySelectorAll:()=>[],addEventListener(){},removeEventListener(){}};
 global.setTimeout=fn=>{scheduled.push(fn);return 99;};global.clearTimeout=id=>cleared.push(id);global.addEventListener=()=>{};global.removeEventListener=()=>{};
 try{const p=require.resolve('../src/07_shell.js');delete require.cache[p];require(p);FD.dx=()=>{};FD.tour('sup');FD.tourEnd();assert.ok(cleared.includes(99));scheduled[0]();assert.equal(created,0);}
 finally{for(const key of names){if(saved[key]===undefined)delete global[key];else global[key]=saved[key];}}
});
test('segmented selection uses the button itself and sortable headers keep their indicator in one wrapper',()=>{
 const FD=load();class N{constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.dataset={};this.style={};}setAttribute(k,v){this.attrs[k]=v;}appendChild(n){this.children.push(n);}addEventListener(){}}
 global.Node=N;global.document={createElement:tag=>new N(tag),createElementNS:(ns,tag)=>new N(tag),createTextNode:text=>Object.assign(new N('#text'),{text})};global.window={addEventListener(){}};global.history={};global.requestAnimationFrame=()=>{};
 try{
  const p=require.resolve('../src/06_ui_kit.js');delete require.cache[p];require(p);
  const seg=FD.seg([{id:'a',label:'This week'},{id:'b',label:'Since 22 Sep'}],'b',()=>{});
  assert.ok(seg.children.every(n=>n.tagName==='button'));
  const table=FD.table({id:'header',rows:[{n:1}],columns:[{key:'n',num:true,label:'Order days',hint:'4 weeks',sort:(a,b)=>a.n-b.n}]});
  const th=table.children[0].children[0].children[0].children[0];
  assert.equal(th.children[0].className,'th-content');assert.equal(th.children[0].children.length,2);
 }finally{delete global.document;delete global.window;delete global.history;delete global.Node;delete global.requestAnimationFrame;}
});
test('overlay redraw falls back to an enabled close control while its opener is disabled',()=>{
 const FD=load();let focused=null;const disabled={disabled:true,focus(){throw Error('disabled');}},close={disabled:false,focus(){focused='close';}};
 global.document={activeElement:null};global.window={addEventListener(){}};global.history={};
 try{
  const p=require.resolve('../src/06_ui_kit.js');delete require.cache[p];require(p);
  const root={querySelector(selector){return selector==='[data-focus="upload"]'?disabled:close;},querySelectorAll(){return [disabled,close];}};
  assert.equal(FD.restoreOverlayFocus(root,{selector:'[data-focus="upload"]'}),true);assert.equal(focused,'close');
 }finally{delete global.document;delete global.window;delete global.history;}
});
