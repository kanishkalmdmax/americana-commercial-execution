const test = require('node:test'); const assert = require('node:assert/strict');
const load = require('./load');
const products = () => { const FD = load(); if (!FD.productMeta) require('../src/02d_products.js'); return FD; };

test('flat assortment filters share search counts and clear narrower choices when a parent changes',()=>{
 const FD=products(),codes=FD.SKUS.map(k=>k.code);
 const facets=FD.productFacets(codes,{query:'Peanut',path:[]});
 assert.equal(facets[0].reduce((n,x)=>n+x.count,0),3);assert.equal(facets[0][0].id,'biscuit');
 assert.deepEqual(FD.setProductPath(['biscuit','soft','chocolate','pack:40'],1,'butter'),['biscuit','butter']);
 assert.deepEqual(FD.setProductPath(['biscuit','soft'],0,''),[]);
 const missing=FD.productFacets(codes,{query:'no-match',path:['biscuit','soft']});
 assert.equal(missing[0].find(x=>x.id==='biscuit').count,0);
});
test('product tree covers each current SKU once and supports all categories', () => {
  const FD = products(); const codes = FD.SKUS.map(k => k.code); const tree = FD.productTree(codes);
  assert.equal(tree.reduce((n, x) => n + x.count, 0), 96);
  assert.ok(tree.some(x => x.id === 'other'));
  const leaves = []; const walk = ns => ns.forEach(n => n.children.length ? walk(n.children) : leaves.push(...n.codes)); walk(tree);
  assert.deepEqual(leaves.slice().sort(), codes.slice().sort());
  assert.notEqual(FD.productMeta('209618').family, FD.productMeta('209996').family);
  assert.deepEqual(FD.productFilter(codes, { path: ['biscuit','soft'], query: 'Peanut' }), ['209620','209617']);
});
test('comparable prices use selling-unit mass and reject unsupported comparisons', () => {
  const FD = products();
  const a = { category:'cake',family:'slice',flavour:'vanilla',basis:'acquisition',packCost:5,netGrams:100 };
  const b = { ...a,packCost:9,netGrams:200 };
  assert.equal(FD.packValueComparison(a,b).savingPct,10);
  assert.equal(FD.packValueComparison(a,{...b,netGrams:0}),null);
  assert.equal(FD.packValueComparison(a,{...b,packCost:12}),null);
  assert.equal(FD.packValueComparison(a,{...b,basis:'retail'}),null);
  assert.equal(FD.packValueComparison(a,{...b,family:'rusk'}),null);
  assert.equal(FD.productPrice('209871').per100g,null, '3 pieces does not establish grams');
  assert.equal(FD.productPrice('209618').netGrams,40);
});
