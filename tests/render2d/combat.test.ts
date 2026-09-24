// L'écran de combat de la peau 2D : deux formations, une figurine par PV
// affiché, les pertes à l'impact, la chronologie de la partition. Il n'y a ni
// DOM ni WebGL ici : un document factice reçoit les bandes du décor, et un
// `ouvrirEncart` factice garde les encarts. Le temps de la scène n'avance que
// par `avancer`, comme le HUD le fait : c'est l'horloge de papier du duel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ambiance } from '../../src/render/ambiance';
import { DUREES, MISE_EN_SCENE } from '../../src/render/partition';
import { FLOTTANTS_SOMMET, Trace } from '../../src/render2d/aplats';
import {
  arbreDuBiome, chronologieDuel, clipsProfil, couleurCiel, COULEUR_SEPARATION, decorDeCase, disposerCombat, ecartTireurs,
  effectifsAu, figurines, HAUTEUR_FIGURE, LARGEUR_FIGURE, MAX_FIGURINES, ouvrirCombat2d, PART_HORIZON,
  PIED_FIGURE, profilTir2d, SEPARATION,
  type Combat2d, type DependancesCombat2d, type Duel, type GabaritFormation,
} from '../../src/render2d/combat';
import { ARBRES } from '../../src/render2d/sol/decor';
import { aspectBatiment, posesBatiments, TEINTE_DESAFFECTE } from '../../src/render2d/batiments';
import { COS_TANGAGE, ECUME_NAVIRE, PIXELS_PAR_CASE, SIN_TANGAGE, type EntreeSprite } from '../../src/render2d/contrat';
import { terrainLogique } from '../../src/engine/index';
import { FORMES } from '../../src/render2d/replis';
import type { EncartSprites } from '../../src/render2d/index';
import type { Pose } from '../../src/render2d/lot';
import type { Rvb } from '../../src/render2d/unites';
import type { Ambiance } from '../../src/render/ambiance';
import type { CampId, CleTerrain, CleUnite } from '../../src/schemas/types';
import { CAT, partiePersonnalisee } from '../engine/aides';

// ---------------------------------------------------------------------------
// Le banc du test
// ---------------------------------------------------------------------------

class FauxElement {
  children: FauxElement[] = [];
  parent: FauxElement | null = null;
  dataset: Record<string, string> = {};
  attributs = new Map<string, string>();
  style: Record<string, string> = {};
  clientWidth = 0;
  clientHeight = 0;
  constructor(readonly ownerDocument: FauxDocument) {}
  setAttribute(k: string, v: string): void { this.attributs.set(k, v); }
  appendChild(e: FauxElement): FauxElement {
    e.parent = this;
    this.children.push(e);
    return e;
  }
  remove(): void {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((e) => e !== this);
    this.parent = null;
  }
}

class FauxDocument {
  createElement(): FauxElement {
    return new FauxElement(this);
  }
}

/** Un duel : l'attaquant en (2, 3), la cible en (3, 3). */
function unDuel(o: {
  a?: [number, number]; c?: [number, number]; riposte?: boolean; duree?: number; typeA?: CleUnite; typeC?: CleUnite;
} = {}): Duel {
  const [a0, a1] = o.a ?? [10, 8];
  const [c0, c1] = o.c ?? [10, 6];
  return {
    genre: 'duel',
    attaquant: { unite: 'u_a', type: o.typeA ?? 'infanterie', camp: 0, case: { x: 2, y: 3 }, pvAvant: a0, pvApres: a1 },
    cible: { unite: 'u_c', type: o.typeC ?? 'infanterie', camp: 1, case: { x: 3, y: 3 }, pvAvant: c0, pvApres: c1 },
    riposte: o.riposte ?? true,
    debut: 0,
    duree: o.duree ?? DUREES.duel,
  };
}

/** Les index des animations d'une entrée cuite de test. */
const PROFIL = { repos: 1, tir: 2, touche: 3, hors_jeu: 4 } as const;

/** Une entrée cuite : une vue de trois quarts, et (par défaut) les quatre clips de profil. */
function entreeCuite(id: string, profil: 'tous' | 'aucun' | 'repos_seul' = 'tous'): EntreeSprite {
  const cadres = (n: number) => Array.from({ length: n }, (_, i) => ({ page: 0, x: i * 12, y: 0, l: 10, h: 10, px: 5, py: 9 }));
  const vues: EntreeSprite['animations'] = [{ vue: 'droite', clip: 'repos', boucle: true, ips: 12, cadres: cadres(2) }];
  if (profil !== 'aucun') vues.push({ vue: 'profil', clip: 'repos', boucle: true, ips: 12, cadres: cadres(4) });
  if (profil === 'tous') {
    vues.push(
      { vue: 'profil', clip: 'tir', boucle: false, ips: 12, cadres: cadres(3) },
      { vue: 'profil', clip: 'touche', boucle: false, ips: 12, cadres: cadres(3) },
      { vue: 'profil', clip: 'hors_jeu', boucle: false, ips: 12, cadres: cadres(4) },
    );
  }
  return {
    id, famille: 'unite', cle: 'infanterie', source: { fichier: 'x.glb', sha256: 'x' },
    pages: [{ couleur: 'assets/sprites/unites/x_0.webp', largeur: 256, hauteur: 256 }],
    animations: vues,
  };
}

interface Essai {
  combat: Combat2d;
  duel: Duel;
  hote: FauxElement;
  ouverts: Set<EncartSprites>;
  ordre: EncartSprites[];
  salis(): number;
  scene: EncartSprites;
  /** Avance le duel jusqu'à `ms` depuis son début, comme le HUD. */
  a(ms: number): void;
  /** Les poses de la scène, telles que le moteur les lirait maintenant : la caméra, puis les poses. */
  poses(): readonly Pose[];
  /** Les figurines visibles d'un côté : l'attaquant à gauche du filet, la cible à droite. */
  visibles(cote: 'attaquant' | 'cible'): Pose[];
  /** Les effets visibles, d'un côté du filet ou des deux. */
  effets(cote?: 'gauche' | 'droite'): Pose[];
}

