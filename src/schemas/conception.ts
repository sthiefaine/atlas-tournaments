/** Contrat de conception : le texte guide l'auteur ; seules les contraintes structurées pilotent la grille. */
import type { MapDef, Scenario, Case } from './types';
import { Contexte, objet, chaine, entier, enumeration, booleen, conclure, type Resultat } from './noyau';
import { validerMapDef, validerScenario } from './valider';

export const FORMES_TACTIQUES = ['deux_axes', 'avance_directe', 'position_defensive'] as const;
export interface IntentionMission {
  resume: string;
  apprentissage: string;
  forme: typeof FORMES_TACTIQUES[number];
  conserverLittoral: boolean;
  dureeMin: number;
  dureeMax: number;
  variantes: number;
  graine: number;
  casesFixes: Case[];
  interdits: ('brouillard' | 'nuit' | 'iem' | 'renforts')[];
}
export interface DemandeConception {
  version: 1;
  carte: MapDef;
  scenario: Scenario;
  intention: IntentionMission;
  /** Scénarios effectifs après résolution du mode puis des choix : ne pas réappliquer les modes. */
  branches: { nom: string; normal: Scenario; difficile: Scenario }[];
  historique: { empreinte: string; forme: IntentionMission['forme'] }[];
}
export function validerConception(v: unknown): Resultat<DemandeConception> {
  const c = new Contexte();
  const o = objet(c, v, '', ['version', 'carte', 'scenario', 'intention', 'branches', 'historique']);
  if (!o) return { ok: false, erreurs: c.erreurs };
  entier(c, o.version, 'version', { min: 1, max: 1 });
  const carte = validerMapDef(o.carte), scenario = validerScenario(o.scenario);
  for (const [nom, r] of [['carte', carte], ['scenario', scenario]] as const) if (!r.ok) for (const e of r.erreurs) c.faute(`${nom}.${e.chemin}`, e.message);
  const i = objet(c, o.intention, 'intention', ['resume','apprentissage','forme','conserverLittoral','dureeMin','dureeMax','variantes','graine','casesFixes','interdits']);
  if (i) {
    chaine(c, i.resume, 'intention.resume', { max: 1200 });
    chaine(c, i.apprentissage, 'intention.apprentissage', { min: 0, max: 500 });
    enumeration(c, i.forme, 'intention.forme', FORMES_TACTIQUES);
    booleen(c, i.conserverLittoral, 'intention.conserverLittoral');
    entier(c, i.dureeMin, 'intention.dureeMin', { min: 1, max: 100 });
    entier(c, i.dureeMax, 'intention.dureeMax', { min: 1, max: 100 });
    if (Number(i.dureeMin) > Number(i.dureeMax)) c.faute('intention.dureeMax', 'doit être supérieure ou égale au minimum');
    entier(c, i.variantes, 'intention.variantes', { min: 2, max: 4 });
    entier(c, i.graine, 'intention.graine', { min: 0, max: 4294967295 });
    if (!Array.isArray(i.casesFixes) || i.casesFixes.length > 64) c.faute('intention.casesFixes', 'liste de 0 à 64 cases requise');
    else for (const [n, brut] of i.casesFixes.entries()) {
      const p = objet(c, brut, `intention.casesFixes[${n}]`, ['x','y']);
      if (p) {
        entier(c,p.x,`intention.casesFixes[${n}].x`,{min:0,max:carte.ok?carte.valeur.largeur-1:23});
        entier(c,p.y,`intention.casesFixes[${n}].y`,{min:0,max:carte.ok?carte.valeur.hauteur-1:23});
      }
    }
    if (!Array.isArray(i.interdits) || i.interdits.length > 4) c.faute('intention.interdits','liste de 0 à 4 contraintes requise');
    else i.interdits.forEach((x,n)=>enumeration(c,x,`intention.interdits[${n}]`,['brouillard','nuit','iem','renforts'] as const));
  }
  if (carte.ok && (carte.valeur.largeur > 24 || carte.valeur.hauteur > 24 || carte.valeur.unitesDepart.length > 48)) c.faute('carte','laboratoire borné à 24 × 24 cases et 48 unités de départ');
  if (carte.ok && scenario.ok && scenario.valeur.carteCle !== carte.valeur.cle) c.faute('scenario.carteCle','ne désigne pas la carte fournie');
  if (!Array.isArray(o.branches) || o.branches.length > 2) c.faute('branches','liste de 0 à 2 conséquences alternatives requise');
  else for (const [n,b] of o.branches.entries()) {
    const p = objet(c,b,`branches[${n}]`,['nom','normal','difficile']);
    if (!p) continue;
    chaine(c,p.nom,`branches[${n}].nom`,{max:100});
    if(p.nom==='Référence'||o.branches.slice(0,n).some(x=>typeof x==='object'&&x!==null&&(x as {nom?:unknown}).nom===p.nom))c.faute(`branches[${n}].nom`,'nom de branche réservé ou dupliqué');
    for(const mode of ['normal','difficile'] as const){
      const s=validerScenario(p[mode]);
      if (!s.ok) for(const e of s.erreurs)c.faute(`branches[${n}].${mode}.${e.chemin}`,e.message);
      else if (scenario.ok && (s.valeur.code!==scenario.valeur.code || s.valeur.carteCle!==scenario.valeur.carteCle)) c.faute(`branches[${n}].${mode}`,'une conséquence doit concerner la même mission et la même carte');
    }
  }
  if (!Array.isArray(o.historique) || o.historique.length > 24) c.faute('historique','liste de 0 à 24 signatures requise');
  else for(const [n,b] of o.historique.entries()) {
    const p=objet(c,b,`historique[${n}]`,['empreinte','forme']);
    if(p){chaine(c,p.empreinte,`historique[${n}].empreinte`,{max:64});enumeration(c,p.forme,`historique[${n}].forme`,FORMES_TACTIQUES);}
  }
  return conclure(c, structuredClone(v) as DemandeConception);
}
