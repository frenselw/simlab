"use strict";
const assert=require("node:assert/strict");
const {gestureIssues,layoutIssues,panelTraceIssues}=require("./mobile-scroll-browser-regression.js");
const before={host:200,outerWindow:0,immediateParent:0,document:0,documentX:0,documentRange:0,panel:40,panelRange:200,state:{hooks:{answers:[]},forms:[],phase:[],suspend:""},events:[]};
const after={...before,host:270,events:[{type:"pointerdown",isTrusted:true,pointerType:"touch"}]};
const stage={region:"stage",direction:"up"};
const sample=host=>({host,page:0,panel:40,outerWindow:0});
assert.deepEqual(gestureIssues(before,after,[sample(210),sample(240),sample(270)],stage),[]);
assert.ok(gestureIssues(before,after,[sample(220),sample(210),sample(270)],stage).some(x=>x.includes("reversed")),"same final position must still reject feedback jumps");
assert.ok(gestureIssues(before,before,[sample(200)],stage).some(x=>x.includes("did not scroll")),"swallowed nested gesture must fail");
assert.ok(gestureIssues(before,{...after,state:{...after.state,hooks:{answers:[1]}}},[sample(270)],stage).includes("learner state changed"),"blank swipe cannot edit work");
assert.ok(gestureIssues(before,after,[{...sample(230),panel:70},sample(270)],stage).some(x=>x.includes("sibling panel")),"transient wrong-owner movement must fail even if restored");
assert.ok(gestureIssues(before,{...after,events:[{type:"pointerdown",isTrusted:false,pointerType:"touch"}]},[sample(270)],stage).includes("trusted touch pointer missing"));
assert.ok(gestureIssues(before,after,[],stage).includes("missing movement samples"));
assert.ok(gestureIssues(before,{...before,documentRange:40,events:after.events},[{...sample(200),panel:40}],{region:"panel",direction:"down",position:"top"}).some(x=>x.includes("scroll range")));
assert.deepEqual(gestureIssues({...before,panel:2,panelRange:3},{...before,panel:3,panelRange:3,events:after.events},[{...sample(200),panel:3}],{region:"panel",direction:"up",position:"middle"}),[],"tiny panel ranges use available travel rather than an impossible 3px minimum");
assert.ok(layoutIssues({panelBounds:{y:323,height:32},viewport:{height:320}}).some(x=>x.includes("outside")),"zero root scroll range does not excuse an offscreen panel");
assert.ok(layoutIssues({panelBounds:{y:280,height:25},viewport:{height:320}}).some(x=>x.includes("usable height")),"short players must retain a usable panel");
const {spawnSync}=require("node:child_process");
const path=require("node:path");
const invalidProfile=spawnSync(process.execPath,[path.join(__dirname,"mobile-scroll-browser-regression.js"),"--slugs=fbd-horizontal-block","--profiles=initial,misspelled-profile"],{encoding:"utf8"});
assert.notEqual(invalidProfile.status,0,"a partially valid profile list must not silently omit missing coverage");
assert.match(invalidProfile.stderr,/Missing requested profile coverage: misspelled-profile/);

const panelTrace={samples:[{host:200,outerWindow:0,page:0,iframeY:-30}],styleChanges:[]};
assert.deepEqual(panelTraceIssues({...before,iframe:{y:-30}},panelTrace),[]);
assert.ok(panelTraceIssues(before,{...panelTrace,styleChanges:[{node:"HTML",oldStyle:"",newStyle:"overflow:hidden"}]}).some(x=>x.includes("styles")),"restoring a host lock later must not erase its topology mutation");
assert.ok(panelTraceIssues(before,{...panelTrace,samples:[{host:0,outerWindow:0,page:0},{host:200,outerWindow:0,page:0}]}).some(x=>x.includes("host moved")),"a transient panel jump must fail even when the final Y is restored");

assert.ok(gestureIssues(before,{...before,panel:70,events:[...after.events,{type:"click",isTrusted:true}]},[{...sample(200),panel:70}],{region:"panel",direction:"up",position:"middle"}).includes("panel swipe activated a control"),"a drag from a button must not activate it");

console.log("Mobile scroll acceptance rejects reversals, wrong owners, host style locks, control activation, state edits and missing trusted coverage.");
