(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('../circuit-workbench/circuit-math.js'):root.CircuitMath);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.ProjectilePresentation=api;
})(globalThis,function(MathSvg){
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function format(n){if(!Number.isFinite(n))return '—';const rounded=n.toPrecision(5),numeric=Number(rounded);return Number.isFinite(numeric)?numeric.toString():rounded;}
  function number(n){const [mantissa,exponent]=format(n).split('e');return exponent===undefined?mantissa:`${mantissa}\\times10^{${Number(exponent)}}`;}
  const math=(tex,text=tex)=>MathSvg.html({tex,text});
  const unit=u=>({'m/s²':'\\mathrm{m}\\,\\mathrm{s}^{-2}','m/s':'\\mathrm{m}\\,\\mathrm{s}^{-1}','m⁻¹':'\\mathrm{m}^{-1}','%':'\\%'}[u]||`\\mathrm{${u}}`);
  function prose(text){
    const tokens=/y = ½gt²|x–t|y–t|g\/2|P[1-6₁₂₃₄₅₆]|-?\d+(?:\.\d+)?\s*(?:m\/s²|m\/s|cm|mm|m⁻¹|%|m|s)(?![A-Za-z])|m\/s²|m\/s|m⁻¹|cm|mm|\b[xyOtgvkn]\b|\b[ms]\b/g;
    let result='',at=0;
    for(const match of String(text).matchAll(tokens)){
      const token=match[0];let tex=token;
      if(token==='y = ½gt²')tex='y=\\frac12gt^2';
      else if(token==='g/2')tex='\\frac{g}{2}';
      else if(token==='x–t'||token==='y–t')tex=token[0]+'\\! -\\! t';
      else if(token.startsWith('P'))tex='P_{'+('₁₂₃₄₅₆'.includes(token[1])?'₁₂₃₄₅₆'.indexOf(token[1])+1:token[1])+'}';
      else {const quantity=token.match(/^(-?\d+(?:\.\d+)?)\s*(.+)$/);if(quantity)tex=quantity[1]+'\\,'+unit(quantity[2]);else if(['m/s²','m/s','m⁻¹','cm','mm','m','s'].includes(token))tex=unit(token);}
      result+=escape(String(text).slice(at,match.index))+math(tex,token);at=match.index+token.length;
    }
    return result+escape(String(text).slice(at));
  }
  return{escape,format,number,math,unit,prose};
});
