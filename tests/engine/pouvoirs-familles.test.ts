/**
 * Les familles d'effets de pouvoir du 10 septembre 2026 (`doc/04-gameplay.md`
 * §7.2, « Familles d'effets ») : les trois grandeurs câblées (`soin`,
 * `degats_directs`, `carburant`), les trois neuves (`prix`, `chance`,
 * `etoiles`) et les trois familles instantanées (`ravitailler`, `reactiver`,
 * `meteo`). Chaque test construit son état en mémoire et son commandant à la
 * main : rien ne dépend du contenu des kits.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appliquer, calculerDegats, ciblesDepuis, consommationEffective, empreinte, etoilesDefense, evaluerEffets,
  largeurAlea, peutViser, porteeEffective, poserModificateur, prixProduction, verifierPouvoir, verifierProduction,
  type CommandantMoteur, type EtatPartie, type EvenementJeu,
} from '../../src/engine/index';
import { validerCommander, type EffetPouvoir } from '../../src/schemas/index';
import { commandantCamille } from '../schemas/exemples';
import { CAT, partiePersonnalisee, rngFixe, u } from './aides';

const GRILLE = [
  'PPPPPP',
  'PPFPPP',
  'PPPCPP',
  'UPPPPP',
  'PPPPPP',
];

/** Un commandant de test : le normal et le super portent les effets qu'on lui donne. */
function commandant(
  normal: EffetPouvoir[], superEffets: EffetPouvoir[] = normal,
  duree: CommandantMoteur['pouvoir']['duree'] = 'tour_complet',
): CommandantMoteur {
  return {
    cle: 'cmd_test',
    nom: 'Test',
    passif: null,
    pouvoir: { nom: 'Normal', barres: 2, duree, effets: normal },
    superPouvoir: { nom: 'Super', barres: 5, duree, effets: superEffets },
  };
}

/** Une partie où le camp 0 a de quoi payer n'importe quel pouvoir. */
function partieChargee(
  unites: Parameters<typeof partiePersonnalisee>[2],
  proprietaires: Record<string, 0 | 1> = {},
): EtatPartie {
  const etat = partiePersonnalisee(GRILLE, proprietaires, unites);
  etat.camps[0]!.jauge = 900;
  etat.camps[0]!.jaugeMax = 900;
  return etat;
}

/** Applique un pouvoir et rend l'état d'après, ou échoue lisiblement. */
function declencher(
  etat: EtatPartie, c: CommandantMoteur, niveau: 'normal' | 'super' = 'normal',
): { etat: EtatPartie; evenements: EvenementJeu[] } {
  const r = appliquer(etat, { type: 'pouvoir', niveau }, CAT, [c, null]);
  assert.ok(r.ok, `pouvoir refusé : ${r.ok ? '' : r.motif}`);
  if (!r.ok) throw new Error('inatteignable');
  return { etat: r.etat, evenements: r.evenements };
}

// ---------------------------------------------------------------------------
// Les trois grandeurs mortes, câblées
// ---------------------------------------------------------------------------

test('soin : +n PV affichés une fois, plafonné à 100, sans modificateur posé', () => {
  const etat = partieChargee([
    { camp: 0, type: 'infanterie', x: 0, y: 0, pv: 50 },
    { camp: 0, type: 'infanterie', x: 1, y: 0, pv: 90 },
    { camp: 0, type: 'infanterie', x: 2, y: 0 },
    { camp: 1, type: 'infanterie', x: 5, y: 4, pv: 50 },
  ]);
  const c = commandant([{ cible: 'mes_unites', modificateur: { quoi: 'soin', valeur: 3 } }]);
  const bilan = evaluerEffets(etat, CAT, 0, c.pouvoir.effets);
  assert.equal(bilan.pvSoignes, 4, 'trois PV rendus à la première, un à la seconde, rien à la pleine');
  const { etat: apres, evenements } = declencher(etat, c);
  assert.equal(u(apres, 'u1').pv, 80);
  assert.equal(u(apres, 'u2').pv, 100);
  assert.equal(u(apres, 'u3').pv, 100);
  assert.equal(u(apres, 'u4').pv, 50, "l'adversaire n'est pas soigné");
  const soins = evenements.filter((e) => e.type === 'soin');
  assert.deepEqual(soins, [
    { type: 'soin', uniteId: 'u1', pv: 30 },
    { type: 'soin', uniteId: 'u2', pv: 10 },
  ]);
  assert.equal(apres.modificateurs.length, 0, 'un soin ne laisse rien dans les modificateurs');
  assert.equal(apres.camps[0]!.jauge, 700);
});

