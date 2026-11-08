import data from './music.config.json';
export type MusicTrack = {label:string;kind:'loop'|'adaptive';level:number;overlapSeconds?:number;sources:{full:string;intro?:string;loop?:string;outro?:string}};
export type MusicRule = {id:string;story:string;nodePattern:string;track:string;outroNodes?:string[];silentNodes?:string[];preload?:string[];preloadOutroNodes?:string[]};
export const musicConfig = data as {version:number;defaultVolume:number;fadeSeconds:number;tracks:Record<string,MusicTrack>;scenes:MusicRule[]};
export type Cue = {scene:string;track:string;phase:'intro-loop'|'outro'|'silent'};
export function musicRule(story:string|undefined,node:string|undefined){return musicConfig.scenes.find(r=>r.story===story&&new RegExp(r.nodePattern).test(node??''));}
export function resolveMusic(story:string|undefined,node:string|undefined):Cue|null{const r=musicRule(story,node);return r?{scene:r.id,track:r.track,phase:r.silentNodes?.includes(node??'')?'silent':r.outroNodes?.includes(node??'')?'outro':'intro-loop'}:null;}
export function musicScope(story:string|undefined,node:string|undefined){return `${story}:${musicRule(story,node)?.id??node?.replace(/_(D\d+|R.*)$/,'')??'menu'}`;}
