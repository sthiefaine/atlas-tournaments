/**
 * Le réalisateur : des événements du moteur à une partition de gestes datés.
 *
 * Pur, sans DOM ni three.js : on vérifie l'ordre, les débuts et les durées au
 * millième, la teinte des chiffres, l'écran de combat et le cadrage, sur des
 * états construits en mémoire.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { EtatPartie, EvenementJeu } from '../../src/engine/index';
import { uniteParId } from '../../src/engine/index';
import {
  DUREES, MISE_EN_SCENE, dixiemes, ecrirePartition, type Geste, type OptionsPartition, type Partition,
} from '../../src/render/partition';
import { partiePersonnalisee } from '../engine/aides';

const etat = partiePersonnalisee(['.....', '.....', '.....'], { '2,2': 1 }, [
  { camp: 0, type: 'infanterie', x: 0, y: 0 },
  { camp: 1, type: 'infanterie', x: 1, y: 0 },
  { camp: 0, type: 'genie', x: 2, y: 2 },
]);
const [mienne, sienne, genie] = etat.unites.map((u) => u.id) as [string, string, string];

const OPTIONS: OptionsPartition = { camp: 0, reduit: false, cadrer: false, ecranCombat: false };

/** L'état d'après un échange : la cible a perdu `degats`, l'attaquant `riposte`. */
function apresCombat(avant: EtatPartie, attaquant: string, cible: string, degats: number, riposte: number): EtatPartie {
  const copie = structuredClone(avant);
  const a = uniteParId(copie, attaquant);
  const c = uniteParId(copie, cible);
  if (a) a.pv = Math.max(0, a.pv - riposte);
  if (c) c.pv = Math.max(0, c.pv - degats);
  copie.unites = copie.unites.filter((u) => u.pv > 0);
  return copie;
}

const marche: EvenementJeu = {
  type: 'deplacement', uniteId: mienne, de: { x: 0, y: 0 }, vers: { x: 0, y: 2 },
  chemin: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }], interrompu: false,
};
const attaque: EvenementJeu = { type: 'attaque', attaquantId: mienne, cibleId: sienne, degats: 34, riposte: 12 };

function genres(p: Partition): string[] {
  return p.gestes.map((g) => g.genre);
}
function seul<G extends Geste['genre']>(p: Partition, genre: G, rang = 0): Extract<Geste, { genre: G }> {
  const trouves = p.gestes.filter((g): g is Extract<Geste, { genre: G }> => g.genre === genre);
  const g = trouves[rang];
  assert.ok(g, `pas de geste ${genre} au rang ${rang}`);
  return g;
}

test('les dixièmes : arrondi au plus proche, jamais 0 pour un coup réel', () => {
  assert.equal(dixiemes(0), 0);
  assert.equal(dixiemes(3), 1);
  assert.equal(dixiemes(34), 3);
  assert.equal(dixiemes(35), 4);
  assert.equal(dixiemes(100), 10);
});

test('avancer puis tirer : marche, tir depuis l’arrivée, coup encaissé, riposte, dans cet ordre et à ces instants', () => {
  const p = ecrirePartition([marche, attaque], etat, apresCombat(etat, mienne, sienne, 34, 12), OPTIONS);
  assert.deepEqual(genres(p), ['glisser', 'tirer', 'encaisser', 'chiffre', 'tirer', 'encaisser', 'chiffre']);
  const dureeMarche = 2 * DUREES.parCase;
  const glisser = seul(p, 'glisser');
  assert.equal(glisser.debut, 0);
  assert.equal(glisser.duree, dureeMarche);
  assert.deepEqual(glisser.chemin, marche.type === 'deplacement' ? marche.chemin : []);

  // Le tir attend la fin de la marche et part de la case d'arrivée — pas de (0,0).
  const tir = seul(p, 'tirer');
  assert.equal(tir.debut, dureeMarche, 'la figurine ne tire pas en marchant');
  assert.deepEqual(tir.depuis, { x: 0, y: 2 });
  assert.deepEqual(tir.vers, { x: 1, y: 0 });

  // La cible encaisse à la fin du tir, depuis la case du tireur.
  const coup = seul(p, 'encaisser');
  assert.equal(coup.unite, sienne);
  assert.equal(coup.debut, dureeMarche + DUREES.tir);
  assert.equal(coup.degats, 34);
  assert.deepEqual(coup.depuis, { x: 0, y: 2 });

  // La riposte : le défenseur tire vers l'arrivée quand il a fini d'encaisser ;
  // l'attaquant encaisse à la fin de ce tir.
  const riposte = seul(p, 'tirer', 1);
  assert.equal(riposte.unite, sienne);
  assert.equal(riposte.debut, coup.debut + DUREES.encaisser);
  assert.deepEqual(riposte.vers, { x: 0, y: 2 });
  const contre = seul(p, 'encaisser', 1);
  assert.equal(contre.unite, mienne);
  assert.equal(contre.debut, riposte.debut + DUREES.tir);
  assert.equal(contre.degats, 12);
  // Le dernier geste est le chiffre de la riposte, qui flotte plus longtemps que la secousse.
  assert.equal(p.duree, contre.debut + DUREES.chiffre, 'la partition finit avec le dernier geste');
});

