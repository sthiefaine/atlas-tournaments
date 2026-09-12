/**
 * L'**interprète** de la partition : chaque geste daté devient une animation de
 * la boucle, qui pose le clip logique de l'unité, émet ses effets, et **finit
 * sur l'état exact** — c'est ce dernier point qui fait qu'un clic peut couper
 * une salve sans rien laisser en chemin.
 *
 * Aucune scène ici : un calque d'unités réduit aux états visuels, un vrai pool
 * d'effets sur un document sans toile, et les animations avancées à la main,
 * comme la boucle le ferait.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';

import {
  animationsDePartition, profilTir, hauteurImpact, ECLAT_MAX, gesteVersAnimation, MS_ECLAT, partitionProvisoire,
  type ContexteAnimation,
} from '../../src/render3d/animations';
import { creerEffets, type Effets } from '../../src/render3d/effets';
import { CASE } from '../../src/render3d/geometrie';
import type { PriseChantier, PriseDrapeau } from '../../src/render3d/decor';
import type { CalqueUnites, EtatVisuel } from '../../src/render3d/unites';
import { paletteDe } from '../../src/render/palettes';
import { DUREES, type Geste, type Partition } from '../../src/render/partition';
import type { EtatPartie, EvenementJeu } from '../../src/engine/index';
import type { Case, UnitType } from '../../src/schemas/types';
import { CAT, partiePersonnalisee } from '../engine/aides';

const etat = partiePersonnalisee(['....', '....'], {}, [
  { camp: 0, type: 'infanterie', x: 0, y: 0 },
  { camp: 1, type: 'infanterie', x: 1, y: 0 },
]);
const [mienne, sienne] = etat.unites.map((u) => u.id) as [string, string];

interface Banc {
  ctx: ContexteAnimation;
  effets: Effets;
  visuel(id: string): EtatVisuel;
  retenues: string[];
  liberees: string[];
  cadrees: Case[];
  eclats: { facteur: number; teinte: string | null }[];
  images: number;
}

/** Un contexte factice : ce que les gestes touchent, et rien de plus. */
function banc(options: {
  drapeau?: PriseDrapeau | null; chantier?: PriseChantier | null; courant?: EtatPartie | null;
} = {}): Banc {
  const visuels = new Map<string, EtatVisuel>();
  const retenues: string[] = [];
  const liberees: string[] = [];
  const cadrees: Case[] = [];
  const eclats: { facteur: number; teinte: string | null }[] = [];
  let images = 0;
  const visuel = (id: string): EtatVisuel => {
    const memo = visuels.get(id);
    if (memo) return memo;
    const neuf: EtatVisuel = {
      dx: 0, dz: 0, dy: 0, cap: 0, recul: 0, secousse: 0, opacite: 1, affaissement: 0,
      clip: 'repos', clipDuree: 0, pv: null, voile: null,
    };
    visuels.set(id, neuf);
    return neuf;
  };
  const unites = {
    visuel,
    retenir: (u: { id: string }) => { retenues.push(u.id); },
    liberer: (id: string) => { liberees.push(id); },
  } as unknown as CalqueUnites;
  // Un document qui sait créer un canevas sans contexte : les textures d'effets
  // s'en passent, elles restent blanches.
  const doc = { createElement: () => ({ width: 0, height: 0, getContext: () => null }) } as unknown as Document;
  const effets = creerEffets(doc);
  const ctx: ContexteAnimation = {
    unites,
    effets,
    hauteurEn: () => 0,
    drapeau: () => options.drapeau ?? null,
    chantier: () => options.chantier ?? null,
    etats: () => ({ courant: options.courant ?? etat, precedent: etat }),
    cadrer: (c) => { cadrees.push(c); },
    eclat: (facteur, teinte) => { eclats.push({ facteur, teinte }); },
    salir: () => { images += 1; },
  };
  return {
    ctx, effets, visuel, retenues, liberees, cadrees, eclats,
    get images() { return images; },
  };
}

/** Le premier geste d'un genre, typé — `find` seul ne restreint pas l'union. */
function gesteDe<G extends Geste['genre']>(
  partition: Partition, genre: G, unite?: string,
): Extract<Geste, { genre: G }> | undefined {
  return partition.gestes.find((g): g is Extract<Geste, { genre: G }> => (
    g.genre === genre && (unite === undefined || (g as { unite?: string }).unite === unite)
  ));
}

