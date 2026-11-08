import type { Story } from './types';
import { compatibleValue, isValue } from './values';
export type Issue = { severity: 'error' | 'warning'; message: string };
export function validateStory(input: unknown): Issue[] {
  const issues: Issue[] = [];
  const error = (message: string) => issues.push({ severity: 'error', message });
  const warning = (message: string) => issues.push({ severity: 'warning', message });
  // Validate untrusted JSON before the player reads any property.
  const obj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!obj(input)) return [{ severity: 'error', message: 'История должна быть JSON-объектом.' }];
  for (const key of ['id','title','subtitle','description','level','duration','cover','start']) if (typeof input[key] !== 'string' || !input[key].trim()) error(`Поле ${key}: нужна непустая строка.`);
  if (input.version !== 1) error('Поддерживается только version: 1.');
  if (!obj(input.variables) || Object.values(input.variables).some(v => !isValue(v))) error('variables: допустимы числа, строки, булевы значения и null.');
  if (input.studentLanguage !== undefined && input.studentLanguage !== 'ko') error('studentLanguage: поддерживается ko.');
  if (!obj(input.characters)) error('characters: нужен объект персонажей.');
  else for (const [id, c] of Object.entries(input.characters)) if (!obj(c) || ['name','role','color'].some(k => typeof c[k] !== 'string')) error(`Персонаж ${id}: нужны name, role, color.`);
  if (!obj(input.scenes) || !Object.keys(input.scenes).length) error('scenes: нужны иллюстрации.');
  if (!Array.isArray(input.nodes) || !input.nodes.length) error('nodes: нужен непустой массив экранов.');
  if (issues.length) return issues;
  const s = input as unknown as Story;
  if (s.saveMigration !== undefined && (!obj(s.saveMigration) || !obj(s.saveMigration.nodes) || !obj(s.saveMigration.defaults) || Object.values(s.saveMigration.nodes).some(v => typeof v !== 'string') || Object.entries(s.saveMigration.defaults).some(([k,v]) => !Object.hasOwn(s.variables,k) || !compatibleValue(v,s.variables[k])))) error('saveMigration: неверные правила переноса сохранений.');
  const positions = ['auto','left','right','bottom','center','narrator'];
  const unit = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
  const localPath = (p: unknown) => typeof p === 'string' && p.length > 0 && !p.startsWith('/') && !p.includes('..') && !p.includes(':') && !p.includes('\\');
  if (!localPath(s.cover)) error('cover: нужен относительный путь внутри папки истории.');
  for (const [id, scene] of Object.entries(s.scenes)) {
    if (!obj(scene)) { error(`Сцена ${id}: нужен объект.`); continue; }
    if (!localPath(scene.src)) error(`Сцена ${id}: некорректный путь изображения.`);
    if (!obj(scene.focus) || !unit(scene.focus.x) || !unit(scene.focus.y)) error(`Сцена ${id}: focus должен содержать x/y от 0 до 1.`);
    if (!Array.isArray(scene.faces) || scene.faces.some(r => !obj(r) || !(['x','y','width','height'] as const).every(k => unit(r[k])) || r.x + r.width > 1 || r.y + r.height > 1)) error(`Сцена ${id}: неверные прямоугольники faces.`);
    if (!Array.isArray(scene.characters) || scene.characters.some(c => !obj(c) || !s.characters[c.id] || !unit(c.x) || !unit(c.y))) error(`Сцена ${id}: неверные позиции characters.`);
    if (scene.safeArea && !['left','right','bottom','center'].includes(scene.safeArea)) error(`Сцена ${id}: неизвестная safeArea.`);
    if (scene.fit !== undefined && !['contain','cover'].includes(scene.fit)) error(`Сцена ${id}: неизвестный fit.`);
    if (scene.transition !== undefined && scene.transition !== 'cut') error(`Сцена ${id}: неизвестный переход изображения.`);
    if (scene.temporary !== undefined && typeof scene.temporary !== 'boolean') error(`Сцена ${id}: temporary должен быть булевым.`);
    if (scene.frame !== undefined && (!obj(scene.frame) || !unit(scene.frame.top) || !unit(scene.frame.bottom) || scene.frame.top + scene.frame.bottom >= .9 || typeof scene.frame.aspect !== 'number' || !Number.isFinite(scene.frame.aspect) || scene.frame.aspect <= 0)) error(`Сцена ${id}: неверное окно frame.`);
    for (const k of ['title','teacherTitle'] as const) if (scene[k] !== undefined && typeof scene[k] !== 'string') error(`Сцена ${id}: ${k} должен быть строкой.`);
  }
  const ids = new Set<string>();
  for (const n of s.nodes) { if (!obj(n) || typeof n.id !== 'string' || !n.id) { error('У каждого экрана должен быть id.'); continue; } if (ids.has(n.id)) error(`Повторный id экрана: ${n.id}.`); ids.add(n.id); }
  if (!ids.has(s.start)) error(`Стартовый экран ${s.start} не существует.`);
  function condition(c: any, context: string): boolean {
    if (!obj(c)) { error(`${context}: условие должно быть объектом.`); return false; }
    const keys = Object.keys(c);
    if ('all' in c || 'any' in c) { const key = 'all' in c ? 'all' : 'any'; if (keys.length !== 1 || !Array.isArray(c[key]) || !c[key].length) { error(`${context}: ${key} должен быть непустым массивом.`); return false; } return c[key].map((x: unknown) => condition(x, context)).every(Boolean); }
    if ('not' in c) { if (keys.length !== 1) error(`${context}: лишние поля в not.`); return condition(c.not, context); }
    if (keys.some(k => !['variable','op','value'].includes(k)) || !Object.hasOwn(s.variables,c.variable) || !['eq','ne','gt','gte','lt','lte'].includes(c.op) || !compatibleValue(c.value,s.variables[c.variable]) || (!['eq','ne'].includes(c.op) && (typeof c.value !== 'number' || typeof s.variables[c.variable] !== 'number'))) { error(`${context}: неверная переменная, оператор или тип значения условия.`); return false; }
    return true;
  }
  const edges = new Map<string, string[]>();
  function route(r: any, ctx: string): string[] {
    const targets: string[] = [];
    if (typeof r === 'string') targets.push(r);
    else if (obj(r) && Array.isArray(r.cases) && typeof r.fallback === 'string') { for (const c of r.cases) { if (!obj(c) || typeof c.target !== 'string') error(`${ctx}: неверная ветка перехода.`); else { condition(c.when, ctx); targets.push(c.target); } } targets.push(r.fallback); }
    else { error(`${ctx}: неверный переход.`); }
    for (const t of targets) if (!ids.has(t)) error(`${ctx}: целевой экран «${t}» не существует.`);
    return targets;
  }
  for (const n of s.nodes) {
    if (!obj(n) || !ids.has(n.id)) continue;
    const ctx = `Экран ${n.id}`; const out: string[] = [];
    if (!s.scenes[n.scene]) error(`${ctx}: сцена ${n.scene} не существует.`);
    if (n.visual !== undefined && (typeof n.visual !== 'string' || !s.scenes[n.visual])) error(`${ctx}: visual ссылается на неизвестный кадр.`);
    if (typeof n.text !== 'string') error(`${ctx}: отсутствует text.`);
    for (const k of ['original','simple'] as const) if (n[k] !== undefined && (typeof n[k] !== 'string' || !n[k])) error(`${ctx}: ${k} должен быть непустой строкой.`);
    if (n.original !== undefined && n.text !== n.original) error(`${ctx}: text должен совпадать с original.`);
    if (n.textDelayMs !== undefined && (typeof n.textDelayMs !== 'number' || !Number.isFinite(n.textDelayMs) || n.textDelayMs < 0 || n.textDelayMs > 3000)) error(`${ctx}: textDelayMs должен быть числом от 0 до 3000.`);
    if (n.transitionAfter !== undefined && (!obj(n.transitionAfter) || ['original','simple','ru'].some(k=>typeof n.transitionAfter![k as 'original'|'simple'|'ru']!=='string' || !n.transitionAfter![k as 'original'|'simple'|'ru']) || !Number.isFinite(n.transitionAfter.durationMs) || n.transitionAfter.durationMs<500 || n.transitionAfter.durationMs>3000 || !n.next || !!n.ending || !!n.choices)) error(ctx+': неверный временной титр.');
    if (n.onEnterEffects !== undefined) {
      if (!Array.isArray(n.onEnterEffects)) error(`${ctx}: onEnterEffects должен быть массивом.`);
      else for (const e of n.onEnterEffects) if (!obj(e) || !Object.hasOwn(s.variables,e.variable) || (('set' in e) === ('add' in e)) || ('set' in e ? !compatibleValue(e.set,s.variables[e.variable]) : typeof e.add !== 'number' || !Number.isFinite(e.add) || typeof s.variables[e.variable] !== 'number')) error(`${ctx}: неверный эффект входа.`);
    }
    if (n.choiceLanguage !== undefined && n.choiceLanguage !== 'ru') error(`${ctx}: неизвестный язык действий.`);
    for (const k of ['grammar','vocab'] as const) if (n.teacher?.[k] !== undefined && (!Array.isArray(n.teacher[k]) || n.teacher[k]!.some(v => typeof v !== 'string'))) error(`${ctx}: неверное поле teacher.${k}.`);
    if (n.speaker && !s.characters[n.speaker]) error(`${ctx}: неизвестный персонаж.`);
    if (n.position && !positions.includes(n.position)) error(`${ctx}: неизвестное положение текста.`);
    if (n.teacher !== undefined && (!obj(n.teacher) || typeof n.teacher.translation !== 'string' || ['note','direction'].some(k => n.teacher![k as 'note' | 'direction'] !== undefined && typeof n.teacher![k as 'note' | 'direction'] !== 'string'))) error(`${ctx}: неверные материалы преподавателя.`);
    if (n.when) { condition(n.when, ctx); if (!n.skipTo) error(`${ctx}: для when нужен skipTo.`); }
    if (n.skipTo) out.push(...route(n.skipTo, ctx));
    if (n.variants !== undefined) { if (!Array.isArray(n.variants)) error(`${ctx}: variants должен быть массивом.`); else for (const v of n.variants) { if (!obj(v) || typeof v.text !== 'string') error(`${ctx}: некорректная условная реплика.`); else { condition(v.when, ctx); for(const k of ['original','simple'] as const) if(v[k] !== undefined && typeof v[k] !== 'string') error(`${ctx}: неверная версия условной реплики.`);if(v.teacher !== undefined && (!obj(v.teacher) || ['translation','note','direction'].some(k=>v.teacher![k as 'translation'|'note'|'direction']!==undefined && typeof v.teacher![k as 'translation'|'note'|'direction']!=='string')))error(`${ctx}: неверный перевод условной реплики.`); } } }
    if (n.ending && (!obj(n.ending) || typeof n.ending.title !== 'string' || typeof n.ending.description !== 'string')) error(`${ctx}: ending требует title и description.`);
    if (n.ending && (n.next || n.choices)) error(`${ctx}: у концовки не должно быть переходов.`);
    if (n.ending?.kind !== undefined && n.ending.kind !== 'continuation') error(`${ctx}: неизвестный вид завершения демо.`);
    if (n.ending?.descriptionKo !== undefined && typeof n.ending.descriptionKo !== 'string') error(`${ctx}: descriptionKo должен быть строкой.`);
    if (n.next) out.push(...route(n.next, ctx));
    if (n.choices !== undefined) {
      if (!Array.isArray(n.choices) || n.choices.length < 2 || n.choices.length > 4) error(`${ctx}: требуется 2–4 варианта ответа.`);
      else { const seen = new Set<string>(); for (const c of n.choices) {
        if (!obj(c) || (['id','label','task','answer','reaction'] as const).some(k => typeof c[k] !== 'string' || !c[k])) { error(`${ctx}: неполный вариант ответа.`); continue; }
        if (seen.has(c.id)) error(`${ctx}: повторный id выбора.`); seen.add(c.id);
        if (c.speaker && !s.characters[c.speaker]) error(`${ctx}: неизвестный speaker реакции.`);
        if (c.labelKo !== undefined && typeof c.labelKo !== 'string') error(`${ctx}: labelKo должен быть строкой.`);
        if (s.studentLanguage === 'ko' && n.choiceLanguage !== 'ru' && !c.labelKo) error(`${ctx}: для корейского режима нужен labelKo.`);
        if (c.answerSimple !== undefined && typeof c.answerSimple !== 'string') error(`${ctx}: answerSimple должен быть строкой.`);
        if (c.reactionNode !== undefined && (typeof c.reactionNode !== 'string' || !ids.has(c.reactionNode) || c.next !== c.reactionNode)) error(`${ctx}: reactionNode должен совпадать с next и ссылаться на экран реакции.`);
        if (c.when) condition(c.when, ctx);
        out.push(...route(c.next, ctx));
        if (c.effects !== undefined && !Array.isArray(c.effects)) error(`${ctx}: effects должен быть массивом.`);
        else for (const e of c.effects ?? []) if (!obj(e) || !Object.hasOwn(s.variables,e.variable) || (('set' in e) === ('add' in e)) || ('set' in e ? !compatibleValue(e.set,s.variables[e.variable]) : typeof e.add !== 'number' || !Number.isFinite(e.add) || typeof s.variables[e.variable] !== 'number')) error(`${ctx}: некорректное изменение переменной.`);
      } }
      if (n.next) error(`${ctx}: задайте choices или next, а не оба сразу.`);
    }
    if (!n.ending && !n.next && !n.choices) error(`${ctx}: незавершённая ветка — нет перехода или концовки.`);
    edges.set(n.id, out);
  }
  const reached = new Set<string>(); const queue = [s.start];
  while (queue.length) { const id = queue.pop()!; if (reached.has(id)) continue; reached.add(id); queue.push(...(edges.get(id) ?? [])); }
  for (const id of ids) if (!reached.has(id)) warning(`Экран ${id} недостижим по графу переходов.`);
  const canEnd = new Set(s.nodes.filter(n => n?.ending).map(n => n.id));
  let changed = true; while (changed) { changed = false; for (const [id, targets] of edges) if (!canEnd.has(id) && targets.some(t => canEnd.has(t))) { canEnd.add(id); changed = true; } }
  for (const id of reached) if (ids.has(id) && !canEnd.has(id)) warning(`Из экрана ${id} нет пути к концовке.`);
  return issues;
}