test('les chiffres tombent à la fin du tir, en dixièmes, teintés par rapport au joueur', () => {
  const p = ecrirePartition([attaque], etat, apresCombat(etat, mienne, sienne, 34, 12), OPTIONS);
  const [coup, contre] = p.gestes.filter((g): g is Extract<Geste, { genre: 'chiffre' }> => g.genre === 'chiffre');
  assert.ok(coup && contre);
  // Le joueur frappe : c'est un gain pour lui, sur la case de la cible.
  assert.deepEqual([coup.case, coup.valeur, coup.teinte, coup.debut], [{ x: 1, y: 0 }, 3, 'gain', DUREES.tir]);
  // Il encaisse la riposte : une perte, sur sa case.
  assert.deepEqual([contre.case, contre.valeur, contre.teinte], [{ x: 0, y: 0 }, 1, 'perte']);
  assert.equal(contre.debut, seul(p, 'encaisser', 1).debut);

  // Vu du camp 1, les teintes s'inversent : le chiffre parle toujours au joueur.
  const inverse = ecrirePartition([attaque], etat, apresCombat(etat, mienne, sienne, 34, 12), { ...OPTIONS, camp: 1 });
  const teintes = inverse.gestes.filter((g) => g.genre === 'chiffre').map((g) => (g.genre === 'chiffre' ? g.teinte : ''));
  assert.deepEqual(teintes, ['perte', 'gain']);
});

test('sans riposte, un seul tir, un seul coup, un seul chiffre', () => {
  const p = ecrirePartition([{ ...attaque, riposte: 0 }], etat, apresCombat(etat, mienne, sienne, 34, 0), OPTIONS);
  assert.deepEqual(genres(p), ['tirer', 'encaisser', 'chiffre']);
});

test('l’écran de combat ne s’écrit que si l’option l’allume, et décale le tir sous lui', () => {
  const apres = apresCombat(etat, mienne, sienne, 34, 12);
  const sans = ecrirePartition([marche, attaque], etat, apres, OPTIONS);
  assert.equal(sans.gestes.some((g) => g.genre === 'duel'), false);

  const avec = ecrirePartition([marche, attaque], etat, apres, { ...OPTIONS, ecranCombat: true });
  const duel = seul(avec, 'duel');
  const dureeMarche = 2 * DUREES.parCase;
  assert.equal(duel.debut, dureeMarche, 'l’écran s’ouvre quand l’attaquant est arrivé');
  assert.equal(duel.duree, DUREES.duel);
  assert.equal(duel.riposte, true);
  assert.deepEqual(duel.attaquant, {
    unite: mienne, type: 'infanterie', camp: 0, case: { x: 0, y: 2 }, pvAvant: 10, pvApres: 9,
  });
  assert.deepEqual(duel.cible, {
    unite: sienne, type: 'infanterie', camp: 1, case: { x: 1, y: 0 }, pvAvant: 10, pvApres: 7,
  });
  // Le tir part quand l'écran montre le coup ; la riposte quand il la montre.
  const tir = seul(avec, 'tirer');
  assert.equal(tir.debut, dureeMarche + Math.round(DUREES.duel * MISE_EN_SCENE.partCoup));
  const coup = seul(avec, 'chiffre');
  assert.equal(coup.debut, tir.debut + DUREES.tir);
  const riposte = seul(avec, 'tirer', 1);
  assert.equal(riposte.debut, dureeMarche + Math.round(DUREES.duel * MISE_EN_SCENE.partRiposte));
  assert.ok(riposte.debut >= coup.debut + DUREES.encaisser, 'le défenseur a fini d’encaisser avant de riposter');
  assert.ok(seul(avec, 'encaisser', 1).debut + DUREES.encaisser <= duel.debut + duel.duree, 'tout tient sous l’écran');
});

