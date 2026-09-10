/**
 * L'IA vise les familles de la faction (10 septembre 2026, `src/ai/pouvoirs.ts`,
 * `meilleureCase`) : pour une frappe de zone ou une impulsion, la case qui
 * maximise la valeur adverse touchée moins la valeur propre touchée, sur toute
 * la carte ; une frappe qui toucherait plus de sien que d'adverse vaut zéro et
 * ne part pas ; une impulsion qui abat part avec sa case, et le moteur abat
 * ce qu'elle a visé. Déterministe.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  actionPouvoir, decisionPouvoir, detailPouvoir, meilleureCase, SEUIL_PAR_BARRE, valeurCase, valeurPouvoir,
  valeurTourPerdu,
} from '../../src/ai/index';
import {
  appliquer, creerPartie, manhattan, type CommandantMoteur, type EtatPartie, type ReglagesPartie,
} from '../../src/engine/index';
import type { EffetPouvoir } from '../../src/schemas/index';
import { CAT, scenePersonnalisee, u } from '../engine/aides';

const GRILLE = [
  'HPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPH',
];
const QGS = { '0,0': 0 as const, '9,3': 1 as const };

type Pouvoir = CommandantMoteur['pouvoir'];
type Unites = Parameters<typeof scenePersonnalisee>[2];

function pouvoir(effets: EffetPouvoir[], barres = 2): Pouvoir {
  return { nom: 'Test', barres, duree: 'ce_tour', effets };
}

function commandant(normal: Pouvoir, superPouvoir: Pouvoir = { ...normal, barres: 8 }): CommandantMoteur {
  return { cle: 'cmd_test', nom: 'Test', passif: null, pouvoir: normal, superPouvoir };
}

/** Une partie où le camp 0 est la faction, avec la jauge qu'on lui donne. */
function partie(unites: Unites, jauge = 0, reglages: Partial<ReglagesPartie> = {}): EtatPartie {
  const etat = creerPartie(scenePersonnalisee(GRILLE, QGS, unites, { factionsParCamp: { 0: 'atl' }, ...reglages }), CAT, 'ia');
  etat.camps[0]!.jauge = jauge;
  etat.camps[0]!.jaugeMax = 800;
  return etat;
}

const FRAPPE = (pv: number, rayon: number): EffetPouvoir => ({ cible: 'terrain', frappe: { pv, rayon } });
const IEM = (rayon: number, abattre: boolean): EffetPouvoir => ({ cible: 'terrain', iem: { rayon, abattre } });
const NORMAL = { niveau: 'normal' as const };

test('frappe_zone : la case choisie touche le groupe adverse et évite mes unités', () => {
  const etat = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 1 },
    { camp: 0, type: 'char_leger', x: 1, y: 1 },
    { camp: 0, type: 'recon', x: 5, y: 1 },
    { camp: 1, type: 'char_lourd', x: 7, y: 1 },
    { camp: 1, type: 'char_leger', x: 8, y: 1 },
    { camp: 1, type: 'infanterie', x: 7, y: 2 },
    { camp: 1, type: 'infanterie', x: 5, y: 0 },
  ], 200);
  const p = pouvoir([FRAPPE(2, 1)]);
  const choix = meilleureCase(etat, CAT, 0, p);
  assert.ok(choix);
  const centre = choix.cases[0]!;
  // Le centre couvre le char lourd, le char léger et l'infanterie du groupe ; aucune des miennes.
  assert.ok(manhattan(centre, { x: 7, y: 1 }) <= 1 && manhattan(centre, { x: 8, y: 1 }) <= 1
    && manhattan(centre, { x: 7, y: 2 }) <= 1, `centre ${centre.x},${centre.y}`);
  for (const mienne of etat.unites.filter((x) => x.camp === 0)) {
    assert.ok(manhattan(centre, mienne) > 1, `${mienne.type} en ${mienne.x},${mienne.y} serait touchée`);
  }
  assert.equal(choix.valeur, 2 * (15000 + 6500 + 1000) / 10, 'deux PV affichés de chaque, en fonds');
  assert.equal(valeurCase(etat, CAT, 0, p, centre), choix.valeur);
  // La case sur mon groupe vaut moins que rien.
  assert.ok(valeurCase(etat, CAT, 0, p, { x: 1, y: 1 }) < 0);
  const d = detailPouvoir(etat, CAT, 0, p, NORMAL);
  assert.equal(d.degatsDirects, choix.valeur, "les PV retirés à l'adversaire, sans collatéral");
  assert.equal(d.faction, 0, 'aucune des miennes touchée');
  assert.ok(d.total >= SEUIL_PAR_BARRE * p.barres, `${d.total} : la frappe part`);
  const action = actionPouvoir(etat, CAT, 0, [commandant(p), null]);
  assert.deepEqual(action, { type: 'pouvoir', niveau: 'normal', cases: [centre] });
  assert.equal(decisionPouvoir(etat, CAT, 0, [commandant(p), null]), 'normal');
  // Et le moteur accepte exactement cette action.
  const r = appliquer(etat, action!, CAT, [commandant(p), null]);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(u(r.etat, 'u4').pv, 80);
    assert.equal(u(r.etat, 'u2').pv, 100);
  }
});

