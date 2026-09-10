/**
 * Les familles de la faction (10 septembre 2026, `doc/04-gameplay.md` §7.2,
 * « Les familles de la faction ») : `frappe` de zone, rayon `laser`, `iem`.
 * Réservées au camp `atl` — refusées au schéma sur un commandant national,
 * refusées `pouvoir_invalide` par le moteur sur un camp qui n'est pas la
 * faction —, bornées plus court au pouvoir normal, et `iem.abattre` est la
 * seule mise hors jeu directe du jeu, au super seul, à huit barres au moins.
 * Chaque test construit son état en mémoire : rien ne dépend des kits.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appliquer, chargerCatalogue, creerPartie, empreinte, enregistrerPartie, evaluerEffets, JAUGE_PAR_PV_SUBI,
  pointsMouvement, prevoirDuel, rejouer, verifierPouvoir,
  type Action, type CommandantMoteur, type EtatPartie, type EvenementJeu, type ReglagesPartie, type Scene,
} from '../../src/engine/index';
import { BORNES_FACTION, validerCommander, type EffetPouvoir } from '../../src/schemas/index';
import { commandantCamille } from '../schemas/exemples';
import { scenePersonnalisee, u } from './aides';

/** Le catalogue 3 : il porte le drone, qu'une impulsion doit abattre comme un hélicoptère. */
const CAT = chargerCatalogue(3);

const GRILLE = [
  'HPPPPPPP',
  'PPPPPPPP',
  'PPPPPPPP',
  'PPPPPPPP',
  'PPPPPPPH',
];
const QGS = { '0,0': 0 as const, '7,4': 1 as const };

type Unites = Parameters<typeof scenePersonnalisee>[2];

/** Une scène où le camp 0 est la faction, sauf demande contraire. */
function scene(unites: Unites, reglages: Partial<ReglagesPartie> = {}, faction = true): Scene {
  return scenePersonnalisee(GRILLE, QGS, unites, {
    ...(faction ? { factionsParCamp: { 0: 'atl' } } : {}), ...reglages,
  });
}

/** Une partie où le camp 0 a de quoi payer n'importe quel pouvoir. */
function partie(unites: Unites, reglages: Partial<ReglagesPartie> = {}, faction = true): EtatPartie {
  const etat = creerPartie(scene(unites, reglages, faction), CAT, 'faction');
  etat.camps[0]!.jauge = 900;
  etat.camps[0]!.jaugeMax = 900;
  return etat;
}

/** Un commandant de test : le normal et le super portent les effets qu'on leur donne. */
function commandant(normal: EffetPouvoir[], superEffets: EffetPouvoir[] = normal, barresSuper = 8): CommandantMoteur {
  return {
    cle: 'cmd_test',
    nom: 'Test',
    passif: null,
    pouvoir: { nom: 'Normal', barres: 2, duree: 'ce_tour', effets: normal },
    superPouvoir: { nom: 'Super', barres: barresSuper, duree: 'ce_tour', effets: superEffets },
  };
}

function declencher(
  etat: EtatPartie, c: CommandantMoteur, niveau: 'normal' | 'super', cases?: { x: number; y: number }[],
): { etat: EtatPartie; evenements: EvenementJeu[] } {
  const action: Action = cases ? { type: 'pouvoir', niveau, cases } : { type: 'pouvoir', niveau };
  const r = appliquer(etat, action, CAT, [c, null]);
  assert.ok(r.ok, `pouvoir refusé : ${r.ok ? '' : `${r.motif} ${r.detail ?? ''}`}`);
  if (!r.ok) throw new Error('inatteignable');
  return { etat: r.etat, evenements: r.evenements };
}

function refus(etat: EtatPartie, c: CommandantMoteur, niveau: 'normal' | 'super', cases?: { x: number; y: number }[]): string {
  const action: Action = cases ? { type: 'pouvoir', niveau, cases } : { type: 'pouvoir', niveau };
  const r = appliquer(etat, action, CAT, [c, null]);
  assert.equal(r.ok, false, 'devrait être refusé');
  return r.ok ? '' : r.motif;
}

const FRAPPE = (pv: number, rayon: number): EffetPouvoir => ({ cible: 'terrain', frappe: { pv, rayon } });
const LASER = (pv: number, nombre: number, choix: 'plus_cheres' | 'plus_avancees'): EffetPouvoir => (
  { cible: 'unites_adverses', laser: { pv, nombre, choix } }
);
const IEM = (rayon: number, abattre: boolean): EffetPouvoir => ({ cible: 'terrain', iem: { rayon, abattre } });