test('une mise hors jeu qui suit le coup attend qu’il soit encaissé', () => {
  const apres = apresCombat(etat, mienne, sienne, 100, 0);
  const p = ecrirePartition([
    { ...attaque, degats: 100, riposte: 0 },
    { type: 'hors_jeu', uniteId: sienne, camp: 1, unite: 'infanterie' },
  ], etat, apres, { ...OPTIONS, ecranCombat: true });
  const sortir = seul(p, 'sortir');
  assert.deepEqual(sortir.case, { x: 1, y: 0 }, 'la case est lue dans l’état d’avant : l’unité n’existe plus après');
  assert.equal(sortir.debut, seul(p, 'encaisser').debut + DUREES.encaisser);
  assert.equal(seul(p, 'duel').cible.pvApres, 0);
});

test('une capture qui suit une remise en service de la même case attend la palissade', () => {
  const p = ecrirePartition([
    { type: 'remise_en_service', uniteId: genie, case: { x: 2, y: 2 }, camp: 0, prime: 2000 },
    { type: 'capture', uniteId: genie, case: { x: 2, y: 2 }, points: 40, acquis: true, camp: 0 },
  ], etat, etat, OPTIONS);
  assert.deepEqual(genres(p), ['remettre', 'hisser']);
  assert.equal(seul(p, 'hisser').debut, DUREES.remettre);
  assert.equal(seul(p, 'hisser').duree, DUREES.hisser);
  // Une autre unité qui capturerait la même case attendrait tout autant.
  const autre = ecrirePartition([
    { type: 'remise_en_service', uniteId: genie, case: { x: 2, y: 2 }, camp: 0, prime: 2000 },
    { type: 'capture', uniteId: mienne, case: { x: 2, y: 2 }, points: 10, acquis: false, camp: 0 },
  ], etat, etat, OPTIONS);
  assert.equal(seul(autre, 'hisser').debut, DUREES.remettre);
  assert.equal(seul(autre, 'hisser').duree, DUREES.hisserUnCran);
});

test('une capture qui suit une marche attend la fin de la marche', () => {
  const p = ecrirePartition([
    marche,
    { type: 'capture', uniteId: mienne, case: { x: 0, y: 2 }, points: 10, acquis: false, camp: 0 },
  ], etat, etat, OPTIONS);
  assert.equal(seul(p, 'hisser').debut, 2 * DUREES.parCase);
});

test('le pouvoir passe en tête, et ses constructions se posent l’une après l’autre derrière lui', () => {
  // Le moteur pousse `pouvoir` en dernier : le réalisateur le remet devant.
  const p = ecrirePartition([
    { type: 'terrain_pose', case: { x: 1, y: 1 }, terrain: 'foret' },
    { type: 'terrain_pose', case: { x: 3, y: 1 }, terrain: 'foret' },
    { type: 'terrain_retire', case: { x: 4, y: 1 } },
    { type: 'pouvoir', camp: 0, niveau: 'normal', nom: 'commandant.cmd_test.pouvoir' },
  ], etat, etat, OPTIONS);
  assert.deepEqual(genres(p), ['pouvoir', 'batir', 'batir', 'batir']);
  const pouvoir = seul(p, 'pouvoir');
  assert.deepEqual([pouvoir.debut, pouvoir.duree, pouvoir.nom, pouvoir.niveau], [0, DUREES.pouvoir, 'commandant.cmd_test.pouvoir', 'normal']);
  const batirs = p.gestes.filter((g): g is Extract<Geste, { genre: 'batir' }> => g.genre === 'batir');
  assert.deepEqual(batirs.map((b) => b.debut), [
    DUREES.pouvoir, DUREES.pouvoir + MISE_EN_SCENE.ecartBatir, DUREES.pouvoir + 2 * MISE_EN_SCENE.ecartBatir,
  ]);
  assert.deepEqual(batirs.map((b) => b.terrain), ['foret', 'foret', null]);
  assert.equal(batirs[0]!.duree, DUREES.batir);
});

