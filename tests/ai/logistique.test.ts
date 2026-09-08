/**
 * Le cerveau logistique de l'IA (7 septembre 2026) : arme secondaire d'une unité
 * à sec, retour au terrain d'une unité aérienne à court de carburant,
 * ravitaillement d'un voisin, embarquement quand le transport rapproche plus
 * vite que les jambes, débarquement près de l'objectif, achat mesuré des
 * pièces de soutien — et le déterminisme qui tient avec tout cela.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AGRESSIVE, armeeParType, autonomieSecurite, jouerPartie, jouerTour, manque, meilleureOption,
  menaceSur, PONDEREE, POIDS_PONDEREE, scoreAchat, valeurSoutien,
} from '../../src/ai/index';
import {
  appliquer, chargerCatalogue, creerPartie, creerRng, empreinte, reglagesParDefaut, sceneDeCarte,
  type Action, type EtatPartie, type Unite,
} from '../../src/engine/index';
import type { CampId, CleUnite } from '../../src/schemas/index';
import { carte, scenePersonnalisee } from '../engine/aides';

/** Le catalogue 4 : celui du transport ravitailleur et de l'arme secondaire. */
const CAT4 = chargerCatalogue(4);

/** Une partie sur une grille écrite à la main, au catalogue 4, sans brouillard ni météo. */
function partie(
  grille: string[],
  proprietaires: Record<string, CampId>,
  unites: { camp: CampId; type: CleUnite; x: number; y: number; pv?: number }[],
): EtatPartie {
  const scene = scenePersonnalisee(grille, proprietaires, unites, {
    brouillard: false, saisonForcee: 'ete', fondsDepart: 0, limiteJournees: 30,
  });
  return creerPartie(scene, CAT4, 'logistique');
}

/** Unité posée sur une case, ou une erreur lisible. */
function sur(e: EtatPartie, x: number, y: number): Unite {
  const u = e.unites.find((z) => z.x === x && z.y === y && !z.dansTransport);
  if (!u) throw new Error(`aucune unité en ${x},${y}`);
  return u;
}

/** L'ordre rendu par `meilleureOption`, avec son arrivée et sa suite. */
function decision(e: EtatPartie, u: Unite, poids = POIDS_PONDEREE) {
  const a = meilleureOption(e, CAT4, u, poids).action;
  assert.equal(a.type, 'ordre');
  if (a.type !== 'ordre') throw new Error('inatteignable');
  return { action: a, arrivee: a.chemin[a.chemin.length - 1]!, suite: a.suite };
}

const PLAINE = ['PPPPPPPPPPPP', 'PPPPPPPPPPPP', 'PPPPPPPPPPPP'];

test('un char à sec tire à la mitrailleuse sur une infanterie adjacente', () => {
  const e = partie(PLAINE, {}, [
    { camp: 0, type: 'char_leger', x: 1, y: 1 },
    { camp: 1, type: 'infanterie', x: 2, y: 1 },
  ]);
  const char = sur(e, 1, 1);
  char.munitions = 0;
  const { action, suite } = decision(e, char);
  assert.deepEqual(suite, { type: 'attaquer', cible: { x: 2, y: 1 } });
  const r = appliquer(e, action, CAT4);
  assert.equal(r.ok, true, 'le moteur accepte le tir à l’arme secondaire');
  if (r.ok) assert.equal(r.etat.unites.find((u) => u.id === char.id)?.munitions, 0, 'et ne compte aucune munition');
});

