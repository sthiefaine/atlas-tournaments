/**
 * L'IA face au catalogue 6 (7 septembre 2026) : achats conscients de ce que
 * l'adversaire peut produire et de ce que l'armée ne couvre pas, épargne pour
 * une unité hors de prix, transports bornés par leurs clients réels, cale vidée
 * en un ordre, furtivité, porteur qui ravitaille, escorte, brouillard honnête
 * et portée prudente. États construits en mémoire, chiffres lus au catalogue.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  autonomieSecurite, besoinTransport, contreAchat, frappeLAir, jouerTour, meilleureOption,
  meilleureProduction, menaceSur, mixPotentiel, objectifsCombat, objectifsDe, PONDEREE, POIDS_PONDEREE,
  porteePrudente, scoreAchat, valeurSoutien,
} from '../../src/ai/index';
import {
  appliquer, chargerCatalogue, coutVers, creerPartie, creerRng, portee, porte,
  type EtatPartie, type ReglagesPartie, type Unite,
} from '../../src/engine/index';
import type { CampId, CleUnite } from '../../src/schemas/index';
import { scenePersonnalisee } from '../engine/aides';

const CAT6 = chargerCatalogue(6);

/** Une partie sur une grille écrite à la main, au catalogue 6, de jour et sans météo. */
function partie(
  grille: string[],
  proprietaires: Record<string, CampId>,
  unites: { camp: CampId; type: CleUnite; x: number; y: number; pv?: number }[],
  reglages: Partial<ReglagesPartie> = {},
): EtatPartie {
  const scene = scenePersonnalisee(grille, proprietaires, unites, {
    brouillard: false, saisonForcee: 'ete', fondsDepart: 0, limiteJournees: 30,
    cycleJourNuit: { jour: 6, nuit: 0 }, ...reglages,
  });
  return creerPartie(scene, CAT6, 'catalogue6');
}

/** Unité posée sur une case, ou une erreur lisible. */
function sur(e: EtatPartie, x: number, y: number, type?: CleUnite): Unite {
  const u = e.unites.find((z) => z.x === x && z.y === y && !z.dansTransport && (type === undefined || z.type === type));
  if (!u) throw new Error(`aucune unité en ${x},${y}`);
  return u;
}

/** L'ordre rendu par `meilleureOption`, avec son arrivée et sa suite. */
function decision(e: EtatPartie, u: Unite, poids = POIDS_PONDEREE) {
  const a = meilleureOption(e, CAT6, u, poids).action;
  assert.equal(a.type, 'ordre');
  if (a.type !== 'ordre') throw new Error('inatteignable');
  return { action: a, arrivee: a.chemin[a.chemin.length - 1]!, suite: a.suite };
}

/** Met des unités à bord d'un transport, comme le moteur le ferait. */
function embarquer(e: EtatPartie, transport: Unite, ...passagers: Unite[]): void {
  for (const p of passagers) {
    transport.cargo.push(p.id);
    p.dansTransport = transport.id;
    p.x = transport.x;
    p.y = transport.y;
  }
}

const PLAINE = ['PPPPPPPPPPPP', 'PPPPPPPPPPPP', 'PPPPPPPPPPPP'];

// ---------------------------------------------------------------------------
// Achats : le potentiel adverse et ce qu'un achat contre
// ---------------------------------------------------------------------------

