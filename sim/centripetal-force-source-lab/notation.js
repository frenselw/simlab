(function(root,factory){
  const node=typeof module==='object'&&module.exports;let convert;
  if(node){
    const {mathjax}=require('mathjax-full/js/mathjax.js'),{TeX}=require('mathjax-full/js/input/tex.js'),{SVG}=require('mathjax-full/js/output/svg.js'),{liteAdaptor}=require('mathjax-full/js/adaptors/liteAdaptor.js'),{RegisterHTMLHandler}=require('mathjax-full/js/handlers/html.js');
    const adaptor=liteAdaptor();RegisterHTMLHandler(adaptor);
    const doc=mathjax.document('',{InputJax:new TeX({packages:['base']}),OutputJax:new SVG({fontCache:'none'})});
    convert=tex=>{const svg=adaptor.outerHTML(adaptor.firstChild(doc.convert(tex,{display:false})));if(svg.includes('data-mml-node="merror"'))throw Error('Invalid TeX');return {box:svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number),markup:svg.slice(svg.indexOf('>')+1,svg.lastIndexOf('</svg>'))};};
  }else convert=tex=>{const glyph=root.CentripetalSourceGlyphs[tex];if(!glyph)throw Error('Missing TeX glyph');return glyph;};
  const api=factory(convert);if(node)module.exports=api;else root.CentripetalSourceNotation=api;
  if(node&&require.main===module)require('node:fs').writeFileSync(require('node:path').join(__dirname,'math-glyphs.js'),'// Generated from LaTeX by: node notation.js\n(function(root){const glyphs='+JSON.stringify(api.assets())+';if(typeof module==="object"&&module.exports)module.exports=glyphs;else root.CentripetalSourceGlyphs=glyphs;})(globalThis);\n');
})(typeof window==='undefined'?globalThis:window,function(convert){
  'use strict';
  const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const forces=[
    ['重力','地球對物體','\\vec{G}','#168442'],['引力','太陽對地球','\\vec{F}_{\\mathrm{g}}','#168442'],
    ['拉力','繩對物體','\\vec{T}','#ad6500'],['支持力','接觸面對物體','\\vec{N}','#b82170'],
    ['靜摩擦力','接觸面對物體','\\vec{f}_{\\mathrm{s}}','#cf3030'],['滑動摩擦力','接觸面對物體','\\vec{f}_{\\mathrm{k}}','#cf3030'],
    ['額外向心力','額外的一個力','\\vec{F}_{\\mathrm{c}}','#7340aa'],['額外離心力','額外的一個力','\\vec{F}_{\\mathrm{cf}}','#7340aa'],['推力','發動機對物體','\\vec{F}_{\\mathrm{d}}','#7340aa']
  ].map(([name,source,tex,color])=>({name,source,tex,color}));
  const tex={
    'F向 = T；N = mg':'F_{\\mathrm{c}}=T,\\quad N=mg',
    'F向 = T + N + mg':'F_{\\mathrm{c}}=T+N+mg',
    'F向 = mg − N = mv²/r':'F_{\\mathrm{c}}=mg-N=\\frac{mv^2}{r}',
    'F向 = N − mg = mv²/r':'F_{\\mathrm{c}}=N-mg=\\frac{mv^2}{r}',
    'F向 = mg + N':'F_{\\mathrm{c}}=mg+N',
    'F向 = T sin θ；T cos θ = mg':'F_{\\mathrm{c}}=T\\sin\\theta,\\quad T\\cos\\theta=mg',
    'F向 = fₛ；fₛ ≤ μₛN':'F_{\\mathrm{c}}=f_{\\mathrm{s}},\\quad f_{\\mathrm{s}}\\leq\\mu_{\\mathrm{s}}N',
    'mg − N = mv²/r':'mg-N=\\frac{mv^2}{r}','N − mg = mv²/r':'N-mg=\\frac{mv^2}{r}',
    'F向 = mg':'F_{\\mathrm{c}}=mg','F向 = N':'F_{\\mathrm{c}}=N','F向 = T':'F_{\\mathrm{c}}=T',
    'T sin θ':'T\\sin\\theta','T cos θ':'T\\cos\\theta','mv²/r':'\\frac{mv^2}{r}',
    'G = mg':'G=mg','F向':'F_{\\mathrm{c}}','F引':'F_{\\mathrm{g}}','fₛ':'f_{\\mathrm{s}}','μₛ':'\\mu_{\\mathrm{s}}','θ':'\\theta','mg':'mg','T':'T','N':'N','O':'O'
  };
  const cache=new Map();
  function glyph(t){if(!cache.has(t))cache.set(t,convert(t));return cache.get(t);}
  function measure(t,size){const b=glyph(t).box;return {width:b[2]*size/1000,height:b[3]*size/1000,ascent:-b[1]*size/1000,descent:(b[1]+b[3])*size/1000};}
  function html(t,label){const g=glyph(t),m=measure(t,1);return `<svg class="math-inline" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(label)}" data-tex="${esc(t)}" width="${m.width}em" height="${m.height}em" viewBox="${g.box.join(' ')}" style="vertical-align:${-m.descent}em">${g.markup}</svg>`;}
  function svg(t,label,box,size,color){const g=glyph(t),m=measure(t,size);return `<g class="force-math" data-tex="${esc(t)}" role="img" aria-label="${esc(label)}" color="${color}" transform="translate(${box.x} ${box.y+m.ascent}) scale(${size/1000})">${g.markup}</g>`;}
  const keys=Object.keys(tex).sort((a,b)=>b.length-a.length);
  function prose(value){let out='',at=0;while(at<value.length){const key=keys.find(k=>value.startsWith(k,at));if(key){out+=html(tex[key],key);at+=key.length;}else out+=esc(value[at++]);}return out;}
  function forceHtml(kind){const f=forces[kind];return html(f.tex,f.name);}
  function assets(){return Object.fromEntries([...new Set([...Object.values(tex),...forces.map(f=>f.tex)])].map(t=>[t,glyph(t)]));}
  function directionIcon(angle){const a=angle*Math.PI/1800,x=24+16*Math.cos(a),y=24-16*Math.sin(a),ux=Math.cos(a),uy=-Math.sin(a),bx=x-7*ux,by=y-7*uy;return `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="3" fill="currentColor"/><path d="M24 24L${x} ${y}M${bx-4*uy} ${by+4*ux}L${x} ${y}L${bx+4*uy} ${by-4*ux}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;}
  return Object.freeze({forces,tex,measure,html,svg,prose,forceHtml,assets,directionIcon});
});
