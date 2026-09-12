import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { validerMapDef, validerScenario, REGEX_CLE } from '../schemas/index';
import type { DemandeConception } from '../schemas/conception';

/** Seules les deux collections de contenu jouable sont accessibles. */
export async function intentionCanon(code='opus1_tutoriel_05'):Promise<DemandeConception|null>{
  if(!REGEX_CLE.test(code))return null;
  try{
    const s=validerScenario(JSON.parse(await readFile(path.join(process.cwd(),'content/scenarios',`${code}.json`),'utf8')));
    if(!s.ok)return null;
    const c=validerMapDef(JSON.parse(await readFile(path.join(process.cwd(),'content/cartes',`${s.valeur.carteCle}.json`),'utf8')));
    if(!c.ok)return null;
    return {version:1,scenario:s.valeur,carte:c.valeur,branches:[],historique:[],intention:{
      resume:`Composer une nouvelle carte pour « ${s.valeur.nom} » en conservant ses objectifs et son calendrier.`,
      apprentissage:s.valeur.acte===0?'Conserver la leçon du tutoriel ; relire ses dialogues géographiques.':'',
      forme:'deux_axes',conserverLittoral:true,dureeMin:4,dureeMax:s.valeur.limiteJournees??40,
      variantes:2,graine:20260912,casesFixes:[],
      interdits:s.valeur.acte===0&&s.valeur.cycleJourNuit.nuit===0&&!s.valeur.brouillard?['nuit','brouillard']:[],
    }};
  }catch{return null;}
}
export async function scenariosConception():Promise<{code:string;nom:string}[]>{
  const noms=(await readdir(path.join(process.cwd(),'content/scenarios'))).filter(n=>n.endsWith('.json')).sort();
  const tous=await Promise.all(noms.map(n=>intentionCanon(n.slice(0,-5))));
  return tous.filter((d):d is DemandeConception=>d!==null&&d.carte.largeur<=24&&d.carte.hauteur<=24&&d.carte.unitesDepart.length<=48)
    .map(d=>({code:d.scenario.code,nom:d.scenario.nom}));
}
