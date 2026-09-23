// L'interprète de la partition pour la 2D : les gestes poussent un état visuel,
// jamais un état de jeu ; un geste coupé pose son état final exact ; la
// promesse tient jusqu'à la dernière image.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pvAffiches, type EtatPartie } from '../../src/engine/index';
import type { Son } from '../../src/audio/types';
import { Boucle, type Horloge } from '../../src/render/boucle';
import type { Geste, Partition } from '../../src/render/partition';
import {
  animationsDePartition, corpsDe, EXECUTANTS, type ContexteAnimation2d, type PriseDrapeau2d,
} from '../../src/render2d/animations';
import type { PoseDrapeau } from '../../src/render2d/batiments';
import { Visuels } from '../../src/render2d/unites';
import { CAT, partiePersonnalisee } from '../engine/aides';

/** Une horloge qu'on avance à la main : la boucle ne tourne que quand on le dit. */
function horlogeManuelle() {
  let rappel: ((t: number) => void) | null = null;
  let t = 0;
  const horloge: Horloge = {
    planifier: (r) => { rappel = r; return 1; },
    annuler: () => { rappel = null; },
    maintenant: () => t,
  };
  return {
    horloge,
    avancer(ms: number): void {
      t += ms;
      const r = rappel;
      rappel = null;
      r?.(t);
    },
  };
}

function essai(avant: EtatPartie, apres: EtatPartie, visible = true) {
  const visuels = new Visuels();
  const sons: Son[] = [];
  const cadrages: string[] = [];
  const forces = new Map<string, PoseDrapeau>();
  const ctx: ContexteAnimation2d = {
    visuels,
    etats: () => ({ courant: apres, precedent: avant }),
    catalogue: () => CAT,
    cadrer: (c) => { cadrages.push(`${c.x},${c.y}`); },
    drapeau: (cle): PriseDrapeau2d => ({
      poseDans: (e) => ({ camp: e.proprietaires[cle] ?? null, niveau: e.proprietaires[cle] === undefined ? 0 : 1 }),
      forcer: (p) => { forces.set(cle, p); },
      relacher: () => { forces.delete(cle); },
    }),
    audio: { jouer: (s) => { sons.push(s); } },
    visible: () => visible,
    temps: () => 0,
    salir: () => undefined,
  };
  const h = horlogeManuelle();
  const boucle = new Boucle(() => undefined, h.horloge);
  const jouer = (p: Partition): Promise<void> => {
    const { animations, attentes } = animationsDePartition(p, ctx);
    for (const a of animations) boucle.ajouter(a);
    return Promise.all(attentes).then(() => undefined);
  };
  return { visuels, sons, cadrages, forces, ctx, boucle, avancer: h.avancer, jouer };
}

function deuxEtats(): { avant: EtatPartie; apres: EtatPartie } {
  const avant = partiePersonnalisee(['PPPPP', 'PPPPP', 'CPPPP'], { '0,2': 1 }, [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 4, y: 0 },
  ]);
  const apres = structuredClone(avant);
  return { avant, apres };
}

test('un glissement suit le chemin du moteur, part du début de ce chemin, et se pose à l’arrivée', async () => {
  const { avant, apres } = deuxEtats();
  const id = avant.unites[0]!.id;
  apres.unites[0]!.x = 2;
  apres.unites[0]!.y = 1;
  const chemin = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }];
  const e = essai(avant, apres);
  const fin = e.jouer({ gestes: [{ genre: 'glisser', unite: id, chemin, debut: 100, duree: 300 }], duree: 400 });
  let fini = false;
  void fin.then(() => { fini = true; });
  e.avancer(16);
  const v = e.visuels.visuel(id);
  // En attendant son départ, l'unité est au début de son chemin — l'état la dit déjà arrivée.
  assert.deepEqual([v.dx, v.dy], [-2, -1]);
  // Dix images : l'élan est pris, la marche est lancée.
  for (let i = 0; i < 10; i++) e.avancer(16);
  assert.ok(v.dx > -2 && v.dx <= 0, `au milieu du chemin : ${v.dx}`);
  assert.equal(v.clip, 'deplacement');
  assert.equal(v.orientation, 'droite');
  for (let i = 0; i < 30; i++) e.avancer(16);
  await fin;
  assert.equal(fini, true);
  assert.deepEqual([v.dx, v.dy, v.orientation, v.clip], [0, 0, null, 'repos']);
  assert.deepEqual(e.sons, ['pas', 'pas'], 'le bruit de la marche, un pas toutes les 280 ms');
});

test('couper saute à l’état final exact et tient la promesse', async () => {
  const { avant, apres } = deuxEtats();
  const id = avant.unites[0]!.id;
  const e = essai(avant, apres);
  const fin = e.jouer({ gestes: [{ genre: 'glisser', unite: id, chemin: [{ x: 3, y: 0 }, { x: 0, y: 0 }], debut: 0, duree: 360 }], duree: 360 });
  e.avancer(16);
  assert.notEqual(e.visuels.visuel(id).dx, 0);
  e.boucle.viderFile(true);
  await fin;
  const v = e.visuels.visuel(id);
  assert.deepEqual([v.dx, v.dy, v.clip], [0, 0, 'repos']);
});

