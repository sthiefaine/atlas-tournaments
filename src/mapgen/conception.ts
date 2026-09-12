/** Composition tactique autour des ancrages du scénario. Aucune règle narrative n'est déduite d'une phrase. */
import type { Case, MapDef, Scenario } from '../schemas/types';
import { CARACTERES_CAPTURABLES } from '../schemas/types';
import type { DemandeConception } from '../schemas/conception';
import { scenarioPourMode } from '../content/difficulte';
import { chargerTerrains } from '../content/index';
import { genererCarte } from './generer';
import { PROFILS_BIOME } from './parametres';
import { hacher } from './rng';

const TERRAINS = new Map(chargerTerrains().map(t => [t.car,t]));
const k = (p: Case) => `${p.x},${p.y}`;
export function positions(v: unknown): Case[] {
  if (!v || typeof v !== 'object') return [];
  if (Array.isArray(v)) return v.flatMap(positions);
  const o=v as Record<string,unknown>;
  const ici=Number.isInteger(o.x)&&Number.isInteger(o.y)?[{x:o.x as number,y:o.y as number}]:[];
  return [...ici,...Object.values(o).flatMap(positions)];
}
export function ancrages(d: DemandeConception): Case[] {
  const toutes=[...(['normal','difficile'] as const).flatMap(mode=>positions(scenarioPourMode(d.scenario,mode))),...d.branches.flatMap(b=>[...positions(b.normal),...positions(b.difficile)]),...d.carte.unitesDepart,...(d.carte.desaffectes??[]),...d.intention.casesFixes];
  d.carte.grille.forEach((ligne,y)=>[...ligne].forEach((car,x)=>{if(CARACTERES_CAPTURABLES.includes(car))toutes.push({x,y});}));
  return [...new Map(toutes.map(p=>[k(p),{x:p.x,y:p.y}])).values()];
}
/** Chemin de coût minimal, quatre voisins ; la grille fixe ne peut jamais être percée. */
export function chemin(grille: string[][], debut: Case, fin: Case, fixes: Set<string>, percer: boolean): Case[] {
  const largeur=grille[0]!.length, hauteur=grille.length;
  const cout=new Map<string,number>([[k(debut),0]]), precedent=new Map<string,Case>(), ouvert=[debut];
  while(ouvert.length){
    ouvert.sort((a,b)=>cout.get(k(a))!-cout.get(k(b))!||a.y-b.y||a.x-b.x);
    const p=ouvert.shift()!;
    if(k(p)===k(fin)){
      const route=[p];let q=p;
      while(precedent.has(k(q))){q=precedent.get(k(q))!;route.push(q);}return route.reverse();
    }
    for(const q of [{x:p.x,y:p.y-1},{x:p.x-1,y:p.y},{x:p.x+1,y:p.y},{x:p.x,y:p.y+1}]){
      if(q.x<0||q.y<0||q.x>=largeur||q.y>=hauteur)continue;
      const car=grille[q.y]![q.x]!, terrain=TERRAINS.get(car);
      const pas=terrain?.couts.pied;
      if(pas===undefined&&(!percer||fixes.has(k(q))||'WV'.includes(car)))continue;
      const poids=pas===undefined?6:car==='M'?4:car==='R'?1:2;
      const n=cout.get(k(p))!+poids;
      if(n>=(cout.get(k(q))??Infinity))continue;
      cout.set(k(q),n);precedent.set(k(q),p);
      if(!ouvert.some(a=>k(a)===k(q)))ouvert.push(q);
    }
  }
  return [];
}
export interface PlanCarte {
  carte: MapDef;
  axes: { nom:string; cases:Case[] }[];
  fixes: Case[];
  explications: string[];
  empreinte: string;
}
export function composerCarte(d: DemandeConception, rang: number): PlanCarte {
  const source=d.carte, i=d.intention, profil=PROFILS_BIOME[source.biome];
  const graine=(i.graine+Math.imul(rang+1,2654435761))>>>0;
  const bruit=genererCarte({largeur:source.largeur,hauteur:source.hauteur,camps:source.camps,biome:source.biome,
    ratioMer:i.conserverLittoral?0:profil.ratioMer,ratioRelief:profil.ratioRelief,
    villesParCamp:1,villesNeutres:0,usinesParCamp:1,aeroportsParCamp:0,symetrie:'aucune',densiteRoutes:0.2},graine);
  const fixes=ancrages(d), bloquees=new Set(fixes.map(k));
  const grille=source.grille.map((ligne,y)=>[...ligne].map((car,x)=>{
    // Les ponts et la navigation portent souvent une mission ; on ne les coupe jamais par du relief.
    if(!'PFMGR'.includes(car)||bloquees.has(`${x},${y}`))return car;
    const nouveau=bruit.grille[y]![x]!;
    return 'PFMG'.includes(nouveau)?nouveau:'P';
  }));
  source.grille.forEach((ligne,y)=>[...ligne].forEach((car,x)=>{
    if(!'PFMGR'.includes(car))bloquees.add(`${x},${y}`);
  }));
  const qgs=fixes.filter(p=>source.grille[p.y]?.[p.x]==='H');
  const depart=qgs.find(p=>source.proprietaires[k(p)]===0)??source.unitesDepart.find(u=>u.camp===0);
  const allies=d.scenario.equipes?.find(e=>e.includes(0))??[0];
  const cible=qgs.find(p=>!allies.includes(source.proprietaires[k(p)]!))??fixes.find(p=>depart&&k(p)!==k(depart));
  const axes:PlanCarte['axes']=[];
  function tracer(nom:string,etapes:Case[],couvert=false){
    let cases:Case[]=[];
    for(let n=1;n<etapes.length;n++){
      const section=chemin(grille,etapes[n-1]!,etapes[n]!,bloquees,true);
      if(!section.length)return;
      cases.push(...section.slice(n===1?0:1));
    }
    cases=[...new Map(cases.map(p=>[k(p),p])).values()];
    for(const p of cases){if(!bloquees.has(k(p)))grille[p.y]![p.x]=couvert?'P':'R';}
    if(couvert)for(const p of cases)for(const dx of [-1,1]){
      const x=p.x+dx;if(x>=0&&x<source.largeur&&!bloquees.has(`${x},${p.y}`)&&grille[p.y]![x]==='P'&&!cases.some(q=>q.x===x&&q.y===p.y))grille[p.y]![x]='F';
    }
    axes.push({nom,cases});
  }
  if(depart&&cible){
    tracer('Axe direct',[depart,cible]);
    if(i.forme!=='avance_directe'){
      const passage={x:rang%2?source.largeur-2:1,y:Math.floor(source.hauteur/2)};
      tracer(i.forme==='deux_axes'?'Détour avec couverts':'Accès de réserve',[depart,passage,cible],true);
    }
    // Chaque objectif terrestre garde un accès ; les objectifs navals restent au contrôle des simulations.
    for(const p of fixes)if(TERRAINS.get(source.grille[p.y]?.[p.x]??'')?.couts.pied!==undefined)
      if(!chemin(grille,depart,p,bloquees,false).length)tracer('Accès restauré',[depart,p]);
    if(i.forme==='position_defensive')for(const p of [{x:depart.x+1,y:depart.y},{x:depart.x-1,y:depart.y},{x:depart.x,y:depart.y-1},{x:depart.x,y:depart.y+1}])
      if(grille[p.y]?.[p.x]==='P'&&!bloquees.has(k(p)))grille[p.y]![p.x]='F';
  }
  const code=`conception_${hacher(`${source.code}:${graine}`).toString(16)}`;
  const carte:MapDef={...structuredClone(source),cle:code,code,nom:`${source.nom} · variante ${rang+1}`,version:1,statut:'brouillon',source:'atlas_map',grille:grille.map(l=>l.join(''))};
  // Cette composition a son propre manifeste ; elle n'est pas une sortie brute de genererCarte.
  delete carte.generation;delete carte.diagnostic;
  return {carte,axes,fixes,empreinte:hacher(carte.grille.join('\n')).toString(16),explications:[
    `${fixes.length} ancrages conservés ; économie, effectifs et événements repris du scénario.`,
    i.forme==='avance_directe'?'Un axe rapide traverse le relief.':i.forme==='deux_axes'?'Un axe rapide et un détour bordé de couverts sont recherchés.':'Un accès de réserve et des couverts proches du QG soutiennent la défense.',
    'Le littoral, les rivières, les ponts et les bâtiments de la carte source restent intacts.',
  ]};
}
/** Correction bornée : élargir les voies déjà tracées, sans toucher aux ancrages ni au littoral. */
export function ouvrirAxes(plan: PlanCarte): PlanCarte {
  const p=structuredClone(plan),fixes=new Set(p.fixes.map(k));
  const grille=p.carte.grille.map(l=>[...l]);
  for(const axe of p.axes)for(const c of axe.cases)for(const dx of [-1,1]){
    const x=c.x+dx;if(x<0||x>=p.carte.largeur||fixes.has(`${x},${c.y}`))continue;
    if('MFG'.includes(grille[c.y]![x]!))grille[c.y]![x]='P';
  }
  p.carte.grille=grille.map(l=>l.join(''));p.carte.version++;
  p.empreinte=hacher(p.carte.grille.join('\n')).toString(16);
  p.explications.push('Correction : dégagement latéral des axes après le premier contrôle.');return p;
}
export function chronologie(s: Scenario): { journee:number; texte:string }[] {
  return [
    ...(s.renforts??[]).map(r=>({journee:r.journee,texte:`Renforts : ${r.unites.length} unité(s).`})),
    ...(s.installationsIem??[]).map(r=>({journee:r.premiereJournee,texte:`Station IEM ${r.cle} ; intervalle ${r.intervalle??(r.mode==='renforcee'?6:3)} journées.`})),
    ...(s.superusines??[]).map(r=>({journee:r.depuisJournee??1,texte:`Superusine du camp ${r.camp} : ${r.type}, toutes les ${r.chaque??1} journées.`})),
    ...(s.evenementsClimat??[]).map(r=>({journee:r.journee,texte:`Événement climatique : ${r.meteo}.`})),
  ].sort((a,b)=>a.journee-b.journee);
}
