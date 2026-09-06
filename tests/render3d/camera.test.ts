// La caméra 3D et le chemin d'animation : les deux morceaux de géométrie qui se
// vérifient sans WebGL. Le brief fixe le cadre — tangage 60° à 75°, lacet par
// quarts de tour, zoom par paliers, carte cadrée au montage, jamais perdue — et
// c'est exactement ce que ce fichier surveille.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  FOV, PALIERS_DISTANCE, TANGAGE_DEFAUT, TANGAGE_MAX, TANGAGE_MIN,
  creerVue3d, deplacerCible, distanceCadrage, distanceLisible, limiterCible, palierDistance, palierSuivant, positionCamera,
  type EtatCamera,
} from '../../src/render3d/camera';
import { cheminEnL, longueurChemin, surChemin } from '../../src/render/chemin';

function etat(p: Partial<EtatCamera> = {}): EtatCamera {
  return {
    cible: { x: 8, z: 6 }, distance: 18, tangage: TANGAGE_DEFAUT, lacet: 0, ...p,
  };
}

test('le tangage par défaut tient dans la fourchette du brief', () => {
  assert.equal(TANGAGE_MIN, 60);
  assert.equal(TANGAGE_MAX, 75);
  assert.ok(TANGAGE_DEFAUT >= TANGAGE_MIN && TANGAGE_DEFAUT <= TANGAGE_MAX);
  assert.equal(TANGAGE_DEFAUT, 68);
});

test('la caméra se place au-dessus et en arrière de sa cible', () => {
  const p = positionCamera(etat());
  assert.ok(p.y > 0, 'la caméra est en l’air');
  // À 68°, la hauteur domine largement l'écart au sol : c'est une vue de dessus.
  const auSol = Math.hypot(p.x - 8, p.z - 6);
  assert.ok(p.y > auSol * 2, 'vue de dessus, pas vue à hauteur d’homme');
  assert.ok(Math.abs(Math.hypot(auSol, p.y) - 18) < 1e-9, 'la distance est respectée');
  // Lacet 0 : la caméra est au sud de la cible et regarde vers le nord.
  assert.ok(Math.abs(p.x - 8) < 1e-9);
  assert.ok(p.z > 6);
  // Un quart de tour la fait passer à l'est, sans changer ni hauteur ni distance.
  const tourne = positionCamera(etat({ lacet: 90 }));
  assert.ok(Math.abs(tourne.y - p.y) < 1e-9);
  assert.ok(tourne.x > 8 && Math.abs(tourne.z - 6) < 1e-9);
});

test('le cadrage automatique fait tenir la carte, quel que soit le format', () => {
  for (const [l, h] of [[16, 12], [24, 24], [40, 20], [8, 30]] as const) {
    for (const aspect of [0.6, 1, 1.78, 2.4]) {
      const d = distanceCadrage(l, h, aspect);
      const demiFov = Math.tan((FOV * Math.PI) / 360);
      const largeurVue = 2 * d * demiFov * aspect;
      const profondeurVue = (2 * d * demiFov) / Math.sin((TANGAGE_DEFAUT * Math.PI) / 180);
      assert.ok(largeurVue >= l, `${l}×${h} @${aspect} : la largeur ne tient pas`);
      assert.ok(profondeurVue >= h, `${l}×${h} @${aspect} : la profondeur ne tient pas`);
    }
  }
  // Une carte plus grande demande de reculer.
  assert.ok(distanceCadrage(40, 40, 1.6) > distanceCadrage(16, 12, 1.6));
});

test('le zoom avance de palier en palier et s’arrête aux extrémités', () => {
  const min = PALIERS_DISTANCE[0];
  const max = PALIERS_DISTANCE[PALIERS_DISTANCE.length - 1] ?? 0;
  assert.ok(min < max);
  for (const p of PALIERS_DISTANCE) assert.equal(palierDistance(p), p);
  assert.equal(palierDistance(min - 100), min);
  assert.equal(palierDistance(max + 100), max);
  // `+1` rapproche, `-1` éloigne, et on ne sort jamais de la liste.
  assert.ok(palierSuivant(PALIERS_DISTANCE[3] ?? 13, 1) < (PALIERS_DISTANCE[3] ?? 13));
  assert.ok(palierSuivant(PALIERS_DISTANCE[3] ?? 13, -1) > (PALIERS_DISTANCE[3] ?? 13));
  assert.equal(palierSuivant(min, 1), min);
  assert.equal(palierSuivant(max, -1), max);
});

test('les bornes gardent la carte à l’écran et le lacet sur ses quarts de tour', () => {
  const carte = { largeur: 16, hauteur: 12 };
  const e = limiterCible(etat({ cible: { x: 900, z: -900 }, tangage: 120, lacet: 47 }), carte);
  assert.ok(e.cible.x <= 16 + 1.5 && e.cible.x >= -1.5);
  assert.ok(e.cible.z <= 12 + 1.5 && e.cible.z >= -1.5);
  assert.equal(e.tangage, TANGAGE_MAX);
  assert.equal(e.lacet, 90, 'le lacet retombe sur un quart de tour');
  assert.equal(limiterCible(etat({ lacet: -90 }), carte).lacet, 270);
  assert.equal(limiterCible(etat({ tangage: 10 }), carte).tangage, TANGAGE_MIN);
  assert.equal(limiterCible(etat({ distance: 1e6 }), carte).distance, PALIERS_DISTANCE[PALIERS_DISTANCE.length - 1]);
});

