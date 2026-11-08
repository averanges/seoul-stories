import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { advance, back, choose, fresh, parseSave, matches } from './engine';
import { validateStory } from './validate';
import type { Save, Story } from './types';
const dir='public/stories/neoreul_mideo/';
const story=JSON.parse(fs.readFileSync(dir+'story.json','utf8')) as Story;
story.nodes=JSON.parse(fs.readFileSync(dir+'nodes.json','utf8'));
story.scenes=JSON.parse(fs.readFileSync(dir+'scenes.json','utf8'));
story.characters=JSON.parse(fs.readFileSync(dir+'characters.json','utf8'));
const id=(s:Save)=>s.entries.at(-1)!.nodeId;
function until(s:Save,target:string){for(let i=0;i<80;i++){if(id(s)===target)return s;const next=advance(story,s);assert.notDeepEqual(next,s,`stalled at ${id(s)}`);s=next;}throw new Error(`Not reached: ${target}`);}
test('all six routes cross scene boundary and stop at the intended continuation',()=>{
 for(const [first,value] of [['ask_what','what'],['ask_noise','noise'],['let_go','none']])for(const [route,flag,end] of [['direct','talk','SC02_R_TALK'],['check','investigate','SC02_R_CHECK']]){
  let s=until(fresh(story),'SC01_D16');s=choose(story,s,first);
  assert.equal(s.entries.at(-1)!.variables.first_question,value);
  assert.ok(id(s).startsWith('SC01_R'));
  s=until(s,'SC01_D19');const length=s.entries.length;s=advance(story,s);
  assert.equal(id(s),'SC02_D01');assert.equal(s.entries.length,length+1);assert.equal(s.entries.at(-1)!.variables.first_question,value);
  s=until(s,'SC02_D26');s=choose(story,s,route);
  assert.equal(id(s),end);assert.equal(s.entries.at(-1)!.variables.route,flag);
  if(flag==='talk')assert.equal(advance(story,s).entries.at(-1)!.nodeId,'SC03A_D01');
  else assert.equal(id(advance(story,s)),'SC03B_D01');
  assert.deepEqual(parseSave(JSON.stringify(s),story),s);
 }
});
test('third choice -> Back -> different choice replaces reaction and resets flags',()=>{
 const start=until(fresh(story),'SC01_D16');let s=choose(story,start,'let_go');
 assert.equal(id(s),'SC01_R_C');s=back(story,s);assert.deepEqual(s.entries,start.entries);
 s=choose(story,s,'ask_noise');assert.equal(id(s),'SC01_R_B');assert.equal(s.entries.at(-1)!.variables.first_question,'noise');
 assert.equal(s.entries.filter(e=>e.choiceId).length,1);
 s=until(s,'SC02_D26');const before=s;s=choose(story,s,'check');assert.equal(id(s),'SC02_R_CHECK');
 s=back(story,s);assert.deepEqual(s.entries,before.entries);assert.equal(s.entries.at(-1)!.variables.route,null);
 s=choose(story,s,'direct');assert.equal(id(s),'SC02_R_TALK');assert.equal(s.entries.at(-1)!.variables.route,'talk');
});
test('save reload in scene two retains current node, first_question and history',()=>{
 let s=choose(story,until(fresh(story),'SC01_D16'),'ask_what');s=until(s,'SC02_D17');
 const restored=parseSave(JSON.stringify(s),story)!;assert.ok(restored);assert.equal(id(restored),'SC02_D17');assert.equal(restored.entries.at(-1)!.variables.first_question,'what');assert.equal(restored.entries.at(-1)!.variables.route,null);
 assert.deepEqual(back(story,restored).entries,back(story,s).entries);
 assert.equal(matches({variable:'first_question',op:'eq',value:'what'},restored.entries.at(-1)!.variables),true);
});



