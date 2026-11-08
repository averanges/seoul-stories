import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {advance,back,choose,enter,fresh,nodeText,parseSave} from './engine';
import {validateStory} from './validate';
import type {Save,Story} from './types';
const dir='public/stories/neoreul_mideo/';const story=JSON.parse(fs.readFileSync(dir+'story.json','utf8')) as Story;
for(const k of ['nodes','scenes','characters'] as const)(story as any)[k]=JSON.parse(fs.readFileSync(dir+k+'.json','utf8'));
const pack=JSON.parse(fs.readFileSync('docs/sc02-production/SC02_content.json','utf8'));
const baseline=JSON.parse(fs.readFileSync('docs/sc02-production/SC01_BASELINE.json','utf8'));
const id=(s:Save)=>s.entries.at(-1)!.nodeId;
const start=():Save=>({...fresh(story),entries:[enter(story,'SC02_D01',{...story.variables,first_question:'noise'})]});
function until(save:Save,target:string){for(let i=0;i<60;i++){if(id(save)===target)return save;const next=advance(story,save);assert.notDeepEqual(next,save);save=next;}throw Error('Not reached '+target);}
test('SC02 faithfully imports all 28 bilingual nodes and eight standalone images',()=>{
 assert.deepEqual(validateStory(story),[]);const nodes=story.nodes.filter(n=>n.id.startsWith('SC02_'));assert.equal(nodes.length,28);
 for(const d of pack.dialogue_nodes){const n=nodes.find(n=>n.id===d.id)!;assert.equal(n.scene,d.shot);assert.equal(n.text,d.original);assert.equal(n.original,d.original);assert.equal(n.simple,d.simple);assert.equal(n.teacher?.translation,d.ru);assert.deepEqual(n.teacher?.grammar,d.grammar);assert.deepEqual(n.teacher?.vocab,d.vocab);assert.equal(nodeText(n,story.variables,true),d.simple);}
 for(const shot of pack.shots){const s=story.scenes[shot.id];assert.equal(s.src,shot.image_path_planned);assert.equal(s.temporary,false);assert.ok(fs.existsSync(dir+s.src));}
 const c=nodes.find(n=>n.id==='SC02_D26')!;assert.equal(c.choiceLanguage,'ru');assert.deepEqual(c.choices!.map(c=>c.label),pack.choices[0].options.map((c:any)=>c.label_ru));
 assert.equal(nodes.filter(n=>n.scene==='SC02_SH06').length,7);
});
test('SC01 nodes, scenes, eight images and shared UI/engine have not changed',()=>{
 const expected=structuredClone(baseline.nodes);expected.find((n:any)=>n.id==='SC01_D19').next='SC02_D01';
 assert.deepEqual(story.nodes.filter(n=>n.id.startsWith('SC01_')),expected);
 assert.deepEqual(Object.fromEntries(Object.entries(story.scenes).filter(([id])=>id.startsWith('SC01_'))),baseline.scenes);
 for(const [file,digest] of Object.entries(baseline.hashes)){if(['src/main.tsx','src/engine.ts','src/SceneImage.tsx'].includes(file))continue;const content=file==='src/main.tsx'?Buffer.from(fs.readFileSync(file,'utf8').replace("'ДЕМО · ПРОДОЛЖЕНИЕ'","'ДЕМО · ПЕРВЫЕ ДВЕ СЦЕНЫ'")):fs.readFileSync(file);assert.equal(crypto.createHash('sha256').update(content).digest('hex'),digest,file);}
});
test('each route has 27 steps, eight monotonic shots and preserves first_question',()=>{
 for(const [choice,flag,end]of [['direct','talk','SC02_R_TALK'],['check','investigate','SC02_R_CHECK']]){
  let s=start();const shots:string[]=[];
  while(true){const n=story.nodes.find(n=>n.id===id(s))!;if(shots.at(-1)!==n.scene)shots.push(n.scene);if(id(s)===end)break;s=n.choices?choose(story,s,choice):advance(story,s);assert.ok(s.entries.length<=27);}
  assert.equal(id(s),end);assert.equal(s.entries.length,27);assert.deepEqual(shots,Array.from({length:8},(_,i)=>`SC02_SH0${i+1}`));assert.equal(s.entries.at(-1)!.variables.first_question,'noise');assert.equal(s.entries.at(-1)!.variables.route,flag);if(flag==='talk')assert.equal(advance(story,s).entries.at(-1)!.nodeId,'SC03A_D01');else assert.equal(id(advance(story,s)),'SC03B_D01');assert.deepEqual(parseSave(JSON.stringify(s),story),s);
 }
});
test('choice undo and replacement restores state and stays on SH08',()=>{
 const before=until(start(),'SC02_D26');let s=choose(story,before,'direct');s=back(story,s);assert.deepEqual(s.entries,before.entries);assert.equal(s.entries.at(-1)!.variables.route,null);
 s=choose(story,s,'check');assert.equal(id(s),'SC02_R_CHECK');assert.equal(s.entries.at(-1)!.variables.route,'investigate');assert.equal(s.entries.at(-1)!.variables.first_question,'noise');assert.equal(story.nodes.find(n=>n.id===id(s))!.scene,'SC02_SH08');
});
test('every legacy SC02 ID, selected route and history migrates once without loops',()=>{
 for(const [legacy,target]of Object.entries(pack.legacy_node_migration_suggestions)){
  const s={version:1,storyId:story.id,entries:[{nodeId:legacy,variables:{...story.variables,first_question:'what',route:'talk'}}],updatedAt:'2026-11-07T00:00:00Z'};
  const migrated=parseSave(JSON.stringify(s),story)!;assert.ok(migrated,legacy);assert.equal(id(migrated),target);assert.equal(migrated.entries.at(-1)!.variables.first_question,'what');assert.deepEqual(parseSave(JSON.stringify(migrated),story),migrated);
 }
 const old={version:1,storyId:story.id,updatedAt:'2026-11-07T00:00:00Z',entries:[{nodeId:'SC02_C1',variables:{...story.variables,first_question:'none',route:'investigate'},choiceId:'check'},{nodeId:'SC02_END_B',variables:{...story.variables,first_question:'none',route:'investigate'}}]};
 const migrated=parseSave(JSON.stringify(old),story)!;assert.ok(migrated);const undone=back(story,migrated);assert.equal(id(undone),'SC02_D26');assert.equal(undone.entries.at(-1)!.variables.route,null);assert.deepEqual(fresh(story).entries[0].variables,story.variables);
});

