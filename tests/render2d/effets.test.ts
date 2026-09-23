// Le pool d'effets, la planche, la secousse et les superpositions : une
// particule est une fonction de son âge, le pool ne dépasse jamais sa capacité
// et recycle le plus vieux, rien ne se pose hors de vue, et rien ne s'alloue
// d'une image à l'autre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Trace } from '../../src/render2d/aplats';
import { COS_TANGAGE, PIXELS_PAR_CASE, SIN_TANGAGE, versPlan } from '../../src/render2d/contrat';
import {
  CAPACITE_EFFETS, COTE_PLANCHE, DESSINS_EFFETS, directionEcran, ID_EFFET, IDS_FUMEE, IDS_GOUTTE, IDS_MISSILE, IDS_TRAIT,
  monterPlanche, PART_SOL, peindrePlanche, PoolEffets, rangerPlanche, SECOUSSE_MAX_PX, Secousse, Superposition,
} from '../../src/render2d/effets';
import type { Pose } from '../../src/render2d/lot';
import type { FabriqueToile } from '../../src/render2d/replis';
import type { Televerseur } from '../../src/render2d/atlas';
import type { Pinceau } from '../../src/render/sprites/formes';

/** Les poses du pool à cet instant, dans un tableau neuf. */
function poses(pool: PoolEffets, vu?: (x: number, y: number) => boolean): Pose[] {
  const sortie: Pose[] = [];
  pool.poses(sortie, vu);
  return sortie;
}

test('le pool ne dépasse jamais sa capacité, et recycle le plus vieux de sa réserve', () => {
  const pool = new PoolEffets(16);
  const sol = Math.round(16 * PART_SOL);
  const air = 16 - sol;
  const poignees: number[] = [];
  for (let i = 0; i < 40; i++) poignees.push(pool.emettre({ genre: 'etincelle', x: i, y: 0, duree: 1000 }));
  assert.equal(pool.vivants, air, 'les effets debout ne mangent pas la place du sol');
  // Les plus vieux ont été recyclés : leurs poignées sont mortes, les dernières vivent.
  assert.equal(pool.vivant(poignees[0]!), false);
  assert.equal(pool.vivant(poignees[39]!), true);
  assert.deepEqual(poses(pool).map((p) => p.instance.x).sort((a, b) => a - b), Array.from({ length: air }, (_, k) => 40 - air + k));
  // La réserve du sol est intacte : un anneau de capture trouve sa place.
  for (let i = 0; i < 10; i++) pool.emettre({ genre: 'anneau', x: 0, y: i, duree: 1000 });
  assert.equal(pool.vivants, air + sol);
  assert.equal(new PoolEffets().capacite, CAPACITE_EFFETS);
});

test('une poignée périmée n’éteint pas la particule qui a pris sa place', () => {
  const pool = new PoolEffets(4);
  const a = pool.emettre({ genre: 'eclair', x: 0, y: 0, duree: 100 });
  pool.avancer(200);
  assert.equal(pool.vivant(a), false, 'échue');
  const b = pool.emettre({ genre: 'eclair', x: 1, y: 0, duree: 100 });
  pool.liberer(a);
  assert.equal(pool.vivant(b), true);
  pool.liberer(b);
  assert.equal(pool.vivant(b), false);
  pool.liberer(b);
  assert.equal(pool.vivants, 0);
});

test('un projectile suit son trajet en cloche et arrive exactement à l’heure', () => {
  const pool = new PoolEffets(8);
  pool.emettre({ genre: 'obus', x: 1, y: 1, h: 0.3, vers: { x: 5, y: 1, h: 0.2 }, arc: 1, duree: 400 });
  const [debut] = poses(pool);
  assert.deepEqual([debut!.instance.x, debut!.instance.y, debut!.instance.h], [1, 1, 0.3]);
  pool.avancer(200);
  const [milieu] = poses(pool);
  assert.ok(Math.abs(milieu!.instance.x - 3) < 1e-9);
  assert.ok(Math.abs(milieu!.instance.h! - (0.25 + 1)) < 1e-9, 'le sommet de la cloche au milieu');
  pool.avancer(199);
  const [fin] = poses(pool);
  assert.ok(Math.abs(fin!.instance.x - 5) < 0.02 && Math.abs(fin!.instance.h! - 0.2) < 0.02, 'à la cible');
  pool.avancer(1);
  assert.equal(pool.vivants, 0, 'et il meurt en arrivant');
});

