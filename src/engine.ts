import type { Choice, Condition, Entry, Position, Rect, Route, Save, Scene, Story, StoryNode, Variables } from './types';
import { compatibleValue } from './values';
export function matches(c: Condition, vars: Variables): boolean {
  if ('all' in c) return c.all.every(x => matches(x, vars));
  if ('any' in c) return c.any.some(x => matches(x, vars));
  if ('not' in c) return !matches(c.not, vars);
  const v = vars[c.variable];
  if (c.op === 'eq') return v === c.value;
  if (c.op === 'ne') return v !== c.value;
  if (typeof v !== 'number' || typeof c.value !== 'number') return false;
  switch (c.op) { case 'gt': return v > c.value; case 'gte': return v >= c.value; case 'lt': return v < c.value; case 'lte': return v <= c.value; }
}
export function resolve(route: Route, vars: Variables): string { return typeof route === 'string' ? route : route.cases.find(x => matches(x.when, vars))?.target ?? route.fallback; }
export function applyChoice(vars: Variables, choice: Choice): Variables {
  return applyEffects(vars, choice.effects ?? []);
}
function applyEffects(vars: Variables, effects: NonNullable<StoryNode['onEnterEffects']>): Variables {
  const result = { ...vars };
  for (const effect of effects) { if ('set' in effect) result[effect.variable] = effect.set; else result[effect.variable] = Number(result[effect.variable]) + effect.add; }
  return result;
}
export function enter(story: Story, id: string, vars: Variables): Entry {
  const visited = new Set<string>();
  while (true) {
    if (visited.has(id)) throw new Error(`Цикл условного пропуска: ${id}`);
    visited.add(id);
    const n = story.nodes.find(n => n.id === id);
    if (!n) throw new Error(`Экран «${id}» не найден.`);
    if (!n.when || matches(n.when, vars)) return { nodeId: id, variables: applyEffects(vars,n.onEnterEffects ?? []) };
    if (!n.skipTo) throw new Error(`У экрана ${id} отсутствует skipTo.`);
    id = resolve(n.skipTo, vars);
  }
}
export function fresh(story: Story): Save { return { version: 1, storyId: story.id, entries: [enter(story, story.start, story.variables)], updatedAt: new Date().toISOString() }; }
export function choose(story: Story, save: Save, choiceId: string): Save {
  const entry = save.entries.at(-1)!;
  const node = story.nodes.find(n => n.id === entry.nodeId)!;
  const choice = node.choices?.find(c => c.id === choiceId && (!c.when || matches(c.when, entry.variables)));
  if (!choice || entry.choiceId) return save;
  const variables = applyChoice(entry.variables, choice);
  const entries = [...save.entries.slice(0, -1), { ...entry, variables, choiceId }];
  if (choice.reactionNode) entries.push(enter(story, choice.reactionNode, variables));
  return { ...save, entries, updatedAt: new Date().toISOString() };
}
export function advance(story: Story, save: Save): Save {
  const entry = save.entries.at(-1)!;
  const n = story.nodes.find(n => n.id === entry.nodeId)!;
  const route = n.choices?.length ? n.choices.find(c => c.id === entry.choiceId)?.next : n.next;
  if (!route) return save;
  return { ...save, entries: [...save.entries, enter(story, resolve(route, entry.variables), entry.variables)], updatedAt: new Date().toISOString() };
}
export function back(story: Story, save: Save): Save {
  const entries = save.entries.map(e => ({ ...e, variables: { ...e.variables } }));
  const current = entries.at(-1)!;
  if (current.choiceId) { const before = entries.at(-2)?.variables ?? story.variables; entries[entries.length - 1] = { nodeId: current.nodeId, variables: { ...before } }; }
  else if (entries.length > 1) {
    entries.pop();
    const previous = entries.at(-1)!;
    const previousChoice = story.nodes.find(n => n.id === previous.nodeId)?.choices?.find(c => c.id === previous.choiceId);
    if (previousChoice?.reactionNode === current.nodeId) {
      entries[entries.length - 1] = { nodeId: previous.nodeId, variables: { ...(entries.at(-2)?.variables ?? story.variables) } };
    }
  }
  return { ...save, entries, updatedAt: new Date().toISOString() };
}
export const panels: Record<string, Rect> = { left: { x: .04, y: .24, width: .36, height: .48 }, right: { x: .6, y: .24, width: .36, height: .48 }, bottom: { x: .08, y: .73, width: .84, height: .23 }, center: { x: .27, y: .35, width: .46, height: .3 } };
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
export function position(scene: Scene, requested: Position = 'auto'): string {
  if (requested === 'narrator') return 'bottom';
  const candidates = requested === 'auto' ? [scene.safeArea, 'left', 'right', 'center', 'bottom'] : [requested];
  return candidates.find(p => p && !scene.faces.some(face => overlap(panels[p], face))) ?? 'bottom';
}
export function needsExternalPanel(scene: Scene, requested: Position = 'auto'): boolean {
  return scene.faces.some(face => overlap(panels[position(scene, requested)], face));
}
export function presentedNode(node: StoryNode, vars: Variables): StoryNode {
  const variant=node.variants?.find(v=>matches(v.when,vars));
  if(!variant)return node;
  return {...node,text:variant.text,original:variant.original ?? variant.text,simple:variant.simple ?? node.simple,teacher:node.teacher ? {...node.teacher,...variant.teacher} : undefined};
}
export function nodeText(node: StoryNode, vars: Variables, simple = false) { const n=presentedNode(node,vars);return simple && n.simple ? n.simple : n.original ?? n.text; }
export function parseSave(raw: string | null, story: Story): Save | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Save;
    if (s.version !== 1 || s.storyId !== story.id || !Array.isArray(s.entries) || !s.entries.length || s.entries.length > 10000) return null;
    if (story.saveMigration) {
      const carry: Variables = {};
      s.entries = s.entries.map(e => {
        if (!e || !e.variables || typeof e.nodeId !== 'string') throw new Error('Invalid save entry');
        const nodeId = story.saveMigration!.nodes[e.nodeId] ?? e.nodeId;
        const selected = story.nodes.find(n => n.id === nodeId)?.choices?.find(c => c.id === e.choiceId);
        for (const effect of selected?.effects ?? []) if ('set' in effect && Object.hasOwn(story.saveMigration!.defaults,effect.variable) && !Object.hasOwn(e.variables,effect.variable)) carry[effect.variable] = effect.set;
        return { ...e, nodeId, variables: { ...story.saveMigration!.defaults, ...carry, ...e.variables } };
      });
    }
    for (const e of s.entries) {
      const n = story.nodes.find(n => n.id === e.nodeId);
      if (!n || !e.variables || Object.keys(story.variables).some(k => !Object.hasOwn(e.variables,k) || !compatibleValue(e.variables[k],story.variables[k]))) return null;
      if (e.choiceId && !n.choices?.some(c => c.id === e.choiceId)) return null;
    }
    return s;
  } catch { return null; }
}
