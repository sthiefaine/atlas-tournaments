/** Première activation explicite ; aucune sélection nationale déduite du terrain. */
import { extraireVegetation, type VegetationLivree } from './vegetation-plaine';
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { chargerInventaire, convertirMateriaux } from './modeles';
export const ENVIRONNEMENT_PREMIER_CONTACT = {
  qg: ['batiment_qg_fr_ile_de_france', 'batiment_qg_lu'],
  sols: ['terrain_plaine','terrain_foret','terrain_riviere','terrain_route','terrain_pont'],
} as const;
export interface MatiereLivree { albedo: THREE.Texture; normale: THREE.Texture; rugosite: THREE.Texture; vegetation?:VegetationLivree }
export interface EnvironnementLivre { batiments: Map<string, THREE.Object3D>; sols: Map<string,MatiereLivree> }
export function selectionEnvironnement(scenario: string): string[] {
  return scenario === 'premier_contact' ? [...ENVIRONNEMENT_PREMIER_CONTACT.qg,...ENVIRONNEMENT_PREMIER_CONTACT.sols] : [];
}
export async function chargerEnvironnement(scenario: string): Promise<EnvironnementLivre> {
  const resultat: EnvironnementLivre = {batiments:new Map(),sols:new Map()};
  const selection = selectionEnvironnement(scenario);
  if (!selection.length) return resultat;
  const inventaire = await chargerInventaire();
  const glb = new GLTFLoader(), images = new THREE.TextureLoader();
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
            const loin=await glb.loadAsync(`/assets/modeles/${id}_lod1.glb`);scenes.push(loin.scene);
            const g0=extraireVegetation(proche.scene),g1=extraireVegetation(loin.scene);
            if(g0&&g1)matiere.vegetation={proche:g0,loin:g1,base:.020000001};
            else {g0?.dispose();g1?.dispose();}
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
