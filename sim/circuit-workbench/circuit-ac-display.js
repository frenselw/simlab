(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./circuit-renderer'):root.CircuitRenderer,typeof module==='object'&&module.exports?require('./circuit-math'):root.CircuitMath);if(typeof module==='object'&&module.exports)module.exports=api;else root.CircuitACDisplay=api;})(globalThis,function(V,Q){
 'use strict';
 const decimal=new Intl.NumberFormat('en',{useGrouping:false,minimumFractionDigits:2,maximumFractionDigits:2});
 function voltageReference(c,doc,result){
  return Math.max(1,Math.abs(c.params.initialVoltage||0),Math.abs(result?.components?.[c.id]?.voltagePeak||0),result?.measurements?.[c.id]?.voltageReference||0);
 }
 function visual(c,r,context={}){
  if(!r)return r;
  if(context.doc&&V.storedEnergyInvisible(context.doc,context.result,c.id+':a'))return {...r,current:0,voltage:0,fieldCurrent:0,fieldVoltage:0,charge:c.type==='capacitor'?0:r.charge,energy:0,polarity:Math.sign(c.type==='capacitor'?r.voltage:r.current)||Math.sign(c.params[c.type==='capacitor'?'initialVoltage':'initialCurrent'])||1};
  const current=context.doc?V.displayCurrent(context.doc,context.result,c.id+':a',r.current,context.references):Number.isFinite(r.currentPeak)&&r.currentPeak<1e-6&&Math.abs(r.current)<1e-6?0:r.current;
  const cutoff=voltageReference(c,context.doc,context.result)*1e-4,capacitorTail=c.type==='capacitor'&&current===0&&Number.isFinite(r.voltage)&&Math.abs(r.voltage)<cutoff&&Number.isFinite(r.voltagePeak)&&r.voltagePeak<cutoff;
  const voltage=capacitorTail||Number.isFinite(r.voltage)&&Math.abs(r.voltage)<1e-6&&Number.isFinite(r.voltagePeak)&&r.voltagePeak<1e-6?0:r.voltage;
  const energy=capacitorTail?0:V.displayEnergy(r.energy);
  return {...r,current,voltage,fieldCurrentReference:c.type==='inductor'?context.references?.get('field:'+c.id):undefined,fieldCurrent:c.type==='inductor'&&energy===0||Number.isFinite(current)&&Math.abs(current)<1e-6?0:current,fieldVoltage:c.type==='capacitor'&&energy===0||Number.isFinite(voltage)&&Math.abs(voltage)<1e-6?0:voltage,charge:c.type==='capacitor'&&voltage===0?0:r.charge,energy,polarity:Math.sign(c.type==='capacitor'?r.voltage:r.current)||Math.sign(c.params[c.type==='capacitor'?'initialVoltage':'initialCurrent'])||1};
 }
 function transformerVisual(c,r){if(!r)return r;const energy=V.displayEnergy(r.energy),quiet=c.params.model==='coupled'&&energy===0||Number.isFinite(r.coreFlux)&&Math.abs(r.coreFlux)<Math.max(1e-9,(r.coreFluxPeak||0)*1e-4);return {...r,energy,coreFlux:quiet?0:r.coreFlux};}
 function nice(value){const base=10**Math.floor(Math.log10(Math.max(value,1e-12)));return [1,2,5,10].find(n=>n*base>=value*(1-1e-12))*base;}
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 class Readouts {
  constructor(){this.states=new Map();}
  clear(){this.states.clear();}
  data(c,key,value,unit,{paused=true,now=performance.now(),result={},doc,label,preserveTiny=false}={}){
   const id=c.id+':'+key,signature=JSON.stringify(c.params),voltage=voltageReference(c,doc),current=Math.max(.1,Math.abs(c.params.initialCurrent||0),Math.abs(result.current||0),result.currentPeak||0);
   const flux=Math.abs((c.params.field||0)*(c.params.area||0)),emf=flux*(c.params.turns||0)*2*Math.PI*(c.params.frequency||0),phase=key==='phase';
   if(phase&&Number.isFinite(value))value=((value%360)+360)%360;
   const meterRange=result.range??c.params.range,galvanometerCurrent=c.type==='galvanometer'&&(key.toLowerCase().includes('current')||key.startsWith('meterReading'));
   const seed=(key.startsWith('meterReading')||galvanometerCurrent)&&Number.isFinite(meterRange)?meterRange:c.type==='transformer'&&key==='coreFlux'?Math.max(result.coreFluxPeak||0,Math.abs(result.coreFlux||0),.001):phase?360:c.type==='generator'&&key==='flux'?flux:c.type==='generator'&&key==='fluxLinkage'?flux*c.params.turns:c.type==='generator'&&['sourceEmf','voltage','voltageRms'].includes(key)?emf:key==='charge'?c.params.capacitance*voltage:key==='energy'?c.type==='capacitor'?.5*c.params.capacitance*voltage**2:.5*c.params.inductance*current**2:key.toLowerCase().includes('current')?current:voltage;
   let s=this.states.get(id);if(s?.signature!==signature)s=null;if(!s){const range=phase?360:nice(Math.max(seed||.01,Math.abs(value||0),1e-9)),engineering=Q.engineering(range,unit);s={signature,range,...engineering,text:'',stamp:-Infinity};this.states.set(id,s);}
   if(key==='coreFlux'&&Number.isFinite(result.coreFluxPeak)&&result.coreFluxPeak>s.range)s.range=nice(result.coreFluxPeak);
   if(Number.isFinite(value)&&Math.abs(value)>s.range)s.range=nice(Math.abs(value));
   const known=Number.isFinite(value),signed=!phase&&key!=='energy'&&!key.endsWith('Rms'),fraction=known?Math.min(1,Math.abs(value)/s.range):0,negative=known&&value<0;
   const format=n=>decimal.format(n*s.factor).replace(/^-0\.00$/,'0.00');
   if(paused||!known||value===0||now-s.stamp>=200){s.text=!known?'—':value!==0&&Number(format(value))===0?'≈0':format(paused?value:Math.abs(value));s.stamp=now;s.tiny=preserveTiny&&known&&value!==0&&Number(format(value))===0?Q.quantity(paused||!signed?value:Math.abs(value),unit):null;}
   const start=signed?negative?50-fraction*50:50:0,width=fraction*(signed?50:100),unitHtml=Q.html(Q.unit(s.unit)),max=format(s.range)+' '+unitHtml;
   return {key,value,known,signed,negative,start,width,min:signed?-s.range:0,max:s.range,label:label||'讀值',ariaText:s.tiny?s.tiny.text:s.text+' '+s.unit,valueHtml:(!paused&&signed&&known?'大小 ':'')+(s.tiny?Q.html(s.tiny):s.text+' '+unitHtml),scaleHtml:signed?'−'+max+'　0　＋'+max:'0　→　'+max};
  }
  html(c,key,value,unit,options){const d=this.data(c,key,value,unit,options);return '<div class="ac-value-indicator" data-readout-bar="'+escape(key)+'" data-readout-known="'+d.known+'" data-readout-value="'+(d.known?d.value:'')+'"><span class="ac-bar-value">'+d.valueHtml+'</span><div class="ac-bar-track '+(d.signed?'signed':'unsigned')+'" role="meter" aria-label="'+escape(d.label)+'" aria-valuemin="'+d.min+'" aria-valuemax="'+d.max+'"'+(d.known?' aria-valuenow="'+d.value+'"':'')+' aria-valuetext="'+d.ariaText+'"><span class="ac-bar-fill '+(d.negative?'negative':'positive')+'" style="left:'+d.start+'%;width:'+d.width+'%"></span></div><span class="ac-bar-scale">'+d.scaleHtml+'</span></div>';}
  update(node,c,key,value,unit,options){const d=this.data(c,key,value,unit,options),track=node.querySelector('.ac-bar-track'),fill=node.querySelector('.ac-bar-fill');
   node.dataset.readoutKnown=d.known;node.dataset.readoutValue=d.known?d.value:'';track.className='ac-bar-track '+(d.signed?'signed':'unsigned');
   for(const [key,value]of Object.entries({'aria-valuemin':d.min,'aria-valuemax':d.max,'aria-valuetext':d.ariaText}))track.setAttribute(key,value);
   if(d.known)track.setAttribute('aria-valuenow',d.value);else track.removeAttribute('aria-valuenow');
   fill.className='ac-bar-fill '+(d.negative?'negative':'positive');fill.style.left=d.start+'%';fill.style.width=d.width+'%';
   for(const [className,html]of [['value',d.valueHtml],['scale',d.scaleHtml]])if(node['_'+className+'Html']!==html){node.querySelector('.ac-bar-'+className).innerHTML=html;node['_'+className+'Html']=html;}
  }
 }
 return {visual,transformerVisual,Readouts};
});
