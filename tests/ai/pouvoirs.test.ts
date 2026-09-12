/**
 * L'IA juge ses pouvoirs famille par famille (10 septembre 2026,
 * `src/ai/pouvoirs.ts`) : une valeur en fonds, strictement positive là où la
 * famille sert et **nulle** là où elle ne change rien ; un seuil par barre pour
 * déclencher ; le super gardé tant qu'il ne vaut rien, joué à la dernière
 * occasion du tour quand sa valeur n'y vient qu'à la fin. Et la faiblesse
 * adverse oriente un achat (`src/ai/orientation.ts`). Déterministe.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ampleurFaiblesse, decisionPouvoir, detailPouvoir, jouerTour, meilleureProduction, multiplicateurFaiblesse,
  orientationKit, POIDS_PONDEREE, PONDEREE, SEUIL_PAR_BARRE, typesAffaiblis, valeurPouvoir,
} from '../../src/ai/index';
import { creerRng, type CommandantMoteur, type EtatPartie, type ReglagesPartie } from '../../src/engine/index';
import type { EffetModificateur, EffetPouvoir } from '../../src/schemas/index';
import { CAT, partiePersonnalisee, u } from '../engine/aides';

const GRILLE = [
  'PPPPPPPP',
  'PPPPPPPP',
  'UPPPPPPP',
  'PPPPPPPP',
];

type Pouvoir = CommandantMoteur['pouvoir'];

function pouvoir(effets: EffetPouvoir[], barres = 2, duree: Pouvoir['duree'] = 'tour_complet'): Pouvoir {
  return { nom: 'Test', barres, duree, effets };
}

function commandant(normal: Pouvoir, superPouvoir: Pouvoir = { ...normal, barres: 5 }): CommandantMoteur {
  return { cle: 'cmd_test', nom: 'Test', passif: null, pouvoir: normal, superPouvoir };
}

type Unites = Parameters<typeof partiePersonnalisee>[2];

function partie(
  unites: Unites, jauge = 0, proprietaires: Record<string, 0 | 1> = {}, reglages: Partial<ReglagesPartie> = {},
  grille: string[] = GRILLE,
): EtatPartie {
  const etat = partiePersonnalisee(grille, proprietaires, unites, reglages);
  etat.camps[0]!.jauge = jauge;
  etat.camps[0]!.jaugeMax = 500;
  return etat;
}

const mien = (m: EffetModificateur['modificateur'], filtre?: EffetModificateur['filtre']): EffetPouvoir => (
  filtre ? { cible: 'mes_unites', filtre, modificateur: m } : { cible: 'mes_unites', modificateur: m }
);
const adverse = (m: EffetModificateur['modificateur']): EffetPouvoir => ({ cible: 'unites_adverses', modificateur: m });
const NORMAL = { niveau: 'normal' as const };
const SUPER = { niveau: 'super' as const };

test('soin : positif sur des unités entamées, nul quand tout le monde est plein', () => {
  const p = pouvoir([mien({ quoi: 'soin', valeur: 2 })]);
  const blessees = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0, pv: 50 },
    { camp: 0, type: 'char_leger', x: 1, y: 0, pv: 60 },
    { camp: 1, type: 'infanterie', x: 7, y: 3 },
  ]);
  const d = detailPouvoir(blessees, CAT, 0, p, NORMAL);
  assert.equal(d.soin, 2 * 100 + 2 * 650, 'deux PV à 100 et deux PV à 650 fonds le point');
  assert.ok(d.total > 0);
  const saines = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 7, y: 3 },
  ]);
  assert.equal(valeurPouvoir(saines, CAT, 0, p, NORMAL), 0);
});

test("dégâts directs : positifs sur un adversaire connu, nuls sur une unité à 1 PV qu'ils ne peuvent plus entamer", () => {
  const p = pouvoir([adverse({ quoi: 'degats_directs', valeur: 1 })]);
  const pleines = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'char_leger', x: 7, y: 3 },
  ]);
  assert.equal(detailPouvoir(pleines, CAT, 0, p, NORMAL).degatsDirects, 650);
  const entamee = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'char_leger', x: 7, y: 3, pv: 1 },
  ]);
  assert.equal(valeurPouvoir(entamee, CAT, 0, p, NORMAL), 0);
});

test('ravitailler : positif pour une unité à sec, nul pour une unité au plein', () => {
  const p = pouvoir([{ cible: 'mes_unites', ravitailler: { carburant: true, munitions: true } }]);
  const aSec = partie([
    { camp: 0, type: 'char_leger', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 7, y: 3 },
  ]);
  u(aSec, 'u1').munitions = 0;
  assert.ok(detailPouvoir(aSec, CAT, 0, p, NORMAL).ravitailler > 0);
  const pleine = partie([
    { camp: 0, type: 'char_leger', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 7, y: 3 },
  ]);
  assert.equal(valeurPouvoir(pleine, CAT, 0, p, NORMAL), 0);
});

test("réactiver : vaut ce que les unités qui ont joué peuvent encore faire, rien si personne n'a joué", () => {
  const p = pouvoir([{ cible: 'mes_unites', reactiver: true }], 5, 'ce_tour');
  const jouee = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 1, y: 0, pv: 30 },
  ]);
  u(jouee, 'u1').etat = 'agi';
  const d = detailPouvoir(jouee, CAT, 0, p, SUPER);
  assert.ok(d.reactiver > 0, 'une infanterie réactivée met la cible hors jeu');
  assert.equal(d.tactique, 0, 'rien ne change pour les unités qui étaient déjà prêtes');
  const prete = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 1, y: 0, pv: 30 },
  ]);
  assert.equal(valeurPouvoir(prete, CAT, 0, p, SUPER), 0);
});

test("attaque : positive quand un duel est engageable, nulle quand aucune cible n'est à portée", () => {
  const p = pouvoir([mien({ quoi: 'attaque', valeur: 1.5 })], 2, 'ce_tour');
  const contact = partie([
    { camp: 0, type: 'char_leger', x: 0, y: 0 },
    { camp: 1, type: 'char_leger', x: 2, y: 0 },
  ]);
  assert.ok(detailPouvoir(contact, CAT, 0, p, NORMAL).tactique > 0);
  const loin = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 7, y: 3 },
  ]);
  assert.equal(valeurPouvoir(loin, CAT, 0, p, NORMAL), 0);
});

test('défense : ne vaut que si la durée couvre le tour adverse', () => {
  // Le recon (huit points, la plaine lui en coûte deux) atteint l'infanterie
  // (trois points) à cinq cases ; l'inverse est faux.
  const unites: Unites = [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'recon', x: 5, y: 0 },
  ];
  const couvre = pouvoir([mien({ quoi: 'defense', valeur: 1.5 })], 2, 'tour_complet');
  assert.ok(detailPouvoir(partie(unites), CAT, 0, couvre, NORMAL).tactique > 0, 'le recon frappera moins fort à son tour');
  const ceTour = pouvoir([mien({ quoi: 'defense', valeur: 1.5 })], 2, 'ce_tour');
  assert.equal(valeurPouvoir(partie(unites), CAT, 0, ceTour, NORMAL), 0, 'expiré avant que le recon ne joue');
});

test('chance : positive quand elle fait tomber une cible qui survivait de justesse', () => {
  const p = pouvoir([mien({ quoi: 'chance', valeur: 3 })], 2, 'ce_tour');
  // Infanterie contre infanterie en plaine (une étoile) : 32 points au centre
  // de l'aléa, 35 avec +3 de chance — une cible à 34 survit à l'un, pas à l'autre.
  // Sans usine sur la grille : une capture à portée vaudrait plus que le duel et le cacherait.
  const limite = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 1, y: 0, pv: 34 },
  ], 0, {}, {}, ['PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP']);
  assert.ok(detailPouvoir(limite, CAT, 0, p, NORMAL).tactique > 0);
});

test("étoiles −2 sur l'adversaire : positif contre une cible à couvert, nul contre une cible sur route", () => {
  const p = pouvoir([adverse({ quoi: 'etoiles', valeur: -2 })], 2, 'ce_tour');
  // En forêt (deux étoiles), 29 points ; sans étoile, 36 : une cible à 30 PV survit à l'un, pas à l'autre.
  const couvert = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 1, y: 0, pv: 30 },
  ], 0, {}, {}, ['PFPPPPPP', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP']);
  assert.ok(detailPouvoir(couvert, CAT, 0, p, NORMAL).tactique > 0);
  const route = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 1, y: 0, pv: 30 },
  ], 0, {}, {}, ['PRPPPPPP', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP']);
  assert.equal(valeurPouvoir(route, CAT, 0, p, NORMAL), 0, 'la route a zéro étoile, le plancher ne bouge pas');
});

test("mouvement : positif quand il met un objectif à portée, nul quand rien de neuf n'est atteint", () => {
  const p = pouvoir([mien({ quoi: 'mouvement', valeur: 2 })], 2, 'ce_tour');
  // Une ville neutre à cinq pas d'une infanterie qui en fait trois.
  const grille = ['PPPPPCPP', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP'];
  const ville = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 7, y: 3 },
  ], 0, {}, {}, grille);
  assert.ok(detailPouvoir(ville, CAT, 0, p, NORMAL).tactique > 0);
  const rien = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 7, y: 3 },
  ]);
  assert.equal(valeurPouvoir(rien, CAT, 0, p, NORMAL), 0);
});

test('prix : vaut les fonds épargnés sur l’achat de ce tour, rien sans achat possible', () => {
  const p = pouvoir([{ cible: 'economie', modificateur: { quoi: 'prix', valeur: 0.5 } }], 2, 'ce_tour');
  const riche = partie([
    { camp: 0, type: 'infanterie', x: 7, y: 0 },
    { camp: 1, type: 'infanterie', x: 7, y: 3 },
  ], 0, { '0,2': 0 });
  riche.camps[0]!.fonds = 4000;
  const d = detailPouvoir(riche, CAT, 0, p, NORMAL);
  assert.equal(d.economie, 7500 - 3800, "à moitié prix, l'anti-air (7 500) se paie 3 800, arrondi du moteur compris");
  const pauvre = partie([
    { camp: 0, type: 'infanterie', x: 7, y: 0 },
    { camp: 1, type: 'infanterie', x: 7, y: 3 },
  ], 0, { '0,2': 0 });
  pauvre.camps[0]!.fonds = 0;
  assert.equal(valeurPouvoir(pauvre, CAT, 0, p, NORMAL), 0);
});

test('fonds : vaut les revenus des journées couvertes, rien pour une durée qui expire avant le versement', () => {
  const unites: Unites = [
    { camp: 0, type: 'infanterie', x: 7, y: 0 },
    { camp: 1, type: 'infanterie', x: 7, y: 3 },
  ];
  const journee = pouvoir([{ cible: 'economie', modificateur: { quoi: 'fonds', valeur: 1.5 } }], 2, { type: 'journees', n: 1 });
  const etat = partie(unites, 0, { '0,2': 0 });
  assert.equal(detailPouvoir(etat, CAT, 0, journee, NORMAL).economie, Math.round(etat.reglages.revenusParBatiment * 0.5));
  const tourComplet = pouvoir([{ cible: 'economie', modificateur: { quoi: 'fonds', valeur: 1.5 } }], 2, 'tour_complet');
  assert.equal(valeurPouvoir(partie(unites, 0, { '0,2': 0 }), CAT, 0, tourComplet, NORMAL), 0);
});

test("météo : signée par la mobilité qu'elle ôte à chaque camp, nulle si elle est déjà là", () => {
  const neige = pouvoir([{ cible: 'terrain', meteo: { valeur: 'neige', journees: 1 } }], 2, 'ce_tour');
  // La neige n'enlise que les roues et les bottes : mes fantassins passent, leur recon s'enlise.
  const unites: Unites = [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'recon', x: 7, y: 3 },
  ];
  const clair = partie(unites);
  const d = detailPouvoir(clair, CAT, 0, neige, NORMAL);
  assert.ok(d.meteo > 0, `la neige coûte plus à l'adversaire : ${d.meteo}`);
  const dejaNeige = partie(unites, 0, {}, { meteoForcee: 'neige' });
  assert.equal(valeurPouvoir(dejaNeige, CAT, 0, neige, NORMAL), 0);
  const inverse = partie([
    { camp: 0, type: 'recon', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 7, y: 3 },
  ]);
  assert.ok(valeurPouvoir(inverse, CAT, 0, neige, NORMAL) < 0, 'la même neige me coûte à moi');
});

test('vision adverse −2 : positive sous brouillard, nulle au grand jour', () => {
  const p = pouvoir([adverse({ quoi: 'vision', valeur: -2 })], 2, 'tour_complet');
  // Le recon est à deux cases : mon fantassin le voit, même sous brouillard.
  const unites: Unites = [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'recon', x: 2, y: 0 },
  ];
  assert.ok(detailPouvoir(partie(unites, 0, {}, { brouillard: true }), CAT, 0, p, NORMAL).vision > 0);
  assert.equal(valeurPouvoir(partie(unites), CAT, 0, p, NORMAL), 0);
});

test('carburant adverse ×2 : positif pour un appareil poussé au bord de la panne, nul pour un plein', () => {
  const p = pouvoir([adverse({ quoi: 'carburant', valeur: 2 })], 2, 'tour_complet');
  const juste = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'helico', x: 7, y: 3 },
  ]);
  u(juste, 'u2').carburant = 5;
  assert.ok(detailPouvoir(juste, CAT, 0, p, NORMAL).carburant > 0);
  const plein = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'helico', x: 7, y: 3 },
  ]);
  assert.equal(valeurPouvoir(plein, CAT, 0, p, NORMAL), 0);
});

test('un super qui ne change rien est gardé, même jauge pleine ; il part au début du tour dès qu’il vaut quelque chose', () => {
  const c = commandant(pouvoir([mien({ quoi: 'attaque', valeur: 1.5 })]));
  const loin = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 7, y: 3 },
  ], 500);
  assert.equal(decisionPouvoir(loin, CAT, 0, [c, null]), null);
  const r = jouerTour(loin, PONDEREE, creerRng('ia'), CAT, [c, null]);
  assert.deepEqual(r.refus, []);
  assert.ok(!r.actions.some((a) => a.type === 'pouvoir'), 'aucun pouvoir joué');
  const contact = partie([
    { camp: 0, type: 'char_leger', x: 0, y: 0 },
    { camp: 1, type: 'char_leger', x: 2, y: 0 },
  ], 500);
  assert.equal(decisionPouvoir(contact, CAT, 0, [c, null]), 'super');
  const r2 = jouerTour(contact, PONDEREE, creerRng('ia'), CAT, [c, null]);
  assert.deepEqual(r2.refus, []);
  assert.deepEqual(r2.actions[0], { type: 'pouvoir', niveau: 'super' });
  assert.equal(r2.actions.filter((a) => a.type === 'pouvoir').length, 1, 'un seul pouvoir par tour');
});

test('une réactivation ne part qu’à la dernière occasion du tour, quand il y a quelque chose à rejouer', () => {
  const react = pouvoir([{ cible: 'mes_unites', reactiver: true }], 5, 'ce_tour');
  const c = commandant(pouvoir([mien({ quoi: 'attaque', valeur: 1.1 })]), react);
  const etat = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 1, y: 0, pv: 30 },
  ], 500);
  assert.equal(decisionPouvoir(etat, CAT, 0, [c, null]), null, 'au début du tour, personne à réactiver');
  u(etat, 'u1').etat = 'agi';
  assert.equal(decisionPouvoir(etat, CAT, 0, [c, null]), 'super', 'plus rien de prêt : elle rejoue');
});

test('le normal part au-dessus du seuil de ses barres, se garde en deçà, et ne se juge qu’au début du tour', () => {
  const soin = commandant(pouvoir([mien({ quoi: 'soin', valeur: 2 })], 2, 'ce_tour'));
  const gros = partie([
    { camp: 0, type: 'char_lourd', x: 0, y: 0, pv: 50 },
    { camp: 1, type: 'infanterie', x: 7, y: 3 },
  ], 200);
  assert.ok(valeurPouvoir(gros, CAT, 0, soin.pouvoir, NORMAL) >= 2 * SEUIL_PAR_BARRE);
  assert.equal(decisionPouvoir(gros, CAT, 0, [soin, null]), 'normal');
  const r = jouerTour(gros, PONDEREE, creerRng('ia'), CAT, [soin, null]);
  assert.deepEqual(r.refus, []);
  assert.deepEqual(r.actions[0], { type: 'pouvoir', niveau: 'normal' });
  const petit = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0, pv: 50 },
    { camp: 1, type: 'infanterie', x: 7, y: 3 },
  ], 200);
  assert.ok(valeurPouvoir(petit, CAT, 0, soin.pouvoir, NORMAL) < 2 * SEUIL_PAR_BARRE);
  assert.equal(decisionPouvoir(petit, CAT, 0, [soin, null]), null, 'deux PV sur un fantassin ne valent pas deux barres');
  const r2 = jouerTour(petit, PONDEREE, creerRng('ia'), CAT, [soin, null]);
  assert.ok(!r2.actions.some((a) => a.type === 'pouvoir'));
  assert.ok(r2.etat.camps[0]!.jauge >= 200, 'la jauge est gardée pour le super');
  u(gros, 'u1').etat = 'agi';
  assert.equal(decisionPouvoir(gros, CAT, 0, [soin, null]), null, 'une unité a déjà joué : trop tard');
  assert.equal(decisionPouvoir(gros, CAT, 0, []), null);
  assert.equal(decisionPouvoir(gros, CAT, 0, [null, soin]), null, "le commandant de l'autre camp ne compte pas");
});

test("un pouvoir qui pose du terrain est laissé au joueur : l'IA ne sait pas choisir ses cases", () => {
  const pose = pouvoir([{
    cible: 'terrain',
    poserTerrain: { forme: 'pont', depuis: ['riviere'], vers: 'pont', casesMax: 2, contigu: true, duree: { type: 'journees', n: 1 } },
  }]);
  const c = commandant(pose, { ...pose, barres: 5 });
  const etat = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 7, y: 3 },
  ], 500);
  assert.equal(valeurPouvoir(etat, CAT, 0, pose, NORMAL), 0);
  assert.equal(decisionPouvoir(etat, CAT, 0, [c, null]), null);
  assert.deepEqual(jouerTour(etat, PONDEREE, creerRng('ia'), CAT, [c, null]).refus, []);
});

test("la faiblesse adverse est lue sur son chiffre : les types qu'elle nomme, l'ampleur, et un multiplicateur borné", () => {
  const chenilles: EffetModificateur = {
    cible: 'mes_unites', filtre: { mouvement: ['chenilles'] }, modificateur: { quoi: 'attaque', valeur: 0.8 },
  };
  const affaiblis = typesAffaiblis(CAT, chenilles);
  assert.ok(affaiblis.includes('char_leger') && affaiblis.includes('artillerie'));
  assert.ok(!affaiblis.includes('infanterie') && !affaiblis.includes('transport'), 'ni les bottes, ni ce qui ne tire pas');
  assert.ok(Math.abs(ampleurFaiblesse(chenilles) - 1) < 1e-9, '×0,8 est une faiblesse pleine');
  assert.ok(Math.abs(ampleurFaiblesse({ cible: 'economie', modificateur: { quoi: 'fonds', valeur: 0.9 } }) - 0.5) < 1e-9);
  assert.deepEqual(typesAffaiblis(CAT, { cible: 'economie', modificateur: { quoi: 'fonds', valeur: 0.9 } }), []);
  assert.deepEqual(typesAffaiblis(CAT, { cible: 'mes_unites', modificateur: { quoi: 'defense', valeur: 0.9 } }), [], 'toute l’armée : rien à préférer');
  const artillerie = multiplicateurFaiblesse(CAT, 'artillerie', affaiblis, 1);
  const infanterie = multiplicateurFaiblesse(CAT, 'infanterie', affaiblis, 1);
  assert.ok(artillerie > infanterie && artillerie <= 1.3 && infanterie >= 1, `${artillerie} > ${infanterie}`);
});

test('la faiblesse adverse oriente un achat, et le kit du camp aussi', () => {
  // Deux chars légers adverses dont les chenilles frappent à 80 % : à 15 000
  // de fonds, le char léger cède la place au char lourd, qui les bat mieux.
  const grille = ['PPPPPPPPPP', 'PPPPPPPPPP', 'UPPPPPPPPP', 'PPPPPPPPPP', 'PPPPPPPPPP'];
  const unites: Unites = [
    { camp: 0, type: 'infanterie', x: 9, y: 0 },
    { camp: 0, type: 'infanterie', x: 8, y: 0 },
    { camp: 0, type: 'meca', x: 7, y: 0 },
    { camp: 0, type: 'meca', x: 6, y: 0 },
    { camp: 1, type: 'char_leger', x: 9, y: 4 },
    { camp: 1, type: 'char_leger', x: 8, y: 4 },
    { camp: 1, type: 'infanterie', x: 7, y: 4 },
    { camp: 1, type: 'infanterie', x: 6, y: 4 },
  ];
  const faible: CommandantMoteur = {
    ...commandant(pouvoir([mien({ quoi: 'attaque', valeur: 1.1 })])),
    faiblesse: { cible: 'mes_unites', filtre: { mouvement: ['chenilles'] }, modificateur: { quoi: 'attaque', valeur: 0.8 } },
  };
  const etat = partie(unites, 0, { '0,2': 0 }, {}, grille);
  etat.camps[0]!.fonds = 15000;
  // Isoler ce duel d’achat des autres blindés du catalogue complet.
  const cat = { ...CAT, terrains: { ...CAT.terrains, usine: { ...CAT.terrains.usine!, produit: ['char_leger', 'char_lourd'] } } };
  const achatSans = meilleureProduction(etat, cat, 0, POIDS_PONDEREE);
  const achatAvec = meilleureProduction(etat, cat, 0, POIDS_PONDEREE, [null, faible]);
  assert.ok(achatSans && achatSans.type === 'produire' && achatAvec && achatAvec.type === 'produire');
  assert.equal(achatSans.unite, 'char_leger');
  assert.equal(achatAvec.unite, 'char_lourd', "face à des chenilles qui frappent à 80 %, l'achat change");
  const kit = commandant(pouvoir([mien({ quoi: 'attaque', valeur: 1.2 }, { types: ['artillerie'] })]));
  const orientation = orientationKit(CAT, kit);
  assert.ok(Math.abs(orientation('artillerie') - 1.3) < 1e-9);
  assert.equal(orientation('infanterie'), 1);
});
