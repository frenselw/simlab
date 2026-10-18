'use strict';
const assert=require('node:assert/strict'),M=require('./model.js'),S=require('./scoring.js'),P=require('./persistence.js'),T=require('./test-support.js');
const part=(s,name)=>S.score(s).detail.find(d=>d.name===name).points;
assert.equal(S.score(M.fresh()).score,0);assert.equal(S.score(T.filled()).score,100);assert.equal(S.score(T.filled()).detail.reduce((n,d)=>n+d.max,0),100);
let one=M.change(M.fresh(),{type:'record',slot:0,depthMm:800,ppm:10000});
const x=Math.round(M.impact(800,10000).x);one=M.change(one,{type:'read',slot:0,axis:0,value:x});assert.equal(part(one,'P1 x讀數 / cm'),3);
one=M.change(one,{type:'read',slot:0,axis:0,value:x+1});assert.equal(part(one,'P1 x讀數 / cm'),0);
assert(S.near(300.5,300,.5));assert(!S.near(300.501,300,.5));assert(S.near(.204,.2,.002,.02));assert(!S.near(.205,.2,.002,.02));assert(S.near(10.78,9.8,0,.1));assert(!S.near(10.781,9.8,0,.1));
const formulaOnly=M.change(M.fresh(),{type:'formula',field:'time',value:'fall'});assert.equal(S.score(formulaOnly).score,8);
let wrong=M.change(T.filled(),{type:'formula',field:'speed',value:'double'});wrong.meanV=M.mean(M.calculations(wrong).map(c=>c.v));P.draft(wrong);
assert.equal(part(wrong,'水平初速度公式'),0);assert.equal(part(wrong,'時間公式'),8);assert.equal(part(wrong,'平均初速度運算 / m/s'),4);assert.equal(part(wrong,'平均初速度準確度 / m/s'),0);
const linear=M.change(T.filled(),{type:'model',value:'linear'});assert.equal(part(linear,'選擇二次函數擬合'),0);assert.equal(part(linear,'成功執行資料擬合'),0);assert.equal(part(M.change(linear,{type:'fit'}),'成功執行資料擬合'),10);
const legacy=T.legacyFilled();assert.equal(S.score(legacy).score,100);legacy.rows[0].read[0]+=4;assert.equal(part(legacy,'P1 x讀數 / cm'),2);legacy.calculations[0]={t:.001,v:legacy.rows[0].read[0]};legacy.meanV=M.mean(legacy.calculations.map(c=>c.v));assert.equal(part(legacy,'P1 初速度 / m/s'),1);assert.equal(part(legacy,'平均初速度運算 / m/s'),2);
for(const base of [-300000,-150000,0]){
 let s=M.practice(M.fresh(base),()=>.5);s.fit={model:'quadratic',attempted:true};s.formulas={time:'fall',speed:'horizontal'};s.meanV=M.mean(M.calculations(s).map(c=>c.v));P.draft(s);
 assert.equal(part(s,'平均初速度準確度 / m/s'),4);
}
console.log('Projectile scoring: close readings, blank/partial, formula choices, fitting, mean follow-through and unchanged legacy rubric passed.');

const oldV2=T.legacyV2Filled();assert.equal(S.score(oldV2).score,100);assert.equal(M.fit(oldV2).n,6);assert.equal(part(oldV2,'擬合速度準確度 / m/s'),2);
const inverse=T.filled();inverse.fit={model:'inverse',attempted:true};assert.equal(part(inverse,'成功執行資料擬合'),0);assert.equal(part(inverse,'選擇二次函數擬合'),0);
assert(!S.score(T.filled()).detail.some(d=>/時間擬合|擬合速度|哪種/.test(d.name)));
