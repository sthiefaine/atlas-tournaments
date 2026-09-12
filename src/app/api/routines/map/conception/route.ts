import { avecConsequences } from '../../../../admin/cartes/consequences';
import { promptConception } from '@/serveur/conception';
import { json } from '@/serveur/reponses';
import { exigerRoutine } from '@/serveur/auth';
import { contexteConception, soumettreConception } from '@/serveur/conception-http';
import { traduireErreur } from '@/serveur/routes';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
/** Laboratoire sans publication ni réservation : fonctionne sans PostgreSQL. */
export async function GET(r:Request){const refus=exigerRoutine(r);if(refus)return refus;const reponse=await contexteConception(r);if(!reponse.ok)return reponse;const contenu=await reponse.json();contenu.demande=avecConsequences(contenu.demande);contenu.prompt=promptConception(contenu.demande);return json(contenu);}
export async function POST(r:Request){const refus=exigerRoutine(r);if(refus)return refus;try{return await soumettreConception(r);}catch(e){return traduireErreur(e);}}
