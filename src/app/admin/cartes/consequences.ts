/** Les branches sont calculées par le même code que le jeu, après le mode. */
import { appliquerConsequences, CHOIX_AUBE, VERSION_CANON_AUBE } from '../../campagne/consequences';
import { scenarioPourMode } from '@/content/difficulte';
import type { DemandeConception } from '@/schemas/conception';
export function avecConsequences(d:DemandeConception):DemandeConception{
  const branches:DemandeConception['branches']=[];
  for(const [origine,choix] of Object.entries(CHOIX_AUBE))for(const option of choix){
    const decisions=[{scenario:origine,scenarioVersion:1,canonVersion:VERSION_CANON_AUBE,choix:option.cle}];
    const normal=appliquerConsequences(scenarioPourMode(d.scenario,'normal'),decisions);
    if(!normal.rappels.length)continue;
    const difficile=appliquerConsequences(scenarioPourMode(d.scenario,'difficile'),decisions);
    branches.push({nom:option.titre,normal:normal.scenario,difficile:difficile.scenario});
  }
  // Le budget est explicite : l'atelier n'annonce jamais la couverture de toutes les combinaisons.
  return {...d,branches:branches.slice(0,2)};
}
