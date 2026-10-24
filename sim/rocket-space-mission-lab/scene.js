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
  const group=new THREE.Group(),white=material('#f8f4e4'),dark=material('#425a5b'),metal=material('#b8c9c1',{metalness:.5}),mint=material('#5ba899'),orange=material('#ea9469'),slots=[];let y=0;
  const mesh=(geometry,mat,x,yy,z,parent=group)=>{const m=new THREE.Mesh(geometry,mat);m.position.set(x,yy,z);parent.add(m);return m;};
  c.stages.forEach((s,i)=>{
    if(separated&&i===0)return;
    const base=y,accent=s.engine===0?orange:mint;
    if(s.engine!==null){mesh(new THREE.CylinderGeometry(.8,1.38,1.5,16,1,true),dark,0,y+.75,0);mesh(new THREE.CylinderGeometry(1.1,1.1,.45,16),metal,0,y+1.55,0);y+=2;}
    const tanks=[...Array(s.large).fill(4.1),...Array(s.small).fill(2.4)];
    tanks.forEach(h=>{mesh(new THREE.CylinderGeometry(1.4,1.4,h,20),white,0,y+h/2,0);for(const dy of [.2,h-.2])mesh(new THREE.CylinderGeometry(1.43,1.43,.23,20),accent,0,y+dy,0);mesh(new THREE.BoxGeometry(.14,h*.68,.08),metal,0,y+h/2,1.39);y+=h;});
    if(tanks.length===0){mesh(new THREE.CylinderGeometry(1.35,1.35,3,16),material('#a7c0b7',{transparent:true,opacity:.3,wireframe:true}),0,y+1.5,0);y+=3;}
    slots[i]=(base+y)/2;
    if(i===0&&c.stages.length===2&&!separated){mesh(new THREE.CylinderGeometry(1.47,1.47,.65,20),orange,0,y+.325,0);y+=.65;}
  });
  mesh(new THREE.CylinderGeometry(1.25,1.4,2,20),white,0,y+1,0);mesh(new THREE.SphereGeometry(1.25,20,12,0,Math.PI*2,0,Math.PI/2),white,0,y+2,0);const faceY=y+1.1;
  for(const side of [-1,1]){mesh(new THREE.SphereGeometry(.16,10,8),dark,side*.4,faceY,1.24);mesh(new THREE.SphereGeometry(.07,8,6),material('#ffffff'),side*.4-.03,faceY+.05,1.37);}
  const smile=new THREE.TorusGeometry(.24,.035,6,14,Math.PI);const mouth=mesh(smile,dark,0,faceY-.25,1.32);mouth.rotation.z=Math.PI;
  mesh(new THREE.CylinderGeometry(.04,.04,1.1,8),metal,0,y+3.6,0);mesh(new THREE.SphereGeometry(.17,10,8),orange,0,y+4.15,0);
  const flame=new THREE.Group();flame.position.y=-.2;mesh(new THREE.ConeGeometry(.95,4,12),material('#f1a44d',{emissive:'#eb7830',emissiveIntensity:.5}),0,-2,0,flame).rotation.z=Math.PI;mesh(new THREE.ConeGeometry(.5,2.5,12),material('#fff1ad',{emissive:'#ffdf94',emissiveIntensity:.7}),0,-1.2,.05,flame).rotation.z=Math.PI;flame.visible=false;group.add(flame);group.userData={slots,height:y+4.4,flame};return group;
}
function vectorArrow(color){const group=new THREE.Group(),mat=material(color,{emissive:color,emissiveIntensity:.3}),shaft=new THREE.Mesh(new THREE.CylinderGeometry(.026,.026,.74,8),mat),head=new THREE.Mesh(new THREE.ConeGeometry(.09,.26,10),mat);shaft.position.y=.37;head.position.y=.87;group.add(shaft,head);return group;}
export class RocketScene{
  constructor(host,onFault){
    this.host=host;this.onFault=onFault;this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<960?1.5:2));this.renderer.setClearColor('#dbece2');this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.35;host.append(this.renderer.domElement);
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(40,1,.01,50000);this.scene.add(new THREE.HemisphereLight('#fafff3','#7b9891',2.8));const light=new THREE.DirectionalLight('#fff6d8',3.6);light.position.set(30,40,40);this.scene.add(light);const fill=new THREE.DirectionalLight('#80bce0',1);fill.position.set(-20,10,-30);this.scene.add(fill);
    this.studio=new THREE.Group();this.scene.add(this.studio);const pad=new THREE.Mesh(new THREE.CylinderGeometry(6,6.5,.65,48),material('#869c91'));pad.position.y=-.4;this.studio.add(pad);const inset=new THREE.Mesh(new THREE.CylinderGeometry(5,5,.08,48),material('#cdd9c9'));inset.position.y=-.01;this.studio.add(inset);const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),material('#d7e7d7'));floor.rotation.x=-Math.PI/2;floor.position.y=-.8;this.studio.add(floor);const grid=new THREE.GridHelper(100,20,'#c0d1be','#c4d5c1');grid.position.y=-.77;this.studio.add(grid);
    for(const side of [-1,1]){const tower=new THREE.Mesh(new THREE.BoxGeometry(.45,12,.45),material('#a2b7a8'));tower.position.set(side*6,5,0);this.studio.add(tower);const lamp=new THREE.Mesh(new THREE.SphereGeometry(.36,10,8),material('#f4c475',{emissive:'#dda45c',emissiveIntensity:.5}));lamp.position.set(side*6,11.2,0);this.studio.add(lamp);}
    this.earthMap=earthTexture();this.earth=new THREE.Mesh(new THREE.SphereGeometry(1,64,40),new THREE.MeshStandardMaterial({map:this.earthMap,roughness:1,metalness:0}));this.earth.rotation.y=.7;this.scene.add(this.earth);
    this.halo=new THREE.Mesh(new THREE.SphereGeometry(1,48,32),new THREE.MeshBasicMaterial({color:'#77bccc',transparent:true,opacity:.08,side:THREE.BackSide,depthWrite:false}));this.scene.add(this.halo);
    const coords=[],rng=(()=>{let t=512;return()=>{t=(t*1664525+1013904223)>>>0;return t/4294967296;};})();for(let i=0;i<450;i++){const a=rng()*Math.PI*2,b=Math.acos(2*rng()-1);coords.push(70*Math.sin(b)*Math.cos(a),70*Math.cos(b),70*Math.sin(b)*Math.sin(a));}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));this.stars=new THREE.Points(geo,new THREE.PointsMaterial({color:'#e0eee5',size:.075,sizeAttenuation:true}));this.scene.add(this.stars);
    this.velocityArrow=vectorArrow('#70cecb');this.thrustArrow=vectorArrow('#f7bb72');this.scene.add(this.velocityArrow,this.thrustArrow);this.lines={};this.data=null;this.view='factory';this.yaw=.55;this.pitch=.18;this.zoom=1;this.lost=false;this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;onFault('lost');});this.renderer.domElement.addEventListener('webglcontextrestored',()=>{this.lost=false;this.renderer.resetState();onFault('restored');this.draw();});
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
  }
  resize(){const {width,height}=this.host.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.draw();}
  setView(view){this.view=view;this.yaw=view==='plane'?0:view==='orbit'?.2:.55;this.pitch=view==='plane'?0:.18;this.zoom=1;this.draw();}
  rotate(dx,dy){this.yaw+=dx*.008;this.pitch=Math.max(-1.15,Math.min(1.15,this.pitch+dy*.006));this.draw();}
  setData(data){this.data=data;const key=JSON.stringify([data.craft,data.flight?.separated]);if(key!==this.craftKey){if(this.rocket){this.scene.remove(this.rocket);dispose(this.rocket);}this.rocket=buildRocket(data.craft,Boolean(data.flight?.separated));this.scene.add(this.rocket);this.craftKey=key;}this.draw();}
  line(name,points,color,dashed=false){
    const old=this.lines[name];if(old){this.scene.remove(old);old.geometry.dispose();old.material.dispose();delete this.lines[name];}if(points.length<2)return;
    const geometry=new THREE.BufferGeometry().setFromPoints(points.map(q=>new THREE.Vector3(q[1]*3/P.R,q[0]*3/P.R,q[2]*3/P.R))),mat=dashed?new THREE.LineDashedMaterial({color,dashSize:.035,gapSize:.025,transparent:true,opacity:.9}):new THREE.LineBasicMaterial({color,transparent:true,opacity:.9}),line=new THREE.Line(geometry,mat);if(dashed)line.computeLineDistances();this.scene.add(line);this.lines[name]=line;
  }
  setPaths(actual,predicted,planned){this.line('actual',actual,'#ee9674');this.line('predicted',predicted,'#b0e3d4',true);this.line('planned',planned,'#f6ca74',true);}
  draw(){
    if(!this.data||!this.rocket||this.lost)return;const {flight:f,workshop}=this.data,space=['orbit','plane'].includes(this.view),factory=workshop&&this.view==='factory',height=this.rocket.userData.height;
    this.studio.visible=factory||(!space&&(!f||f.state[0]===P.R&&f.state[1]===0));this.earth.visible=space||(!factory&&Boolean(f));this.halo.visible=this.earth.visible;this.stars.visible=space;Object.values(this.lines).forEach(l=>l.visible=space);
    this.renderer.setClearColor(space?'#101e2b':factory?'#dcebe0':f&&O.elements(f.state).height>70000?'#162a3b':'#bcdedc');
    const target=new THREE.Vector3();let distance;
    if(space){this.earth.position.set(0,0,0);this.earth.scale.setScalar(3);this.halo.position.copy(this.earth.position);this.halo.scale.setScalar(3.045);this.rocket.scale.setScalar(.33/height);this.rocket.position.set(f?f.state[1]*3/P.R:0,f?f.state[0]*3/P.R:3,0);this.rocket.rotation.z=f?-f.attitude:0;target.set(0,.3,0);const h=this.host.clientHeight;distance=Math.max(14.5,3*h/(2*Math.tan(Math.PI/9)*Math.max(20,(h-130)/2)))/this.zoom;}
    else if(factory||!f){this.rocket.scale.setScalar(1);this.rocket.position.set(0,0,0);this.rocket.rotation.z=0;target.set(0,height*.44,0);distance=Math.max(24,height*1.85)/this.zoom;}
    else{const r=Math.hypot(f.state[0],f.state[1]),theta=Math.atan2(f.state[1],f.state[0]);this.earth.position.set(0,-r/1000,0);this.earth.scale.setScalar(P.R/1000);this.halo.position.copy(this.earth.position);this.halo.scale.setScalar((P.R+80000)/1000);this.rocket.scale.setScalar(.001);this.rocket.position.set(0,0,0);this.rocket.rotation.z=theta-f.attitude;target.set(0,height*.00055,0);distance=Math.max(.035,height*.0028)/this.zoom;this.studio.scale.setScalar(.001);}
    if(factory||!f)this.studio.scale.setScalar(1);this.camera.near=space?.05:factory?.1:.0001;this.camera.far=space?150:factory?500:20000;this.camera.position.copy(target).add(new THREE.Vector3(Math.sin(this.yaw)*Math.cos(this.pitch)*distance,Math.sin(this.pitch)*distance,Math.cos(this.yaw)*Math.cos(this.pitch)*distance));this.camera.lookAt(target);this.camera.updateProjectionMatrix();
    this.rocket.visible=!space||Boolean(f);const lit=f?.controls.lit&&f.controls.throttle>0&&f.fuel[f.active]>0;this.rocket.userData.flame.visible=Boolean(lit);if(lit)this.rocket.userData.flame.scale.y=this.reducedMotion?.9:.8+.15*Math.sin(performance.now()*.035);
    this.velocityArrow.visible=Boolean(f&&Math.hypot(f.state[3],f.state[4])>.1);this.thrustArrow.visible=Boolean(lit);if(f){const theta=space?0:Math.atan2(f.state[1],f.state[0]),o=O.elements(f.state),base=this.rocket.position.clone().add(new THREE.Vector3(0,height*this.rocket.scale.y*.5,0));for(const [arrow,direction,length]of [[this.velocityArrow,new THREE.Vector3(space?f.state[4]:o.tangential,space?f.state[3]:o.radial,0),space?.55:height*.001],[this.thrustArrow,new THREE.Vector3(Math.sin(f.attitude-theta),Math.cos(f.attitude-theta),0),space?.4:height*.00075]]){arrow.position.copy(base);arrow.scale.setScalar(length);if(direction.lengthSq())arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());}}
    this.renderer.render(this.scene,this.camera);
  }
  project(position){const p=position.clone().project(this.camera);const r=this.host.getBoundingClientRect();return {x:(p.x+1)*r.width/2,y:(1-p.y)*r.height/2,visible:p.z>=-1&&p.z<=1&&Math.abs(p.x)<.98&&Math.abs(p.y)<.98};}
  slotPoints(){if(!this.rocket)return [];this.rocket.updateMatrixWorld();return this.rocket.userData.slots.map(y=>this.project(this.rocket.localToWorld(new THREE.Vector3(1.7,y,0))));}
  nodePoint(angle){if(!this.data?.flight)return null;const o=O.elements(this.data.flight.state);if(!o.bound)return null;const q=O.atAngle(o,angle);return this.project(new THREE.Vector3(q[1]*3/P.R,q[0]*3/P.R,0));}
  angleAt(x,y){const rect=this.host.getBoundingClientRect(),pointer=new THREE.Vector2(x/rect.width*2-1,1-y/rect.height*2),ray=new THREE.Raycaster();ray.setFromCamera(pointer,this.camera);const p=new THREE.Vector3(),hit=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),0),p);return hit?O.wrap(Math.atan2(p.x,p.y)):null;}
  magnify(canvas,x,y){const source=this.renderer.domElement,rect=this.host.getBoundingClientRect(),ratio=source.width/rect.width,context=canvas.getContext('2d');this.draw();context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(source,(x-45)*ratio,(y-30)*ratio,90*ratio,60*ratio,0,0,canvas.width,canvas.height);}
  diagnostics(){return {webgl2:this.renderer.capabilities.isWebGL2!==false,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,pixelRatio:this.renderer.getPixelRatio(),lost:this.lost};}
}