test('le cadrage : seulement si l’option l’autorise, jamais sur le camp du joueur, une fois par unité', () => {
  const salveAdverse: EvenementJeu[] = [
    {
      type: 'deplacement', uniteId: sienne, de: { x: 1, y: 0 }, vers: { x: 1, y: 2 },
      chemin: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }], interrompu: false,
    },
    { type: 'attaque', attaquantId: sienne, cibleId: genie, degats: 20, riposte: 5 },
  ];
  const apres = apresCombat(etat, sienne, genie, 20, 5);
  const sans = ecrirePartition(salveAdverse, etat, apres, OPTIONS);
  assert.equal(sans.gestes.some((g) => g.genre === 'cadrer'), false, 'pas de cadrage hors tour de l’IA');

  const avec = ecrirePartition(salveAdverse, etat, apres, { ...OPTIONS, cadrer: true });
  const cadrages = avec.gestes.filter((g): g is Extract<Geste, { genre: 'cadrer' }> => g.genre === 'cadrer');
  assert.equal(cadrages.length, 1, 'un cadrage pour l’unité qui agit, pas un par geste');
  assert.deepEqual(cadrages[0]!.case, { x: 1, y: 0 });
  assert.equal(cadrages[0]!.debut, 0);
  assert.equal(cadrages[0]!.duree, 0);
  assert.equal(avec.gestes[0]!.genre, 'cadrer', 'la caméra se place avant le premier geste');

  // Le joueur qui joue pendant que `cadrer` est vrai — jamais le cas, mais la
  // règle tient : on ne recadre pas sur ses propres unités.
  const joueur = ecrirePartition([marche, attaque], etat, apresCombat(etat, mienne, sienne, 34, 12), { ...OPTIONS, cadrer: true });
  assert.equal(joueur.gestes.some((g) => g.genre === 'cadrer'), false);

  // Une longue marche adverse mérite un second cadrage, sur l'arrivée.
  const longue = ecrirePartition([{
    type: 'deplacement', uniteId: sienne, de: { x: 1, y: 0 }, vers: { x: 4, y: 2 },
    chemin: [{ x: 1, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }], interrompu: false,
  }], etat, etat, { ...OPTIONS, cadrer: true });
  const deux = longue.gestes.filter((g): g is Extract<Geste, { genre: 'cadrer' }> => g.genre === 'cadrer');
  assert.equal(deux.length, 2);
  assert.deepEqual(deux[1]!.case, { x: 4, y: 2 });
  assert.equal(deux[1]!.debut, 5 * DUREES.parCase);
});

test('réduit : tout dure 0 et commence à 0, mais les gestes sont tous là', () => {
  const evts: EvenementJeu[] = [
    { type: 'terrain_pose', case: { x: 1, y: 1 }, terrain: 'foret' },
    { type: 'pouvoir', camp: 0, niveau: 'super', nom: 'commandant.cmd_test.super' },
    marche, attaque,
  ];
  const apres = apresCombat(etat, mienne, sienne, 34, 12);
  const plein = ecrirePartition(evts, etat, apres, { ...OPTIONS, ecranCombat: true });
  const reduit = ecrirePartition(evts, etat, apres, { ...OPTIONS, ecranCombat: true, reduit: true });
  assert.deepEqual(genres(reduit), genres(plein));
  assert.equal(reduit.duree, 0);
  for (const g of reduit.gestes) {
    assert.equal(g.debut, 0, g.genre);
    assert.equal(g.duree, 0, g.genre);
  }
});