const BLEU: Rvb = [0.2, 0.4, 0.9];
const ROUGE: Rvb = [0.9, 0.2, 0.2];
const GRIS: Rvb = [0.72, 0.74, 0.78];

function essai(duel: Duel, o: {
  largeur?: number; hauteur?: number; reduit?: boolean; entrees?: Record<string, EntreeSprite>;
  terrains?: Record<string, CleTerrain>; proprietaires?: Record<string, CampId>; ambiance?: Ambiance;
  /** La règle des bâtiments de la carte ; à défaut, la base de chaque terrain, sans terni. */
  aspect?: DependancesCombat2d['aspectBatiment'];
} = {}): Essai {
  const doc = new FauxDocument();
  const hote = doc.createElement();
  hote.clientWidth = o.largeur ?? 880;
  hote.clientHeight = o.hauteur ?? 272;
  const ouverts = new Set<EncartSprites>();
  const ordre: EncartSprites[] = [];
  let salis = 0;
  const deps: DependancesCombat2d = {
    ouvrirEncart: (e) => {
      ouverts.add(e);
      ordre.push(e);
      return () => { ouverts.delete(e); };
    },
    salir: () => { salis += 1; },
    catalogue: CAT,
    terrain: (c) => o.terrains?.[`${c.x},${c.y}`] ?? 'plaine',
    proprietaire: (c) => o.proprietaires?.[`${c.x},${c.y}`] ?? null,
    ambiance: o.ambiance ?? ambiance('printemps', 'jour', 'clair'),
    biome: 'plaine',
    equipe: (camp) => (camp === 0 ? BLEU : camp === 1 ? ROUGE : GRIS),
    entreeUnite: (type) => `unite_${type}_base`,
    aspectBatiment: o.aspect ?? ((_c, terrain) => ({ entree: `batiment_${terrain}_base`, teinte: null, mat: true })),
    entree: (id) => o.entrees?.[id] ?? null,
    reduit: () => o.reduit ?? false,
  };
  const combat = ouvrirCombat2d(hote as unknown as HTMLElement, duel, deps);
  assert.ok(combat, 'le combat s’ouvre');
  const scene = ordre.find((e) => e.fond === null);
  assert.ok(scene, 'la scène des figurines est un encart sans fond');
  const poses = (): readonly Pose[] => {
    void scene.camera;
    return scene.poses(0);
  };
  const visible = (p: Pose): boolean => (p.instance.opacite ?? 1) > 0;
  return {
    combat, duel, hote, ouverts, ordre, scene, poses,
    salis: () => salis,
    a: (ms) => combat.avancer(duel.duree > 0 ? ms / duel.duree : 1),
    visibles: (cote) => poses().filter((p) => p.calque === 'unites' && visible(p)
      && (cote === 'attaquant' ? p.instance.x < 0 : p.instance.x > 0)),
    effets: (cote) => poses().filter((p) => p.calque === 'effets' && visible(p)
      && (cote === undefined || (cote === 'gauche' ? p.instance.x < 0 : p.instance.x > 0))),
  };
}

/** Le point d'une instance, ramené en pixels CSS du rectangle de l'hôte : l'inverse de ce que fait la scène. */
function versRectangle(p: Pose, e: Essai): { u: number; pieds: number; v: number } {
  const zoom = e.scene.camera.zoom;
  const i = p.instance;
  const pieds = i.y * SIN_TANGAGE * PIXELS_PAR_CASE * zoom + e.hote.clientHeight / 2;
  return {
    u: i.x * PIXELS_PAR_CASE * zoom + e.hote.clientWidth / 2,
    pieds,
    v: pieds - (i.h ?? 0) * COS_TANGAGE * PIXELS_PAR_CASE * zoom,
  };
}

// ---------------------------------------------------------------------------
// La chronologie : celle de la partition
// ---------------------------------------------------------------------------

test('la chronologie est celle de la partition : tir à 35 %, riposte 80 ms plus tard, impact au bout du vol', () => {
  const c = chronologieDuel(unDuel());
  assert.equal(c.duree, DUREES.duel);
  assert.equal(c.facteur, 1);
  assert.equal(c.tir, DUREES.duel * MISE_EN_SCENE.partCoup);
  assert.equal(c.riposte! - c.tir, MISE_EN_SCENE.delaiRiposte);
  assert.equal(c.vol, DUREES.tir);
  assert.equal(c.impactCible, c.tir + DUREES.tir);
  assert.equal(c.impactAttaquant, c.riposte! + DUREES.tir);
  // Le HUD fait tomber ses jauges exactement là : partCoup + trajet, partRiposte + trajet.
  const trajet = DUREES.tir / DUREES.duel;
  assert.ok(Math.abs(c.impactCible / c.duree - (MISE_EN_SCENE.partCoup + trajet)) < 1e-9);
  assert.ok(Math.abs(c.impactAttaquant! / c.duree - (MISE_EN_SCENE.partRiposte + trajet)) < 1e-9);
});

test('la cadence rapide divise tout par deux : la riposte part 40 ms après le tir', () => {
  const c = chronologieDuel(unDuel({ duree: DUREES.duel * 0.5 }));
  assert.equal(c.facteur, 0.5);
  assert.equal(c.tir, DUREES.duel * 0.5 * MISE_EN_SCENE.partCoup);
  assert.equal(c.riposte! - c.tir, 40);
  assert.equal(c.vol, DUREES.tir / 2);
  assert.equal(c.arret, 30);
});

test('sans riposte du moteur, la chronologie n’en invente pas', () => {
  const c = chronologieDuel(unDuel({ riposte: false }));
  assert.equal(c.riposte, null);
  assert.equal(c.impactAttaquant, null);
});

