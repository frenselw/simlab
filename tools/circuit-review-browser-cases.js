'use strict';
const assert=require('node:assert/strict'),M=require('../sim/circuit-workbench/circuit-model'),P=require('../sim/circuit-workbench/presets');
async function reviewCases(h,mode,base,{zeroOnly=false,followupOnly=false,boundaryOnly=false}={}){
  let width,touchId=125000;
  const control=id=>`[data-circuit-id="${id}"]`,evidence=(kind,data={})=>h.evidence.push({mode,width,audit:kind,...data});
  async function contact(p,to=p){
    const mobile=width<600,id=touchId++;
    await h.send(mobile?'Input.dispatchTouchEvent':'Input.dispatchMouseEvent',mobile?{type:'touchStart',touchPoints:[{...p,id,radiusX:2,radiusY:2,force:1}]}:{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});
    if(p.x!==to.x||p.y!==to.y)for(let i=1;i<=6;i++){
      const q={x:p.x+(to.x-p.x)*i/6,y:p.y+(to.y-p.y)*i/6};
      await h.send(mobile?'Input.dispatchTouchEvent':'Input.dispatchMouseEvent',mobile?{type:'touchMove',touchPoints:[{...q,id,radiusX:2,radiusY:2,force:1}]}:{type:'mouseMoved',...q,button:'left',buttons:1});
    }
    await h.send(mobile?'Input.dispatchTouchEvent':'Input.dispatchMouseEvent',mobile?{type:'touchEnd',touchPoints:[]}:{type:'mouseReleased',...to,button:'left',buttons:0,clickCount:1});await h.delay(70);
  }
  const tap=async selector=>contact(await h.point(selector));
  async function mount(config){await h.inside(`(async()=>{CircuitWorkbench.destroy();window.CircuitWorkbench=await CircuitEditor.mount(document.getElementById('app'),${JSON.stringify(config)});})()`);await h.delay(90);}
  async function openPanel(){if(await h.inside(`document.querySelector('${control('panelToggle')}').getAttribute('aria-expanded')==='false'`))await tap(control('panelToggle'));}
  // CDP on this headless macOS browser does not operate the native select popup.
  // Exercise the actual DOM select/change handler; pointer actions below stay trusted.
  async function choice(key,direction){const selector=`${control('properties')} select[data-param="${key}"]`;await h.point(selector);await h.inside(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});input.selectedIndex+=${direction==='ArrowUp'?-1:1};input.dispatchEvent(new Event('change',{bubbles:true}));})()`);await h.delay(40);}
  async function visible(id){return h.inside(`(()=>{const c=CircuitWorkbench.getDocument().components.find(c=>c.id===${JSON.stringify(id)}),camera=CircuitWorkbench.getInteraction().camera,r=document.querySelector('${control('surface')}').getBoundingClientRect();return c.x>=camera.x&&c.y>=camera.y&&c.x<=camera.x+r.width/camera.scale&&c.y<=camera.y+r.height/camera.scale;})()`);}
  async function selectedBody(id){
    const point=await h.inside(`(()=>{const e=document.querySelector('[data-hit="body:${id}"]'),r=e.getBoundingClientRect();for(const x of [.5,.2,.8])for(const y of [.5,.2,.8]){const p={x:r.left+r.width*x,y:r.top+r.height*y};if(document.elementFromPoint(p.x,p.y)===e)return p;}throw new Error('No exposed body ${id}');})()`);
    await contact(point);assert.equal(await h.inside('CircuitWorkbench.getInteraction().selection?.id'),id);
  }
  async function balancedZero(){
    await h.load(P.create('bridge'));assert.equal(await h.inside('CircuitWorkbench.getAnalysis().components.c6.reading'),0);
    assert(await h.inside(`Boolean(document.querySelector('[data-label-block="c6"] [data-component-value="c6"][data-math="0 A"]'))`));
    assert(!await h.inside(`document.querySelector('[data-label-block="c6"]').innerHTML.includes('e-17')`));evidence('balanced-meter-zero',{renderedZero:true});
  }
  async function tinyWireDirection(){
    const d=M.empty(),source=M.add(d,'battery',0,0,{voltage:6}),load=M.add(d,'resistor',200,0,{resistance:.01}),meter=M.add(d,'voltmeter',400,0,{resistance:1e12});
    for(const c of [load,meter])for(const p of ['a','b'])M.connect(d,source.id+':'+p,c.id+':'+p);
    await h.load(d);const before=await h.inside('CircuitWorkbench.getAnalysis()');
    assert(Math.abs(before.components[meter.id].current-6e-12)<1e-25);
    for(const w of d.wires.slice(2))assert(Math.abs(before.wires[w.id].current-(w.to.endsWith(':a')?6e-12:-6e-12))<1e-25);
    for(const w of d.wires)[w.from,w.to]=[w.to,w.from];
    await h.load(d);const saved=await h.save();await h.inside(`CircuitWorkbench.loadDocument(${JSON.stringify(saved)})`);
    const after=await h.inside('CircuitWorkbench.getAnalysis()');
    for(const w of d.wires)assert(Math.abs(after.wires[w.id].current+before.wires[w.id].current)<1e-25);
    evidence('tiny-wire-direction',{meterCurrent:after.components[meter.id].current,storedDirectionOnlyChangesSign:true,restored:true});
  }
  async function registryCommand(){
    const d=await h.inside(`(()=>{CircuitRegistry.register('review-terminals',{name:'自訂元件',icon:'R',ports:CircuitRegistry.get('resistor').ports,params:{terminals:{label:'自訂數字',value:2,choices:[2,3]}},dc:c=>[{from:'a',to:'b',kind:'resistor',resistance:12}]});const d=CircuitModel.empty();CircuitModel.add(d,'review-terminals',300,220);return d;})()`);
    await mount({role:'teacher',initialDocument:d});
    assert(await h.inside(`CircuitWorkbench.execute({type:'setParam',id:'c1',key:'terminals',value:3})`));
    assert.equal((await h.doc()).components[0].params.terminals,3);const saved=await h.save();await h.inside(`CircuitWorkbench.loadDocument(${JSON.stringify(saved)})`);
    assert.equal(await h.inside(`CircuitWorkbench.execute({type:'setParam',id:'c1',key:'terminals',value:4})`),false);assert.equal(await h.save(),saved);
    assert(await h.inside(`CircuitWorkbench.execute({type:'setParam',id:'c1',key:'terminals',value:2})`));
    assert.equal((await h.doc()).components[0].params.terminals,2);evidence('custom-terminals-command',{restoredContinuation:true,invalidAtomic:true});
  }
  async function nearLimitBend(){
    const d=M.empty(),c=M.add(d,'resistor',200,200),w=M.addWire(d,200,200);M.attach(d,w.id,'from',c.id+':b');
    Object.assign(d.junctions.find(j=>j.id+':p'===w.to),{x:860.01,y:200});w.via=[];
    await mount({role:'teacher',initialDocument:d});const before=await h.save(),p=await h.point('[data-hit="wire:w1:0"]');await contact(p,{x:p.x,y:p.y+30});
    assert.equal(await h.save(),before);assert.equal(await h.inside('CircuitWorkbench.getInteraction().dragging'),null);
    const rotated=M.clone(d);M.moveWireEnd(rotated,w.id,'to',{x:800,y:265});await h.load(rotated);const saved=await h.save();
    assert.equal(await h.inside(`CircuitWorkbench.execute({type:'rotate',id:'c1'})`),false);assert.equal(await h.save(),saved);
    M.moveWireEnd(rotated,w.id,'to',{x:760,y:200});await h.load(rotated);const q=await h.point('[data-hit="wire:w1:0"]');await contact(q,{x:q.x,y:q.y+30});
    assert((await h.doc()).wires[0].via.length>0);evidence('near-limit-cable-bend',{trusted:true,importSafe:true,rotationAtomic:true,continuedBend:true});
  }
  async function finiteMeterNull(){
    for(const resistance of [0,1e6])for(const positive of ['a','c']){
      const d=M.empty(),a=M.add(d,'battery',0,0,{voltage:6}),b=M.add(d,'battery',0,200,{voltage:9}),v=M.add(d,'voltmeter',300,0,{resistance});
      for(const p of ['a','b'])M.connect(d,a.id+':'+p,b.id+':'+p);
      M.connect(d,a.id+':a',v.id+':'+positive);M.connect(d,a.id+':b',v.id+':b');await mount({role:'teacher',initialDocument:d});
      assert.equal(await h.inside('CircuitWorkbench.getAnalysis().components.c3.current'),resistance===0?0:null);
      await selectedBody('c3');await openPanel();
      assert.equal(await h.inside(`(()=>{const dt=[...document.querySelectorAll('${control('properties')} dt')].find(e=>e.textContent.includes('電流'));return dt.nextElementSibling.querySelector('[data-math]').getAttribute('data-math');})()`),resistance===0?'0 A':'— A');
      const saved=await h.save();await h.inside(`CircuitWorkbench.loadDocument(${JSON.stringify(saved)})`);
      assert(await h.inside(`CircuitWorkbench.execute({type:'setParam',id:'c2',key:'voltage',value:6})`));assert.equal(await h.inside('CircuitWorkbench.getAnalysis().components.c3.reading'),6);
    }
    evidence('finite-meter-unknown',{bothRanges:true,idealZeroPreserved:true,renderedUnknown:true,restoredContinuation:true});
  }
  async function boundedSlider(){
    const d=await h.inside(`(()=>{CircuitRegistry.register('review-bounds',{name:'自訂電阻',icon:'R',ports:CircuitRegistry.get('resistor').ports,params:{resistance:{label:'Resistance',unit:'Ω',value:5,min:1,max:10,step:1}},dc:c=>[{from:'a',to:'b',kind:'resistor',resistance:c.params.resistance}]});const d=CircuitModel.empty();CircuitModel.add(d,'review-bounds',300,220);return d;})()`);
    await mount({role:'teacher',initialDocument:d});await selectedBody('c1');await openPanel();
    const selector=`${control('properties')} input[type=range][aria-label="Resistance滑塊"]`;
    assert.deepEqual(await h.inside(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return [+e.min,+e.max];})()`),[1,10]);
    async function pull(to){await h.point(selector);const points=await h.inside(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),f=(+e.value-e.min)/(e.max-e.min);return [{x:r.left+10+(r.width-20)*f,y:r.top+r.height/2},{x:r.left+${to==='max'?'r.width-2':'2'},y:r.top+r.height/2}];})()`);await contact(...points);}
    await pull('max');assert.equal((await h.doc()).components[0].params.resistance,10);const saved=await h.save();
    await pull('min');assert.equal((await h.doc()).components[0].params.resistance,1);await tap(control('undo'));assert.equal(await h.save(),saved);
    await h.inside(`CircuitWorkbench.loadDocument(${JSON.stringify(saved)})`);await selectedBody('c1');await pull('min');assert.equal((await h.doc()).components[0].params.resistance,1);
    const high=await h.inside(`(()=>{CircuitRegistry.register('review-high-bounds',{name:'自訂高阻',icon:'R',ports:CircuitRegistry.get('resistor').ports,params:{resistance:{label:'Resistance',unit:'Ω',value:205,min:200,max:210,step:1}},dc:c=>[{from:'a',to:'b',kind:'resistor',resistance:c.params.resistance}]});const d=CircuitModel.empty();CircuitModel.add(d,'review-high-bounds',300,220);return d;})()`);
    await mount({role:'teacher',initialDocument:high});await selectedBody('c1');await openPanel();assert.deepEqual(await h.inside(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return [+e.min,+e.max];})()`),[200,210]);
    evidence('registry-slider-bounds',{trusted:true,bothEnds:true,highMinimum:true,undo:true,restoredContinuation:true});
  }
  async function tidyLimit(){
    const d=M.empty(),c=M.add(d,'resistor',200,200),w=M.addWire(d,200,200);M.attach(d,w.id,'from',c.id+':b');Object.assign(d.junctions.find(j=>j.id+':p'===w.to),{x:440,y:200});w.via=[];w.length=179.99;
    await mount({role:'teacher',initialDocument:d});await tap('[data-hit="wire:w1:0"]');await openPanel();const saved=await h.save();await tap('[data-action="整理線形"]');
    assert.equal(await h.save(),saved);assert((await h.inside('CircuitWorkbench.getInteraction().lastMessage')).includes('導線已拉盡'));
    M.moveWireEnd(d,w.id,'to',{x:400,y:200});await h.load(d);await tap('[data-hit="wire:w1:0"]');await tap('[data-action="整理線形"]');assert((await h.doc()).wires[0].via.length>0);
    evidence('tidy-near-limit',{trusted:true,limitedMessage:true,atomic:true,continued:true});
  }
  async function sliderBoundary(){
    for(const [key,min,max,unit]of [['resistance',100,200,'Ω'],['voltage',24,48,'V']]){
      const d=await h.inside(`(()=>{CircuitRegistry.register('review-boundary-${key}',{name:'邊界元件',icon:'R',ports:CircuitRegistry.get('resistor').ports,params:{${key}:{label:'Boundary',unit:${JSON.stringify(unit)},value:${min},min:${min},max:${max},step:1}},dc:c=>[${key==='resistance'?"{from:'a',to:'b',kind:'resistor',resistance:c.params.resistance}":"{from:'a',to:'b',kind:'branch',resistance:1,emf:c.params.voltage}"}]});const d=CircuitModel.empty();CircuitModel.add(d,'review-boundary-${key}',300,220);return d;})()`);
      await mount({role:'teacher',initialDocument:d});await selectedBody('c1');await openPanel();
      const selector=`${control('properties')} input[type=range][aria-label="Boundary滑塊"]`;
      assert.deepEqual(await h.inside(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return [+e.min,+e.max,+e.value];})()`),[min,max,min]);
      const rect=await h.point(selector);await contact({x:rect.x-rect.width/2+10,y:rect.y},{x:rect.x+rect.width/2-2,y:rect.y});assert.equal((await h.doc()).components[0].params[key],max);
      const saved=await h.save();await h.inside(`CircuitWorkbench.loadDocument(${JSON.stringify(saved)})`);await selectedBody('c1');const r=await h.point(selector);
      await contact({x:r.x+r.width/2-10,y:r.y},{x:r.x-r.width/2+2,y:r.y});assert.equal((await h.doc()).components[0].params[key],min);await tap(control('undo'));assert.equal(await h.save(),saved);
    }
    evidence('slider-equal-preferred-boundary',{trusted:true,resistance100:true,voltage24:true,restoredContinuation:true,undo:true});
  }
  for(width of [1280,390]){
    console.log(`${mode}: audit regressions ${width}`);await h.freshPage();h.setContext('window');
    await h.send('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:800,deviceScaleFactor:1,mobile:width<600});await h.send('Emulation.setTouchEmulationEnabled',{enabled:width<600,maxTouchPoints:2});
    await h.send('Page.navigate',{url:base+'/circuit-workbench/index.html'});await h.ready();
    if(boundaryOnly){await sliderBoundary();await h.screenshot(`${mode}-audit-boundary-${width}.png`);continue;}
    if(followupOnly){await finiteMeterNull();await boundedSlider();await tidyLimit();await h.screenshot(`${mode}-audit-followup-${width}.png`);continue;}
    if(zeroOnly){await tinyWireDirection();await registryCommand();await nearLimitBend();await balancedZero();await h.screenshot(`${mode}-audit-zero-${width}.png`);continue;}

    const rheostat=M.empty(),r=M.add(rheostat,'rheostat',300,220,{terminals:4}),w=M.addWire(rheostat,500,320);M.attach(rheostat,w.id,'from',r.id+':a');await h.load(rheostat);
    await selectedBody(r.id);await openPanel();assert(await h.inside(`CircuitWorkbench.execute({type:'setParam',id:'c1',key:'terminals',value:2})`));
    const routeMatches=()=>h.inside(`(()=>{const d=CircuitWorkbench.getDocument(),w=d.wires[0],path=CircuitRouting.path(CircuitRouting.route(d,w));return document.querySelector('[data-wire="'+w.id+'"]').getAttribute('d')===path;})()`);
    assert(await routeMatches());await choice('terminals','ArrowUp');assert.equal((await h.doc()).components[0].params.terminals,3);assert(await routeMatches());
    await tap(control('undo'));assert.equal((await h.doc()).components[0].params.terminals,2);assert(await routeMatches());evidence('terminal-route-cache',{inspectorSelect:true,history:true});

    const far=M.empty();M.add(far,'lamp',5000,200);await h.load(far);assert(await h.inside(`CircuitWorkbench.execute({type:'move',id:'c1',x:0,y:200})`));assert(await visible('c1'));
    await tap(control('undo'));assert.equal((await h.doc()).components[0].x,5000);assert(await visible('c1'));assert.equal(await h.inside(`document.querySelector('${control('fitView')}').getAttribute('aria-pressed')`),'true');
    await tap(control('redo'));assert.equal((await h.doc()).components[0].x,0);assert(await visible('c1'));await tap('[data-camera=out]');
    const manual=await h.inside('CircuitWorkbench.getInteraction().camera');await tap(control('undo'));assert.deepEqual(await h.inside('CircuitWorkbench.getInteraction().camera'),manual);evidence('history-full-view',{automatic:true,manualPreserved:true});

    const choiceDoc=await h.inside(`(()=>{CircuitRegistry.register('review-choice',{name:'選項元件',icon:'R',ports:CircuitRegistry.get('resistor').ports,params:{setting:{label:'數字選項',value:1,choices:[1,2]},enabled:{label:'布林選項',value:false,choices:[false,true]},variant:{label:'文字選項',value:'alpha',choices:['alpha','beta']},mixed:{label:'混合選項',value:1,choices:[1,'1']}},dc:c=>[{from:'a',to:'b',kind:'resistor',resistance:c.params.setting*10}]});const d=CircuitModel.empty();CircuitModel.add(d,'review-choice',300,220);return d;})()`);
    await mount({role:'teacher',initialDocument:choiceDoc});await selectedBody('c1');await openPanel();
    assert.deepEqual(await h.inside(`[...document.querySelectorAll('${control('properties')} select[data-param=setting] option')].map(o=>o.textContent)`),['1','2']);
    for(const key of ['setting','enabled','variant','mixed'])await choice(key,'ArrowDown');
    assert.deepEqual((await h.doc()).components[0].params,{setting:2,enabled:true,variant:'beta',mixed:'1'});const choicesSaved=await h.save();await h.inside(`CircuitWorkbench.loadDocument(${JSON.stringify(choicesSaved)})`);assert.equal(await h.save(),choicesSaved);evidence('typed-registry-choices',{numeric:true,boolean:true,string:true,sameTextDifferentType:true});

    const student=M.empty();M.add(student,'battery',300,200);student.display.values=false;
    await mount({initialDocument:student,ui:{readings:false}});await openPanel();await tap('[data-hit="port:c1:a"]');assert.equal(await h.inside(`document.querySelectorAll('${control('properties')} .readings').length`),0);
    await mount({initialDocument:student,ui:{readings:true}});await openPanel();await tap('[data-hit="port:c1:a"]');assert.equal(await h.inside(`document.querySelectorAll('${control('properties')} .readings').length`),1);evidence('inspector-readings-toggle');

    const locked=M.empty();M.add(locked,'lamp',300,220).locked=true;
    await mount({initialDocument:locked,components:{default:{remove:true}}});const lockedBefore=await h.save();
    assert(await h.inside(`(()=>{const d=CircuitWorkbench.getDocument();d.components=[];try{CircuitWorkbench.loadDocument(d);return false}catch{return true}})()`));assert.equal(await h.save(),lockedBefore);
    const fixed=M.clone(locked);fixed.components[0].locked=false;fixed.policy.mode='wiring';await mount({initialDocument:fixed,palette:[{type:'resistor'}]});
    assert(await h.inside(`(()=>{const d=CircuitWorkbench.getDocument();d.components.push(CircuitModel.component(d,'resistor',500,220));try{CircuitWorkbench.loadDocument(d);return false}catch{return true}})()`));evidence('locked-and-wiring-imports',{atomic:true});

    const initial=M.empty();M.add(initial,'lamp',300,220).label='課堂燈';
    await mount({initialDocument:initial,palette:[{type:'lamp',limit:2},{type:'battery',limit:1}],ui:{palette:true},components:{default:{remove:true,move:true}}});
    await selectedBody('c1');await openPanel();await tap('[data-action="複製元件"]');let d=await h.doc();assert.equal(d.components.length,2);assert.equal(d.components[1].label,'白熾燈');
    assert(await h.inside(`CircuitWorkbench.execute({type:'remove',id:'c2'})`));assert(await h.inside(`CircuitWorkbench.execute({type:'remove',id:'c1'})`));await tap('[data-add=battery]');
    d=await h.doc();assert.equal(d.components.length,1);assert.equal(d.components[0].type,'battery');assert.notEqual(d.components[0].id,'c1');
    const added=await h.save();await h.inside(`CircuitWorkbench.loadDocument(${JSON.stringify(added)})`);assert(await h.inside(`CircuitWorkbench.execute({type:'remove',id:'${d.components[0].id}'})`));
    assert(await h.inside(`CircuitWorkbench.execute({type:'addComponent',key:'lamp',x:300,y:220})`));assert.notEqual((await h.doc()).components[0].id,'c1');evidence('reserved-author-ids',{nativePalette:true,commands:true,studentCopy:true,restoreAndContinue:true});

    const cable=M.empty(),wire=M.addWire(cable,300,220);await mount({role:'teacher',initialDocument:cable,wires:false});const frozen=await h.save();
    assert.equal(await h.inside(`CircuitWorkbench.execute({type:'addWire',x:300,y:300})`),false);assert.equal(await h.inside(`CircuitWorkbench.execute({type:'remove',id:'w1'})`),false);
    await h.inside(`document.querySelector('[data-hit="wireend:w1:from"]').focus()`);await h.key('ArrowUp','ArrowUp',38);await h.key('Delete','Delete',46);assert.equal(await h.save(),frozen);
    assert(await h.inside(`(()=>{const d=CircuitWorkbench.getDocument();CircuitModel.moveWireEnd(d,'w1','from',{x:240,y:280});try{CircuitWorkbench.loadDocument(d);return false}catch{return true}})()`));assert.equal(await h.save(),frozen);evidence('teacher-no-wiring',{keyboard:true,commands:true,load:true});

    await mount({role:'teacher',initialDocument:M.empty()});await tap(control('quickWire'));d=await h.doc();assert.equal(await h.inside(`document.querySelector('${control('quickWire')} span').textContent`),'19/20');
    const ends=await h.inside(`(()=>{const d=CircuitWorkbench.getDocument(),e=CircuitModel.endpoints(d);return [e.get(d.wires[0].from),e.get(d.wires[0].to)];})()`),p=await h.point('[data-hit="wireend:w1:from"]');await contact(p,{x:p.x+30,y:p.y+15});
    const moved=await h.inside(`(()=>{const d=CircuitWorkbench.getDocument(),e=CircuitModel.endpoints(d);return [e.get(d.wires[0].from),e.get(d.wires[0].to)];})()`);assert.deepEqual(moved[1],ends[1]);assert(Math.hypot(moved[0].x-ends[0].x,moved[0].y-ends[0].y)>1);evidence('current-cable-contract',{stock20:true,farEndFixed:true,trusted:true});
    const long=M.empty();M.add(long,'lamp',300,220).label='燈'.repeat(40);await mount({role:'teacher',initialDocument:long});await selectedBody('c1');await openPanel();await tap('[data-action="複製元件"]');assert.equal((await h.doc()).components.length,2);assert((await h.doc()).components.every(c=>c.label.length<=40));evidence('maximum-length-name-copy');
    await tinyWireDirection();await registryCommand();await nearLimitBend();await finiteMeterNull();await boundedSlider();await tidyLimit();await sliderBoundary();await balancedZero();
    await h.screenshot(`${mode}-audit-${width}.png`);
  }
}
module.exports={reviewCases};
