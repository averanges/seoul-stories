import {fileHash} from './integrity';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {advance,back,enter,fresh,nodeText,parseSave} from './engine';
import {validateStory} from './validate';
import type {Story} from './types';
const dir='public/stories/neoreul_mideo/';
const story=JSON.parse(fs.readFileSync(dir+'story.json','utf8')) as Story;
for(const k of ['nodes','scenes','characters'] as const)(story as any)[k]=JSON.parse(fs.readFileSync(dir+k+'.json','utf8'));
const pack=JSON.parse(fs.readFileSync('docs/sc04a-production/SC04A_content.json','utf8'));
test('SC04A preserves approved dialogue, teacher materials and original PNG bytes',()=>{
 assert.deepEqual(validateStory(story),[]);
 assert.equal(story.nodes.filter(n=>/^SC04A_D/.test(n.id)).length,10);
 for(const d of pack){const n=story.nodes.find(n=>n.id===d.id)!;assert.equal(nodeText(n,story.variables),d.original);assert.equal(nodeText(n,story.variables,true),d.simple);assert.equal(n.teacher?.translation,d.ru);assert.deepEqual(n.teacher?.vocab,d.vocabulary);assert.ok(n.teacher?.note);assert.equal(n.choices,undefined);}
 const art=JSON.parse(fs.readFileSync('docs/sc04a-production/APPROVED_ART_HASHES.json','utf8'));for(let i=1;i<=4;i++)assert.equal(fileHash(dir+story.scenes['SC04A_SH0'+i].src),art['SC04A_SH0'+i]);
});
test('trust ending walks 2/3/3/2 frames to false peace; back and reload preserve variables',()=>{
 let s={...fresh(story),entries:[enter(story,'SC03A_R_TRUST',{...story.variables,route:'talk',shelf_decision:'trust',shelf_seen:true,shelf_visited:true})]};
 const vars=structuredClone(s.entries[0].variables),shots:string[]=[];
 s=advance(story,s);assert.equal(s.entries.at(-1)!.nodeId,'SC03A_BRIDGE_D01');
 for(let i=1;i<=10;i++){s=advance(story,s);const n=story.nodes.find(n=>n.id===s.entries.at(-1)!.nodeId)!;assert.equal(n.id,'SC04A_D'+String(i).padStart(2,'0'));shots.push(n.scene);assert.deepEqual(s.entries.at(-1)!.variables,vars);assert.deepEqual(parseSave(JSON.stringify(s),story),s);}
 assert.deepEqual(shots,[1,1,2,2,2,3,3,3,4,4].map(i=>'SC04A_SH0'+i));
 s=advance(story,s);assert.equal(s.entries.at(-1)!.nodeId,'ENDING_A_FALSE_PEACE');assert.deepEqual(advance(story,s),s);assert.equal(back(story,s).entries.at(-1)!.nodeId,'SC04A_D10');
 assert.equal(story.nodes.find(n=>n.id==='SC03B_TO_SC04A')!.next,'SC04A_CONFESSION_D01');
});
