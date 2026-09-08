/**
 * L'échelle des dégâts et le poids du terrain (`doc/04-gameplay.md` §5.1,
 * révision du 8 septembre 2026).
 *
 * Ce fichier fige ce que le propriétaire a demandé de voir à l'écran — un
 * échange d'infanterie qui coûte deux à trois PV, et une forêt qui se lit d'un
 * PV affiché contre une route — plutôt que la mécanique intérieure, qui est
 * dans `combat.test.ts`. Si une valeur change ici, c'est une décision de
 * conception, pas un détail d'implémentation.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculerDegats, copierEtat, prevoirDuel, pvAffiches, resoudreAttaque } from '../../src/engine/index';
import { ECHELLE_DEGATS, facteurTerrain, REDUCTION_PAR_ETOILE } from '../../src/engine/regles/combat';
import { CAT, partiePersonnalisee, rngFixe, u } from './aides';

/** Une bande d'un terrain par colonne, doublée pour poser deux unités au contact. */
const BANDE = ['RPFMC', 'RPFMC'];

/** Colonne de chaque terrain de la bande, avec ses étoiles de défense. */
const TERRAINS: { nom: string; x: number; etoiles: number }[] = [
  { nom: 'route', x: 0, etoiles: 0 },
  { nom: 'plaine', x: 1, etoiles: 1 },
  { nom: 'foret', x: 2, etoiles: 2 },
  { nom: 'montagne', x: 3, etoiles: 4 },
  { nom: 'ville', x: 4, etoiles: 3 },
];

/** Dégâts d'une infanterie pleine sur une infanterie posée en `x`, à `pv` internes. */
function frappe(x: number, pv = 100): number {
  const etat = partiePersonnalisee(BANDE, {}, [
    { camp: 0, type: 'infanterie', x, y: 1 },
    { camp: 1, type: 'infanterie', x, y: 0, pv },
  ]);
  return calculerDegats(copierEtat(etat), CAT, u(etat, 'u1'), u(etat, 'u2'), rngFixe(0.5));
}

test('les deux constantes de l’échelle sont celles du §5.1', () => {
  assert.equal(ECHELLE_DEGATS, 0.65);
  assert.equal(REDUCTION_PAR_ETOILE, 0.1);
  assert.equal(facteurTerrain(0), 1);
  assert.equal(Math.round(facteurTerrain(2) * 100), 80, 'la forêt enlève 20 %');
  assert.equal(Math.round(facteurTerrain(4) * 100), 60, 'la montagne enlève 40 %');
});

test('une infanterie pleine laisse 7 PV sur route et 8 en forêt', () => {
  // La demande du propriétaire, mot pour mot. Avant le 8 septembre 2026, les deux
  // valaient 5 PV : le terrain ne se lisait pas.
  assert.equal(pvAffiches(100 - frappe(0)), 7, 'route');
  assert.equal(pvAffiches(100 - frappe(2)), 8, 'forêt');
});

test('le classement des terrains suit les étoiles, sans exception', () => {
  const parEtoiles = [...TERRAINS].sort((a, b) => a.etoiles - b.etoiles);
  const degats = parEtoiles.map((t) => frappe(t.x));
  for (let i = 1; i < degats.length; i += 1) {
    assert.ok(
      degats[i]! < degats[i - 1]!,
      `${parEtoiles[i]!.nom} (${parEtoiles[i]!.etoiles}★) doit protéger plus que ${parEtoiles[i - 1]!.nom}`,
    );
  }
  // Et l'écart bout à bout se lit : la montagne coupe 40 % des dégâts de la route.
  assert.equal(degats[0], 36);
  assert.equal(degats.at(-1), 21);
});

test('un abri protège autant une unité entamée qu’une unité intacte', () => {
  // Le reproche du propriétaire : à 3 PV en forêt, l'ancienne formule ne rendait
  // plus que 3 % de protection. Le rapport route/forêt ne bouge plus avec les PV.
  for (const pv of [100, 50]) {
    assert.equal(frappe(0, pv), 36, `route, cible à ${pv}`);
    assert.equal(frappe(2, pv), 29, `forêt, cible à ${pv}`);
  }
});

test('l’aléa ne déplace l’échange que d’un PV affiché au plus', () => {
  // La fourchette ±5 % reste un bruit, pas un revirement : entre le pire et le
  // meilleur tirage il y a au plus un PV affiché d'écart, quel que soit le
  // terrain. Un cas comme la plaine (30 PV internes nominaux) tombe pile sur la
  // frontière d'affichage et bascule entre 7 et 8 : c'est la limite d'un
  // affichage à dix crans, pas un défaut de la formule — d'où « au plus un ».
  for (const { nom, x } of TERRAINS) {
    const etat = partiePersonnalisee(BANDE, {}, [
      { camp: 0, type: 'infanterie', x, y: 1 },
      { camp: 1, type: 'infanterie', x, y: 0 },
    ]);
    const bas = calculerDegats(copierEtat(etat), CAT, u(etat, 'u1'), u(etat, 'u2'), rngFixe(0));
    const haut = calculerDegats(copierEtat(etat), CAT, u(etat, 'u1'), u(etat, 'u2'), rngFixe(0.999999));
    const ecart = Math.abs(pvAffiches(100 - bas) - pvAffiches(100 - haut));
    assert.ok(ecart <= 1, `${nom} : ${ecart} PV d'écart entre les deux bouts de la fourchette`);
  }
});

