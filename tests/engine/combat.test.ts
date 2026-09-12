/**
 * Combat : la formule du §5 vérifiée à la main sur les valeurs de la matrice de
 * `content/degats.json`, la riposte, les munitions et la jauge.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appliquer, calculerDegats, chargerCatalogue, degatsBase, JAUGE_PAR_PV_INFLIGE, JAUGE_PAR_PV_SUBI,
  degatsArme, peutViser, prevoirDuel, pvAffiches, resoudreAttaque, copierEtat, empreinte, tireSansMunitions,
} from '../../src/engine/index';
import { CAT, partiePersonnalisee, rngFixe, u } from './aides';

// Une bande de terrain simple : route, forêt, plaine, montagne.
const GRILLE = [
  'HRRFMPPPPH',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
];

test("la table de dégâts est bien celle du document 04 §8", () => {
  assert.equal(degatsBase(CAT, 'char_leger', 'infanterie'), 75);
  assert.equal(degatsBase(CAT, 'antiair', 'helico'), 120);
  assert.equal(degatsBase(CAT, 'char_lourd', 'helico'), 0);
  assert.equal(degatsBase(CAT, 'transport', 'infanterie'), 0);
});

test("l'exemple travaillé du §5.4 donne exactement 36 puis 4 PV", () => {
  // Char léger 10 PV sur route (1,0 → route), infanterie 10 PV en forêt (E = 2).
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 2, y: 0 },
    { camp: 1, type: 'infanterie', x: 3, y: 0 },
  ]);
  const travail = copierEtat(etat);
  const char = u(travail, 'u1');
  const inf = u(travail, 'u2');
  // Le 8 septembre 2026, l'échelle passe à 0,65 et la forêt à 1 − 0,10 × 2 = 0,80,
  // sans plus dépendre des PV de la cible : D = 0,65 × 75 × 1 × 0,80 = 39 (68 avant).
  const degats = calculerDegats(travail, CAT, char, inf, rngFixe(0.5));
  assert.equal(degats, 39);
  inf.pv -= degats;
  assert.equal(inf.pv, 61);
  // 7 PV affichés au lieu de 4 : c'est le « plus doux » demandé par le propriétaire.
  assert.equal(pvAffiches(inf.pv), 7);
  // Riposte : 0,65 × 10 × (7/10) × 1,00 (le char est sur une route, E = 0) = 4,55 → 5.
  assert.equal(calculerDegats(travail, CAT, inf, char, rngFixe(0.5)), 5);
});

test("l'aléa reste borné à ±5 %", () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 2, y: 0 },
    { camp: 1, type: 'infanterie', x: 3, y: 0 },
  ]);
  const bas = calculerDegats(copierEtat(etat), CAT, u(etat, 'u1'), u(etat, 'u2'), rngFixe(0));
  const haut = calculerDegats(copierEtat(etat), CAT, u(etat, 'u1'), u(etat, 'u2'), rngFixe(0.999999));
  // La valeur nominale est 39 depuis le 8 septembre 2026 (67,5 avant) ; l'aléa, lui,
  // n'a pas bougé : ±5 % autour d'elle.
  assert.equal(bas, Math.round(39 * 0.95));
  assert.equal(haut, Math.round(39 * 1.05));
});

test('la défense de terrain ne dépend plus des PV de la cible', () => {
  // Montagne, E = 4 : Fterrain = 1 − 0,10 × 4 = 0,60, quel que soit l'état de la cible.
  // Avant le 8 septembre 2026, la même cible à 2 PV n'avait plus que 4 % de
  // protection au lieu de 20 % : l'abri s'évaporait au moment où il servait.
  const attendu = Math.round(0.65 * 75 * 0.6); // 29
  for (const pv of [100, 60]) {
    const etat = partiePersonnalisee(GRILLE, {}, [
      { camp: 0, type: 'char_leger', x: 3, y: 1 },
      { camp: 1, type: 'infanterie', x: 4, y: 0, pv },
    ]);
    const degats = calculerDegats(copierEtat(etat), CAT, u(etat, 'u1'), u(etat, 'u2'), rngFixe(0.5));
    assert.equal(degats, attendu, `cible à ${pv} PV internes : la montagne protège pareil`);
  }
});

test('une unité de tir indirect ne riposte jamais et ne tire pas après avoir bougé', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 5, y: 1 },
    { camp: 1, type: 'artillerie', x: 5, y: 2 },
  ]);
  const travail = copierEtat(etat);
  const issue = resoudreAttaque(travail, CAT, u(travail, 'u1'), u(travail, 'u2'), rngFixe(0.5), []);
  assert.equal(issue.riposte, 0);
  const arti = u(etat, 'u2');
  assert.equal(peutViser(etat, CAT, arti, u(etat, 'u1'), { x: 5, y: 2 }, true).ok, false);
  assert.equal(peutViser(etat, CAT, arti, u(etat, 'u1'), { x: 5, y: 2 }, false).ok, false); // distance 1
});

test('la portée minimale des indirectes interdit le corps à corps', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'artillerie', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 5, y: 7 },
  ]);
  const arti = u(etat, 'u1');
  const cible = u(etat, 'u2');
  assert.equal(peutViser(etat, CAT, arti, cible, { x: 5, y: 5 }, false).ok, true);
  const collee = peutViser(etat, CAT, arti, cible, { x: 5, y: 6 }, false);
  assert.equal(collee.ok, false);
  assert.equal(collee.ok === false && collee.motif, 'cible_hors_portee');
});

test('la riposte consomme une munition et rend de la jauge aux deux camps', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 5, y: 5 },
    { camp: 1, type: 'char_leger', x: 5, y: 6 },
  ]);
  const travail = copierEtat(etat);
  const att = u(travail, 'u1');
  const def = u(travail, 'u2');
  const avantAtt = att.munitions ?? 0;
  const avantDef = def.munitions ?? 0;
  const issue = resoudreAttaque(travail, CAT, att, def, rngFixe(0.5), []);
  assert.equal(att.munitions, avantAtt - 1);
  assert.equal(def.munitions, avantDef - 1);
  assert.ok(issue.riposte > 0);
  const retires = 10 - pvAffiches(def.pv);
  const rendus = 10 - pvAffiches(att.pv);
  assert.equal(
    travail.camps[0]?.jauge,
    JAUGE_PAR_PV_INFLIGE * retires + JAUGE_PAR_PV_SUBI * rendus,
  );
  assert.equal(
    travail.camps[1]?.jauge,
    JAUGE_PAR_PV_SUBI * retires + JAUGE_PAR_PV_INFLIGE * rendus,
  );
});

test("une unité sans munition ni arme secondaire ne peut plus viser", () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'antiair', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 5, y: 6 },
  ]);
  const travail = copierEtat(etat);
  const att = u(travail, 'u1');
  att.munitions = 0;
  const v = peutViser(travail, CAT, att, u(travail, 'u2'), { x: 5, y: 5 }, false);
  assert.equal(v.ok, false);
  assert.equal(v.ok === false && v.motif, 'sans_munitions');
});

// ---------------------------------------------------------------------------
// L'arme secondaire (§5.3) : une mitrailleuse qui ne compte pas ses balles
// ---------------------------------------------------------------------------

test('tireSansMunitions lit la donnée du catalogue, jamais un nom', () => {
  const char = CAT.unites['char_leger']!;
  assert.equal(tireSansMunitions(char, 'infanterie'), true);
  assert.equal(tireSansMunitions(char, 'char_leger'), false);
  assert.equal(tireSansMunitions(char, 'helico'), false, 'à 0 dans la ligne, l’hélico n’est pas une cible secondaire');
  assert.equal(tireSansMunitions(CAT.unites['infanterie']!, 'infanterie'), false, 'sans munitions, pas de secondaire');
  assert.equal(tireSansMunitions({ ...char, armeSecondaire: null }, 'infanterie'), false);
});

test('un char à zéro munition tire encore : plein sur l’infanterie, à la mitrailleuse sur un char, jamais sur l’hélico', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 5, y: 6 },
    { camp: 1, type: 'char_leger', x: 6, y: 5 },
    { camp: 1, type: 'helico', x: 4, y: 5 },
  ]);
  const travail = copierEtat(etat);
  const att = u(travail, 'u1');
  assert.equal(degatsArme(CAT, att, 'char_leger'), 55, 'chargé : la base pleine');
  att.munitions = 0;
  assert.equal(peutViser(travail, CAT, att, u(travail, 'u2'), { x: 5, y: 5 }, false).ok, true);
  assert.equal(peutViser(travail, CAT, att, u(travail, 'u3'), { x: 5, y: 5 }, false).ok, true);
  const v = peutViser(travail, CAT, att, u(travail, 'u4'), { x: 5, y: 5 }, false);
  assert.equal(v.ok === false && v.motif, 'ne_peut_pas_viser', 'à 0 dans la ligne, le tir à sec n’invente rien');
  assert.equal(degatsArme(CAT, att, 'infanterie'), 75, 'cible listée : dégâts pleins');
  assert.equal(degatsArme(CAT, att, 'char_leger'), 15, 'hors liste : degatsSecondaire');
  assert.equal(degatsArme(CAT, att, 'helico'), 0);
  const aa = { ...u(travail, 'u1'), type: 'antiair', munitions: 0 };
  assert.equal(degatsArme(CAT, aa, 'infanterie'), 0, 'sans arme secondaire, à sec, rien');
  assert.equal(degatsArme(CAT, u(travail, 'u2'), 'char_leger'), 10, 'tir illimité : la base');
});

test('un char à sec frappe un char sur 10, sans consommer, et un char à sec riposte à un char', () => {
  // Deux chars sur la route (E = 0) : D = 0,65 × 15 × 1 × 1 × 1 = 9,75 → 10 PV
  // internes (15 avant l'échelle du 8 septembre 2026). C'est la falaise qui a
  // fait retenir 0,65 plutôt que 0,60, où le même coup n'ôtait aucun PV affiché.
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 1, y: 0 },
    { camp: 1, type: 'char_leger', x: 2, y: 0 },
  ]);
  const travail = copierEtat(etat);
  const att = u(travail, 'u1');
  const def = u(travail, 'u2');
  att.munitions = 0;
  def.munitions = 0;
  const p = prevoirDuel(travail, CAT, att, def, { x: 1, y: 0 });
  const issue = resoudreAttaque(travail, CAT, att, def, rngFixe(0.5), []);
  assert.equal(issue.degats, 10);
  assert.equal(att.munitions, 0);
  // Riposte à sec, sur les PV d'après la frappe, et atténuée : la cible a 90 PV
  // internes et en affiche 9, donc 0,65 × 15 × (9/10) = 8,8 → 9 à pleine force,
  // et 9 × 0,80 = 7,2 → 7 une fois FACTEUR_RIPOSTE appliqué. La mitrailleuse
  // entame, elle n'achève pas : c'était déjà la lecture du §5.3.
  assert.equal(issue.riposte, 7);
  assert.equal(def.munitions, 0);
  assert.equal(p.degats, issue.degats);
  assert.equal(p.riposte, issue.riposte, 'la prévision lit la même base effective');
});

test('le tir secondaire ne consomme rien, le tir principal consomme une munition', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 5, y: 6 },
    { camp: 1, type: 'char_leger', x: 6, y: 5 },
  ]);
  const travail = copierEtat(etat);
  const att = u(travail, 'u1');
  const avant = att.munitions ?? 0;
  resoudreAttaque(travail, CAT, att, u(travail, 'u2'), rngFixe(0.5), []);
  assert.equal(att.munitions, avant, 'la mitrailleuse ne compte pas ses balles');
  resoudreAttaque(travail, CAT, att, u(travail, 'u3'), rngFixe(0.5), []);
  assert.equal(att.munitions, avant - 1, 'le canon, lui, compte');
});

test('la riposte à zéro munition existe contre une cible secondaire, et pas contre les autres', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'infanterie', x: 5, y: 5 },
    { camp: 1, type: 'char_leger', x: 5, y: 6, pv: 30 },
    { camp: 0, type: 'char_leger', x: 4, y: 6 },
  ]);
  const travail = copierEtat(etat);
  const char = u(travail, 'u2');
  char.munitions = 0;
  // L'infanterie frappe un char à sec : il riposte à la mitrailleuse, sans munition.
  const issue = resoudreAttaque(travail, CAT, u(travail, 'u1'), char, rngFixe(0.5), []);
  assert.ok(issue.riposte > 0, 'la riposte secondaire a lieu');
  assert.equal(char.munitions, 0, 'et ne consomme rien');
  // Le même char à sec, frappé par un char : rien à rendre.
  const encore = resoudreAttaque(travail, CAT, u(travail, 'u3'), char, rngFixe(0.5), []);
  assert.equal(encore.riposte, 0);
});

test('la prévision annonce la riposte secondaire à zéro munition', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'infanterie', x: 5, y: 5 },
    { camp: 1, type: 'char_leger', x: 5, y: 6, pv: 30 },
  ]);
  const travail = copierEtat(etat);
  u(travail, 'u2').munitions = 0;
  const p = prevoirDuel(travail, CAT, u(travail, 'u1'), u(travail, 'u2'), { x: 5, y: 5 });
  assert.ok(p.riposte > 0);
  const copie = copierEtat(travail);
  const reel = resoudreAttaque(copie, CAT, u(copie, 'u1'), u(copie, 'u2'), rngFixe(0.5), []);
  assert.equal(p.riposte, reel.riposte, 'la prévision est la formule, pas une seconde table');
});

test('le char moyen du catalogue 4 se joue comme les autres chars', () => {
  const cat4 = chargerCatalogue(0);
  const moyen = cat4.unites['char_moyen']!;
  assert.equal(moyen.cout, 10000);
  assert.deepEqual(moyen.armeSecondaire, ['infanterie', 'meca', 'genie']);
  assert.ok(degatsBase(cat4, 'char_leger', 'char_moyen') > degatsBase(cat4, 'char_leger', 'char_lourd'));
  assert.ok(degatsBase(cat4, 'char_moyen', 'infanterie') > degatsBase(cat4, 'char_leger', 'infanterie'));
  assert.ok(degatsBase(cat4, 'char_moyen', 'infanterie') < degatsBase(cat4, 'char_lourd', 'infanterie'));
  // Sa colonne est lue partout, y compris par les homologuées qui la portent aussi.
  assert.equal(degatsBase(cat4, 'genie', 'char_moyen'), 8);
  assert.equal(degatsBase(cat4, 'char_moyen', 'brouilleur'), 95);
  assert.equal(degatsBase(cat4, 'char_moyen', 'helico'), 0);
});

test("le transport ne peut viser personne", () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'transport', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 5, y: 6 },
  ]);
  const v = peutViser(etat, CAT, u(etat, 'u1'), u(etat, 'u2'), { x: 5, y: 5 }, false);
  assert.equal(v.ok, false);
  assert.equal(v.ok === false && v.motif, 'ne_peut_pas_viser');
});

test('une attaque passe par appliquer et laisse la cible sous ses PV de départ', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 5, y: 6 },
  ]);
  const r = appliquer(etat, {
    type: 'ordre', uniteId: 'u1', chemin: [{ x: 5, y: 5 }],
    suite: { type: 'attaquer', cible: { x: 5, y: 6 } },
  }, CAT);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.ok(u(r.etat, 'u2').pv < 100);
  assert.equal(u(r.etat, 'u1').etat, 'agi');
  // L'état d'entrée n'a pas bougé : le moteur est pur.
  assert.equal(u(etat, 'u2').pv, 100);
});

// ---------------------------------------------------------------------------
// Prévision : ce que le HUD montre avant que le joueur ne confirme
// ---------------------------------------------------------------------------

test('la prévision ne touche ni à l’état ni au flux d’aléa', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 5, y: 6 },
  ]);
  const avant = empreinte(etat);
  prevoirDuel(etat, CAT, u(etat, 'u1'), u(etat, 'u2'), { x: 5, y: 5 });
  prevoirDuel(etat, CAT, u(etat, 'u1'), u(etat, 'u2'), { x: 5, y: 5 });
  assert.equal(empreinte(etat), avant, 'une prévision est une lecture, pas un coup joué');
});

test('deux prévisions identiques donnent le même chiffre : c’est une information, pas un bruit', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 5, y: 6 },
  ]);
  const a = prevoirDuel(etat, CAT, u(etat, 'u1'), u(etat, 'u2'), { x: 5, y: 5 });
  const b = prevoirDuel(etat, CAT, u(etat, 'u1'), u(etat, 'u2'), { x: 5, y: 5 });
  assert.deepEqual(a, b);
});

test('la prévision reste dans les 5 % du tirage réel, riposte comprise', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 5, y: 5 },
    { camp: 1, type: 'char_leger', x: 5, y: 6 },
  ]);
  const prevu = prevoirDuel(etat, CAT, u(etat, 'u1'), u(etat, 'u2'), { x: 5, y: 5 });
  assert.ok(prevu.degats > 0 && prevu.riposte > 0, 'deux chars au contact s’échangent des coups');

  const joue = copierEtat(etat);
  resoudreAttaque(joue, CAT, u(joue, 'u1'), u(joue, 'u2'), rngFixe(0.5), []);
  assert.ok(Math.abs(pvAffiches(u(joue, 'u2').pv) - prevu.pvCible) <= 1);
  assert.ok(Math.abs(pvAffiches(u(joue, 'u1').pv) - prevu.pvAttaquant) <= 1);
});

test('une cible qui ne survit pas ne riposte pas, et la prévision le dit', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_lourd', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 5, y: 6 },
  ]);
  u(etat, 'u2').pv = 10;
  const prevu = prevoirDuel(etat, CAT, u(etat, 'u1'), u(etat, 'u2'), { x: 5, y: 5 });
  assert.equal(prevu.cibleHorsJeu, true);
  assert.equal(prevu.pvCible, 0);
  assert.equal(prevu.riposte, 0);
});

test('une pièce indirecte hors contact ne subit aucune riposte', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'artillerie', x: 5, y: 5 },
    { camp: 1, type: 'char_leger', x: 5, y: 7 },
  ]);
  const prevu = prevoirDuel(etat, CAT, u(etat, 'u1'), u(etat, 'u2'), { x: 5, y: 5 });
  assert.ok(prevu.degats > 0);
  assert.equal(prevu.riposte, 0, 'la riposte n’existe qu’à distance 1');
  assert.equal(prevu.pvAttaquant, pvAffiches(u(etat, 'u1').pv));
});

test('la prévision se fait depuis la case d’arrivée, pas depuis la case de départ', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 5, y: 3 },
    { camp: 1, type: 'infanterie', x: 5, y: 6 },
  ]);
  // Depuis le départ, la cible est hors de portée : aucune riposte possible.
  const loin = prevoirDuel(etat, CAT, u(etat, 'u1'), u(etat, 'u2'), { x: 5, y: 3 });
  assert.equal(loin.riposte, 0);
  // Une fois arrivé au contact, la riposte entre dans le calcul.
  const contact = prevoirDuel(etat, CAT, u(etat, 'u1'), u(etat, 'u2'), { x: 5, y: 5 });
  assert.ok(contact.riposte > 0);
});
