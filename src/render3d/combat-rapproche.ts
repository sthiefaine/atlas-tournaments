/** Deux formations sur leurs cases : une figurine par PV affiché. */
import * as THREE from 'three/webgpu';
import type { Catalogue } from '../engine';
import type { Geste } from '../render/partition';
import { DUREES, MISE_EN_SCENE } from '../render/partition';
import type { VueCombat } from '../render/rendu';
import { paletteDe } from '../render/palettes';
import { appliquerMasque, clonerFigurine, clonerMateriauNoeud, couleurMasquee, masqueDe } from './modeles';
import { creerEffets, emettreImpact, emettreTir } from './effets';
import { profilTir } from './animations';
import { caseVersMonde } from './geometrie';
import type { CalqueUnites } from './unites';
import type { Plateau } from './terrain';
import type { Capture3d } from './scene';

type Duel = Extract<Geste, { genre: 'duel' }>;
export interface CombatRapproche extends VueCombat {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  hote: HTMLElement;
  captures: readonly Capture3d[];
}

/** Copier les lumières, sans les ombres ni les ressources de la carte. */
function eclairer(scene: THREE.Scene, carte: THREE.Scene): void {
  scene.environment = carte.environment;
  scene.environmentIntensity = carte.environmentIntensity;
  carte.traverse(o => {
    if (!(o instanceof THREE.DirectionalLight || o instanceof THREE.HemisphereLight)) return;
    const lumiere = o.clone();
    lumiere.position.copy(o.getWorldPosition(new THREE.Vector3()));
    lumiere.castShadow = false;
    scene.add(lumiere);
    if (lumiere instanceof THREE.DirectionalLight && o instanceof THREE.DirectionalLight) {
      lumiere.target.position.copy(o.target.getWorldPosition(new THREE.Vector3()));
      scene.add(lumiere.target);
    }
  });
}