test('degats_directs : −n PV affichés aux adversaires, jamais sous 1 PV interne, jamais hors jeu', () => {
  const etat = partieChargee([
    { camp: 0, type: 'infanterie', x: 0, y: 0, pv: 50 },
    { camp: 1, type: 'infanterie', x: 5, y: 4 },
    { camp: 1, type: 'infanterie', x: 4, y: 4, pv: 15 },
    { camp: 1, type: 'infanterie', x: 3, y: 4, pv: 10 },
  ]);
  const c = commandant([{ cible: 'unites_adverses', modificateur: { quoi: 'degats_directs', valeur: 2 } }]);
  assert.equal(evaluerEffets(etat, CAT, 0, c.pouvoir.effets).pvRetires, 2 + 1 + 0);
  const { etat: apres, evenements } = declencher(etat, c);
  assert.equal(u(apres, 'u1').pv, 50, 'les miennes sont intactes');
  assert.equal(u(apres, 'u2').pv, 80);
  assert.equal(u(apres, 'u3').pv, 1, 'le plancher est 1 PV interne');
  assert.equal(u(apres, 'u4').pv, 1, "une unité à 10 PV internes garde son dernier point");
  assert.equal(apres.unites.length, 4, 'personne ne sort du jeu');
  assert.ok(!evenements.some((e) => e.type === 'hors_jeu'));
  assert.deepEqual(evenements.filter((e) => e.type === 'degats_directs'), [
    { type: 'degats_directs', uniteId: 'u2', pv: 20 },
    { type: 'degats_directs', uniteId: 'u3', pv: 14 },
    { type: 'degats_directs', uniteId: 'u4', pv: 9 },
  ]);
  assert.equal(apres.modificateurs.length, 0);
});

test('carburant : le multiplicateur pèse sur la consommation par tour des unités visées', () => {
  const etat = partieChargee([
    { camp: 0, type: 'helico', x: 0, y: 0 },
    { camp: 1, type: 'helico', x: 5, y: 4 },
  ]);
  assert.equal(consommationEffective(etat, CAT, u(etat, 'u1')), 2);
  const c = commandant([{ cible: 'unites_adverses', modificateur: { quoi: 'carburant', valeur: 2 } }]);
  const { etat: apres } = declencher(etat, c);
  assert.equal(consommationEffective(apres, CAT, u(apres, 'u1')), 2, 'les miennes consomment comme avant');
  assert.equal(consommationEffective(apres, CAT, u(apres, 'u2')), 4, "l'adversaire consomme le double");
  // Au tour de l'adversaire, sa phase carburant lit la consommation effective.
  const tour = appliquer(apres, { type: 'finTour' }, CAT, [c, null]);
  assert.ok(tour.ok);
  if (tour.ok) assert.equal(u(tour.etat, 'u2').carburant, 60 - 4);
});

// ---------------------------------------------------------------------------
// Les trois grandeurs neuves
// ---------------------------------------------------------------------------

