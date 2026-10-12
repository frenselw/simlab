(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("./circuit-model.js") : root.CircuitModel, node ? require("./circuit-routing.js") : root.CircuitRouting);
  if (node) module.exports = api; else root.CircuitPresets = api;
})(globalThis, function (M, G) {
  "use strict";
  const names = {
    series:'兩燈串聯：電流與電壓', parallel:'兩燈並聯：幹路與支路', mixed:'串並混聯：電流分配',
    ammeter:'電流表接線：串聯量電流', voltmeter:'電壓表接線：並聯量電壓',
    bridge:'電橋：平衡與橋中電流', wiring:'接線練習：固定元件',
    ohm:'全電路歐姆定律：內阻與路端電壓', limiting:'滑動變阻器：限流接法', divider:'滑動變阻器：分壓接法',
    meters:'電表接線：電流、電壓與功率', gAmmeter:'電流表改裝：並聯分流', gVoltmeter:'電壓表改裝：串聯分壓',
    relay:'電磁繼電器：兩燈切換', relayBell:'電磁繼電器：電鈴式自斷', empty:'空白電路'
  };
  const groups = [
    {label:'電路基礎',keys:['series','parallel','mixed','ammeter','voltmeter','bridge','wiring']},
    {label:'電源與變阻器',keys:['ohm','limiting','divider']},
    {label:'電表與量測',keys:['meters','gAmmeter','gVoltmeter']},
    {label:'電磁繼電器',keys:['relay','relayBell']}
  ];
  function create(name) {
    const d = M.empty(); if (name === "empty") return d;
    function add(type, x, y, label, params = {}, angle = 0) { const c = M.add(d, type, x, y, params); c.label = label; c.angle = angle; return c; }
    function link(a, ap, b, bp, via = []) {
      const from=(typeof a==='string'?a:a.id)+':'+ap,to=(typeof b==='string'?b:b.id)+':'+bp,ends=M.endpoints(d),points=G.rounded([ends.get(from),...via,ends.get(to)]);
      const w=M.connect(d,from,to,points.slice(1,-1),'free');w.length=Math.max(600,Math.ceil(G.length(points))+400);return w;
    }
    const battery = add("battery", 180, 320, "電源", { voltage: 6, resistance: name === "ohm" ? 2 : 0 }, 90);
    if(['relay','relayBell'].includes(name)){
      battery.x=100;battery.y=380;battery.label='控制電源';
      const sw=add('switch',240,170,'控制開關',{closed:false}),relay=add('relay',name==='relay'?440:380,300,'電磁繼電器');
      link(battery,'a',sw,'a',[{x:100,y:170}]);
      if(name==='relay'){
        const load=add('battery',650,300,'負載電源',{voltage:6},0),upper=add('lamp',650,200,'上燈（未吸合）'),lower=add('lamp',650,420,'下燈（吸合）');
        link(sw,'b',relay,'a',[{x:310,y:170},{x:310,y:440},{x:412,y:440}]);
        link(relay,'b',battery,'b',[{x:468,y:510},{x:100,y:510}]);
        link(load,'a',relay,'c');
        link(relay,'d',upper,'a',[{x:560,y:252},{x:560,y:200}]);link(relay,'e',lower,'a',[{x:560,y:348},{x:560,y:420}]);
        d.junctions.push({id:'j1',x:780,y:300});link(upper,'b','j1','p',[{x:780,y:200}]);link(lower,'b','j1','p',[{x:780,y:420}]);link('j1','p',load,'b');
      }else{
        const lamp=add('lamp',650,350,'自斷指示燈');
        link(sw,'b',relay,'c',[{x:290,y:170},{x:530,y:170},{x:530,y:300}]);
        link(relay,'d',relay,'a',[{x:500,y:252},{x:500,y:220},{x:260,y:220},{x:260,y:440},{x:352,y:440}]);link(relay,'b',battery,'b',[{x:408,y:510},{x:100,y:510}]);
        link(relay,'e',lamp,'a',[{x:550,y:348},{x:550,y:350}]);link(lamp,'b',battery,'b',[{x:760,y:350},{x:760,y:550},{x:100,y:550}]);
      }
      return M.validate(d);
    }
    if(['limiting','divider','gAmmeter','gVoltmeter'].includes(name)){
      battery.x=160;battery.y=350;
      if(name.startsWith('g')){
        d.display.meters='analog';
        const shunt=name==='gAmmeter';battery.params.voltage=shunt?6:3;
        const series=add('resistor',360,140,shunt?'限流電阻':'分壓電阻',{resistance:shunt?5995:59900}),g=add('galvanometer',650,240,'50 μA 表頭');
        link(battery,'a',series,'a',[{x:160,y:140}]);
        if(shunt){
          const r=add('resistor',650,420,'分流電阻',{resistance:100/19});d.junctions.push({id:'j1',x:520,y:240},{id:'j2',x:780,y:420});
          link(series,'b','j1','p',[{x:520,y:140}]);link('j1','p',g,'a');link('j1','p',r,'a',[{x:520,y:420}]);link(g,'b','j2','p',[{x:780,y:240}]);link(r,'b','j2','p');link('j2','p',battery,'b',[{x:780,y:540},{x:160,y:540}]);
        }else{link(series,'b',g,'a',[{x:520,y:140},{x:520,y:240}]);link(g,'b',battery,'b',[{x:780,y:240},{x:780,y:540},{x:160,y:540}]);}
      }else{
        battery.params.voltage=6;
        const r=add('rheostat',360,200,'滑動變阻器',{resistance:20,position:.5}),l=add('lamp',640,220,'負載燈泡'),a=add('ammeter',680,460,'電流表'),v=add('voltmeter',900,380,'電壓表');
        d.junctions.push({id:'j1',x:480,y:600});
        link(battery,'a',r,'a',[{x:160,y:220}]);link(r,'b',l,'a',[{x:240,y:166},{x:240,y:100},{x:520,y:100},{x:520,y:220}]);
        link(l,'b',a,'c',[{x:820,y:220},{x:820,y:600},{x:680,y:600}]);link(a,'b','j1','p',[{x:632,y:600}]);link('j1','p',battery,'b',[{x:160,y:600}]);
        if(name!=='limiting')link(r,'c','j1','p',[{x:480,y:220}]);
        link(v,name==='limiting'?'a':'c',l,'a',[{x:name==='limiting'?948:900,y:640},{x:1040,y:640},{x:1040,y:140},{x:580,y:140}]);link(v,'b','j1','p',[{x:852,y:700},{x:480,y:700}]);
      }
      d.wires.forEach(w=>w.length=Math.max(600,Math.ceil(G.length(G.route(d,w)))+160));
      return M.validate(d);
    }
    if (["series", "wiring"].includes(name)) {
      battery.x=200;
      const s = add("switch", 350, 180, "開關"), l1 = add("lamp", 530, 180, "燈泡 1"), l2 = add("lamp", 650, 320, "燈泡 2", {}, 90);
      link(battery, "a", s, "a", [{ x: 200, y: 180 }]); link(s, "b", l1, "a"); link(l1, "b", l2, "a", [{ x: 650, y: 180 }]); link(l2, "b", battery, "b", [{ x: 650, y: 440 }, { x: 200, y: 440 }]);
    } else if (name === "mixed") {
      battery.x=160;battery.y=400;
      const trunk=add('lamp',340,280,'幹路燈泡'),l1=add('lamp',620,160,'支路燈泡 1'),l2=add('lamp',620,400,'支路燈泡 2');
      d.junctions.push({id:'j1',x:480,y:280},{id:'j2',x:780,y:280},{id:'j3',x:780,y:400});
      link(battery,'a',trunk,'a',[{x:160,y:280}]);link(trunk,'b','j1','p');
      link('j1','p',l1,'a',[{x:480,y:160}]);link(l1,'b','j2','p',[{x:780,y:160}]);
      link('j1','p',l2,'a',[{x:480,y:400}]);link(l2,'b','j3','p');link('j2','p','j3','p');link('j3','p',battery,'b',[{x:780,y:560},{x:160,y:560}]);
    } else if (name === "parallel") {
      battery.x=160;battery.y=400;
      const s=add('switch',340,280,'總開關'),l1=add('lamp',820,160,'支路燈泡 1'),l2=add('lamp',820,400,'支路燈泡 2'),s1=add('switch',620,160,'支路開關 1'),s2=add('switch',620,400,'支路開關 2');
      d.junctions.push({id:'j1',x:480,y:280},{id:'j2',x:980,y:280},{id:'j3',x:980,y:400});
      link(battery,'a',s,'a',[{x:160,y:280}]);link(s,'b','j1','p');
      link('j1','p',s1,'a',[{x:480,y:160}]);link(s1,'b',l1,'a');link(l1,'b','j2','p',[{x:980,y:160}]);
      link('j1','p',s2,'a',[{x:480,y:400}]);link(s2,'b',l2,'a');link(l2,'b','j3','p');link('j2','p','j3','p');link('j3','p',battery,'b',[{x:980,y:560},{x:160,y:560}]);
    } else if (name === "ammeter" || name === "voltmeter") {
      battery.x=160;battery.y=340;
      const s=add('switch',330,180,'開關'),l=add('lamp',640,180,'負載燈泡');
      link(battery,'a',s,'a',[{x:160,y:180}]);
      if(name==='ammeter'){
        const a=add('ammeter',440,420,'串聯電流表');
        link(s,'b',l,'a');link(l,'b',a,'a',[{x:780,y:180},{x:780,y:580},{x:488,y:580}]);link(a,'b',battery,'b',[{x:392,y:580},{x:160,y:580}]);
      }else{
        const v=add('voltmeter',640,380,'並聯電壓表');v.mirrored=true;
        d.junctions.push({id:'j1',x:480,y:180},{id:'j2',x:780,y:180},{id:'j3',x:780,y:560});
        link(s,'b','j1','p');link('j1','p',l,'a');link(l,'b','j2','p');link('j2','p','j3','p');link('j3','p',battery,'b',[{x:780,y:600},{x:160,y:600}]);
        link(v,'a','j1','p',[{x:592,y:520},{x:480,y:520}]);link(v,'b','j3','p',[{x:688,y:560}]);
      }
    } else if (name === "ohm") {
      battery.x=160;battery.y=330;
      const a=add('ammeter',620,410,'電流表'),r=add('rheostat',620,180,'變阻器',{resistance:20,position:.5,terminals:2}),v=add('voltmeter',350,330,'路端電壓');
      d.junctions.push({id:'j1',x:350,y:180});
      link(battery,'a','j1','p',[{x:160,y:180}]);link('j1','p',r,'a');link(r,'b',a,'a',[{x:800,y:180},{x:800,y:560},{x:668,y:560}]);
      link(a,'b',battery,'b',[{x:572,y:560},{x:160,y:560}]);link(v,'a','j1','p',[{x:398,y:430},{x:460,y:430},{x:460,y:230},{x:350,y:230}]);
      link(v,'b',battery,'b',[{x:302,y:470},{x:240,y:470},{x:240,y:390}]);
    } else if (name === "meters") {
      battery.y=360;
      const a=add('ammeter',380,500,'電流表'),w=add('wattmeter',500,180,'電功率表'),l=add('lamp',780,360,'負載燈泡',{},90),v=add('voltmeter',980,430,'電壓表');v.mirrored=true;
      d.junctions.push({id:'j1',x:780,y:280},{id:'j2',x:780,y:560},{id:'j3',x:300,y:160},{id:'j4',x:640,y:560});
      link(battery,'a','j3','p',[{x:180,y:160}]);link('j3','p',w,'a');link(w,'b','j1','p',[{x:780,y:160}]);link('j1','p',l,'a');link(l,'b','j2','p');
      link('j2','p','j4','p');link('j4','p',a,'a',[{x:640,y:640},{x:428,y:640}]);link(a,'b',battery,'b',[{x:332,y:640},{x:180,y:640}]);
      link(w,'c','j3','p',[{x:300,y:220}]);link(w,'d','j4','p',[{x:640,y:220}]);
      link(v,'a','j1','p',[{x:932,y:520},{x:880,y:520},{x:880,y:280}]);link(v,'b','j2','p',[{x:1028,y:600},{x:780,y:600}]);
    } else if (name === "bridge") {
      battery.x=80;battery.y=406;
      const r1=add('resistor',390,256,'R₁',{resistance:10}),r2=add('resistor',690,256,'R₂',{resistance:20}),r3=add('resistor',390,556,'R₃',{resistance:10}),r4=add('rheostat',690,556,'R₄',{resistance:40,position:.5,terminals:2}),a=add('ammeter',540,340,'橋中電流');a.mirrored=true;
      d.junctions.push({id:'j1',x:540,y:106},{id:'j2',x:540,y:706},{id:'j3',x:240,y:406},{id:'j4',x:840,y:406});
      link(battery,'a','j1','p',[{x:80,y:106}]);link('j1','p',r1,'b');link('j1','p',r2,'a');
      link(r1,'a','j3','p');link('j3','p',r3,'a');link(r2,'b','j4','p');link('j4','p',r4,'b',[{x:790,y:556}]);
      link(r3,'b','j2','p');link(r4,'a','j2','p',[{x:590,y:556}]);link('j2','p',battery,'b',[{x:80,y:706}]);
      link('j3','p',a,'c',[{x:440,y:406},{x:440,y:446},{x:540,y:446}]);link(a,'b','j4','p',[{x:588,y:446},{x:640,y:446},{x:640,y:406}]);
    } else throw new Error("未知的範例");
    if (name === "series") {
      const paths = [[{x:200,y:219},{x:235,y:181},{x:280,y:178}],[],[{x:629,y:181},{x:650,y:217}],[{x:652,y:415},{x:620,y:440},{x:250,y:440},{x:200,y:415}]];
      d.wires.forEach((wire,i)=>{wire.shape="smooth";wire.via=paths[i];wire.length=600;});
    }
    if (name === "wiring") { d.wires = []; d.policy.mode = "wiring"; }
    return M.validate(d);
  }
  return { names, groups, create };
});
