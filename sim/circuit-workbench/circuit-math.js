(function(root,factory){
  const node=typeof module==='object'&&module.exports;let convert;
  if(node){
    const {mathjax}=require('mathjax-full/js/mathjax.js'),{TeX}=require('mathjax-full/js/input/tex.js'),{SVG}=require('mathjax-full/js/output/svg.js'),{liteAdaptor}=require('mathjax-full/js/adaptors/liteAdaptor.js'),{RegisterHTMLHandler}=require('mathjax-full/js/handlers/html.js');
    const adaptor=liteAdaptor();RegisterHTMLHandler(adaptor);
    const doc=mathjax.document('',{InputJax:new TeX({packages:['base']}),OutputJax:new SVG({fontCache:'none'})});
    convert=tex=>adaptor.outerHTML(adaptor.firstChild(doc.convert(tex,{display:false})));
  }else{
    // Only controlled quantities use TeX; component names remain escaped UI text.
    root.MathJax={tex:{packages:['base']},svg:{fontCache:'none'},startup:{typeset:false},options:{enableMenu:false}};
    convert=tex=>root.MathJax.tex2svg(tex,{display:false}).querySelector('svg').outerHTML;
  }
  const api=factory(convert);api.ready=node?()=>Promise.resolve():()=>root.MathJax.startup.promise;
  if(node)module.exports=api;else root.CircuitMath=api;
})(globalThis,function(convert){
  'use strict';
  const cache=new Map(),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const units={'':'',A:'\\mathrm{A}','mA':'\\mathrm{mA}','μA':'\\mu\\mathrm{A}',V:'\\mathrm{V}',W:'\\mathrm{W}','Ω':'\\Omega','%':'\\%'};
  function number(v){if(!Number.isFinite(v))return '—';const a=Math.abs(v);return a>=10000||a>0&&a<.001?v.toExponential(2):String(Number(v.toPrecision(4)));}
  function numberTex(v){const n=number(v);if(n==='—')return '\\text{—}';const [mantissa,exponent]=n.split('e');return exponent===undefined?n:`${mantissa}\\times10^{${Number(exponent)}}`;}
  function unit(u){if(!Object.hasOwn(units,u))throw new Error('Unsupported physical unit');return {text:u,tex:units[u]};}
  function quantity(v,u=''){const symbol=unit(u);return {text:number(v)+(u?' '+u:''),tex:numberTex(v)+(u?'\\,'+symbol.tex:'')};}
  function assignment(symbol,v,u){if(!/^[EUIRPr]$/.test(symbol))throw new Error('Unsupported quantity symbol');const q=quantity(v,u);return{text:symbol+' = '+q.text,tex:symbol+'='+q.tex};}
  function join(parts){return{text:parts.map(p=>p.text).join(' · '),tex:parts.map(p=>p.tex).join('\\,\\cdot\\, '),parts};}
  function compiled(tex){
    if(cache.has(tex))return cache.get(tex);
    const svg=convert(tex);if(svg.includes('data-mml-node="merror"'))throw new Error('Invalid generated math');
    const box=svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number),markup=svg.slice(svg.indexOf('>')+1,svg.lastIndexOf('</svg>'));
    if(!box.every(Number.isFinite)||box[2]<=0||box[3]<=0||/<(?:use|image|foreignObject)\b|\b(?:href|id)=/.test(markup))throw new Error('Math must contain self-contained vector glyphs');
    const result={box,markup};if(cache.size>=512)cache.delete(cache.keys().next().value);cache.set(tex,result);return result;
  }
  function measure(tex,size){const{box}=compiled(tex);return{width:box[2]*size/1000,ascent:Math.max(0,-box[1])*size/1000,descent:Math.max(0,box[1]+box[3])*size/1000,height:box[3]*size/1000};}
  function svg(x,y,spec,size=14,attrs=''){
    const c=compiled(spec.tex),m=measure(spec.tex,size),anchor=attrs.match(/text-anchor="([^"]+)"/)?.[1]||'middle',offset=anchor==='start'?0:anchor==='end'?m.width:m.width/2,colour=attrs.match(/fill="([^"]+)"/)?.[1]||'#334155';
    return `<g data-math="${esc(spec.text)}" data-tex="${esc(spec.tex)}" role="img" aria-label="${esc(spec.text)}" font-size="${size}" color="${colour}" ${attrs} transform="translate(${x-offset} ${y}) scale(${size/1000})">${c.markup}</g>`;
  }
  function html(spec){const c=compiled(spec.tex),m=measure(spec.tex,1);return `<svg class="math-inline" xmlns="http://www.w3.org/2000/svg" data-math="${esc(spec.text)}" data-tex="${esc(spec.tex)}" role="img" aria-label="${esc(spec.text)}" width="${m.width}em" height="${m.height}em" viewBox="${c.box.join(' ')}" style="vertical-align:${-m.descent}em">${c.markup}</svg>`;}
  return{number,numberTex,unit,quantity,assignment,join,compiled,measure,svg,html};
});