test('un char à sec attaque un char adjacent quand rien de mieux n’existe', () => {
  // À zéro munition, la mitrailleuse tire à dégâts réduits sur un blindé
  // (`degatsSecondaire`) : c'est peu, mais c'est mieux que rien — face à un char
  // lui aussi à sec, qui ne riposte qu'à la mitrailleuse. Face à un char plein,
  // la riposte au canon rend l'échange perdant, et l'IA s'abstient : c'est voulu.
  //
  // La cible est **entamée** depuis l'échelle du 8 septembre 2026 : entre deux
  // chars intacts et à sec, la mitrailleuse rend exactement autant qu'elle
  // reçoit (9 contre 9 sur plaine), et une IA qui refuse un échange nul a
  // raison. C'est l'avantage réel qu'on vérifie ici, pas l'agressivité.
  const e = partie(PLAINE, {}, [
    { camp: 0, type: 'char_leger', x: 1, y: 1 },
    { camp: 1, type: 'char_leger', x: 2, y: 1 },
  ]);
  const char = sur(e, 1, 1);
  char.munitions = 0;
  assert.equal(decision(e, char, { ...POIDS_PONDEREE, securite: 0 }).suite.type, 'rien', 'pas contre un canon chargé');
  sur(e, 2, 1).munitions = 0;
  sur(e, 2, 1).pv = 50;
  const { action, suite } = decision(e, char, { ...POIDS_PONDEREE, securite: 0 });
  assert.deepEqual(suite, { type: 'attaquer', cible: { x: 2, y: 1 } });
  const r = appliquer(e, action, CAT4);
  assert.equal(r.ok, true);
  if (r.ok) {
    const cible = r.etat.unites.find((u) => u.x === 2 && u.y === 1)!;
    assert.ok(cible.pv < 50 && cible.pv > 30, `dégâts réduits : ${cible.pv}`);
  }
});

test('la menace lit l’arme secondaire : un char à sec menace l’infanterie à plein, un char à peine', () => {
  const e = partie(PLAINE, {}, [
    { camp: 1, type: 'char_leger', x: 5, y: 1 },
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 0, type: 'char_leger', x: 0, y: 2 },
  ]);
  const adverse = sur(e, 5, 1);
  const infanterie = sur(e, 0, 0);
  const char = sur(e, 0, 2);
  const infanteriePlein = menaceSur(e, CAT4, infanterie, { x: 6, y: 1 });
  const charPlein = menaceSur(e, CAT4, char, { x: 6, y: 1 });
  adverse.munitions = 0;
  assert.equal(menaceSur(e, CAT4, infanterie, { x: 6, y: 1 }), infanteriePlein, 'cible secondaire : menace pleine');
  const charSec = menaceSur(e, CAT4, char, { x: 6, y: 1 });
  assert.ok(charSec > 0, 'la mitrailleuse compte encore');
  assert.ok(charSec < charPlein / 2, `mais bien moins que le canon : ${charSec} contre ${charPlein}`);
});

test('à une munition, une cible qui la demande coûte plus cher qu’une cible secondaire', () => {
  // Un char léger entre une infanterie (mitrailleuse) et un char léger (canon) :
  // à munitions pleines il préfère le char, qui vaut plus ; à une munition, la
  // note du canon baisse du prix de la dernière munition. On ne teste que le
  // sens de la pénalité : c'est elle qui fait pencher les cas serrés.
  const e = partie(PLAINE, {}, [
    { camp: 0, type: 'char_leger', x: 1, y: 1 },
    { camp: 1, type: 'char_leger', x: 2, y: 1 },
  ]);
  const char = sur(e, 1, 1);
  const pleine = meilleureOption(e, CAT4, char, { ...POIDS_PONDEREE, progression: 0, securite: 0 }).score;
  char.munitions = 1;
  const derniere = meilleureOption(e, CAT4, char, { ...POIDS_PONDEREE, progression: 0, securite: 0 }).score;
  assert.ok(derniere < pleine, `la dernière munition doit peser : ${derniere} contre ${pleine}`);
  assert.ok(pleine - derniere > 0 && pleine - derniere < 10, 'mais moins qu’un gain net');
});