test('une salve part en décalé, et tous ses tireurs partent avant la moitié du vol', () => {
  const c = chronologieDuel(unDuel());
  assert.equal(ecartTireurs(c, 1), 0);
  assert.ok(ecartTireurs(c, 3) > 0);
  for (const n of [2, 5, 10]) assert.ok(ecartTireurs(c, n) * (n - 1) <= c.vol * 0.5 + 1e-9, `${n} tireurs`);
});

test('des PV affichés en figurines : un entier de 0 à 10', () => {
  assert.deepEqual(
    [figurines(10), figurines(6), figurines(0), figurines(14), figurines(-2), figurines(Number.NaN)],
    [10, 6, 0, 10, 0, 0],
  );
});

test('les effectifs suivent les impacts : la cible perd au sien, l’attaquant à celui de la riposte', () => {
  const d = unDuel({ a: [10, 8], c: [10, 6] });
  const c = chronologieDuel(d);
  assert.deepEqual(effectifsAu(d, c, 0), { attaquant: 10, cible: 10 });
  assert.deepEqual(effectifsAu(d, c, c.impactCible - 0.01), { attaquant: 10, cible: 10 });
  assert.deepEqual(effectifsAu(d, c, c.impactCible), { attaquant: 10, cible: 6 });
  assert.deepEqual(effectifsAu(d, c, c.impactAttaquant! - 0.01), { attaquant: 10, cible: 6 });
  assert.deepEqual(effectifsAu(d, c, c.impactAttaquant!), { attaquant: 8, cible: 6 });
  assert.deepEqual(effectifsAu(d, c, c.duree), { attaquant: 8, cible: 6 });
});

// ---------------------------------------------------------------------------
// La scène : une figurine par PV affiché, retirée à l'impact
// ---------------------------------------------------------------------------

test('chaque côté montre autant de figurines que de PV affichés : avant, après l’impact, après la riposte', () => {
  const e = essai(unDuel({ a: [10, 8], c: [10, 6] }));
  const c = chronologieDuel(e.duel);
  const compte = (): [number, number] => [e.visibles('attaquant').length, e.visibles('cible').length];
  e.a(0);
  assert.deepEqual(compte(), [10, 10], 'au départ');
  e.a(c.impactCible - 1);
  assert.deepEqual(compte(), [10, 10], 'juste avant l’impact : personne ne tombe au départ du tir');
  e.a(c.impactCible);
  assert.deepEqual(compte(), [10, 6], 'à l’impact, la cible perd ses quatre figurines');
  assert.deepEqual([e.combat.effectif('attaquant'), e.combat.effectif('cible')], [10, 6]);
  e.a(c.impactAttaquant! - 1);
  assert.deepEqual(compte(), [10, 6]);
  e.a(c.impactAttaquant!);
  assert.deepEqual(compte(), [8, 6], 'à l’arrivée de la riposte, l’attaquant perd les siennes');
  e.a(c.duree);
  assert.deepEqual(compte(), [8, 6], 'à la fin');
  assert.equal(e.hote.children[0]?.dataset['effectifs'], '8:6', 'les effectifs se lisent de dehors');
});

test('six PV, six figurines ; trois contre dix, trois contre dix', () => {
  const e = essai(unDuel({ a: [6, 6], c: [3, 1] }));
  e.a(0);
  assert.deepEqual([e.visibles('attaquant').length, e.visibles('cible').length], [6, 3]);
  const f = essai(unDuel({ a: [3, 3], c: [10, 9] }));
  f.a(0);
  assert.deepEqual([f.visibles('attaquant').length, f.visibles('cible').length], [3, 10]);
});

test('en cadence rapide, le retrait tombe à 35 % plus un vol raccourci, et celui de la riposte 40 ms plus tard', () => {
  const d = unDuel({ a: [10, 7], c: [9, 5], duree: DUREES.duel * 0.5 });
  const e = essai(d);
  const c = chronologieDuel(d);
  assert.equal(c.impactCible, DUREES.duel * 0.5 * 0.35 + DUREES.tir / 2);
  assert.equal(c.impactAttaquant! - c.impactCible, 40);
  e.a(c.impactCible - 1);
  assert.equal(e.visibles('cible').length, 9);
  e.a(c.impactCible);
  assert.equal(e.visibles('cible').length, 5);
  e.a(c.impactAttaquant! - 1);
  assert.equal(e.visibles('attaquant').length, 10);
  e.a(c.impactAttaquant!);
  assert.equal(e.visibles('attaquant').length, 7);
});

test('le feu part à 35 % du duel, pas avant ; la riposte part 80 ms plus tard ; tout arrive à l’impact', () => {
  const d = unDuel();
  const e = essai(d);
  const c = chronologieDuel(d);
  e.a(c.tir - 1);
  assert.equal(e.effets().length, 0, 'rien ne part avant le tir');
  assert.equal(e.combat.enVol('attaquant'), 0);
  e.a(c.tir + 1);
  assert.equal(e.combat.enVol('attaquant'), 1, 'le premier tireur part, les autres suivent en décalé');
  assert.ok(e.effets('gauche').length > 0, 'l’éclair et le projectile partent de la gauche');
  assert.equal(e.combat.enVol('cible'), 0, 'la cible ne tire pas encore');
  e.a(c.riposte! - 1);
  assert.equal(e.combat.enVol('cible'), 0, 'la riposte attend ses 80 ms');
  e.a(c.riposte! + 1);
  assert.equal(e.combat.enVol('cible'), 1, 'la riposte part');
  e.a(c.tir + c.vol / 2 + 1);
  assert.equal(e.combat.enVol('attaquant'), 10, 'à mi-vol, toute la salve est en l’air');
  e.a(c.impactCible);
  assert.equal(e.combat.enVol('attaquant'), 0, 'toute la salve arrive à l’impact, ensemble');
  assert.equal(e.combat.enVol('cible'), 10, 'la riposte partie avant l’impact tire à dix');
  e.a(c.impactAttaquant!);
  assert.equal(e.combat.enVol('cible'), 0);
});