// ---------------------------------------------------------------------------
// Frappe de zone
// ---------------------------------------------------------------------------

test('frappe_zone : −n PV dans le rayon, des deux camps, plancher 1 PV, cale épargnée, case obligatoire', () => {
  const etat = partie([
    { camp: 0, type: 'infanterie', x: 3, y: 2 },
    { camp: 0, type: 'transport', x: 2, y: 2 },
    { camp: 0, type: 'infanterie', x: 0, y: 1 },
    { camp: 1, type: 'char_leger', x: 4, y: 2 },
    { camp: 1, type: 'infanterie', x: 3, y: 1, pv: 15 },
    { camp: 1, type: 'infanterie', x: 5, y: 2 },
  ]);
  // La troisième infanterie monte dans le transport, à la main : la cale ne se frappe pas.
  const passager = u(etat, 'u3');
  const transport = u(etat, 'u2');
  passager.dansTransport = transport.id;
  passager.x = transport.x;
  passager.y = transport.y;
  transport.cargo = [passager.id];

  const c = commandant([FRAPPE(2, 1)]);
  const bilan = evaluerEffets(etat, CAT, 0, c.pouvoir.effets, [{ x: 3, y: 2 }]);
  assert.deepEqual(bilan.touchees, [
    { uniteId: 'u1', pv: 2 }, { uniteId: 'u2', pv: 2 }, { uniteId: 'u4', pv: 2 }, { uniteId: 'u5', pv: 1 },
  ]);
  assert.equal(bilan.pvRetires, 3, 'seule la part adverse compte dans les PV retirés');

  assert.equal(refus(etat, c, 'normal'), 'pouvoir_invalide', 'sans case');
  assert.equal(refus(etat, c, 'normal', [{ x: 9, y: 9 }]), 'pouvoir_invalide', 'hors carte');
  assert.equal(etat.camps[0]!.jauge, 900, 'un refus ne coûte rien');

  const { etat: apres, evenements } = declencher(etat, c, 'normal', [{ x: 3, y: 2 }]);
  assert.equal(u(apres, 'u1').pv, 80, 'la mienne au centre est touchée');
  assert.equal(u(apres, 'u2').pv, 80, 'le transport est touché');
  assert.equal(u(apres, 'u3').pv, 100, 'sa cale non');
  assert.equal(u(apres, 'u4').pv, 80);
  assert.equal(u(apres, 'u5').pv, 1, 'plancher 1 PV interne');
  assert.equal(u(apres, 'u6').pv, 100, 'à deux cases, hors du rayon');
  assert.equal(apres.unites.length, 6, 'personne ne sort du jeu');
  assert.equal(apres.modificateurs.length, 0);
  assert.equal(apres.camps[0]!.jauge, 700);
  const evt = evenements.find((e) => e.type === 'frappe_zone');
  assert.deepEqual(evt, {
    type: 'frappe_zone', camp: 0, centre: { x: 3, y: 2 }, rayon: 1,
    touchees: [{ uniteId: 'u1', pv: 20 }, { uniteId: 'u2', pv: 20 }, { uniteId: 'u4', pv: 20 }, { uniteId: 'u5', pv: 14 }],
  });
});

test('frappe_zone : au-delà de 2 PV ou de 1 case, le super seul', () => {
  const etat = partie([{ camp: 0, type: 'infanterie', x: 0, y: 1 }, { camp: 1, type: 'infanterie', x: 6, y: 4 }]);
  const forte = commandant([FRAPPE(3, 1)], [FRAPPE(3, 2)]);
  assert.equal(refus(etat, forte, 'normal', [{ x: 6, y: 4 }]), 'pouvoir_invalide');
  const large = commandant([FRAPPE(2, 2)]);
  assert.equal(refus(etat, large, 'normal', [{ x: 6, y: 4 }]), 'pouvoir_invalide');
  const { etat: apres } = declencher(etat, forte, 'super', [{ x: 5, y: 3 }]);
  assert.equal(u(apres, 'u2').pv, 70, 'au super, 3 PV à deux cases');
});

// ---------------------------------------------------------------------------
// Rayon laser
// ---------------------------------------------------------------------------

