// La machine à états de l'interaction, sur un **vrai** état de partie : c'est
// la seule façon de vérifier qu'elle ne parle au moteur que par `appliquer` et
// qu'elle ne mute jamais l'état (02-architecture.md §3.4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  chargerCatalogue, creerPartie, empreinte, reglagesParDefaut, sceneDeCarte,
  type EtatPartie,
} from '../../src/engine/index';
import { Controleur, SUITES_MENU } from '../../src/render/controleur';
import { validerMapDef, type MapDef } from '../../src/schemas/index';

const CAT = chargerCatalogue();

function carte(): MapDef {
  const chemin = path.resolve(import.meta.dirname, '..', 'engine', 'cartes', 'plaine.json');
  const r = validerMapDef(JSON.parse(readFileSync(chemin, 'utf8')) as unknown);
  if (!r.ok) throw new Error('carte de test invalide');
  return r.valeur;
}

function partie(): EtatPartie {
  return creerPartie(sceneDeCarte(carte(), reglagesParDefaut({ meteoForcee: 'clair' })), CAT, 'rendu');
}

function controleur(etat = partie()): Controleur {
  return new Controleur({ etat, catalogue: CAT, camp: 0 });
}

test('au départ, le contrôleur est inactif et le curseur est sur une unité du joueur', () => {
  const etat = partie();
  const c = controleur(etat);
  assert.equal(c.phase, 'inactif');
  assert.equal(c.vue.selection, null);
  assert.equal(c.vue.surbrillances.length, 0);
  const sous = etat.unites.find((u) => u.x === c.vue.curseur.x && u.y === c.vue.curseur.y);
  assert.equal(sous?.camp, 0);
});

test('sélectionner une unité alliée allume ses cases de déplacement', () => {
  const etat = partie();
  const c = controleur(etat);
  const unite = etat.unites.find((u) => u.camp === 0 && u.type === 'char_leger');
  assert.ok(unite);
  c.clicCase({ x: unite.x, y: unite.y });
  assert.equal(c.phase, 'selection');
  assert.equal(c.vue.selection, unite.id);
  const deplacement = c.vue.surbrillances.filter((s) => s.genre === 'deplacement');
  assert.ok(deplacement.length > 1, 'un char devrait pouvoir aller quelque part');
  assert.ok(
    deplacement.some((s) => s.case.x === unite.x && s.case.y === unite.y),
    'sa propre case fait partie des arrivées possibles',
  );
});

test('une unité adverse ne se sélectionne pas', () => {
  const etat = partie();
  const c = controleur(etat);
  const adverse = etat.unites.find((u) => u.camp === 1);
  assert.ok(adverse);
  c.clicCase({ x: adverse.x, y: adverse.y });
  assert.equal(c.phase, 'inactif');
  assert.equal(c.vue.selection, null);
});

test('cliquer une case atteignable trace un chemin et ouvre le menu d’ordres', () => {
  const etat = partie();
  const c = controleur(etat);
  const unite = etat.unites.find((u) => u.camp === 0 && u.type === 'char_leger');
  assert.ok(unite);
  c.clicCase({ x: unite.x, y: unite.y });
  const cible = c.vue.surbrillances
    .filter((s) => s.genre === 'deplacement')
    .find((s) => s.case.x !== unite.x || s.case.y !== unite.y);
  assert.ok(cible);
  c.clicCase(cible.case);
  assert.equal(c.phase, 'action');
  const chemin = c.vue.chemin;
  assert.ok(chemin.length >= 2, 'un chemin part de l’unité et arrive à destination');
  assert.deepEqual(chemin[0], { x: unite.x, y: unite.y });
  assert.deepEqual(chemin[chemin.length - 1], cible.case);
  assert.ok(c.vue.menu);
  assert.ok(c.vue.menu.options.some((o) => o.id === 'attendre'));
  for (const o of c.vue.menu.options) {
    assert.match(o.cle, /^hud\./, 'une entrée de menu porte une clé i18n, jamais un texte');
  }
});