test('sans riposte du moteur : la cible ne tire jamais, l’attaquant ne perd rien', () => {
  const d = unDuel({ a: [10, 10], c: [10, 4], riposte: false });
  const id = 'unite_infanterie_base';
  const e = essai(d, { entrees: { [id]: entreeCuite(id) } });
  const c = chronologieDuel(d);
  let tirAttaquant = false;
  for (let ms = 0; ms <= c.duree; ms += 20) {
    e.a(ms);
    assert.equal(e.combat.enVol('cible'), 0, `à ${ms} ms`);
    assert.equal(e.visibles('attaquant').length, 10, `à ${ms} ms`);
    assert.ok(e.visibles('cible').every((p) => p.instance.animation !== PROFIL.tir), `la cible ne joue pas « tir » à ${ms} ms`);
    if (e.visibles('attaquant').some((p) => p.instance.animation === PROFIL.tir)) tirAttaquant = true;
  }
  assert.ok(tirAttaquant, 'l’attaquant, lui, joue son clip de tir');
});

test('les clips de profil : repos, puis tir en décalé, arrêt sur image blanc, puis coup reçu', () => {
  const id = 'unite_infanterie_base';
  const d = unDuel({ a: [10, 10], c: [10, 7], riposte: false });
  const e = essai(d, { entrees: { [id]: entreeCuite(id) } });
  const c = chronologieDuel(d);
  e.a(0);
  assert.ok(e.visibles('attaquant').every((p) => p.instance.animation === PROFIL.repos), 'au repos d’abord');
  e.a(c.tir + 1);
  const enTir = e.visibles('attaquant').filter((p) => p.instance.animation === PROFIL.tir);
  assert.equal(enTir.length, 1, 'un seul tireur est parti : le feu est roulant, pas un bloc');
  e.a(c.tir + ecartTireurs(c, 10) * 5 + 1);
  assert.equal(e.visibles('attaquant').filter((p) => p.instance.animation === PROFIL.tir).length, 6);
  e.a(c.impactCible + 1);
  const touches = e.visibles('cible');
  assert.equal(touches.length, 7);
  assert.ok(touches.every((p) => p.instance.eclat === 1), 'l’arrêt sur image : les survivants blanchissent');
  const figees = touches.map((p) => p.instance.cadre);
  e.a(c.impactCible + c.arret - 1);
  assert.deepEqual(e.visibles('cible').map((p) => p.instance.cadre), figees, 'l’image tient pendant l’arrêt');
  e.a(c.impactCible + c.arret + 1);
  assert.ok(e.visibles('cible').every((p) => p.instance.animation === PROFIL.touche), 'puis le coup reçu se joue');
  assert.ok(e.visibles('cible').every((p) => (p.instance.eclat ?? 0) < 1), 'et l’éclat retombe');
  e.a(c.duree);
  assert.ok(e.visibles('cible').every((p) => p.instance.animation === PROFIL.repos && p.instance.eclat === 0));
});

test('une entrée sans vue de profil se dessine en repli, jamais de trois quarts', () => {
  const id = 'unite_infanterie_base';
  const e = essai(unDuel(), { entrees: { [id]: entreeCuite(id, 'aucun') } });
  e.a(0);
  assert.ok(e.visibles('attaquant').every((p) => p.instance.animation === -1));
});

test('un côté qui tombe à zéro joue son hors-jeu en s’effaçant, puis ne montre plus rien', () => {
  const id = 'unite_infanterie_base';
  const d = unDuel({ a: [10, 10], c: [4, 0], riposte: false });
  const e = essai(d, { entrees: { [id]: entreeCuite(id) } });
  const c = chronologieDuel(d);
  e.a(c.impactCible + c.fondu / 2);
  const tombantes = e.visibles('cible');
  assert.equal(tombantes.length, 4, 'les quatre tombent ensemble');
  assert.ok(tombantes.every((p) => p.instance.animation === PROFIL.hors_jeu));
  assert.ok(tombantes.every((p) => (p.instance.opacite ?? 1) > 0 && (p.instance.opacite ?? 1) < 1), 'en s’effaçant');
  assert.equal(e.combat.effectif('cible'), 0, 'aucune n’est plus debout');
  e.a(c.impactCible + c.fondu);
  assert.equal(e.visibles('cible').length, 0);
});

test('une perte laisse un éclat et une poussière à sa place, à l’impact seulement', () => {
  const d = unDuel({ a: [10, 10], c: [10, 7], riposte: false });
  const e = essai(d);
  const c = chronologieDuel(d);
  e.a(c.impactCible - 1);
  assert.equal(e.combat.enVol('attaquant'), 10, 'la salve est en l’air');
  e.a(c.impactCible + 1);
  assert.equal(e.combat.enVol('attaquant'), 0, 'elle est arrivée');
  // Plus un projectile à droite, et pas de riposte : restent l'éclat et la poussière de chaque perte.
  assert.equal(e.effets('droite').length, 2 * 3, 'trois pertes, un éclat et une poussière chacune');
  e.a(c.duree);
  assert.equal(e.effets().length, 0, 'plus rien à la fin');
});

// ---------------------------------------------------------------------------
// L'issue d'emblée : animations réduites, partition sans durée, passer
// ---------------------------------------------------------------------------