test('rayon_laser plus_cheres : les n adverses les plus chères, à égalité le plus petit id, sans case', () => {
  const etat = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 1, pv: 50 },
    { camp: 1, type: 'infanterie', x: 6, y: 4 },
    { camp: 1, type: 'char_lourd', x: 6, y: 3 },
    { camp: 1, type: 'infanterie', x: 5, y: 4 },
    { camp: 1, type: 'char_leger', x: 7, y: 3, pv: 25 },
  ]);
  const c = commandant([LASER(3, 3, 'plus_cheres')]);
  const bilan = evaluerEffets(etat, CAT, 0, c.pouvoir.effets);
  assert.deepEqual(bilan.touchees, [{ uniteId: 'u3', pv: 3 }, { uniteId: 'u5', pv: 2 }, { uniteId: 'u2', pv: 3 }]);
  const { etat: apres, evenements } = declencher(etat, c, 'normal');
  assert.equal(u(apres, 'u3').pv, 70, 'le char lourd, le plus cher');
  assert.equal(u(apres, 'u5').pv, 1, 'le char léger, plancher 1 PV');
  assert.equal(u(apres, 'u2').pv, 70, "la première infanterie par l'id");
  assert.equal(u(apres, 'u4').pv, 100, 'la seconde infanterie est épargnée');
  assert.equal(u(apres, 'u1').pv, 50, 'la mienne aussi');
  assert.deepEqual(evenements.find((e) => e.type === 'rayon_laser'), {
    type: 'rayon_laser', camp: 0, touchees: [{ uniteId: 'u3', pv: 30 }, { uniteId: 'u5', pv: 24 }, { uniteId: 'u2', pv: 30 }],
  });
});

test('rayon_laser plus_avancees : les plus proches de mon QG', () => {
  const etat = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 1 },
    { camp: 1, type: 'char_lourd', x: 6, y: 4 },
    { camp: 1, type: 'infanterie', x: 1, y: 1 },
  ]);
  const c = commandant([LASER(2, 1, 'plus_avancees')]);
  const { etat: apres } = declencher(etat, c, 'normal');
  assert.equal(u(apres, 'u3').pv, 80, "l'infanterie à deux pas du QG");
  assert.equal(u(apres, 'u2').pv, 100, 'le char lourd, loin, est épargné même plus cher');
});

test('rayon_laser sous brouillard : ne touche que ce que le camp voit', () => {
  const etat = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 1 },
    { camp: 1, type: 'char_lourd', x: 7, y: 3 },
    { camp: 1, type: 'infanterie', x: 1, y: 2 },
  ], { brouillard: true });
  const c = commandant([LASER(2, 1, 'plus_cheres')]);
  const { etat: apres } = declencher(etat, c, 'normal');
  assert.equal(u(apres, 'u2').pv, 100, 'le char lourd invisible est hors de portée du laser');
  assert.equal(u(apres, 'u3').pv, 80, "l'infanterie vue prend le rayon");
});

// ---------------------------------------------------------------------------
// Impulsion
// ---------------------------------------------------------------------------

