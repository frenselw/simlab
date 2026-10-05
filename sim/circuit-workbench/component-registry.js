(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CircuitRegistry = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const two = [{ key: "a", x: -60, y: 0, label: "a" }, { key: "b", x: 60, y: 0, label: "b" }];
  const polar = two.map(p => ({...p,label:p.key === "a" ? "+" : "−"}));
  const meterPorts = [{key:"a",x:48,y:66,dx:0,dy:1,label:"大量程 +"},{key:"b",x:-48,y:66,dx:0,dy:1,label:"−"},{key:"c",x:0,y:66,dx:0,dy:1,label:"小量程 +"}];
  const v4MeterPorts=meterPorts.map(p=>({...p,x:p.x*4/3}));
  const rheostatPorts = [{key:"a",x:-68,y:20,dx:-1,dy:0,label:"A"},{key:"c",x:68,y:20,dx:1,dy:0,label:"B"},{key:"b",x:-68,y:-34,dx:-1,dy:0,label:"P₁"},{key:"d",x:68,y:-34,dx:1,dy:0,label:"P₂"}];
  const number = (label, unit, value, min, max, step) => ({ label, unit, value, min, max, step });
  const definitions = {
    battery: { name: "直流電源", icon: "▰", ports: polar, primaryParameter:"voltage", params: { voltage: number("電動勢", "V", 6, 0, 120, .5), resistance: number("內阻", "Ω", 0, 0, 10000, .1), polarity: { value: 1, choices: [1, -1] } } },
    resistor: { name: "電阻", icon: "▭", ports: two, primaryParameter:"resistance", params: { resistance: number("電阻", "Ω", 12, .01, 1e6, 1) } },
    rheostat: { name: "滑動變阻器", icon: "↗", ports: rheostatPorts, primaryParameter:"position", params: { resistance: number("最大電阻", "Ω", 100, .01, 1e6, 1), position: number("滑片位置", "%", .5, 0, 1, .01), terminals:{label:"接線孔數",value:4,choices:[4,3,2]} } },
    lamp: { name: "白熾燈", icon: "☀", ports: two, primaryParameter:"resistance", params: { resistance: number("電阻／額定熱態電阻", "Ω", 12, .01, 1e6, 1), ratedVoltage: number("額定電壓", "V", 6, .1, 120, .5), model: { value: "ideal", choices: ["ideal", "thermal"] }, coldRatio:number("熱態／冷態電阻比", "", 10, 1, 30, .1), linearLoss:number("線性散熱比例", "%", .1, 0, 1, .01) } },
    switch: { name: "開關", icon: "⤴", ports: two, params: { closed: { value: true, choices: [true, false] } } },
    ammeter: { name: "電流表", icon: "A", ports: meterPorts, params: { resistance: number("大量程內阻", "Ω", 0, 0, 10000, .1), range: number("大量程上限", "A", 3, .001, 1e6, .5) } },
    voltmeter: { name: "電壓表", icon: "V", ports: meterPorts, params: { resistance: number("大量程輸入電阻（0 表示理想無限大）", "Ω", 0, 0, 1e12, 1000), range: number("大量程上限", "V", 15, .001, 1e6, 1) } },
    galvanometer: { name:"靈敏電流計", icon:"G", ports:polar, params:{resistance:number("表頭內阻", "Ω", 100, .01, 1e6, 1), range:{...number("滿偏電流", "μA", .00005, 1e-9, 1, .000005),factor:1e6}} },
    wattmeter: { name: "電功率表", icon: "W", ports: [{ key: "a", x: -60, y: -20, label: "I+" }, { key: "b", x: 60, y: -20, label: "I−" }, { key: "c", x: -60, y: 40, label: "V+" }, { key: "d", x: 60, y: 40, label: "V−" }], params: { resistance: number("電流線圈內阻", "Ω", 0, 0, 10000, .1), inputResistance: number("電壓線圈電阻（0 表示理想）", "Ω", 0, 0, 1e12, 1000), range: number("量程", "W", 20, .001, 1e6, 1) } }
  };
  function get(type) { if (typeof type !== "string" || !Object.hasOwn(definitions, type)) throw new Error("不支援的元件類型"); return definitions[type]; }
  function primaryParameter(c) {
    const definition=get(c.type),key=definition.primaryParameter,spec=definition.params[key];
    if(!spec||spec.choices||![spec.min,spec.max,spec.step,c.params[key]].every(Number.isFinite))return null;
    const factor=key==='position'?100:spec.factor||1;
    return {key,label:c.type==='lamp'?(c.params.model==='thermal'?'熱態電阻':'電阻'):spec.label,
      unit:spec.unit||'',factor,value:c.params[key],min:spec.min,max:spec.max,step:spec.step};
  }
  function stepPrimaryParameter(c,direction) {
    const p=primaryParameter(c);if(!p||![1,-1].includes(direction))throw new Error('沒有可調的主參數');
    return Math.max(p.min,Math.min(p.max,Number((p.value+direction*p.step).toPrecision(12))));
  }
  function defaults(type) { return Object.fromEntries(Object.entries(get(type).params).map(([key, item]) => [key, item.value])); }
  const dualMeter=c=>['ammeter','voltmeter'].includes(c.type);
  const isMeter=c=>dualMeter(c)||['galvanometer','wattmeter'].includes(c.type);
  const meterBodyScale=c=>dualMeter(c)?.85:c.type==='wattmeter'?.9:1;
  function meterHousingBounds(c) {
    const s=meterBodyScale(c),a=c.angle*Math.PI/180,cos=Math.round(Math.cos(a)),sin=Math.round(Math.sin(a));
    const corners=[-78*s,78*s].flatMap(x=>[-86*s,64*s].map(y=>({x:c.x+x*cos-y*sin,y:c.y+x*sin+y*cos})));
    return{left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y))};
  }
  const meterScale=Object.freeze({divisions:30,negativeDivisions:10,minimumFraction:-1/3,zeroAngle:-120,sweep:90,stopMargin:.02});
  function meterRanges(c){return {high:c.params.range,low:c.params.range/5,divisions:meterScale.divisions,negativeDivisions:meterScale.negativeDivisions};}
  function localPorts(component,legacy=false){
    const terminals=component.params.terminals??2;
    const local=component.type==='rheostat'?(terminals===2?two:terminals===3?rheostatPorts.filter(p=>p.key!=='d'):rheostatPorts):dualMeter(component)?legacy===true?polar:legacy==='v4'?v4MeterPorts:meterPorts:get(component.type).ports;
    return legacy!==true&&dualMeter(component)&&component.mirrored?local.map(p=>({...p,x:-p.x,dx:-(p.dx??Math.sign(p.x))})):local;
  }
  function ports(component, legacy=false) {
    const angle = component.angle * Math.PI / 180, cos = Math.round(Math.cos(angle)), sin = Math.round(Math.sin(angle));
    const terminals=component.params.terminals??2;
    const local=localPorts(component,legacy);
    return local.map((p) => {
      const dx=p.dx??Math.sign(p.x),dy=p.dy??0,ranges=dualMeter(component)?meterRanges(component):null;
      const label=component.type==='rheostat'&&terminals===2?(p.key==='a'?'A':'P'):component.type==="battery"&&component.params.polarity<0?p.key==="a"?"−":"+":legacy!==true&&ranges?p.key==="b"?"−":"+"+Number((p.key==="a"?ranges.high:ranges.low).toPrecision(4))+" "+get(component.type).icon:p.label;
      return {...p,label,id:component.id+":"+p.key,x:component.x+p.x*cos-p.y*sin,y:component.y+p.x*sin+p.y*cos,dx:dx*cos-dy*sin,dy:dx*sin+dy*cos};
    });
  }
  function bodyBounds(c) {
    const box=dualMeter(c)?{left:-78,right:78,top:-86,bottom:78}:c.type==='rheostat'?{left:-76,right:76,top:-46,bottom:55}:c.type==='galvanometer'?{left:-63,right:63,top:-55,bottom:52}:{left:-52,right:52,top:-52,bottom:65};
    const angle=c.angle*Math.PI/180,cos=Math.round(Math.cos(angle)),sin=Math.round(Math.sin(angle));
    const corners=[box.left,box.right].flatMap(x=>[box.top,box.bottom].map(y=>({x:c.x+x*cos-y*sin,y:c.y+x*sin+y*cos})));
    return {left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y))};
  }
  // Teaching approximation, calibrated to the specified rated operating point.
  // Configurable loss mixture and cold resistance are teaching parameters, not a tungsten fit.
  const thermal = Object.freeze({ ambient: 293, rated: 2600, ratio: 10 });
  function lampAt(voltage, params) {
    if (params.model === "ideal") return { current: voltage / params.resistance, conductance: 1 / params.resistance, resistance: params.resistance, temperature: null };
    const ratio=params.coldRatio??thermal.ratio,linear=params.linearLoss??0;
    const cold = params.resistance / ratio, alpha = (ratio - 1) / (thermal.rated - thermal.ambient);
    const ratedPower=params.ratedVoltage**2/params.resistance;
    const k = ratedPower*(1-linear)/(thermal.rated ** 4 - thermal.ambient ** 4), h=ratedPower*linear/(thermal.rated-thermal.ambient);
    const resistanceAt = (t) => cold * (1 + alpha * (t - thermal.ambient));
    let lo = thermal.ambient, hi = thermal.rated;
    const balance = (t) => k * (t ** 4 - thermal.ambient ** 4)+h*(t-thermal.ambient) - voltage ** 2 / resistanceAt(t);
    while (balance(hi) < 0) hi *= 2;
    for (let n = 0; n < 64; n++) { const mid = (lo + hi) / 2; if (balance(mid) < 0) lo = mid; else hi = mid; }
    const temperature = (lo + hi) / 2, resistance = resistanceAt(temperature), slope = cold * alpha;
    const dTdV = (2 * voltage / resistance) / (4 * k * temperature ** 3+h + voltage ** 2 * slope / resistance ** 2);
    return { current: voltage / resistance, conductance: 1 / resistance - voltage * slope * dTdV / resistance ** 2, resistance, temperature };
  }
  function effectiveResistance(c) { return c.type === "rheostat" ? c.params.resistance * c.params.position : c.params.resistance; }
  // Device hooks are trusted local code. JSON imports carry parameters only.
  const resistive = (resistance, from="a", to="b") => ({ from, to, kind: resistance===0 ? "branch" : "resistor", resistance });
  definitions.battery.dc = c => [{from:"a",to:"b",kind:"branch",resistance:c.params.resistance,emf:c.params.voltage*c.params.polarity}];
  definitions.resistor.dc = definitions.galvanometer.dc = c => [resistive(c.params.resistance)];
  definitions.rheostat.dc = c => [resistive(effectiveResistance(c)),...((c.params.terminals??2)>2?[resistive(c.params.resistance*(1-c.params.position),'b','c')]:[]),...(c.params.terminals===4?[resistive(0,'b','d')]:[])];
  definitions.switch.dc = c => c.params.closed ? [resistive(0)] : [];
  definitions.ammeter.dc = c => [resistive(c.params.resistance),resistive(c.params.resistance*5,"c","b")];
  definitions.voltmeter.dc = c => c.params.resistance>0 ? [resistive(c.params.resistance),resistive(c.params.resistance/5,"c","b")] : [];
  definitions.lamp.dc = c => c.params.model==="thermal" ? [{from:"a",to:"b",kind:"nonlinear",resistance:c.params.resistance,law:lampAt}] : [resistive(c.params.resistance)];
  definitions.wattmeter.dc = c => [resistive(c.params.resistance),...(c.params.inputResistance>0 ? [resistive(c.params.inputResistance,"c","d")] : [])];
  function dc(c) { const descriptor=get(c.type), keys=descriptor.ports.map(p=>p.key), result=descriptor.dc(c); for(const b of result){if(!keys.includes(b.from)||!keys.includes(b.to)||b.from===b.to||!["branch","resistor","nonlinear"].includes(b.kind))throw new Error("元件模型端子或類型無效");if(b.kind==="nonlinear"&&typeof b.law!=="function")throw new Error("缺少非線性模型");}return result; }
  function register(type, definition) { if(typeof type!=="string"||!/^[a-z][a-z0-9-]{0,39}$/.test(type)||Object.hasOwn(definitions,type)||!definition||typeof definition.dc!=="function"||!Array.isArray(definition.ports)||!definition.ports.length||new Set(definition.ports.map(p=>p.key)).size!==definition.ports.length)throw new Error("無效或重複的元件定義"); definitions[type]=definition; }
  return { definitions, get, defaults, primaryParameter, stepPrimaryParameter, localPorts, ports, portsForVersion:(c,version)=>ports(c,version<4?true:version===4?'v4':false), bodyBounds, meterHousingBounds, legacyPorts:c=>ports(c,true), dualMeter, isMeter, meterBodyScale, meterScale, meterRanges, lampAt, thermal, effectiveResistance, dc, register };
});
