'use strict';
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {createHash}=require('node:crypto');
const Sky=require('./sky'),S=require('./surface'),P=require('./parts'),L=require('./lighting');
const reference=require('../../tools/rocket-art/explorer-ephemeris-reference.json');
const file=readFileSync(require.resolve('./assets/sky-ephemeris.json'));
assert.equal(createHash('sha256').update(file).digest('hex'),reference.sha256);
const data=Sky.validate(JSON.parse(file)),radians=Math.PI/180,days=86400000;
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
function directions(lon,lat){
  lon*=radians;lat*=radians;
  return [
    [-Math.sin(lon),Math.cos(lon),0],
    [Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)],
    [-Math.sin(lat)*Math.cos(lon),-Math.sin(lat)*Math.sin(lon),Math.cos(lat)]
  ].map(q=>S.fromGeocentric(...q));
}
const maxAngle=[0,0];
let maxPhase=0;
for(const {site,rows}of reference.references){
  const basis=directions(...site),observer=basis[1].map(v=>v*P.R/1000);
  for(const [body,samples]of rows.entries()){
    for(const [utc,az,el,phase]of samples){
      const result=Sky.observe(Sky.at(data,utc),observer);
      const local=basis.map(axis=>dot(result[body?'moon':'sun'],axis));
      const a=az*radians,e=el*radians,expected=[Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)];
      maxAngle[body]=Math.max(maxAngle[body],Math.acos(Math.min(1,dot(local,expected)))/radians);
      if(body)maxPhase=Math.max(maxPhase,Math.abs(result.phase*100-phase));
    }
  }
}
assert(maxAngle[0]<.1&&maxAngle[1]<.2&&maxPhase<2,JSON.stringify({maxAngle,maxPhase}));
assert.equal(S.geographic(...S.fromGeocentric(0,0,1))[1],90);
assert.equal(Sky.departure('2026-03-20','20:00'),Sky.DEFAULT_START);
for(const [date,time]of [['2026-02-29','12:00'],['2026-04-31','12:00'],['2027-01-01','00:00'],['2026-01-01','24:00'],['2026-01-01','']])assert.equal(Sky.departure(date,time),null);
assert(Sky.at(data,Sky.departure('2026-12-31','23:59')+7*days));
assert(Sky.at(data,data.start)&&Sky.at(data,data.start+372*days));
assert.equal(Sky.at(data,data.start-1),null);
assert.equal(Sky.at(data,data.start+372*days+1),null);
assert.throws(()=>Sky.validate({...data,moon:data.moon.slice(3)}));
assert.throws(()=>Sky.validate({...data,sun:data.moon}));

const flight=[P.R,0,0],sunAt=(utc)=>Sky.observe(Sky.at(data,utc),[0,0,0]).sun;
const noon=Sky.DEFAULT_START;
assert(L.solar(flight,sunAt(noon)).daylight>.99);
assert(L.solar(flight,sunAt(noon+12*3600000)).daylight<.01);
const daylightHours=month=>Array.from({length:96},(_,i)=>L.solar(flight,sunAt(Date.UTC(2026,month,21,0,15*i)))).filter(v=>v.elevation>0).length/4;
assert(daylightHours(5)>daylightHours(11)+3);
assert(L.solar(flight,sunAt(Date.UTC(2026,5,21,20))).elevation>L.solar(flight,sunAt(Date.UTC(2026,11,21,20))).elevation);
for(const [month,date,hour,minute,phase]of [[2,19,1,23,0],[2,25,19,18,.5],[3,2,2,12,1],[3,10,4,51,.5]]){
  const {moonRadius,sunRadius,phase:actual}=Sky.observe(Sky.at(data,Date.UTC(2026,month,date,hour,minute)),[0,0,0]);
  assert(Math.abs(actual-phase)<.02&&moonRadius>.004&&moonRadius<.006&&sunRadius>.004&&sunRadius<.006);
}
console.log('Explorer sky matches independent Horizons samples:',{maxAngle,maxPhase});
