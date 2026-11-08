import {musicConfig,type Cue,type MusicTrack} from './musicConfig';
import {resourceUrl} from './resourceUrl';
export type MusicMode='off'|'full'|'adaptive';
type Group={gain:GainNode;sources:Set<AudioBufferSourceNode>;retired:boolean};
/** One BGM scheduler. Voice has a separate, reserved bus and is never scheduled here. */
export class BgmController{
 private context?:AudioContext;private bgmBus?:GainNode;private voiceBus?:GainNode;
 private raw=new Map<string,Promise<ArrayBuffer>>();private decoded=new Map<string,Promise<AudioBuffer>>();
 private groups=new Set<Group>();private group?:Group;private timer?:ReturnType<typeof setInterval>;private pending?:ReturnType<typeof setTimeout>;
 private cue:Cue|null=null;private mode:MusicMode='adaptive';private volume=musicConfig.defaultVolume;private unlocked=false;private disposed=false;private generation=0;private key='';private silenceAfter=0;
 constructor(private readonly onStatus:(message:string)=>void=()=>{}){}
 async unlock(){if(this.disposed)return;try{this.context??=new AudioContext();if(!this.bgmBus){this.bgmBus=this.context.createGain();this.bgmBus.gain.value=this.volume;this.bgmBus.connect(this.context.destination);this.voiceBus=this.context.createGain();this.voiceBus.connect(this.context.destination);}await this.context.resume();this.unlocked=this.context.state==='running';this.reconcile();}catch{this.onStatus('Нажмите кнопку музыки, чтобы разрешить звук.');}}
 configure(mode:MusicMode,volume:number){const changed=mode!==this.mode;this.mode=mode;this.volume=Math.max(0,Math.min(1,volume));if(this.context&&this.bgmBus)this.bgmBus.gain.setTargetAtTime(this.volume,this.context.currentTime,.12);this.reconcile(changed);}
 setCue(cue:Cue|null){this.cue=cue;this.reconcile();}
 restart(cue:Cue|null=this.cue){this.cue=cue?{...cue,phase:'intro-loop'}:null;this.reconcile(true);}
 preload(trackId:string){const t=musicConfig.tracks[trackId];if(!t)return;for(const url of t.kind==='loop'?[t.sources.full]:[t.sources.intro,t.sources.loop])if(url)void this.fetchAudio(url).catch(()=>{});}
 preloadOutro(trackId:string){const url=musicConfig.tracks[trackId]?.sources.outro;if(url)void this.fetchAudio(url).catch(()=>{});}
 private fetchAudio(url:string){let p=this.raw.get(url);if(!p){p=fetch(resourceUrl(url)).then(r=>{if(!r.ok)throw Error('Audio unavailable');return r.arrayBuffer();}).catch(e=>{this.raw.delete(url);throw e;});this.raw.set(url,p);}return p;}
 private decode(url:string){let p=this.decoded.get(url);if(!p){p=this.fetchAudio(url).then(b=>this.context!.decodeAudioData(b.slice(0))).catch(e=>{this.decoded.delete(url);throw e;});this.decoded.set(url,p);}return p;}
 private async load(t:MusicTrack,full:boolean,phase:Cue['phase']){const names=full?['full']:phase==='outro'?['outro']:['intro','loop'];const b:Record<string,AudioBuffer>={};await Promise.all(names.map(async name=>{const url=t.sources[name as keyof typeof t.sources];if(!url)throw Error('Incomplete track');b[name]=await this.decode(url);}));return b;}
 private cancel(){++this.generation;if(this.pending)clearTimeout(this.pending);this.pending=undefined;if(this.timer)clearInterval(this.timer);this.timer=undefined;}
 private reconcile(force=false){
  const cue=this.cue,track=cue?musicConfig.tracks[cue.track]:undefined,full=this.mode==='full'||track?.kind==='loop';
  const desired=this.mode==='off'||!cue||cue.phase==='silent'||!track?'':`${cue.track}:${full?'full':cue.phase}`;
  if(!desired){if(this.key||this.groups.size){this.key='';this.cancel();this.retire(musicConfig.fadeSeconds);}return;}
  if(!this.unlocked||this.disposed||(!force&&desired===this.key))return;
  const old=this.key,oldTrack=old.split(':')[0],phaseChange=!force&&oldTrack===cue!.track&&old!==desired&&old.split(':')[1]!=='full'&&!full;
  const skipIntro=phaseChange&&cue!.phase==='intro-loop';this.cancel();this.key=desired;const token=this.generation;
  // Different tracks/modes are serialized. Only sections of the same score crossfade.
  if(!phaseChange)this.retire(musicConfig.fadeSeconds);
  void this.load(track!,full,cue!.phase).then(buffers=>{if(token!==this.generation||this.disposed)return;const wait=phaseChange?0:Math.max(0,this.silenceAfter-this.context!.currentTime);this.pending=setTimeout(()=>{if(token!==this.generation||this.disposed)return;this.pending=undefined;this.start(track!,buffers,full,cue!.phase,skipIntro,phaseChange);},wait*1000);}).catch(()=>{if(token!==this.generation)return;this.key='';this.cancel();this.retire(musicConfig.fadeSeconds);this.onStatus('Музыка недоступна. История продолжает работать без звука.');});
 }
 private voice(g:Group,b:AudioBuffer,at:number,fadeIn=0,fadeOut=0,loop=false){const c=this.context!,s=c.createBufferSource(),v=c.createGain();s.buffer=b;s.loop=loop;s.connect(v);v.connect(g.gain);v.gain.setValueAtTime(fadeIn?0:1,at);if(fadeIn)v.gain.linearRampToValueAtTime(1,at+fadeIn);if(fadeOut&&!loop){v.gain.setValueAtTime(1,at+b.duration-fadeOut);v.gain.linearRampToValueAtTime(0,at+b.duration);}g.sources.add(s);s.onended=()=>{g.sources.delete(s);s.disconnect();v.disconnect();};s.start(at);return v;}
 private start(t:MusicTrack,b:Record<string,AudioBuffer>,full:boolean,phase:Cue['phase'],skipIntro:boolean,crossfade:boolean){
  const c=this.context!,at=c.currentTime+.04,fade=musicConfig.fadeSeconds;if(crossfade)this.retire(fade);
  const gain=c.createGain();gain.gain.value=t.level;gain.connect(this.bgmBus!);const g:Group={gain,sources:new Set(),retired:false};this.groups.add(g);this.group=g;this.onStatus('');
  if(full){const voice=this.voice(g,b.full,at,fade,0,true);let seam=at+b.full.duration;const schedule=()=>{while(seam<c.currentTime+14){voice.gain.setValueAtTime(1,seam-.01);voice.gain.linearRampToValueAtTime(0,seam);voice.gain.linearRampToValueAtTime(1,seam+.01);seam+=b.full.duration;}};schedule();this.timer=setInterval(schedule,250);return;}
  if(phase==='outro'){this.voice(g,b.outro,at,fade,Math.min(2,b.outro.duration/2));return;}
  const overlap=Math.min(t.overlapSeconds??1,b.loop.duration/3,b.intro.duration/3),period=b.loop.duration-overlap;let next=at;
  if(!skipIntro){this.voice(g,b.intro,at,Math.min(fade,b.intro.duration/3),overlap);next=at+b.intro.duration-overlap;}
  const schedule=()=>{while(next<c.currentTime+Math.max(14,period*2)){this.voice(g,b.loop,next,overlap,overlap);next+=period;}};schedule();this.timer=setInterval(schedule,250);
 }
 private retire(fade:number){const c=this.context;if(!c)return;for(const g of this.groups){if(g.retired)continue;g.retired=true;const at=c.currentTime;this.silenceAfter=Math.max(this.silenceAfter,at+fade+.02);g.gain.gain.cancelScheduledValues(at);g.gain.gain.setValueAtTime(g.gain.gain.value,at);g.gain.gain.linearRampToValueAtTime(0,at+fade);for(const s of g.sources)try{s.stop(at+fade+.01);}catch{/* already finished */}setTimeout(()=>{g.gain.disconnect();this.groups.delete(g);},(fade+.1)*1000);}this.group=undefined;}
 setBackground(hidden:boolean){if(hidden){void this.context?.suspend().catch(()=>{});}else if(this.unlocked){void this.unlock();}}
 debug(){return {phase:this.cue?.phase??'silent',track:this.cue?.track??null,mode:this.mode,started:this.key?`${this.mode}:${this.key.split(':')[1]}`:'',groups:this.groups.size,voices:[...this.groups].reduce((n,g)=>n+g.sources.size,0),unlocked:this.unlocked,time:this.context?.currentTime??0,channels:['BGM','Voice']};}
 dispose(){this.disposed=true;this.cancel();this.retire(0);void this.context?.close();}
}
