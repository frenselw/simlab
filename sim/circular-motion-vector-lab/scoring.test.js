'use strict';
const assert=require('node:assert/strict'),M=require('./model.js'),S=require('./scoring.js'),T=require('./test-support.js');
assert.equal(S.score(M.fresh()).score,0);assert.equal(S.score(T.filled()).score,100);
for(const q of M.QUESTIONS){const s=M.fresh();s.answers[q.field]=q.correct;assert.equal(S.score(s).score,q.points);for(const [key]of M.options(s,q).filter(o=>o[0]!==q.correct)){s.answers[q.field]=key;assert.equal(S.score(s).score,0);}}
const states=[[null,null,0],['S',null,0],['U',null,5],['V',null,5],['U','V',20],['V','U',10],['S','U',5],['U','S',5],['S','V',5],['V','S',5]];
for(const [from,to,points]of states){const s=M.fresh();s.answers.deltaFrom=from;s.answers.deltaTo=to;assert.equal(S.score(s).score,points);s.answers.accelerationDirection='inward';assert.equal(S.score(s).score,points+15);}
for(let mask=0;mask<128;mask++)for(const [from,to,points]of states){const s=M.fresh();let expected=points;M.QUESTIONS.forEach((q,i)=>{if(mask&(1<<i)){s.answers[q.field]=q.correct;expected+=q.points;}});s.answers.deltaFrom=from;s.answers.deltaTo=to;assert.equal(S.score(s).score,expected);assert.equal(S.score(s).passed,expected>=60);}
for(let shift=0;shift<4;shift++){const s=T.filled();s.definition.choiceShift=shift;assert.equal(S.score(s).score,100);for(const q of M.QUESTIONS)assert.equal(new Set(M.options(s,q).map(o=>o[0])).size,q.type==='direction'?4:3);}
console.log('Circular vector scoring: all 10 drawing states, 128 answer combinations, threshold, independent credit and choice rotation passed.');
