/** Vérifie une solution légale simple face à l'IA pondérée, sans modifier l'état. */
import { readFileSync } from 'node:fs';
import { creerPartie, sceneDepuis, chargerCatalogue, appliquer, restaurerRng, enregistrerPartie, rejouer, empreinte, type Action } from '../src/engine/index';
import { jouerTour, PONDEREE, meilleureOption, POIDS_PONDEREE } from '../src/ai/index';
import { portee, casesAtteignables, cheminVers, coutEntree, voisines } from '../src/engine/regles/mouvement';
import { validerScenario, validerMapDef, type Case } from '../src/schemas/index';
import { resoudreCommandantsScenario } from '../src/content/commandants-jeu';
const manifeste=JSON.parse(readFileSync('content/campagne.json','utf8')) as {missions:{scenarioCle:string}[]};
for(const {scenarioCle} of manifeste.missions){
 const vs=validerScenario(JSON.parse(readFileSync(`content/scenarios/${scenarioCle}.json`,'utf8')));if(!vs.ok)throw Error(JSON.stringify(vs));const s=vs.valeur;
 const vm=validerMapDef(JSON.parse(readFileSync(`content/cartes/${s.carteCle}.json`,'utf8')));if(!vm.ok)throw Error(JSON.stringify(vm));
 const cat=chargerCatalogue(s.catalogueVersion);const commandants=resoudreCommandantsScenario(s);const scene=sceneDepuis(s,vm.valeur,commandants);
 let e=creerPartie(scene,cat,`${s.code}:1`);const actions:Action[]=[];
 function agir(a:Action){const r=appliquer(e,a,cat,commandants);if(!r.ok)throw Error(scenarioCle+': '+r.motif);e=r.etat;actions.push(a);}
 for(let tour=0;tour<40&&!e.partie.terminee;tour++){
  if(e.campCourant!==0){const tourIa=jouerTour(e,PONDEREE,restaurerRng(e.graine,e.flux),cat,commandants);if(tourIa.refus.length)throw Error(JSON.stringify(tourIa.refus));e=tourIa.etat;actions.push(...tourIa.actions);continue;}
  const objectif=s.victoire[0]!;const u=e.unites.find(u=>u.id==='u1') ?? (objectif.type==='relais'?e.unites.find(u=>u.camp===0&&u.type==='infanterie'):undefined);if(!u)break;
  const cible:Case|undefined=objectif.type==='proteger'?objectif.destination:objectif.type==='relais'?objectif.cases[e.relais?.['0']??0]:objectif.type==='capturer'?objectif.cases[0]:undefined;
  // Démonstration du raccourci : ouvrir le col, puis libérer sa case d'approche.
  if(scenarioCle==='pacte_du_col'){
   const genie=e.unites.find(u=>u.type==='genie');
   if(genie&&e.journee===1)agir({type:'ordre',uniteId:genie.id,chemin:[{x:genie.x,y:genie.y}],suite:{type:'construire',cible:{x:5,y:2}}});
   if(genie&&e.journee===2)agir({type:'ordre',uniteId:genie.id,chemin:[{x:genie.x,y:genie.y},{x:4,y:1}],suite:{type:'rien'}});
  }
  if(scenarioCle==='passage_des_marees'){
   for(const soutien of e.unites.filter(z=>z.camp===0&&z.id!=='u1')){
    if(e.partie.terminee)break;
    agir(meilleureOption(e,cat,soutien,POIDS_PONDEREE).action);
   }
  }
  if(cible&&!e.partie.terminee){
   const mobile=e.unites.find(z=>z.id===u.id)!;const p=portee(e,cat,mobile);
   // Distance au but sur la grille entière pour choisir un détour lorsque la mer monte.
   const distances=new Map<string,number>();const file:Case[]=[cible];distances.set(`${cible.x},${cible.y}`,0);
   while(file.length){const c=file.shift()!;for(const v of voisines(c)){const k=`${v.x},${v.y}`;if(distances.has(k)||coutEntree(e,cat,mobile,v)===null)continue;distances.set(k,distances.get(`${c.x},${c.y}`)!+1);file.push(v);}}
   const libre=casesAtteignables(p).filter(c=>!e.unites.some(z=>z.id!==mobile.id&&!z.dansTransport&&z.x===c.x&&z.y===c.y));
   libre.sort((a,b)=>(distances.get(`${a.x},${a.y}`)??999)-(distances.get(`${b.x},${b.y}`)??999));
   const arrivee=libre[0];if(arrivee){const chemin=cheminVers(p,mobile,arrivee)!;agir({type:'ordre',uniteId:mobile.id,chemin,suite:objectif.type==='capturer'&&arrivee.x===cible.x&&arrivee.y===cible.y?{type:'capturer'}:{type:'rien'}});}
  }
  if(!e.partie.terminee)agir({type:'finTour'});
 }
 console.log(scenarioCle,e.partie,e.journee,actions.length);
 const repetition=rejouer(scene,cat,enregistrerPartie(e,actions),commandants);
 if(repetition.refus.length||empreinte(repetition.etat)!==empreinte(e))throw Error(`${scenarioCle}: rejeu divergent`);
 if(e.partie.vainqueur!==0)process.exitCode=1;
}
