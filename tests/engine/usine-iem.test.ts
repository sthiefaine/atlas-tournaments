/**
 * L'IEM retarde la production (10 septembre 2026, `doc/04-gameplay.md` §7.7) :
 * une impulsion — de station ou de pouvoir — touche les bâtiments producteurs
 * adverses de son rayon, qui refusent `usine_iem` pendant le tour de leur
 * propriétaire et produisent de nouveau au suivant.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appliquer, chargerCatalogue, creerPartie, evaluerEffets, verifierProduction,
  type Action, type CommandantMoteur, type EtatPartie,
} from '../../src/engine/index';
import { meilleureCase, valeurCase, valeurUsinePerdue } from '../../src/ai/index';
import type { EffetPouvoir } from '../../src/schemas/index';
import { scenePersonnalisee } from './aides';

const CAT = chargerCatalogue(8);

function fin(e: EtatPartie, commandants: (CommandantMoteur | null)[] = []): EtatPartie {
  const r = appliquer(e, { type: 'finTour' }, CAT, commandants);
  assert.ok(r.ok);
  return r.ok ? r.etat : e;
}

test('station : l’usine adverse du rayon refuse usine_iem ce tour, produit au suivant ; la mienne, jamais', () => {
  const s = scenePersonnalisee(['HUPPPPP', 'PPPTPPP', 'PPPPPUH'], { '0,0': 0, '1,0': 0, '3,1': 0, '5,2': 1, '6,2': 1 }, [
    { camp: 0, type: 'infanterie', x: 2, y: 1 }, { camp: 1, type: 'infanterie', x: 4, y: 1 },
  ], {
    installationsIem: [{ cle: 'poste', x: 3, y: 1, premiereJournee: 2, rayon: 3 }],
    victoire: [{ type: 'survivre', journees: 20 }], fondsDepart: 20000, cycleJourNuit: { jour: 1, nuit: 0 },
  });
  let e = creerPartie(s, CAT, 'usine-iem');
  e = fin(fin(e));
  assert.equal(e.journee, 2);
  assert.equal(e.campCourant, 0);
  assert.deepEqual(e.usinesIem, { '5,2': 2 }, 'l’usine adverse à trois pas, pas la mienne, pas le QG à quatre');
  assert.ok(e.journal.some((v) => v.type === 'usine_iem' && v.camp === 1 && v.case.x === 5 && v.case.y === 2));
  assert.ok(e.journal.some((v) => v.type === 'annonce' && v.texte.includes('1 usines')));
  assert.ok(verifierProduction(e, CAT, 0, { x: 1, y: 0 }, 'infanterie').ok, 'ma propre usine produit');

  e = fin(e);
  assert.equal(e.campCourant, 1);
  const refus = verifierProduction(e, CAT, 1, { x: 5, y: 2 }, 'infanterie');
  assert.equal(refus.ok ? '' : refus.motif, 'usine_iem');
  const r = appliquer(e, { type: 'produire', batiment: { x: 5, y: 2 }, unite: 'infanterie' }, CAT);
  assert.equal(r.ok ? '' : r.motif, 'usine_iem');
  assert.ok(verifierProduction(e, CAT, 1, { x: 6, y: 2 }, 'infanterie').ok, 'le QG, hors rayon, produit');

  e = fin(e);
  assert.equal(e.usinesIem, undefined, 'levée à la fermeture du tour du propriétaire');
  e = fin(e);
  assert.equal(e.journee, 3);
  assert.equal(e.campCourant, 1);
  assert.ok(verifierProduction(e, CAT, 1, { x: 5, y: 2 }, 'infanterie').ok, 'elle produit au tour suivant');
});

const IEM = (rayon: number): EffetPouvoir => ({ cible: 'terrain', iem: { rayon, abattre: false } });

function commandant(effets: EffetPouvoir[]): CommandantMoteur {
  return {
    cle: 'cmd_test', nom: 'Test', passif: null,
    pouvoir: { nom: 'Normal', barres: 2, duree: 'ce_tour', effets },
    superPouvoir: { nom: 'Super', barres: 8, duree: 'ce_tour', effets },
  };
}

test('pouvoir iem : les usines adverses du rayon sont arrêtées, comptées dans l’événement, prévues et valorisées par l’IA', () => {
  const s = scenePersonnalisee(['HPPPPPPP', 'PPPPPUPP', 'PPPPPPPH'], { '0,0': 0, '5,1': 1, '7,2': 1 }, [
    { camp: 0, type: 'infanterie', x: 1, y: 1 }, { camp: 1, type: 'infanterie', x: 7, y: 1 },
  ], { factionsParCamp: { 0: 'atl' }, fondsDepart: 20000, cycleJourNuit: { jour: 1, nuit: 0 } });
  const e = creerPartie(s, CAT, 'pouvoir-usine');
  e.camps[0]!.jauge = 900;
  e.camps[0]!.jaugeMax = 900;
  const c = commandant([IEM(1)]);
  const bilan = evaluerEffets(e, CAT, 0, c.pouvoir.effets, [{ x: 5, y: 1 }]);
  assert.deepEqual(bilan.usines, [{ x: 5, y: 1 }]);
  assert.deepEqual(bilan.immobilisees, []);

  // L'IA compte l'usine seule — aucune unité dans le rayon — comme un tour de revenu, borné.
  const attendu = valeurUsinePerdue(e, CAT, 1);
  assert.ok(attendu > 0);
  assert.equal(valeurCase(e, CAT, 0, c.pouvoir, { x: 5, y: 1 }), attendu);
  // À égalité — quatre voisines et la case même touchent l'usine —, la première dans l'ordre de lecture.
  const choix = meilleureCase(e, CAT, 0, c.pouvoir);
  assert.deepEqual(choix, { cases: [{ x: 5, y: 0 }], valeur: attendu });

  const action: Action = { type: 'pouvoir', niveau: 'normal', cases: [{ x: 5, y: 1 }] };
  const r = appliquer(e, action, CAT, [c, null]);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.etat.usinesIem, { '5,1': 1 });
  const evt = r.evenements.find((v) => v.type === 'iem_pouvoir');
  assert.equal(evt?.type === 'iem_pouvoir' ? evt.usines : -1, 1);
  assert.ok(r.evenements.some((v) => v.type === 'usine_iem' && v.camp === 1));
  const sonTour = fin(r.etat, [c, null]);
  assert.equal(sonTour.campCourant, 1);
  const refus = verifierProduction(sonTour, CAT, 1, { x: 5, y: 1 }, 'infanterie');
  assert.equal(refus.ok ? '' : refus.motif, 'usine_iem');
  assert.ok(verifierProduction(sonTour, CAT, 1, { x: 7, y: 2 }, 'infanterie').ok, 'le QG à deux pas du centre n’est pas touché');
  const monTour = fin(sonTour, [c, null]);
  assert.equal(monTour.usinesIem, undefined);
});

test('une usine alliée n’est jamais touchée par une impulsion de station', () => {
  const s = scenePersonnalisee(['HUPTPPP', 'PPPPPPP', 'PPPPPUH'], { '0,0': 0, '1,0': 0, '3,0': 1, '5,2': 1, '6,2': 1 }, [
    { camp: 0, type: 'infanterie', x: 2, y: 1 }, { camp: 1, type: 'infanterie', x: 4, y: 1 },
  ], {
    installationsIem: [{ cle: 'poste', x: 3, y: 0, premiereJournee: 2, rayon: 2 }], equipes: [[0, 1]],
    victoire: [{ type: 'survivre', journees: 20 }], cycleJourNuit: { jour: 1, nuit: 0 },
  });
  const e = fin(fin(creerPartie(s, CAT, 'allies')));
  assert.equal(e.journee, 2);
  assert.equal(e.usinesIem, undefined);
});
