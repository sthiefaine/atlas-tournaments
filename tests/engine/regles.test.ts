/**
 * Capture, revenus, production, réparation, transport, fusion, pouvoirs et
 * conditions de victoire (`doc/04-gameplay.md` §2, §6, §7, §9).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appliquer, batimentsDe, cleCase, creerPartie, peutCapturerIci, POINTS_PAR_BARRE, PRIME_REMISE_EN_SERVICE, score, SEUIL_CAPTURE,
  valeurArmee, type Action, type CommandantMoteur, type EtatPartie,
} from '../../src/engine/index';
import { CAT, partiePersonnalisee, scenePersonnalisee, u } from './aides';

//         0123456789
const GRILLE = [
  'HCUAPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPH',
];

/** Enchaîne des actions et rend le dernier état, en échouant au premier refus. */
function suite(
  etat: EtatPartie, actions: Action[], commandants: (CommandantMoteur | null)[] = [],
): EtatPartie {
  let courant = etat;
  for (const a of actions) {
    const r = appliquer(courant, a, CAT, commandants);
    assert.ok(r.ok, `action refusée : ${JSON.stringify(a)} → ${r.ok ? '' : r.motif}`);
    if (!r.ok) return courant;
    courant = r.etat;
  }
  return courant;
}

test('une capture demande 20 points, soit deux tours à 10 PV affichés', () => {
  const etat = partiePersonnalisee(GRILLE, { '9,9': 1 }, [
    { camp: 0, type: 'infanterie', x: 1, y: 1 },
    { camp: 1, type: 'infanterie', x: 9, y: 8 },
  ]);
  const premier = suite(etat, [
    { type: 'ordre', uniteId: 'u1', chemin: [{ x: 1, y: 1 }, { x: 1, y: 0 }], suite: { type: 'capturer' } },
  ]);
  assert.equal(u(premier, 'u1').pointsCapture, 10);
  assert.equal(premier.proprietaires[cleCase({ x: 1, y: 0 })], undefined);
  const second = suite(premier, [
    { type: 'finTour' }, { type: 'finTour' },
    { type: 'ordre', uniteId: 'u1', chemin: [{ x: 1, y: 0 }], suite: { type: 'capturer' } },
  ]);
  assert.equal(second.proprietaires[cleCase({ x: 1, y: 0 })], 0);
  assert.equal(u(second, 'u1').pointsCapture, 0);
});

test('une unité entamée capture plus lentement, et bouger remet le compteur à zéro', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'infanterie', x: 1, y: 1, pv: 50 },
    { camp: 1, type: 'infanterie', x: 9, y: 8 },
  ]);
  const apres = suite(etat, [
    { type: 'ordre', uniteId: 'u1', chemin: [{ x: 1, y: 1 }, { x: 1, y: 0 }], suite: { type: 'capturer' } },
  ]);
  assert.equal(u(apres, 'u1').pointsCapture, 5);
  const partie = suite(apres, [
    { type: 'finTour' }, { type: 'finTour' },
    { type: 'ordre', uniteId: 'u1', chemin: [{ x: 1, y: 0 }, { x: 2, y: 0 }], suite: { type: 'capturer' } },
  ]);
  assert.equal(u(partie, 'u1').pointsCapture, 5); // recommencé sur l'usine
});

test('un char ne capture pas', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 1, y: 1 },
    { camp: 1, type: 'infanterie', x: 9, y: 8 },
  ]);
  const r = appliquer(etat, {
    type: 'ordre', uniteId: 'u1', chemin: [{ x: 1, y: 1 }, { x: 1, y: 0 }], suite: { type: 'capturer' },
  }, CAT);
  assert.equal(r.ok === false && r.motif, 'capture_impossible');
});

test('les revenus valent 1 000 par bâtiment possédé et par tour', () => {
  const etat = partiePersonnalisee(GRILLE, { '0,0': 0, '1,0': 0, '9,9': 1 }, [
    { camp: 0, type: 'infanterie', x: 1, y: 1 },
    { camp: 1, type: 'infanterie', x: 9, y: 8 },
  ], { fondsDepart: 0 });
  assert.equal(batimentsDe(etat, 0).length, 2);
  assert.equal(etat.camps[0]?.fonds, 2000);
  const apres = suite(etat, [{ type: 'finTour' }, { type: 'finTour' }]);
  assert.equal(apres.camps[0]?.fonds, 4000);
});