/**
 * Les effets vivants du pool. Un éclair ou une étincelle est un sprite face à
 * la caméra ; un halo ou un anneau est couché au sol : les deux comptent.
 */
function vivants(effets: Effets): THREE.Object3D[] {
  return effets.groupe.children.filter((o) => o.visible);
}

test('un glissement pose le clip de marche, suit le chemin, et rend l’unité au repos', () => {
  const b = banc();
  const g: Geste = {
    genre: 'glisser', unite: mienne, debut: 0, duree: 3 * DUREES.parCase,
    chemin: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
  };
  const a = gesteVersAnimation(g, b.ctx);
  assert.ok(a);
  assert.equal(a.animation.duree, 360, 'trois cases à cent vingt millisecondes');
  const v = b.visuel(mienne);
  a.animation.avancer(0.5);
  assert.equal(v.clip, 'deplacement');
  // Le calque pose l'unité à l'arrivée : le décalage part de là et vaut zéro à la fin.
  assert.ok(Math.abs(v.dx - -1.5 * CASE) < 1e-6, 'à mi-chemin, l’unité est une case et demie derrière son arrivée');
  a.animation.terminer?.();
  assert.equal(v.clip, 'repos');
  assert.deepEqual([v.dx, v.dz, v.dy], [0, 0, 0], 'la fin pose l’état exact');
  b.effets.dispose();
});

test('un tir vise depuis sa case, jette un éclair de bouche, et le reprend en finissant', () => {
  const b = banc();
  const g: Geste = {
    genre: 'tirer', unite: mienne, depuis: { x: 0, y: 2 }, vers: { x: 1, y: 0 },
    debut: 0, duree: DUREES.tir,
  };
  const a = gesteVersAnimation(g, b.ctx);
  assert.ok(a);
  const v = b.visuel(mienne);
  a.animation.avancer(0.2);
  assert.equal(v.clip, 'tir');
  assert.ok(v.recul < 0, 'la pièce recule');
  assert.equal(v.cap, Math.atan2(2, 1), 'le cap part de la case du tireur, pas de son origine de salve');
  const eclair = vivants(b.effets);
  assert.ok(eclair.length >= 1);
  assert.ok(eclair[0] instanceof THREE.Sprite, 'un éclair de bouche fait face à la caméra');
  const attendu = 0 * CASE + CASE / 2 + Math.cos(v.cap) * 0.42;
  assert.ok(Math.abs(eclair[0].position.x - attendu) < 1e-6, 'l’éclair est au bord de la case du tireur');
  a.animation.terminer?.();
  assert.equal(v.recul, 0);
  assert.equal(v.clip, 'repos');
  assert.equal(vivants(b.effets).length, 0, 'l’éclair est rendu au pool');
  b.effets.dispose();
});

test('un coup encaissé secoue la pièce et jette des étincelles, plus nombreuses si le coup est lourd', () => {
  const b = banc();
  const g: Geste = {
    genre: 'encaisser', unite: sienne, case: { x: 1, y: 0 }, depuis: { x: 0, y: 0 },
    degats: 80, debut: 0, duree: DUREES.encaisser,
  };
  const a = gesteVersAnimation(g, b.ctx);
  assert.ok(a);
  const v = b.visuel(sienne);
  a.animation.avancer(0.1);
  assert.equal(v.clip, 'touche');
  assert.ok(v.secousse > 0);
  const n = vivants(b.effets).length;
  assert.ok(n >= 5 && n <= 20, `impact et étincelles, pas ${n}`);
  a.animation.terminer?.();
  assert.equal(v.secousse, 0);
  assert.equal(v.clip, 'repos');
  assert.equal(vivants(b.effets).length, 0);

  // Un coup léger en jette moins qu'un coup lourd.
  const leger = gesteVersAnimation({ ...g, degats: 10 }, b.ctx);
  leger?.animation.avancer(0.1);
  assert.ok(vivants(b.effets).length < n, 'moins d’étincelles pour un coup léger');
  leger?.animation.terminer?.();
  b.effets.dispose();
});