test('une particule libre suit sa vitesse, sa gravité, et glisse sur le sol', () => {
  const pool = new PoolEffets(8);
  pool.emettre({ genre: 'etincelle', x: 0, y: 0, h: 0.5, vx: 2, vh: 1, gravite: 8, sol: 0, duree: 1000 });
  pool.avancer(250);
  const [p] = poses(pool);
  assert.ok(Math.abs(p!.instance.x - 0.5) < 1e-9);
  assert.ok(Math.abs(p!.instance.h! - (0.5 + 0.25 - 4 * 0.0625)) < 1e-9);
  pool.avancer(500);
  assert.equal(poses(pool)[0]!.instance.h, 0, 'retombée, elle reste au sol');
  const amortie = new PoolEffets(8);
  amortie.emettre({ genre: 'fumee', x: 0, y: 0, vx: 1, amorti: 2, duree: 5000 });
  amortie.avancer(4000);
  assert.ok(poses(amortie)[0]!.instance.x < 0.5 + 1e-6, 'un amorti borne la course à v/k');
});

test('l’arrêt sur image : pendant la tenue, ni mouvement, ni fondu, ni changement de taille', () => {
  const pool = new PoolEffets(8);
  pool.emettre({ genre: 'etoile', x: 2, y: 2, vx: 3, tenue: 70, duree: 190, taille: 0.8, tailleFin: 0.2 });
  const t0 = poses(pool)[0]!.instance;
  const a = { x: t0.x, echelle: t0.echelle, opacite: t0.opacite };
  pool.avancer(69);
  const t1 = poses(pool)[0]!.instance;
  assert.deepEqual({ x: t1.x, echelle: t1.echelle, opacite: t1.opacite }, a);
  pool.avancer(31);
  const t2 = poses(pool)[0]!.instance;
  assert.ok(t2.x > 2 && (t2.echelle ?? 1) < 0.8 && (t2.opacite ?? 1) < 1, 'la tenue passée, elle vit');
});

test('un retard retient la particule ; montée et fondu bornent l’opacité', () => {
  const pool = new PoolEffets(8);
  pool.emettre({ genre: 'fumee', x: 0, y: 0, retard: 100, duree: 1000, opacite: 0.5, montee: 0.2, fin: 0.8 });
  assert.equal(poses(pool).length, 0);
  pool.avancer(100);
  assert.equal(poses(pool).length, 0, 'opacité nulle au départ d’une montée');
  pool.avancer(200);
  assert.ok(Math.abs(poses(pool)[0]!.instance.opacite! - 0.5) < 1e-9, 'au sommet, l’opacité demandée');
  pool.avancer(600);
  assert.ok(poses(pool)[0]!.instance.opacite! < 0.2);
});

test('rien ne se pose au-dessus d’une case cachée', () => {
  const pool = new PoolEffets(8);
  pool.emettre({ genre: 'eclair', x: 1.5, y: 1.5, duree: 100 });
  pool.emettre({ genre: 'eclair', x: 4.5, y: 1.5, duree: 100 });
  const vu = (x: number, y: number): boolean => x === 1 && y === 1;
  assert.deepEqual(poses(pool, vu).map((p) => p.instance.x), [1.5]);
});

test('une image par cap pour ce qui s’oriente, trois bouffées pour la fumée', () => {
  assert.equal(directionEcran(1, 0), 0);
  assert.equal(directionEcran(0, 1), 4, 'vers le bas de l’écran');
  assert.equal(directionEcran(-1, 0), 8);
  assert.equal(directionEcran(0, -1), 12);
  const pool = new PoolEffets(8);
  pool.emettre({ genre: 'trait', x: 0, y: 0, vers: { x: 4, y: 0 }, duree: 100 });
  // Qui tombe du ciel vers une case : sa hauteur baisse, il file vers le bas de l'écran.
  pool.emettre({ genre: 'missile', x: 0, y: 0, h: 3, vers: { x: 0, y: 0, h: 0 }, duree: 100 });
  pool.emettre({ genre: 'fumee', x: 0, y: 0, variante: 4, duree: 100 });
  // La fumée monte en opacité : à son premier instant, elle ne se voit pas encore.
  pool.avancer(50);
  const ids = poses(pool).map((p) => p.instance.entree).sort();
  assert.deepEqual(ids, [IDS_FUMEE[1], IDS_MISSILE[4], IDS_TRAIT[0]].sort());
  // Un cap d'écran compte la hauteur : versPlan, la projection du jeu.
  const a = versPlan(0, 0, 3);
  const b = versPlan(0, 0, 0);
  assert.equal(directionEcran(b.X - a.X, b.Y - a.Y), 4);
  assert.ok(COS_TANGAGE > 0 && SIN_TANGAGE > 0);
});