for (const [nom, duel, reduit] of [
  ['sous animations réduites', unDuel({ a: [10, 8], c: [10, 6] }), true],
  ['pour une partition sans durée', unDuel({ a: [10, 8], c: [10, 6], duree: 0 }), false],
] as const) {
  test(`${nom}, l’issue paraît d’emblée, sans un projectile`, () => {
    const e = essai(duel, { reduit });
    assert.deepEqual([e.visibles('attaquant').length, e.visibles('cible').length], [8, 6]);
    assert.equal(e.effets().length, 0);
    assert.equal(e.scene.enMouvement(), false, 'rien ne bouge : la boucle peut dormir');
    e.combat.avancer(0.4);
    assert.deepEqual([e.visibles('attaquant').length, e.visibles('cible').length], [8, 6]);
    assert.equal(e.combat.enVol('attaquant'), 0);
    assert.equal(e.hote.children[0]?.dataset['effectifs'], '8:6');
  });
}

test('passer saute à l’issue : les effectifs d’après, plus rien en l’air', () => {
  const e = essai(unDuel({ a: [9, 5], c: [10, 2] }));
  const c = chronologieDuel(e.duel);
  e.a(c.tir + 40);
  assert.ok(e.effets().length > 0);
  assert.equal(e.scene.enMouvement(), true);
  e.combat.passer();
  assert.deepEqual([e.combat.effectif('attaquant'), e.combat.effectif('cible')], [5, 2]);
  assert.deepEqual([e.visibles('attaquant').length, e.visibles('cible').length], [5, 2]);
  assert.equal(e.effets().length, 0);
  assert.equal(e.scene.enMouvement(), false);
});

test('fermer rend tout — l’encart, la racine — et deux fois sans dommage', () => {
  const e = essai(unDuel());
  assert.equal(e.ouverts.size, 1, 'un seul encart : le décor est peint dessous');
  assert.equal(e.hote.children.length, 1);
  e.a(500);
  e.combat.fermer();
  assert.equal(e.ouverts.size, 0, 'l’encart est fermé');
  assert.equal(e.hote.children.length, 0, 'la racine quitte l’hôte');
  assert.equal(e.combat.ouvert, false);
  const salis = e.salis();
  e.combat.fermer();
  e.combat.avancer(0.9);
  e.combat.passer();
  assert.equal(e.salis(), salis, 'une scène fermée ne réclame plus d’image');
  assert.equal(e.scene.enMouvement(), false);
});

// ---------------------------------------------------------------------------
// Les encarts, et l'image qui ne coûte rien
// ---------------------------------------------------------------------------

/** Les rectangles d'une trace d'aplats, ramenés en pixels CSS du rectangle de l'hôte, avec leur couleur. */
function rectanglesDe(trace: Trace, e: Essai): { u0: number; v0: number; u1: number; v1: number; c: number[] }[] {
  const z = e.scene.camera.zoom;
  const W = e.hote.clientWidth;
  const H = e.hote.clientHeight;
  const d = trace.donnees;
  const sortie: { u0: number; v0: number; u1: number; v1: number; c: number[] }[] = [];
  // Deux triangles par rectangle, six sommets de six flottants : on lit les coins du premier.
  for (let s = 0; s < trace.sommets; s += 6) {
    const xs = [0, 1, 2, 3, 4, 5].map((k) => d[(s + k) * FLOTTANTS_SOMMET]!);
    const ys = [0, 1, 2, 3, 4, 5].map((k) => d[(s + k) * FLOTTANTS_SOMMET + 1]!);
    const o = s * FLOTTANTS_SOMMET;
    sortie.push({
      u0: Math.min(...xs) * z + W / 2, v0: Math.min(...ys) * z + H / 2,
      u1: Math.max(...xs) * z + W / 2, v1: Math.max(...ys) * z + H / 2,
      c: [d[o + 2]!, d[o + 3]!, d[o + 4]!, d[o + 5]!],
    });
  }
  return sortie;
}

test('un seul encart : les bandes du décor sont peintes sous la scène, au rectangle de l’hôte', () => {
  const e = essai(unDuel(), { terrains: { '2,3': 'foret', '3,3': 'mer' } });
  assert.equal(e.ordre.length, 1, 'un duel tient en un encart');
  assert.equal(e.scene.fond, null);
  assert.equal(e.scene.hote, e.hote as unknown as HTMLElement, 'la scène peint le rectangle de l’hôte');
  const aplats = e.scene.aplats;
  assert.ok(aplats, 'le décor est peint en aplats');
  void e.scene.camera;
  const trace = new Trace();
  aplats.tracer(trace);
  const r = rectanglesDe(trace, e);
  assert.equal(r.length, 6);
  const ciel = couleurCiel(ambiance('printemps', 'jour', 'clair'));
  const foret = decorDeCase({ terrain: 'foret', biome: 'plaine', ambiance: ambiance('printemps', 'jour', 'clair') });
  const mer = decorDeCase({ terrain: 'mer', biome: 'plaine', ambiance: ambiance('printemps', 'jour', 'clair') });
  const opaque = (c: readonly number[]) => [c[0]!, c[1]!, c[2]!, 1];
  const proche = (a: number[], b: number[]) => a.every((x, i) => Math.abs(x - (b[i] ?? NaN)) < 1e-6);
  assert.ok(proche(r[0]!.c, opaque(ciel)), 'le ciel');
  assert.ok(proche(r[1]!.c, opaque(foret.lointain)) && proche(r[2]!.c, opaque(mer.lointain)), 'les lointains');
  assert.ok(proche(r[3]!.c, opaque(foret.sol)) && proche(r[4]!.c, opaque(mer.sol)), 'les sols');
  assert.ok(proche(r[5]!.c, opaque(COULEUR_SEPARATION)), 'le filet, en dernier : il coupe le ciel');
  // Les bandes pavent l'hôte : le ciel de bord à bord, l'horizon à sa part, le filet au milieu.
  const W = e.hote.clientWidth;
  const H = e.hote.clientHeight;
  const pres = (a: number, b: number) => Math.abs(a - b) < 1e-3;
  assert.ok(pres(r[0]!.u0, 0) && pres(r[0]!.u1, W) && pres(r[0]!.v0, 0));
  assert.ok(pres(r[3]!.v0, H * PART_HORIZON) && pres(r[3]!.v1, H) && pres(r[4]!.u1, W));
  assert.ok(pres(r[5]!.u1 - r[5]!.u0, SEPARATION) && pres((r[5]!.u0 + r[5]!.u1) / 2, W / 2));
  // La forêt dresse ses arbres derrière la formation de gauche.
  const decor = e.poses().filter((p) => p.calque === 'volumes');
  assert.equal(decor.length, 3);
  assert.ok(decor.every((p) => p.instance.x < 0 && /^decor_feuillu_printemps_\d$/.test(p.instance.entree)));
});