test("la production débite les fonds et l'unité ne joue pas le tour de sa sortie", () => {
  const etat = partiePersonnalisee(GRILLE, { '2,0': 0, '9,9': 1 }, [
    { camp: 0, type: 'infanterie', x: 1, y: 1 },
    { camp: 1, type: 'infanterie', x: 9, y: 8 },
  ], { fondsDepart: 7000 });
  const fondsDebut = etat.camps[0]?.fonds ?? 0;
  const apres = suite(etat, [{ type: 'produire', batiment: { x: 2, y: 0 }, unite: 'char_leger' }]);
  assert.equal(apres.camps[0]?.fonds, fondsDebut - 6500);
  const neuve = apres.unites.find((x) => x.x === 2 && x.y === 0);
  assert.equal(neuve?.etat, 'produite');
  const refus = appliquer(apres, {
    type: 'ordre', uniteId: neuve?.id ?? '', chemin: [{ x: 2, y: 0 }, { x: 2, y: 1 }], suite: { type: 'rien' },
  }, CAT);
  assert.equal(refus.ok === false && refus.motif, 'unite_deja_agi');
});

test('une production hors liste, sans fonds ou sur un bâtiment occupé est refusée', () => {
  const etat = partiePersonnalisee(GRILLE, { '0,0': 0, '2,0': 0, '3,0': 0, '9,9': 1 }, [
    { camp: 0, type: 'infanterie', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 9, y: 8 },
  ], { fondsDepart: 2000 });
  const horsListe = appliquer(etat, { type: 'produire', batiment: { x: 0, y: 0 }, unite: 'char_leger' }, CAT);
  assert.equal(horsListe.ok === false && horsListe.motif, 'unite_non_produite_ici');
  const surUneUnite = partiePersonnalisee(GRILLE, { '0,0': 0, '9,9': 1 }, [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 9, y: 8 },
  ], { fondsDepart: 2000 });
  const occupe = appliquer(surUneUnite, { type: 'produire', batiment: { x: 0, y: 0 }, unite: 'infanterie' }, CAT);
  assert.equal(occupe.ok === false && occupe.motif, 'batiment_occupe');
  const cher = appliquer(etat, { type: 'produire', batiment: { x: 2, y: 0 }, unite: 'char_lourd' }, CAT);
  assert.equal(cher.ok === false && cher.motif, 'fonds_insuffisants');
  const aerien = appliquer(etat, { type: 'produire', batiment: { x: 3, y: 0 }, unite: 'helico' }, CAT);
  assert.equal(aerien.ok === false && aerien.motif, 'fonds_insuffisants');
});

test('la réparation rend 2 PV affichés et coûte au prorata du coût', () => {
  const etat = partiePersonnalisee(GRILLE, { '1,0': 0, '9,9': 1 }, [
    { camp: 0, type: 'char_leger', x: 1, y: 0, pv: 50 },
    { camp: 1, type: 'infanterie', x: 9, y: 8 },
  ], { fondsDepart: 5000 });
  // La journée 1 est déjà ouverte à la création : la première réparation a eu lieu.
  assert.equal(u(etat, 'u1').pv, 70);
  // 5 000 de départ + 1 000 de revenus − 1 300 de réparation (2 PV × 650).
  assert.equal(etat.camps[0]?.fonds, 5000 + 1000 - 1300);
  const apres = suite(etat, [{ type: 'finTour' }, { type: 'finTour' }]);
  assert.equal(u(apres, 'u1').pv, 90);
  assert.equal(apres.camps[0]?.fonds, 5000 + 2000 - 2600);
});

test('un transport charge une infanterie puis la débarque', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'transport', x: 4, y: 4 },
    { camp: 0, type: 'infanterie', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 9, y: 8 },
  ]);
  const charge = suite(etat, [
    { type: 'ordre', uniteId: 'u2', chemin: [{ x: 5, y: 5 }, { x: 5, y: 4 }], suite: { type: 'embarquer', transport: 'u1' } },
  ]);
  assert.equal(u(charge, 'u2').dansTransport, 'u1');
  assert.deepEqual(u(charge, 'u1').cargo, ['u2']);
  const debarque = suite(charge, [
    { type: 'ordre', uniteId: 'u1', chemin: [{ x: 4, y: 4 }, { x: 4, y: 5 }], suite: { type: 'debarquer', vers: { x: 4, y: 6 } } },
  ]);
  assert.equal(u(debarque, 'u2').dansTransport, null);
  assert.equal(u(debarque, 'u2').x, 4);
  assert.equal(u(debarque, 'u2').y, 6);
  assert.deepEqual(u(debarque, 'u1').cargo, []);
});

test('deux unités identiques fusionnent et le surplus est remboursé', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'infanterie', x: 4, y: 4, pv: 60 },
    { camp: 0, type: 'infanterie', x: 4, y: 6, pv: 70 },
    { camp: 1, type: 'infanterie', x: 9, y: 8 },
  ], { fondsDepart: 0 });
  const avant = etat.camps[0]?.fonds ?? 0;
  const apres = suite(etat, [
    { type: 'ordre', uniteId: 'u1', chemin: [{ x: 4, y: 4 }, { x: 4, y: 5 }], suite: { type: 'fusionner', avec: 'u2' } },
  ]);
  assert.equal(apres.unites.filter((x) => x.camp === 0).length, 1);
  assert.equal(u(apres, 'u2').pv, 100);
  assert.equal(apres.camps[0]?.fonds, avant + 300); // 30 PV de surplus × 1 000 / 100
});