test('un aéroport adverse est une menace aérienne en puissance, qui croît avec ses fonds', () => {
  const grille = ['APPPPPPPPPPU', 'PPPPPPPPPPPP', 'PPPPPPPPPPPP'];
  const e = partie(grille, { '0,0': 1, '11,0': 0 }, [
    { camp: 0, type: 'infanterie', x: 9, y: 1 },
    { camp: 1, type: 'infanterie', x: 2, y: 1 },
  ]);
  e.camps[1]!.fonds = 0;
  const pauvre = mixPotentiel(e, CAT6, 0);
  const volantes = Object.keys(pauvre).filter((cle) => porte(CAT6.unites[cle]!, 'vol'));
  assert.ok(volantes.length > 0, 'ce que l’aéroport produit entre au mix');
  assert.ok(Object.keys(pauvre).every((cle) => !porte(CAT6.unites[cle]!, 'transport')), 'jamais un transport');
  assert.ok(Object.keys(pauvre).every((cle) => !porte(CAT6.unites[cle]!, 'drone')), 'jamais un drone');
  e.camps[1]!.fonds = 30000;
  const riche = mixPotentiel(e, CAT6, 0);
  for (const cle of volantes) assert.ok(riche[cle]! > pauvre[cle]!, `${cle} pèse plus quand l’adversaire est riche`);
  // Sans aéroport ni port adverse, rien ne vole ni ne navigue dans le potentiel.
  const terre = partie(['UPPPPPPPPPPU', 'PPPPPPPPPPPP', 'PPPPPPPPPPPP'], { '0,0': 1, '11,0': 0 }, [
    { camp: 0, type: 'infanterie', x: 9, y: 1 },
    { camp: 1, type: 'infanterie', x: 2, y: 1 },
  ]);
  const sol = mixPotentiel(terre, CAT6, 0);
  assert.ok(Object.keys(sol).length > 0);
  assert.ok(Object.keys(sol).every((cle) => CAT6.unites[cle]!.domaine === 'terre'));
});

test('ce qu’un achat contre : une menace que l’armée ne couvre pas, au prix de la menace', () => {
  const bombardier = CAT6.unites['bombardier']!;
  const menaces = { bombardier: 1 };
  const sansAntiAir = { infanterie: 4, char_leger: 2 };
  const antiair = contreAchat(CAT6, 'antiair', menaces, sansAntiAir);
  assert.ok(antiair > 0, 'l’anti-air couvre le bombardier');
  assert.ok(Math.abs(antiair - (110 / 100) * (bombardier.cout / 1000)) < 1e-9, 'au prix de la menace, à 110 %');
  assert.equal(contreAchat(CAT6, 'char_leger', menaces, sansAntiAir), 0, 'un char ne le touche pas');
  assert.equal(contreAchat(CAT6, 'antiair', menaces, { ...sansAntiAir, antiair: 1 }), 0, 'déjà couvert : plus rien');
  assert.ok(contreAchat(CAT6, 'antiair', { bombardier: 3 }, { ...sansAntiAir, antiair: 1 }) > 0, 'trois bombardiers : un anti-air ne suffit plus');
  // Le furtif touche presque tout : il contre l'air adverse, ce qu'un bombardier ne fait pas.
  const air = { helico: 2, bombardier: 1 };
  assert.ok(contreAchat(CAT6, 'furtif', air, { infanterie: 3 }) > 0);
  assert.equal(contreAchat(CAT6, 'bombardier', air, { infanterie: 3 }), 0);
  // Une menace navale : le sous-marin et le lance-roquettes couvrent un cuirassé, l'infanterie non.
  assert.ok(contreAchat(CAT6, 'sous_marin', { cuirasse: 1 }, { infanterie: 5 }) > 0);
  assert.ok(contreAchat(CAT6, 'roquettes', { cuirasse: 1 }, { infanterie: 5 }) > 0);
  assert.equal(contreAchat(CAT6, 'infanterie', { cuirasse: 1 }, { infanterie: 5 }), 0);
});