test('le glisser suit le lacet : tirer vers la droite tire toujours la carte', () => {
  const a = deplacerCible(etat(), 100, 0, 600);
  assert.ok(a.cible.x < 8, 'lacet 0 : le glisser agit sur X');
  const b = deplacerCible(etat({ lacet: 90 }), 100, 0, 600);
  assert.ok(Math.abs(b.cible.x - 8) < 1e-6, 'lacet 90 : X ne bouge plus');
  assert.ok(b.cible.z > 6, 'lacet 90 : c’est Z qui prend le glisser');
  // Plus on est loin, plus un même glisser couvre de terrain.
  const proche = deplacerCible(etat({ distance: 6 }), 100, 0, 600);
  const loin = deplacerCible(etat({ distance: 30 }), 100, 0, 600);
  assert.ok(Math.abs(loin.cible.x - 8) > Math.abs(proche.cible.x - 8));
});

test('le chemin d’animation suit la grille et s’oriente dans le bon sens', () => {
  const pas = cheminEnL({ x: 2, y: 3 }, { x: 5, y: 1 });
  assert.deepEqual(pas, [{ x: 2, y: 3 }, { x: 5, y: 3 }, { x: 5, y: 1 }]);
  assert.equal(longueurChemin(pas), 5);
  // Aux extrémités, on est exactement sur les cases de départ et d'arrivée.
  const debut = surChemin(pas, 0);
  assert.equal(debut.x, 2);
  assert.equal(debut.y, 3);
  const fin = surChemin(pas, 1);
  assert.equal(fin.x, 5);
  assert.equal(fin.y, 1);
  // À 3/5, on vient de finir le segment horizontal.
  const milieu = surChemin(pas, 0.6);
  assert.ok(Math.abs(milieu.x - 5) < 1e-9);
  assert.ok(Math.abs(milieu.y - 3) < 1e-9);
  // Le cap regarde vers l'est sur le premier segment, vers le nord sur le second.
  assert.ok(Math.abs(surChemin(pas, 0.2).cap) < 1e-9);
  assert.ok(Math.abs(surChemin(pas, 0.9).cap - Math.PI / 2) < 1e-9);
  // Un déplacement nul ne fait pas bouger et ne divise pas par zéro.
  const surplace = cheminEnL({ x: 4, y: 4 }, { x: 4, y: 4 });
  assert.equal(longueurChemin(surplace), 0);
  assert.deepEqual(surChemin(surplace, 0.5), { x: 4, y: 4, cap: 0 });
  // La progression est bornée : au-delà de 1, on reste à l'arrivée.
  assert.equal(surChemin(pas, 4).x, 5);
});


test('sur téléphone, le cadrage initial conserve des cases proches et le recul reste borné', () => {
  for (const [largeur, hauteur] of [[390, 844], [844, 390], [320, 568], [1280, 720]]) {
    const vue = creerVue3d({ largeur: 24, hauteur: 24 });
    vue.redimensionner(largeur!, hauteur!);
    vue.cadrerCarte();
    assert.ok(vue.etat.distance <= distanceLisible(hauteur!, 64));
    for (let i = 0; i < 20; i++) vue.zoomer(-1);
    assert.ok(vue.etat.distance <= distanceLisible(hauteur!), 'le plateau ne devient pas miniature');
    vue.facteurZoom(0.01);
    assert.ok(vue.etat.distance <= distanceLisible(hauteur!), 'la borne vaut aussi pour le pincement');
  }
});

test('un changement portrait/paysage recalcule la borne sans perdre la cible', () => {
  const vue = creerVue3d({ largeur: 24, hauteur: 24 });
  vue.redimensionner(390, 844);
  vue.cadrerCarte();
  vue.centrerCase({ x: 5, y: 9 });
  vue.redimensionner(844, 390);
  assert.ok(vue.etat.distance <= distanceLisible(390));
  assert.deepEqual(vue.etat.cible, { x: 5.5, z: 9.5 });
});

test('le pincement conserve le point du plateau sous son ancre', () => {
  const vue = creerVue3d({ largeur: 24, hauteur: 24 });
  vue.redimensionner(390, 844);
  vue.cadrerCarte();
  const ancre = { x: 280, y: 460 };
  const avant = vue.caseSous(ancre.x, ancre.y, null);
  vue.facteurZoom(1.6, ancre);
  assert.deepEqual(vue.caseSous(ancre.x, ancre.y, null), avant);
});

test('le tablier d’un pont est interrogé avant le sol : le clic tombe sur le pont, pas dans le lit', () => {
  // Deux cibles : un « sol » creusé sous la case (2, 2) et un « tablier » plus
  // haut au même endroit. Vu de biais, le rayon qui vise le tablier traverserait
  // le lit une case plus loin : c'est le décalage de clic qu'on corrige.
  const vue = creerVue3d({ largeur: 6, hauteur: 6 });
  vue.redimensionner(800, 600);
  vue.cadrerCarte();
  vue.centrerCase({ x: 2, y: 2 });
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2).translate(3, -0.25, 3));
  const tablier = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(2.5, 0.05, 2.5));
  const ecran = vue.versEcran(new THREE.Vector3(2.5, 0.05, 2.5));
  assert.ok(ecran);
  assert.deepEqual(vue.caseSous(ecran.x, ecran.y, [tablier, sol]), { x: 2, y: 2 });
  assert.deepEqual(vue.caseSous(ecran.x, ecran.y, [sol, tablier]), { x: 2, y: 2 }, 'l’ordre des cibles ne compte pas');
  assert.deepEqual(vue.caseSous(ecran.x, ecran.y, tablier), { x: 2, y: 2 });
});
