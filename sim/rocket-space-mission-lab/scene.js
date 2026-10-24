import * as THREE from './vendor/three-0.185.1/three.module.min.js';
const P=window.RocketParts,O=window.RocketOrbit;
const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.75,metalness:.08,flatShading:true,...extra});
function dispose(group){group.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});}
function earthTexture(){
  const c=document.createElement('canvas');c.width=1024;c.height=512;const x=c.getContext('2d');x.fillStyle='#367c99';x.fillRect(0,0,1024,512);
  x.strokeStyle='#70aec22a';x.lineWidth=1;for(let i=0;i<=12;i++){x.beginPath();x.moveTo(i*1024/12,0);x.lineTo(i*1024/12,512);x.stroke();}for(let j=0;j<=6;j++){x.beginPath();x.moveTo(0,j*512/6);x.lineTo(1024,j*512/6);x.stroke();}
  const continents=[[[5,38],[14,37],[33,31],[50,12],[41,-14],[28,-34],[17,-35],[10,-12],[-16,14],[-17,28]],[[0,42],[-10,37],[-10,57],[9,70],[40,69],[58,56],[95,72],[180,65],[165,48],[140,34],[121,7],[102,0],[80,7],[65,25],[38,34],[30,46]],[[112,-12],[135,-10],[154,-24],[146,-39],[116,-35]], [[-169,70],[-140,59],[-127,50],[-119,32],[-100,17],[-81,8],[-77,27],[-53,48],[-65,61],[-110,73]], [[-81,10],[-61,9],[-35,-8],[-42,-24],[-68,-55],[-76,-25]],[[-55,60],[-22,65],[-32,83],[-58,82]],[[-180,-70],[-120,-73],[-40,-69],[40,-71],[120,-68],[180,-70],[180,-90],[-180,-90]]];
  continents.forEach((points,i)=>{x.fillStyle=i===5||i===6?'#e7eddf':i%2?'#8fa982':'#a6b88a';x.beginPath();points.forEach(([lon,lat],j)=>{const a=(lon+180)/360*1024,b=(90-lat)/180*512;j?x.lineTo(a,b):x.moveTo(a,b);});x.closePath();x.fill();});
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function buildRocket(c,separated){
  const group=new THREE.Group(),white=material('#f8f4e4'),dark=material('#425a5b'),metal=material('#b8c9c1',{metalness:.5}),mint=material('#5ba899'),orange=material('#ea9469'),slots=[],parts=[],ranges=[];let y=0,partParent=group;
  const mesh=(geometry,mat,x,yy,z,parent=partParent)=>{const m=new THREE.Mesh(geometry,mat);m.position.set(x,yy,z);parent.add(m);return m;};
  c.stages.forEach((s,i)=>{
    if(separated&&i===0)return;
    const base=y,accent=s.engine===0?orange:mint;const startPart=(part,ordinal=0,index=null)=>{partParent=new THREE.Group();partParent.userData.part={stage:i,part,ordinal,index};group.add(partParent);parts.push(partParent);};
    if(s.engine!==null){startPart('engine-'+s.engine);mesh(new THREE.CylinderGeometry(.8,1.38,1.5,16,1,true),dark,0,y+.75,0);mesh(new THREE.CylinderGeometry(1.1,1.1,.45,16),metal,0,y+1.55,0);y+=2;}
    partParent=group;const tanks=P.tanks(s),joins=[y],ordinals={small:0,large:0};
    tanks.forEach((part,j)=>{const h=part==='large'?4.1:2.4;startPart(part,ordinals[part]++,j);mesh(new THREE.CylinderGeometry(1.4,1.4,h,20),white,0,y+h/2,0);for(const dy of [.2,h-.2])mesh(new THREE.CylinderGeometry(1.43,1.43,.23,20),accent,0,y+dy,0);mesh(new THREE.BoxGeometry(.14,h*.68,.08),metal,0,y+h/2,1.39);y+=h;joins.push(y);});
    partParent=group;if(tanks.length===0){mesh(new THREE.CylinderGeometry(1.35,1.35,3,16),material('#a7c0b7',{transparent:true,opacity:.3,wireframe:true}),0,y+1.5,0);y+=3;}
    slots[i]=(base+y)/2;ranges[i]={base,engine:s.engine===null?0:2,large:s.large,small:s.small,joins};
    if(i===0&&c.stages.length===2&&!separated){mesh(new THREE.CylinderGeometry(1.47,1.47,.65,20),orange,0,y+.325,0);y+=.65;}
  });
  mesh(new THREE.CylinderGeometry(1.25,1.4,2,20),white,0,y+1,0);mesh(new THREE.SphereGeometry(1.25,20,12,0,Math.PI*2,0,Math.PI/2),white,0,y+2,0);const faceY=y+1.1;
  for(const side of [-1,1]){mesh(new THREE.SphereGeometry(.16,10,8),dark,side*.4,faceY,1.24);mesh(new THREE.SphereGeometry(.07,8,6),material('#ffffff'),side*.4-.03,faceY+.05,1.37);}
  const smile=new THREE.TorusGeometry(.24,.035,6,14,Math.PI);const mouth=mesh(smile,dark,0,faceY-.25,1.32);mouth.rotation.z=Math.PI;
  mesh(new THREE.CylinderGeometry(.04,.04,1.1,8),metal,0,y+3.6,0);mesh(new THREE.SphereGeometry(.17,10,8),orange,0,y+4.15,0);
  const flame=new THREE.Group();flame.position.y=-.2;mesh(new THREE.ConeGeometry(.95,4,12),material('#f1a44d',{emissive:'#eb7830',emissiveIntensity:.5}),0,-2,0,flame).rotation.z=Math.PI;mesh(new THREE.ConeGeometry(.5,2.5,12),material('#fff1ad',{emissive:'#ffdf94',emissiveIntensity:.7}),0,-1.2,.05,flame).rotation.z=Math.PI;flame.visible=false;group.add(flame);group.userData={slots,parts,ranges,height:y+4.4,flame};group.updateMatrixWorld(true);const bounds=new THREE.Box3();for(const part of parts)bounds.union(new THREE.Box3().setFromObject(part));group.userData.partBounds=bounds;return group;
}
function vectorArrow(color){const group=new THREE.Group(),mat=material(color,{emissive:color,emissiveIntensity:.3}),shaft=new THREE.Mesh(new THREE.CylinderGeometry(.026,.026,.74,8),mat),head=new THREE.Mesh(new THREE.ConeGeometry(.09,.26,10),mat);shaft.position.y=.37;head.position.y=.87;group.add(shaft,head);return group;}
function launchLandscape(){
  const group=new THREE.Group(),vertices=[],colors=[],rings=[0,100,500,2000,8000,32000,60000,120000,240000,480000,960000,1280000],segments=64;
  const point=(r,j)=>{const a=j/segments*Math.PI*2;return [r*Math.cos(a),Math.sqrt(P.R*P.R-r*r)-P.R-.85,r*Math.sin(a)];};
  for(let ring=1;ring<rings.length;ring++)for(let j=0;j<segments;j++){
    const r0=rings[ring-1],r1=rings[ring],c=new THREE.Color(r1>60000?'#78aaa9':r1>32000?'#d7cfaa':j%3?'#a0b493':'#94ac88');
    for(const p of [point(r0,j),point(r1,j+1),point(r1,j),point(r0,j),point(r0,j+1),point(r1,j+1)]){vertices.push(...p);colors.push(c.r,c.g,c.b);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();group.add(new THREE.Mesh(geometry,material('#ffffff',{vertexColors:true,side:THREE.DoubleSide})));
  const groundY=(x,z)=>Math.sqrt(P.R*P.R-x*x-z*z)-P.R;
  const road=new THREE.Mesh(new THREE.PlaneGeometry(18,1800),material('#8d9b91'));road.rotation.x=-Math.PI/2;road.position.set(320,-.7,100);group.add(road);
  const place=(mesh,x,y,z,sx=1,sy=sx,sz=sx)=>{const m=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion(),new THREE.Vector3(sx,sy,sz));mesh.setMatrixAt(mesh.userData.next++,m);};
  const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.7,1,8,6),material('#9b8166'),96),trees=new THREE.InstancedMesh(new THREE.ConeGeometry(5,15,7),material('#5b8977'),96);trunks.userData.next=trees.userData.next=0;let treeMin=Infinity,buildingMin=Infinity;
  for(let i=0;i<96;i++){const a=i*2.399,r=450+(i%12)*100,x=Math.cos(a)*r,z=Math.sin(a)*r,scale=.8+(i%5)*.13,y=groundY(x,z);treeMin=Math.min(treeMin,r);place(trunks,x,y+3,z,scale);place(trees,x,y+12*scale,z,scale);}group.add(trunks,trees);
  const buildings=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material('#e6e6cf'),12);buildings.userData.next=0;
  for(let i=0;i<12;i++){const x=650+i%3*100,z=-550+Math.floor(i/3)*230,h=16+i%4*6;place(buildings,x,groundY(x,z)+h/2,z,45,h,35);buildingMin=Math.min(buildingMin,Math.hypot(x,z));}group.add(buildings);
  for(const [width,color,offset]of [[112,'#c5c59c',.78],[76,'#6eafb9',.74]]){const vertices=[];for(let i=0;i<64;i++){const edge=(j,side)=>{const z=-2200+j/64*4400,x=-540+Math.sin(j/64*Math.PI*3)*90+side*width/2;return [x,groundY(x,z)-offset,z];};for(const p of [edge(i,-1),edge(i+1,-1),edge(i,1),edge(i,1),edge(i+1,-1),edge(i+1,1)])vertices.push(...p);}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();group.add(new THREE.Mesh(geometry,material(color,{side:THREE.DoubleSide})));}
  group.userData={clearRadius:300,treeMin,buildingMin,trees:96,buildings:12,river:true};
  const clouds=new THREE.InstancedMesh(new THREE.SphereGeometry(1,10,7),material('#f0f5ed',{transparent:true,opacity:.78,depthWrite:false}),24);clouds.userData.next=0;
  for(let i=0;i<8;i++)for(let j=0;j<3;j++)place(clouds,Math.cos(i*2.4)*(700+i*180)+j*170,1400+(i%3)*900,Math.sin(i*2.4)*(700+i*180),220,80,150);group.add(clouds);return group;
}
export class RocketScene{
  constructor(host,onFault){
    this.host=host;this.onFault=onFault;this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<960?1.5:2));this.renderer.setClearColor('#dbece2');this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.35;host.append(this.renderer.domElement);
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(40,1,.01,50000);this.scene.add(new THREE.HemisphereLight('#fafff3','#7b9891',2.8));const light=new THREE.DirectionalLight('#fff6d8',3.6);light.position.set(30,40,40);this.scene.add(light);const fill=new THREE.DirectionalLight('#80bce0',1);fill.position.set(-20,10,-30);this.scene.add(fill);
    this.studio=new THREE.Group();this.scene.add(this.studio);const pad=new THREE.Mesh(new THREE.CylinderGeometry(6,6.5,.65,48),material('#869c91'));pad.position.y=-.4;this.studio.add(pad);const inset=new THREE.Mesh(new THREE.CylinderGeometry(5,5,.08,48),material('#cdd9c9'));inset.position.y=-.01;this.studio.add(inset);const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),material('#d7e7d7'));floor.rotation.x=-Math.PI/2;floor.position.y=-.8;this.studio.add(floor);const grid=new THREE.GridHelper(100,20,'#c0d1be','#c4d5c1');grid.position.y=-.77;this.studio.add(grid);
    const apron=new THREE.Mesh(new THREE.CylinderGeometry(22,22,.15,48),material('#bdc8b8'));apron.position.y=-.65;this.studio.add(apron);const ring=new THREE.Mesh(new THREE.RingGeometry(7.2,8,48),material('#d9bd73',{side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=-.55;this.studio.add(ring);
    this.landscape=launchLandscape();this.scene.add(this.landscape);this.skyCanvas=document.createElement('canvas');this.skyCanvas.width=1;this.skyCanvas.height=128;this.skyTexture=new THREE.CanvasTexture(this.skyCanvas);this.skyTexture.colorSpace=THREE.SRGBColorSpace;
    this.earthMap=earthTexture();this.earth=new THREE.Mesh(new THREE.SphereGeometry(1,256,128),new THREE.MeshStandardMaterial({map:this.earthMap,roughness:1,metalness:0}));this.earth.rotation.y=.7;this.scene.add(this.earth);
    this.halo=new THREE.Mesh(new THREE.SphereGeometry(1,48,32),new THREE.MeshBasicMaterial({color:'#77bccc',transparent:true,opacity:.08,side:THREE.BackSide,depthWrite:false}));this.scene.add(this.halo);
    const coords=[],rng=(()=>{let t=512;return()=>{t=(t*1664525+1013904223)>>>0;return t/4294967296;};})();for(let i=0;i<450;i++){const a=rng()*Math.PI*2,b=Math.acos(2*rng()-1);coords.push(70*Math.sin(b)*Math.cos(a),70*Math.cos(b),70*Math.sin(b)*Math.sin(a));}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));this.stars=new THREE.Points(geo,new THREE.PointsMaterial({color:'#e0eee5',size:.075,sizeAttenuation:true}));this.scene.add(this.stars);
    this.velocityArrow=vectorArrow('#70cecb');this.thrustArrow=vectorArrow('#f7bb72');this.scene.add(this.velocityArrow,this.thrustArrow);this.lines={};this.data=null;this.view='factory';this.yaw=.55;this.pitch=.18;this.zoom=1;this.lost=false;this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;onFault('lost');});this.renderer.domElement.addEventListener('webglcontextrestored',()=>{this.lost=false;this.renderer.resetState();onFault('restored');this.draw();});
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
  }
  resize(){const {width,height}=this.host.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.draw();}
  setView(view){this.view=view;this.yaw=view==='plane'?0:view==='orbit'?.7:.55;this.pitch=view==='plane'?0:view==='orbit'?.48:.18;this.zoom=1;this.draw();}
  rotate(dx,dy){this.yaw+=dx*.008;this.pitch=Math.max(-1.15,Math.min(1.15,this.pitch+dy*.006));this.draw();}
  setData(data){this.data=data;const key=JSON.stringify([data.craft,data.flight?.separated]);if(key!==this.craftKey){if(this.rocket){this.scene.remove(this.rocket);dispose(this.rocket);}this.rocket=buildRocket(data.craft,Boolean(data.flight?.separated));this.scene.add(this.rocket);this.craftKey=key;}this.draw();}
  line(name,points,color,dashed=false){
    const old=this.lines[name];if(old){this.scene.remove(old);old.geometry.dispose();old.material.dispose();delete this.lines[name];}if(points.length<2)return;
    const geometry=new THREE.BufferGeometry().setFromPoints(points.map(q=>new THREE.Vector3(q[1]*3/P.R,q[0]*3/P.R,q[2]*3/P.R))),mat=dashed?new THREE.LineDashedMaterial({color,dashSize:.035,gapSize:.025,transparent:true,opacity:.9}):new THREE.LineBasicMaterial({color,transparent:true,opacity:.9}),line=new THREE.Line(geometry,mat);if(dashed)line.computeLineDistances();this.scene.add(line);this.lines[name]=line;
  }
  setPaths(actual,predicted,planned){this.line('actual',actual,'#ee9674');this.line('predicted',predicted,'#b0e3d4',true);this.line('planned',planned,'#f6ca74',true);}
  draw(){
    if(!this.data||!this.rocket||this.lost)return;const {flight:f,workshop}=this.data,space=['orbit','plane'].includes(this.view),factory=workshop&&this.view==='factory',height=this.rocket.userData.height;
    const altitude=f?Math.max(0,O.elements(f.state).height):0,theta=f?Math.atan2(f.state[1],f.state[0]):0;
    this.studio.visible=factory||Boolean(f&&!space);this.landscape.visible=Boolean(f&&!space);this.earth.visible=space||Boolean(f&&!factory&&altitude>30000);this.halo.visible=this.earth.visible;Object.values(this.lines).forEach(l=>l.visible=space);
    // In follow view the globe is the backdrop; the detailed ground owns depth.
    this.earth.renderOrder=-2;this.earth.material.depthWrite=space;
    const sky=space?1:THREE.MathUtils.smoothstep(altitude,0,120000);this.skyFraction=sky;
    if(factory||!f&&!space){this.scene.background=null;this.renderer.setClearColor('#dcebe0');}
    else{this.scene.background=this.skyTexture;if(this.skyKey===undefined||Math.abs(sky-this.skyKey)>.002||sky===0&&this.skyKey!==0||sky===1&&this.skyKey!==1){this.skyKey=sky;const x=this.skyCanvas.getContext('2d'),g=x.createLinearGradient(0,0,0,128);g.addColorStop(0,'#'+new THREE.Color('#78b9d7').lerp(new THREE.Color('#07111e'),sky).getHexString());g.addColorStop(1,'#'+new THREE.Color('#d3ece4').lerp(new THREE.Color('#162a3b'),sky).getHexString());x.fillStyle=g;x.fillRect(0,0,1,128);this.skyTexture.needsUpdate=true;}}
    const target=new THREE.Vector3();let distance;
    if(space){this.earth.position.set(0,0,0);this.earth.scale.setScalar(3);this.halo.position.copy(this.earth.position);this.halo.scale.setScalar(3.045);this.rocket.scale.setScalar(.33/height);this.rocket.position.set(f?f.state[1]*3/P.R:0,f?f.state[0]*3/P.R:3,0);this.rocket.rotation.z=f?-f.attitude:0;target.set(0,.3,0);const h=this.host.clientHeight;distance=Math.max(14.5,3*h/(2*Math.tan(Math.PI/9)*Math.max(20,(h-130)/2)))/this.zoom;}
    else if(factory||!f){this.rocket.scale.setScalar(1);this.rocket.position.set(0,0,0);this.rocket.rotation.z=0;target.set(0,height*.44,0);distance=Math.max(24,height*1.85)/this.zoom;}
    else{
      const r=Math.hypot(f.state[0],f.state[1]);this.earth.position.set(0,-r/1000,0);this.earth.scale.setScalar(P.R/1000);this.halo.position.copy(this.earth.position);this.halo.scale.setScalar((P.R+80000)/1000);
      distance=Math.max(.035,height*.0028,altitude/1000*3+.035)/this.zoom;
      this.rocket.scale.setScalar(Math.max(.001,distance*.16/height));this.rocket.position.set(0,0,0);this.rocket.rotation.z=theta-f.attitude;target.set(0,height*this.rocket.scale.y*.35,0);
      for(const environment of [this.studio,this.landscape]){environment.scale.setScalar(.001);environment.position.set(-P.R*Math.sin(theta)/1000,(P.R*Math.cos(theta)-r)/1000,0);environment.rotation.z=theta;}
    }
    if(space&&f&&O.elements(f.state).r>2*P.R)distance=Math.max(distance,(O.elements(f.state).r*3/P.R+1)/Math.tan(Math.PI/9)*1.1/this.zoom);
    if(factory||!f){this.studio.scale.setScalar(1);this.studio.position.set(0,0,0);this.studio.rotation.z=0;}
    this.camera.near=space?.05:factory?.1:Math.max(.0001,distance*.00005);this.camera.far=space?Math.max(150,distance*4):factory?500:Math.max(20000,distance*6);this.camera.position.copy(target).add(new THREE.Vector3(Math.sin(this.yaw)*Math.cos(this.pitch)*distance,Math.sin(this.pitch)*distance,Math.cos(this.yaw)*Math.cos(this.pitch)*distance));this.camera.lookAt(target);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
    this.stars.visible=space||Boolean(f&&altitude>25000);this.stars.material.transparent=true;this.stars.material.opacity=space?1:THREE.MathUtils.smoothstep(altitude,25000,120000);this.stars.material.depthWrite=false;this.stars.position.copy(this.camera.position);this.stars.scale.setScalar(this.camera.far/140);
    this.rocket.visible=(!space||Boolean(f))&&!this.assemblyPreview?.visible;
    if(this.assemblyPreview?.visible){this.assemblyPreview.position.copy(this.rocket.position);this.assemblyPreview.quaternion.copy(this.rocket.quaternion);this.assemblyPreview.scale.copy(this.rocket.scale);}const lit=f?.controls.lit&&f.controls.throttle>0&&f.fuel[f.active]>0;this.rocket.userData.flame.visible=Boolean(lit);if(lit)this.rocket.userData.flame.scale.y=this.reducedMotion?.9:.8+.15*Math.sin(performance.now()*.035);
    this.velocityArrow.visible=Boolean(f&&Math.hypot(f.state[3],f.state[4])>.1);this.thrustArrow.visible=Boolean(lit);if(f){const theta=space?0:Math.atan2(f.state[1],f.state[0]),o=O.elements(f.state),base=this.rocket.position.clone().add(new THREE.Vector3(0,height*this.rocket.scale.y*.5,0));for(const [arrow,direction,length]of [[this.velocityArrow,new THREE.Vector3(space?f.state[4]:o.tangential,space?f.state[3]:o.radial,0),space?.55:height*this.rocket.scale.y],[this.thrustArrow,new THREE.Vector3(Math.sin(f.attitude-theta),Math.cos(f.attitude-theta),0),space?.4:height*this.rocket.scale.y*.75]]){arrow.position.copy(base);arrow.scale.setScalar(length);if(direction.lengthSq())arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());}}
    try{this.renderer.render(this.scene,this.camera);}catch(_){this.lost=true;this.onFault('render');}
  }
  project(position){const p=position.clone().project(this.camera);const r=this.host.getBoundingClientRect();return {x:(p.x+1)*r.width/2,y:(1-p.y)*r.height/2,visible:p.z>=-1&&p.z<=1&&Math.abs(p.x)<.98&&Math.abs(p.y)<.98};}
  slotPoints(part=null,source=null){
    if(!this.rocket)return [];this.rocket.updateMatrixWorld();const engine=part?.startsWith('engine-'),tank=part&&!engine;
    const point=(stage,y,at,gap=false)=>{const p=this.project(this.rocket.localToWorld(new THREE.Vector3(0,y,0))),bodyX=p.x,bodyY=p.y;if(part)p.x=Math.max(28,Math.min(this.host.clientWidth-28,p.x+(engine||gap?-1:1)*58));else p.x+=48;p.y=Math.max(28,Math.min(this.host.clientHeight-96,p.y));return {...p,bodyX,bodyY,localY:y,stage,at,gap,compatible:!part||source?.stage===stage||P.canFit(this.data.craft,stage,part)};};
    const points=this.rocket.userData.slots.map((middle,i)=>{const r=this.rocket.userData.ranges[i],at=tank?r.joins.length-1:undefined,y=!part?middle:engine?r.base+.85:at?r.joins[at]:r.base+r.engine+2.05;return point(i,y,at);});
    if(tank)for(const [i,r]of this.rocket.userData.ranges.entries())r.joins.slice(0,-1).forEach((y,at)=>points.push(point(i,y,at,true)));return points;
  }
  gripRect(){
    if(!this.rocket?.userData.parts.length)return null;this.rocket.updateMatrixWorld();const box=this.rocket.userData.partBounds.clone().applyMatrix4(this.rocket.matrixWorld);
    const points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(this.project(new THREE.Vector3(x,y,z)));
    const left=Math.min(...points.map(p=>p.x))-5,right=Math.max(...points.map(p=>p.x))+5,top=Math.min(...points.map(p=>p.y))-5,bottom=Math.max(...points.map(p=>p.y))+5,width=Math.max(44,right-left),height=Math.max(44,bottom-top);return {left:(left+right-width)/2,top:(top+bottom-height)/2,width,height};
  }
  pickPart(x,y,touch=false){
    if(!this.data?.workshop)return null;const rect=this.host.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x/rect.width*2-1,1-y/rect.height*2),this.camera);
    for(const hit of ray.intersectObjects(this.rocket.userData.parts,true)){let node=hit.object;while(node&&!node.userData.part)node=node.parent;if(node?.userData.part)return {...node.userData.part};}
    if(touch){let best=null,distance=24;for(const part of this.rocket.userData.parts){const p=this.project(new THREE.Box3().setFromObject(part).getCenter(new THREE.Vector3())),d=Math.hypot(p.x-x,p.y-y);if(d<distance){distance=d;best={...part.userData.part};}}return best;}return null;
  }
  partPoints(){return this.rocket?.userData.parts.map(part=>({...part.userData.part,...this.project(new THREE.Box3().setFromObject(part).getCenter(new THREE.Vector3()))}))||[];}
  dragPart(part,x,y,snap,source,craft){
    const key=craft?JSON.stringify(craft):null;
    if(key!==this.assemblyPreviewKey){if(this.assemblyPreview){this.scene.remove(this.assemblyPreview);dispose(this.assemblyPreview);this.assemblyPreview=null;}this.assemblyPreviewKey=key;if(craft){this.assemblyPreview=buildRocket(craft,false);this.scene.add(this.assemblyPreview);}}
    if(this.assemblyPreview){this.assemblyPreview.visible=true;if(this.dragGhost)this.dragGhost.visible=false;this.draw();return;}
    if(!part){if(this.dragGhost)this.dragGhost.visible=false;for(const p of this.rocket?.userData.parts||[])p.visible=true;this.draw();return;}
    if(this.ghostPart!==part){if(this.dragGhost){this.scene.remove(this.dragGhost);dispose(this.dragGhost);}const c=P.emptyCraft(0);if(part.startsWith('engine-'))c.stages[0].engine=Number(part.slice(-1));else c.stages[0][part]=1;const temporary=buildRocket(c,false),piece=temporary.userData.parts[0],center=new THREE.Box3().setFromObject(piece).getCenter(new THREE.Vector3());piece.traverse(o=>{if(o.isMesh){o.geometry=o.geometry.clone();o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.65;}});temporary.remove(piece);dispose(temporary);piece.position.sub(center);this.dragGhost=new THREE.Group();this.dragGhost.add(piece);this.scene.add(this.dragGhost);this.ghostPart=part;}
    for(const p of this.rocket.userData.parts)p.visible=!(source&&p.userData.part.stage===source.stage&&p.userData.part.part===source.part&&p.userData.part.ordinal===source.ordinal);
    this.dragGhost.visible=x>=0&&y>=0&&x<=this.host.clientWidth&&y<=this.host.clientHeight;
    if(snap!==null){const point=this.slotPoints(part,source)[snap];this.dragGhost.position.copy(this.rocket.localToWorld(new THREE.Vector3(0,point.localY,0)));}
    else{const ray=new THREE.Raycaster(),normal=this.camera.getWorldDirection(new THREE.Vector3()),center=new THREE.Vector3(0,this.rocket.userData.height/2,0);ray.setFromCamera(new THREE.Vector2(x/this.host.clientWidth*2-1,1-y/this.host.clientHeight*2),this.camera);ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(normal,center),this.dragGhost.position);}
    this.draw();
  }
  nodePoint(angle){if(!this.data?.flight)return null;const o=O.elements(this.data.flight.state);if(!o.bound)return null;const q=O.atAngle(o,angle);return this.project(new THREE.Vector3(q[1]*3/P.R,q[0]*3/P.R,0));}
  angleAt(x,y){const rect=this.host.getBoundingClientRect(),pointer=new THREE.Vector2(x/rect.width*2-1,1-y/rect.height*2),ray=new THREE.Raycaster();ray.setFromCamera(pointer,this.camera);const p=new THREE.Vector3(),hit=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),0),p);return hit?O.wrap(Math.atan2(p.x,p.y)):null;}
  magnify(canvas,x,y){const source=this.renderer.domElement,rect=this.host.getBoundingClientRect(),ratio=source.width/rect.width,context=canvas.getContext('2d');this.draw();context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(source,(x-45)*ratio,(y-30)*ratio,90*ratio,60*ratio,0,0,canvas.width,canvas.height);context.strokeStyle='#eeaf42';context.lineWidth=3;context.beginPath();context.arc(canvas.width/2,canvas.height/2,12,0,Math.PI*2);context.moveTo(canvas.width/2-18,canvas.height/2);context.lineTo(canvas.width/2+18,canvas.height/2);context.moveTo(canvas.width/2,canvas.height/2-18);context.lineTo(canvas.width/2,canvas.height/2+18);context.stroke();}
  diagnostics(){return {webgl2:this.renderer.capabilities.isWebGL2!==false,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,pixelRatio:this.renderer.getPixelRatio(),lost:this.lost,skyFraction:this.skyFraction,landscapeVisible:this.landscape.visible,padVisible:this.studio.visible,padPosition:this.studio.position.toArray(),launchArea:this.landscape.userData,parts:this.rocket?.userData.parts.length||0,ghostVisible:Boolean(this.dragGhost?.visible),assemblyPreviewVisible:Boolean(this.assemblyPreview?.visible),assemblyPreviewCraft:this.assemblyPreviewKey?JSON.parse(this.assemblyPreviewKey):null};}
}
