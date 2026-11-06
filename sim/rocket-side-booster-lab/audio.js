(function(root,factory){const api=factory(root,typeof module==='object'&&module.exports?require('./parts'):root.RocketParts,typeof module==='object'&&module.exports?require('./model'):root.RocketModel);if(typeof module==='object'&&module.exports)module.exports=api;root.RocketAudio=api;})(typeof window==='undefined'?globalThis:window,function(root,P,M){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),silent=()=>({gain:0,hz:500,bass:55,pan:0});
  function mix(f,pieces=[]){
    const voices=Array.from({length:7},silent);if(!f)return voices;
    const air=clamp(M.atmosphere(Math.hypot(...f.state.slice(0,3))-P.R)/1.225),engine=f.craft.stages[f.active].engine,throttle=f.controls.lit&&f.fuel[f.active]>0?f.controls.throttle:0;
    voices[0]={gain:.32*Math.sqrt(throttle),hz:150+[700,430,560][engine]*throttle,bass:[48,72,60][engine],pan:0};
    voices[1]={gain:P.burning(f)?.21*Math.sqrt(f.craft.boosters/2):0,hz:650,bass:58,pan:0};
    voices[2]={gain:.085*Math.sqrt(air)*clamp(Math.hypot(...f.state.slice(3,6))/500),hz:2400,bass:0,pan:0};
    pieces.slice(0,4).forEach((p,i)=>{const distance=Math.hypot(...p.coast.state.slice(0,3).map((v,j)=>v-f.state[j]));voices[i+3]={gain:p.coast.fuel>0&&p.coast.status==='flying'?.13*Math.sqrt(air)/(1+(distance/35)**2):0,hz:650,bass:58,pan:clamp(p.pan||0,-.95,.95)};});
    return voices;
  }
  class Sound{
    constructor(){this.enabled=false;this.volume=.3;this.context=null;this.pending=null;this.failed=false;this.effects=new Set();this.cues={};this.last=null;this.pieces=new Map();this.hold=0;this.masterTarget=0;this.targets=Array.from({length:7},silent);}
    createGraph(context){
      this.context=context;const c=context;this.noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      this.bus=c.createDynamicsCompressor();for(const [k,v]of Object.entries({threshold:-18,knee:18,ratio:8,attack:.005,release:.12}))this.bus[k].value=v;
      this.limiter=c.createWaveShaper();this.limiter.curve=Float32Array.from({length:2049},(_,i)=>.93*Math.tanh((i/1024-1)*2));this.master=c.createGain();this.master.gain.value=0;this.bus.connect(this.limiter);this.limiter.connect(this.master);this.master.connect(c.destination);
      this.voices=Array.from({length:7},(_,i)=>{const noise=c.createBufferSource(),filter=c.createBiquadFilter(),tone=c.createOscillator(),bass=c.createGain(),gain=c.createGain(),pan=c.createStereoPanner();noise.buffer=this.noise;noise.loop=true;filter.type='lowpass';filter.Q.value=.5;gain.gain.value=0;bass.gain.value=.13;tone.type='sine';noise.connect(filter);filter.connect(gain);tone.connect(bass);bass.connect(gain);gain.connect(pan);pan.connect(this.bus);noise.start(c.currentTime,i*.271);tone.start();return {noise,filter,tone,bass,gain,pan};});
    }
    async enable(){
      if(this.pending)return this.pending;
      this.pending=(async()=>{try{if(!this.context){const Context=root.AudioContext||root.webkitAudioContext;if(!Context)throw Error('Audio unavailable');this.createGraph(new Context());}await this.context.resume();if(this.context.state!=='running')throw Error('Audio interrupted');this.enabled=true;this.failed=false;return true;}catch(_){this.enabled=false;this.failed=true;this.silence();try{await this.context?.close();}catch(_){}this.context=null;return false;}})().finally(()=>{this.pending=null;});return this.pending;
    }
    wake(){if(!this.enabled||!this.context)return Promise.resolve(false);clearTimeout(this.suspendTimer);this.suspendTimer=null;try{return this.context.resume().then(()=>true).catch(()=>{this.enabled=false;this.failed=true;this.silence();return false;});}catch(_){this.enabled=false;this.failed=true;return Promise.resolve(false);}}
    ramp(param,value,tau=.06){const t=this.context.currentTime;param.cancelScheduledValues(t);param.setTargetAtTime(value,t,tau);}
    setVolume(value){if(Number.isFinite(value))this.volume=clamp(value);if(this.input)this.update(this.input);}
    disable(){this.enabled=false;this.hold=0;this.silence();}
    silence(){
      if(!this.context||!this.master)return;this.masterTarget=0;this.ramp(this.master.gain,0,.012);this.clearEffects();clearTimeout(this.suspendTimer);this.suspendTimer=setTimeout(()=>{this.suspendTimer=null;try{this.context.suspend().catch(()=>{});}catch(_){}},70);
    }
    clearEffects(){for(const e of [...this.effects]){for(const source of e.sources){try{source.stop();}catch(_){}}for(const node of e.nodes)node.disconnect();this.effects.delete(e);}}
    cue(name,pan=0,strength=1,force=false){
      if(!this.enabled||!this.input?.live||this.context?.state!=='running'||this.effects.size>=8||!force&&name!=='ignite'&&!this.input.running&&!this.input.workshop)return;
      const specs={snap:[.07,1800,.18,360],ignite:[.45,850,.45,48],cutoff:[.22,400,.2,45],separate:[.18,1300,.28,260],impact:[.65,500,.5,60]},spec=specs[name];if(!spec)return;
      const c=this.context,t=c.currentTime,[duration,hz,level,pitch]=spec,noise=c.createBufferSource(),filter=c.createBiquadFilter(),tone=c.createOscillator(),blend=c.createGain(),gain=c.createGain(),panner=c.createStereoPanner();
      noise.buffer=this.noise;filter.type=name==='separate'?'bandpass':'lowpass';filter.frequency.value=hz;filter.Q.value=.6;tone.type=name==='snap'?'triangle':'sine';tone.frequency.setValueAtTime(pitch,t);tone.frequency.exponentialRampToValueAtTime(Math.max(25,pitch*.45),t+duration);blend.gain.value=.35;panner.pan.value=clamp(pan,-.95,.95);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(level*clamp(strength),t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
      noise.connect(filter);filter.connect(gain);tone.connect(blend);blend.connect(gain);gain.connect(panner);panner.connect(this.bus);const effect={sources:[noise,tone],nodes:[noise,filter,tone,blend,gain,panner]};this.effects.add(effect);noise.onended=()=>{for(const node of effect.nodes)node.disconnect();this.effects.delete(effect);};noise.start(t);tone.start(t);noise.stop(t+duration);tone.stop(t+duration);this.cues[name]=(this.cues[name]||0)+1;
    }
    action(action,before,after){
      if(before.phase==='workshop'&&JSON.stringify(before.craft)!==JSON.stringify(after.craft)){this.cue('snap');return;}
      if(action.type==='ignite')this.wake().then(ok=>{if(ok&&this.enabled&&this.input?.live&&this.input.running)this.cue('ignite');});
      if(action.type==='stop'&&before.flight?.controls.lit&&before.flight.controls.throttle>0)this.cue('cutoff');
      if(['separate','jettison'].includes(action.type))this.cue('separate');
    }
    update(input){
      this.input=input;const {flight:f,pieces=[],live,running,workshop}=input,previous=this.last,newImpact=Boolean(live&&previous?.live&&previous.running&&f&&f.t>previous.t&&previous.status==='flying'&&f.status==='impact');
      if(!f||previous&&f.t<previous.t)this.pieces.clear();
      if(live&&previous?.live&&f&&f.t>previous.t&&previous.lit&&!f.controls.lit&&f.fuel[f.active]===0)this.cue('cutoff');
      if(newImpact&&this.enabled){this.hold=this.context.currentTime+.8;this.cue('impact',0,clamp(Math.hypot(...f.state.slice(3,6))/150,.25,1),true);}
      for(const p of pieces){if(live&&running&&this.pieces.get(p.id)==='flying'&&p.coast.status==='impact')this.cue('impact',p.pan,.45/(1+(p.distance/35)**2));this.pieces.set(p.id,p.coast.status);}
      this.last=f?{t:f.t,lit:f.controls.lit,status:f.status,live,running}:null;this.targets=mix(f,pieces);
      if(!this.context)return;
      const active=this.enabled&&live&&(running||workshop||this.context.currentTime<this.hold),target=active?this.volume*.65:0;
      if(target!==this.masterTarget){this.masterTarget=target;this.ramp(this.master.gain,target,.018);}if(active){clearTimeout(this.suspendTimer);this.suspendTimer=null;}else if(this.context.state==='running'&&!this.suspendTimer)this.silence();
      this.voices.forEach((voice,i)=>{const value=this.targets[i],gain=running&&live?value.gain:0;if(!voice.target||voice.target.gain!==gain)this.ramp(voice.gain.gain,gain);if(!voice.target||voice.target.hz!==value.hz)this.ramp(voice.filter.frequency,value.hz,.1);if(!voice.target||voice.target.bass!==value.bass){this.ramp(voice.tone.frequency,value.bass||55,.1);this.ramp(voice.bass.gain,value.bass?.13:0);}if(!voice.target||voice.target.pan!==value.pan)this.ramp(voice.pan.pan,value.pan);voice.target={...value,gain:running&&live?value.gain:0};});
    }
    diagnostics(){return {enabled:this.enabled,volume:this.volume,failed:this.failed,context:this.context?.state||'uninitialized',master:this.masterTarget,voices:this.voices?.length||0,effects:this.effects.size,gains:this.voices?.map(v=>v.target?.gain||0)||[],cues:{...this.cues},targets:this.targets.map(v=>({...v})),playbackRates:this.voices?.map(v=>v.noise.playbackRate.value)||[]};}
  }
  return Object.freeze({Sound,mix});
});
