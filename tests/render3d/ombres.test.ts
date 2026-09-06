// Le cadre d'ombre (`16-realisme.md` A2) : la caméra d'ombre du soleil se
// resserre sur ce que la caméra du jeu voit. Ce fichier vérifie la géométrie à
// sec — le champ visible au sol, le cadre orthographique dans le repère de la
// lumière —, puis la confronte à la **vraie** caméra d'ombre de three.js : un
// cadre calculé dans un autre repère que celui de `lookAt` couperait des ombres
// sans qu'aucun test purement numérique ne le voie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { TANGAGE_DEFAUT, champAuSol, type EtatCamera } from '../../src/render3d/camera';
import { directionSoleil } from '../../src/render3d/eclairage';
import { CASE } from '../../src/render3d/geometrie';
import {
  DISTANCE_SOLEIL, HAUTEURS_OMBRE, MARGE_CARTE, cadreOmbre, champVisibleAuSol, directionLumiere,
  intersectionSol, rectangleCarte, tailleCarteOmbre, type CadreOmbre, type RectangleSol,
} from '../../src/render3d/ombres';

const CARTE = { largeur: 24, hauteur: 16 };
const SOLEIL_ETE = { elevation: 67, azimut: 132 };
const LUNE_HIVER = { elevation: 33, azimut: 302 };

function etat(p: Partial<EtatCamera> = {}): EtatCamera {
  return { cible: { x: 8, z: 6 }, distance: 18, tangage: TANGAGE_DEFAUT, lacet: 0, ...p };
}

/** Les huit coins d'une boîte champ × tranche d'altitudes. */
function coins(r: RectangleSol, h: { min: number; max: number }): THREE.Vector3[] {
  const sortie: THREE.Vector3[] = [];
  for (const x of [r.minX, r.maxX]) for (const y of [h.min, h.max]) for (const z of [r.minZ, r.maxZ]) sortie.push(new THREE.Vector3(x, y, z));
  return sortie;
}

/**
 * La caméra d'ombre telle que three.js la construit : une `DirectionalLight`
 * posée comme `eclairage.ts` le fait, ses matrices mises à jour par
 * `DirectionalLightShadow.updateMatrices`, et le cadre appliqué dessus.
 */
function cameraOmbreThree(cadre: CadreOmbre, soleil: { elevation: number; azimut: number }, cible: { x: number; z: number }): THREE.OrthographicCamera {
  const lumiere = new THREE.DirectionalLight();
  const centre = new THREE.Vector3(cible.x, 0, cible.z);
  lumiere.target.position.copy(centre);
  lumiere.target.updateMatrixWorld();
  lumiere.position.copy(centre).add(directionSoleil(soleil.elevation, soleil.azimut, DISTANCE_SOLEIL));
  lumiere.updateMatrixWorld();
  const cam = lumiere.shadow.camera;
  cam.left = cadre.gauche;
  cam.right = cadre.droite;
  cam.top = cadre.haut;
  cam.bottom = cadre.bas;
  cam.near = cadre.near;
  cam.far = cadre.far;
  cam.updateProjectionMatrix();
  lumiere.shadow.updateMatrices(lumiere);
  return cam;
}

/** Un point projeté par la caméra d'ombre tombe-t-il dans son volume ? */
function dansLeVolume(cam: THREE.OrthographicCamera, p: THREE.Vector3): boolean {
  const ndc = p.clone().applyMatrix4(cam.matrixWorldInverse).applyMatrix4(cam.projectionMatrix);
  return Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && Math.abs(ndc.z) <= 1;
}

test('la direction de la lumière est celle de `directionSoleil`', () => {
  for (const [e, a] of [[67, 132], [33, 302], [12, 0], [82, 90], [45, 225]] as const) {
    const attendu = directionSoleil(e, a, 1);
    const [x, y, z] = directionLumiere(e, a);
    assert.ok(Math.abs(x - attendu.x) < 1e-9 && Math.abs(y - attendu.y) < 1e-9 && Math.abs(z - attendu.z) < 1e-9, `${e}°/${a}°`);
  }
});

test('la carte d’ombre : 2048 à la souris, 1024 au doigt', () => {
  assert.equal(tailleCarteOmbre(false), 2048);
  assert.equal(tailleCarteOmbre(true), 1024);
});