test('prix : le multiplicateur change le prix vérifié et payé, arrondi à la centaine', () => {
  const etat = partieChargee([
    { camp: 0, type: 'infanterie', x: 5, y: 0 },
    { camp: 1, type: 'infanterie', x: 5, y: 4 },
  ], { '0,3': 0 });
  etat.camps[0]!.fonds = 4000;
  assert.equal(prixProduction(etat, CAT, 0, 'char_leger'), 6500);
  assert.equal(verifierProduction(etat, CAT, 0, { x: 0, y: 3 }, 'char_leger').ok, false);
  const c = commandant([{ cible: 'economie', modificateur: { quoi: 'prix', valeur: 0.55 } }], undefined, 'ce_tour');
  const { etat: apres } = declencher(etat, c);
  assert.equal(prixProduction(apres, CAT, 0, 'char_leger'), 3600, '6 500 × 0,55 = 3 575, arrondi à 3 600');
  assert.equal(prixProduction(apres, CAT, 1, 'char_leger'), 6500, "l'adversaire paie plein tarif");
  const achat = appliquer(apres, { type: 'produire', batiment: { x: 0, y: 3 }, unite: 'char_leger' }, CAT, [c, null]);
  assert.ok(achat.ok);
  if (!achat.ok) return;
  assert.equal(achat.etat.camps[0]!.fonds, 400);
  const evt = achat.evenements.find((e) => e.type === 'production');
  assert.equal(evt?.type === 'production' && evt.cout, 3600);
});

test("chance : chaque point élargit l'aléa vers le haut pour les miennes, le resserre vers le bas pour l'adversaire", () => {
  const etat = partieChargee([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 1, y: 0 },
  ]);
  const att = u(etat, 'u1');
  const def = u(etat, 'u2');
  const base = calculerDegats(etat, CAT, att, def, rngFixe(1));
  assert.equal(largeurAlea(etat, CAT, att), 0.10);
  const c = commandant([
    { cible: 'mes_unites', modificateur: { quoi: 'chance', valeur: 3 } },
    { cible: 'unites_adverses', modificateur: { quoi: 'chance', valeur: -3 } },
  ]);
  const { etat: apres } = declencher(etat, c);
  assert.ok(Math.abs(largeurAlea(apres, CAT, u(apres, 'u1')) - 0.25) < 1e-9);
  assert.ok(Math.abs(largeurAlea(apres, CAT, u(apres, 'u2')) + 0.05) < 1e-9);
  const haut = calculerDegats(apres, CAT, u(apres, 'u1'), u(apres, 'u2'), rngFixe(1));
  assert.ok(haut > base, `à r = 1, la chance frappe plus fort (${haut} contre ${base})`);
  assert.equal(calculerDegats(apres, CAT, u(apres, 'u1'), u(apres, 'u2'), rngFixe(0)),
    calculerDegats(etat, CAT, att, def, rngFixe(0)),
    'à r = 0, rien ne change : la chance ne joue que vers le haut');
  const bas = calculerDegats(apres, CAT, u(apres, 'u2'), u(apres, 'u1'), rngFixe(1));
  const basSans = calculerDegats(etat, CAT, def, att, rngFixe(1));
  assert.ok(bas < basSans, `à r = 1, la malchance frappe moins fort (${bas} contre ${basSans})`);
});

test('chance : un modificateur à zéro laisse le rejeu identique au bit près', () => {
  const unites = [
    { camp: 0 as const, type: 'infanterie' as const, x: 0, y: 0 },
    { camp: 1 as const, type: 'infanterie' as const, x: 1, y: 0 },
  ];
  const sans = partieChargee(unites);
  const avec = partieChargee(unites);
  poserModificateur(avec, 0, 'pouvoir',
    { cible: 'toutes_unites', modificateur: { quoi: 'chance', valeur: 0 } }, { type: 'tour_complet' });
  const attaque = { type: 'ordre' as const, uniteId: 'u1', chemin: [{ x: 0, y: 0 }], suite: { type: 'attaquer' as const, cible: { x: 1, y: 0 } } };
  const a = appliquer(sans, attaque, CAT);
  const b = appliquer(avec, attaque, CAT);
  assert.ok(a.ok && b.ok);
  if (!a.ok || !b.ok) return;
  assert.deepEqual(a.etat.unites, b.etat.unites);
  assert.deepEqual(a.etat.flux, b.etat.flux, 'le flux combat a avancé du même pas');
});

