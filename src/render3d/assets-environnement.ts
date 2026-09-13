import { MeshoptDecoder } from 'meshoptimizer/meshopt_decoder.module.js';
/** Assets actifs, sélectionnés selon la carte et les nations, quel que soit le scénario. */
import { extraireVegetation, type VegetationLivree } from './vegetation-plaine';
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { chargerInventaire, convertirMateriaux } from './modeles';
import type { GrilleTerrain } from './geometrie';
import type { CodePays, CampId } from '../schemas/types';
import type { InventaireModeles } from '../assets/spec';

/** Le QG français livré avant le nom national générique reste un repli explicite. */
export function candidatsBatiment(terrain:string,pays?:string):string[] {
  return [...(pays?[`batiment_${terrain}_${pays}`]:[]),`batiment_${terrain}_base`];
}
export function selectionEnvironnement(grille:GrilleTerrain,paysParCamp:Partial<Record<CampId,CodePays>>,inventaire:InventaireModeles):string[] {
  const terrains=new Set<string>();
  for(let y=0;y<grille.hauteur;y++)for(let x=0;x<grille.largeur;x++)terrains.add(grille.terrainDe(x,y));
  const selection=new Set<string>();
  const present=(id:string)=>inventaire.modeles[id]?.includes(0);
  for(const terrain of terrains) {
    // La plaine conserve l'herbe procédurale de base ; ses décors sont indépendants.
    const sol=`terrain_${terrain}`;if(terrain!=='plaine'&&present(sol))selection.add(sol);
    for(const pays of [undefined,...new Set(Object.values(paysParCamp))]) {
      const id=candidatsBatiment(terrain,pays).find(present);if(id)selection.add(id);
    }
  }
  return [...selection];
}
export interface MatiereLivree { albedo: THREE.Texture; normale: THREE.Texture; rugosite: THREE.Texture; vegetation?:VegetationLivree }
export interface EnvironnementLivre { batiments: Map<string, THREE.Object3D>; sols: Map<string,MatiereLivree> }
export async function chargerEnvironnement(grille:GrilleTerrain,paysParCamp:Partial<Record<CampId,CodePays>>={}): Promise<EnvironnementLivre> {
  const resultat: EnvironnementLivre = {batiments:new Map(),sols:new Map()};
  const inventaire = await chargerInventaire();
  if(!inventaire)return resultat;
  const selection = selectionEnvironnement(grille,paysParCamp,inventaire);
  const glb = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), images = new THREE.TextureLoader();
  await Promise.all(selection.map(async id => {
    if (!inventaire?.modeles[id]?.includes(0)) return;
    try {
      if (id.startsWith('batiment_')) {
        const lu = await glb.loadAsync(`/assets/modeles/${id}_lod0.glb`);
        convertirMateriaux(lu.scene);
        lu.scene.name = id;
        lu.scene.traverse(o => {if (o instanceof THREE.Mesh) {o.castShadow=true;o.receiveShadow=true;}});
        resultat.batiments.set(id,lu.scene);
      } else {
        const chargees = await Promise.allSettled(['albedo','normale','rugosite'].map(c => images.loadAsync(`/assets/modeles/${id}_${c}.png`)));
        if (chargees.some(r => r.status==='rejected')) {for (const r of chargees) if(r.status==='fulfilled')r.value.dispose();return;}
        const [albedo,normale,rugosite] = chargees.map(r => (r as PromiseFulfilledResult<THREE.Texture>).value) as [THREE.Texture,THREE.Texture,THREE.Texture];
        albedo.colorSpace=THREE.SRGBColorSpace;
        for (const t of [albedo,normale,rugosite]) {t.wrapS=t.wrapT=THREE.RepeatWrapping;t.flipY=false;}
        const matiere:MatiereLivree={albedo,normale,rugosite};
        if(id==='terrain_plaine'){
          const scenes:THREE.Object3D[]=[];
          try{
            const proche=await glb.loadAsync(`/assets/modeles/${id}_lod0.glb`);scenes.push(proche.scene);
            const g0=extraireVegetation(proche.scene);
            if(g0)matiere.vegetation={proche:g0,base:.020000001};
          }catch{/* Une ancienne livraison plane reste utilisable. */}
          finally{libererBatimentsLivres(new Map(scenes.map((s,n)=>[String(n),s])));}
        }
        resultat.sols.set(id,matiere);
      }
    } catch { /* Le rendu procédural reste disponible si le fichier est inaccessible. */ }
  }));
  return resultat;
}
/** Les clones de scène partagent ces ressources jusqu'à la destruction du décor. */
export function libererBatimentsLivres(modeles: Map<string,THREE.Object3D>): void {
  const geos=new Set<THREE.BufferGeometry>(), mats=new Set<THREE.Material>(), textures=new Set<THREE.Texture>();
  for(const objet of modeles.values()) objet.traverse(o=>{if(o instanceof THREE.Mesh){geos.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){mats.add(m);for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);}}});
  for(const g of geos)g.dispose();for(const m of mats)m.dispose();for(const t of textures)t.dispose();
}
