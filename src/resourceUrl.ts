/** Vite base also applies to JSON-configured media, not only bundled imports. */
export function resourceUrl(path:string,base=import.meta.env?.BASE_URL??'./'){
 return `${base.endsWith('/')?base:base+'/'}${path.replace(/^\/+/, '')}`;
}
