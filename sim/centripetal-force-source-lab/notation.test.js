'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const N=require('./notation.js'),glyphs=require('./math-glyphs.js'),V=require('./scene.js'),M=require('./model.js');
assert.deepEqual(glyphs,N.assets(),'packaged SVG glyphs must match the authoritative TeX');
for(const [tex,g]of Object.entries(glyphs)){assert(g.box.every(Number.isFinite)&&g.box[2]>0&&g.box[3]>0,tex);assert(!/<(?:use|image|foreignObject)\b|\b(?:href|id)=/.test(g.markup),tex+' must be self-contained');}
const context={CentripetalSourceGlyphs:glyphs};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'notation.js'),'utf8'),context);const browser=context.CentripetalSourceNotation;
assert.equal(browser.prose('F向 = mg − N = mv²/r'),N.prose('F向 = mg − N = mv²/r'));
assert(browser.prose('F向 = mg − N = mv²/r').includes('data-mml-node="mfrac"'));
assert(N.prose('T sin θ').includes('data-tex="T\\sin\\theta"'));assert(!N.prose('<script>').includes('<script>'));
for(const force of N.forces){assert(N.html(force.tex,force.name).includes('data-mml-node="mover"'));assert(N.measure(force.tex,22).height>10);}
for(const [w,h]of [[256,220],[326,371],[876,690]]){
  const geo={w,h,cx:w/2,cy:h/2+7,scale:Math.min(2.6,(w-74)/220,(h-68)/210)};
  for(let page=0;page<6;page++){
    const entries=M.physics(M.fresh(()=>.2).def,page).forces.map(([kind,angle])=>({angle,length:60*geo.scale,...N.measure(N.forces[kind].tex,21)}));
    const labels=V.labelPositions(entries,geo);
    labels.forEach(({box})=>assert(box.x>=0&&box.y>=0&&box.x+box.width<=w&&box.y+box.height<=h));
    labels.forEach((a,i)=>labels.slice(i+1).forEach(b=>assert(a.box.x+a.box.width<=b.box.x||b.box.x+b.box.width<=a.box.x||a.box.y+a.box.height<=b.box.y||b.box.y+b.box.height<=a.box.y,'force labels overlap')));
  }
}
for(let angle=0;angle<3600;angle+=450){const geo={cx:50,cy:50,scale:1},length=60,end=V.endpoint(geo,angle,length),arrow=V.arrowPath(geo,angle,length);assert(arrow.endsWith(' Z'));assert(arrow.includes('L'+end.x+','+end.y));assert(!/NaN|Infinity/.test(arrow));assert(N.directionIcon(angle).includes('aria-hidden="true"'));}
console.log('Centripetal presentation: exact LaTeX glyphs, offline browser rendering, filled arrow endpoints and non-overlapping force labels passed.');
