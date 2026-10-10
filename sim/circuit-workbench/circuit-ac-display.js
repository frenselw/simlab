(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./circuit-renderer'):root.CircuitRenderer,typeof module==='object'&&module.exports?require('./circuit-math'):root.CircuitMath);if(typeof module==='object'&&module.exports)module.exports=api;else root.CircuitACDisplay=api;})(globalThis,function(V,Q){
 'use strict';
 const decimal=new Intl.NumberFormat('en',{useGrouping:false,minimumFractionDigits:2,maximumFractionDigits:2});
 function voltageReference(c,doc){return Math.max(1,Math.abs(c.params.initialVoltage||0),...(doc?.components||[]).filter(c=>['battery','ac-source'].includes(c.type)).map(c=>Math.abs(c.params.voltage||0)*(c.type==='ac-source'?Math.SQRT2:1)));}
 function visual(c,r,context={}){
  if(!r)return r;
  if(context.doc&&V.storedEnergyInvisible(context.doc,context.result,c.id+':a'))return {...r,current:0,voltage:0,fieldCurrent:0,fieldVoltage:0,charge:c.type==='capacitor'?0:r.charge,energy:0,polarity:Math.sign(c.type==='capacitor'?r.voltage:r.current)||Math.sign(c.params[c.type==='capacitor'?'initialVoltage':'initialCurrent'])||1};
  const current=context.doc?V.displayCurrent(context.doc,context.result,c.id+':a',r.current,context.references):Number.isFinite(r.currentPeak)&&r.currentPeak<1e-6&&Math.abs(r.current)<1e-6?0:r.current;
  const cutoff=voltageReference(c,context.doc)*1e-4,capacitorTail=c.type==='capacitor'&&current===0&&Number.isFinite(r.voltage)&&Math.abs(r.voltage)<cutoff&&Number.isFinite(r.voltagePeak)&&r.voltagePeak<cutoff;
  const voltage=capacitorTail||Number.isFinite(r.voltage)&&Math.abs(r.voltage)<1e-6&&Number.isFinite(r.voltagePeak)&&r.voltagePeak<1e-6?0:r.voltage;
  const energy=capacitorTail?0:V.displayEnergy(r.energy);
  return {...r,current,voltage,fieldCurrent:c.type==='inductor'&&energy===0||Number.isFinite(current)&&Math.abs(current)<1e-6?0:current,fieldVoltage:c.type==='capacitor'&&energy===0||Number.isFinite(voltage)&&Math.abs(voltage)<1e-6?0:voltage,charge:c.type==='capacitor'&&voltage===0?0:r.charge,energy,polarity:Math.sign(c.type==='capacitor'?r.voltage:r.current)||Math.sign(c.params[c.type==='capacitor'?'initialVoltage':'initialCurrent'])||1};
 }
 function nice(value){const base=10**Math.floor(Math.log10(Math.max(value,1e-12)));return [1,2,5,10].find(n=>n*base>=value*(1-1e-12))*base;}
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 class Readouts {
  constructor(){this.states=new Map();}
  clear(){this.states.clear();}
  html(c,key,value,unit,{paused=true,now=performance.now(),result={},doc,label}={}){
   const id=c.id+':'+key,signature=JSON.stringify(c.params),voltage=voltageReference(c,doc),current=Math.max(.1,Math.abs(c.params.initialCurrent||0),Math.abs(result.current||0),result.currentPeak||0);
   const flux=Math.abs((c.params.field||0)*(c.params.area||0)),emf=flux*(c.params.turns||0)*2*Math.PI*(c.params.frequency||0),phase=key==='phase';
   if(phase&&Number.isFinite(value))value=((value%360)+360)%360;
   const seed=phase?360:c.type==='generator'&&key==='flux'?flux:c.type==='generator'&&key==='fluxLinkage'?flux*c.params.turns:c.type==='generator'&&['sourceEmf','voltage','voltageRms'].includes(key)?emf:key==='charge'?c.params.capacitance*voltage:key==='energy'?c.type==='capacitor'?.5*c.params.capacitance*voltage**2:.5*c.params.inductance*current**2:key.toLowerCase().includes('current')?current:voltage;
   let s=this.states.get(id);if(s?.signature!==signature)s=null;if(!s){const range=phase?360:nice(Math.max(seed||.01,Math.abs(value||0),1e-9)),engineering=Q.engineering(range,unit);s={signature,range,...engineering,text:'',stamp:-Infinity};this.states.set(id,s);}
   if(Number.isFinite(value)&&Math.abs(value)>s.range)s.range=nice(Math.abs(value));
   const known=Number.isFinite(value),signed=!phase&&key!=='energy'&&!key.endsWith('Rms'),fraction=known?Math.min(1,Math.abs(value)/s.range):0,negative=known&&value<0;
   const format=n=>decimal.format(n*s.factor).replace(/^-0\.00$/,'0.00');
   if(paused||!known||value===0||now-s.stamp>=200){s.text=!known?'—':value!==0&&Number(format(value))===0?'≈0':format(paused?value:Math.abs(value));s.stamp=now;}
   const start=signed?negative?50-fraction*50:50:0,width=fraction*(signed?50:100),unitHtml=Q.html(Q.unit(s.unit)),max=format(s.range)+' '+unitHtml;
   return '<div class="ac-value-indicator" data-readout-bar="'+escape(key)+'" data-readout-known="'+known+'" data-readout-value="'+(known?value:'')+'"><span class="ac-bar-value">'+(!paused&&signed&&known?'大小 ':'')+s.text+' '+unitHtml+'</span><div class="ac-bar-track '+(signed?'signed':'unsigned')+'" role="meter" aria-label="'+escape(label||({current:'線圈電流',voltage:'電壓',charge:'電荷',energy:'儲能',selfEmf:'自感電動勢'}[key]||'讀值'))+'" aria-valuemin="'+(signed?-s.range:0)+'" aria-valuemax="'+s.range+'"'+(known?' aria-valuenow="'+value+'"':'')+' aria-valuetext="'+s.text+' '+s.unit+'"><span class="ac-bar-fill '+(negative?'negative':'positive')+'" style="left:'+start+'%;width:'+width+'%"></span></div><span class="ac-bar-scale">'+(signed?'−'+max+'　0　＋'+max:'0　→　'+max)+'</span></div>';
  }
 }
 return {visual,Readouts};
});