test('face à un bombardier, l’IA achète de l’anti-air, et épargne pour lui quand il est hors de prix', () => {
  // Deux bâtiments à nous (usine, ville), un aéroport à l'adversaire ; trois
  // bombardiers en face et une armée sans anti-air chez nous.
  const grille = ['UPPPPPPPPPPA', 'CPPPPPPPPPPP', 'PPPPPPPPPPPP'];
  const e = partie(grille, { '0,0': 0, '0,1': 0, '11,0': 1 }, [
    { camp: 0, type: 'infanterie', x: 1, y: 1 },
    { camp: 0, type: 'infanterie', x: 2, y: 1 },
    { camp: 0, type: 'infanterie', x: 3, y: 1 },
    { camp: 0, type: 'infanterie', x: 1, y: 2 },
    { camp: 0, type: 'char_leger', x: 2, y: 2 },
    { camp: 1, type: 'bombardier', x: 9, y: 1 },
    { camp: 1, type: 'bombardier', x: 10, y: 1 },
    { camp: 1, type: 'bombardier', x: 10, y: 2 },
  ]);
  e.camps[0]!.fonds = 8000;
  const achat = meilleureProduction(e, CAT6, 0, POIDS_PONDEREE);
  assert.ok(achat && achat.type === 'produire', 'un achat');
  if (!achat || achat.type !== 'produire') return;
  assert.ok(frappeLAir(CAT6, achat.unite), `de l’anti-air, pas ${achat.unite}`);
  // Sans les fonds de l'anti-air mais avec deux journées de revenus pour l'atteindre : on épargne.
  e.camps[0]!.fonds = 6000;
  assert.equal(meilleureProduction(e, CAT6, 0, POIDS_PONDEREE), null, 'rien ce tour, l’anti-air vaut l’attente');
  // Sauf quand les capteurs manquent : la capture n'attend pas.
  e.unites = e.unites.filter((u) => u.camp === 1 || u.type !== 'infanterie');
  const capteur = meilleureProduction(e, CAT6, 0, POIDS_PONDEREE);
  assert.ok(capteur && capteur.type === 'produire' && porte(CAT6.unites[capteur.unite]!, 'capture'));
});

test('sans adversaire connu, le mix d’achat est ce que l’adversaire peut produire', () => {
  const grille = ['UPPPPPPPPPPA', 'PPPPPPPPPPPP', 'PPPPPPPPPPPP'];
  const e = partie(grille, { '0,0': 0, '11,0': 1 }, [
    { camp: 0, type: 'infanterie', x: 1, y: 1 },
    { camp: 1, type: 'infanterie', x: 11, y: 2 },
  ], { brouillard: true });
  assert.deepEqual(objectifsCombat(e, CAT6, 0), [], 'l’adversaire est hors de vue');
  e.camps[1]!.fonds = 30000;
  const contre = { menaces: mixPotentiel(e, CAT6, 0), poids: 0.1 };
  const antiair = scoreAchat(e, CAT6, 'antiair', {}, { infanterie: 1 }, false, 0, contre);
  const artillerie = scoreAchat(e, CAT6, 'artillerie', {}, { infanterie: 1 }, false, 0, contre);
  assert.ok(antiair > artillerie, `face à un aéroport riche et rien d’autre, l’anti-air prime : ${antiair} contre ${artillerie}`);
});

// ---------------------------------------------------------------------------
// Transports : des clients réels, des places déjà offertes, des pertes
// ---------------------------------------------------------------------------

/** Deux îles, un port chez nous, une ville à prendre en face : la barge est le seul chemin. */
const ILES = [
  'WWWWWWWWWW',
  'WPHOWWWCPW',
  'WPPPWWWPPW',
  'WWWWWWWWWW',
];

test('une île fait un client : la barge s’achète, puis plus quand une barge suffit', () => {
  const e = partie(ILES, { '2,1': 0, '3,1': 0 }, [
    { camp: 0, type: 'infanterie', x: 1, y: 2 },
    { camp: 1, type: 'infanterie', x: 8, y: 2 },
  ]);
  e.camps[0]!.fonds = 20000;
  assert.deepEqual(besoinTransport(e, CAT6, 'barge', 0), { clients: 1, places: 0 });
  const seule = valeurSoutien(e, CAT6, 'barge', 0);
  assert.ok(seule > 0, `un premier transport, même sans armée : ${seule}`);
  // Une barge déjà là offre deux places pour un client : plus rien à acheter.
  e.unites.push({ ...e.unites[0]!, id: 'barge', type: 'barge', x: 4, y: 1, cargo: [] });
  assert.deepEqual(besoinTransport(e, CAT6, 'barge', 0), { clients: 1, places: 2 });
  assert.equal(valeurSoutien(e, CAT6, 'barge', 0), 0);
  // Une barge déjà perdue rend la suivante moins désirable.
  e.unites.pop();
  e.produites['0:barge'] = 3;
  const echaudee = valeurSoutien(e, CAT6, 'barge', 0);
  assert.ok(echaudee > 0 && echaudee < seule / 3, `trois barges perdues : ${echaudee} contre ${seule}`);
});

