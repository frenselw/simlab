 'use strict';
const assert=require('node:assert/strict'),P=require('./parts'),M=require('./model'),O=require('./orbit'),T=require('./test-support');
const q=O.circular(300000),o=O.elements(q);assert(Math.abs(o.hp-300000)<1e-6&&Math.abs(o.ha-300000)<1e-6);assert(o.e<1e-12);assert(O.safe(q));
const f=M.flight(T.launched().craft,'own',q);f.status='flying';for(let i=0;i<Math.ceil(o.period*10/2);i++)M.step(f,2);const after=O.elements(f.state);assert(Math.abs(after.energy/o.energy-1)<1e-8);assert(Math.abs(after.momentum/o.momentum-1)<1e-8);
let s=T.reachOrbit();const before=O.elements(s.flight.state);M.advance(s,before.period+1);assert(O.safe(s.flight.state));assert(Math.abs(O.elements(s.flight.state).hp-before.hp)<.1);
s=T.launched();s=M.change(s,{type:'control',key:'angle',value:90});M.advance(s,.1);assert(s.flight.attitude<=12*Math.PI/180*.1+1e-12);
for(const type of ['practice','mission','import','node','execute','cancel'])assert.deepEqual(M.change(s,{type,dv:200}),s,'Removed transfer command must have no effect');
console.log('rocket orbit: circular values, ten-orbit conservation, successful coast, manual turn rate and removed transfer commands passed');