test('un hélicoptère à court de carburant rentre se poser sur son aéroport', () => {
  const grille = ['PPPPPPPPPPPP', 'APPPPPPPPPPP', 'PPPPPPPPPPPP'];
  const e = partie(grille, { '0,1': 0 }, [
    { camp: 0, type: 'helico', x: 5, y: 1 },
    { camp: 1, type: 'infanterie', x: 11, y: 1 },
  ]);
  const helico = sur(e, 5, 1);
  helico.carburant = 5;
  assert.ok(autonomieSecurite(CAT4.unites['helico']!, 5, 5, 6, 1) < 0);
  const { action, arrivee, suite } = decision(e, helico);
  assert.deepEqual(arrivee, { x: 0, y: 1 }, 'il rentre à l’aéroport');
  assert.equal(suite.type, 'rien');
  const r = appliquer(e, action, CAT4);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  // Deux fins de tour plus tard, il a fait le plein au lieu de tomber en panne sèche.
  let apres = r.etat;
  for (const a of [{ type: 'finTour' }, { type: 'finTour' }] as Action[]) {
    const s = appliquer(apres, a, CAT4);
    assert.equal(s.ok, true);
    if (s.ok) apres = s.etat;
  }
  const revenu = apres.unites.find((u) => u.id === helico.id);
  assert.ok(revenu, 'l’hélicoptère est toujours en jeu');
  assert.equal(revenu?.carburant, CAT4.unites['helico']!.carburant!.max - CAT4.unites['helico']!.carburant!.parTour);
});

test('avec du carburant, le même hélicoptère avance vers l’adversaire', () => {
  const grille = ['PPPPPPPPPPPP', 'APPPPPPPPPPP', 'PPPPPPPPPPPP'];
  const e = partie(grille, { '0,1': 0 }, [
    { camp: 0, type: 'helico', x: 5, y: 1 },
    { camp: 1, type: 'infanterie', x: 11, y: 1 },
  ]);
  const { arrivee } = decision(e, sur(e, 5, 1));
  assert.ok(arrivee.x > 5, `il marche sur l’infanterie, pas sur l’aéroport : ${JSON.stringify(arrivee)}`);
});

test('un ravitailleur adjacent à une unité à sec la ravitaille', () => {
  const e = partie(PLAINE, {}, [
    { camp: 0, type: 'transport', x: 2, y: 1 },
    { camp: 0, type: 'char_leger', x: 3, y: 1 },
    { camp: 1, type: 'infanterie', x: 11, y: 1 },
  ]);
  const char = sur(e, 3, 1);
  char.munitions = 0;
  char.carburant = 10;
  assert.ok(manque(CAT4, char) > CAT4.unites['char_leger']!.cout);
  const { action, suite } = decision(e, sur(e, 2, 1));
  assert.deepEqual(suite, { type: 'ravitailler', cible: { x: 3, y: 1 } });
  const r = appliquer(e, action, CAT4);
  assert.equal(r.ok, true);
  if (r.ok) {
    const plein = r.etat.unites.find((u) => u.id === char.id)!;
    assert.equal(plein.munitions, CAT4.unites['char_leger']!.munitions);
    assert.equal(plein.carburant, CAT4.unites['char_leger']!.carburant!.max);
  }
});

test('un ravitailleur sans client ne ravitaille personne et reste en retrait', () => {
  const e = partie(PLAINE, {}, [
    { camp: 0, type: 'transport', x: 2, y: 1 },
    { camp: 0, type: 'char_leger', x: 3, y: 1 },
    { camp: 1, type: 'infanterie', x: 11, y: 1 },
  ]);
  const { suite } = decision(e, sur(e, 2, 1));
  assert.equal(suite.type, 'rien');
});

test('une unité à court se rapproche d’une source de ravitaillement', () => {
  // Un char à une munition, un adversaire hors de portée à droite, son usine à gauche.
  const grille = ['PPPPPPPPPPPPPPPP', 'UPPPPPPPPPPPPPPP', 'PPPPPPPPPPPPPPPP'];
  const e = partie(grille, { '0,1': 0 }, [
    { camp: 0, type: 'char_leger', x: 7, y: 1 },
    { camp: 1, type: 'char_leger', x: 15, y: 0 },
  ]);
  const char = sur(e, 7, 1);
  char.munitions = 1;
  char.carburant = 8;
  const { arrivee } = decision(e, char);
  assert.ok(arrivee.x < 7, `il rentre vers l’usine : ${JSON.stringify(arrivee)}`);
});