test('le champ visible au sol : exact au fond de l’écran, là où `champAuSol` approxime', () => {
  // Caméra à 68° de tangage, 18 unités de la cible, écran 16:10, sol plat à zéro.
  const aspect = 1.6;
  const plat = { min: 0, max: 0 };
  const champ = champVisibleAuSol(etat(), aspect, plat);
  // À lacet 0 la caméra est en +z et regarde vers −z : le fond de l'écran est en
  // z petit. Le rayon du haut de l'écran fait 43° avec la verticale, celui du
  // bas 1° : la géométrie à la main donne z = −2,84 et 12,45.
  assert.ok(Math.abs(champ.minZ - -2.84) < 0.1, `fond : ${champ.minZ}`);
  assert.ok(Math.abs(champ.maxZ - 12.45) < 0.1, `devant : ${champ.maxZ}`);
  // Symétrique en x autour de la cible, et plus large au fond que l'approximation.
  assert.ok(Math.abs((champ.maxX - 8) - (8 - champ.minX)) < 1e-6);
  assert.ok(Math.abs(champ.maxX - 21.09) < 0.15, `coin du fond : ${champ.maxX}`);
  const approx = champAuSol(18, aspect, TANGAGE_DEFAUT);
  assert.ok(champ.maxX - champ.minX > approx.largeur * CASE, 'la perspective montre plus que le champ au plan de la cible');
  assert.ok(champ.maxZ - champ.minZ > approx.profondeur * CASE * 0.9);
  // Une tranche d'altitudes ne peut qu'agrandir le champ.
  const epais = champVisibleAuSol(etat(), aspect);
  assert.ok(epais.minX <= champ.minX && epais.maxX >= champ.maxX && epais.minZ <= champ.minZ && epais.maxZ >= champ.maxZ);
  // Un quart de tour échange les axes ; rapprocher la caméra rétrécit le champ.
  const tourne = champVisibleAuSol(etat({ lacet: 90 }), aspect, plat);
  assert.ok(Math.abs((tourne.maxX - tourne.minX) - (champ.maxZ - champ.minZ)) < 1e-6);
  assert.ok(Math.abs((tourne.maxZ - tourne.minZ) - (champ.maxX - champ.minX)) < 1e-6);
  const proche = champVisibleAuSol(etat({ distance: 6 }), aspect, plat);
  assert.ok(proche.maxX - proche.minX < (champ.maxX - champ.minX) / 2.5);
});

test('le cadre couvre la boîte visible, dans le repère de la vraie caméra d’ombre', () => {
  const aspect = 1.6;
  for (const [nom, e, soleil] of [
    ['défaut, été', etat(), SOLEIL_ETE],
    ['tourné, lune d’hiver', etat({ lacet: 270, distance: 9 }), LUNE_HIVER],
    ['loin, portrait', etat({ distance: 45, tangage: 60 }), SOLEIL_ETE],
    ['tout près', etat({ distance: 2, tangage: 75, cible: { x: 1, z: 15 } }), LUNE_HIVER],
  ] as const) {
    const champ = champVisibleAuSol(e, aspect);
    const cadre = cadreOmbre(champ, CARTE, soleil, e.cible, 2048);
    assert.ok(cadre.gauche < cadre.droite && cadre.bas < cadre.haut, nom);
    assert.ok(cadre.near >= 0.1 && cadre.near < cadre.far, `${nom} : profondeurs`);
    const cam = cameraOmbreThree(cadre, soleil, e.cible);
    const boite = intersectionSol(champ, rectangleCarte(CARTE)) ?? rectangleCarte(CARTE);
    for (const c of coins(boite, HAUTEURS_OMBRE)) {
      assert.ok(dansLeVolume(cam, c), `${nom} : le coin ${c.x},${c.y},${c.z} sort du volume d'ombre`);
    }
    // Et la cible elle-même, au sol comme au sommet de la tranche.
    assert.ok(dansLeVolume(cam, new THREE.Vector3(e.cible.x, 0, e.cible.z)), nom);
    assert.ok(dansLeVolume(cam, new THREE.Vector3(e.cible.x, HAUTEURS_OMBRE.max, e.cible.z)), nom);
  }
});

test('un porteur d’ombre hors du champ, mais sur un rayon qui le traverse, est dans le volume', () => {
  const e = etat({ distance: 9 });
  const champ = champVisibleAuSol(e, 1.6);
  const cadre = cadreOmbre(champ, CARTE, LUNE_HIVER, e.cible, 2048);
  const cam = cameraOmbreThree(cadre, LUNE_HIVER, e.cible);
  // Depuis un coin du champ, on remonte vers la lune jusqu'à la hauteur maximale
  // de la tranche : c'est là que se tient le plus lointain porteur possible.
  const boite = intersectionSol(champ, rectangleCarte(CARTE)) ?? champ;
  const d = directionSoleil(LUNE_HIVER.elevation, LUNE_HIVER.azimut, 1);
  for (const c of coins(boite, { min: 0, max: 0 })) {
    const porteur = c.clone().addScaledVector(d, (HAUTEURS_OMBRE.max - 0) / d.y);
    assert.ok(dansLeVolume(cam, porteur), `porteur au-dessus de ${c.x},${c.z}`);
  }
});