test('les points de vie ne tombent qu’à la fin du coup, jamais avant', () => {
  // L'état logique est en avance sur l'image : sans retenue, l'étiquette
  // annonce la perte pendant que le coup est encore en l'air.
  const b = banc();
  const a = gesteVersAnimation({
    genre: 'encaisser', unite: sienne, case: { x: 1, y: 0 }, depuis: { x: 0, y: 0 },
    degats: 30, debut: 100, duree: DUREES.encaisser,
  }, b.ctx);
  assert.ok(a);
  const v = b.visuel(sienne);
  assert.equal(v.pv, null, 'rien n’est retenu tant que le geste n’a pas commencé');
  const total = 100 + DUREES.encaisser;
  // Le geste attend son tour : les points sont déjà tenus, pas encore tombés.
  a.animation.avancer(50 / total);
  assert.equal(v.pv, 10, 'les points d’avant le coup, lus dans l’état précédent');
  a.animation.avancer((100 + DUREES.encaisser / 2) / total);
  assert.equal(v.pv, 10, 'toujours pendant le coup');
  a.animation.terminer?.();
  assert.equal(v.pv, null, 'le coup encaissé, l’étiquette rejoint l’état');
  b.effets.dispose();
});

test('une unité mise hors jeu est retenue le temps de s’effacer, puis libérée', () => {
  const b = banc();
  const a = gesteVersAnimation(
    { genre: 'sortir', unite: sienne, case: { x: 1, y: 0 }, debut: 0, duree: DUREES.sortir }, b.ctx,
  );
  assert.ok(a);
  const v = b.visuel(sienne);
  a.animation.avancer(0.5);
  assert.deepEqual(b.retenues, [sienne], 'le calque la garde alors qu’elle a quitté l’état');
  assert.equal(v.clip, 'hors_jeu');
  assert.ok(v.opacite < 1 && v.affaissement > 0);
  a.animation.terminer?.();
  assert.deepEqual(b.liberees, [sienne]);
  b.effets.dispose();
});

test('une unité produite se pose : opacité de zéro à un, halo au sol, rien avant son tour', () => {
  const b = banc();
  const a = gesteVersAnimation({
    genre: 'apparaitre', unite: 'infanterie', case: { x: 0, y: 0 }, camp: 0,
    debut: 200, duree: DUREES.apparaitre,
  }, b.ctx);
  assert.ok(a);
  const total = 200 + DUREES.apparaitre;
  assert.equal(a.animation.duree, total, 'le début est encodé dans la durée totale');
  // Avant son tour, l'unité existe dans l'état mais ne se voit pas.
  a.animation.avancer(100 / total);
  assert.equal(b.visuel(mienne).opacite, 0, 'elle attend, invisible');
  assert.equal(vivants(b.effets).length, 0, 'et n’a pas encore émis son halo');
  a.animation.avancer((200 + DUREES.apparaitre / 2) / total);
  assert.ok(b.visuel(mienne).opacite > 0 && b.visuel(mienne).opacite < 1, 'elle se pose');
  assert.equal(vivants(b.effets).length, 1, 'le halo de camp');
  a.animation.terminer?.();
  assert.equal(b.visuel(mienne).opacite, 1);
  assert.equal(vivants(b.effets).length, 0);
  b.effets.dispose();
});

test('un pouvoir fait monter l’éclat puis le rend, et lance ses anneaux', () => {
  const b = banc();
  const a = gesteVersAnimation(
    { genre: 'pouvoir', camp: 0, niveau: 'normal', nom: 'commandant.x.pouvoir', debut: 0, duree: DUREES.pouvoir },
    b.ctx,
  );
  assert.ok(a);
  // Au sommet de la courbe d'éclat, à la moitié des six cents premières millisecondes.
  a.animation.avancer((MS_ECLAT / 2) / DUREES.pouvoir);
  const haut = b.eclats[b.eclats.length - 1]!;
  assert.ok(Math.abs(haut.facteur - (1 + ECLAT_MAX)) < 1e-6, 'l’exposition monte à 1,6');
  assert.equal(haut.teinte, paletteDe(0).main, 'teintée du camp');
  assert.ok(vivants(b.effets).length >= 1, 'les anneaux partent');
  // Passé l'éclat, l'exposition est rendue.
  a.animation.avancer(0.6);
  assert.equal(b.eclats[b.eclats.length - 1]!.facteur, 1);
  a.animation.terminer?.();
  assert.deepEqual(b.eclats[b.eclats.length - 1], { facteur: 1, teinte: null }, 'la fin rend la lumière exacte');
  assert.equal(vivants(b.effets).length, 0);
  b.effets.dispose();
});

