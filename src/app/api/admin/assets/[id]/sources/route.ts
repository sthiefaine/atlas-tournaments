import { origineAutorisee } from '@/serveur/origine';
import { genererSpecs } from '@/assets/index';
import { exigerAdmin } from '@/serveur/auth';
import { erreur, json } from '@/serveur/reponses';
import { LIMITE_SOURCE, REVISION_SOURCE } from '@/serveur/sources-assets';
import { stockageSourcesDisponible, sourcesStockees, deposerSourceStockee, telechargerSourceStockee } from '@/serveur/sources-assets-stockage';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Contexte = { params: Promise<{id:string}> };
async function contexte(req:Request, ctx:Contexte) {
  const refus = exigerAdmin(req); if(refus) return refus;
  const {id} = await ctx.params;
  if(!genererSpecs().some(s=>s.id===id)) return erreur('asset_inconnu',404);
  const dossier = stockageSourcesDisponible();
  if(!dossier) return erreur('stockage_non_configure',503,'Configurer ATLAS_ASSET_SOURCES_DIR sur un volume persistant du serveur.');
  return {id,dossier};
}
export async function GET(req:Request, ctx:Contexte) {
  const c = await contexte(req,ctx); if(c instanceof Response) return c;
  const revision = new URL(req.url).searchParams.get('revision');
  try {
    if(!revision) return json({sources:await sourcesStockees(c.id)});
    if(!REVISION_SOURCE.test(revision)) return erreur('revision_invalide',400);
    const octets = await telechargerSourceStockee(c.id,revision);
    return new Response(new Uint8Array(octets),{headers:{'Content-Type':'model/gltf-binary','Content-Disposition':`attachment; filename="${c.id}_source_${revision.slice(0,12)}.glb"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  } catch(e) { return erreur('source_indisponible',(e as NodeJS.ErrnoException).code==='ENOENT'?404:500); }
}
export async function POST(req:Request, ctx:Contexte) {
  const c = await contexte(req,ctx); if(c instanceof Response) return c;
  if(!origineAutorisee(req)) return erreur('origine_refusee',403, 'Adresse du site refusée. Vérifiez SITE_URL sur le serveur Atlas.');
  if(!['model/gltf-binary','application/octet-stream'].includes(req.headers.get('content-type')??'')) return erreur('type_invalide',415,'Envoyer le GLB brut.');
  if(Number(req.headers.get('content-length'))>LIMITE_SOURCE) return erreur('source_trop_lourde',413,'150 Mio maximum');
  const reader=req.body?.getReader(); if(!reader) return erreur('fichier_absent',400);
  const morceaux:Uint8Array[]=[];let taille=0;
  try {
    while(true) { const {value,done}=await reader.read(); if(done)break; taille+=value.length;
      if(taille>LIMITE_SOURCE){await reader.cancel();return erreur('source_trop_lourde',413,'150 Mio maximum');} morceaux.push(value); }
    const source=await deposerSourceStockee(c.id,Buffer.concat(morceaux,taille));
    return json({source},201);
  } catch(e) {
    if((e as NodeJS.ErrnoException).code) return erreur('stockage_indisponible',500,'Écriture impossible dans le stockage des sources.');
    return erreur('source_invalide',422,e instanceof Error?e.message:'GLB illisible');
  }
}