const LONGUE = ['PPPPPPPPPPPPPPPPPPPP', 'PPPPPPPPPPPPPPPPPPPC', 'PPPPPPPPPPPPPPPPPPPP'];

test('une infanterie embarque quand le transport la rapproche plus vite que ses jambes', () => {
  const e = partie(LONGUE, {}, [
    { camp: 0, type: 'infanterie', x: 1, y: 1 },
    { camp: 0, type: 'transport', x: 2, y: 1 },
    { camp: 1, type: 'infanterie', x: 19, y: 0 },
  ]);
  const infanterie = sur(e, 1, 1);
  const transport = sur(e, 2, 1);
  const { action, suite } = decision(e, infanterie);
  assert.deepEqual(suite, { type: 'embarquer', transport: transport.id });
  const r = appliquer(e, action, CAT4);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.etat.unites.find((u) => u.id === transport.id)?.cargo, [infanterie.id]);
  // Le transport, chargé, roule vers la ville de son passager sans le lâcher en route.
  const chargeE = r.etat;
  const { arrivee, suite: suiteTransport } = decision(chargeE, chargeE.unites.find((u) => u.id === transport.id)!);
  assert.ok(arrivee.x > 2, `il avance : ${JSON.stringify(arrivee)}`);
  assert.equal(suiteTransport.type, 'rien');
});

test('une infanterie déjà près de son objectif marche : le transport ne ferait rien gagner', () => {
  const e = partie(LONGUE, {}, [
    { camp: 0, type: 'infanterie', x: 17, y: 1 },
    { camp: 0, type: 'transport', x: 16, y: 1 },
  ]);
  assert.equal(decision(e, sur(e, 17, 1)).suite.type, 'capturer');
});

test('un transport chargé débarque son passager sur la ville qu’il vient prendre', () => {
  const e = partie(LONGUE, {}, [
    { camp: 0, type: 'transport', x: 12, y: 1 },
    { camp: 0, type: 'infanterie', x: 12, y: 1 },
    { camp: 1, type: 'infanterie', x: 0, y: 0 },
  ]);
  // Mise à bord à la main : l'état est du JSON, on le construit comme le moteur.
  const transport = e.unites.find((u) => u.type === 'transport')!;
  const passager = e.unites.find((u) => u.type === 'infanterie' && u.camp === 0)!;
  transport.cargo = [passager.id];
  passager.dansTransport = transport.id;
  const { action, arrivee, suite } = decision(e, transport);
  assert.deepEqual(arrivee, { x: 18, y: 1 });
  assert.deepEqual(suite, { type: 'debarquer', vers: { x: 19, y: 1 } });
  const r = appliquer(e, action, CAT4);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const pose = r.etat.unites.find((u) => u.id === passager.id)!;
  assert.deepEqual([pose.x, pose.y, pose.dansTransport, pose.etat], [19, 1, null, 'agi']);
});

test('un transport menacé qui ne peut pas fuir débarque plutôt que de risquer deux unités', () => {
  // Une recon adverse couvre tout le couloir ; les montagnes ferment la fuite au
  // transport (chenilles) mais pas à l'infanterie, qui y trouve quatre étoiles.
  const e = partie(['MMMMMMMMMMMM', 'MMMMPPPPPPPP', 'MMMMMMMMMMMM'], {}, [
    { camp: 0, type: 'transport', x: 4, y: 1 },
    { camp: 0, type: 'infanterie', x: 4, y: 1 },
    { camp: 1, type: 'recon', x: 11, y: 1 },
  ]);
  const transport = e.unites.find((u) => u.type === 'transport')!;
  const passager = e.unites.find((u) => u.type === 'infanterie' && u.camp === 0)!;
  transport.cargo = [passager.id];
  passager.dansTransport = transport.id;
  const { action, suite } = decision(e, transport, { ...POIDS_PONDEREE, securite: 14 });
  assert.equal(suite.type, 'debarquer');
  if (suite.type === 'debarquer') assert.equal(suite.vers.y, 0, 'sur la montagne');
  assert.equal(appliquer(e, action, CAT4).ok, true);
});

