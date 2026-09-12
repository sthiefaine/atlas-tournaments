import { readFile } from 'node:fs/promises';
import { cheminSource, dossierSources, enregistrerSource, listerSources } from './sources-assets';
export interface SourceAsset {revision:string;octets:number;date?:string}
function distant(){
  const url=process.env.ATLAS_UPLOAD_URL,token=process.env.ATLAS_UPLOAD_TOKEN;
  if(!url||!token)return null;
  const u=new URL(url);
  if(u.protocol!=='https:' && !(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw new Error('Le stockage distant doit utiliser HTTPS');
  return {url:u.origin,token};
}
export function stockageSourcesDisponible(){return !!distant()||!!dossierSources();}
async function requete(id:string,revision?:string,octets?:Uint8Array){
  const c=distant();if(!c)throw new Error('Stockage distant absent');
  const url=new URL(`/api/atlas-assets/${encodeURIComponent(id)}/sources`,c.url);
  if(revision)url.searchParams.set('revision',revision);
  const r=await fetch(url,{method:octets?'POST':'GET',headers:{Authorization:`Bearer ${c.token}`,...(octets?{'Content-Type':'model/gltf-binary'}:{})},body:octets?new Uint8Array(octets):undefined,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(180000)});
  if(!r.ok)throw new Error(`Stockage next-upload indisponible (${r.status}). Vérifiez le déploiement, le jeton et le volume persistant.`);
  return r;
}
export async function sourcesStockees(id:string):Promise<SourceAsset[]>{
  if(distant())return (await (await requete(id)).json()).sources;
  const d=dossierSources();return d?listerSources(d,id):[];
}
export async function deposerSourceStockee(id:string,octets:Uint8Array){
  if(distant())return (await (await requete(id,undefined,octets)).json()).source as SourceAsset;
  const d=dossierSources();if(!d)throw new Error('Stockage non configuré');
  return enregistrerSource(d,id,octets);
}
export async function telechargerSourceStockee(id:string,revision:string){
  if(distant())return new Uint8Array(await (await requete(id,revision)).arrayBuffer());
  const d=dossierSources();if(!d)throw new Error('Stockage non configuré');
  return new Uint8Array(await readFile(cheminSource(d,id,revision)));
}
