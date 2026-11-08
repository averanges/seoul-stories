import fs from 'node:fs';
import path from 'node:path';
import { validateStory } from '../src/validate';
const root = path.resolve('public/stories');
let failed = false;
for (const folder of fs.readdirSync(root, {withFileTypes:true}).filter(f=>f.isDirectory())) {
  try {
    const directory = path.join(root,folder.name);
    const story = JSON.parse(fs.readFileSync(path.join(directory,'story.json'),'utf8'));
    for (const key of ['characters','nodes','scenes']) if (typeof story[key] === 'string') {
      if (!/^[\w-]+\.json$/.test(story[key])) throw new Error(`Недопустимый путь ${key}`);
      story[key] = JSON.parse(fs.readFileSync(path.join(directory,story[key]),'utf8'));
    }
    const issues = validateStory(story);
    if (!issues.some(i=>i.severity==='error')) {
      const sources = new Set<string>([story.cover,...Object.values(story.scenes as Record<string,{src:string}>).map(s=>s.src)]);
      for (const src of sources) if (!fs.existsSync(path.join(directory,src))) issues.push({severity:'error',message:`Отсутствует изображение: ${src}`});
    }
    for (const issue of issues) { console.log(`[${folder.name}] ${issue.severity}: ${issue.message}`); if(issue.severity==='error') failed=true; }
    if (!issues.length) console.log(`[${folder.name}] OK`);
  } catch(e) { failed = true; console.error(`[${folder.name}] ${e instanceof Error ? e.message : e}`); }
}
process.exitCode = failed ? 1 : 0;