test('frappe_zone : une frappe qui toucherait plus de sien que d’adverse vaut zéro et ne part pas', () => {
  // Le seul adversaire est encerclé par quatre de mes chars : toute case qui le touche en touche un au moins, et un char vaut plus qu'une infanterie.
  const etat = partie([
    { camp: 0, type: 'char_leger', x: 3, y: 1 },
    { camp: 0, type: 'char_leger', x: 5, y: 1 },
    { camp: 0, type: 'char_leger', x: 4, y: 0 },
    { camp: 0, type: 'char_leger', x: 4, y: 2 },
    { camp: 1, type: 'infanterie', x: 4, y: 1 },
  ], 200);
  const p = pouvoir([FRAPPE(2, 1)]);
  assert.equal(meilleureCase(etat, CAT, 0, p), null);
  assert.equal(valeurPouvoir(etat, CAT, 0, p, NORMAL), 0);
  assert.equal(actionPouvoir(etat, CAT, 0, [commandant(p), null]), null);
  assert.equal(decisionPouvoir(etat, CAT, 0, [commandant(p), null]), null);
});

test('iem : l’impulsion compte les tours perdus, mes unités déjà jouées ne coûtent rien', () => {
  const etat = partie([
    { camp: 0, type: 'char_leger', x: 4, y: 1 },
    { camp: 0, type: 'infanterie', x: 0, y: 1 },
    { camp: 1, type: 'char_lourd', x: 5, y: 1 },
    { camp: 1, type: 'infanterie', x: 5, y: 2 },
  ], 200);
  const p = pouvoir([IEM(1, false)]);
  const sur = { x: 5, y: 1 };
  // Mon char léger prêt à côté : il compte contre.
  const avecLeMien = valeurCase(etat, CAT, 0, p, sur);
  const lourd = u(etat, 'u3');
  const leger = u(etat, 'u1');
  assert.equal(avecLeMien, valeurTourPerdu(CAT, lourd) - valeurTourPerdu(CAT, leger));
  // Le même char léger qui a déjà joué ne perd rien.
  leger.etat = 'agi';
  assert.equal(valeurCase(etat, CAT, 0, p, sur), valeurTourPerdu(CAT, lourd));
  assert.equal(valeurTourPerdu(CAT, lourd), 1500, 'plafonné');
  const d = detailPouvoir(etat, CAT, 0, p, { ...NORMAL, cases: [sur] });
  assert.equal(d.faction, valeurTourPerdu(CAT, lourd));
  assert.equal(d.degatsDirects, 0, 'une impulsion ne fait aucun dégât');
});

test('iem abattre : le super vise les aériens adverses, et le moteur abat ce que l’IA a visé', () => {
  const etat = partie([
    { camp: 0, type: 'helico', x: 2, y: 1 },
    { camp: 0, type: 'infanterie', x: 0, y: 1 },
    { camp: 1, type: 'helico', x: 7, y: 1 },
    { camp: 1, type: 'helico', x: 8, y: 2 },
    { camp: 1, type: 'infanterie', x: 7, y: 2 },
  ], 800);
  const c = commandant(pouvoir([IEM(1, false)]), pouvoir([IEM(1, true)], 8));
  const choix = meilleureCase(etat, CAT, 0, c.superPouvoir);
  assert.ok(choix);
  const centre = choix.cases[0]!;
  assert.ok(manhattan(centre, { x: 7, y: 1 }) <= 1 && manhattan(centre, { x: 8, y: 2 }) <= 1, `centre ${centre.x},${centre.y}`);
  assert.equal(choix.valeur, 9000 + 9000, 'deux hélicoptères à leur coût entier');
  const d = detailPouvoir(etat, CAT, 0, c.superPouvoir, { niveau: 'super', cases: choix.cases });
  assert.equal(d.faction, 18000);
  const action = actionPouvoir(etat, CAT, 0, [c, null]);
  assert.deepEqual(action, { type: 'pouvoir', niveau: 'super', cases: [centre] });
  const r = appliquer(etat, action!, CAT, [c, null]);
  assert.ok(r.ok);
  if (r.ok) {
    assert.ok(!r.etat.unites.some((x) => x.id === 'u3' || x.id === 'u4'), 'les deux hélicos adverses sont abattus');
    assert.ok(r.etat.unites.some((x) => x.id === 'u1'), 'le mien vole encore');
    assert.ok(r.evenements.some((e) => e.type === 'iem_pouvoir' && e.abattues.length === 2));
  }
});

test('hors faction : l’IA ne propose jamais une famille que le moteur refuserait', () => {
  const etat = creerPartie(scenePersonnalisee(GRILLE, QGS, [
    { camp: 0, type: 'infanterie', x: 0, y: 1 },
    { camp: 1, type: 'helico', x: 7, y: 1 },
  ]), CAT, 'ia');
  etat.camps[0]!.jauge = 800;
  etat.camps[0]!.jaugeMax = 800;
  const c = commandant(pouvoir([FRAPPE(2, 1)]), pouvoir([IEM(1, true)], 8));
  assert.equal(actionPouvoir(etat, CAT, 0, [c, null]), null);
});
