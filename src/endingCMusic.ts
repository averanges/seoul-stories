import {BgmController,type MusicMode} from './bgm';
export type {MusicMode};
export type MusicPhase='silent'|'intro-loop'|'outro';
export const musicPhase=(story:string|undefined,node:string|undefined):MusicPhase=>story!=='neoreul_mideo'||!/^ENDING_C_(D0[1-6]|TERMINAL)$/.test(node??'')?'silent':node==='ENDING_C_D06'||node==='ENDING_C_TERMINAL'?'outro':'intro-loop';
/** Compatibility adapter; the player uses the shared BGM controller. */
export class EndingCMusic extends BgmController{
 target(phase:MusicPhase){this.setCue({scene:'EndingC',track:'ending_c_tragic',phase});}
 restart(){super.restart({scene:'EndingC',track:'ending_c_tragic',phase:'intro-loop'});}
}