test('aucune allocation d’une image à l’autre : les poses sont les mêmes objets, réécrits', () => {
  const pool = new PoolEffets(8);
  pool.emettre({ genre: 'etincelle', x: 0, y: 0, vx: 1, duree: 500 });
  const premiere = poses(pool)[0]!;
  const instance = premiere.instance;
  pool.avancer(100);
  const seconde = poses(pool)[0]!;
  assert.equal(seconde, premiere);
  assert.equal(seconde.instance, instance);
  assert.ok(seconde.instance.x > 0);
});

test('couper éteint tout ; un pool vide n’est plus actif', () => {
  const pool = new PoolEffets(8);
  for (let i = 0; i < 5; i++) pool.emettre({ genre: 'poussiere', x: i, y: 0, duree: 2000 });
  assert.equal(pool.actif(), true);
  pool.couper();
  assert.equal(pool.actif(), false);
  assert.equal(poses(pool).length, 0);
});

test('un effet couché se peint sous les unités, un effet debout au-dessus', () => {
  const pool = new PoolEffets(8);
  pool.emettre({ genre: 'anneau', x: 0, y: 0, duree: 100 });
  pool.emettre({ genre: 'eclair', x: 0, y: 0, duree: 100 });
  pool.emettre({ genre: 'poussiere', x: 0, y: 0, duree: 100, plat: true });
  pool.avancer(40);
  const calques = poses(pool).map((p) => `${p.instance.entree}:${p.calque}`).sort();
  assert.deepEqual(calques, [`${ID_EFFET.anneau}:ombres_unites`, `${ID_EFFET.eclair}:effets`, `${ID_EFFET.poussiere}:ombres_unites`].sort());
});

// --- La planche ---------------------------------------------------------------

/** Un pinceau qui ne peint rien et note les découpes. */
function pinceauMuet(): { g: Pinceau; decoupes: number; peints: number } {
  const etat = { decoupes: 0, peints: 0 };
  const g = new Proxy({} as Record<string, unknown>, {
    get: (_c, nom) => {
      if (nom === 'createLinearGradient' || nom === 'createRadialGradient') return () => ({ addColorStop: () => undefined });
      if (nom === 'clip') return () => { etat.decoupes += 1; };
      if (nom === 'fill' || nom === 'stroke' || nom === 'fillRect' || nom === 'strokeRect') return () => { etat.peints += 1; };
      return () => undefined;
    },
    set: () => true,
  }) as unknown as Pinceau;
  return { g, get decoupes() { return etat.decoupes; }, get peints() { return etat.peints; } };
}

test('la planche range tous les dessins sans chevauchement, dans ses bords', () => {
  const placements = rangerPlanche();
  assert.equal(placements.length, DESSINS_EFFETS.length);
  const ids = new Set(placements.map((p) => p.dessin.id));
  assert.equal(ids.size, DESSINS_EFFETS.length, 'des identifiants uniques');
  for (const id of [...Object.values(ID_EFFET), ...IDS_FUMEE, ...IDS_TRAIT, ...IDS_MISSILE, ...IDS_GOUTTE]) assert.ok(ids.has(id), id);
  for (const a of placements) {
    assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.dessin.l <= COTE_PLANCHE && a.y + a.dessin.h <= COTE_PLANCHE, a.dessin.id);
    for (const b of placements) {
      if (a === b) continue;
      const libre = a.x + a.dessin.l <= b.x || b.x + b.dessin.l <= a.x || a.y + a.dessin.h <= b.y || b.y + b.dessin.h <= a.y;
      assert.ok(libre, `${a.dessin.id} chevauche ${b.dessin.id}`);
    }
  }
  assert.throws(() => rangerPlanche(DESSINS_EFFETS, 64), /pleine/);
});

test('la planche se peint une fois, chaque dessin découpé dans sa case, et se résout par identifiant', () => {
  const muet = pinceauMuet();
  let toiles = 0;
  const fabrique: FabriqueToile = (l, h) => {
    toiles += 1;
    assert.deepEqual([l, h], [COTE_PLANCHE, COTE_PLANCHE]);
    return { toile: {} as never, g: muet.g };
  };
  const peinte = peindrePlanche(fabrique);
  assert.ok(peinte);
  assert.equal(toiles, 1, 'une seule toile');
  assert.equal(muet.decoupes, DESSINS_EFFETS.length, 'chaque dessin reste dans sa case');
  assert.ok(muet.peints >= DESSINS_EFFETS.length, 'et chacun peint quelque chose');
  const creees: unknown[] = [];
  const televerseur: Televerseur = {
    creer: (source, l, h, o) => { creees.push({ l, h, o }); return {} as WebGLTexture; },
    poser: () => undefined,
    supprimer: () => undefined,
  };
  const planche = monterPlanche(televerseur, fabrique);
  assert.ok(planche);
  assert.deepEqual(creees, [{ l: COTE_PLANCHE, h: COTE_PLANCHE, o: { premultiplier: true } }], 'un seul téléversement, prémultiplié');
  const eclair = planche!.resoudre({ entree: ID_EFFET.eclair, animation: -1, cadre: 0, x: 0, y: 0 });
  assert.ok(eclair && eclair.u1 > eclair.u0 && eclair.v1 > eclair.v0);
  assert.equal(eclair!.l * eclair!.echelle, PIXELS_PAR_CASE, 'un éclair vaut une case à l’échelle 1');
  assert.equal(planche!.resoudre({ entree: 'unite_char_leger_base', animation: -1, cadre: 0, x: 0, y: 0 }), null);
  assert.equal(monterPlanche(televerseur, () => null), null, 'sans toile, pas de planche — et le jeu continue');
});

