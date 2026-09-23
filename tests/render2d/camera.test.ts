// La caméra de la peau 2D : un décalage et un agrandissement du plan, rien
// d'autre. Ce qu'on vérifie ici est ce que le HUD et les tests de fumée
// supposent : `versEcran` et `versMonde` se répondent au pixel près, la vue ne
// quitte jamais la carte, le zoom reste lisible, et un cadrage fait ce qu'il dit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bornerCentre, creerCamera2d, ecranVersPlan, empriseCarte, JEU_BORDS, matricePlanVersDecoupe,
  MS_TRANSITION, PIXELS_DOUBLE_TAP, planVersEcran, ZOOM_MAX, ZOOM_MIN, zoomPourPixels,
} from '../../src/render2d/camera';
import { PIXELS_PAR_CASE, SIN_TANGAGE, versPlan } from '../../src/render2d/contrat';

function camera(largeur = 20, hauteur = 14, vue = { l: 1280, h: 800 }) {
  const c = creerCamera2d(largeur, hauteur);
  c.redimensionner(vue.l, vue.h);
  c.cadrerCarte();
  return c;
}

/** Le centre d'une case à l'écran, par la caméra. */
function ecranDe(c: ReturnType<typeof camera>, x: number, y: number) {
  const p = versPlan(x + 0.5, y + 0.5, 0);
  return c.versEcran(p.X, p.Y);
}

test('écran → plan → écran est l’identité, et le centre d’une case retombe sur elle', () => {
  const c = camera();
  for (const [x, y] of [[0, 0], [640, 400], [13.5, 777.25], [1279, 1]] as const) {
    const p = c.versPlan(x, y);
    const e = c.versEcran(p.X, p.Y);
    assert.ok(Math.abs(e.x - x) < 1e-9 && Math.abs(e.y - y) < 1e-9, `${x},${y}`);
  }
  for (const [x, y] of [[0, 0], [7, 3], [19, 13], [10, 6]] as const) {
    const e = ecranDe(c, x, y);
    assert.deepEqual(c.caseSous(e.x, e.y), { x, y }, `case ${x},${y}`);
  }
  // Et les fonctions pures disent la même chose que la caméra.
  const p = ecranVersPlan(c.etat, c.vue, 321, 123);
  const e = planVersEcran(c.etat, c.vue, p.X, p.Y);
  assert.ok(Math.abs(e.x - 321) < 1e-9 && Math.abs(e.y - 123) < 1e-9);
});

test('hors de la carte, il n’y a pas de case', () => {
  const c = camera(12, 10);
  // On dézoome au plus loin : la carte entière tient, le bord de l'écran est hors carte.
  c.facteurZoom(0.01);
  assert.equal(c.caseSous(0, 0), null);
  assert.equal(c.caseSous(1279, 799), null);
});

test('la matrice de découpe envoie le centre de la vue en (0, 0) et le coin haut-gauche en (−1, 1)', () => {
  const c = camera();
  const m = matricePlanVersDecoupe(c.etat, c.vue, new Float32Array(9));
  const vers = (X: number, Y: number) => ({ x: m[0]! * X + m[3]! * Y + m[6]!, y: m[1]! * X + m[4]! * Y + m[7]! });
  const centre = vers(c.etat.cx, c.etat.cy);
  assert.ok(Math.abs(centre.x) < 1e-5 && Math.abs(centre.y) < 1e-5);
  const coin = c.versPlan(0, 0);
  const d = vers(coin.X, coin.Y);
  assert.ok(Math.abs(d.x + 1) < 1e-5 && Math.abs(d.y - 1) < 1e-5);
});

test('le zoom reste entre 48 et 200 pixels d’écran par case', () => {
  const c = camera();
  c.facteurZoom(100);
  assert.equal(c.etat.zoom, ZOOM_MAX);
  assert.equal(c.etat.zoom * PIXELS_PAR_CASE, 200);
  c.facteurZoom(0.0001);
  assert.equal(c.etat.zoom, ZOOM_MIN);
  assert.equal(c.etat.zoom * PIXELS_PAR_CASE, 48);
});

test('un pincement garde fixe le point pincé', () => {
  const c = camera(30, 30);
  const ancre = { x: 300, y: 500 };
  const avant = c.versPlan(ancre.x, ancre.y);
  c.facteurZoom(1.3, ancre);
  const apres = c.versPlan(ancre.x, ancre.y);
  assert.ok(Math.abs(avant.X - apres.X) < 1e-6 && Math.abs(avant.Y - apres.Y) < 1e-6);
});

test('un pas de zoom se joue en transition, et quatre pas en font quatre', () => {
  const c = camera(30, 30);
  const depart = c.etat.zoom;
  c.zoomer(1);
  c.zoomer(1);
  assert.equal(c.etat.zoom, depart, 'rien ne saute avant que la boucle avance');
  assert.ok(c.enMouvement());
  c.avancer(MS_TRANSITION);
  assert.ok(Math.abs(c.etat.zoom - Math.min(ZOOM_MAX, depart * 1.25 * 1.25)) < 1e-9);
  assert.equal(c.enMouvement(), false);
});

