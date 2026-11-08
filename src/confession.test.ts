import {fileHash} from './integrity';
import {applyRevealBaseline,isRevealNode,revealR01} from './reveal-test-compat';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {advance,back,choose,enter,fresh,nodeText,parseSave} from './engine';
import {validateStory} from './validate';
import type {Save,Story} from './types';
const dir='public/stories/neoreul_mideo/';const story=JSON.parse(fs.readFileSync(dir+'story.json','utf8')) as Story;
for(const k of ['nodes','scenes','characters'] as const)(story as any)[k]=JSON.parse(fs.readFileSync(dir+k+'.json','utf8'));
const pack=JSON.parse(fs.readFileSync('docs/sc04a-confession-production/data/SC04A_content.json','utf8'));
const baseline=JSON.parse(fs.readFileSync('docs/sc04a-confession-production/PREVIOUS_BASELINE.json','utf8'));
const vars={...story.variables,route:'investigate',guard_reports_kiss:true,guard_reports_other_woman:true,yuna_heard_kiss_report:true};
const id=(s:Save)=>s.entries.at(-1)!.nodeId;
const start=():Save=>({...fresh(story),entries:[enter(story,'SC04A_CONFESSION_D01',vars)]});
function until(s:Save,target:string){for(let i=0;i<40;i++){if(id(s)===target)return s;const next=advance(story,s);assert.notDeepEqual(next,s);s=next;}throw Error(target);}
test('confession imports fourteen canonical bilingual steps, six shots and exact teacher notes',()=>{
 assert.deepEqual(validateStory(story),[]);
 for(const d of pack.dialogue_nodes){const n=story.nodes.find(n=>n.id===d.id)!;assert.equal(n.scene,d.shot_id);assert.equal(nodeText(n,vars),d.original);assert.equal(nodeText(n,vars,true),d.simple);assert.equal(n.teacher?.translation,d.ru);assert.equal(n.teacher?.note,d.teacher_notes);assert.deepEqual(n.teacher?.grammar,d.grammar);assert.deepEqual(n.teacher?.vocab,d.vocabulary);}
 for(const shot of pack.shots){const s=story.scenes[shot.id];assert.equal(s.src,'assets/scene_04a_confession/'+shot.id+'.webp');assert.ok(fs.existsSync(dir+s.src));assert.equal(s.temporary,false);}
 const n=story.nodes.find(n=>n.id==='SC04A_CONFESSION_D14')!;assert.equal(n.choiceLanguage,'ru');assert.deepEqual(n.choices!.map(c=>c.label),pack.choices[0].options.map((o:any)=>o.label_ru));
});
test('only guard connector changed; happy ending, bridge, prior nodes/scenes and all prior image bytes preserved',()=>{
 const old=structuredClone(baseline.nodes),connector=old.find((n:any)=>n.id==='SC03B_TO_SC04A');delete connector.ending;connector.next='SC04A_CONFESSION_D01';const call=old.find((n:any)=>n.id==='SC03B_TO_SC04B');delete call.ending;call.next='SC04B_PHONE_D01';for(const id of ['SC04A_CONFESSION_TO_ENDING_B','SC04B_PHONE_TO_ENDING_B']){const n=old.find((n:any)=>n.id===id);if(n){delete n.ending;n.next='ENDING_B_D01';n.when={variable:'yuna_declines_identity',op:'eq',value:false};n.skipTo='ENDING_B_D01';}}applyRevealBaseline(old);assert.deepEqual(story.nodes.filter(n=>!isRevealNode(n.id)&&!n.id.startsWith('SC04A_CONFESSION_')&&!n.id.startsWith('SC04B_PHONE_')&&!n.id.startsWith('ENDING_B_')),old);
 for(const [id,s]of Object.entries(baseline.scenes))assert.deepEqual(story.scenes[id],s);
 for(const [file,hash]of Object.entries(baseline.hashes))assert.equal(fileHash(dir+file),hash,file);
});
test('direct entrance only, fourteen sequential steps and six monotone shots, confession starts on D08',()=>{
 assert.equal(enter(story,'SC04A_CONFESSION_D01',{...vars,shelf_seen:true}).nodeId,'SC02_D26');assert.equal(enter(story,'SC04A_CONFESSION_D01',{...vars,guard_reports_kiss:false}).nodeId,'SC02_D26');assert.equal(enter(story,'SC04A_CONFESSION_D01',{...vars,route:'talk'}).nodeId,'SC02_D26');
 let s=start();const shots:string[]=[];
 for(let i=1;i<=14;i++){assert.equal(id(s),'SC04A_CONFESSION_D'+String(i).padStart(2,'0'));const n=story.nodes.find(n=>n.id===id(s))!;if(shots.at(-1)!==n.scene)shots.push(n.scene);const v=s.entries.at(-1)!.variables;assert.equal(v.sc04a_confrontation_visited,true);assert.equal(v.minsu_confessed,i>=8);assert.equal(v.route,'investigate');assert.equal(v.shelf_seen,false);assert.equal(v.guard_reports_kiss,true);for(const key of pack.flags_policy.do_not_set)assert.equal(v[key],story.variables[key]);if(i<14)s=advance(story,s);}
 assert.deepEqual(shots,pack.shots.map((s:any)=>s.id));assert.deepEqual(advance(story,s),s);
 const d8=until(start(),'SC04A_CONFESSION_D08');assert.equal(back(story,d8).entries.at(-1)!.variables.minsu_confessed,false);assert.deepEqual(parseSave(JSON.stringify(d8),story),d8);
});
test('two Russian choices show canonical Korean reactions on SH06 then distinct real stubs; back replaces flags',()=>{
 const before=until(start(),'SC04A_CONFESSION_D14');
 for(const o of pack.choices[0].options){const reaction=choose(story,before,o.id),n=story.nodes.find(n=>n.id===id(reaction))!;assert.equal(id(reaction),o.id);assert.equal(n.scene,'SC04A_CONFESSION_SH06');assert.equal(n.original,o.original);assert.equal(n.simple,o.simple);for(const [key,value]of Object.entries(o.sets))assert.equal(reaction.entries.at(-1)!.variables[key],value);assert.equal(reaction.entries.at(-1)!.variables.minsu_confessed,true);assert.deepEqual(back(story,reaction).entries,before.entries);const end=advance(story,reaction);if(o.id.endsWith('KNOW')){assert.equal(id(end),'SC04A_REVEAL_R02');}else assert.equal(id(end),'ENDING_B_D01');assert.deepEqual(parseSave(JSON.stringify(reaction),story),reaction);}
 const a=choose(story,before,'SC04A_CONFESSION_R_KNOW'),b=choose(story,back(story,a),'SC04A_CONFESSION_R_LEAVE');assert.equal(b.entries.at(-1)!.variables.identity_investigation_chosen,false);assert.equal(b.entries.at(-1)!.variables.yuna_declines_identity,true);
});
test('old guard placeholder saves resume into confession; after-shelf route stays on SC04B',()=>{
 const old={...vars} as Record<string,any>;for(const key of ['minsu_confessed','sc04a_confrontation_visited','identity_investigation_chosen','yuna_declines_identity'])delete old[key];
 const save=parseSave(JSON.stringify({version:1,storyId:story.id,updatedAt:'2026-11-08T00:00:00Z',entries:[{nodeId:'SC03B_TO_SC04A',variables:old}]}),story)!;assert.ok(save);assert.equal(save.entries[0].variables.minsu_confessed,false);assert.equal(id(advance(story,save)),'SC04A_CONFESSION_D01');
 const after={...fresh(story),entries:[enter(story,'SC03B_D16',{...vars,route:'talk',shelf_seen:true,guard_visit_context:'after_shelf'})]};assert.equal(id(advance(story,after)),'SC03B_TO_SC04B');
});