test('iem : arrête ce qui a un moteur dans le rayon, des deux camps, sans dégât ; se lève au bon tour', () => {
  const etat = partie([
    { camp: 0, type: 'char_leger', x: 2, y: 2 },
    { camp: 0, type: 'infanterie', x: 0, y: 1 },
    { camp: 1, type: 'helico', x: 3, y: 2 },
    { camp: 1, type: 'recon', x: 4, y: 2 },
    { camp: 1, type: 'infanterie', x: 3, y: 1 },
    { camp: 1, type: 'char_lourd', x: 5, y: 2 },
  ]);
  const c = commandant([IEM(1, false)]);
  const bilan = evaluerEffets(etat, CAT, 0, c.pouvoir.effets, [{ x: 3, y: 2 }]);
  assert.deepEqual(bilan.immobilisees, ['u1', 'u3', 'u4']);
  assert.deepEqual(bilan.abattues, []);
  assert.equal(refus(etat, c, 'normal'), 'pouvoir_invalide', 'sans case');

  const { etat: apres, evenements } = declencher(etat, c, 'normal', [{ x: 3, y: 2 }]);
  for (const id of ['u1', 'u3', 'u4']) {
    assert.equal(u(apres, id).iemJusquaJournee, apres.journee, `${id} arrêtée`);
    assert.equal(u(apres, id).etat, 'agi');
    assert.equal(u(apres, id).pv, 100, 'aucun dégât');
    assert.equal(pointsMouvement(apres, CAT, u(apres, id)), 0);
  }
  assert.equal(u(apres, 'u5').iemJusquaJournee, undefined, "l'infanterie n'a pas de moteur");
  assert.equal(u(apres, 'u6').iemJusquaJournee, undefined, 'à deux cases');
  assert.equal(apres.unites.length, 6, 'personne ne sort du jeu sans abattre');
  assert.deepEqual(evenements.find((e) => e.type === 'iem_pouvoir'), {
    type: 'iem_pouvoir', camp: 0, centre: { x: 3, y: 2 }, rayon: 1, immobilisees: ['u1', 'u3', 'u4'], abattues: [],
  });
  // Pas de riposte sous impulsion : la prévision le sait.
  const prev = prevoirDuel(apres, CAT, u(apres, 'u2'), u(apres, 'u4'), { x: 4, y: 1 });
  assert.equal(prev.riposte, 0);

  // Ma propre unité est rendue à la fermeture de mon tour ; les siennes
  // restent arrêtées pendant tout leur tour, et sont rendues à sa fermeture.
  const fin = (e: EtatPartie): EtatPartie => {
    const r = appliquer(e, { type: 'finTour' }, CAT, [c, null]);
    assert.ok(r.ok);
    return r.ok ? r.etat : e;
  };
  const tourAdverse = fin(apres);
  assert.equal(u(tourAdverse, 'u1').iemJusquaJournee, undefined, 'la mienne est libérée');
  assert.equal(tourAdverse.campCourant, 1);
  assert.equal(u(tourAdverse, 'u3').etat, 'agi', "l'hélico adverse ne joue pas ce tour");
  const bouge = appliquer(tourAdverse, { type: 'ordre', uniteId: 'u4', chemin: [{ x: 4, y: 2 }, { x: 4, y: 3 }], suite: { type: 'rien' } }, CAT, [c, null]);
  assert.equal(bouge.ok, false);
  const monTour = fin(tourAdverse);
  assert.equal(u(monTour, 'u3').iemJusquaJournee, undefined, 'levée à la fermeture de son tour');
  const sonTourSuivant = fin(monTour);
  assert.equal(u(sonTourSuivant, 'u3').etat, 'prete', 'et elle rejoue au tour suivant');
});

test('iem abattre : les aériennes adverses touchées sortent du jeu, drones compris ; jauge comme un combat subi', () => {
  const etat = partie([
    { camp: 0, type: 'helico', x: 2, y: 2 },
    { camp: 0, type: 'infanterie', x: 0, y: 1 },
    { camp: 1, type: 'helico', x: 3, y: 2, pv: 60 },
    { camp: 1, type: 'drone', x: 3, y: 3 },
    { camp: 1, type: 'recon', x: 4, y: 2 },
    { camp: 1, type: 'helico', x: 3, y: 4 },
  ]);
  const c = commandant([IEM(1, false)], [IEM(1, true)], 8);
  const bilan = evaluerEffets(etat, CAT, 0, c.superPouvoir.effets, [{ x: 3, y: 2 }]);
  assert.deepEqual(bilan.abattues, ['u3', 'u4']);
  assert.deepEqual(bilan.immobilisees, ['u1', 'u5']);
  const jaugeAdverse = etat.camps[1]!.jauge;
  const { etat: apres, evenements } = declencher(etat, c, 'super', [{ x: 3, y: 2 }]);
  assert.ok(!apres.unites.some((x) => x.id === 'u3' || x.id === 'u4'), 'hélico et drone adverses hors jeu');
  assert.equal(u(apres, 'u1').iemJusquaJournee, apres.journee, 'mon hélico est arrêté, jamais abattu');
  assert.equal(u(apres, 'u5').iemJusquaJournee, apres.journee, 'la recon est arrêtée, pas abattue');
  assert.equal(u(apres, 'u6').pv, 100, "l'hélico à deux cases est intact");
  assert.deepEqual(evenements.filter((e) => e.type === 'hors_jeu'), [
    { type: 'hors_jeu', uniteId: 'u3', camp: 1, unite: 'helico' },
    { type: 'hors_jeu', uniteId: 'u4', camp: 1, unite: 'drone' },
  ]);
  assert.deepEqual(evenements.find((e) => e.type === 'iem_pouvoir'), {
    type: 'iem_pouvoir', camp: 0, centre: { x: 3, y: 2 }, rayon: 1, immobilisees: ['u1', 'u5'], abattues: ['u3', 'u4'],
  });
  assert.equal(apres.camps[1]!.jauge, jaugeAdverse + JAUGE_PAR_PV_SUBI * (6 + 10), 'le camp abattu touche la jauge du subi');
  assert.equal(apres.camps[0]!.jauge, 100, 'le déclencheur a payé ses huit barres, rien ne lui revient');
});