test('« annuler » recule d’un cran : menu → sélection → rien', () => {
  const etat = partie();
  const c = controleur(etat);
  const unite = etat.unites.find((u) => u.camp === 0 && u.type === 'infanterie');
  assert.ok(unite);
  c.clicCase({ x: unite.x, y: unite.y });
  const cible = c.vue.surbrillances
    .filter((s) => s.genre === 'deplacement')
    .find((s) => s.case.x !== unite.x || s.case.y !== unite.y);
  assert.ok(cible);
  c.clicCase(cible.case);
  assert.equal(c.phase, 'action');
  c.annuler();
  assert.equal(c.phase, 'selection');
  c.annuler();
  assert.equal(c.phase, 'inactif');
  assert.equal(c.vue.selection, null);
});

test('un ordre passe par `appliquer` et ne mute jamais l’état d’entrée', () => {
  const etat = partie();
  const avant = empreinte(etat);
  const c = controleur(etat);
  const unite = etat.unites.find((u) => u.camp === 0 && u.type === 'char_leger');
  assert.ok(unite);
  c.clicCase({ x: unite.x, y: unite.y });
  const cible = c.vue.surbrillances
    .filter((s) => s.genre === 'deplacement')
    .find((s) => s.case.x !== unite.x || s.case.y !== unite.y);
  assert.ok(cible);
  c.clicCase(cible.case);
  c.choisirSuite('attendre');
  assert.equal(empreinte(etat), avant, 'l’état d’entrée doit être intact');
  assert.notEqual(empreinte(c.etat), avant, 'le nouvel état doit avoir bougé');
  const apres = c.etat.unites.find((u) => u.id === unite.id);
  assert.equal(apres?.x, cible.case.x);
  assert.equal(apres?.y, cible.case.y);
  assert.equal(apres?.etat, 'agi');
  assert.equal(c.phase, 'inactif');
});

test('une unité qui a déjà agi n’est plus sélectionnable', () => {
  const etat = partie();
  const c = controleur(etat);
  const unite = etat.unites.find((u) => u.camp === 0 && u.type === 'artillerie');
  assert.ok(unite);
  c.clicCase({ x: unite.x, y: unite.y });
  c.clicCase({ x: unite.x, y: unite.y });
  c.choisirSuite('attendre');
  c.clicCase({ x: unite.x, y: unite.y });
  assert.equal(c.phase, 'inactif');
});

test('finTour rend la main au camp adverse et verrouille le joueur', () => {
  const c = controleur();
  assert.equal(c.monTour, true);
  c.finTour();
  assert.equal(c.etat.campCourant, 1);
  assert.equal(c.monTour, false);
  c.clicCase({ x: 4, y: 4 });
  assert.equal(c.vue.selection, null, 'on ne joue pas pendant le tour de l’adversaire');
});

test('le menu de production s’ouvre sur une usine possédée et libre', () => {
  const etat = partie();
  const c = controleur(etat);
  // L'usine du camp 0 est en 3,4 sur la carte de plaine.
  assert.equal(c.ouvrirProduction({ x: 3, y: 4 }), true);
  assert.equal(c.phase, 'production');
  const production = c.vue.production;
  assert.ok(production);
  assert.ok(production.unites.includes('infanterie'));
  assert.ok(!production.unites.includes('helico'), 'une usine ne produit pas d’aérien');
  const fondsAvant = c.etat.camps[0]?.fonds ?? 0;
  c.choisirProduction('infanterie');
  assert.equal(c.phase, 'inactif');
  assert.ok((c.etat.camps[0]?.fonds ?? 0) < fondsAvant, 'la production coûte');
  assert.ok(c.etat.unites.some((u) => u.camp === 0 && u.x === 3 && u.y === 4));
});