test("etoiles : ajoutées aux étoiles du terrain, plancher 0, plafond 4", () => {
  const etat = partieChargee([
    { camp: 0, type: 'infanterie', x: 3, y: 2 },
    { camp: 0, type: 'infanterie', x: 2, y: 1 },
    { camp: 1, type: 'infanterie', x: 5, y: 4 },
    { camp: 1, type: 'infanterie', x: 4, y: 4 },
  ]);
  assert.equal(etoilesDefense(etat, CAT, u(etat, 'u1')), 3, 'une ville vaut trois étoiles');
  assert.equal(etoilesDefense(etat, CAT, u(etat, 'u2')), 2, 'une forêt en vaut deux');
  const c = commandant([
    { cible: 'mes_unites', modificateur: { quoi: 'etoiles', valeur: 2 } },
    { cible: 'unites_adverses', modificateur: { quoi: 'etoiles', valeur: -2 } },
  ]);
  const { etat: apres } = declencher(etat, c);
  assert.equal(etoilesDefense(apres, CAT, u(apres, 'u1')), 4, 'ville + 2 plafonne à 4');
  assert.equal(etoilesDefense(apres, CAT, u(apres, 'u2')), 4, 'forêt + 2 = 4');
  assert.equal(etoilesDefense(apres, CAT, u(apres, 'u3')), 0, "la plaine adverse est mise à plat, pas en dessous");
  assert.equal(etoilesDefense(apres, CAT, u(apres, 'u4')), 0);
  const avant = calculerDegats(etat, CAT, u(etat, 'u3'), u(etat, 'u1'), rngFixe());
  const ensuite = calculerDegats(apres, CAT, u(apres, 'u3'), u(apres, 'u1'), rngFixe());
  assert.ok(ensuite < avant, 'quatre étoiles protègent mieux que trois');
});

