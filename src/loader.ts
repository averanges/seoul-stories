import { validateStory } from './validate';
import type { Story } from './types';
const base = `${import.meta.env.BASE_URL}stories/`;
export type CatalogItem = { id: string; title: string; subtitle: string; description: string; level: string; duration: string; cover: string; path: string };
async function json(url: string) { const r = await fetch(url); if (!r.ok) throw new Error(`Не удалось загрузить ${url} (${r.status}).`); try { return await r.json(); } catch { throw new Error(`Некорректный JSON: ${url}`); } }
export const asset = (path: string, src: string) => `${base}${path}${src}`;
export async function catalog(): Promise<CatalogItem[]> {
  const data = await json(`${base}catalog.json`);
  if (!Array.isArray(data) || data.some(i => !i || ['id','title','subtitle','description','level','duration','cover','path'].some(k => typeof i[k] !== 'string') || !/^[a-zA-Z0-9_-]+\/$/.test(i.path))) throw new Error('Неверный stories/catalog.json: проверьте записи и относительные пути папок.');
  return data;
}
export async function loadStory(item: CatalogItem): Promise<{ story: Story; warnings: string[] }> {
  const data = await json(asset(item.path, 'story.json'));
  if (!data || typeof data !== 'object') throw new Error('story.json должен быть объектом.');
  await Promise.all(['characters','scenes','nodes'].map(async key => {
    if (typeof data[key] === 'string') {
      if (!/^[\w-]+\.json$/.test(data[key])) throw new Error(`Неверный путь ${key}: используйте JSON-файл внутри папки истории.`);
      data[key] = await json(asset(item.path, data[key]));
    }
  }));
  const issues = validateStory(data);
  if (data.id !== item.id) issues.push({severity:'error',message:'id в каталоге и истории должны совпадать.'});
  if (issues.some(i => i.severity === 'error')) throw new Error(issues.map(i => i.message).join('\n'));
  const story = data as Story;
  return { story, warnings: issues.map(i => i.message) };
}
