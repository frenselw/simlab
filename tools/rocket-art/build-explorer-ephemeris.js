'use strict';
// Run with Node and network access. The simulation reads only the local data.
const {writeFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {createHash}=require('node:crypto');
const {setTimeout:delay}=require('node:timers/promises');
const assert=require('node:assert/strict');
const surface=require('../../sim/rocket-side-booster-lab/surface');

const endpoint='https://ssd.jpl.nasa.gov/api/horizons.api';
const start=Date.UTC(2026,0,1),step=21600000,count=1489;
const times=['2026-Mar-20 20:17','2026-Jun-21 19:19','2026-Dec-21 20:13','2027-Jan-07 22:11'];
const radians=Math.PI/180;

async function horizons(target,options){
  const params={format:'text',COMMAND:"'"+target+"'",EPHEM_TYPE:"'OBSERVER'",TIME_TYPE:"'UT'",TIME_ZONE:"'+00:00'",CSV_FORMAT:"'YES'",APPARENT:"'AIRLESS'",ANG_FORMAT:"'DEG'",RANGE_UNITS:"'KM'",...options};
  const url=endpoint+'?'+new URLSearchParams(params);
  let response=await fetch(url,{signal:AbortSignal.timeout(40000)});
  for(const wait of [1000,3000]){
    if(response.status!==503&&response.status!==429)break;
    await response.body?.cancel();
    await delay(wait);
    response=await fetch(url,{signal:AbortSignal.timeout(40000)});
  }
  assert(response.ok,'Horizons HTTP '+response.status);
  const text=await response.text(),data=text.split('$$SOE')[1]?.split('$$EOE')[0];
  assert(data&&text.includes('{source: DE441}'),'Expected Horizons DE441 data: '+text.slice(-400));
  return {url,text,rows:data.trim().split(/\r?\n/).map(line=>line.split(',').map(value=>value.trim()))};
}

async function main(){
  const span={CENTER:"'500@399'",START_TIME:"'2026-01-01'",STOP_TIME:"'2027-01-08'",STEP_SIZE:"'6 h'",QUANTITIES:"'2,20'"};
  const sun=await horizons(10,span),moon=await horizons(301,span);
  const series=[sun,moon].map(({text,rows},body)=>{
    assert.match(text,/Earth equator\s+of-date/);
    assert.match(text,/R\.A\._\(a-app\).*DEC_\(a-app\).*delta/);
    assert.equal(rows.length,count);
    return rows.flatMap(([date,,,ra,dec,range],index)=>{
      assert.equal(Date.parse(date.replaceAll('-',' ')+' UTC'),start+index*step);
      const [a,d,r]=[Number(ra)*radians,Number(dec)*radians,Number(range)];
      assert(ra&&dec&&range&&[a,d,r].every(Number.isFinite)&&a>=0&&a<2*Math.PI&&Math.abs(d)<=Math.PI/2);
      assert(body?r>340000&&r<420000:r>145e6&&r<155e6);
      return [r*Math.cos(d)*Math.cos(a),r*Math.cos(d)*Math.sin(a),r*Math.sin(d)].map(Math.round);
    });
  });
  const sites=[surface.geographic(0,1,0).concat(0),[113.5439,22.1987,0]];
  const references=[];
  for(const site of sites){
    const query=target=>horizons(target,{
      CENTER:"'coord@399'",COORD_TYPE:"'GEODETIC'",SITE_COORD:"'"+site.join(',')+"'",
      TLIST:times.map(time=>"'"+time+"'").join(' '),TLIST_TYPE:"'CAL'",QUANTITIES:target===10?"'4'":"'4,10'"
    });
    const queries=[await query(10),await query(301)];
    references.push({site,queries:queries.map(q=>q.url),rows:queries.map(({text,rows},body)=>{
      assert.match(text,/Azi_\(a-app\).*Elev_\(a-app\)/);
      assert.equal(rows.length,times.length);
      return rows.map(([date,,,az,el,phase],index)=>{
        assert(date.startsWith(times[index])&&az&&el&&(!body||phase),JSON.stringify(rows[index]));
        const values=[Number(az),Number(el),...(body?[Number(phase)]:[])];
        assert(values.every(Number.isFinite));
        return [Date.parse(date.replaceAll('-',' ')+' UTC'),...values];
      });
    })});
  }
  const file=JSON.stringify({start,step,sun:series[0],moon:series[1]})+'\n';
  assert(Buffer.byteLength(file)<=128*1024);
  writeFileSync(resolve(__dirname,'../../sim/rocket-side-booster-lab/assets/sky-ephemeris.json'),file);
  writeFileSync(resolve(__dirname,'explorer-ephemeris-reference.json'),JSON.stringify({
    source:'JPL Horizons DE441',queries:[sun.url,moon.url],sha256:createHash('sha256').update(file).digest('hex'),references
  },null,2)+'\n');
}

main().catch(error=>{console.error(error);process.exitCode=1;});
