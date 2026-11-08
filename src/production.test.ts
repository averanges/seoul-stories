import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {advance,back,choose,fresh,nodeText,parseSave} from './engine';
import type {Story} from './types';
const dir='public/stories/neoreul_mideo/';const story=JSON.parse(fs.readFileSync(dir+'story.json','utf8')) as Story;
for(const k of ['nodes','scenes','characters'] as const)(story as any)[k]=JSON.parse(fs.readFileSync(dir+k+'.json','utf8'));
const pack=JSON.parse(fs.readFileSync('docs/sc01-production/SC01_content.json','utf8'));
test('all production original/simple lines and shot assignments match source',()=>{
 const nodes=story.nodes.filter(n=>n.id.startsWith('SC01_'));assert.equal(nodes.length,22);
 for(const d of pack.dialogue_nodes){const n=nodes.find(n=>n.id===d.id)!;assert.equal(n.original,d.original);assert.equal(n.simple,d.simple);assert.equal(n.text,d.original);assert.equal(n.scene,d.shot);assert.equal(n.teacher?.translation,d.ru);assert.equal(nodeText(n,story.variables,true),d.simple);assert.equal(nodeText(n,story.variables),d.original);}
 const scenes=Object.entries(story.scenes).filter(([id])=>id.startsWith('SC01_SH'));assert.equal(scenes.length,8);for(const [id,s]of scenes){assert.equal(s.src,`assets/scene_01/${id}.webp`);assert.ok(fs.existsSync(dir+s.src));assert.equal(s.temporary,false);}
});
test('each choice visits exactly twenty steps and eight shots in monotone order',()=>{
 for(const option of ['ask_what','ask_noise','let_go']){let save=fresh(story);const shots:string[]=[];while(true){const entry=save.entries.at(-1)!;if(entry.nodeId==='SC02_D01')break;const n=story.nodes.find(n=>n.id===entry.nodeId)!;if(shots.at(-1)!==n.scene)shots.push(n.scene);if(n.choices&&!entry.choiceId)save=choose(story,save,option);else save=advance(story,save);assert.ok(save.entries.length<25);}
 assert.deepEqual(shots,Array.from({length:8},(_,i)=>`SC01_SH0${i+1}`));assert.equal(save.entries.length,21);
 const reaction=save.entries.find(e=>e.nodeId.startsWith('SC01_R'))!;assert.ok(reaction);assert.equal(story.nodes.find(n=>n.id===reaction.nodeId)!.scene,'SC01_SH07');
 }
});
test('legacy SC01 and SC02 saves retain progress, choices and restore new fact flags',()=>{
 const old={version:1,storyId:story.id,updatedAt:'2026-11-06T00:00:00Z',entries:[{nodeId:'SC01_C1',variables:{first_question:'noise',route:null},choiceId:'ask_noise'},{nodeId:'SC01_R2',variables:{first_question:'noise',route:null}},{nodeId:'SC02_17',variables:{first_question:'noise',route:null}}]};
 const s=parseSave(JSON.stringify(old),story)!;assert.ok(s);assert.equal(s.entries.at(-1)!.nodeId,'SC02_D22');assert.equal(s.entries[0].nodeId,'SC01_D16');assert.equal(s.entries[1].nodeId,'SC01_R_B');assert.equal(s.entries.at(-1)!.variables.minsu_said_an_object_fell_or_moved,true);assert.equal(s.entries.at(-1)!.variables.first_question,'noise');
 const atReaction=back(story,s);const atChoice=back(story,atReaction);assert.equal(atChoice.entries.at(-1)!.nodeId,'SC01_D16');assert.equal(atChoice.entries.at(-1)!.variables.first_question,null);
});
test('SC02 references Thursday for the apartment visit, not Saturday yesterday',()=>{
 for(const id of ['SC02_D16','SC02_D19']){const n=story.nodes.find(n=>n.id===id)!;assert.match(n.text,/목요일/);assert.doesNotMatch(n.text,/어제/);}
});

