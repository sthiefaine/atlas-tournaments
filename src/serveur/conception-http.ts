import { concevoirMission, promptConception, ConceptionInvalide } from './conception';
import { intentionCanon } from './conception-canon';
import { erreur, json } from './reponses';
import { validerConception } from '../schemas/conception';

/** Budget partagé par processus ; une simulation cède la main entre chaque tour et accepte l'annulation. */
let occupe=false;
export async function contexteConception(requete:Request):Promise<Response>{
  const d=await intentionCanon(new URL(requete.url).searchParams.get('scenario')??undefined);
  return d?json({version:1,demande:d,prompt:promptConception(d),bornes:{variantes:4,branches:2,parties:32,dureeMs:45000}}):erreur('scenario_inconnu',404);
}
export async function soumettreConception(requete:Request):Promise<Response>{
  if(occupe)return erreur('conception_occupee',429,'Une conception est déjà en cours sur ce serveur.');
  if(!requete.headers.get('content-type')?.includes('application/json'))return erreur('content_type_invalide',415);
  const lecteur=requete.body?.getReader();if(!lecteur)return erreur('json_invalide',400);
  let taille=0;const morceaux:Uint8Array[]=[];
  while(true){const r=await lecteur.read();if(r.done)break;taille+=r.value.length;if(taille>262144){await lecteur.cancel();return erreur('charge_trop_grande',413);}morceaux.push(r.value);}
  let brut:unknown;
  try{brut=JSON.parse(Buffer.concat(morceaux).toString('utf8'));}catch{return erreur('json_invalide',400);}
  const v=validerConception(brut);if(!v.ok)return erreur('schema_invalide',422,'Contrat de conception refusé.',v.erreurs.map(e=>`${e.chemin} : ${e.message}`));
  // La lecture du corps a cédé la main : une autre requête a pu acquérir le poste entre-temps.
  if(occupe)return erreur('conception_occupee',429);
  occupe=true;
  try{return json(await concevoirMission(v.valeur,{signal:requete.signal}));}
  catch(e){if(e instanceof ConceptionInvalide)return erreur('conception_invalide',422,e.message);throw e;}
  finally{occupe=false;}
}