test("portee : le modificateur allonge le tir, ne rapproche jamais le minimum, et l'enveloppe le suit", () => {
  const etat = partieChargee([
    { camp: 0, type: 'artillerie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 4, y: 0 },
    { camp: 1, type: 'infanterie', x: 1, y: 0 },
  ]);
  const art = u(etat, 'u1');
  assert.deepEqual(porteeEffective(etat, CAT, art), CAT.unites['artillerie']!.portee, 'sans pouvoir, la portée du type');
  assert.equal(peutViser(etat, CAT, art, u(etat, 'u2'), art, false).ok, false, 'à quatre cases, hors de portée');
  const c = commandant([{ cible: 'mes_unites', modificateur: { quoi: 'portee', valeur: 1 } }]);
  const { etat: apres } = declencher(etat, c);
  const artApres = u(apres, 'u1');
  assert.equal(porteeEffective(apres, CAT, artApres)[1], CAT.unites['artillerie']!.portee[1] + 1);
  assert.equal(porteeEffective(apres, CAT, artApres)[0], CAT.unites['artillerie']!.portee[0], 'le minimum ne bouge pas');
  assert.equal(peutViser(apres, CAT, artApres, u(apres, 'u2'), artApres, false).ok, true, 'quatre cases : atteinte avec +1');
  assert.equal(peutViser(apres, CAT, artApres, u(apres, 'u3'), artApres, false).ok, false, 'le contact reste interdit');
  assert.equal(ciblesDepuis(apres, CAT, artApres, artApres, false).length, 1, "l'enveloppe du contrôleur passe par ciblesDepuis");
});

// ---------------------------------------------------------------------------
// Les familles instantanées
// ---------------------------------------------------------------------------

test('ravitailler : remet au plein ce qui est coché, et rien d’autre', () => {
  const etat = partieChargee([
    { camp: 0, type: 'helico', x: 0, y: 0 },
    { camp: 0, type: 'char_leger', x: 1, y: 0 },
    { camp: 1, type: 'helico', x: 5, y: 4 },
  ]);
  u(etat, 'u1').munitions = 0;
  u(etat, 'u1').carburant = 5;
  u(etat, 'u2').munitions = 1;
  u(etat, 'u2').carburant = 10;
  u(etat, 'u3').munitions = 0;
  const c = commandant([{ cible: 'mes_unites', ravitailler: { carburant: false, munitions: true } }]);
  assert.deepEqual(evaluerEffets(etat, CAT, 0, c.pouvoir.effets).ravitaillees, ['u1', 'u2']);
  const { etat: apres, evenements } = declencher(etat, c);
  assert.equal(u(apres, 'u1').munitions, 6);
  assert.equal(u(apres, 'u1').carburant, 5, 'le carburant n’était pas coché');
  assert.equal(u(apres, 'u2').munitions, 9);
  assert.equal(u(apres, 'u3').munitions, 0, "l'adversaire reste à sec");
  assert.deepEqual(evenements.filter((e) => e.type === 'ravitaillement'), [
    { type: 'ravitaillement', uniteId: 'u1', cibleId: 'u1' },
    { type: 'ravitaillement', uniteId: 'u2', cibleId: 'u2' },
  ]);
  assert.equal(apres.modificateurs.length, 0);
});

test('reactiver : les unités qui ont joué rejouent une fois, points de capture gardés, super seulement', () => {
  const etat = partieChargee([
    { camp: 0, type: 'infanterie', x: 3, y: 2 },
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 0, type: 'infanterie', x: 1, y: 0 },
    { camp: 1, type: 'infanterie', x: 5, y: 4 },
  ]);
  // La première capture la ville : elle a joué, avec des points en poche.
  const capture = appliquer(etat, { type: 'ordre', uniteId: 'u1', chemin: [{ x: 3, y: 2 }], suite: { type: 'capturer' } }, CAT);
  assert.ok(capture.ok);
  if (!capture.ok) return;
  const joue = capture.etat;
  assert.equal(u(joue, 'u1').etat, 'agi');
  assert.ok(u(joue, 'u1').pointsCapture > 0);
  u(joue, 'u3').etat = 'agi';
  u(joue, 'u3').reactivee = true;

  const c = commandant(
    [{ cible: 'mes_unites', modificateur: { quoi: 'attaque', valeur: 1.2 } }],
    [{ cible: 'mes_unites', reactiver: true }],
  );
  assert.deepEqual(evaluerEffets(joue, CAT, 0, c.superPouvoir.effets).reactivees, ['u1']);
  const { etat: apres, evenements } = declencher(joue, c, 'super');
  assert.equal(u(apres, 'u1').etat, 'prete');
  assert.equal(u(apres, 'u1').reactivee, true);
  assert.ok(u(apres, 'u1').pointsCapture > 0, 'la capture entamée reste entamée');
  assert.equal(u(apres, 'u2').etat, 'prete', "une unité qui n'a pas joué n'a rien à réactiver");
  assert.equal(u(apres, 'u3').etat, 'agi', 'déjà réactivée ce tour : pas deux fois');
  assert.deepEqual(evenements.filter((e) => e.type === 'reactivation'), [{ type: 'reactivation', camp: 0, unites: ['u1'] }]);
  // Elle finit la capture au même tour, puis la fermeture efface la marque.
  const suite = appliquer(apres, { type: 'ordre', uniteId: 'u1', chemin: [{ x: 3, y: 2 }], suite: { type: 'capturer' } }, CAT, [c, null]);
  assert.ok(suite.ok);
  if (!suite.ok) return;
  assert.equal(suite.etat.proprietaires['3,2'], 0, 'deux tours de capture en une journée : la ville tombe');
  const fin = appliquer(suite.etat, { type: 'finTour' }, CAT, [c, null]);
  assert.ok(fin.ok);
  if (fin.ok) assert.equal(u(fin.etat, 'u1').reactivee, undefined);
});

test('reactiver sur un pouvoir normal : refusé `pouvoir_invalide`, jauge ou pas', () => {
  const etat = partieChargee([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 5, y: 4 },
  ]);
  const c = commandant([{ cible: 'mes_unites', reactiver: true }], [{ cible: 'mes_unites', reactiver: true }]);
  const verdict = verifierPouvoir(etat, c, 0, 'normal');
  assert.equal(verdict.ok === false && verdict.motif, 'pouvoir_invalide');
  const r = appliquer(etat, { type: 'pouvoir', niveau: 'normal' }, CAT, [c, null]);
  assert.equal(r.ok === false && r.motif, 'pouvoir_invalide');
  assert.equal(verifierPouvoir(etat, c, 0, 'super').ok, true);
});

