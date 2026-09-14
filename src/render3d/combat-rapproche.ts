/** Duel rendu dans le canvas de la carte, avec les figurines déjà en mémoire. */
import * as THREE from 'three/webgpu';
import type { Catalogue } from '../engine';
import type { Geste } from '../render/partition';
import { DUREES, MISE_EN_SCENE } from '../render/partition';
import type { VueCombat } from '../render/rendu';
import { paletteDe } from '../render/palettes';
import { appliquerMasque, clonerFigurine, clonerMateriauNoeud, couleurMasquee, masqueDe } from './modeles';
import { creerEffets, emettreImpact, emettreTir } from './effets';
import { profilTir } from './animations';
import type { CalqueUnites } from './unites';

type Duel = Extract<Geste, { genre: 'duel' }>;
export interface CombatRapproche extends VueCombat {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  hote: HTMLElement;
}
export function creerCombatRapproche(hote: HTMLElement, duel: Duel, unites: CalqueUnites, catalogue: Catalogue, terrain: string, reveiller: () => void): CombatRapproche | null {
  const sources = [unites.sourceCombat(duel.attaquant.unite), unites.sourceCombat(duel.cible.unite)];
  if (sources.some(s => !s)) return null;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#243c48');
  scene.fog = new THREE.Fog('#243c48', 7, 15);
  const camera = new THREE.PerspectiveCamera(34, 2, .05, 30);
  const soleil = new THREE.DirectionalLight(0xffeed5, 3.1); soleil.position.set(-3, 6, 4);
  scene.add(soleil, new THREE.HemisphereLight(0xd5eeff, 0x596249, 2.2));
  const materiaux = new Set<THREE.Material>(), geometries = new Set<THREE.BufferGeometry>();
  const ajouterSol = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    geometries.add(geo); materiaux.add(mat);
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x,y,z); scene.add(mesh); return mesh;
  };
  const couleurSol = /mer|port|riviere/.test(terrain) ? '#3d7280' : /route|pont|usine|aeroport/.test(terrain) ? '#74776f' : /montagne/.test(terrain) ? '#858774' : '#73835b';
  const sol = ajouterSol(new THREE.PlaneGeometry(22,22), new THREE.MeshStandardNodeMaterial({color:couleurSol,roughness:.92}),0,-.025,0); sol.rotation.x=-Math.PI/2;
  if (/foret|montagne/.test(terrain)) for(let i=0;i<7;i++) {
    const rocher=ajouterSol(new THREE.IcosahedronGeometry(.22+i%3*.1,0),new THREE.MeshStandardNodeMaterial({color:'#68776b',roughness:1}),-3+i, .06,-1.6-(i%2)*.3);rocher.scale.y=.45;
  }
  const combattants = [duel.attaquant,duel.cible].map((u,i)=>{
    const source=sources[i]!;
    // Le modèle est déjà conformé avec son avant en +X. L'enveloppe porte le cadrage du duel.
    const figurine=clonerFigurine(source.objet);
    const objet=new THREE.Group();objet.add(figurine);
    const clones=new Map<THREE.Material,THREE.Material>();
    objet.traverse(o=>{
      if (!(o instanceof THREE.Mesh)) return;
      const cloner=(m:THREE.Material)=>{
        const connu=clones.get(m);if(connu)return connu;
        const c=m instanceof THREE.MeshStandardNodeMaterial?clonerMateriauNoeud(m):m.clone();
        if(c instanceof THREE.MeshBasicNodeMaterial && m instanceof THREE.MeshBasicNodeMaterial) {
          THREE.MeshBasicMaterial.prototype.copy.call(c as unknown as THREE.MeshBasicMaterial, m as unknown as THREE.MeshBasicMaterial);
        }
        if(c instanceof THREE.NodeMaterial)c.outputNode=null;
        if(c instanceof THREE.MeshStandardNodeMaterial){
          // Ni le brouillard du plateau ni son ternissement ne suivent la figurine dans le duel.
          c.outputNode=null;c.transparent=false;c.opacity=1;c.depthWrite=true;
          const masque=masqueDe(m),couleur=couleurMasquee(m);
          if(masque)appliquerMasque(c,masque,couleur?.clone()??new THREE.Color(paletteDe(u.camp).main));
        }
        clones.set(m,c);materiaux.add(c);return c;
      };
      o.material=Array.isArray(o.material)?o.material.map(cloner):cloner(o.material);
      o.castShadow=false;o.receiveShadow=false;
    });
    const boite=new THREE.Box3().setFromObject(objet),taille=boite.getSize(new THREE.Vector3()),centre=boite.getCenter(new THREE.Vector3());
    const facteur=1.2/Math.max(taille.x,taille.y,taille.z,.1);
    objet.scale.setScalar(facteur);objet.position.set(-centre.x*facteur,-boite.min.y*facteur,-centre.z*facteur);
    const pivot=new THREE.Group();pivot.add(objet);pivot.position.set(i===0?-1.35:1.35,catalogue.unites[u.type]?.domaine==='air'?.62:0,0);pivot.rotation.y=i===0?0:Math.PI;scene.add(pivot);
    const ombre=ajouterSol(new THREE.CircleGeometry(.65,24),new THREE.MeshBasicNodeMaterial({color:0x172821,transparent:true,opacity:.24,depthWrite:false}),pivot.position.x,-.018,0);ombre.rotation.x=-Math.PI/2;ombre.scale.y=.7;
    // Les pistes des GLB ciblent leurs nœuds nommés ; elles ne déplacent jamais le pivot du duel.
    const mixerGlb=new THREE.AnimationMixer(figurine);
    let action:THREE.AnimationAction|null=null;
    const clip=(nom:string)=>{const c=source.clips.find(c=>c.name===nom);if(!c)return;action?.stop();action=mixerGlb.clipAction(c);action.reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.setEffectiveTimeScale(duel.duree>0?DUREES.duel/duel.duree:1);action.play();};
    return {u,pivot,objet,mixerGlb,clip,hauteur:Math.max(.22,taille.y*facteur*.65),sol:pivot.position.y};
  });
  const effets=creerEffets(hote.ownerDocument);scene.add(effets.groupe);
  const tir=duel.duree*MISE_EN_SCENE.partCoup;
  const delai=duel.duree/DUREES.duel*MISE_EN_SCENE.delaiRiposte;
  const vol=duel.duree/DUREES.duel*DUREES.tir;
  const bouche=(i:number)=>{const c=combattants[i]!;return {x:c.pivot.position.x+(i===0?.42:-.42),y:c.sol+c.hauteur,z:0};};
  const cible=(i:number)=>{const c=combattants[i]!;return {x:c.pivot.position.x,y:c.sol+c.hauteur,z:0};};
  const tirs=[{temps:tir,de:0,vers:1},...(duel.riposte?[{temps:tir+delai,de:1,vers:0}]:[])];
  const evenements=tirs.flatMap(t=>[
    {temps:t.temps,executer:()=>{combattants[t.de]!.clip('tir');emettreTir(effets,{profil:profilTir(catalogue.unites[combattants[t.de]!.u.type],catalogue.unites[combattants[t.vers]!.u.type]),depuis:bouche(t.de),vers:cible(t.vers),duree:vol,couleur:paletteDe(combattants[t.de]!.u.camp).light});}},
    {temps:t.temps+vol,executer:()=>{emettreImpact(effets,cible(t.vers),'#efc791');combattants[t.vers]!.clip(combattants[t.vers]!.u.pvApres===0?'hors_jeu':'touche');}}
  ]).sort((a,b)=>a.temps-b.temps);
  let mort=false,ecoule=0,index=0;
  function pas(ms:number){effets.avancer(ms);for(const c of combattants)c.mixerGlb.update(ms/1000);}
  return {scene,camera,hote,
    avancer(p){
      if(mort)return;
      const t=Math.max(ecoule,Math.min(1,p)*duel.duree);
      if(duel.duree>0){
        while(index<evenements.length&&evenements[index]!.temps<=t){const e=evenements[index++]!;pas(Math.max(0,e.temps-ecoule));ecoule=e.temps;e.executer();}
        pas(t-ecoule);
      }
      ecoule=t;
      for(let i=0;i<2;i++){
        const c=combattants[i]!,debut=tir+(i===1?delai:0),age=t-debut;
        const recul=(i===0||duel.riposte)&&age>=0&&age<240?Math.sin(Math.PI*age/240)*.10:0;
        c.pivot.position.x=(i===0?-1.35:1.35)+(i===0?-recul:recul);
        const impact=tir+vol+(i===0?delai:0),pChute=duel.duree===0?1:Math.max(0,Math.min(1,(t-impact)/350));
        c.pivot.rotation.z=c.u.pvApres===0?(i===0?-.14:.14)*pChute:0;
        c.pivot.position.y=c.sol-(c.u.pvApres===0?.08*pChute:0);
      }
      camera.aspect=Math.max(.7,hote.clientWidth/Math.max(1,hote.clientHeight));
      camera.position.set(.3,2.25,Math.max(5.6,3.9/camera.aspect)+(duel.duree>0?.2*(1-p):0));camera.lookAt(0,.45,0);camera.updateProjectionMatrix();
      reveiller();
    },
    fermer(){if(mort)return;mort=true;effets.dispose();for(const c of combattants){c.mixerGlb.stopAllAction();c.mixerGlb.uncacheRoot(c.mixerGlb.getRoot());c.objet.traverse(o=>{if(o instanceof THREE.SkinnedMesh)o.skeleton.dispose();});}for(const m of materiaux)m.dispose();for(const g of geometries)g.dispose();scene.clear();reveiller();}
  };
}
