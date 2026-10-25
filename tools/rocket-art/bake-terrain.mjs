import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const source=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),E=source.extent,R=6371000,N=257,step=2*E/(N-1),heights=new Float32Array(N*N);
// Sample the same coarse color field that remains visible around the regional mesh.
const globe=fs.readFileSync('sim/rocket-space-mission-lab/assets/global/coarse.bin'),gl=globe.readUInt32LE(0),gh=JSON.parse(globe.toString('utf8',4,4+gl)),gs=4+Math.ceil(gl/4)*4,gi=gs+gh.vertexCount*16,colorTriangles=[];
const vertex=i=>({x:globe.readFloatLE(gs+i*12)*R,z:globe.readFloatLE(gs+i*12+8)*R,y:globe.readFloatLE(gs+i*12+4),color:Array.from({length:3},(_,k)=>globe[gs+gh.vertexCount*12+i*4+k]/255)});
for(let i=0;i<gh.indexCount;i+=3){const p=[0,1,2].map(k=>vertex(globe.readUInt32LE(gi+(i+k)*4)));if(p.some(v=>v.y<.99))continue;const box=[Math.min(...p.map(v=>v.x)),Math.max(...p.map(v=>v.x)),Math.min(...p.map(v=>v.z)),Math.max(...p.map(v=>v.z))];if(box[0]>E||box[1]<-E||box[2]>E||box[3]<-E)continue;colorTriangles.push({p,box});}
function globalColor(x,z){let nearest=null,best=Infinity;for(const {p:[a,b,c],box}of colorTriangles){for(const v of [a,b,c]){const distance=(x-v.x)**2+(z-v.z)**2;if(distance<best){best=distance;nearest=v.color;}}if(x<box[0]||x>box[1]||z<box[2]||z>box[3])continue;const d=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(d)<1e-6)continue;const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/d,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/d;if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)return a.color.map((n,k)=>u*n+v*b.color[k]+(1-u-v)*c.color[k]);}assert(nearest,'Regional color source');return nearest;}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
for(let j=0;j<N;j++)for(let i=0;i<N;i++){
 const x=-E+i*step,z=E-j*step,d=source.shore[j][i];
 let h=110+90*Math.sin(x/15000+Math.sin(z/23000))+70*Math.cos(z/19000-x/32000);
 h=Math.max(12,h)+Math.pow(.5+.5*Math.sin(x/12500+z/29000+Math.sin(z/17000)),2)*1100*smooth(7000,22000,x);
 for(const r of source.ridges)h=Math.max(h,r.h*Math.exp(-(((x-r.x)/(r.r*1.6))**2+((z-r.z)/(r.r*2.1))**2)));
 const valley=Math.abs(z)<2500?1-smooth(140,500,Math.abs(x-(-540+Math.sin(z/4400*Math.PI*3)*90))):0;
 h*=smooth(0,3500,d)*smooth(3000,4500,Math.hypot(x,z))*(1-valley)*(1-smooth(E*.8,E-500,Math.max(Math.abs(x),Math.abs(z))));
 heights[j*N+i]=Math.round(h);
}
function height(x,z){const u=Math.max(0,Math.min(N-1,(x+E)/step)),v=Math.max(0,Math.min(N-1,(E-z)/step)),i=Math.min(N-2,Math.floor(u)),j=Math.min(N-2,Math.floor(v)),a=u-i,b=v-j;return heights[j*N+i]*(1-a)*(1-b)+heights[j*N+i+1]*a*(1-b)+heights[(j+1)*N+i]*(1-a)*b+heights[(j+1)*N+i+1]*a*b;}
function clip(points,axis,bound,sign){const out=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],da=(a[axis]-bound)*sign,db=(b[axis]-bound)*sign;if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}return out;}
function contour(points,box){for(const [axis,bound,sign]of [[0,box[0],1],[0,box[1],-1],[1,box[2],1],[1,box[3],-1]])points=clip(points,axis,bound,sign);const out=[];
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.01)continue;const onBorder=(axis)=>Math.abs(a[axis]-b[axis])<.001&&(Math.abs(a[axis]-box[axis*2])<.001||Math.abs(a[axis]-box[axis*2+1])<.001),axis=onBorder(0)?1:onBorder(1)?0:-1;
 const ts=[0];if(axis>=0){for(let p=Math.ceil(Math.min(a[axis],b[axis])/1500)*1500;p<Math.max(a[axis],b[axis]);p+=1500){const t=(p-a[axis])/(b[axis]-a[axis]);if(t>1e-8&&t<1-1e-8)ts.push(t);}}else for(let n=1;n<Math.ceil(length/1500);n++)ts.push(n/Math.ceil(length/1500));ts.sort((a,b)=>a-b);
 for(const t of ts){const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;out.push([x,z,axis<0?0:height(x,z)]);}}
 return out;
}
const request=[];
const chunks=[],buffers=[Buffer.from(heights.buffer)];let offset=heights.byteLength,totalTriangles=0;
for(let row=0;row<4;row++)for(let col=0;col<4;col++){
 const size=2*E/4,box=[-E+col*size,-E+(col+1)*size,-E+row*size,-E+(row+1)*size];
 const polygons=source.groups.map(rings=>rings.map(r=>contour(r,box)).filter(r=>r.length>=3)).filter(r=>r.length);
 for(const limit of [3000,6500,14000]){request.push({box,limit,polygons});}
}
const result=spawnSync('python',[path.resolve('tools/rocket-art/triangulate-terrain.py')],{input:JSON.stringify(request),encoding:'utf8',maxBuffer:32*1024*1024});if(result.status!==0)throw Error(result.stderr);const meshes=JSON.parse(result.stdout);
for(let k=0;k<meshes.length;k++){
 const {vertices,faces}=meshes[k],requestChunk=request[k],box=requestChunk.box;
 function borderHeight(x,z,given){if(Math.abs(x-box[0])<.01||Math.abs(x-box[1])<.01){const a=Math.floor(z/1500)*1500,t=(z-a)/1500;return height(x,a)*(1-t)+height(x,a+1500)*t;}if(Math.abs(z-box[2])<.01||Math.abs(z-box[3])<.01){const a=Math.floor(x/1500)*1500,t=(x-a)/1500;return height(a,z)*(1-t)+height(a+1500,z)*t;}return given??height(x,z);}
 if(k%3===0)chunks.push({box,levels:[]});const levels=chunks.at(-1).levels;
 const attributes=new Float32Array(vertices.length*10),indices=new Uint32Array(faces.length*3);
 for(let i=0;i<vertices.length;i++){const [x,z,given]=vertices[i],h=borderHeight(x,z,given),curve=Math.sqrt(R*R-x*x-z*z)-R,blend=smooth(1500,5000,Math.hypot(x,z)),y=curve*blend+h-.78+blend*10,dx=(height(x+50,z)-height(x-50,z))/100-x/R,dz=(height(x,z+50)-height(x,z-50))/100-z/R,n=Math.hypot(dx,1,dz),fade=1-smooth(E*.88,E-500,Math.max(Math.abs(x),Math.abs(z)));
 const shade=.50+.70*Math.max(0,(-dx*30+40-dz*40)/(n*Math.hypot(30,40,40)));
 const color=globalColor(x,z),detail=1-smooth(E*.7,E*.88,Math.max(Math.abs(x),Math.abs(z))),localShade=1+detail*(shade/(.50+.70*40/Math.hypot(30,40,40))-1);attributes.set([x,y,z,-dx/n,1/n,-dz/n,...color.map(c=>c*localShade),fade],i*10);}
 for(let i=0;i<faces.length;i++){let [a,b,c]=faces[i];const p=vertices[a],q=vertices[b],r=vertices[c];if((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])>0)[b,c]=[c,b];indices.set([a,b,c],i*3);}
 for(const v of attributes)assert(Number.isFinite(v));for(const i of indices)assert(i<vertices.length);
 const data=Buffer.from(attributes.buffer),index=Buffer.from(indices.buffer);levels.push({offset,vertices:vertices.length,indices:indices.length});buffers.push(data,index);offset+=data.length+index.length;totalTriangles+=faces.length;
 }
const header=Buffer.from(JSON.stringify({version:1,extent:E,heightSize:N,heightBytes:heights.byteLength,chunks})),padded=Math.ceil(header.length/4)*4,prefix=Buffer.alloc(4+padded);prefix.writeUInt32LE(header.length);header.copy(prefix,4);
const output=path.resolve('sim/rocket-space-mission-lab/assets/terrain.bin');fs.writeFileSync(output,Buffer.concat([prefix,...buffers]));
assert.equal(height(0,0),0);assert(height(40000,20000)>100);console.log('Terrain baked:',chunks.length,'chunks;',totalTriangles,'triangles across 3 levels;',fs.statSync(output).size,'bytes');