test('le transport s’achète avec une armée, et rarement sans', () => {
  const grille = ['PPPPPPPPPPPP', 'UPPPPPPPPPPP', 'PPPPPPPPPPPP'];
  // Une infanterie seule, son objectif à portée de marche : rien ne justifie un soutien.
  const seule = partie(grille, { '0,1': 0 }, [
    { camp: 0, type: 'infanterie', x: 3, y: 1 },
    { camp: 1, type: 'infanterie', x: 11, y: 1 },
  ]);
  seule.camps[0]!.fonds = 20000;
  assert.equal(scoreAchat(seule, CAT4, 'transport', {}, armeeParType(seule, 0), false, 0), 0);
  assert.equal(scoreAchat(seule, CAT4, 'transport', {}, armeeParType(seule, 0), false), 0, 'sans camp, une unité désarmée vaut zéro');

  const armee = partie(grille, { '0,1': 0 }, [
    { camp: 0, type: 'infanterie', x: 3, y: 1 },
    { camp: 0, type: 'infanterie', x: 4, y: 1 },
    { camp: 0, type: 'meca', x: 5, y: 1 },
    { camp: 0, type: 'char_leger', x: 6, y: 1 },
    { camp: 0, type: 'artillerie', x: 7, y: 1 },
    { camp: 0, type: 'char_moyen', x: 8, y: 1 },
    { camp: 1, type: 'infanterie', x: 11, y: 1 },
  ]);
  armee.camps[0]!.fonds = 20000;
  const avec = scoreAchat(armee, CAT4, 'transport', {}, armeeParType(armee, 0), false, 0);
  assert.ok(avec > 0, `une armée de six justifie un soutien : ${avec}`);
  assert.ok(avec < scoreAchat(armee, CAT4, 'char_leger', {}, {}, false, 0), 'mais moins qu’un char neuf');
  // Sans les fonds d'une unité armée au tour suivant, et l'adversaire à portée : non.
  armee.camps[0]!.fonds = CAT4.unites['transport']!.cout - 1;
  assert.equal(valeurSoutien(armee, CAT4, 'transport', 0), 0);
  // Un second soutien pour six armées ne vaut rien.
  armee.camps[0]!.fonds = 20000;
  armee.unites.push({ ...armee.unites[0]!, id: 'soutien', type: 'transport', x: 9, y: 1, cargo: [] });
  assert.equal(valeurSoutien(armee, CAT4, 'transport', 0), 0);
});

test('un transport s’achète seul quand un capteur est loin de sa ville et que personne ne menace', () => {
  // Une infanterie à quatorze pas de la seule ville à prendre, l'adversaire hors de
  // portée : quatre tours à pied, un transport neuf les ramène à deux.
  const grille = ['PPPPPPPPPPPPPPPPPPPP', 'UPPPPPPPPPPPPPPPPPPC', 'PPPPPPPPPPPPPPPPPPPP'];
  const e = partie(grille, { '0,1': 0 }, [
    { camp: 0, type: 'infanterie', x: 5, y: 1 },
    { camp: 1, type: 'infanterie', x: 19, y: 0 },
  ]);
  e.camps[0]!.fonds = 20000;
  const seul = valeurSoutien(e, CAT4, 'transport', 0);
  assert.ok(seul > 0 && seul <= 0.12 / 2, `possible mais rare : ${seul}`);
  // Le seul besoin réel : même sans les fonds d'une unité armée demain, il s'achète.
  e.camps[0]!.fonds = CAT4.unites['transport']!.cout - 1;
  assert.ok(valeurSoutien(e, CAT4, 'transport', 0) > 0);
  // L'adversaire à portée de combat rend l'unité armée prioritaire.
  e.unites.push({ ...e.unites[1]!, id: 'menace', x: 9, y: 1 });
  assert.equal(valeurSoutien(e, CAT4, 'transport', 0), 0);
  // Et un transport déjà là suffit.
  e.unites.pop();
  e.camps[0]!.fonds = 20000;
  e.unites.push({ ...e.unites[0]!, id: 'soutien', type: 'transport', x: 6, y: 1, cargo: [] });
  assert.equal(valeurSoutien(e, CAT4, 'transport', 0), 0);
});