test('sur la terre ferme, un objectif à portée de marche ne fait pas un client', () => {
  const grille = ['PPPPPPPPPPPP', 'UPPPPCPPPPPP', 'PPPPPPPPPPPP'];
  const e = partie(grille, { '0,1': 0 }, [
    { camp: 0, type: 'infanterie', x: 2, y: 1 },
    { camp: 0, type: 'char_leger', x: 2, y: 2 },
    { camp: 0, type: 'char_leger', x: 3, y: 2 },
    { camp: 0, type: 'artillerie', x: 4, y: 2 },
    { camp: 1, type: 'infanterie', x: 11, y: 1 },
  ]);
  e.camps[0]!.fonds = 20000;
  assert.equal(besoinTransport(e, CAT6, 'transport', 0).clients, 0);
});

test('un drone déjà perdu vaut moins le suivant', () => {
  const grille = ['APPPPPPPPPPP', 'PPPPPPPPPPPP', 'PPPPPPPPPPPP'];
  const e = partie(grille, { '0,0': 0 }, [
    { camp: 0, type: 'char_leger', x: 2, y: 1 },
    { camp: 0, type: 'char_leger', x: 3, y: 1 },
    { camp: 0, type: 'artillerie', x: 4, y: 1 },
    { camp: 1, type: 'infanterie', x: 11, y: 1 },
  ], { brouillard: true });
  e.camps[0]!.fonds = 20000;
  const premier = valeurSoutien(e, CAT6, 'drone', 0);
  assert.ok(premier > 0);
  e.produites['0:drone'] = 2;
  assert.ok(Math.abs(valeurSoutien(e, CAT6, 'drone', 0) - premier / 3) < 1e-9);
});

// ---------------------------------------------------------------------------
// Débarquer toute la cale en un ordre
// ---------------------------------------------------------------------------

test('deux passagers qui ont chacun une ville sortent en un ordre', () => {
  const grille = ['PPPPPPPPPPPPPPPPPPCP', 'PPPPPPPPPPPPPPPPPPPP', 'PPPPPPPPPPPPPPPPPPCP'];
  const e = partie(grille, {}, [
    { camp: 0, type: 'transport', x: 14, y: 1 },
    { camp: 0, type: 'infanterie', x: 14, y: 1 },
    { camp: 0, type: 'infanterie', x: 14, y: 1 },
    { camp: 1, type: 'infanterie', x: 0, y: 1 },
  ]);
  const transport = sur(e, 14, 1, 'transport');
  const [a, b] = e.unites.filter((u) => u.camp === 0 && u.type === 'infanterie');
  embarquer(e, transport, a!, b!);
  const { action, arrivee, suite } = decision(e, transport);
  assert.deepEqual(arrivee, { x: 18, y: 1 });
  assert.equal(suite.type, 'debarquer');
  if (suite.type !== 'debarquer') return;
  assert.equal(suite.passager, undefined, 'le premier de la cale sort en premier');
  assert.equal(suite.autres?.length, 1);
  const cases = [suite.vers, suite.autres![0]!.vers].map((c) => `${c.x},${c.y}`).sort();
  assert.deepEqual(cases, ['18,0', '18,2'], 'chacun sur sa ville');
  assert.equal(suite.autres![0]!.passager, b!.id);
  const r = appliquer(e, action, CAT6);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  for (const id of [a!.id, b!.id]) {
    const pose: Unite = r.etat.unites.find((z) => z.id === id)!;
    assert.equal(pose.dansTransport, null);
    assert.equal(pose.etat, 'agi');
    assert.equal(pose.x, 18);
  }
  assert.deepEqual(r.etat.unites.find((u) => u.id === transport.id)?.cargo, []);
});