test('le décor peint ne se retrace que si l’hôte change de taille', () => {
  const e = essai(unDuel());
  void e.scene.camera;
  const v1 = e.scene.aplats!.version();
  e.a(400);
  void e.scene.camera;
  assert.equal(e.scene.aplats!.version(), v1, 'un duel qui avance ne retrace rien');
  e.hote.clientWidth = 600;
  void e.scene.camera;
  assert.notEqual(e.scene.aplats!.version(), v1, 'une nouvelle taille, un nouveau tracé');
});

test('l’arbre d’une forêt est celui du placement : la première essence du biome', () => {
  for (const biome of Object.keys(ARBRES) as (keyof typeof ARBRES)[]) {
    assert.equal(arbreDuBiome(biome), ARBRES[biome][0]![0]);
  }
  assert.equal(arbreDuBiome('desert'), 'palmier');
  assert.equal(arbreDuBiome('jungle'), 'tropical');
});

test('aucune allocation par image : les mêmes poses et la même caméra, réécrites en place', () => {
  const e = essai(unDuel());
  e.a(100);
  const p1 = e.poses();
  const camera1 = e.scene.camera;
  const instances = p1.map((p) => p.instance);
  e.a(800);
  const p2 = e.poses();
  assert.equal(p2, p1, 'le même tableau');
  assert.ok(p2.every((p, i) => p.instance === instances[i]), 'les mêmes instances');
  assert.equal(e.scene.camera, camera1, 'la même caméra');
});

test('la caméra suit la taille de l’hôte : une case vaut la taille d’une figurine, et tout reste dedans', () => {
  const e = essai(unDuel());
  const d0 = disposerCombat(880, 272, { taille: 0.85, vol: 0 }, { taille: 0.85, vol: 0 });
  assert.equal(e.scene.camera.zoom, d0.taille / PIXELS_PAR_CASE);
  for (const [l, h] of [[366, 287], [600, 130], [1200, 370]] as const) {
    e.hote.clientWidth = l;
    e.hote.clientHeight = h;
    e.a(0);
    const figures = e.poses().filter((p) => p.calque === 'unites' && (p.instance.opacite ?? 1) > 0);
    assert.equal(figures.length, 20);
    for (const f of figures) {
      const r = versRectangle(f, e);
      assert.ok(r.u > 0 && r.u < l && r.pieds > h * PART_HORIZON && r.pieds < h, `${l}×${h} : pieds en ${r.u.toFixed(1)}, ${r.pieds.toFixed(1)}`);
    }
  }
});

// ---------------------------------------------------------------------------
// La disposition, quelle que soit la taille de l'hôte
// ---------------------------------------------------------------------------

test('les rangs tiennent dans le rectangle et dans leur moitié, téléphone compris', () => {
  const tailles: readonly [number, number][] = [
    [880, 272], [856, 370], [1200, 370], [366, 287], [366, 130], [600, 130], [320, 170], [390, 200], [240, 160],
  ];
  const gabarits: readonly GabaritFormation[] = [
    { taille: 0.85, vol: 0 }, { taille: 1, vol: 0 }, { taille: 1.18, vol: 0 }, { taille: 1, vol: 0.45 },
  ];
  for (const [l, h] of tailles) {
    for (const ga of gabarits) {
      for (const gc of gabarits) {
        const d = disposerCombat(l, h, ga, gc);
        const cas = `${l}×${h}, ${ga.taille}/${ga.vol} contre ${gc.taille}/${gc.vol}`;
        assert.ok(d.taille > 8, `${cas} : des figurines lisibles (${d.taille.toFixed(1)} px)`);
        for (const [f, gauche] of [[d.attaquant, true], [d.cible, false]] as const) {
          assert.equal(f.places.length, MAX_FIGURINES, cas);
          assert.equal(f.sens, gauche ? 1 : -1);
          const t = f.gabarit.taille;
          const vues = new Set<string>();
          for (const p of f.places) {
            const g = p.u - (LARGEUR_FIGURE * t * d.taille) / 2;
            const dr = p.u + (LARGEUR_FIGURE * t * d.taille) / 2;
            const haut = p.v - (HAUTEUR_FIGURE * t + f.gabarit.vol) * d.taille;
            const bas = p.v + PIED_FIGURE * d.taille;
            assert.ok(haut >= 0 && bas <= h, `${cas} : de ${haut.toFixed(1)} à ${bas.toFixed(1)} dans ${h}`);
            if (gauche) assert.ok(g >= 0 && dr <= d.demi, `${cas} : ${g.toFixed(1)}–${dr.toFixed(1)} dans la moitié gauche`);
            else assert.ok(g >= l - d.demi && dr <= l, `${cas} : ${g.toFixed(1)}–${dr.toFixed(1)} dans la moitié droite`);
            assert.ok(p.v > d.horizon, `${cas} : les pieds dans le sol`);
            vues.add(`${p.u.toFixed(2)},${p.v.toFixed(2)}`);
          }
          assert.equal(vues.size, MAX_FIGURINES, `${cas} : dix places distinctes`);
          assert.deepEqual([...f.proximite].sort((a, b) => a - b), [...Array(MAX_FIGURINES).keys()]);
        }
      }
    }
  }
});

