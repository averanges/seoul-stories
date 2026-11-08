import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {advance,back,choose,enter,fresh,nodeText,parseSave} from './engine';
import {validateStory} from './validate';
import type {Save,Story} from './types';
const dir='public/stories/neoreul_mideo/';const story=JSON.parse(fs.readFileSync(dir+'story.json','utf8')) as Story;
for(const k of ['nodes','scenes','characters'] as const)(story as any)[k]=JSON.parse(fs.readFileSync(dir+k+'.json','utf8'));
const pack=JSON.parse(fs.readFileSync('docs/sc03a-production/SC03A_content.json','utf8'));
const baseline=JSON.parse(fs.readFileSync('docs/sc03a-production/PREVIOUS_BASELINE.json','utf8'));
const id=(s:Save)=>s.entries.at(-1)!.nodeId;
const start=():Save=>({...fresh(story),entries:[enter(story,'SC03A_D01',{...story.variables,first_question:'what',route:'talk'})]});
function until(save:Save,target:string){for(let i=0;i<100;i++){if(id(save)===target)return save;const next=advance(story,save);assert.notDeepEqual(next,save);save=next;}throw Error('Not reached '+target);}
test('SC03A exact seventeen bilingual nodes and six independent assets validate',()=>{
 assert.deepEqual(validateStory(story),[]);assert.equal(story.nodes.filter(n=>n.id.startsWith('SC03A_')&&!n.id.startsWith('SC03A_BRIDGE_')).length,17);
 for(const d of pack.dialogue_nodes){const n=story.nodes.find(n=>n.id===d.id)!;assert.equal(n.scene,d.shot);assert.equal(n.original,d.original);assert.equal(n.simple,d.simple);assert.equal(n.teacher?.translation,d.ru);assert.equal(n.teacher?.note,d.teacher_note);assert.deepEqual(n.teacher?.grammar,d.grammar);assert.equal(nodeText(n,story.variables),d.original);assert.equal(nodeText(n,story.variables,true),d.simple);}
 for(let i=1;i<=6;i++){const s=story.scenes[`SC03A_SH0${i}`];assert.equal(s.src,`assets/scene_03a/SC03A_SH0${i}.webp`);assert.ok(fs.existsSync(dir+s.src));assert.equal(s.temporary,false);}
 assert.equal(story.nodes.find(n=>n.id==='SC03A_D15')!.choiceLanguage,'ru');
});
test('previous scenes and art preserved except talk connector and generic demo label',()=>{
 const previous=structuredClone(baseline.nodes);const talk=previous.find((n:any)=>n.id==='SC02_R_TALK');delete talk.ending;talk.next='SC03A_D01';
 delete previous.find((n:any)=>n.id==='SC02_R_CHECK').ending;previous.find((n:any)=>n.id==='SC02_R_CHECK').next='SC03B_D01';assert.deepEqual(story.nodes.filter(n=>n.id.startsWith('SC01_')||n.id.startsWith('SC02_')),previous);
 for(const [id,scene]of Object.entries(baseline.scenes))assert.deepEqual(story.scenes[id],scene);
 for(const [file,digest]of Object.entries(baseline.hashes)){if(['src/main.tsx','src/engine.ts','src/SceneImage.tsx'].includes(file))continue;const bytes=file==='src/main.tsx'?Buffer.from(fs.readFileSync(file,'utf8').replace("'ДЕМО · ПРОДОЛЖЕНИЕ'","'ДЕМО · ПЕРВЫЕ ДВЕ СЦЕНЫ'")):fs.readFileSync(file);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),digest,file);}
});
test('each branch visits sixteen steps and six shots in order without symbolic missing targets',()=>{
 for(const choice of ['trust','check']){let s=start();const shots:string[]=[];
 while(true){const n=story.nodes.find(n=>n.id===id(s))!;if(shots.at(-1)!==n.scene)shots.push(n.scene);if(id(s).startsWith('SC03A_R_'))break;s=n.choices?choose(story,s,choice):advance(story,s);assert.ok(s.entries.length<=16);}
 assert.equal(s.entries.length,16);assert.deepEqual(shots,Array.from({length:6},(_,i)=>`SC03A_SH0${i+1}`));const v=s.entries.at(-1)!.variables;assert.equal(v.route,'talk');assert.equal(v.first_question,'what');assert.equal(v.shelf_decision,choice);assert.equal(v.shelf_seen,true);assert.equal(v.shelf_visited,true);assert.equal(v.guard_visit_context,choice==='check'?'after_shelf':null);for(const key of pack.flags_policy.must_not_set)assert.equal(v[key],story.variables[key]);if(choice==='check')assert.equal(id(advance(story,s)),'SC03B_D01');else assert.equal(id(advance(story,s)),'SC03A_BRIDGE_D01');assert.deepEqual(parseSave(JSON.stringify(s),story),s);}
});
test('entry requires talk and back reverses all new effects when changing trust choice',()=>{
 assert.equal(enter(story,'SC03A_D01',{...story.variables,route:'investigate'}).nodeId,'SC02_D26');
 const before=until(start(),'SC03A_D15');let s=choose(story,before,'check');s=back(story,s);assert.deepEqual(s.entries,before.entries);s=choose(story,s,'trust');assert.equal(s.entries.at(-1)!.variables.guard_visit_context,null);assert.equal(s.entries.at(-1)!.variables.route,'talk');
});
test('old talk-terminal saves resume into SC03A; old guard terminal stays terminal',()=>{
 const oldVars={first_question:'noise',route:'talk',minsu_said_he_went_to_check_move_preparation:false,minsu_said_an_object_fell_or_moved:true,yuna_avoided_further_questions:false};
 for(const oldId of ['SC02_R_TALK','SC02_END_A']){const save=parseSave(JSON.stringify({version:1,storyId:story.id,updatedAt:'2026-11-07T00:00:00Z',entries:[{nodeId:oldId,variables:oldVars}]}),story)!;assert.ok(save);assert.equal(save.entries.at(-1)!.variables.shelf_seen,false);const next=advance(story,save);assert.equal(id(next),'SC03A_D01');assert.equal(next.entries.at(-1)!.variables.first_question,'noise');}
 const guard=enter(story,'SC02_R_CHECK',{...story.variables,route:'investigate'});const save={...fresh(story),entries:[guard]};assert.equal(id(advance(story,save)),'SC03B_D01');
});