test('un cadrage amène la case une seule fois, et jamais si le geste est coupé avant son tour', () => {
  const b = banc();
  const a = gesteVersAnimation({ genre: 'cadrer', case: { x: 3, y: 1 }, debut: 0, duree: 0 }, b.ctx);
  assert.ok(a);
  a.animation.avancer(1);
  a.animation.avancer(1);
  assert.deepEqual(b.cadrees, [{ x: 3, y: 1 }], 'une fois, pas à chaque image');

  const tard = gesteVersAnimation({ genre: 'cadrer', case: { x: 2, y: 0 }, debut: 500, duree: 0 }, b.ctx);
  tard?.animation.avancer(0.5);
  tard?.animation.terminer?.();
  assert.equal(b.cadrees.length, 1, 'coupé avant son tour, il ne bouge pas la caméra du joueur');
  b.effets.dispose();
});

test('le duel et le chiffre appartiennent au HUD : la peau n’en fait rien', () => {
  const b = banc();
  assert.equal(gesteVersAnimation(
    { genre: 'chiffre', case: { x: 0, y: 0 }, valeur: 3, teinte: 'perte', debut: 0, duree: DUREES.chiffre }, b.ctx,
  ), null);
  assert.equal(gesteVersAnimation({
    genre: 'duel', riposte: false, debut: 0, duree: DUREES.duel,
    attaquant: { unite: mienne, type: 'infanterie', camp: 0, case: { x: 0, y: 0 }, pvAvant: 10, pvApres: 10 },
    cible: { unite: sienne, type: 'infanterie', camp: 1, case: { x: 1, y: 0 }, pvAvant: 10, pvApres: 7 },
  }, b.ctx), null);
  b.effets.dispose();
});

test('une partition rend une animation par geste jouable, et chacune tient sa promesse', async () => {
  const b = banc();
  const partition: Partition = {
    gestes: [
      { genre: 'glisser', unite: mienne, chemin: [{ x: 0, y: 0 }, { x: 1, y: 0 }], debut: 0, duree: DUREES.parCase },
      { genre: 'chiffre', case: { x: 1, y: 0 }, valeur: 2, teinte: 'gain', debut: 0, duree: DUREES.chiffre },
      { genre: 'tirer', unite: mienne, depuis: { x: 1, y: 0 }, vers: { x: 1, y: 1 }, debut: DUREES.parCase, duree: DUREES.tir },
    ],
    duree: DUREES.parCase + DUREES.tir,
  };
  const { animations, attentes } = animationsDePartition(partition, b.ctx);
  assert.equal(animations.length, 2, 'le chiffre est au HUD, il n’a pas d’animation ici');
  assert.equal(attentes.length, 2);
  for (const a of animations) { a.avancer(1); a.terminer?.(); }
  await Promise.all(attentes);
  assert.equal(b.visuel(mienne).clip, 'repos');
  b.effets.dispose();
});

