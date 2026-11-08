import {applyRevealBaseline,isRevealNode,revealR01} from './reveal-test-compat';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {advance,back,choose,enter,fresh,nodeText,parseSave} from './engine';
import {validateStory} from './validate';
import type {Save,Story} from './types';
const root='public/stories/neoreul_mideo/',story=JSON.parse(fs.readFileSync(root+'story.json','utf8')) as Story;
for(const k of ['nodes','scenes','characters'] as const)(story as any)[k]=JSON.parse(fs.readFileSync(root+k+'.json','utf8'));
const pack=JSON.parse(fs.readFileSync('docs/sc04b-nightcall-production/data/SC04B_content.json','utf8')),baseline=JSON.parse(fs.readFileSync('docs/sc04b-nightcall-production/PREVIOUS_BASELINE.json','utf8'));
const vars={...story.variables,route:'talk',shelf_seen:true,shelf_visited:true,shelf_decision:'check',guard_visit_context:'after_shelf',guard_reports_kiss:true,guard_reports_other_woman:true,yuna_heard_kiss_report:true};
const id=(s:Save)=>s.entries.at(-1)!.nodeId;
const start=():Save=>({...fresh(story),entries:[enter(story,'SC04B_PHONE_D01',vars)]});
function until(s:Save,target:string){for(let i=0;i<30;i++){if(id(s)===target)return s;const n=advance(story,s);assert.notDeepEqual(n,s);s=n;}throw Error(target);}
test('phone scene preserves canonical twelve texts, teacher content and three standalone assets',()=>{
 assert.deepEqual(validateStory(story),[]);
 for(const d of pack.dialogue_nodes){const n=story.nodes.find(n=>n.id===d.id)!;assert.equal(n.scene,d.shot_id);assert.equal(nodeText(n,vars),d.original);assert.equal(nodeText(n,vars,true),d.simple);assert.equal(n.teacher?.translation,d.ru);assert.equal(n.teacher?.note,d.teacher_notes);assert.deepEqual(n.teacher?.grammar,d.grammar.split(';').map((s:string)=>s.trim()));assert.deepEqual(n.teacher?.vocab,d.vocabulary.split(';').map((s:string)=>s.trim()));if(d.speaker==='Minsu (phone)')assert.equal(n.speaker,'minsu_phone');}
 for(let i=1;i<=3;i++){const s=story.scenes['SC04B_PHONE_SH0'+i];assert.equal(s.src,'assets/scene_04b_nightcall/SC04B_SH0'+i+'.webp');assert.ok(fs.existsSync(root+s.src));assert.deepEqual(s.characters,[]);}
});
test('phone addition only opens after-shelf connector and preserves all previous art, dialogue and UI/engine',()=>{
 const old=structuredClone(baseline.nodes),c=old.find((n:any)=>n.id==='SC03B_TO_SC04B');delete c.ending;c.next='SC04B_PHONE_D01';for(const id of ['SC04A_CONFESSION_TO_ENDING_B','SC04B_PHONE_TO_ENDING_B']){const n=old.find((n:any)=>n.id===id);if(n){delete n.ending;n.next='ENDING_B_D01';n.when={variable:'yuna_declines_identity',op:'eq',value:false};n.skipTo='ENDING_B_D01';}}applyRevealBaseline(old);assert.deepEqual(story.nodes.filter(n=>!isRevealNode(n.id)&&!n.id.startsWith('SC04B_PHONE_')&&!n.id.startsWith('ENDING_B_')),old);
 for(const [id,s]of Object.entries(baseline.scenes))assert.deepEqual(story.scenes[id],s);for(const [id,c]of Object.entries(baseline.characters))assert.deepEqual(story.characters[id],c);
 for(const [file,hash]of Object.entries(baseline.hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file.startsWith('src/')?file:root+file)).digest('hex'),hash,file);
});
test('phone entrance requires shelf and kiss; confession flag on D06, monotone 2/4/6 shot sequence',()=>{
 for(const extra of [{shelf_seen:false},{guard_reports_kiss:false}])assert.equal(enter(story,'SC04B_PHONE_D01',{...vars,...extra}).nodeId,'SC02_D26');
 let s=start();const shots=[];
 for(let i=1;i<=12;i++){assert.equal(id(s),'SC04B_PHONE_D'+String(i).padStart(2,'0'));const n=story.nodes.find(n=>n.id===id(s))!;shots.push(n.scene);assert.equal(s.entries.at(-1)!.variables.minsu_confessed,i>=6);assert.equal(s.entries.at(-1)!.variables.sc04b_call_visited,true);for(const key of pack.flags_policy.do_not_set)assert.equal(s.entries.at(-1)!.variables[key],story.variables[key]);if(i<12)s=advance(story,s);}
 assert.deepEqual(shots,[1,1,2,2,2,2,3,3,3,3,3,3].map(i=>'SC04B_PHONE_SH0'+i));assert.deepEqual(advance(story,s),s);
 const confess=until(start(),'SC04B_PHONE_D06');assert.equal(back(story,confess).entries.at(-1)!.variables.minsu_confessed,false);assert.deepEqual(parseSave(JSON.stringify(confess),story),confess);
});
test('Russian choices use teacher samples but show distinct canonical reactions, preserve shot and reverse choice flags',()=>{
 const before=until(start(),'SC04B_PHONE_D12'),n=story.nodes.find(n=>n.id===id(before))!;assert.equal(n.choiceLanguage,'ru');
 for(const o of pack.choices[0].options){const c=n.choices!.find(c=>c.id===o.id)!;assert.equal(c.label,o.label_ru);assert.equal(c.answer,o.original);assert.equal(c.answerSimple,o.simple);const s=choose(story,before,o.id),r=pack.reaction_nodes.find((r:any)=>r.id===o.reaction_id);assert.equal(id(s),r.id);const rn=story.nodes.find(n=>n.id===id(s))!;assert.equal(rn.original,o.id.endsWith('KNOW')?revealR01.original:r.original);assert.equal(rn.simple,o.id.endsWith('KNOW')?revealR01.simple:r.simple);assert.equal(rn.scene,'SC04B_PHONE_SH03');for(const [key,value]of Object.entries(o.sets))assert.equal(s.entries.at(-1)!.variables[key],value);assert.equal(s.entries.at(-1)!.variables.minsu_confessed,true);assert.deepEqual(back(story,s).entries,before.entries);if(o.id.endsWith('KNOW'))assert.equal(id(advance(story,s)),'SC04B_REVEAL_R02');else assert.equal(id(advance(story,s)),'ENDING_B_D01');assert.deepEqual(parseSave(JSON.stringify(s),story),s);}
 const yes=choose(story,before,'SC04B_PHONE_R_KNOW'),no=choose(story,back(story,yes),'SC04B_PHONE_R_LEAVE');assert.equal(no.entries.at(-1)!.variables.identity_investigation_chosen,false);assert.equal(no.entries.at(-1)!.variables.yuna_declines_identity,true);
});
test('legacy after-shelf placeholder resumes call; direct guard path still resumes confession',()=>{
 const old={...vars} as Record<string,any>;delete old.sc04b_call_visited;const s=parseSave(JSON.stringify({version:1,storyId:story.id,updatedAt:'2026-11-08T00:00:00Z',entries:[{nodeId:'SC03B_TO_SC04B',variables:old}]}),story)!;assert.ok(s);assert.equal(s.entries[0].variables.sc04b_call_visited,false);assert.equal(id(advance(story,s)),'SC04B_PHONE_D01');
 const direct={...fresh(story),entries:[enter(story,'SC03B_TO_SC04A',{...vars,route:'investigate',shelf_seen:false})]};assert.equal(id(advance(story,direct)),'SC04A_CONFESSION_D01');
});