test('la production est refusée sur un bâtiment adverse : le contrôleur n’ouvre rien', () => {
  const c = controleur();
  assert.equal(c.ouvrirProduction({ x: 12, y: 7 }), false);
  assert.equal(c.phase, 'inactif');
});

test('le curseur au clavier reste dans la carte', () => {
  const etat = partie();
  const c = controleur(etat);
  for (let i = 0; i < 40; i += 1) c.bougerCurseur(-1, -1);
  assert.deepEqual(c.vue.curseur, { x: 0, y: 0 });
  for (let i = 0; i < 60; i += 1) c.bougerCurseur(1, 1);
  assert.deepEqual(c.vue.curseur, { x: etat.largeur - 1, y: etat.hauteur - 1 });
});

test('un refus est signalé à l’écouteur, jamais levé', () => {
  const etat = partie();
  const refus: string[] = [];
  const c = new Controleur({
    etat, catalogue: CAT, camp: 0, ecouteur: { surRefus: (_a, m) => refus.push(m) },
  });
  c.finTour();
  c.finTour(); // ce n'est plus notre tour : le contrôleur refuse de son côté
  assert.equal(refus.length, 0, 'le contrôleur ne demande rien d’illégal au moteur');
  assert.equal(c.etat.campCourant, 1);
});

test('la portée d’attaque s’allume en rouge, hors des cases de déplacement', () => {
  const etat = partie();
  const c = controleur(etat);
  const unite = etat.unites.find((u) => u.camp === 0 && u.type === 'char_leger');
  assert.ok(unite);
  c.clicCase({ x: unite.x, y: unite.y });

  const vert = new Set(c.vue.surbrillances
    .filter((s) => s.genre === 'deplacement')
    .map((s) => `${s.case.x},${s.case.y}`));
  const rouge = c.vue.surbrillances.filter((s) => s.genre === 'attaque');
  assert.ok(rouge.length > 0, 'un char au contact du front menace au moins une case');
  // La règle de lecture : vert, j'y vais ; rouge, j'y tire. Jamais les deux.
  for (const s of rouge) {
    assert.ok(!vert.has(`${s.case.x},${s.case.y}`), 'une case atteignable reste verte');
    assert.ok(
      s.case.x >= 0 && s.case.y >= 0 && s.case.x < etat.largeur && s.case.y < etat.hauteur,
      'la portée ne déborde jamais de la carte',
    );
  }
});

test('une pièce indirecte ne menace que depuis sa case, pas depuis ses arrivées', () => {
  const etat = partie();
  const artillerie = etat.unites.find((u) => u.camp === 0 && u.type === 'artillerie');
  assert.ok(artillerie, 'la carte de test porte une artillerie au camp 0');
  const c = controleur(etat);
  c.clicCase({ x: artillerie.x, y: artillerie.y });

  const type = CAT.unites['artillerie'];
  assert.ok(type && !type.peutTirerApresMouvement, 'le cas testé suppose une pièce qui ne tire pas après mouvement');
  const rouge = c.vue.surbrillances.filter((s) => s.genre === 'attaque');
  for (const s of rouge) {
    const distance = Math.abs(s.case.x - artillerie.x) + Math.abs(s.case.y - artillerie.y);
    assert.ok(
      distance >= type.portee[0] && distance <= type.portee[1],
      `case rouge à ${distance} cases, hors de la portée [${type.portee.join(', ')}]`,
    );
  }
});

test('hors phase de visée, la vue ne propose aucune prévision de duel', () => {
  const etat = partie();
  const c = controleur(etat);
  const unite = etat.unites.find((u) => u.camp === 0 && u.type === 'char_leger');
  assert.ok(unite);
  assert.equal(c.vue.visee, null);
  c.clicCase({ x: unite.x, y: unite.y });
  assert.equal(c.vue.visee, null, 'sélectionner n’est pas viser');
});