export function creerCombatRapproche(
  hote: HTMLElement, duel: Duel, unites: CalqueUnites, catalogue: Catalogue,
  plateau: Plateau, carte: THREE.Scene, reveiller: () => void,
): CombatRapproche | null {
  const sources = [unites.sourceCombat(duel.attaquant.unite), unites.sourceCombat(duel.cible.unite)];
  if (sources.some(s => !s)) return null;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#12222b');
  const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .1, 40);
  camera.position.set(0, 6.8, 8.8);
  camera.lookAt(0, .15, 0);
  camera.updateMatrixWorld();
  const captures: Capture3d[] = [];
  const materiaux = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const modelesPrives: THREE.Object3D[] = [];
  const plan = new THREE.PlaneGeometry(1, 1);
  geometries.add(plan);
  const matrice = new THREE.Object3D();
  const normaliserPv = (pv: number) => Math.max(0, Math.min(10, Math.ceil(pv)));
  function preparer(scene: THREE.Scene, camera: THREE.Camera): THREE.RenderTarget {
    // Ces quatre images sont produites une seule fois. Aucun nouveau GLB,
    // téléchargement, readback GPU ou contexte graphique n'est nécessaire.
    const cible = new THREE.RenderTarget(256, 256, { type: THREE.HalfFloatType });
    captures.push({ scene, camera, cible, prete: false });
    return cible;
  }

  const combattants = [duel.attaquant, duel.cible].map((u, i) => {
    const sens = i === 0 ? 1 : -1;
    const centreX = i === 0 ? -1.65 : 1.65;
    const source = sources[i]!;
    const figurine = clonerFigurine(source.objet);
    modelesPrives.push(figurine);
    const clones = new Map<THREE.Material, THREE.Material>();
    figurine.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      const cloner = (m: THREE.Material) => {
        const connu = clones.get(m);
        if (connu) return connu;
        const c = m instanceof THREE.MeshStandardNodeMaterial ? clonerMateriauNoeud(m) : m.clone();
        if (c instanceof THREE.MeshBasicNodeMaterial && m instanceof THREE.MeshBasicNodeMaterial) {
          THREE.MeshBasicMaterial.prototype.copy.call(c as unknown as THREE.MeshBasicMaterial, m as unknown as THREE.MeshBasicMaterial);
        }
        if (c instanceof THREE.NodeMaterial) c.outputNode = null;
        if (c instanceof THREE.MeshStandardNodeMaterial) {
          c.transparent = false; c.opacity = 1; c.depthWrite = true;
          const masque = masqueDe(m), couleur = couleurMasquee(m);
          if (masque) appliquerMasque(c, masque, couleur?.clone() ?? new THREE.Color(paletteDe(u.camp).main));
        }
        clones.set(m, c); materiaux.add(c);
        return c;
      };
      o.material = Array.isArray(o.material) ? o.material.map(cloner) : cloner(o.material);
      o.castShadow = false; o.receiveShadow = false;
    });
    // Cadrage orthographique : le modèle reste reconnaissable dans les dix
    // exemplaires, sans redessiner dix millions de triangles à chaque image.
    const boite = new THREE.Box3().setFromObject(figurine);
    const taille = boite.getSize(new THREE.Vector3()), centre = boite.getCenter(new THREE.Vector3());
    const facteur = 1.4 / Math.max(taille.x, taille.y, taille.z, .1);
    const positionnement = new THREE.Group(); positionnement.add(figurine);
    positionnement.scale.setScalar(facteur);
    positionnement.position.copy(centre).multiplyScalar(-facteur);
    const orientation = new THREE.Group(); orientation.add(positionnement); orientation.rotation.y = i === 0 ? 0 : Math.PI;
    const portrait = new THREE.Scene(); portrait.add(orientation); eclairer(portrait, carte);
    const vueFigurine = new THREE.OrthographicCamera(-.92, .92, .92, -.92, .1, 20);
    vueFigurine.position.set(0, 2.2, 5); vueFigurine.lookAt(0, 0, 0);
    const imageFigurine = preparer(portrait, vueFigurine);
    const matFigurine = new THREE.MeshBasicNodeMaterial({ map: imageFigurine.texture, transparent: true, alphaTest: .02, depthWrite: false });
    materiaux.add(matFigurine);
    const formation = new THREE.InstancedMesh(plan, matFigurine, 10);
    formation.name = `formation_${i}`;
    formation.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    formation.frustumCulled = false;
    formation.count = normaliserPv(u.pvAvant);
    scene.add(formation);
    const altitude = catalogue.unites[u.type]?.domaine === 'air' ? .7 : .28;
    const positions = Array.from({ length: 10 }, (_, n) => new THREE.Vector3(
      centreX + sens * (.65 - (n % 3) * .65), altitude, -.95 + Math.floor(n / 3) * .68,
    ));

    // Photographier uniquement la surface de SA case, pas les bâtiments,
    // unités ou décors voisins. Routes, eau, neige et sol viennent du plateau.
    const terrain = new THREE.Scene();
    const surface = plateau.groupe.clone(true);
    surface.visible = true;
    const grille = surface.getObjectByName('grille');
    if (grille) grille.visible = false;
    terrain.add(surface); eclairer(terrain, carte);
    const point = caseVersMonde(u.case);
    const vueSol = new THREE.OrthographicCamera(-.5, .5, .5, -.5, .1, 80);
    vueSol.up.set(0, 0, -1);
    vueSol.position.set(point.x, 30, point.z); vueSol.lookAt(point.x, 0, point.z);
    const imageSol = preparer(terrain, vueSol);
    const matSol = new THREE.MeshBasicNodeMaterial({ map: imageSol.texture });
    materiaux.add(matSol);
    const sol = new THREE.Mesh(plan, matSol);
    sol.rotation.x = -Math.PI / 2; sol.scale.set(3.2, 3.3, 1); sol.position.set(centreX, -.04, 0);
    scene.add(sol);
    return { u, sens, formation, positions, altitude, effectif: normaliserPv(u.pvAvant) };
  });

  const effets = creerEffets(hote.ownerDocument); scene.add(effets.groupe);
  const tir = duel.duree * MISE_EN_SCENE.partCoup;
  const delai = duel.duree / DUREES.duel * MISE_EN_SCENE.delaiRiposte;
  const vol = duel.duree / DUREES.duel * DUREES.tir;
  const pointTir = (i: number, n = 0) => {
    const c = combattants[i]!, p = c.positions[n]!;
    return { x: p.x + c.sens * .25, y: c.altitude + .18, z: p.z };
  };
  const tirs = [{ temps: tir, de: 0, vers: 1 }, ...(duel.riposte ? [{ temps: tir + delai, de: 1, vers: 0 }] : [])];
  const evenements = tirs.flatMap(t => [
    { temps: t.temps, executer: () => {
      const c = combattants[t.de]!, cible = combattants[t.vers]!;
      for (let n = 0; n < Math.min(3, c.formation.count); n++) {
        emettreTir(effets, {
          profil: profilTir(catalogue.unites[c.u.type], catalogue.unites[cible.u.type]),
          depuis: pointTir(t.de, n), vers: pointTir(t.vers, Math.min(n, Math.max(0, cible.formation.count - 1))), duree: vol,
          couleur: paletteDe(c.u.camp).light,
        });
      }
    } },
    { temps: t.temps + vol, executer: () => {
      const cible = combattants[t.vers]!;
      const apres = normaliserPv(cible.u.pvApres);
      for (let n = apres; n < cible.formation.count; n++) {
        const p = cible.positions[n]!;
        emettreImpact(effets, { x: p.x, y: cible.altitude, z: p.z }, '#efc791');
      }
      cible.formation.count = apres;
      if (apres === cible.effectif) emettreImpact(effets, pointTir(t.vers), '#efc791');
    } },
  ]).sort((a, b) => a.temps - b.temps);
  let mort = false, ecoule = 0, index = 0;
  return {
    scene, camera, hote, captures,
    avancer(p) {
      if (mort) return;
      const t = Math.max(ecoule, Math.min(1, p) * duel.duree);
      if (duel.duree > 0) {
        while (index < evenements.length && evenements[index]!.temps <= t) {
          const e = evenements[index++]!;
          effets.avancer(Math.max(0, e.temps - ecoule)); ecoule = e.temps; e.executer();
        }
        effets.avancer(t - ecoule);
      }
      ecoule = t;
      const aspect = Math.max(.5, hote.clientWidth / Math.max(1, hote.clientHeight));
      const largeur = Math.max(3.6, 2 * aspect), hauteur = largeur / aspect;
      camera.left = -largeur; camera.right = largeur; camera.top = hauteur; camera.bottom = -hauteur;
      camera.updateProjectionMatrix();
      for (let i = 0; i < combattants.length; i++) {
        const c = combattants[i]!, age = t - tir - (i === 1 ? delai : 0);
        if (duel.duree === 0 || p >= 1) c.formation.count = normaliserPv(c.u.pvApres);
        const recul = (i === 0 || duel.riposte) && age >= 0 && age < 220 ? Math.sin(Math.PI * age / 220) * .09 : 0;
        for (let n = 0; n < c.formation.count; n++) {
          matrice.position.copy(c.positions[n]!); matrice.position.x -= c.sens * recul;
          matrice.quaternion.copy(camera.quaternion); matrice.scale.setScalar(.92); matrice.updateMatrix();
          c.formation.setMatrixAt(n, matrice.matrix);
        }
        c.formation.instanceMatrix.needsUpdate = true;
      }
      reveiller();
    },
    fermer() {
      if (mort) return;
      mort = true; effets.dispose();
      for (const c of combattants) c.formation.dispose();
      for (const objet of modelesPrives) objet.traverse(o => { if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose(); });
      for (const m of materiaux) m.dispose();
      for (const g of geometries) g.dispose();
      for (const capture of captures) { capture.cible.dispose(); capture.scene.clear(); }
      scene.clear(); reveiller();
    },
  };
}