test('la partition provisoire enchaîne les gestes d’une même unité : elle ne tire pas en marchant', () => {
  const evenements: EvenementJeu[] = [
    {
      type: 'deplacement', uniteId: mienne, de: { x: 0, y: 0 }, vers: { x: 0, y: 1 },
      chemin: [{ x: 0, y: 0 }, { x: 0, y: 1 }], interrompu: false,
    },
    { type: 'attaque', attaquantId: mienne, cibleId: sienne, degats: 30, riposte: 10 },
  ];
  const p = partitionProvisoire(evenements, etat);
  const glisser = gesteDe(p, 'glisser');
  const tirer = gesteDe(p, 'tirer', mienne);
  const encaisser = gesteDe(p, 'encaisser', sienne);
  assert.ok(glisser && tirer && encaisser);
  assert.equal(glisser.debut, 0);
  assert.equal(tirer.debut, DUREES.parCase, 'le tir attend la fin de la marche');
  assert.equal(tirer.depuis.y, 1, 'et part de la case d’arrivée');
  // Le coup est instantané : la cible accuse le choc à l'instant où il part,
  // elle n'attend pas la fin du geste du tireur.
  assert.equal(encaisser.debut, tirer.debut + tirer.duree, 'la cible encaisse à l’arrivée du projectile');
  const riposte = gesteDe(p, 'tirer', sienne);
  assert.ok(riposte, 'une riposte non nulle se joue');
  assert.equal(riposte.debut, tirer.debut + 80, 'elle riposte presque dès le départ du tir');
  assert.ok(riposte.debut < encaisser.debut, 'la riposte ne patiente pas jusqu’à l’impact');

  // Sous animations réduites, la partition existe mais ne dure pas.
  const court = partitionProvisoire(evenements, etat, true);
  assert.equal(court.duree, 0);
  assert.ok(court.gestes.every((g) => g.duree === 0 && g.debut === 0), 'tout se pose d’un coup');
  assert.equal(court.gestes.length, p.gestes.length, 'aucun geste perdu');
});

test('se cacher voile la pièce sur place, se montrer la dévoile, et la fin rend la parole à l’état', () => {
  const b = banc();
  const voiler: Geste = { genre: 'voiler', unite: mienne, case: { x: 0, y: 0 }, debut: 100, duree: DUREES.voiler };
  const a = gesteVersAnimation(voiler, b.ctx);
  assert.ok(a);
  assert.equal(a.animation.duree, 100 + DUREES.voiler, 'le début est encodé dans la durée');
  const v = b.visuel(mienne);
  // Avant son tour, la pièce garde le voile d'avant : aucun. L'état, lui, la
  // dit déjà furtive — c'est le geste qui retient la bascule.
  a.animation.avancer(0.05);
  assert.equal(v.voile, 0);
  a.animation.avancer((100 + DUREES.voiler / 2) / (100 + DUREES.voiler));
  assert.ok(v.voile !== null && Math.abs(v.voile - 0.5) < 1e-6, 'à mi-geste, la moitié du voile');
  assert.deepEqual([v.dx, v.dz, v.dy, v.opacite], [0, 0, 0, 1], 'rien ne bouge ni ne rétrécit : seule l’opacité du calque change');
  a.animation.terminer?.();
  assert.equal(v.voile, null, 'fini, c’est l’état qui dit si elle est furtive');

  const devoiler: Geste = { genre: 'devoiler', unite: mienne, case: { x: 0, y: 0 }, debut: 0, duree: DUREES.voiler };
  const d = gesteVersAnimation(devoiler, b.ctx);
  assert.ok(d);
  d.animation.avancer(0.25);
  assert.ok(v.voile !== null && Math.abs(v.voile - 0.75) < 1e-6, 'le voile se lève');
  d.animation.terminer?.();
  assert.equal(v.voile, null);
  // Le geste ne déplace aucun porteur d'ombre : c'est le calque qui signale le
  // changement d'ombre quand il habille la pièce.
  assert.ok(b.images > 0);
  b.effets.dispose();
});

test('la partition provisoire écrit le voile après la marche de la même unité', () => {
  const evenements: EvenementJeu[] = [
    {
      type: 'deplacement', uniteId: mienne, de: { x: 0, y: 0 }, vers: { x: 2, y: 0 },
      chemin: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], interrompu: false,
    },
    { type: 'furtivite', uniteId: mienne, furtive: true },
  ];
  const p = partitionProvisoire(evenements, etat);
  const g = gesteDe(p, 'voiler', mienne);
  assert.ok(g);
  assert.equal(g.debut, 2 * DUREES.parCase, 'après deux cases de marche');
  assert.deepEqual(g.case, { x: 2, y: 0 }, 'à l’arrivée');
  assert.equal(partitionProvisoire(evenements, etat, true).duree, 0, 'réduit : rien ne dure');
});