test('la scène du propriétaire : route contre forêt, et l’inverse', () => {
  const scene = (attaquantEnForet: boolean) => partiePersonnalisee(['RF'], {}, [
    { camp: 0, type: 'infanterie', x: attaquantEnForet ? 1 : 0, y: 0 },
    { camp: 1, type: 'infanterie', x: attaquantEnForet ? 0 : 1, y: 0 },
  ]);
  // Celle de la route frappe : elle en retire deux à la forêt, et en reprend deux.
  // Avant, la forêt tombait à 5 PV et la route restait à 8 : « pas logique ».
  const t1 = copierEtat(scene(false));
  resoudreAttaque(t1, CAT, u(t1, 'u1'), u(t1, 'u2'), rngFixe(0.5), []);
  assert.equal(pvAffiches(u(t1, 'u2').pv), 8, 'la forêt encaisse la frappe');
  assert.equal(pvAffiches(u(t1, 'u1').pv), 8, 'la route encaisse la riposte');

  // Celle de la forêt frappe : elle ressort devant, et c'est le terrain qui le
  // dit. Elle en garde neuf depuis que la riposte est atténuée (FACTEUR_RIPOSTE,
  // 8 septembre 2026) : frapper depuis un abri est le meilleur échange du jeu,
  // et c'est voulu — c'est ce qui donne une raison de tenir un terrain.
  const t2 = copierEtat(scene(true));
  resoudreAttaque(t2, CAT, u(t2, 'u1'), u(t2, 'u2'), rngFixe(0.5), []);
  assert.equal(pvAffiches(u(t2, 'u2').pv), 7, 'la route encaisse la frappe');
  assert.equal(pvAffiches(u(t2, 'u1').pv), 9, 'la forêt encaisse la riposte');
});

test('la prévision dit exactement ce que l’échange fera', () => {
  // La promesse du §5.2 bis, revérifiée sur les cinq terrains après le changement
  // d'échelle : une seule formule, pas une seconde table.
  for (const { nom, x } of TERRAINS) {
    const etat = partiePersonnalisee(BANDE, {}, [
      { camp: 0, type: 'infanterie', x, y: 1 },
      { camp: 1, type: 'infanterie', x, y: 0 },
    ]);
    const prevu = prevoirDuel(etat, CAT, u(etat, 'u1'), u(etat, 'u2'), { x, y: 1 });
    const joue = copierEtat(etat);
    const issue = resoudreAttaque(joue, CAT, u(joue, 'u1'), u(joue, 'u2'), rngFixe(0.5), []);
    assert.equal(prevu.degats, issue.degats, `${nom} : la frappe annoncée`);
    assert.equal(prevu.riposte, issue.riposte, `${nom} : la riposte annoncée`);
    assert.equal(prevu.pvCible, pvAffiches(u(joue, 'u2').pv), `${nom} : les PV de la cible`);
    assert.equal(prevu.pvAttaquant, pvAffiches(u(joue, 'u1').pv), `${nom} : les PV de l'attaquant`);
  }
});

test('le plancher d’un PV interne tient malgré l’échelle', () => {
  // 0,60 × 5 (infanterie → char lourd) × 0,60 (montagne) = 1,8 → 2 ; et à 1 PV
  // affiché l'attaquant descend à 0,18, que le plancher relève à 1. Une attaque
  // légitime fait toujours quelque chose, sinon l'ordre accepté est incompréhensible.
  const etat = partiePersonnalisee(BANDE, {}, [
    { camp: 0, type: 'infanterie', x: 3, y: 1, pv: 10 },
    { camp: 1, type: 'char_lourd', x: 3, y: 0 },
  ]);
  assert.equal(calculerDegats(copierEtat(etat), CAT, u(etat, 'u1'), u(etat, 'u2'), rngFixe(0)), 1);
});

test('deux tirages du même flux donnent les mêmes dégâts', () => {
  const etat = partiePersonnalisee(BANDE, {}, [
    { camp: 0, type: 'infanterie', x: 2, y: 1 },
    { camp: 1, type: 'infanterie', x: 2, y: 0 },
  ]);
  const a = copierEtat(etat);
  const b = copierEtat(etat);
  assert.equal(
    resoudreAttaque(a, CAT, u(a, 'u1'), u(a, 'u2'), rngFixe(0.31), []).degats,
    resoudreAttaque(b, CAT, u(b, 'u1'), u(b, 'u2'), rngFixe(0.31), []).degats,
  );
});

test('la seconde scène du propriétaire : route contre ville, frapper en premier paie', () => {
  // Rapportée le 8 septembre 2026 : deux infanteries à 8 PV, la sienne sur
  // route, l'autre en ville. Son coup retirait 20 points internes et la riposte
  // lui en rendait 21 — les deux camps affichaient « 8 → 6 », et il perdait
  // l'échange sans que rien ne le dise. Avec FACTEUR_RIPOSTE, l'initiative
  // repasse devant l'abri : 7 pour lui, 6 pour la ville.
  const etat = partiePersonnalisee(['RC'], {}, [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 1, y: 0 },
  ]);
  const t = copierEtat(etat);
  const att = u(t, 'u1');
  const def = u(t, 'u2');
  att.pv = 80;
  def.pv = 80;
  const p = prevoirDuel(t, CAT, att, def, { x: 0, y: 0 });
  assert.equal(p.pvCible, 6, 'la ville encaisse le coup');
  assert.equal(p.pvAttaquant, 7, 'la route encaisse la riposte, atténuée');
  // Et la prévision ne ment pas sur ce que le tour jouera.
  resoudreAttaque(t, CAT, att, def, rngFixe(0.5), []);
  assert.equal(pvAffiches(def.pv), p.pvCible);
  assert.equal(pvAffiches(att.pv), p.pvAttaquant);
});