test('la disposition s’adapte : colonnes en portrait, rangs larges sur une bande basse, et symétrique', () => {
  const portrait = disposerCombat(366, 287, { taille: 0.85, vol: 0 }, { taille: 0.85, vol: 0 });
  const bande = disposerCombat(600, 130, { taille: 0.85, vol: 0 }, { taille: 0.85, vol: 0 });
  assert.ok(portrait.rangs > bande.rangs, `${portrait.colonnes}×${portrait.rangs} contre ${bande.colonnes}×${bande.rangs}`);
  // Les deux formations se font face, en miroir autour du filet.
  const d = disposerCombat(880, 272, { taille: 1, vol: 0 }, { taille: 1, vol: 0 });
  d.attaquant.places.forEach((p, k) => {
    const q = d.cible.places[k]!;
    assert.ok(Math.abs(p.u + q.u - 880) < 1e-9 && Math.abs(p.v - q.v) < 1e-9);
  });
  assert.ok(d.demi * 2 + SEPARATION <= 880 + 1e-9);
  // Une formation entamée reste groupée : ses premières places sont au centre de la moitié.
  const centre = d.demi / 2;
  const ecart = (k: number): number => Math.abs(d.attaquant.places[k]!.u - centre);
  assert.ok(ecart(0) <= ecart(9), 'la première place est plus au centre que la dernière');
});

// ---------------------------------------------------------------------------
// Le décor d'une case
// ---------------------------------------------------------------------------

test('le décor d’une case : arbres en forêt, montagne, bâtiment aux couleurs de son propriétaire, eau en mer', () => {
  const jour = ambiance('printemps', 'jour', 'clair');
  const foret = decorDeCase({ terrain: 'foret', biome: 'plaine', ambiance: jour });
  assert.equal(foret.elements.length, 3);
  const montagne = decorDeCase({ terrain: 'montagne', biome: 'desert', ambiance: jour });
  assert.ok(montagne.elements.every((x) => x.entree.startsWith('decor_montagne_aride_')));
  const ville = decorDeCase({ terrain: 'ville', biome: 'plaine', ambiance: jour, batiment: { entree: 'batiment_ville_base', equipe: ROUGE } });
  assert.deepEqual(ville.elements.map((x) => [x.entree, x.equipe]), [['batiment_ville_base', ROUGE]]);
  const mer = decorDeCase({ terrain: 'mer', biome: 'plaine', ambiance: jour });
  assert.equal(mer.elements.length, 0);
  assert.ok(mer.sol[2] > mer.sol[0], 'la mer est bleue');
  const plaine = decorDeCase({ terrain: 'plaine', biome: 'plaine', ambiance: jour });
  assert.ok(plaine.sol[1] > plaine.sol[2], 'l’herbe est verte');
});

test('la saison, la nuit et la météo passent sur le décor comme sur la carte', () => {
  const printemps = decorDeCase({ terrain: 'plaine', biome: 'plaine', ambiance: ambiance('printemps', 'jour', 'clair') });
  const hiver = decorDeCase({ terrain: 'plaine', biome: 'plaine', ambiance: ambiance('hiver', 'jour', 'clair') });
  const somme = (c: Rvb): number => c[0] + c[1] + c[2];
  assert.ok(somme(hiver.sol) > somme(printemps.sol) + 0.3, 'la neige blanchit le sol l’hiver');
  const jour = couleurCiel(ambiance('printemps', 'jour', 'clair'));
  const nuit = couleurCiel(ambiance('printemps', 'nuit', 'clair'));
  assert.ok(somme(nuit) < somme(jour) - 0.5, 'le ciel de nuit est sombre');
  const nuitSol = decorDeCase({ terrain: 'plaine', biome: 'plaine', ambiance: ambiance('printemps', 'nuit', 'clair') });
  assert.ok(somme(nuitSol.sol) < somme(printemps.sol), 'la nuit tombe sur le sol aussi');
});

test('une essence cuite sans cette saison retombe sur « toutes », sinon garde son nom pour le repli', () => {
  const jour = ambiance('automne', 'jour', 'clair');
  const avecToutes = decorDeCase({ terrain: 'foret', biome: 'plaine', ambiance: jour, existe: (id) => id.includes('_toutes_') });
  assert.ok(avecToutes.elements.every((x) => /^decor_feuillu_toutes_\d$/.test(x.entree)));
  const sans = decorDeCase({ terrain: 'foret', biome: 'plaine', ambiance: jour, existe: () => false });
  assert.ok(sans.elements.every((x) => /^decor_feuillu_automne_\d$/.test(x.entree)));
});

test('le bâtiment de la case se dresse dans la scène, à la couleur de son propriétaire', () => {
  const e = essai(unDuel(), { terrains: { '2,3': 'route', '3,3': 'ville' }, proprietaires: { '3,3': 1 } });
  const decor = e.poses().filter((p) => p.calque === 'volumes');
  assert.equal(decor.length, 2, 'un buisson au bord de la route, la ville en face');
  const batiment = decor.find((p) => p.instance.entree === 'batiment_ville_base');
  assert.ok(batiment, 'la ville est dans la scène');
  assert.deepEqual(batiment.instance.equipe, ROUGE);
  assert.ok(batiment.instance.x > 0, 'du côté de la cible');
  // Une ville neutre reçoit le gris neutre, jamais le blanc des zones d'équipe cuites.
  const neutre = essai(unDuel(), { terrains: { '3,3': 'ville' } });
  const grise = neutre.poses().find((p) => p.instance.entree === 'batiment_ville_base');
  assert.deepEqual(grise?.instance.equipe, GRIS);
});

