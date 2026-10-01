"use strict";
const assert=require("node:assert/strict"),T=require("./touch-scroll.js");
function page(range=0,overflow="visible",scale=1){const root={scrollTop:0,scrollHeight:100+range,clientHeight:100,overflowY:overflow};const w={document:{scrollingElement:root,documentElement:root},visualViewport:{scale},getComputedStyle:e=>e};w.parent=w;return w;}
function frame(child,host,container=null){child.parent=host;child.frameElement={ownerDocument:{defaultView:host},parentElement:container};}
const outer=page(500),wrapper=page(0,"hidden"),child=page(0,"hidden");frame(wrapper,outer);frame(child,wrapper);
assert.equal(T.findHost(child).element,outer.document.scrollingElement,"skip non-scrolling immediate parent");
const element={scrollHeight:900,clientHeight:400,scrollTop:10,overflowY:"auto",parentElement:null};const elementHost=page(0,"hidden",2);frame(wrapper,elementHost,element);
const owner=T.findHost(child);assert.equal(owner.element,element,"discover enclosing overflow element");assert.equal(T.move(owner,40),true);assert.equal(element.scrollTop,30,"screen travel converts to the actual owner's zoom");assert.equal(elementHost.document.scrollingElement.scrollTop,0,"never move the nonowner window");
const blocked=page(500);blocked.document.body={overflowY:"hidden"};frame(wrapper,blocked);assert.equal(T.findHost(child),null,"propagated body overflow must not become a manual host owner");
const foreign=page();Object.defineProperty(foreign,"frameElement",{get(){throw new Error("cross-origin");}});foreign.parent={};assert.equal(T.findHost(foreign),null);assert.equal(T.move(null,40),false);assert.equal(T.move(owner,NaN),false);
console.log("Secondary-touch handoff discovers the real window/element owner, converts zoom and declines inaccessible frames.");
