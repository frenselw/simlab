'use strict';
const a=require('node:assert/strict'),X=require('./crossings'),M=require('../circuit-workbench/circuit-model');
const p=(x,y)=>({x,y});a(X.intersection(p(0,0),p(10,10),p(0,10),p(10,0)));a.equal(X.intersection(p(0,0),p(10,0),p(0,1),p(10,1)),null);a(X.intersection(p(0,0),p(10,0),p(5,0),p(15,0)));
const d=M.empty();for(const [i,x,y]of [[1,0,0],[2,100,100],[3,0,100],[4,100,0]])d.junctions.push({id:'j'+i,x,y});M.connect(d,'j1:p','j2:p',[],'free');M.connect(d,'j3:p','j4:p',[],'free');a.equal(X.events(d).length,1);d.wires[1].from='j1:p';a.equal(X.events(d).length,0);d.wires[1].via=[p(80,80),p(20,80),p(80,20)];a(X.events(d).length>0);console.log('Crossing, near miss, overlap, shared endpoint and self-crossing passed');

const overlap=M.empty();overlap.junctions=[{id:'j1',x:0,y:0},{id:'j2',x:20,y:0},{id:'j3',x:20,y:10}];M.connect(overlap,'j1:p','j2:p',[],'free');M.connect(overlap,'j1:p','j3:p',[{x:20,y:0}],'free');a.equal(X.events(overlap).length,1,'overlap beyond shared 12-unit neighbourhood must count');