test('le décor d’une case bâtie garde le terni que la carte lui donne', () => {
  const jour = ambiance('printemps', 'jour', 'clair');
  const terni = decorDeCase({
    terrain: 'ville', biome: 'plaine', ambiance: jour,
    batiment: { entree: 'batiment_ville_base', equipe: GRIS, teinte: TEINTE_DESAFFECTE },
  });
  assert.deepEqual(terni.elements.map((x) => [x.entree, x.teinte]), [['batiment_ville_base', TEINTE_DESAFFECTE]]);
  const net = decorDeCase({ terrain: 'ville', biome: 'plaine', ambiance: jour, batiment: { entree: 'batiment_ville_base', equipe: GRIS } });
  assert.equal(net.elements[0]!.teinte, undefined, 'aucune teinte là où la carte n’en pose pas');
});

test('l’écran de combat pose le bâtiment de la carte : désaffecté endormi, ou terni sans son image', () => {
  // La cible se tient sur une ville désaffectée, en (3, 3).
  const etat = partiePersonnalisee(
    ['HPPPPH', 'PPPPPP', 'PPPPPP', 'PPPCPP'],
    { '0,0': 0, '5,0': 1 },
    [{ camp: 0, type: 'infanterie', x: 2, y: 3 }, { camp: 1, type: 'infanterie', x: 3, y: 3 }],
  );
  etat.desaffectes = ['3,3'];
  const terrainDe = (c: { x: number; y: number }) => terrainLogique(etat, CAT, c);
  for (const cuites of [[], ['batiment_ville_desaffecte']] as string[][]) {
    const images = { entree: (t: CleTerrain) => `batiment_${t}_base`, existe: (id: string) => cuites.includes(id) };
    const e = essai(unDuel(), {
      terrains: { '3,3': 'ville' },
      aspect: (c, terrain) => aspectBatiment(etat, c, terrain, images),
    });
    const scene = e.poses().find((p) => p.calque === 'volumes' && p.instance.entree.startsWith('batiment_'));
    // La même case, sur la carte.
    const carte = posesBatiments(etat, terrainDe, {
      ...images, visibles: null, brouillard: null, equipe: () => GRIS, animation: () => null,
      seuil: () => 40, tempsMs: 0, reduit: false,
    }).poses.find((p) => p.colonne === 3.5 && p.ligne === 3.5 && p.instance.entree.startsWith('batiment_'));
    assert.ok(scene && carte);
    assert.equal(scene.instance.entree, carte.instance.entree);
    assert.deepEqual(scene.instance.teinte, carte.instance.teinte);
    assert.deepEqual(scene.instance.equipe, GRIS, 'un désaffecté est neutre');
    const attendu = cuites.length > 0 ? ['batiment_ville_desaffecte', undefined] : ['batiment_ville_base', TEINTE_DESAFFECTE];
    assert.deepEqual([scene.instance.entree, scene.instance.teinte], attendu);
  }
});

// ---------------------------------------------------------------------------
// Le profil d'un tir, les clips de profil
// ---------------------------------------------------------------------------

test('le profil d’un tir se lit sur les données de l’unité', () => {
  const u = CAT.unites;
  assert.equal(profilTir2d(u.infanterie, u.char_leger), 'rafale');
  assert.equal(profilTir2d(u.char_leger, u.infanterie), 'rafale', 'la mitrailleuse contre ses cibles secondaires');
  assert.equal(profilTir2d(u.char_leger, u.char_leger), 'marqueur');
  assert.equal(profilTir2d(u.artillerie, u.char_leger), 'obus');
  assert.equal(profilTir2d(u.roquettes, u.char_leger), 'missile');
  assert.equal(profilTir2d(u.antiair, u.helico), 'rafale');
  assert.equal(profilTir2d(undefined, u.infanterie), 'marqueur');
});

test('les clips de profil d’une entrée : leurs index, et un clip absent retombe sur un autre clip de profil', () => {
  const id = 'unite_infanterie_base';
  assert.equal(clipsProfil(null), null);
  assert.equal(clipsProfil(entreeCuite(id, 'aucun')), null, 'pas de profil : le repli');
  const tous = clipsProfil(entreeCuite(id));
  assert.deepEqual(
    [tous?.repos.index, tous?.tir.index, tous?.touche.index, tous?.hors_jeu.index],
    [PROFIL.repos, PROFIL.tir, PROFIL.touche, PROFIL.hors_jeu],
  );
  assert.equal(tous?.tir.boucle, false);
  const seul = clipsProfil(entreeCuite(id, 'repos_seul'));
  assert.deepEqual([seul?.tir.index, seul?.hors_jeu.index], [PROFIL.repos, PROFIL.repos], 'jamais la vue de trois quarts');
});

test('un duel en mer : l’écume sous chaque navire, l’ombre sous ce qui n’en est pas un', () => {
  // La règle de la carte (`solSousUnite`) : une ombre sombre sur la mer noyait
  // la coque, l'écume la détache de l'eau — sur l'écran de combat aussi.
  const e = essai(unDuel({ typeA: 'helico', typeC: 'barge' }), { terrains: { '2,3': 'mer', '3,3': 'mer' } });
  e.a(0);
  const sous = (cote: 'gauche' | 'droite'): Pose[] => e.poses().filter((p) => p.calque === 'ombres_unites'
    && (p.instance.opacite ?? 1) > 0 && (cote === 'gauche' ? p.instance.x < 0 : p.instance.x > 0));
  const helico = sous('gauche');
  const barge = sous('droite');
  assert.ok(helico.length > 0 && barge.length > 0);
  assert.ok(helico.every((p) => p.instance.entree === FORMES.ombre), 'l’hélicoptère, au-dessus de la mer, porte une ombre');
  assert.ok(barge.every((p) => p.instance.entree === FORMES.ecume), 'la barge, l’écume');
  assert.ok(barge.every((p) => Math.abs((p.instance.opacite ?? 0) - ECUME_NAVIRE.opacite) < 1e-9));
});