// --- La secousse ----------------------------------------------------------------

test('la secousse s’amortit : enveloppe bornée à 4 px, décroissante, nulle au bout', () => {
  const s = new Secousse();
  s.lancer(12, 240);
  assert.equal(s.enveloppe(), SECOUSSE_MAX_PX, 'bornée');
  let avant = s.enveloppe();
  let max = 0;
  for (let t = 0; t < 240; t += 10) {
    const d = s.decalage();
    max = Math.max(max, Math.hypot(d.x, d.y));
    s.avancer(10);
    const e = s.enveloppe();
    assert.ok(e <= avant + 1e-12, 'l’enveloppe ne remonte jamais');
    avant = e;
  }
  assert.ok(max > 2 && max <= SECOUSSE_MAX_PX * Math.hypot(1, 0.7) + 1e-9, `${max}`);
  s.avancer(10);
  assert.equal(s.active(), false);
  assert.deepEqual({ ...s.decalage() }, { x: 0, y: 0 });
});

test('une secousse attend son retard ; une plus faible n’interrompt pas une plus forte', () => {
  const s = new Secousse();
  s.lancer(3, 200, 70);
  assert.equal(s.active(), true, 'elle attend');
  assert.equal(s.enveloppe(), 0, 'rien avant le retard : l’arrêt sur image est immobile');
  s.avancer(69);
  assert.equal(s.enveloppe(), 0);
  s.avancer(1);
  assert.equal(s.enveloppe(), 3);
  s.lancer(2, 200);
  assert.equal(s.enveloppe(), 3, 'absorbée');
  s.lancer(4, 200);
  assert.equal(s.enveloppe(), 4, 'la plus forte l’emporte');
  s.couper();
  assert.equal(s.active(), false);
  s.lancer(0, 100);
  s.lancer(2, 0);
  assert.equal(s.active(), false, 'rien de nul ne se lance');
});

// --- Les superpositions -----------------------------------------------------------

test('l’éclat d’un pouvoir monte vite, redescend, et s’éteint', () => {
  const s = new Superposition();
  s.eclater([1, 0.9, 0.8], 0.5, 600);
  assert.equal(s.alphaEclat(), 0);
  s.avancer(60);
  assert.ok(Math.abs(s.alphaEclat() - 0.5) < 1e-9, 'au sommet en soixante millisecondes');
  s.avancer(300);
  const milieu = s.alphaEclat();
  assert.ok(milieu > 0 && milieu < 0.5);
  s.avancer(240);
  assert.equal(s.active(), false);
  assert.equal(s.alphaEclat(), 0);
});

test('une vague de teinte part de son centre, grandit sans reculer, et couvre son rayon', () => {
  const s = new Superposition();
  s.vague(3.5, 2.5, [0.2, 0.4, 1], 10, 1000, 100);
  assert.equal(s.rayonVague(0), null, 'pas avant son retard');
  let avant = 0;
  for (let t = 0; t < 1000; t += 50) {
    s.avancer(50);
    const r = s.rayonVague(0);
    if (r === null) continue;
    assert.ok(r >= avant - 1e-9);
    avant = r;
  }
  assert.ok(avant > 9.9 && avant <= 10);
  const trace = new Trace();
  const triangles = s.tracer(trace, { minX: 0, minY: 0, maxX: 100, maxY: 100 });
  assert.ok(triangles > 0);
  // Le front est une couronne autour du centre, dans la projection du jeu.
  const centre = versPlan(3.5, 2.5, 0);
  let loin = 0;
  for (let i = 0; i < trace.sommets; i++) loin = Math.max(loin, Math.abs(trace.donnees[i * 6]! - centre.X));
  assert.ok(Math.abs(loin - avant * PIXELS_PAR_CASE) < 1, 'le rayon du front, en pixels de plan');
  s.couper();
  assert.equal(s.active(), false);
  const vide = new Trace();
  assert.equal(s.tracer(vide, { minX: 0, minY: 0, maxX: 1, maxY: 1 }), 0);
});
