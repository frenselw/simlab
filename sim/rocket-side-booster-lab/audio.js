(function(root,factory){const api=factory(root,typeof module==='object'&&module.exports?require('./parts'):root.RocketParts,typeof module==='object'&&module.exports?require('./model'):root.RocketModel,typeof module==='object'&&module.exports?require('./orbit'):root.RocketOrbit);if(typeof module==='object'&&module.exports)module.exports=api;root.RocketAudio=api;})(typeof window==='undefined'?globalThis:window,function(root,P,M,O){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),silent=()=>({gain:0,hz:500,bass:55,pan:0});
  function flightGain(f){if(!f)return 1;const t=clamp((Math.hypot(...f.state.slice(0,3))-P.R-80000)/20000);return 1-t*t*(3-2*t);}
  const CHORDS={space:[[48,55,62,64],[45,52,59,60],[41,48,55,57],[43,50,57,60]],orbit:[[33,52,59,60],[29,48,55,57],[32,51,58,59],[31,50,57,58]]};
  function mix(f,pieces=[]){
    const voices=Array.from({length:7},silent);if(!f)return voices;
    const air=clamp(M.atmosphere(Math.hypot(...f.state.slice(0,3))-P.R)/1.225),engine=f.craft.stages[f.active].engine,throttle=M.coreThrust(f)>0?f.controls.throttle:0;
    voices[0]={gain:(f.capsule?.detached?.12:.32)*Math.sqrt(throttle),hz:150+[700,430,560][engine]*throttle,bass:[48,72,60][engine],pan:0};
    voices[1]={gain:P.burning(f)?.21*Math.sqrt(f.craft.boosters/2):0,hz:650,bass:58,pan:0};
    if(f.capsule?.detached&&f.capsule.chute.phase==='stowed'&&f.capsule.fuel>0&&Math.abs(Math.atan2(Math.sin(M.targetAttitude(f)-f.attitude),Math.cos(M.targetAttitude(f)-f.attitude)))>.01)voices[1]={gain:.025*Math.sqrt(air),hz:1200,bass:0,pan:0};
    voices[2]={gain:.085*Math.sqrt(air)*clamp(Math.hypot(...f.state.slice(3,6))/500),hz:2400,bass:0,pan:0};
    pieces.slice(0,4).forEach((p,i)=>{const distance=Math.hypot(...p.coast.state.slice(0,3).map((v,j)=>v-f.state[j]));voices[i+3]={gain:p.coast.fuel>0&&p.coast.status==='flying'?.13*Math.sqrt(air)/(1+(distance/35)**2):0,hz:650,bass:58,pan:clamp(p.pan||0,-.95,.95)};});
    const fade=flightGain(f);for(const v of voices)v.gain*=fade;return voices;
  }
  class Sound{
    constructor(){this.musicEnabled=true;this.musicReady=false;this.musicMood=null;this.orbitSince=null;this.musicTime=0;this.musicClock=null;this.musicChord=-1;this.musicLevel=0;this.musicGraph=null;this.ignition=0;this.enabled=false;this.volume=.3;this.context=null;this.pending=null;this.failed=false;this.effects=new Set();this.cues={};this.last=null;this.pieces=new Map();this.hold=0;this.masterTarget=0;this.targets=Array.from({length:7},silent);}
    createGraph(context){
      this.context=context;this.musicGraph=null;this.musicLevel=0;this.musicChord=-1;const c=context;this.noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      this.bus=c.createDynamicsCompressor();for(const [k,v]of Object.entries({threshold:-18,knee:18,ratio:8,attack:.005,release:.12}))this.bus[k].value=v;
      this.limiter=c.createWaveShaper();this.limiter.curve=Float32Array.from({length:2049},(_,i)=>.93*Math.tanh((i/1024-1)*2));this.master=c.createGain();this.master.gain.value=0;this.bus.connect(this.limiter);this.limiter.connect(this.master);this.master.connect(c.destination);
      this.voices=Array.from({length:7},(_,i)=>{const noise=c.createBufferSource(),filter=c.createBiquadFilter(),tone=c.createOscillator(),bass=c.createGain(),gain=c.createGain(),pan=c.createStereoPanner();noise.buffer=this.noise;noise.loop=true;filter.type='lowpass';filter.Q.value=.5;gain.gain.value=0;bass.gain.value=.13;tone.type='sine';noise.connect(filter);filter.connect(gain);tone.connect(bass);bass.connect(gain);gain.connect(pan);pan.connect(this.bus);noise.start(c.currentTime,i*.271);tone.start();return {noise,filter,tone,bass,gain,pan};});
    }
    createMusic(){
      const c=this.context,output=c.createGain(),filter=c.createBiquadFilter(),delay=c.createDelay(1),feedback=c.createGain(),wet=c.createGain();output.gain.value=0;filter.type='lowpass';filter.frequency.value=1200;filter.Q.value=.3;delay.delayTime.value=.43;feedback.gain.value=.22;wet.gain.value=.25;filter.connect(output);filter.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(wet);wet.connect(output);output.connect(this.bus);
      const banks=Array.from({length:2},()=>{const gain=c.createGain();gain.gain.value=0;gain.connect(filter);const notes=Array.from({length:4},(_,i)=>{const tone=c.createOscillator(),pan=c.createStereoPanner();tone.type=i%2?'triangle':'sine';pan.pan.value=[-.65,-.2,.2,.65][i];tone.connect(pan);pan.connect(gain);tone.start();return tone;});return {gain,notes};});
      this.musicGraph={output,banks,filter,mood:null,bank:0};this.musicChord=-1;
    }
    setMusicEnabled(value){this.musicEnabled=Boolean(value);if(this.input)this.update(this.input);}
    updateMusic(input,now){
      const {flight:f,live,running}=input;
      if(!f||this.last&&f.t<this.last.t){this.musicReady=false;this.orbitSince=null;this.musicTime=0;this.musicClock=null;this.musicChord=-1;}
      const space=Boolean(f&&f.status==='flying'&&Math.hypot(...f.state.slice(0,3))-P.R>=100000),safe=space&&O.safe(f.state);
      if(!safe){this.musicReady=false;this.orbitSince=null;}
      // Zero throttle and exhausted fuel are silent coast even when the ignition flag remains set.
      if(!this.musicReady){if(safe&&live&&running&&M.thrust(f)===0){if(this.orbitSince===null)this.orbitSince=now;if(now-this.orbitSince>=3)this.musicReady=true;}else this.orbitSince=null;}
      this.musicMood=space?(this.musicReady?'orbit':'space'):null;
      const playing=Boolean(this.enabled&&this.musicEnabled&&live&&running&&space&&this.context);
      if(playing&&this.context.state==='running'){if(this.musicClock!==null)this.musicTime+=Math.max(0,now-this.musicClock);this.musicClock=now;}else this.musicClock=null;
      const target=playing?1:0;
      if(playing&&!this.musicGraph)this.createMusic();
      if(this.musicGraph){
        const graph=this.musicGraph,deep=this.musicMood==='orbit',chord=Math.floor(this.musicTime/(deep?24:18));
        if(playing&&(chord!==this.musicChord||graph.mood!==this.musicMood)){
          const first=this.musicChord===-1,bank=first?0:1-graph.bank,notes=CHORDS[this.musicMood][chord%4];
          graph.banks.forEach((b,i)=>{if(i===bank)b.notes.forEach((n,j)=>{n.frequency.setValueAtTime(440*2**((notes[j]-69)/12),this.context.currentTime);n.detune.setValueAtTime((deep?5:3)*[-1,.6,-.6,1][j],this.context.currentTime);});const gain=i===bank?(deep?.055:.05):0;if(first)b.gain.gain.setValueAtTime(gain,this.context.currentTime);else this.ramp(b.gain.gain,gain,1.8);});
          this.ramp(graph.filter.frequency,deep?900:1400,1.8);graph.bank=bank;graph.mood=this.musicMood;this.musicChord=chord;
        }
        if(target!==this.musicLevel){const tau=(!live||!running) ? .012 : target>this.musicLevel?(this.musicLevel===0?2.2:.6):.65;this.ramp(this.musicGraph.output.gain,target,tau);}
      }
      this.musicLevel=target;
    }
    async enable(){
      if(this.pending)return this.pending;
      this.pending=(async()=>{try{if(!this.context){const Context=root.AudioContext||root.webkitAudioContext;if(!Context)throw Error('Audio unavailable');this.createGraph(new Context());}await this.context.resume();if(this.context.state!=='running')throw Error('Audio interrupted');this.enabled=true;this.failed=false;return true;}catch(_){this.enabled=false;this.failed=true;this.silence();try{await this.context?.close();}catch(_){}this.context=null;return false;}})().finally(()=>{this.pending=null;});return this.pending;
    }
    wake(){if(!this.enabled||!this.context)return Promise.resolve(false);clearTimeout(this.suspendTimer);this.suspendTimer=null;try{return this.context.resume().then(()=>true).catch(()=>{this.enabled=false;this.failed=true;this.silence();return false;});}catch(_){this.enabled=false;this.failed=true;return Promise.resolve(false);}}
    ramp(param,value,tau=.06){const t=this.context.currentTime;param.cancelScheduledValues(t);param.setTargetAtTime(value,t,tau);}
    setVolume(value){if(Number.isFinite(value))this.volume=clamp(value);if(this.input)this.update(this.input);}
    disable(){this.ignition++;this.enabled=false;this.hold=0;this.silence();}
    silence(){
      if(!this.context||!this.master)return;this.musicClock=null;if(this.musicGraph){this.ramp(this.musicGraph.output.gain,0,.012);this.musicLevel=0;}this.masterTarget=0;this.ramp(this.master.gain,0,.012);this.clearEffects();clearTimeout(this.suspendTimer);this.suspendTimer=setTimeout(()=>{this.suspendTimer=null;try{this.context.suspend().catch(()=>{});}catch(_){}},70);
    }
    clearEffects(){for(const e of [...this.effects]){for(const source of e.sources){try{source.stop();}catch(_){}}for(const node of e.nodes)node.disconnect();this.effects.delete(e);}}
    cue(name,pan=0,strength=1,force=false){
      if(!this.enabled||!this.input?.live||this.context?.state!=='running'||this.effects.size>=8||!force&&name!=='ignite'&&!this.input.running&&!this.input.workshop)return;
      if(name!=='snap')strength*=flightGain(this.input.flight);if(strength<=0)return;
      const specs={snap:[.07,1800,.18,360],ignite:[.45,850,.45,48],cutoff:[.22,400,.2,45],separate:[.18,1300,.28,260],impact:[.65,500,.5,60],chute:[.8,1700,.2,110],landing:[.25,500,.15,65]},spec=specs[name];if(!spec)return;
      const c=this.context,t=c.currentTime,[duration,hz,level,pitch]=spec,noise=c.createBufferSource(),filter=c.createBiquadFilter(),tone=c.createOscillator(),blend=c.createGain(),gain=c.createGain(),panner=c.createStereoPanner();
      noise.buffer=this.noise;filter.type=name==='separate'?'bandpass':'lowpass';filter.frequency.value=hz;filter.Q.value=.6;tone.type=name==='snap'?'triangle':'sine';tone.frequency.setValueAtTime(pitch,t);tone.frequency.exponentialRampToValueAtTime(Math.max(25,pitch*.45),t+duration);blend.gain.value=.35;panner.pan.value=clamp(pan,-.95,.95);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(level*clamp(strength),t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
      noise.connect(filter);filter.connect(gain);tone.connect(blend);blend.connect(gain);gain.connect(panner);panner.connect(this.bus);const effect={sources:[noise,tone],nodes:[noise,filter,tone,blend,gain,panner]};this.effects.add(effect);noise.onended=()=>{for(const node of effect.nodes)node.disconnect();this.effects.delete(effect);};noise.start(t);tone.start(t);noise.stop(t+duration);tone.stop(t+duration);this.cues[name]=(this.cues[name]||0)+1;
    }
    action(action,before,after){
      if(before.phase==='workshop'&&JSON.stringify(before.craft)!==JSON.stringify(after.craft)){this.cue('snap');return;}
      if(action.type==='ignite'){const ignition=++this.ignition;this.wake().then(ok=>{if(ok&&ignition===this.ignition&&this.enabled&&this.input?.live&&this.input.running)this.cue('ignite');});}
      if(action.type==='stop'&&before.flight?.controls.lit&&before.flight.controls.throttle>0)this.cue('cutoff');
      if(['separate','jettison','capsule-separate'].includes(action.type))this.cue('separate');
    }
    update(input,now=(root.performance?.now()||0)/1000){
      this.input=input;const {flight:f,pieces=[],live,running,workshop}=input;if(!this.enabled||!live||!running||!f?.controls.lit)this.ignition++;const previous=this.last,newImpact=Boolean(live&&previous?.live&&previous.running&&f&&f.t>previous.t&&previous.capsule===Boolean(f.capsule?.detached)&&previous.status==='flying'&&['impact','destroyed'].includes(f.status));
      if(!f||previous&&f.t<previous.t)this.pieces.clear();
      if(live&&previous?.live&&f&&f.t>previous.t&&previous.lit&&!f.controls.lit&&f.fuel[f.active]===0)this.cue('cutoff');
      if(newImpact&&this.enabled){this.hold=this.context.currentTime+.8;this.cue('impact',0,f.status==='destroyed'?.45:clamp(Math.hypot(...f.state.slice(3,6))/150,.25,1),true);}
      for(const p of pieces){if(live&&running&&this.pieces.get(p.id)==='flying'&&p.coast.status==='impact')this.cue('impact',p.pan,.45/(1+(p.distance/35)**2));this.pieces.set(p.id,p.coast.status);}
      if(live&&running&&previous?.running&&f&&f.t>previous.t){if(f.capsule?.chute.phase!==previous.chute&&previous.chute&&['drogue-opening','main-opening'].includes(f.capsule?.chute.phase))this.cue('chute');}
      if(live&&previous?.live&&previous.running&&f&&f.t>previous.t&&f.status==='landed'&&previous.status==='flying'&&this.enabled&&this.context){this.hold=this.context.currentTime+.4;this.cue('landing',0,1,true);}
      this.updateMusic(input,now);
      this.last=f?{capsule:Boolean(f.capsule?.detached),chute:f.capsule?.chute.phase,t:f.t,lit:f.controls.lit,status:f.status,live,running}:null;this.targets=mix(f,pieces);
      if(!this.context)return;
      const active=this.enabled&&live&&(running||workshop||this.context.currentTime<this.hold),target=active?this.volume*.65:0;
      if(target!==this.masterTarget){this.masterTarget=target;this.ramp(this.master.gain,target,.018);}if(active){clearTimeout(this.suspendTimer);this.suspendTimer=null;}else if(this.context.state==='running'&&!this.suspendTimer)this.silence();
      this.voices.forEach((voice,i)=>{const value=this.targets[i],gain=running&&live?value.gain:0;if(!voice.target||voice.target.gain!==gain)this.ramp(voice.gain.gain,gain);if(!voice.target||voice.target.hz!==value.hz)this.ramp(voice.filter.frequency,value.hz,.1);if(!voice.target||voice.target.bass!==value.bass){this.ramp(voice.tone.frequency,value.bass||55,.1);this.ramp(voice.bass.gain,value.bass?.13:0);}if(!voice.target||voice.target.pan!==value.pan)this.ramp(voice.pan.pan,value.pan);voice.target={...value,gain:running&&live?value.gain:0};});
    }
    diagnostics(){return {enabled:this.enabled,volume:this.volume,failed:this.failed,music:{enabled:this.musicEnabled,ready:this.musicReady,mood:this.musicMood,level:this.musicLevel,time:this.musicTime,chord:this.musicChord,voices:this.musicGraph?8:0},context:this.context?.state||'uninitialized',master:this.masterTarget,voices:this.voices?.length||0,effects:this.effects.size,gains:this.voices?.map(v=>v.target?.gain||0)||[],cues:{...this.cues},targets:this.targets.map(v=>({...v})),playbackRates:this.voices?.map(v=>v.noise.playbackRate.value)||[]};}
  }
  return Object.freeze({Sound,mix,flightGain});
});