test('meteo : imposée à tous pour n journées, prévision comprise, sans toucher au flux météo', () => {
  const unites = [
    { camp: 0 as const, type: 'infanterie' as const, x: 0, y: 0 },
    { camp: 1 as const, type: 'infanterie' as const, x: 5, y: 4 },
  ];
  // Le climat tire vraiment (pas de météo forcée par les réglages), sur un
  // climat où la neige n'existe pas : une neige ne peut venir que du pouvoir.
  const depart = partiePersonnalisee(GRILLE, {}, unites, { meteoForcee: null, climatPays: 'tropical', saisonForcee: 'ete' });
  depart.camps[0]!.jauge = 900;
  depart.camps[0]!.jaugeMax = 900;
  const c = commandant(
    [{ cible: 'terrain', meteo: { valeur: 'neige', journees: 1 } }],
    [{ cible: 'terrain', meteo: { valeur: 'neige', journees: 2 } }],
  );
  const { etat: apres, evenements } = declencher(depart, c, 'super');
  assert.equal(apres.climat.meteo, 'neige');
  assert.equal(apres.climat.previsions[0], 'neige', 'demain est couvert par le pouvoir');
  assert.equal(apres.climat.previsions[1], depart.climat.previsions[1], 'après-demain reste ce qui a été tiré');
  assert.deepEqual(evenements.filter((e) => e.type === 'meteo_forcee'), [{ type: 'meteo_forcee', camp: 0, meteo: 'neige', journees: 2 }]);
  assert.deepEqual(apres.meteoImposee, { meteo: 'neige', jusqu: 2, camp: 0 });

  // Deux journées plus loin, avec et sans pouvoir : même flux météo, même
  // tirage de J+2 — seule la valeur des journées couvertes diffère.
  const avancer = (e: EtatPartie): EtatPartie => {
    let courant = e;
    for (let i = 0; i < 4; i += 1) {
      const r = appliquer(courant, { type: 'finTour' }, CAT, [c, null]);
      assert.ok(r.ok);
      if (r.ok) courant = r.etat;
    }
    return courant;
  };
  const avecPouvoir = avancer(apres);
  const sansPouvoir = avancer(depart);
  assert.equal(avecPouvoir.journee, 3);
  assert.deepEqual(avecPouvoir.flux['meteo'], sansPouvoir.flux['meteo'], 'le flux météo a avancé du même pas');
  assert.equal(avecPouvoir.climat.meteo, sansPouvoir.climat.meteo, 'journée 3 : le pouvoir est fini, la météo tirée reprend');
  assert.equal(avecPouvoir.meteoImposee, undefined, "l'état ne garde pas une météo expirée");
  const journee2 = avecPouvoir.journal.find((e) => e.type === 'debut_journee' && e.journee === 2);
  assert.equal(journee2?.type === 'debut_journee' && journee2.meteo, 'neige', 'journée 2 : encore la neige du pouvoir');

  // Deux journées sur un pouvoir normal : refusé.
  const deuxNormal = commandant([{ cible: 'terrain', meteo: { valeur: 'neige', journees: 2 } }]);
  const refus = verifierPouvoir(depart, deuxNormal, 0, 'normal');
  assert.equal(refus.ok === false && refus.motif, 'pouvoir_invalide');
  assert.equal(declencher(depart, c, 'normal').etat.climat.previsions[0], depart.climat.previsions[0], 'une journée : demain n’est pas touché');
});

// ---------------------------------------------------------------------------
// Les interdits qui tiennent, et les refus du validateur
// ---------------------------------------------------------------------------