test('les autres événements ont chacun leur geste, posé où l’unité se trouve', () => {
  const transport = partiePersonnalisee(['....', '....'], {}, [
    { camp: 0, type: 'transport', x: 0, y: 0 },
    { camp: 0, type: 'infanterie', x: 1, y: 0 },
    { camp: 0, type: 'infanterie', x: 2, y: 0 },
  ]);
  const [porteur, fantassin, second] = transport.unites.map((u) => u.id) as [string, string, string];
  const p = ecrirePartition([
    { type: 'production', camp: 1, unite: 'char_leger', case: { x: 3, y: 1 }, cout: 7000 },
    {
      type: 'deplacement', uniteId: fantassin, de: { x: 1, y: 0 }, vers: { x: 0, y: 0 },
      chemin: [{ x: 1, y: 0 }, { x: 0, y: 0 }], interrompu: false,
    },
    { type: 'embarquement', uniteId: fantassin, transportId: porteur },
    { type: 'debarquement', uniteId: fantassin, transportId: porteur, vers: { x: 0, y: 1 } },
    { type: 'fusion', uniteId: second, avecId: fantassin, rembourse: 0 },
    { type: 'ravitaillement', uniteId: porteur, cibleId: second },
    { type: 'reparation', uniteId: second, pv: 20, cout: 200 },
    { type: 'repousse', uniteId: second, vers: { x: 3, y: 0 } },
    { type: 'degats_mecanique', uniteId: second, pv: 15 },
    { type: 'panne_seche', uniteId: second },
    { type: 'annonce', texte: 'rien' },
  ], transport, transport, { ...OPTIONS, cadrer: true });
  assert.deepEqual(genres(p), [
    'cadrer', 'apparaitre', 'glisser', 'embarquer', 'debarquer', 'fusionner', 'ravitailler',
    'reparer', 'chiffre', 'repousser', 'encaisser', 'chiffre',
  ]);
  // Une production adverse se cadre ; l'unité produite apparaît sur son bâtiment.
  assert.deepEqual(seul(p, 'cadrer').case, { x: 3, y: 1 });
  assert.deepEqual(seul(p, 'apparaitre'), { genre: 'apparaitre', unite: 'char_leger', case: { x: 3, y: 1 }, camp: 1, debut: 0, duree: DUREES.apparaitre });
  // L'embarquement part de là où le fantassin est **arrivé**, et attend sa marche.
  const emb = seul(p, 'embarquer');
  assert.deepEqual([emb.de, emb.vers, emb.debut], [{ x: 0, y: 0 }, { x: 0, y: 0 }, DUREES.parCase]);
  const deb = seul(p, 'debarquer');
  assert.deepEqual([deb.de, deb.vers, deb.debut], [{ x: 0, y: 0 }, { x: 0, y: 1 }, emb.debut + DUREES.embarquer]);
  // La fusion va vers la case où le fantassin a débarqué.
  const fus = seul(p, 'fusionner');
  assert.deepEqual([fus.de, fus.vers], [{ x: 2, y: 0 }, { x: 0, y: 1 }]);
  assert.equal(fus.debut, deb.debut + DUREES.embarquer, 'elle attend que l’autre soit posé');
  // Le ravitaillement se joue sur la case de la cible, sans chiffre.
  assert.deepEqual(seul(p, 'ravitailler').case, { x: 2, y: 0 });
  // La réparation rend un chiffre vert de 2 dixièmes.
  const rep = seul(p, 'chiffre');
  assert.deepEqual([rep.valeur, rep.teinte, rep.debut], [2, 'gain', seul(p, 'reparer').debut]);
  // Le repoussé va où le moteur l'a mis ; le coup mécanique le suit là-bas, sans tireur.
  const rep2 = seul(p, 'repousser');
  assert.deepEqual(rep2.vers, { x: 3, y: 0 });
  const meca = seul(p, 'encaisser');
  assert.deepEqual([meca.case, meca.depuis, meca.degats], [{ x: 3, y: 0 }, { x: 3, y: 0 }, 15]);
  assert.equal(meca.debut, rep2.debut + DUREES.repousser);
  assert.deepEqual([seul(p, 'chiffre', 1).valeur, seul(p, 'chiffre', 1).teinte], [2, 'perte']);
});

test('un déplacement sans case parcourue ne fait pas de geste, mais pose la position', () => {
  const p = ecrirePartition([
    { type: 'deplacement', uniteId: mienne, de: { x: 0, y: 0 }, vers: { x: 0, y: 0 }, chemin: [{ x: 0, y: 0 }], interrompu: false },
    { ...attaque, riposte: 0 },
  ], etat, apresCombat(etat, mienne, sienne, 34, 0), OPTIONS);
  assert.deepEqual(genres(p), ['tirer', 'encaisser', 'chiffre']);
  assert.equal(seul(p, 'tirer').debut, 0);
});

test('déterminisme : même entrée, même partition', () => {
  const evts: EvenementJeu[] = [marche, attaque, { type: 'hors_jeu', uniteId: sienne, camp: 1, unite: 'infanterie' }];
  const apres = apresCombat(etat, mienne, sienne, 100, 12);
  const options = { ...OPTIONS, ecranCombat: true, cadrer: true };
  assert.deepEqual(ecrirePartition(evts, etat, apres, options), ecrirePartition(evts, etat, apres, options));
});