test('les profils distinguent secondaire, missile et tir indirect sans variante nationale', () => {
  const type = (cle: string, extra = {}): UnitType => ({ cle, portee: [1, 1], ...extra } as UnitType);
  assert.equal(profilTir(type('drone_intercepteur')), 'missile');
  assert.equal(profilTir(type('artillerie', { portee: [2, 3] })), 'cloche');
  assert.equal(profilTir(type('char_lourd', { armeSecondaire: ['infanterie'] }), type('infanterie')), 'rafale');
  assert.equal(profilTir(type('char_lourd')), 'marqueur');
  assert.equal(profilTir(), 'marqueur');
  assert.equal(hauteurImpact(), 0.32);
});

test('un tir réduit ou coupé avant départ ne fait naître aucun projectile ni impact', () => {
  const b = banc();
  const tir: Geste = { genre: 'tirer', unite: mienne, depuis: { x: 0, y: 0 }, vers: { x: 1, y: 0 }, debut: 0, duree: 0 };
  const a = gesteVersAnimation(tir, b.ctx)!;
  a.animation.avancer(1);
  a.animation.terminer?.();
  const choc = gesteVersAnimation({ genre: 'encaisser', unite: sienne, case: { x: 1, y: 0 }, depuis: { x: 0, y: 0 }, degats: 60, debut: 0, duree: 0 }, b.ctx)!;
  choc.animation.avancer(1);
  choc.animation.terminer?.();
  const attente = gesteVersAnimation({ ...tir, debut: 500, duree: 260 }, b.ctx)!;
  attente.animation.terminer?.();
  assert.equal(vivants(b.effets).length, 0);
  assert.equal(b.visuel(mienne).clip, 'repos');
  assert.equal(b.visuel(sienne).pv, null);
  b.effets.dispose();
});


test('le départ et la destination suivent les volumes aériens et le relief', () => {
  const courant = partiePersonnalisee(['....', '....'], {}, [
    { camp: 0, type: 'helico', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 1, y: 0 },
  ]);
  const b = banc({ courant });
  b.ctx.catalogue = () => CAT;
  b.ctx.hauteurEn = () => 0.7;
  const emissions: { position: { x: number; y: number; z: number }; destination?: { x: number; y: number; z: number } }[] = [];
  const emettre = b.effets.emettre.bind(b.effets);
  b.effets.emettre = (spec) => { emissions.push(spec); return emettre(spec); };
  const a = gesteVersAnimation({ genre: 'tirer', unite: courant.unites[0]!.id, depuis: { x: 0, y: 0 }, vers: { x: 1, y: 0 }, debut: 0, duree: 260 }, b.ctx)!;
  a.animation.avancer(0);
  assert.ok(emissions.length > 0);
  assert.equal(emissions[0]!.position.y, 0.7 + hauteurImpact(CAT.unites.helico));
  assert.equal(emissions[0]!.destination?.y, 0.7 + hauteurImpact(CAT.unites.infanterie));
  a.animation.terminer?.();
  assert.equal(vivants(b.effets).length, 0);
  b.effets.dispose();
});

// ---------------------------------------------------------------------------
// Les familles de la faction : frapper, désigner, sceller
// ---------------------------------------------------------------------------

test('une frappe de zone sème un missile et un impact par case du rayon, et les reprend en finissant', () => {
  const b = banc();
  const g: Geste = { genre: 'frapper', camp: 1, centre: { x: 1, y: 0 }, rayon: 1, debut: 0, duree: DUREES.frapper };
  const a = gesteVersAnimation(g, b.ctx);
  assert.ok(a);
  a.animation.avancer(0.1);
  // Cinq cases à rayon 1 (la carte n'est pas bornée ici), quatre effets chacune, tous émis d'un coup avec leur retard.
  assert.equal(b.effets.vivants, 5 * 4);
  assert.ok(b.images > 0, 'le rendu se salit');
  a.animation.terminer?.();
  // Le pool ne rend sa place qu'au pas suivant : ce qui compte est que rien ne reste après un pas.
  b.effets.avancer(16);
  assert.equal(b.effets.vivants, 0, 'un clic qui coupe libère les missiles, retards compris');
  b.effets.dispose();
});

