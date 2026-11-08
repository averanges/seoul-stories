import {applyRevealBaseline,isRevealNode,revealR01} from './reveal-test-compat';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {advance,back,choose,enter,fresh,nodeText,parseSave} from './engine';
import {validateStory} from './validate';
import type {Story} from './types';
const dir='public/stories/neoreul_mideo/';const story=JSON.parse(fs.readFileSync(dir+'story.json','utf8')) as Story;
for(const k of ['nodes','scenes','characters'] as const)(story as any)[k]=JSON.parse(fs.readFileSync(dir+k+'.json','utf8'));
test('bridge changes only trust connector; all previous dialogue and other branches remain exact',()=>{
 const old=JSON.parse(fs.readFileSync('docs/sc03a-bridge/PREVIOUS_NODES.json','utf8'));old.find((n:any)=>n.id==='SC03A_R_TRUST').next='SC03A_BRIDGE_D01';const connector=old.find((n:any)=>n.id==='SC03B_TO_SC04A');delete connector.ending;connector.next='SC04A_CONFESSION_D01';const call=old.find((n:any)=>n.id==='SC03B_TO_SC04B');delete call.ending;call.next='SC04B_PHONE_D01';for(const id of ['SC04A_CONFESSION_TO_ENDING_B','SC04B_PHONE_TO_ENDING_B']){const n=old.find((n:any)=>n.id===id);if(n){delete n.ending;n.next='ENDING_B_D01';n.when={variable:'yuna_declines_identity',op:'eq',value:false};n.skipTo='ENDING_B_D01';}}applyRevealBaseline(old);assert.deepEqual(story.nodes.filter(n=>!isRevealNode(n.id)&&n.id!=='SC03A_BRIDGE_D01'&&!n.id.startsWith('SC04A_CONFESSION_')&&!n.id.startsWith('SC04B_PHONE_')&&!n.id.startsWith('ENDING_B_')),old);assert.deepEqual(validateStory(story),[]);
 const n=story.nodes.find(n=>n.id==='SC03A_BRIDGE_D01')!;assert.equal(n.speaker,undefined);assert.equal(nodeText(n,story.variables),'두 사람은 남은 짐을 함께 정리하기 시작해요.');assert.equal(nodeText(n,story.variables,true),'두 사람은 같이 짐을 정리해요.');assert.equal(n.transitionAfter?.original,'며칠 뒤, 저녁');assert.equal(n.transitionAfter?.simple,'며칠 후, 저녁');assert.equal(n.next,'SC04A_D01');assert.ok(fs.existsSync(dir+story.scenes[n.scene].src));
});
test('trust alone crosses bridge, preserves variables and undo/reload; guard skips it',()=>{
 const vars={...story.variables,route:'talk'};const start={...fresh(story),entries:[enter(story,'SC03A_D15',vars)]};
 const reaction=choose(story,start,'trust'),bridge=advance(story,reaction),final=advance(story,bridge);
 assert.equal(bridge.entries.at(-1)!.nodeId,'SC03A_BRIDGE_D01');assert.equal(final.entries.at(-1)!.nodeId,'SC04A_D01');assert.deepEqual(final.entries.at(-1)!.variables,reaction.entries.at(-1)!.variables);assert.deepEqual(back(story,final).entries,bridge.entries);assert.deepEqual(parseSave(JSON.stringify(bridge),story),bridge);assert.equal(advance(story,choose(story,start,'check')).entries.at(-1)!.nodeId,'SC03B_D01');
 const invalid=structuredClone(story);invalid.nodes.find(n=>n.id==='SC03A_BRIDGE_D01')!.transitionAfter!.durationMs=Infinity;assert.ok(validateStory(invalid).some(i=>i.message.includes('временной титр')));
});