test("aucune famille ne met hors jeu, ne change un propriétaire, ne produit, ne déplace, ni ne descend sous 1 PV", () => {
  const unites = [
    { camp: 0 as const, type: 'infanterie' as const, x: 3, y: 2, pv: 40 },
    { camp: 0 as const, type: 'helico' as const, x: 0, y: 0, pv: 10 },
    { camp: 1 as const, type: 'infanterie' as const, x: 5, y: 4, pv: 10 },
    { camp: 1 as const, type: 'char_leger' as const, x: 4, y: 4, pv: 25 },
  ];
  const familles: EffetPouvoir[][] = [
    [{ cible: 'mes_unites', modificateur: { quoi: 'soin', valeur: 5 } }],
    [{ cible: 'unites_adverses', modificateur: { quoi: 'degats_directs', valeur: 3 } }],
    [{ cible: 'toutes_unites', modificateur: { quoi: 'carburant', valeur: 2 } }],
    [{ cible: 'economie', modificateur: { quoi: 'prix', valeur: 0.5 } }],
    [{ cible: 'mes_unites', modificateur: { quoi: 'chance', valeur: 3 } }],
    [{ cible: 'unites_adverses', modificateur: { quoi: 'etoiles', valeur: -2 } }],
    [{ cible: 'mes_unites', ravitailler: { carburant: true, munitions: true } }],
    [{ cible: 'mes_unites', reactiver: true }],
    [{ cible: 'terrain', meteo: { valeur: 'tempete', journees: 2 } }],
  ];
  for (const effets of familles) {
    const etat = partieChargee(unites, { '3,2': 1, '0,3': 0 });
    u(etat, 'u1').etat = 'agi';
    const { etat: apres } = declencher(etat, commandant(effets, effets), 'super');
    const nom = JSON.stringify(effets[0]);
    assert.equal(apres.unites.length, etat.unites.length, `${nom} : personne ne sort, personne n'entre`);
    assert.deepEqual(apres.proprietaires, etat.proprietaires, `${nom} : aucun propriétaire ne change`);
    assert.deepEqual(apres.unites.map((x) => [x.id, x.x, x.y]), etat.unites.map((x) => [x.id, x.x, x.y]), `${nom} : personne ne bouge`);
    assert.ok(apres.unites.every((x) => x.pv >= 1), `${nom} : jamais moins de 1 PV`);
    assert.equal(apres.camps[0]!.fonds, etat.camps[0]!.fonds, `${nom} : aucun fonds ne tombe du ciel`);
    assert.notEqual(empreinte(apres), empreinte(etat), `${nom} : le pouvoir a bien fait quelque chose (au moins la jauge)`);
  }
});