/** Un commandant de test : passif faible, pouvoir d'attaque, super pouvoir de capture. */
const COMMANDANT: CommandantMoteur = {
  cle: 'cmd_test',
  nom: 'Commandante de test',
  passif: { cible: 'mes_unites', modificateur: { quoi: 'attaque', valeur: 1.1 } },
  pouvoir: {
    nom: 'Coup de sifflet', barres: 2, duree: 'ce_tour',
    effets: [{ cible: 'mes_unites', modificateur: { quoi: 'attaque', valeur: 1.5 } }],
  },
  superPouvoir: {
    nom: 'Grand chelem', barres: 5, duree: { type: 'journees', n: 2 },
    effets: [{ cible: 'mes_unites', modificateur: { quoi: 'capture', valeur: 2 } }],
  },
};

test("un pouvoir coûte sa jauge, ne part qu'une fois par tour et expire", () => {
  const etat = partiePersonnalisee(GRILLE, { '9,9': 1 }, [
    { camp: 0, type: 'infanterie', x: 1, y: 1 },
    { camp: 1, type: 'infanterie', x: 9, y: 8 },
  ]);
  // Sans jauge, rien ne part.
  const sansJauge = appliquer(etat, { type: 'pouvoir', niveau: 'normal' }, CAT, [COMMANDANT, null]);
  assert.equal(sansJauge.ok === false && sansJauge.motif, 'jauge_insuffisante');

  const charge = { ...etat, camps: etat.camps.map((c) => (c.id === 0 ? { ...c, jauge: 900, jaugeMax: 900 } : c)) };
  const r = appliquer(charge, { type: 'pouvoir', niveau: 'normal' }, CAT, [COMMANDANT, null]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.etat.camps[0]?.jauge, 900 - 2 * POINTS_PAR_BARRE);
  assert.equal(r.etat.modificateurs.some((m) => m.source === 'pouvoir'), true);
  const encore = appliquer(r.etat, { type: 'pouvoir', niveau: 'super' }, CAT, [COMMANDANT, null]);
  assert.equal(encore.ok === false && encore.motif, 'pouvoir_deja_utilise');
  // `ce_tour` : le modificateur tombe à la fermeture du tour.
  const apres = suite(r.etat, [{ type: 'finTour' }], [COMMANDANT, null]);
  assert.equal(apres.modificateurs.some((m) => m.source === 'pouvoir'), false);
});

test('le super pouvoir de capture double les points gagnés', () => {
  const etat = partiePersonnalisee(GRILLE, { '9,9': 1 }, [
    { camp: 0, type: 'infanterie', x: 1, y: 1 },
    { camp: 1, type: 'infanterie', x: 9, y: 8 },
  ]);
  const charge = { ...etat, camps: etat.camps.map((c) => (c.id === 0 ? { ...c, jauge: 900, jaugeMax: 900 } : c)) };
  const avecPouvoir = suite(charge, [
    { type: 'pouvoir', niveau: 'super' },
    { type: 'ordre', uniteId: 'u1', chemin: [{ x: 1, y: 1 }, { x: 1, y: 0 }], suite: { type: 'capturer' } },
  ], [COMMANDANT, null]);
  assert.equal(avecPouvoir.proprietaires[cleCase({ x: 1, y: 0 })], 0);
  assert.equal(SEUIL_CAPTURE, 20);
});

test('capturer le QG adverse demande quatre tours et termine la partie', () => {
  // Le QG vaut le double d'une ville (`04-gameplay.md` §6) : une infanterie
  // intacte y passe quatre tours, pas deux.
  const etat = partiePersonnalisee(GRILLE, { '0,0': 1, '9,9': 0 }, [
    { camp: 0, type: 'infanterie', x: 0, y: 1, pv: 100 },
    { camp: 1, type: 'infanterie', x: 5, y: 5 },
  ]);
  const reprise: Action = { type: 'ordre', uniteId: 'u1', chemin: [{ x: 0, y: 0 }], suite: { type: 'capturer' } };
  const troisTours = suite(etat, [
    { type: 'ordre', uniteId: 'u1', chemin: [{ x: 0, y: 1 }, { x: 0, y: 0 }], suite: { type: 'capturer' } },
    { type: 'finTour' }, { type: 'finTour' }, reprise,
    { type: 'finTour' }, { type: 'finTour' }, reprise,
  ]);
  assert.equal(troisTours.partie.terminee, false);
  assert.equal(troisTours.unites.find((u) => u.id === 'u1')?.pointsCapture, 30);
  const apres = suite(troisTours, [{ type: 'finTour' }, { type: 'finTour' }, reprise]);
  assert.equal(apres.partie.terminee, true);
  assert.equal(apres.partie.vainqueur, 0);
});