test('le passager désigné sort quand ce n’est pas le premier de la cale qui doit prendre la ville', () => {
  const grille = ['PPPPPPPPPPPPPPPPPPCP', 'PPPPPPPPPPPPPPPPPPPP', 'PPPPPPPPPPPPPPPPPPPP'];
  const e = partie(grille, {}, [
    { camp: 0, type: 'transport', x: 14, y: 1 },
    { camp: 0, type: 'genie', x: 14, y: 1 },
    { camp: 0, type: 'infanterie', x: 14, y: 1 },
    { camp: 1, type: 'infanterie', x: 0, y: 1 },
  ]);
  const transport = sur(e, 14, 1, 'transport');
  const genie = sur(e, 14, 1, 'genie');
  const infanterie = sur(e, 14, 1, 'infanterie');
  embarquer(e, transport, genie, infanterie);
  const { action, suite } = decision(e, transport);
  assert.equal(suite.type, 'debarquer');
  if (suite.type !== 'debarquer') return;
  assert.deepEqual(suite.vers, { x: 18, y: 0 }, 'sur la ville');
  assert.equal(suite.passager, infanterie.id, 'l’infanterie, pas le génie qui ne capture pas');
  assert.equal(appliquer(e, action, CAT6).ok, true);
});

// ---------------------------------------------------------------------------
// Furtivité
// ---------------------------------------------------------------------------

test('sous brouillard, un furtif menacé se cache ; sans menace, il se montre ; au grand jour, jamais', () => {
  const grille = ['APPPPPPPPPPP', 'PPPPPPPPPPPP', 'PPPPPPPPPPPP'];
  const menace = partie(grille, { '0,0': 0 }, [
    { camp: 0, type: 'furtif', x: 3, y: 1 },
    { camp: 1, type: 'antiair', x: 6, y: 1 },
  ], { brouillard: true });
  const furtif = sur(menace, 3, 1);
  const { action, suite } = decision(menace, furtif);
  assert.equal(suite.type, 'furtivite', 'un anti-air à portée : il se cache');
  const r = appliquer(menace, action, CAT6);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.etat.unites.find((u) => u.id === furtif.id)?.furtive, true);

  // Caché, sans adversaire en vue : la cachette ne coûte que du carburant, il se montre.
  const calme = partie(grille, { '0,0': 0 }, [
    { camp: 0, type: 'furtif', x: 3, y: 1 },
    { camp: 1, type: 'infanterie', x: 11, y: 2 },
  ], { brouillard: true });
  const cache = sur(calme, 3, 1);
  cache.furtive = true;
  assert.equal(decision(calme, cache).suite.type, 'furtivite', 'rien ne le menace : il se montre');

  // Au grand jour, la furtivité ne cache rien : jamais proposée à qui est visible.
  const jour = partie(grille, { '0,0': 0 }, [
    { camp: 0, type: 'furtif', x: 3, y: 1 },
    { camp: 1, type: 'antiair', x: 6, y: 1 },
  ]);
  assert.notEqual(decision(jour, sur(jour, 3, 1)).suite.type, 'furtivite');
});

test('l’autonomie de sécurité lit la consommation réelle : cachée, une unité rentre plus tôt', () => {
  const furtif = CAT6.unites['furtif']!;
  const visible = autonomieSecurite(furtif, 30, 4, 6, 1, furtif.carburant!.parTour);
  const cachee = autonomieSecurite(furtif, 30, 4, 6, 1, furtif.carburant!.parTour + 3);
  assert.ok(cachee < visible);
  assert.equal(autonomieSecurite(furtif, 30, 4, 6, 1), visible, 'par défaut, la consommation du catalogue');
});

