/** Candidats distincts dérivés du composeur de silhouettes du jeu. */
import * as THREE from 'three';
import path from 'node:path';
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { composerSilhouette, type Piece } from '../../src/render3d/pieces';
import { chargerUnites } from '../../src/content';
import { genererSpecs } from '../../src/assets/catalogue';
import type { AssetSpec } from '../../src/assets/spec';
import { ecrireCandidat, type Morceau } from './commun';
import { lireLot } from '../../src/serveur/reception-assets';
import { decouperGlb, assemblerGlb } from '../infanterie/gltf';
import { controlerDepot } from '../../src/serveur/depot-modeles';
const ROLES={principal:0,sombre:0,clair:0,roulant:1,materiel:2,verre:3,peau:5};
function geometrie(p:Piece,lod:number):THREE.BufferGeometry {
 const n=lod===0?10:lod===1?6:4;let g:THREE.BufferGeometry;
 if(p.forme==='boite'||p.forme==='plaque')g=new THREE.BoxGeometry(1,1,1);
 else if(p.forme==='cylindre')g=new THREE.CylinderGeometry(.5,.5,1,n,1,false);
 else if(p.forme==='cone')g=new THREE.ConeGeometry(.5,1,n);
 else g=new THREE.SphereGeometry(.5,n,lod===0?6:3);
 // Capsule et sphère normalisées au même volume, puis orientées X-avant vers Z-avant.
 g.scale(...p.taille);if(p.rotation)g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...p.rotation)));
 g.translate(...p.position);g.rotateY(-Math.PI/2);return g;
}
/** Tous les éléments mobiles suivent leur articulation, pas seulement la pièce éponyme. */
export function noeudPiece(spec:AssetSpec,p:Piece):string {
 const groupes:Record<string,RegExp>={
  canon_long:/^(canon_long|berceau)$/, tourelle:/^(tourelle|canon)$/,
  lance_roquettes:/^(rampe|tube_gauche|tube_droit)$/,
  radar:/radar/, antenne:/^(antenne|embase_antenne)$/,
  grue:/grue/, panneaux_solaires:/^panneau_(gauche|droit)$/,
  nacelle:/^(nacelle|hublot)$/,
 };
 for(const n of spec.format.noeuds.filter(n=>n.startsWith('module_'))){
  const motif=groupes[n.slice(7)];if(motif?.test(p.nom))return n;
 }
 const articulation=spec.format.noeuds.find(n=>n.startsWith('module_')&&p.nom.includes(n.slice(7)));
 if(articulation)return articulation;
 if(/roue|chenille|coque|carene|etrave|pied|patin|socle|plancher/.test(p.nom)&&spec.format.noeuds.includes('base'))return 'base';
 return spec.format.noeuds.includes('corps')?'corps':spec.format.noeuds.find(n=>n!=='racine')!;
}
export async function genererUnite(spec:AssetSpec,sortie:string){
 if(existsSync(path.resolve('public/assets/modeles',`${spec.id}_lod0.glb`))){
  const deja=existsSync(path.join(sortie,`${spec.id}_lod0.glb`));
  let fichiers=deja?readdirSync(sortie).filter(n=>n.startsWith(spec.id+'_')&&/\.(png|glb)$/.test(n)).map(n=>({nom:n,octets:readFileSync(path.join(sortie,n))})):lireLot(spec);
  let verdict=controlerDepot(spec,fichiers);
  // Copie candidate de l'infanterie historique : ses deux matériaux étaient identiques hors nom.
  if(!deja&&!verdict.ok&&spec.id==='unite_infanterie_base'){
   fichiers=fichiers.map(f=>{if(!f.nom.endsWith('.glb'))return f;const {document,bin}=decouperGlb(f.octets);const mats=document.materials as {name:string}[];const canon=mats.find(m=>m.name==='mat_corps')!;document.materials=[canon];for(const mesh of document.meshes as {primitives:{material:number}[]}[])for(const primitive of mesh.primitives)primitive.material=0;return {nom:f.nom,octets:assemblerGlb(document,bin)};});
   verdict=controlerDepot(spec,fichiers);if(verdict.ok){mkdirSync(sortie,{recursive:true});for(const f of fichiers)writeFileSync(path.join(sortie,f.nom),f.octets,{flag:'wx'});writeFileSync(path.join(sortie,'version-candidat.json'),JSON.stringify({version:2,origine:'copie_infanterie_publique_materiaux_normalises',validationArtistique:'non_effectuee'})+'\n');}
  }
  return {id:spec.id,ok:verdict.ok,motifs:verdict.motifs,fichiers:fichiers.map(f=>f.nom),conserve:deja||(!verdict.ok?false:!existsSync(path.join(sortie,`${spec.id}_lod0.glb`)))};
 }
 const cle=spec.id.replace(/^unite_/,'').replace(/_base$/,'');const u=chargerUnites().find(u=>u.cle===cle);if(!u)throw new Error(`Unité absente : ${cle}`);
 return ecrireCandidat(spec,sortie,lod=>{
  const budget=spec.budget[`lod${lod}` as 'lod0'|'lod1'|'lod2']??Infinity;
  let pieces=composerSilhouette(u.silhouette);let morceaux:Morceau[]=[];
  const construire=()=>pieces.map(p=>({geometrie:geometrie(p,lod),noeud:noeudPiece(spec,p),role:ROLES[p.role]}));
  morceaux=construire();const compte=()=>morceaux.reduce((s,m)=>s+(m.geometrie.index?.count??m.geometrie.getAttribute('position').count)/3,0);
  const extremes=new Set<string>();
  if(spec.id==='unite_genie_base')for(const axe of ['x','y','z'] as const)for(const cote of ['min','max'] as const){let valeur=cote==='min'?Infinity:-Infinity,nom='';morceaux.forEach((m,i)=>{m.geometrie.computeBoundingBox();const v=m.geometrie.boundingBox![cote][axe];if(cote==='min'?v<valeur:v>valeur){valeur=v;nom=pieces[i]!.nom;}});extremes.add(nom);}
  // Retirer les plus petits accessoires au LOD distant, conserver les volumes porteurs.
  while(compte()>budget&&pieces.length>3){let index=-1,volume=Infinity;pieces.forEach((p,i)=>{if(extremes.has(p.nom))return;const noeud=noeudPiece(spec,p);if(noeud.startsWith('module_')&&pieces.filter(q=>noeudPiece(spec,q)===noeud).length<=1)return;const v=p.taille.reduce((a,b)=>a*b,1);if(v<volume){volume=v;index=i;}});if(index<0)break;pieces=pieces.filter((_,i)=>i!==index);morceaux.forEach(m=>m.geometrie.dispose());morceaux=construire();}
  return morceaux;
 });
}
async function main(){
 const repertoire=path.resolve(process.argv[2]??'assets/livraisons');const filtre=process.argv[3];mkdirSync(repertoire,{recursive:true});
 const rapports=[];for(const spec of genererSpecs().filter(s=>s.type==='unite'&&(!filtre||s.id===filtre))){const r=await genererUnite(spec,path.join(repertoire,spec.id));rapports.push(r);writeFileSync(path.join(repertoire,'rapport-unites-candidates.json'),JSON.stringify(rapports,null,2)+'\n');console.log(JSON.stringify({id:r.id,ok:r.ok,conserve:r.conserve,motifs:r.motifs}));}
 writeFileSync(path.join(repertoire,'rapport-unites-candidates.json'),JSON.stringify(rapports,null,2)+'\n');if(rapports.some(r=>!r.ok))process.exitCode=1;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)void main().catch(e=>{console.error(e);process.exitCode=1;});
