import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateEstimate,PRICING} from '../dist/calculator.js';
test('Premium residential example separates optional scope and GST',()=>{
  const r=calculateEstimate({type:'residential',tier:'Premium',area:1200,kitchen:true,storage:true,waterproofing:false});
  assert.equal(r.base,3240000);assert.equal(r.subtotal,3940000);assert.equal(r.low,3546000);assert.equal(r.high,4334000);assert.equal(r.totalLow,4184280);assert.equal(r.totalHigh,5114120);
});
test('every category and collection has deterministic bounded estimates',()=>{
  for(const type of Object.keys(PRICING))for(const tier of Object.keys(PRICING[type]))for(const area of [100,1200,100000]){
    const base=calculateEstimate({type,tier,area});const full=calculateEstimate({type,tier,area,kitchen:true,storage:true,waterproofing:true});
    assert.equal(base.subtotal,area*PRICING[type][tier].base);assert.ok(full.subtotal>base.subtotal);assert.ok(full.low<full.high);assert.ok(full.totalLow>full.low);
  }
});
test('invalid area and unknown category cannot produce estimates',()=>{
  for(const area of [0,99,100001,NaN,Infinity,-1,100.5,'abc',''])assert.throws(()=>calculateEstimate({type:'office',tier:'Essential',area}),RangeError);
  for(const type of ['bad','__proto__','constructor'])assert.throws(()=>calculateEstimate({type,tier:'Essential',area:100}),RangeError);
  assert.throws(()=>calculateEstimate({type:'office',tier:'constructor',area:100}),RangeError);
});