// ---------------------------------------------------------------------------
// Le porteur : un aéroport flottant
// ---------------------------------------------------------------------------

test('un chasseur à court de carburant, sans aéroport, monte sur le porte-avions et y fait le plein', () => {
  const grille = ['WWWWWWWWWW', 'WWWWWWWWWW', 'PPPPPPPPPP'];
  const e = partie(grille, {}, [
    { camp: 0, type: 'porte_avions', x: 5, y: 0 },
    { camp: 0, type: 'chasseur', x: 2, y: 1 },
    { camp: 1, type: 'infanterie', x: 9, y: 2 },
  ]);
  const chasseur = sur(e, 2, 1);
  const porteur = sur(e, 5, 0);
  chasseur.carburant = 12;
  const { action, suite } = decision(e, chasseur);
  assert.deepEqual(suite, { type: 'embarquer', transport: porteur.id });
  const r = appliquer(e, action, CAT6);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  let apres = r.etat;
  for (let i = 0; i < 2; i += 1) {
    const s = appliquer(apres, { type: 'finTour' }, CAT6);
    assert.equal(s.ok, true);
    if (s.ok) apres = s.etat;
  }
  const plein = apres.unites.find((u) => u.id === chasseur.id);
  assert.equal(plein?.dansTransport, porteur.id);
  assert.equal(plein?.carburant, CAT6.unites['chasseur']!.carburant!.max, 'la cale ravitaille');
});

// ---------------------------------------------------------------------------
// Escorte
// ---------------------------------------------------------------------------

test('sous un ciel adverse, un char sans anti-air vaut mieux escorté', () => {
  // Le char lourd est coincé dans une poche de montagnes ; l'hélicoptère adverse
  // l'atteint. Un anti-air ami à deux cases divise la menace aérienne par deux.
  const grille = ['MMMMMMMMMM', 'PMMMMMMPPP', 'MMMMMMMMMM'];
  const seul = partie(grille, {}, [
    { camp: 0, type: 'char_lourd', x: 0, y: 1 },
    { camp: 1, type: 'helico', x: 7, y: 1 },
  ]);
  const escorte = partie(grille, {}, [
    { camp: 0, type: 'char_lourd', x: 0, y: 1 },
    { camp: 0, type: 'antiair', x: 0, y: 0 },
    { camp: 1, type: 'helico', x: 7, y: 1 },
  ]);
  assert.ok(!frappeLAir(CAT6, 'char_lourd') && frappeLAir(CAT6, 'antiair'));
  const sansEscorte = meilleureOption(seul, CAT6, sur(seul, 0, 1), POIDS_PONDEREE).score;
  const avecEscorte = meilleureOption(escorte, CAT6, sur(escorte, 0, 1), POIDS_PONDEREE).score;
  assert.ok(avecEscorte > sansEscorte, `${avecEscorte} contre ${sansEscorte}`);
});

// ---------------------------------------------------------------------------
// Brouillard honnête
// ---------------------------------------------------------------------------

test('sous brouillard, l’IA ne compte que les adversaires qu’elle voit', () => {
  const e = partie(PLAINE, {}, [
    { camp: 0, type: 'infanterie', x: 1, y: 1 },
    { camp: 1, type: 'antiair', x: 6, y: 1 },
  ], { brouillard: true });
  const infanterie = sur(e, 1, 1);
  assert.equal(menaceSur(e, CAT6, infanterie, { x: 1, y: 1 }), 0, 'un anti-air à cinq cases, hors de vue');
  assert.deepEqual(objectifsCombat(e, CAT6, 0), []);
  // Une reconnaissance amie qui le voit change tout.
  e.unites.push({ ...infanterie, id: 'oeil', type: 'recon', x: 2, y: 1, carburant: 80 });
  assert.ok(menaceSur(e, CAT6, infanterie, { x: 1, y: 1 }) > 0);
  assert.deepEqual(objectifsCombat(e, CAT6, 0), [{ x: 6, y: 1 }]);
});