test('la vue ne s’éloigne jamais de plus d’une case et quart au-delà d’un bord', () => {
  const c = camera(40, 30);
  c.facteurZoom(10);
  c.glisser(1e6, 1e6);
  const e = empriseCarte(40, 30);
  const coin = c.versPlan(0, 0);
  assert.ok(coin.X >= e.minX - JEU_BORDS * PIXELS_PAR_CASE - 1e-6, 'bord gauche');
  assert.ok(coin.Y >= e.minY - JEU_BORDS * PIXELS_PAR_CASE * SIN_TANGAGE - 1e-6, 'bord haut');
  c.glisser(-1e7, -1e7);
  const fin = c.versPlan(c.vue.largeur, c.vue.hauteur);
  assert.ok(fin.X <= e.maxX + JEU_BORDS * PIXELS_PAR_CASE + 1e-6, 'bord droit');
  assert.ok(fin.Y <= e.maxY + JEU_BORDS * PIXELS_PAR_CASE * SIN_TANGAGE + 1e-6, 'bord bas');
});

test('une carte plus petite que la vue se centre, quoi qu’on fasse', () => {
  const e = empriseCarte(4, 3);
  const etat = { cx: 9999, cy: -9999, zoom: ZOOM_MIN };
  bornerCentre(etat, e, { largeur: 2000, hauteur: 2000 });
  assert.equal(etat.cx, (e.minX + e.maxX) / 2);
  assert.equal(etat.cy, (e.minY + e.maxY) / 2);
});

test('le cadrage d’ouverture montre la carte entière quand elle tient, sinon porte la vue vers l’action', () => {
  const petite = camera(12, 10);
  for (const [x, y] of [[0, 0], [11, 9]] as const) {
    const p = ecranDe(petite, x, y);
    assert.ok(p.x > 0 && p.x < 1280 && p.y > 0 && p.y < 800, `case ${x},${y} visible`);
  }
  // Une grande carte en portrait : la largeur tient, la vue se porte vers la case demandée.
  const grande = creerCamera2d(30, 60);
  grande.redimensionner(390, 844);
  grande.cadrerCarte({ x: 15, y: 50 });
  const cible = ecranDe(grande, 15, 50);
  assert.ok(cible.y > 0 && cible.y < 844, 'la case d’action est à l’écran');
  assert.ok(grande.etat.zoom >= ZOOM_MIN);
});

test('cadrer une case déjà bien dans le champ ne bouge rien ; hors champ, elle vient', () => {
  const c = camera(60, 60);
  c.facteurZoom(4);
  const avant = { ...c.etat };
  const centre = c.caseSous(640, 400)!;
  c.cadrerCase(centre);
  assert.deepEqual({ ...c.etat }, avant);
  c.cadrerCase({ x: 59, y: 59 });
  const p = ecranDe(c, 59, 59);
  assert.ok(p.x > 0 && p.x < 1280 && p.y > 0 && p.y < 800);
});

test('le double-tap rapproche à 96 pixels par case au moins et centre la case', () => {
  const c = camera(40, 40);
  c.facteurZoom(0.0001);
  c.viser({ x: 20, y: 20 });
  c.avancer(MS_TRANSITION);
  assert.ok(Math.abs(c.etat.zoom - zoomPourPixels(PIXELS_DOUBLE_TAP)) < 1e-9);
  const p = ecranDe(c, 20, 20);
  assert.ok(Math.abs(p.x - 640) < 1 && Math.abs(p.y - 400) < 1);
});

test('la vue retenue revient, sauf si le joueur a lui-même bougé la caméra', () => {
  const c = camera(60, 60);
  c.facteurZoom(3);
  const retenue = { ...c.etat };
  c.retenirVue();
  c.cadrerCase({ x: 59, y: 59 });
  assert.notDeepEqual({ ...c.etat }, retenue);
  assert.equal(c.revenirVue(), true);
  c.avancer(MS_TRANSITION);
  assert.ok(Math.abs(c.etat.cx - retenue.cx) < 1e-6 && Math.abs(c.etat.cy - retenue.cy) < 1e-6);

  c.retenirVue();
  c.cadrerCase({ x: 0, y: 0 });
  c.glisser(40, 0);
  assert.equal(c.revenirVue(), false, 'un geste voulu efface le retour');
});

test('l’inertie s’amortit, et s’arrête net contre un bord', () => {
  const c = camera(80, 80);
  c.facteurZoom(4);
  c.lancer(2, 0);
  const x0 = c.etat.cx;
  c.avancer(16);
  assert.ok(c.etat.cx < x0, 'glisser vers la droite fait aller la carte vers la droite');
  for (let i = 0; i < 400 && c.enMouvement(); i++) c.avancer(16);
  assert.equal(c.enMouvement(), false, 'l’inertie finit');
  // Lancée contre le bord gauche : elle s'y arrête au lieu de pousser.
  c.lancer(1000, 0);
  c.avancer(16);
  c.avancer(16);
  assert.equal(c.enMouvement(), false);
});

test('sous animations réduites, une transition arrive d’un coup et l’inertie ne glisse pas', () => {
  const c = camera(40, 40);
  c.zoomer(1);
  c.avancer(1, true);
  assert.equal(c.enMouvement(), false);
  c.lancer(3, 3);
  const avant = { ...c.etat };
  c.avancer(16, true);
  assert.deepEqual({ ...c.etat }, avant);
});

test('redimensionner garde la taille des cases à l’écran', () => {
  const c = camera(40, 40);
  c.facteurZoom(2);
  const z = c.etat.zoom;
  c.redimensionner(390, 844);
  assert.equal(c.etat.zoom, z);
});