test('iem abattre : refusé au pouvoir normal et sous huit barres, au moteur comme au schéma', () => {
  const etat = partie([{ camp: 0, type: 'infanterie', x: 0, y: 1 }, { camp: 1, type: 'helico', x: 6, y: 4 }]);
  const normal = commandant([IEM(1, true)]);
  assert.equal(refus(etat, normal, 'normal', [{ x: 6, y: 4 }]), 'pouvoir_invalide');
  const sept = commandant([IEM(1, false)], [IEM(1, true)], 7);
  assert.equal(refus(etat, sept, 'super', [{ x: 6, y: 4 }]), 'pouvoir_invalide');
  const v = verifierPouvoir(etat, sept, 0, 'super');
  assert.equal(v.ok, false);
  assert.equal(BORNES_FACTION.iem.barresAbattre, 8);
});

// ---------------------------------------------------------------------------
// Réservées à la faction : schéma et moteur
// ---------------------------------------------------------------------------

test('hors faction : le moteur refuse pouvoir_invalide les trois familles à un camp qui n’est pas atl', () => {
  const etat = partie([{ camp: 0, type: 'infanterie', x: 0, y: 1 }, { camp: 1, type: 'helico', x: 6, y: 4 }], {}, false);
  assert.equal(etat.reglages.factionsParCamp, undefined);
  for (const [nom, effet, cases] of [
    ['frappe', FRAPPE(1, 0), [{ x: 6, y: 4 }]],
    ['laser', LASER(1, 1, 'plus_cheres'), undefined],
    ['iem', IEM(1, false), [{ x: 6, y: 4 }]],
  ] as const) {
    const c = commandant([effet]);
    assert.equal(refus(etat, c, 'normal', cases ? [...cases] : undefined), 'pouvoir_invalide', nom);
    assert.equal(refus(etat, c, 'super', cases ? [...cases] : undefined), 'pouvoir_invalide', `${nom} au super`);
  }
  assert.equal(etat.camps[0]!.jauge, 900);
});

test('le schéma refuse les trois familles à un commandant national, et les accepte à un commandant atl', () => {
  const avec = (paysCode: string, pouvoir: Record<string, unknown>, superPouvoir?: Record<string, unknown>): ReturnType<typeof validerCommander> => {
    const o = JSON.parse(JSON.stringify(commandantCamille)) as Record<string, unknown>;
    o['paysCode'] = paysCode;
    Object.assign(o['pouvoir'] as Record<string, unknown>, pouvoir);
    if (superPouvoir) Object.assign(o['superPouvoir'] as Record<string, unknown>, superPouvoir);
    return validerCommander(o);
  };
  const chemins = (r: ReturnType<typeof validerCommander>): string[] => (r.ok ? [] : r.erreurs.map((e) => e.chemin));

  for (const effet of [FRAPPE(1, 0), LASER(1, 1, 'plus_cheres'), IEM(1, false)]) {
    const national = avec('fr', { effets: [effet] });
    assert.equal(national.ok, false);
    assert.ok(chemins(national).includes('pouvoir.effets[0]'), chemins(national).join(', '));
    const faction = avec('atl', { effets: [effet] });
    assert.equal(faction.ok, true, JSON.stringify(faction));
  }
  // Les bornes du normal.
  assert.ok(chemins(avec('atl', { effets: [FRAPPE(3, 1)] })).includes('pouvoir.effets[0].frappe.pv'));
  assert.ok(chemins(avec('atl', { effets: [FRAPPE(2, 2)] })).includes('pouvoir.effets[0].frappe.rayon'));
  assert.ok(chemins(avec('atl', { effets: [IEM(1, true)] })).includes('pouvoir.effets[0].iem.abattre'));
  // Au super : une frappe pleine passe, abattre exige huit barres.
  assert.equal(avec('atl', {}, { effets: [FRAPPE(3, 2)] }).ok, true);
  assert.ok(chemins(avec('atl', {}, { barres: 7, effets: [IEM(3, true)] })).includes('superPouvoir.barres'));
  assert.equal(avec('atl', {}, { barres: 8, effets: [IEM(3, true)] }).ok, true);
  // Et les bornes de forme.
  assert.ok(chemins(avec('atl', { effets: [{ cible: 'terrain', frappe: { pv: 4, rayon: 0 } }] })).includes('pouvoir.effets[0].frappe.pv'));
  assert.ok(chemins(avec('atl', { effets: [{ cible: 'unites_adverses', laser: { pv: 6, nombre: 1, choix: 'plus_cheres' } }] })).includes('pouvoir.effets[0].laser.pv'));
  assert.ok(chemins(avec('atl', { effets: [{ cible: 'unites_adverses', laser: { pv: 1, nombre: 4, choix: 'plus_cheres' } }] })).includes('pouvoir.effets[0].laser.nombre'));
  assert.ok(chemins(avec('atl', { effets: [{ cible: 'terrain', iem: { rayon: 4, abattre: false } }] })).includes('pouvoir.effets[0].iem.rayon'));
  assert.ok(chemins(avec('atl', { effets: [{ cible: 'mes_unites', frappe: { pv: 1, rayon: 0 } }] })).includes('pouvoir.effets[0].cible'));
});

