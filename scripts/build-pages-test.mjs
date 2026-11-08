import {spawnSync} from 'node:child_process';
for(const [file,args] of [['node_modules/typescript/bin/tsc',['-b']],['node_modules/vite/bin/vite.js',['build'] ],['scripts/prepare-dist.mjs',[]]]){const r=spawnSync(process.execPath,[file,...args],{stdio:'inherit',env:{...process.env,PAGES_BASE:'/seoul-stories-test/'}});if(r.status!==0)process.exit(r.status??1);}
