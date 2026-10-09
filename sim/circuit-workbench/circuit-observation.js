(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CircuitObservation=api;})(globalThis,function(){
  'use strict';
  // ponytail: 512 time bins bound memory even for stiff circuits; more bins if meter accuracy requirements exceed 0.5%.
  class Tracker {
    constructor(period){this.window=period;this.width=period/512;this.bins=[];this.previous=null;this.start=null;}
    sample(result){
      const values=Object.fromEntries(Object.entries(result.components).map(([id,r])=>[id,{u:r.sensedVoltage!==undefined?r.sensedVoltage:r.voltage,i:r.current}])),next={time:result.time,values};
      for(const [id,r]of Object.entries(result.components))if(r.secondaryVoltage!==undefined)values[id+'~secondary']={u:r.secondaryVoltage,i:r.secondaryCurrent};
      for(const [id,r]of Object.entries(result.wires))values['wire:'+id]={u:r.voltage,i:r.current};
      if(!this.previous||next.time<=this.previous.time){this.previous=next;if(this.start===null)this.start=next.time;return;}
      const old=this.previous,h=next.time-old.time;let begin=old.time;
      // Snap bin boundaries above float roundoff so an accepted step never loses its remainder.
      while(begin<next.time-1e-14){const at=Math.floor(begin/this.width+1e-8),end=Math.min(next.time,(at+1)*this.width),duration=end-begin;if(duration<=0)break;
        let bin=this.bins.at(-1);if(!bin||bin.at!==at){bin={at,start:begin,end,values:{}};this.bins.push(bin);}bin.end=end;
        const x0=(begin-old.time)/h,x1=(end-old.time)/h;
        for(const [id,v]of Object.entries(values)){const before=old.values[id];if(!before||![before.u,before.i,v.u,v.i].every(Number.isFinite))continue;
          const u0=before.u+(v.u-before.u)*x0,u1=before.u+(v.u-before.u)*x1,i0=before.i+(v.i-before.i)*x0,i1=before.i+(v.i-before.i)*x1,q=bin.values[id]||(bin.values[id]={duration:0,u2:0,i2:0,p:0});
          q.duration+=duration;q.u2+=duration*(u0*u0+u0*u1+u1*u1)/3;q.i2+=duration*(i0*i0+i0*i1+i1*i1)/3;q.p+=duration*(2*u0*i0+u0*i1+u1*i0+2*u1*i1)/6;
        }
        begin=end;
      }
      const threshold=next.time-this.window-this.width;while(this.bins[0]?.end<threshold)this.bins.shift();this.previous=next;
    }
    measure(id){const end=this.previous?.time??0,start=end-this.window;if(this.start===null||start<this.start-1e-10)return {status:'collecting',start:Math.max(0,start),end,window:this.window};
      const sum={duration:0,u2:0,i2:0,p:0};for(const bin of this.bins){const overlap=Math.max(0,Math.min(end,bin.end)-Math.max(start,bin.start)),q=bin.values[id];if(!q||!overlap)continue;const factor=overlap/(bin.end-bin.start);for(const k of Object.keys(sum))sum[k]+=q[k]*factor;}
      if(sum.duration<this.window*(1-1e-6))return {status:'unknown',start,end,window:this.window};
      return {status:'ready',start,end,window:this.window,voltageRms:Math.sqrt(Math.max(0,sum.u2/sum.duration)),currentRms:Math.sqrt(Math.max(0,sum.i2/sum.duration)),averagePower:sum.p/sum.duration};
    }
  }
  function channels(doc){const options=[];for(const c of doc.components){options.push({key:c.id+':voltage',id:c.id,quantity:'voltage',label:c.label+' · 電壓',unit:'V'},{key:c.id+':current',id:c.id,quantity:'current',label:c.label+' · 電流',unit:'A'});if(c.type==='capacitor')options.push({key:c.id+':charge',id:c.id,quantity:'charge',label:c.label+' · 電荷',unit:'C'});if(['capacitor','inductor','transformer'].includes(c.type))options.push({key:c.id+':energy',id:c.id,quantity:'energy',label:c.label+' · 儲能',unit:'J'});if(c.type==='generator')options.push({key:c.id+':flux',id:c.id,quantity:'flux',label:c.label+' · 磁通量',unit:'Wb'});}return options;}
  class Buffer {
    constructor(limit=2048){this.limit=limit;this.points=[];}
    sample(result){this.points.push({time:result.time,values:Object.fromEntries(Object.entries(result.components).map(([id,c])=>[id,{voltage:c.voltage,current:c.current,charge:c.charge,energy:c.energy,flux:c.flux}]))});if(this.points.length>this.limit)this.points.splice(0,this.points.length-this.limit);}
    clear(){this.points=[];}
  }
  function phase(points,a,b,frequency){if(points.length<16||!(frequency>0))return null;const end=points.at(-1).time,start=end-2/frequency,rows=points.filter(p=>p.time>=start);if(rows[0]?.time>start+1/frequency/20)return null;
    const fit=channel=>{const values=rows.map(p=>p.values[channel.id]?.[channel.quantity]);if(values.some(v=>!Number.isFinite(v)))return null;const mean=values.reduce((s,v)=>s+v,0)/values.length;let sine=0,cosine=0;for(let i=1;i<rows.length;i++){const dt=rows[i].time-rows[i-1].time,angle=2*Math.PI*frequency*(rows[i].time+rows[i-1].time)/2,v=(values[i]+values[i-1])/2-mean;sine+=dt*v*Math.sin(angle);cosine+=dt*v*Math.cos(angle);}const amplitude=Math.hypot(sine,cosine)*frequency;if(amplitude<1e-12)return null;const angle=Math.atan2(cosine,sine);let error=0,total=0;for(let i=1;i<rows.length;i++){const dt=rows[i].time-rows[i-1].time,expected=amplitude*Math.sin(2*Math.PI*frequency*rows[i].time+angle);error+=dt*(values[i]-mean-expected)**2;total+=dt*(values[i]-mean)**2;}return error/Math.max(total,1e-24)<.005?angle:null;};
    const x=fit(a),y=fit(b);return x===null||y===null?null:((y-x)*180/Math.PI+540)%360-180;
  }
  return {Tracker,Buffer,channels,phase};
});
