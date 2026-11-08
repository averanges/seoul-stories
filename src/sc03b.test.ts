import {applyRevealBaseline,isRevealNode,revealR01} from './reveal-test-compat';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {advance,back,enter,fresh,nodeText,parseSave,presentedNode} from './engine';
import {validateStory} from './validate';
import type {Save,Story,Variables} from './types';
const dir='public/stories/neoreul_mideo/';const story=JSON.parse(fs.readFileSync(dir+'story.json','utf8')) as Story;
for(const k of ['nodes','scenes','characters'] as const)(story as any)[k]=JSON.parse(fs.readFileSync(dir+k+'.json','utf8'));
const pack=JSON.parse(fs.readFileSync('docs/sc03b-production/SC03B_content.json','utf8'));
const baseline=JSON.parse(fs.readFileSync('docs/sc03b-production/PREVIOUS_BASELINE.json','utf8'));
const contexts: Record<'direct'|'after_shelf',Variables>={direct:{...story.variables,first_question:'noise',route:'investigate'},after_shelf:{...story.variables,first_question:'what',route:'talk',shelf_seen:true,shelf_visited:true,shelf_decision:'check',guard_visit_context:'after_shelf'}};
const id=(s:Save)=>s.entries.at(-1)!.nodeId;
const start=(vars:Variables):Save=>({...fresh(story),entries:[enter(story,'SC03B_D01',vars)]});
function until(s:Save,target:string){for(let i=0;i<30;i++){if(id(s)===target)return s;const next=advance(story,s);assert.notDeepEqual(next,s);s=next;}throw Error('Not reached '+target);}
test('SC03B sixteen canonical bilingual nodes, five standalone shots, no choices',()=>{
 assert.deepEqual(validateStory(story),[]);assert.equal(story.nodes.filter(n=>!isRevealNode(n.id)&&/^SC03B_D\d+$/.test(n.id)).length,16);
 for(const d of pack.dialogue_nodes){const n=story.nodes.find(n=>n.id===d.id)!;assert.equal(n.original,d.original);assert.equal(n.simple,d.simple);assert.equal(n.scene,d.shot);assert.equal(n.teacher?.translation,d.ru);assert.equal(n.teacher?.note,d.teacher_note);assert.deepEqual(n.teacher?.grammar,d.grammar);assert.equal(n.choices,undefined);}
 for(let i=1;i<=5;i++){const scene=story.scenes[`SC03B_SH0${i}`];assert.equal(scene.src,`assets/scene_03b/SC03B_SH0${i}.webp`);assert.ok(fs.existsSync(dir+scene.src));assert.equal(scene.temporary,false);}
});
test('only two connector edges changed in previous scenes; original media and design preserved',()=>{
 const previous=structuredClone(baseline.nodes);for(const target of ['SC02_R_CHECK','SC03A_R_CHECK']){const n=previous.find((n:any)=>n.id===target);delete n.ending;n.next='SC03B_D01';}
 const trust=previous.find((n:any)=>n.id==='SC03A_R_TRUST');delete trust.ending;trust.next='SC03A_BRIDGE_D01';applyRevealBaseline(previous);assert.deepEqual(story.nodes.filter(n=>!isRevealNode(n.id)&&!n.id.startsWith('SC03B_')&&!n.id.startsWith('SC03A_BRIDGE_')&&!n.id.startsWith('SC04A_')&&!n.id.startsWith('SC04B_PHONE_')&&!n.id.startsWith('ENDING_B_')&&n.id!=='ENDING_A_FALSE_PEACE'),previous);for(const [id,s]of Object.entries(baseline.scenes))assert.deepEqual(story.scenes[id],s);
 for(const [file,digest]of Object.entries(baseline.hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),digest,file);
});
test('D04 variant resolves original/simple/translation/note together without mutating data',()=>{
 const n=story.nodes.find(n=>n.id==='SC03B_D04')!;const original=structuredClone(n);const source=pack.dialogue_nodes.find((n:any)=>n.id==='SC03B_D04');
 for(const key of ['direct','after_shelf'] as const){const vars=contexts[key];const v=source.variants[key];assert.equal(nodeText(n,vars),v.original);assert.equal(nodeText(n,vars,true),v.simple);assert.equal(presentedNode(n,vars).teacher!.translation,v.ru);if(v.teacher_note)assert.equal(presentedNode(n,vars).teacher!.note,v.teacher_note);}
 assert.deepEqual(n,original);
});
test('two entrances traverse sixteen steps and five shots; exit to distinct working placeholders',()=>{
 for(const key of ['direct','after_shelf'] as const){const vars=contexts[key];let s=start(vars);const shots:string[]=[];let count=0;
 while(true){const n=story.nodes.find(n=>n.id===id(s))!;if(n.ending||id(s)==='SC03B_TO_SC04A'||id(s)==='SC03B_TO_SC04B')break;count++;if(shots.at(-1)!==n.scene)shots.push(n.scene);const v=s.entries.at(-1)!.variables;assert.equal(v.guard_reports_other_woman,count>=5);assert.equal(v.guard_reports_kiss,count>=9);assert.equal(v.yuna_heard_kiss_report,count>=9);s=advance(story,s);assert.ok(count<=16);}
 assert.equal(count,16);assert.deepEqual(shots,Array.from({length:5},(_,i)=>`SC03B_SH0${i+1}`));assert.equal(id(s),key==='direct'?'SC03B_TO_SC04A':'SC03B_TO_SC04B');const v=s.entries.at(-1)!.variables;for(const name of pack.flags_policy.preserve_existing)assert.equal(v[name],vars[name as keyof typeof vars],name);for(const name of pack.flags_policy.do_not_set)assert.equal(v[name],story.variables[name]);if(key==='direct')assert.equal(id(advance(story,s)),'SC04A_CONFESSION_D01');else assert.equal(id(advance(story,s)),'SC04B_PHONE_D01');assert.deepEqual(parseSave(JSON.stringify(s),story),s);
 }
});
test('back restores effect snapshots around D05 and D09; reload never reapplies numeric entry effects',()=>{
 let s=until(start(contexts.direct),'SC03B_D05');assert.equal(s.entries.at(-1)!.variables.guard_reports_other_woman,true);s=back(story,s);assert.equal(id(s),'SC03B_D04');assert.equal(s.entries.at(-1)!.variables.guard_reports_other_woman,false);s=until(s,'SC03B_D09');assert.equal(s.entries.at(-1)!.variables.guard_reports_kiss,true);s=back(story,s);assert.equal(s.entries.at(-1)!.variables.guard_reports_kiss,false);assert.equal(s.entries.at(-1)!.variables.guard_reports_other_woman,true);
 const clone=structuredClone(story);clone.variables.counter=0;clone.nodes.find(n=>n.id==='SC03B_D05')!.onEnterEffects=[{variable:'counter',add:1}];const save={...fresh(clone),entries:[enter(clone,'SC03B_D05',{...contexts.direct,counter:0})]};assert.equal(save.entries[0].variables.counter,1);assert.equal(parseSave(JSON.stringify(save),clone)!.entries[0].variables.counter,1);
});
test('D09 report remains on guard SH03; D10 hard-cuts to shock SH04 with brief delay',()=>{
 const d9=story.nodes.find(n=>n.id==='SC03B_D09')!,d10=story.nodes.find(n=>n.id==='SC03B_D10')!;assert.equal(d9.scene,'SC03B_SH03');assert.equal(d9.next,d10.id);assert.equal(d10.scene,'SC03B_SH04');assert.equal(story.scenes[d10.scene].transition,'cut');assert.equal(d10.textDelayMs,650);
 assert.equal(enter(story,'SC03B_D01',story.variables).nodeId,'SC02_D26');
});
test('legacy route placeholders acquire new false defaults and continue through correct context',()=>{
 for(const [source,vars]of [['SC02_END_B',contexts.direct],['SC03A_R_CHECK',contexts.after_shelf]] as const){const old={...vars} as Variables;delete old.guard_reports_other_woman;delete old.guard_reports_kiss;delete old.yuna_heard_kiss_report;const save=parseSave(JSON.stringify({version:1,storyId:story.id,entries:[{nodeId:source,variables:old}],updatedAt:'2026-11-07T00:00:00Z'}),story)!;assert.ok(save);const next=advance(story,save);assert.equal(id(next),'SC03B_D01');assert.equal(next.entries.at(-1)!.variables.guard_reports_kiss,false);assert.equal(next.entries.at(-1)!.variables.route,vars.route);assert.equal(next.entries.at(-1)!.variables.shelf_seen,vars.shelf_seen);}
});

