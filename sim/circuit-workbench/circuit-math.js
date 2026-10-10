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
  const units={'':'',A:'\\mathrm{A}','mA':'\\mathrm{mA}','μA':'\\mu\\mathrm{A}',V:'\\mathrm{V}',ms:'\\mathrm{ms}',W:'\\mathrm{W}','Ω':'\\Omega','%':'\\%',s:'\\mathrm{s}',Hz:'\\mathrm{Hz}',H:'\\mathrm{H}',F:'\\mathrm{F}','μF':'\\mu\\mathrm{F}',T:'\\mathrm{T}','m²':'\\mathrm{m}^{2}','°':'{}^{\\circ}',C:'\\mathrm{C}',J:'\\mathrm{J}',Wb:'\\mathrm{Wb}'};
  const symbols={Iplus:'I_{+}',Iminus:'I_{-}',Vplus:'V_{+}',Vminus:'V_{-}',U:'U',I:'I',R:'R',r:'r',P:'P',E:'E',C:'C',L:'L',f:'f',N:'N',B:'B',S:'S',q:'q',k:'k',t:'t',theta:'\\theta',theta0:'\\theta_0',phi0:'\\varphi_0',Phi:'\\Phi',NPhi:'N\\Phi',e:'e',eL:'e_L',n:'\\hat{\\mathbf{n}}',U0:'U_0',I0:'I_0',U1:'U_1',U2:'U_2',I1:'I_1',I2:'I_2',N1:'N_1',N2:'N_2',R1:'R_1',R2:'R_2',L1:'L_1',I10:'I_{1,0}',I20:'I_{2,0}',Urms:'U_{\\mathrm{rms}}',Irms:'I_{\\mathrm{rms}}',erms:'e_{\\mathrm{rms}}',Pavg:'\\overline{P}',WC:'W_C',WL:'W_L',tau:'\\tau',omega:'\\omega'};
  const formulas={fluxFormula:'\\Phi=BS\\cos\\theta',emfFormula:'e=NBS\\omega\\sin\\theta',transformerRatio:'\\frac{U_1}{U_2}=\\frac{N_1}{N_2}',sqrt2:'\\sqrt{2}',sqrt3:'\\sqrt{3}'};
  const labelSymbols={'電阻':['電阻','R'],'電動勢':['電動勢','E'],'電阻／額定熱態電阻':['電阻／額定熱態電阻','R'],'額定電壓':['額定電壓','U0'],'額定功率':['額定功率','P'],'吸收功率':['吸收功率','P'],'工作電阻':['工作電阻','R'],'耦合磁場儲能':['耦合磁場儲能','WL'],'正向壓降':['正向壓降','U'],'導通電阻':['導通電阻','R'],'最大電阻':['最大電阻','R'],'角度 θ':['角度','theta'],'線圈角度':['線圈角度','theta'],'初始角度':['初始角度','theta0'],'初相位':['初相位','phi0'],'磁場 B':['磁場','B'],'磁感應強度':['磁感應強度','B'],'单匝 Φ':['單匝','Phi'],'單匝 Φ':['單匝','Phi'],'單匝磁通量':['單匝磁通量','Phi'],'磁通鏈 NΦ':['磁通鏈','NPhi'],'磁通鏈':['磁通鏈','NPhi'],'電動勢 e':['電動勢','e'],'感應電動勢':['感應電動勢','e'],'自感電動勢':['自感電動勢','eL'],'電壓':['電壓','U'],'瞬時電壓':['瞬時電壓','U'],'兩端電壓':['兩端電壓','U'],'電荷':['電荷','q'],'極板電荷':['極板電荷','q'],'線圈電流':['線圈電流','I'],'瞬時電流（a → b）':['瞬時電流（a → b）','I'],'電場儲能':['電場儲能','WC'],'磁場儲能':['磁場儲能','WL'],'電感':['電感','L'],'自感系數':['自感系數','L'],'電容':['電容','C'],'頻率':['頻率','f'],'轉動頻率':['轉動頻率','f'],'線圈匝數':['線圈匝數','N'],'線圈面積':['線圈面積','S'],'內阻':['內阻','r'],'線圈電阻':['線圈電阻','R'],'初始電壓':['初始電壓','U0'],'初始電流':['初始電流','I0'],'電動勢有效值':['電動勢有效值','erms'],'電壓有效值':['電壓有效值','Urms'],'電流有效值':['電流有效值','Irms'],'平均有功功率':['平均有功功率','Pavg'],'原線圈平均輸入功率':['原線圈平均輸入功率','Pavg'],'原線圈匝數':['原線圈匝數','N1'],'副線圈匝數':['副線圈匝數','N2'],'原線圈電感':['原線圈電感','L1'],'耦合係數':['耦合係數','k'],'原線圈電阻':['原線圈電阻','R1'],'副線圈電阻':['副線圈電阻','R2'],'原線圈初始電流':['原線圈初始電流','I10'],'副線圈初始電流':['副線圈初始電流','I20'],'副線圈瞬時電壓':['副線圈瞬時電壓','U2'],'副線圈瞬時電流':['副線圈瞬時電流','I2'],'副線圈電流':['副線圈電流','I2']};
  function symbol(key){if(!Object.hasOwn(symbols,key)&&!Object.hasOwn(formulas,key))throw new Error('Unsupported physics symbol');return{text:({Iplus:'I₊',Iminus:'I₋',Vplus:'V₊',Vminus:'V₋',fluxFormula:'Φ = BS cos θ',emfFormula:'e = NBS ω sin θ',transformerRatio:'U₁/U₂ = N₁/N₂',sqrt2:'√2',sqrt3:'√3',theta:'θ',theta0:'θ₀',phi0:'φ₀',Phi:'Φ',NPhi:'NΦ',n:'法線 n',Urms:'U（有效值）',Irms:'I（有效值）',WC:'W（電場）',WL:'W（磁場）'}[key]||key),tex:symbols[key]||formulas[key]};}
  function labelParts(label){const p=labelSymbols[label];return p?[p[0],symbol(p[1])]:[label];}
  function labelHtml(label){return '<span class="quantity-label">'+labelParts(label).map(p=>typeof p==='string'?esc(p):html(p)).join('')+'</span>';}
  function proseParts(text){const re=/\[\[([A-Za-z_0-9]+)\]\]|(-?\d+(?:\.\d+)?)\s+(Wb|Hz|m²|Ω|[AVWHFCJTs])(?![A-Za-z])/g,parts=[];let at=0;for(const m of text.matchAll(re)){parts.push(text.slice(at,m.index),m[1]?symbol(m[1]):quantity(Number(m[2]),m[3]));at=m.index+m[0].length;}parts.push(text.slice(at));return parts;}
  const prose=text=>proseParts(text).map(p=>typeof p==='string'?esc(p):html(p)).join('');
  function number(v){if(!Number.isFinite(v))return '—';const a=Math.abs(v);return a>=10000||a>0&&a<.001?v.toExponential(2):String(Number(v.toPrecision(4)));}
  function numberTex(v){const n=number(v);if(n==='—')return '\\text{—}';const [mantissa,exponent]=n.split('e');return exponent===undefined?n:`${mantissa}\\times10^{${Number(exponent)}}`;}
  function unit(u){if(Object.hasOwn(units,u))return{text:u,tex:units[u]};const p=u.match(/^([pnμmkMGT])([AVWCJHF]|Wb|Hz|s|Ω)$/);if(!p)throw new Error('Unsupported physical unit');return{text:u,tex:p[1]==='μ'?'\\mu'+units[p[2]]:p[2]==='Ω'?'\\mathrm{'+p[1]+'}\\Omega':'\\mathrm{'+u+'}'};}
  function engineering(value,u){if(u==='°'||!Number.isFinite(value)||value===0)return{factor:1,unit:u};const exponent=Math.max(-12,Math.min(12,Math.floor(Math.log10(Math.abs(value))/3)*3)),prefix={'-12':'p','-9':'n','-6':'μ','-3':'m',0:'',3:'k',6:'M',9:'G',12:'T'}[exponent];return{factor:10**(-exponent),unit:prefix+u};}
  function quantity(v,u=''){const symbol=unit(u);return {text:number(v)+(u?' '+u:''),tex:numberTex(v)+(u?'\\,'+symbol.tex:'')};}
  function assignment(key,v,u){const s=symbol(key),q=quantity(v,u);return{text:s.text+' = '+q.text,tex:s.tex+'='+q.tex};}
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
  const canvasCache=new Map();
  function canvas(ctx,x,y,spec,size=11,anchor='start'){
    let commands=canvasCache.get(spec.tex);
    if(!commands){const holder=document.createElementNS('http://www.w3.org/2000/svg','svg');holder.innerHTML=compiled(spec.tex).markup;commands=[];const walk=(e,matrix)=>{const local=e.transform?.baseVal.consolidate()?.matrix,next=local?matrix.multiply(new DOMMatrix([local.a,local.b,local.c,local.d,local.e,local.f])):matrix;if(e.localName==='path')commands.push({matrix:next,path:new Path2D(e.getAttribute('d'))});else if(e.localName==='rect')commands.push({matrix:next,rect:['x','y','width','height'].map(k=>Number(e.getAttribute(k)||0))});for(const child of e.children)walk(child,next);};for(const e of holder.children)walk(e,new DOMMatrix());if(canvasCache.size>=256)canvasCache.delete(canvasCache.keys().next().value);canvasCache.set(spec.tex,commands);}
    const width=measure(spec.tex,size).width;ctx.save();ctx.translate(x-(anchor==='end'?width:anchor==='middle'?width/2:0),y);ctx.scale(size/1000,size/1000);for(const c of commands){ctx.save();const m=c.matrix;ctx.transform(m.a,m.b,m.c,m.d,m.e,m.f);if(c.path)ctx.fill(c.path);else ctx.fillRect(...c.rect);ctx.restore();}ctx.restore();
  }
  return{number,numberTex,unit,engineering,symbol,labelParts,labelHtml,proseParts,prose,quantity,assignment,join,compiled,measure,svg,html,canvas};
});
