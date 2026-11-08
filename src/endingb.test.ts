import {applyRevealBaseline,isRevealNode,revealR01} from './reveal-test-compat';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {advance,back,choose,enter,fresh,nodeText,parseSave} from './engine';
import {validateStory} from './validate';
import type {Save,Story} from './types';
const root='public/stories/neoreul_mideo/',story=JSON.parse(fs.readFileSync(root+'story.json','utf8')) as Story;for(const k of ['nodes','scenes','characters'] as const)(story as any)[k]=JSON.parse(fs.readFileSync(root+k+'.json','utf8'));
const pack=JSON.parse(fs.readFileSync('docs/ending-b-production/data/ENDING_B_content.json','utf8')),baseline=JSON.parse(fs.readFileSync('docs/ending-b-production/PREVIOUS_BASELINE.json','utf8'));
// Approved follow-up: the separate time card now carries the day/evening. Original production pack remains intact.
Object.assign(pack.dialogue_nodes.find((n:any)=>n.id==='ENDING_B_D01'),{original:'유나의 집에 초인종이 울려요.',simple:'소라가 왔어요.',ru:'В квартире Юны раздаётся звонок в дверь.'});
const vars={...story.variables,minsu_confessed:true,yuna_declines_identity:true,identity_investigation_chosen:false};const id=(s:Save)=>s.entries.at(-1)!.nodeId;
test('Ending B fourteen exact canonical bilingual nodes, teacher notes and three independent shots',()=>{
 assert.deepEqual(validateStory(story),[]);for(const d of pack.dialogue_nodes){const n=story.nodes.find(n=>n.id===d.id)!;assert.equal(n.scene,d.shot_id);assert.equal(nodeText(n,vars),d.original);assert.equal(nodeText(n,vars,true),d.simple);assert.equal(n.teacher?.translation,d.ru);assert.equal(n.teacher?.note,d.grammar_teacher_notes.join(' '));assert.deepEqual(n.teacher?.vocab,d.vocabulary);assert.equal(n.speaker,d.speaker==='narrator'?undefined:d.speaker);assert.equal(n.choices,undefined);}
 for(const s of pack.shots){assert.equal(story.scenes[s.id].src,'assets/ending_b/'+s.image);assert.ok(fs.existsSync(root+story.scenes[s.id].src));}
});
test('only two compatibility connectors changed; previous content, happy ending and all images/engine preserved',()=>{
 const old=structuredClone(baseline.nodes);for(const id of ['SC04A_CONFESSION_TO_ENDING_B','SC04B_PHONE_TO_ENDING_B']){const n=old.find((n:any)=>n.id===id);delete n.ending;n.next='ENDING_B_D01';n.when={variable:'yuna_declines_identity',op:'eq',value:false};n.skipTo='ENDING_B_D01';}applyRevealBaseline(old);assert.deepEqual(story.nodes.filter(n=>!isRevealNode(n.id)&&!n.id.startsWith('ENDING_B_')),old);for(const [id,s]of Object.entries(baseline.scenes))assert.deepEqual(story.scenes[id],s);for(const [file,hash]of Object.entries(baseline.hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file.startsWith('src/')?file:root+file)).digest('hex'),hash,file);
});
test('both refusal reactions enter shared ending immediately; know routes never enter Ending B',()=>{
 for(const [source,leave,know,extra] of [['SC04A_CONFESSION_D14','SC04A_CONFESSION_R_LEAVE','SC04A_CONFESSION_R_KNOW',{route:'investigate',shelf_seen:false}],['SC04B_PHONE_D12','SC04B_PHONE_R_LEAVE','SC04B_PHONE_R_KNOW',{route:'talk',shelf_seen:true}]] as const){const start={...fresh(story),entries:[enter(story,source,{...vars,...extra,yuna_declines_identity:false})]};const r=choose(story,start,leave),end=advance(story,r);assert.equal(id(end),'ENDING_B_D01');assert.equal(id(back(story,end)),id(r));assert.deepEqual(end.entries.at(-1)!.variables,r.entries.at(-1)!.variables);assert.ok(!id(advance(story,choose(story,start,know))).startsWith('ENDING_B_'));}
 for(const extra of [{minsu_confessed:false},{yuna_declines_identity:false},{identity_investigation_chosen:true}])assert.equal(enter(story,'ENDING_B_D01',{...vars,...extra}).nodeId,'SC02_D26');
});
test('Ending B holds 4/5/5 shots, completes B without revealing identity and retains reload/back snapshots',()=>{
 let s={...fresh(story),entries:[enter(story,'ENDING_B_D01',vars)]};const shots=[];for(let i=1;i<=14;i++){assert.equal(id(s),'ENDING_B_D'+String(i).padStart(2,'0'));shots.push(story.nodes.find(n=>n.id===id(s))!.scene);assert.deepEqual(s.entries.at(-1)!.variables,vars);assert.deepEqual(parseSave(JSON.stringify(s),story),s);s=advance(story,s);}assert.deepEqual(shots,[1,1,1,1,2,2,2,2,2,3,3,3,3,3].map(i=>'ENDING_B_SH0'+i));assert.equal(id(s),'ENDING_B_COMPLETE');const n=story.nodes.find(n=>n.id===id(s))!;assert.equal(n.ending?.kind,undefined);assert.equal(n.ending?.description,'Конец B — Не одна');assert.deepEqual(advance(story,s),s);assert.equal(id(back(story,s)),'ENDING_B_D14');assert.equal(s.entries.at(-1)!.variables.sora_identity_known,false);assert.equal(s.entries.at(-1)!.variables.sora_involved,false);
});
test('saves at old Ending B placeholders migrate to shared first node',()=>{
 for(const nodeId of ['SC04A_CONFESSION_TO_ENDING_B','SC04B_PHONE_TO_ENDING_B']){const s=parseSave(JSON.stringify({version:1,storyId:story.id,updatedAt:'2026-11-08T00:00:00Z',entries:[{nodeId,variables:vars}]}),story)!;assert.ok(s);assert.equal(id(s),'ENDING_B_D01');assert.deepEqual(s.entries.at(-1)!.variables,vars);}
});
