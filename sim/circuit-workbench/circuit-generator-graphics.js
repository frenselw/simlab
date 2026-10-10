(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./circuit-field-graphics'):root.CircuitFieldGraphics);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.CircuitGeneratorGraphics=api;
})(globalThis,function(Fields){
  'use strict';
  const TAU=Math.PI*2,staticParts=[],rotatingParts=[],cache=new WeakMap();
  // Equal pole heights/depths stay level: lateral x never changes screen y.
  const project=p=>[p[0]+.38*p[2],-p[1]+.28*p[2]-8];
  const depth=p=>p[2]+.28*p[1]-.38*p[0];
  // n=(cos θ,sin θ,0) is the B→A winding normal; e=−d(NΦ)/dt
  // is the source's a−b voltage. Keep the visible rotation and terminals consistent.
  const rotor=(p,t)=>[p[0]*Math.sin(t)+p[2]*Math.cos(t),-p[0]*Math.cos(t)+p[2]*Math.sin(t),p[1]];
  const coordinates=p=>project(p).map(n=>Number(n.toFixed(4))).join(' ');
  const path=pts=>pts.map((p,i)=>(i?'L':'M')+coordinates(p)).join(' ');
  function polygon(id,points,fill,field=false){staticParts.push({id,points,fill,field,kind:'polygon'});}
  function line(id,points,stroke,width){staticParts.push({id,points,stroke,width,kind:'line'});}
  function box(id,x0,x1,y0,y1,z0,z1,colors){
    const v=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
    polygon(id+'-top',[v[3],v[2],v[6],v[7]],colors[0]);
    polygon(id+'-side',[v[0],v[3],v[7],v[4]],colors[1]);
    polygon(id+'-front',[v[4],v[7],v[6],v[5]],colors[2]);
  }
  function ring(id,z){
    const at=(a,z,r)=>[r*Math.cos(a),r*Math.sin(a),z],count=20;
    for(let i=0;i<count;i++){
      const a=i*TAU/count,b=(i+1)*TAU/count,m=(a+b)/2;
      if(-.38*Math.cos(m)+.28*Math.sin(m)>0)polygon(id+'-wall-'+i,[at(a,z-1.8,5.5),at(a,z+1.8,5.5),at(b,z+1.8,5.5),at(b,z-1.8,5.5)],Math.sin(m)>.2?'#deb478':'#b98542');
      polygon(id+'-face-'+i,[at(a,z+1.8,5.5),at(b,z+1.8,5.5),at(b,z+1.8,3.4),at(a,z+1.8,3.4)],'#dba04c');
    }
    polygon(id+'-insulation',Array.from({length:20},(_,i)=>at(i*TAU/20,z+1.9,3.3)),'#b4bec6');
  }
  box('north',-37,-27,-19,21,-12,12,['#efc6c2','#e4b5b0','#dca19b']);
  box('south',27,37,-19,21,-12,12,['#c1d7e7','#adc9de','#9dbfd8']);
  staticParts.push({id:'N',kind:'text',value:'N',points:[[-32,4,12.3]]},{id:'S',kind:'text',value:'S',points:[[32,4,12.3]]});
  for(let z=-31;z<58;z+=4)line('shaft-'+z,[[0,0,z],[0,0,Math.min(z+4,58)]],'#82939f',2.5);
  for(const [i,z] of [34,45].entries()){
    ring('ring-'+(i+1),z);
    box('brush-'+(i+1),-2,2,-14,-5.4,z-1.6,z+1.6,['#66737e','#4c5964','#3e4a55']);
  }
  for(let i=0;i<13;i++){
    staticParts.push({id:'field-'+i,kind:'line',points:[[-25,0,-4],[25,0,-4]],stroke:'#247b87',width:.7,field:true,fieldIndex:i});
    staticParts.push({id:'field-arrow-'+i,kind:'polygon',points:[[5,0,-4],[1.8,1.1,-4],[1.8,-1.1,-4]],fill:'#247b87',field:true,fieldIndex:i});
  }
  function winding(){
    const pts=[[-2,22.5]],r=17,L=22.5,c=2.7;
    const edge=(x,y)=>{const p=pts.at(-1);for(let i=1;i<=4;i++)pts.push([p[0]+(x-p[0])*i/4,p[1]+(y-p[1])*i/4]);};
    const arc=(x,y,a,b)=>{for(let i=1;i<=4;i++){const t=a+(b-a)*i/4;pts.push([x+c*Math.cos(t),y+c*Math.sin(t)]);}};
    edge(-r+c,L);arc(-r+c,L-c,Math.PI/2,Math.PI);edge(-r,-L+c);arc(-r+c,-L+c,Math.PI,1.5*Math.PI);
    edge(r-c,-L);arc(r-c,-L+c,1.5*Math.PI,TAU);edge(r,L-c);arc(r-c,L-c,0,Math.PI/2);edge(2,L);
    return pts;
  }
  function movingWire(id,local,stroke='#bc6825',width=.85){
    for(let i=1;i<local.length;i++)rotatingParts.push({id:id+'-'+i,local:[local[i-1],local[i]],kind:'line',stroke,width});
  }
  const section=winding();
  for(const [i,n] of [-.75,.75].entries())movingWire('winding-'+i,section.map(([s,z])=>[s,z,n]));
  movingWire('series',[[2,22.5,-.75],[2,25,-.75],[-2,25,.75],[-2,22.5,.75]]);
  movingWire('tail-a',[[-2,22.5,-.75],[-2,27,-.75],[-2,32,0],[-5.5,34,0]],'#bc6825',.7);
  movingWire('tail-b',[[2,22.5,.75],[2,28,.75],[2,43,0],[5.5,45,0]],'#bc6825',.7);
  movingWire('crank',[[0,57,0],[6.5,57,0],[6.5,61,0]],'#82939f',1.5);
  movingWire('grip',[[6.5,60,0],[6.5,65,0]],'#3e4a55',2.4);
  const definitions=staticParts.concat(rotatingParts);
  const fieldGrid=b=>Fields.density(b,.2,4,12,-16,16);
  function geometry(theta,field=.2){
    const grid=fieldGrid(field);
    return definitions.map(part=>{
      const fieldActive=part.field&&field>0&&part.fieldIndex<grid.positions.length;
      const points=part.local?part.local.map(p=>rotor(p,theta)):part.field?part.points.map(p=>[p[0],p[1]+(grid.positions[part.fieldIndex]??0),p[2]]):part.points;
      return {...part,points,fieldActive,depth:points.reduce((s,p)=>s+depth(p),0)/points.length,d:path(points)+(part.kind==='polygon'?'Z':'')};
    }).sort((a,b)=>a.depth-b.depth||a.id.localeCompare(b.id));
  }
  const phase=(c,r)=>Number.isFinite(r?.phase)?r.phase:c.params.phase*Math.PI/180;
  function markup(part,angle,fields){
    const attr='data-generator-part="'+part.id+'"'+(part.field?' data-generator-field="true" opacity="'+(fields&&part.fieldActive?1:0)+'"':'')+(part.id==='north-front'||part.id==='south-front'?' data-generator-pole="'+(part.id==='north-front'?'N':'S')+'"':'');
    if(part.kind==='text'){
      const p=project(part.points[0]);
      return '<text '+attr+' x="'+p[0]+'" y="'+p[1]+'" transform="rotate('+(-angle)+' '+p.join(' ')+')" text-anchor="middle" dominant-baseline="central" font-size="9" fill="#334155">'+part.value+'</text>';
    }
    return '<path '+attr+' d="'+part.d+'" fill="'+(part.fill||'none')+'" stroke="'+(part.stroke||'none')+'" stroke-width="'+(part.width||0)+'" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  function render(c,r,fields=true){
    fields=fields&&c.params.field>0;
    const theta=phase(c,r);
    return '<g data-generator-model="rectangular" data-generator-angle="'+theta+'" data-generator-turns="2" data-generator-fields="'+fields+'" data-generator-field-spacing="'+fieldGrid(c.params.field).spacing+'">'+geometry(theta,c.params.field).map(p=>markup(p,c.angle||0,fields)).join('')+'</g>';
  }
  function update(node,c,r,fields=true){
    if(!node)return;
    fields=fields&&c.params.field>0;
    const theta=phase(c,r),angle=c.angle||0,key=[theta,angle,fields,c.params.field].join('|');
    let state=cache.get(node);
    if(!state){state={parts:new Map([...node.children].map(p=>[p.dataset.generatorPart,p])),key:null};cache.set(node,state);}
    if(state.key===key)return;
    const parts=geometry(theta,c.params.field);
    for(let i=0;i<parts.length;i++){
      const part=parts[i],el=state.parts.get(part.id);
      if(part.local||part.field)el.setAttribute('d',part.d);
      if(part.field)el.setAttribute('opacity',fields&&part.fieldActive?'1':'0');
      if(part.kind==='text'){const p=project(part.points[0]);el.setAttribute('transform','rotate('+(-angle)+' '+p.join(' ')+')');}
      if(node.children[i]!==el)node.insertBefore(el,node.children[i]||null);
    }
    node.dataset.generatorAngle=String(theta);node.dataset.generatorFields=String(fields);node.dataset.generatorFieldSpacing=String(fieldGrid(c.params.field).spacing);state.key=key;
  }
  const brushContacts=[project([0,-14,34]),project([0,-14,45])];
  const leads='M-60 0H-43V30.5H'+brushContacts[0][0]+'V'+brushContacts[0][1]+' M60 0H43V35H'+brushContacts[1][0]+'V'+brushContacts[1][1];
  return {render,update,geometry,project,leads};
});