test('le cadre reste dans la carte, et se resserre quand on s’approche', () => {
  const aspect = 1.6;
  // De très loin, le champ dépasse la carte : le cadre se borne à la carte et sa marge.
  const loin = etat({ distance: 60 });
  const champLoin = champVisibleAuSol(loin, aspect);
  const limite = rectangleCarte(CARTE);
  assert.ok(champLoin.minX < limite.minX && champLoin.maxX > limite.maxX, 'le champ déborde bien la carte');
  const cadreLoin = cadreOmbre(champLoin, CARTE, SOLEIL_ETE, loin.cible, 2048);
  const cadreCarte = cadreOmbre(limite, CARTE, SOLEIL_ETE, loin.cible, 2048);
  assert.deepEqual(cadreLoin, cadreCarte, 'au-delà de la carte, rien ne porte d’ombre');
  assert.equal(limite.maxX, CARTE.largeur * CASE + MARGE_CARTE);
  // L'ancien cadre — la carte entière, 1024² — donnait un texel de 0,043 : le
  // nouveau est plus fin même de très loin, et bien plus fin au zoom par défaut.
  const ancienTexel = (2 * (Math.max(CARTE.largeur, CARTE.hauteur) * CASE * 0.75 + 4)) / 1024;
  assert.ok(cadreLoin.texel < ancienTexel, `de loin : ${cadreLoin.texel} contre ${ancienTexel}`);
  const defaut = etat();
  const cadreDefaut = cadreOmbre(champVisibleAuSol(defaut, aspect), CARTE, SOLEIL_ETE, defaut.cible, 2048);
  assert.ok(cadreDefaut.texel < ancienTexel / 2, `par défaut : ${cadreDefaut.texel}`);
  const pres = etat({ distance: 5 });
  const cadrePres = cadreOmbre(champVisibleAuSol(pres, aspect), CARTE, SOLEIL_ETE, pres.cible, 2048);
  assert.ok(cadrePres.texel < cadreDefaut.texel, 'plus près, plus fin');
  // Au doigt, la carte est deux fois moins fine, pas le cadre.
  const cadreDoigt = cadreOmbre(champVisibleAuSol(defaut, aspect), CARTE, SOLEIL_ETE, defaut.cible, 1024);
  assert.ok(Math.abs(cadreDoigt.texel - cadreDefaut.texel * 2) < 1e-9);
  assert.equal(cadreDoigt.gauche, cadreDefaut.gauche);
});

test('les biais suivent le texel : un décollement de l’ordre du texel, jamais une constante', () => {
  const aspect = 1.6;
  for (const e of [etat(), etat({ distance: 5 }), etat({ distance: 45, lacet: 180 })]) {
    for (const soleil of [SOLEIL_ETE, LUNE_HIVER]) {
      const cadre = cadreOmbre(champVisibleAuSol(e, aspect), CARTE, soleil, e.cible, 2048);
      assert.ok(cadre.texel > 0);
      assert.ok(cadre.normalBias > cadre.texel && cadre.normalBias < cadre.texel * 3, 'normalBias : un à trois texels');
      assert.ok(cadre.bias < 0, 'bias négatif : il éloigne l’acné');
      // Ramené en unités de scène (le biais est en profondeur normalisée), c'est moins d'un texel.
      const enUnites = -cadre.bias * (cadre.far - cadre.near);
      assert.ok(enUnites > 0 && enUnites < cadre.texel, `bias : ${enUnites} pour un texel de ${cadre.texel}`);
      // Et très loin de la constante d'avant (0,13 unité), qui faisait flotter les figurines.
      assert.ok(enUnites < 0.02);
    }
  }
});

test('l’intersection de rectangles : vide quand ils ne se touchent pas', () => {
  const a = { minX: 0, maxX: 10, minZ: 0, maxZ: 10 };
  assert.deepEqual(intersectionSol(a, { minX: 5, maxX: 20, minZ: -5, maxZ: 5 }), { minX: 5, maxX: 10, minZ: 0, maxZ: 5 });
  assert.equal(intersectionSol(a, { minX: 12, maxX: 20, minZ: 0, maxZ: 10 }), null);
  assert.equal(intersectionSol(a, { minX: 0, maxX: 10, minZ: 10, maxZ: 12 }), null);
});
