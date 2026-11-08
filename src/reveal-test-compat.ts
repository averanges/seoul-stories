import fs from 'node:fs';
const updates=JSON.parse(fs.readFileSync('docs/sora-reveal-production/EXISTING_NODE_UPDATES.json','utf8'));
export const revealR01=JSON.parse(fs.readFileSync('docs/sora-reveal-production/data/reveal_addon.json','utf8')).common_dialogue[0];
export function isRevealNode(id:string){return /^(SC04A_REVEAL_|SC04B_REVEAL_|SC06_SORA_CONFRONT_|SC06_D)/.test(id)||id.startsWith('ENDING_C_');}
export function applyRevealBaseline(nodes:any[]){for(const update of updates){const index=nodes.findIndex(n=>n.id===update.id);if(index>=0)nodes[index]=structuredClone(update);}}