// ---------------------------------------------------------------------------
// La visée en deux temps : pointer, puis confirmer
// ---------------------------------------------------------------------------

/** Une partie où le char du joueur a une infanterie adverse au contact. */
function partieAuContact(): EtatPartie {
  const etat = partie();
  const char = etat.unites.find((u) => u.camp === 0 && u.type === 'char_leger');
  const adverses = etat.unites.filter((u) => u.camp === 1);
  assert.ok(char && adverses.length >= 2);
  adverses[0]!.x = char.x + 1;
  adverses[0]!.y = char.y;
  adverses[1]!.x = char.x;
  adverses[1]!.y = char.y + 1;
  return etat;
}

/** Amène le contrôleur en phase de visée, sans avoir bougé l'unité. */
function viser(etat: EtatPartie): Controleur {
  const c = controleur(etat);
  const char = etat.unites.find((u) => u.camp === 0 && u.type === 'char_leger');
  assert.ok(char);
  c.clicCase({ x: char.x, y: char.y });
  c.clicCase({ x: char.x, y: char.y });
  assert.equal(c.phase, 'action');
  c.choisirSuite('attaquer');
  assert.equal(c.phase, 'cible', 'deux adversaires au contact ouvrent la visée');
  return c;
}

test('entrer en visée pointe déjà une cible : la prévision existe sans survol', () => {
  const c = viser(partieAuContact());
  assert.ok(c.vue.visee, 'la vue porte une visée');
  assert.ok(c.vue.visee?.cible, 'et une cible pointée dès le premier instant');
  assert.equal(c.vue.visee?.cibles.length, 2);
});

test('au doigt, le premier appui pointe et le second confirme', () => {
  const etat = partieAuContact();
  const c = viser(etat);
  const premiere = c.vue.visee?.cible;
  assert.ok(premiere);
  const autre = c.vue.visee?.cibles.find((x) => x.x !== premiere.x || x.y !== premiere.y);
  assert.ok(autre);

  // Premier appui sur l'autre cible : on la pointe, on n'attaque pas.
  c.clicCase(autre);
  assert.equal(c.phase, 'cible', 'pointer n’est pas frapper');
  assert.deepEqual(c.vue.visee?.cible, autre);

  // Second appui au même endroit : l'ordre part.
  c.clicCase(autre);
  assert.notEqual(c.phase, 'cible', 'le second appui confirme');
});

test('à la souris, survoler une cible suffit : le clic suivant confirme', () => {
  const c = viser(partieAuContact());
  const premiere = c.vue.visee?.cible;
  assert.ok(premiere);
  const autre = c.vue.visee?.cibles.find((x) => x.x !== premiere.x || x.y !== premiere.y);
  assert.ok(autre);
  c.poserCurseur(autre);
  assert.deepEqual(c.vue.visee?.cible, autre, 'le survol pointe');
  c.clicCase(autre);
  assert.notEqual(c.phase, 'cible', 'un seul clic après le survol');
});

test('cliquer hors des cibles annule la visée', () => {
  const c = viser(partieAuContact());
  c.clicCase({ x: 0, y: 0 });
  assert.equal(c.vue.visee, null);
});

test('les ordres gardent une place fixe, quel que soit leur nombre', () => {
  const etat = partieAuContact();
  const c = controleur(etat);
  const char = etat.unites.find((u) => u.camp === 0 && u.type === 'char_leger');
  assert.ok(char);
  c.clicCase({ x: char.x, y: char.y });
  c.clicCase({ x: char.x, y: char.y });
  const ids = c.vue.menu?.options.map((o) => o.id) ?? [];
  const rangs = ids.map((id) => SUITES_MENU.indexOf(id as typeof SUITES_MENU[number]));
  assert.deepEqual([...rangs].sort((a, b) => a - b), rangs, 'l’ordre suit SUITES_MENU');
  assert.equal(ids[ids.length - 1], 'attendre', 'attendre ferme toujours la liste');
});