// ---------------------------------------------------------------------------
// Rejeu
// ---------------------------------------------------------------------------

test('le rejeu d’une partie où la faction frappe, lase et impulse est identique au bit près', () => {
  const unites: Unites = [
    { camp: 0, type: 'helico', x: 2, y: 2 },
    { camp: 0, type: 'infanterie', x: 0, y: 1 },
    { camp: 1, type: 'helico', x: 3, y: 2 },
    { camp: 1, type: 'char_lourd', x: 4, y: 2 },
    { camp: 1, type: 'infanterie', x: 6, y: 4, pv: 30 },
  ];
  const sc = scene(unites);
  const c = commandant([FRAPPE(2, 1), LASER(2, 1, 'plus_cheres')], [IEM(1, true)], 8);
  const actions: Action[] = [
    { type: 'pouvoir', niveau: 'normal', cases: [{ x: 4, y: 2 }] },
    { type: 'finTour' },
    { type: 'finTour' },
    { type: 'pouvoir', niveau: 'super', cases: [{ x: 3, y: 2 }] },
    { type: 'finTour' },
  ];
  const etat = creerPartie(sc, CAT, 'rejeu');
  etat.camps[0]!.jauge = 1000;
  etat.camps[0]!.jaugeMax = 1000;
  // La jauge est de l'état et le rejeu repart de la scène : on compare d'abord
  // deux passes du même chemin, jauge posée de la même main.
  const jouer = (depart: EtatPartie): EtatPartie => {
    let e = depart;
    for (const a of actions) {
      const r = appliquer(e, a, CAT, [c, null]);
      assert.ok(r.ok, `${a.type} : ${r.ok ? '' : `${r.motif} ${r.detail ?? ''}`}`);
      if (r.ok) e = r.etat;
    }
    return e;
  };
  const premiere = jouer(etat);
  let second = creerPartie(sc, CAT, 'rejeu');
  second.camps[0]!.jauge = 1000;
  second.camps[0]!.jaugeMax = 1000;
  second = jouer(second);
  assert.equal(empreinte(second), empreinte(premiere));
  assert.ok(!premiere.unites.some((x) => x.id === 'u3'), "l'hélico adverse a été abattu");
  assert.equal(u(premiere, 'u4').pv, 60, 'char lourd : frappe puis laser');
  // Et par `rejouer`, qui repart de la scène : même refus de jauge aux deux
  // passes, même empreinte — le déterminisme ne dépend pas de la jauge.
  const sauvegarde = enregistrerPartie(creerPartie(sc, CAT, 'rejeu'), actions);
  const a = rejouer(sc, CAT, sauvegarde, [c, null]);
  const b = rejouer(sc, CAT, sauvegarde, [c, null]);
  assert.deepEqual(a.refus, b.refus);
  assert.equal(empreinte(a.etat), empreinte(b.etat));
});
