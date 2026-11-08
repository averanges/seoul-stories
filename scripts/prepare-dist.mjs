import fs from 'node:fs';import path from 'node:path';
const root=path.resolve('dist'),keep=new Set();
for(const c of JSON.parse(fs.readFileSync('public/stories/catalog.json','utf8'))){const dir=path.join(root,'stories',c.path),m=JSON.parse(fs.readFileSync(path.join(dir,'story.json'),'utf8')),scenes=typeof m.scenes==='string'?JSON.parse(fs.readFileSync(path.join(dir,m.scenes),'utf8')):m.scenes;for(const src of [m.cover,...Object.values(scenes).map(s=>s.src)])keep.add(path.resolve(dir,src));}
// Keep the template assets too. Remove only unreferenced legacy images from the build.
const legacy=path.resolve(root,'stories/neoreul_mideo/images');let removed=0;
if(legacy.startsWith(root+path.sep)&&fs.existsSync(legacy))for(const f of fs.readdirSync(legacy,{recursive:true,withFileTypes:true})){if(!f.isFile())continue;const file=path.resolve(f.parentPath??f.path,f.name);if(file.startsWith(legacy+path.sep)&&/\.(jpg|png|webp)$/i.test(file)&&!keep.has(file)){fs.unlinkSync(file);removed++;}}
fs.writeFileSync(path.join(root,'.nojekyll'),'');console.log(`Production: ${removed} unused legacy images excluded; source files retained.`);
const config=JSON.parse(fs.readFileSync('src/music.config.json','utf8')),music=new Set(Object.values(config.tracks).flatMap(t=>Object.values(t.sources)).map(src=>path.resolve(root,src.replace(/^\//,''))));
for(const dir of ['music/warm','music/piano','music/confrontation','ending_c/music']){const f=path.resolve(root,'stories/neoreul_mideo/assets',dir,'full.wav');if(f.startsWith(root+path.sep)&&!music.has(f)&&fs.existsSync(f))fs.unlinkSync(f);}