test('le validateur refuse les cibles incohérentes et les exceptions hors du super', () => {
  const cas: { titre: string; muter: (p: Record<string, unknown>) => void; chemin: string }[] = [
    { titre: 'soin sur les adversaires', muter: (p) => { p['effets'] = [{ cible: 'unites_adverses', modificateur: { quoi: 'soin', valeur: 2 } }]; }, chemin: 'pouvoir.effets[0].cible' },
    { titre: 'dégâts directs sur les miennes', muter: (p) => { p['effets'] = [{ cible: 'mes_unites', modificateur: { quoi: 'degats_directs', valeur: 2 } }]; }, chemin: 'pouvoir.effets[0].cible' },
    { titre: 'dégâts directs à quatre', muter: (p) => { p['effets'] = [{ cible: 'unites_adverses', modificateur: { quoi: 'degats_directs', valeur: 4 } }]; }, chemin: 'pouvoir.effets[0].modificateur.valeur' },
    { titre: 'chance positive offerte à l’adversaire', muter: (p) => { p['effets'] = [{ cible: 'unites_adverses', modificateur: { quoi: 'chance', valeur: 2 } }]; }, chemin: 'pouvoir.effets[0].cible' },
    { titre: 'chance à quatre', muter: (p) => { p['effets'] = [{ cible: 'mes_unites', modificateur: { quoi: 'chance', valeur: 4 } }]; }, chemin: 'pouvoir.effets[0].modificateur.valeur' },
    { titre: 'étoiles à trois', muter: (p) => { p['effets'] = [{ cible: 'mes_unites', modificateur: { quoi: 'etoiles', valeur: 3 } }]; }, chemin: 'pouvoir.effets[0].modificateur.valeur' },
    { titre: 'prix hors économie', muter: (p) => { p['effets'] = [{ cible: 'mes_unites', modificateur: { quoi: 'prix', valeur: 0.8 } }]; }, chemin: 'pouvoir.effets[0].cible' },
    { titre: 'prix à 0,4', muter: (p) => { p['effets'] = [{ cible: 'economie', modificateur: { quoi: 'prix', valeur: 0.4 } }]; }, chemin: 'pouvoir.effets[0].modificateur.valeur' },
    { titre: 'prix qui dure des journées', muter: (p) => { p['effets'] = [{ cible: 'economie', modificateur: { quoi: 'prix', valeur: 0.8 } }]; p['duree'] = { type: 'journees', n: 1 }; }, chemin: 'pouvoir.duree' },
    { titre: 'réactiver les adversaires', muter: (p) => { p['effets'] = [{ cible: 'unites_adverses', reactiver: true }]; }, chemin: 'pouvoir.effets[0].cible' },
    { titre: 'réactiver sur un pouvoir normal', muter: (p) => { p['effets'] = [{ cible: 'mes_unites', reactiver: true }]; }, chemin: 'pouvoir.effets[0].reactiver' },
    { titre: 'ravitailler tout le monde', muter: (p) => { p['effets'] = [{ cible: 'toutes_unites', ravitailler: { carburant: true, munitions: true } }]; }, chemin: 'pouvoir.effets[0].cible' },
    { titre: 'ravitailler rien', muter: (p) => { p['effets'] = [{ cible: 'mes_unites', ravitailler: { carburant: false, munitions: false } }]; }, chemin: 'pouvoir.effets[0].ravitailler' },
    { titre: 'deux journées de météo sur un pouvoir normal', muter: (p) => { p['effets'] = [{ cible: 'terrain', meteo: { valeur: 'pluie', journees: 2 } }]; }, chemin: 'pouvoir.effets[0].meteo.journees' },
    { titre: 'météo hors liste', muter: (p) => { p['effets'] = [{ cible: 'terrain', meteo: { valeur: 'grele', journees: 1 } }]; }, chemin: 'pouvoir.effets[0].meteo.valeur' },
  ];
  for (const c of cas) {
    const o = JSON.parse(JSON.stringify(commandantCamille)) as Record<string, unknown>;
    c.muter(o['pouvoir'] as Record<string, unknown>);
    const r = validerCommander(o);
    assert.equal(r.ok, false, `${c.titre} : devrait être refusé`);
    if (!r.ok) assert.ok(r.erreurs.some((e) => e.chemin === c.chemin), `${c.titre} : attendu ${c.chemin}, reçu ${r.erreurs.map((e) => e.chemin).join(', ')}`);
  }
});

test('le validateur accepte un commandant qui porte toutes les familles à leur place', () => {
  const o = JSON.parse(JSON.stringify(commandantCamille)) as Record<string, unknown>;
  const pouvoir = o['pouvoir'] as Record<string, unknown>;
  pouvoir['effets'] = [
    { cible: 'mes_unites', modificateur: { quoi: 'soin', valeur: 2 } },
    { cible: 'economie', modificateur: { quoi: 'prix', valeur: 0.8 } },
    { cible: 'terrain', meteo: { valeur: 'pluie', journees: 1 } },
  ];
  pouvoir['duree'] = 'ce_tour';
  const superPouvoir = o['superPouvoir'] as Record<string, unknown>;
  superPouvoir['effets'] = [
    { cible: 'unites_adverses', modificateur: { quoi: 'degats_directs', valeur: 2 } },
    { cible: 'mes_unites', reactiver: true, filtre: { mouvement: ['chenilles'] } },
    { cible: 'mes_unites', ravitailler: { carburant: true, munitions: false } },
  ];
  const r = validerCommander(o);
  assert.equal(r.ok, true, r.ok ? '' : JSON.stringify(r.erreurs));
});