test('les drones ne s’achètent que sous brouillard, et un seul à la fois', () => {
  const grille = ['PPPPPPPPPPPP', 'APPPPPPPPPPP', 'PPPPPPPPPPPP'];
  const unites: { camp: CampId; type: CleUnite; x: number; y: number }[] = [
    { camp: 0, type: 'infanterie', x: 3, y: 1 },
    { camp: 0, type: 'meca', x: 4, y: 1 },
    { camp: 0, type: 'char_leger', x: 5, y: 1 },
    { camp: 1, type: 'infanterie', x: 11, y: 1 },
  ];
  const clair = partie(grille, { '0,1': 0 }, unites);
  clair.camps[0]!.fonds = 20000;
  assert.equal(valeurSoutien(clair, CAT4, 'drone', 0), 0);
  const scene = scenePersonnalisee(grille, { '0,1': 0 }, unites, { brouillard: true, saisonForcee: 'ete', fondsDepart: 20000 });
  const brume = creerPartie(scene, CAT4, 'brume');
  const un = valeurSoutien(brume, CAT4, 'drone', 0);
  assert.ok(un > 0 && un < 0.2, `modéré : ${un}`);
  brume.unites.push({ ...brume.unites[0]!, id: 'oeil', type: 'drone', x: 6, y: 1 });
  assert.ok(valeurSoutien(brume, CAT4, 'drone', 0) < un / 3);
});

test('au catalogue 4, une partie entière se joue sans refus et le transport sert', () => {
  // La plaine, avec un transport de départ dans chaque camp : sur vingt parties
  // simulées l'IA n'en achète qu'une dizaine, on n'attend pas la chance ici.
  const base = sceneDeCarte(carte('plaine'), reglagesParDefaut({ limiteJournees: 30 }));
  const scene = {
    ...base,
    unitesDepart: [
      ...base.unitesDepart,
      { camp: 0 as CampId, type: 'transport' as CleUnite, x: 3, y: 6 },
      { camp: 1 as CampId, type: 'transport' as CleUnite, x: 12, y: 5 },
    ],
  };
  let e = creerPartie(scene, CAT4, 'cat4');
  const rng = creerRng('cat4:ia');
  const suites = new Set<string>();
  for (let tour = 0; tour < 200 && !e.partie.terminee; tour += 1) {
    const strat = e.campCourant === 0 ? PONDEREE : AGRESSIVE;
    const r = jouerTour(e, strat, rng.branche(`camp${e.campCourant}`), CAT4);
    assert.deepEqual(r.refus, [], `journée ${e.journee}`);
    for (const a of r.actions) if (a.type === 'ordre') suites.add(a.suite.type);
    e = r.etat;
  }
  assert.equal(e.partie.terminee, true);
  assert.ok(suites.has('attaquer') && suites.has('capturer'));
  assert.ok(suites.has('embarquer'), `suites vues : ${[...suites].join(', ')}`);
  assert.ok(suites.has('debarquer'), `suites vues : ${[...suites].join(', ')}`);
});

test('deux parties de même graine au catalogue 4 donnent la même empreinte', () => {
  const jouer = (): string => {
    const scene = sceneDeCarte(carte('relief'), reglagesParDefaut({ limiteJournees: 30 }));
    const e = creerPartie(scene, CAT4, 'determinisme-4');
    return empreinte(jouerPartie(e, [PONDEREE, AGRESSIVE], creerRng('determinisme-4:ia'), CAT4).etat);
  };
  assert.equal(jouer(), jouer());
});