test('encaisser retient les PV d’avant le coup, et les relâche quand le coup est pris', async () => {
  const { avant, apres } = deuxEtats();
  const cible = avant.unites[1]!;
  apres.unites[1]!.pv = 40;
  const e = essai(avant, apres);
  const fin = e.jouer({ gestes: [{ genre: 'encaisser', unite: cible.id, case: { x: 4, y: 0 }, degats: 60, depuis: { x: 0, y: 0 }, debut: 50, duree: 300 }], duree: 350 });
  e.avancer(16);
  const v = e.visuels.visuel(cible.id);
  assert.equal(v.pv, pvAffiches(cible.pv), 'avant même le départ du geste');
  e.avancer(80);
  assert.ok(v.eclat > 0, 'l’éclat du coup');
  for (let i = 0; i < 30; i++) e.avancer(16);
  await fin;
  assert.equal(v.pv, null);
  assert.equal(v.eclat, 0);
  assert.deepEqual(e.sons, ['impact']);
});

test('une unité mise hors jeu reste à l’écran le temps de sortir, puis est relâchée', async () => {
  const { avant, apres } = deuxEtats();
  const id = avant.unites[1]!.id;
  apres.unites.splice(1, 1);
  const e = essai(avant, apres);
  const fin = e.jouer({ gestes: [{ genre: 'sortir', unite: id, case: { x: 4, y: 0 }, debut: 0, duree: 420 }], duree: 420 });
  assert.equal(e.visuels.estRetenue(id), true, 'retenue dès la construction du geste');
  // Elle chancelle d'abord, éclate au tiers, puis s'efface.
  for (let i = 0; i < 19; i++) e.avancer(16);
  assert.ok(e.visuels.visuel(id).opacite < 1);
  for (let i = 0; i < 30; i++) e.avancer(16);
  await fin;
  assert.equal(e.visuels.estRetenue(id), false);
});

test('une unité qui glisse puis sort s’efface là où elle est arrivée', async () => {
  const { avant, apres } = deuxEtats();
  const id = avant.unites[0]!.id;
  apres.unites.splice(0, 1);
  const e = essai(avant, apres);
  const fin = e.jouer({
    gestes: [
      { genre: 'glisser', unite: id, chemin: [{ x: 0, y: 0 }, { x: 3, y: 0 }], debut: 0, duree: 360 },
      { genre: 'sortir', unite: id, case: { x: 3, y: 0 }, debut: 360, duree: 420 },
    ],
    duree: 780,
  });
  for (let i = 0; i < 26; i++) e.avancer(16);
  // Le glissement fini, l'unité retenue a été reposée à son arrivée, sans décalage de
  // marche : il ne reste que le tremblement de la sortie, qui ne dépasse pas deux centièmes.
  assert.equal(e.visuels.retenue(id)?.x, 3);
  assert.ok(Math.abs(e.visuels.visuel(id).dx) <= 0.02, `${e.visuels.visuel(id).dx}`);
  for (let i = 0; i < 40; i++) e.avancer(16);
  await fin;
});

test('une capture qui change de mains amène les anciennes couleurs, puis hisse les nouvelles', async () => {
  const { avant, apres } = deuxEtats();
  apres.proprietaires['0,2'] = 0;
  const id = avant.unites[0]!.id;
  const e = essai(avant, apres);
  const fin = e.jouer({ gestes: [{ genre: 'hisser', unite: id, case: { x: 0, y: 2 }, camp: 0, points: 20, acquis: true, debut: 0, duree: 1100 }], duree: 1100 });
  e.avancer(200);
  assert.equal(e.forces.get('0,2')?.camp, 1, 'd’abord les couleurs d’avant descendent');
  for (let i = 0; i < 20; i++) e.avancer(30);
  assert.equal(e.forces.get('0,2')?.camp, 0, 'puis les nouvelles montent');
  for (let i = 0; i < 40; i++) e.avancer(30);
  await fin;
  assert.equal(e.forces.has('0,2'), false, 'le drapeau rendu à l’état');
  assert.deepEqual(e.sons, ['capture']);
});

test('un son ne révèle jamais une case hors de vue', async () => {
  const { avant, apres } = deuxEtats();
  const e = essai(avant, apres, false);
  const fin = e.jouer({ gestes: [{ genre: 'encaisser', unite: avant.unites[1]!.id, case: { x: 4, y: 0 }, degats: 10, depuis: { x: 4, y: 0 }, debut: 0, duree: 100 }], duree: 100 });
  for (let i = 0; i < 10; i++) e.avancer(16);
  await fin;
  assert.deepEqual(e.sons, []);
});

test('le cadrage de la partition amène la case au champ, une fois', async () => {
  const { avant, apres } = deuxEtats();
  const e = essai(avant, apres);
  const fin = e.jouer({ gestes: [{ genre: 'cadrer', case: { x: 4, y: 2 }, debut: 0, duree: 0 }], duree: 0 });
  e.avancer(16);
  await fin;
  assert.deepEqual(e.cadrages, ['4,2']);
});

test('un genre sans exécutant ne joue rien et ne retient personne ; ceux du HUD n’en ont pas', () => {
  const { avant, apres } = deuxEtats();
  const e = essai(avant, apres);
  const chiffre: Geste = { genre: 'chiffre', case: { x: 0, y: 0 }, valeur: 3, teinte: 'perte', debut: 0, duree: 900 };
  assert.equal(corpsDe(chiffre, e.ctx), null);
  assert.equal(EXECUTANTS.duel, undefined);
  assert.equal(EXECUTANTS.chiffre, undefined);
  for (const genre of [
    'glisser', 'tirer', 'encaisser', 'sortir', 'hisser', 'remettre', 'batir', 'apparaitre', 'embarquer', 'debarquer',
    'fusionner', 'ravitailler', 'reparer', 'repousser', 'pouvoir', 'cadrer', 'voiler', 'devoiler', 'surprise',
    'reveiller', 'frapper', 'designer', 'sceller',
  ] as const) {
    assert.equal(typeof EXECUTANTS[genre], 'function', genre);
  }
});