test('sous brouillard, la portée prudente ne traverse pas un allié', () => {
  const grille = ['PPPPPP'];
  const brume = partie(grille, {}, [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 0, type: 'infanterie', x: 2, y: 0 },
    { camp: 1, type: 'infanterie', x: 5, y: 0 },
  ], { brouillard: true });
  const u = sur(brume, 0, 0);
  assert.equal(coutVers(portee(brume, CAT6, u), { x: 3, y: 0 }), 3, 'le moteur laisse passer');
  assert.equal(coutVers(porteePrudente(brume, CAT6, u), { x: 3, y: 0 }), null, 'l’IA non');
  assert.equal(coutVers(porteePrudente(brume, CAT6, u), { x: 1, y: 0 }), 1);
  const clair = partie(grille, {}, [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 0, type: 'infanterie', x: 2, y: 0 },
    { camp: 1, type: 'infanterie', x: 5, y: 0 },
  ]);
  assert.equal(coutVers(porteePrudente(clair, CAT6, sur(clair, 0, 0)), { x: 3, y: 0 }), 3, 'hors brouillard, celle du moteur');
});

test('un ordre vers une unité cachée est interrompu au contact, et le tour continue', () => {
  // La ville est hors de vue de l'infanterie ; une reconnaissance adverse s'y
  // tient. Depuis le 7 septembre 2026 au soir, le moteur n'en refuse plus
  // l'arrivée (ce refus trahissait la présence cachée) : il interrompt la
  // marche sur la dernière case libre, la suite tombe, et l'IA n'a rien à
  // contourner. Le contournement (`ResultatTour.contournes`) reste pour tout
  // refus qu'elle ne saurait prévoir.
  const grille = ['PPPCPP', 'PPPPPP'];
  const e = partie(grille, {}, [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'recon', x: 3, y: 0 },
  ], { brouillard: true });
  const infanterie = sur(e, 0, 0);
  const { arrivee, suite } = decision(e, infanterie);
  assert.deepEqual([arrivee, suite.type], [{ x: 3, y: 0 }, 'capturer'], 'elle croit la ville libre');
  const r = jouerTour(e, PONDEREE, creerRng('contournement'), CAT6);
  assert.deepEqual(r.refus, []);
  assert.deepEqual(r.contournes, []);
  const apres = r.etat.unites.find((x) => x.id === infanterie.id);
  assert.ok(apres);
  assert.deepEqual({ x: apres.x, y: apres.y }, { x: 2, y: 0 }, 'arrêtée au contact, jamais sur la ville');
  assert.equal(apres.etat, 'agi');
  assert.equal(r.actions[r.actions.length - 1]?.type, 'finTour');
  assert.equal(r.etat.campCourant, 1);
});

// ---------------------------------------------------------------------------
// Les pièces à tir indirect visent la couronne, pas la case
// ---------------------------------------------------------------------------

test('un cuirassé s’approche d’une cible à terre jusqu’à l’avoir à portée, sans jamais accoster', () => {
  const grille = ['WWWWWWWWWW', 'WWWWWWWWWW', 'PPPPPPPPPP', 'PPPPPPPPPP', 'PPPPPPPPPP'];
  const e = partie(grille, {}, [
    { camp: 0, type: 'cuirasse', x: 0, y: 0 },
    { camp: 1, type: 'char_leger', x: 5, y: 4 },
  ]);
  const cuirasse = sur(e, 0, 0);
  const obj = objectifsDe(e, CAT6, cuirasse);
  assert.ok(obj.cibles.some((c) => c.x === 5 && c.y === 1), 'la couronne de tir passe par la mer');
  const { action, arrivee } = decision(e, cuirasse);
  assert.ok(Math.abs(arrivee.x - 5) + Math.abs(arrivee.y - 4) <= CAT6.unites['cuirasse']!.portee[1], `à portée : ${JSON.stringify(arrivee)}`);
  assert.ok(arrivee.y <= 1, 'et toujours en mer');
  assert.equal(appliquer(e, action, CAT6).ok, true);
});
