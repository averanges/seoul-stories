import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { advance, applyChoice, back, choose, enter, fresh, matches, needsExternalPanel, parseSave, position } from './engine';
import { validateStory } from './validate';
import type { Story } from './types';
const base = 'public/stories/station/';
const story = JSON.parse(fs.readFileSync(base+'story.json','utf8')) as Story;
story.nodes=JSON.parse(fs.readFileSync(base+'nodes.json','utf8'));
story.scenes=JSON.parse(fs.readFileSync(base+'scenes.json','utf8'));
story.characters=JSON.parse(fs.readFileSync(base+'characters.json','utf8'));
test('demo validates and all eight choice combinations reach an ending',()=>{
  assert.deepEqual(validateStory(story),[]);
  const results = new Set();
  for(let mask=0;mask<8;mask++){
    let save=fresh(story),pick=0,steps=0;
    while(steps++<30){
      const entry=save.entries.at(-1)!;
      const node=story.nodes.find(n=>n.id===entry.nodeId)!;
      if(node.ending){results.add(node.id);break;}
      if(node.choices&&!entry.choiceId){const c=node.choices[(mask>>pick++)&1];save=choose(story,save,c.id);assert.ok(save.entries.at(-1)!.choiceId);}
      save=advance(story,save);
    }
    assert.equal(pick,3);assert.ok(steps<30);
  }
  assert.deepEqual(results,new Set(['found','tomorrow']));
});
test('choice reaction waits for advance and cannot apply twice',()=>{
  const s=advance(story,fresh(story));const selected=choose(story,s,'ask');
  assert.equal(selected.entries.at(-1)!.nodeId,'notebook');assert.equal(selected.entries.at(-1)!.variables.trust,1);
  assert.deepEqual(choose(story,selected,'ask'),selected);
  assert.equal(advance(story,selected).entries.at(-1)!.nodeId,'detail');
});
test('undo reaction and previous screen restore complete variable snapshots',()=>{
  const initial=advance(story,fresh(story));const chosen=choose(story,initial,'ask');
  assert.deepEqual(back(story,chosen).entries,initial.entries);
  const later=advance(story,chosen);const previous=back(story,later);
  assert.deepEqual(previous.entries,chosen.entries);
  assert.deepEqual(back(story,previous).entries,initial.entries);
  assert.deepEqual(story.variables,{trust:0,clue:false});
});
test('nested conditions and numeric / boolean effects',()=>{
  assert.equal(matches({all:[{variable:'trust',op:'gte',value:2},{not:{variable:'clue',op:'eq',value:false}}]},{trust:2,clue:true}),true);
  assert.equal(matches({any:[{variable:'trust',op:'lt',value:0},{variable:'clue',op:'eq',value:true}]},{trust:2,clue:false}),false);
  assert.deepEqual(applyChoice(story.variables,story.nodes[1].choices![0]),{trust:1,clue:true});
});
test('conditional nodes skip with cycle detection',()=>{
  const s=structuredClone(story);s.nodes[0].when={variable:'clue',op:'eq',value:true};s.nodes[0].skipTo='notebook';
  assert.equal(enter(s,'arrival',s.variables).nodeId,'notebook');s.nodes[0].skipTo='arrival';
  assert.throws(()=>enter(s,'arrival',s.variables),/Цикл/);
});
test('layout avoids annotated face, including unsafe manual override',()=>{
  const scene=story.scenes.platform;assert.equal(position(scene,'auto'),'left');assert.equal(position(scene,'right'),'bottom');
  assert.equal(position(story.scenes.office,'auto'),'right');
  assert.equal(needsExternalPanel({...scene,faces:[{x:0,y:0,width:1,height:1}]}),true);
  assert.equal(needsExternalPanel(scene),false);
});
test('corrupt and outdated saves are discarded',()=>{
  assert.equal(parseSave('{broken',story),null);assert.equal(parseSave(JSON.stringify({...fresh(story),storyId:'other'}),story),null);
  const s=fresh(story);s.entries[0].nodeId='missing';assert.equal(parseSave(JSON.stringify(s),story),null);
  assert.deepEqual(parseSave(JSON.stringify(fresh(story)),story)?.entries,fresh(story).entries);
});
test('validator explains missing targets, unfinished branches, invalid conditions and unreachable nodes',()=>{
  const s=structuredClone(story);s.nodes[0].next='missing';s.nodes[2].next=undefined;s.nodes[1].choices![0].when={variable:'typo',op:'eq',value:true};
  const issues=validateStory(s);assert.ok(issues.some(i=>i.message.includes('не существует')));assert.ok(issues.some(i=>i.message.includes('незавершённая')));assert.ok(issues.some(i=>i.message.includes('тип значения')));assert.ok(issues.some(i=>i.message.includes('недостижим')));
  for(const data of [null,{}, {version:1,nodes:[]}, {...story,scenes:{broken:null}}, {...story,nodes:[null]}]) assert.ok(validateStory(data).length);
});