test('un bâtiment désaffecté se remet en service : génie en deux tours, infanterie en quatre', () => {
  const scene = scenePersonnalisee(['HPCPH', 'PPCPP'], { '0,0': 0, '4,0': 1 }, [
    { camp: 0, type: 'genie', x: 2, y: 0 },
    { camp: 0, type: 'infanterie', x: 2, y: 1 },
    { camp: 1, type: 'infanterie', x: 4, y: 1 },
  ]);
  scene.desaffectes = ['2,0', '2,1'];
  const etat = creerPartie(scene, CAT, 'test');
  assert.deepEqual(etat.desaffectes, ['2,0', '2,1']);
  // Le génie ne capture jamais une ville en service : il n'est pas un capteur.
  const intacte = { ...etat, desaffectes: [] };
  assert.equal(peutCapturerIci(intacte, CAT, etat.unites[0]!), false);
  assert.equal(peutCapturerIci(etat, CAT, etat.unites[0]!), true);

  const chantier = (id: string, x: number, y: number): Action =>
    ({ type: 'ordre', uniteId: id, chemin: [{ x, y }], suite: { type: 'capturer' } });
  const unTour = suite(etat, [chantier('u1', 2, 0), chantier('u2', 2, 1)]);
  assert.equal(unTour.unites[0]!.pointsCapture, 20, 'un génie intact gagne vingt points par tour');
  assert.equal(unTour.unites[1]!.pointsCapture, 10);
  const deuxTours = suite(unTour, [{ type: 'finTour' }, { type: 'finTour' }, chantier('u1', 2, 0), chantier('u2', 2, 1)]);
  assert.equal(deuxTours.proprietaires['2,0'], 0, 'le génie a remis la ville en service');
  // La prime est doublée pour le génie ; le reste de l'écart, ce sont les revenus des journées.
  const primeVersee = deuxTours.journal.find((ev) => ev.type === 'remise_en_service');
  assert.ok(primeVersee && primeVersee.type === 'remise_en_service');
  assert.equal(primeVersee.prime, 2 * PRIME_REMISE_EN_SERVICE);
  assert.ok(deuxTours.camps[0]!.fonds >= etat.camps[0]!.fonds + 2 * PRIME_REMISE_EN_SERVICE, 'la prime est dans la caisse');
  assert.deepEqual(deuxTours.desaffectes, ['2,1'], 'la case quitte la liste des désaffectés');
  assert.ok(deuxTours.journal.some((e) => e.type === 'remise_en_service' && e.camp === 0));
  assert.equal(deuxTours.proprietaires['2,1'], undefined, 'l’infanterie n’en est qu’à vingt points sur quarante');
  const quatreTours = suite(deuxTours, [
    { type: 'finTour' }, { type: 'finTour' }, chantier('u2', 2, 1),
    { type: 'finTour' }, { type: 'finTour' }, chantier('u2', 2, 1),
  ]);
  assert.equal(quatreTours.proprietaires['2,1'], 0);
  assert.deepEqual(quatreTours.desaffectes, []);
});

test('un camp sans unité ni producteur est mis hors jeu', () => {
  const etat = partiePersonnalisee(GRILLE, { '9,9': 0 }, [
    { camp: 0, type: 'char_leger', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 5, y: 6, pv: 10 },
  ]);
  let courant = etat;
  for (let i = 0; i < 3 && !courant.partie.terminee; i += 1) {
    const r = appliquer(courant, {
      type: 'ordre', uniteId: 'u1', chemin: [{ x: 5, y: 5 }], suite: { type: 'attaquer', cible: { x: 5, y: 6 } },
    }, CAT);
    if (!r.ok) break;
    courant = r.etat;
  }
  assert.equal(courant.partie.terminee, true);
  assert.equal(courant.partie.vainqueur, 0);
});

test('la décision aux points suit la formule du §9.1', () => {
  const etat = partiePersonnalisee(GRILLE, { '0,0': 0, '1,0': 0, '9,9': 1 }, [
    { camp: 0, type: 'infanterie', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 6, y: 6 },
  ], { fondsDepart: 0 });
  const fonds = etat.camps[0]?.fonds ?? 0;
  const attendu = 5 * 2 + 10 * 1 + valeurArmee(etat, CAT, 0) / 1000 + fonds / 2000;
  assert.equal(score(etat, CAT, 0), attendu);
});
