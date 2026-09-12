import { origineAutorisee } from '@/serveur/origine';
import { avecConsequences } from '../../../admin/cartes/consequences';
import { promptConception } from '@/serveur/conception';
import { json } from '@/serveur/reponses';
import { exigerAdmin } from '@/serveur/auth';
import { contexteConception, soumettreConception } from '@/serveur/conception-http';
import { erreur } from '@/serveur/reponses';
import { traduireErreur } from '@/serveur/routes';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(r:Request){const refus=exigerAdmin(r);if(refus)return refus;const reponse=await contexteConception(r);if(!reponse.ok)return reponse;const contenu=await reponse.json();contenu.demande=avecConsequences(contenu.demande);contenu.prompt=promptConception(contenu.demande);return json(contenu);}
export async function POST(r:Request){
  const refus=exigerAdmin(r);if(refus)return refus;
  if(!origineAutorisee(r))return erreur('origine_refusee',403);
  try{return await soumettreConception(r);}catch(e){return traduireErreur(e);}
}