test('un rayon désigne l’unité par une colonne du ciel, un éclair et un anneau ; rien ne bouge', () => {
  const b = banc();
  const g: Geste = { genre: 'designer', unite: sienne, case: { x: 1, y: 0 }, camp: 0, debut: 0, duree: DUREES.designer };
  const a = gesteVersAnimation(g, b.ctx);
  assert.ok(a);
  a.animation.avancer(0.05);
  const v = b.visuel(sienne);
  assert.deepEqual([v.dx, v.dz, v.recul, v.secousse], [0, 0, 0, 0], 'le trait marque, il ne pousse pas');
  assert.equal(b.effets.vivants, 6 + 2, 'six marches, un éclair, un anneau');
  const centre = { x: 1 * CASE + CASE / 2, z: 0 * CASE + CASE / 2 };
  for (const o of vivants(b.effets)) {
    assert.ok(Math.abs(o.position.x - centre.x) < 1e-6 && Math.abs(o.position.z - centre.z) < 1e-6, 'tout est sur la case désignée');
  }
  a.animation.terminer?.();
  b.effets.avancer(16);
  assert.equal(b.effets.vivants, 0);
  b.effets.dispose();
});

test('une impulsion referme un anneau du diamètre du rayon vers le centre', () => {
  const b = banc();
  const g: Geste = { genre: 'sceller', camp: 1, centre: { x: 1, y: 1 }, rayon: 2, debut: 0, duree: DUREES.sceller };
  const a = gesteVersAnimation(g, b.ctx);
  assert.ok(a);
  a.animation.avancer(0.02);
  b.effets.avancer(1);
  const [anneau] = vivants(b.effets);
  assert.ok(anneau, 'un anneau au sol');
  assert.ok(Math.abs(anneau.position.x - (1 * CASE + CASE / 2)) < 1e-6);
  // Il couvre cinq cases de large au départ, et se resserre.
  const largeurDepart = anneau.scale.x;
  assert.ok(Math.abs(largeurDepart - 5 * CASE) < 0.05, `l’anneau part du diamètre du rayon (${largeurDepart})`);
  b.effets.avancer(DUREES.sceller * 0.5);
  assert.ok(anneau.scale.x < largeurDepart, 'il se referme');
  a.animation.terminer?.();
  b.effets.avancer(16);
  assert.equal(b.effets.vivants, 0);
  b.effets.dispose();
});

test('sons : un départ par geste, calé sur le premier instant visible', () => {
  const b = banc();
  const cues: string[] = [];
  b.ctx.audio = { jouer: (cue) => cues.push(cue) };
  b.ctx.catalogue = () => CAT;
  const a = gesteVersAnimation({ genre: 'tirer', unite: mienne, depuis: { x: 0, y: 0 }, vers: { x: 1, y: 0 }, debut: 80, duree: 320 }, b.ctx)!;
  a.animation.avancer(0);
  a.animation.avancer(0.19);
  assert.deepEqual(cues, []);
  a.animation.avancer(0.2);
  a.animation.avancer(0.5);
  a.animation.avancer(1);
  a.animation.terminer?.();
  assert.deepEqual(cues, ['rafale']);
  b.effets.dispose();
});

test('sons : annuler, sauter une animation ou réduire sa durée ne lance aucun son tardif', () => {
  for (const mode of ['annuler', 'sauter', 'reduit']) {
    const b = banc();
    const cues: string[] = [];
    b.ctx.audio = { jouer: (cue) => cues.push(cue) };
    const a = gesteVersAnimation({ genre: 'encaisser', unite: mienne, case: { x: 0, y: 0 }, depuis: { x: 1, y: 0 }, degats: 20, debut: 0, duree: mode === 'reduit' ? 0 : 300 }, b.ctx)!;
    if (mode === 'annuler') { a.animation.terminer?.(); a.animation.avancer(0.5); }
    else { a.animation.avancer(1); a.animation.terminer?.(); }
    assert.deepEqual(cues, [], mode);
    b.effets.dispose();
  }
});


test('sons : une attaque hors de vue reste silencieuse', () => {
  const b = banc();
  const cues: string[] = [];
  b.ctx.audio = { jouer: (cue) => cues.push(cue) };
  b.ctx.visible = () => false;
  const a = gesteVersAnimation({ genre: 'tirer', unite: mienne, depuis: { x: 0, y: 0 }, vers: { x: 1, y: 0 }, debut: 0, duree: 300 }, b.ctx)!;
  a.animation.avancer(0);
  a.animation.terminer?.();
  assert.deepEqual(cues, []);
  b.effets.dispose();
});
