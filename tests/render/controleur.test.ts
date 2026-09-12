// La machine à états de l'interaction, sur un **vrai** état de partie : c'est
// la seule façon de vérifier qu'elle ne parle au moteur que par `appliquer` et
// qu'elle ne mute jamais l'état (02-architecture.md §3.4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  appliquer, chargerCatalogue, creerPartie, empreinte, reglagesParDefaut, sceneDeCarte, uniteParId, uniteSur,
  unitesVues, type Action, type Catalogue, type CommandantMoteur, type EtatPartie, type Unite,
} from '../../src/engine/index';
import { Controleur, SUITES_MENU } from '../../src/render/controleur';
import { validerMapDef, type MapDef } from '../../src/schemas/index';
import { scenePersonnalisee } from '../engine/aides';

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

test('une unité adverse ne se sélectionne pas : elle s’inspecte', () => {
  const etat = partie();
  const c = controleur(etat);
  const adverse = etat.unites.find((u) => u.camp === 1);
  assert.ok(adverse);
  c.clicCase({ x: adverse.x, y: adverse.y });
  assert.equal(c.phase, 'inactif');
  assert.equal(c.vue.selection, null);
  assert.equal(c.vue.inspection, adverse.id, 'un clic simple suffit à voir ce qu’elle peut faire');
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

// ---------------------------------------------------------------------------
// L'inspection : double-clic ou appui long sur une unité adverse
// ---------------------------------------------------------------------------

test('inspecter une unité adverse allume ses arrivées en danger et son enveloppe de tir en attaque', () => {
  const etat = partieAuContact();
  const c = controleur(etat);
  const adverse = etat.unites.find((u) => u.camp === 1 && u.type === 'char_leger')
    ?? etat.unites.find((u) => u.camp === 1);
  assert.ok(adverse);
  assert.equal(c.inspecter({ x: adverse.x, y: adverse.y }), true);
  assert.equal(c.vue.inspection, adverse.id);
  assert.equal(c.phase, 'inactif', 'l’inspection n’est pas une phase : elle ne joue rien');
  assert.equal(c.vue.selection, null, 'une unité adverse n’est jamais sélectionnée');
  assert.deepEqual(c.vue.curseur, { x: adverse.x, y: adverse.y }, 'le curseur reste sur l’unité montrée');

  const danger = new Set(c.vue.surbrillances
    .filter((s) => s.genre === 'danger')
    .map((s) => `${s.case.x},${s.case.y}`));
  assert.ok(danger.size > 1, 'l’adversaire peut aller quelque part');
  assert.ok(danger.has(`${adverse.x},${adverse.y}`), 'sa propre case fait partie de ses arrivées');
  assert.equal(c.vue.surbrillances.some((s) => s.genre === 'deplacement'), false,
    'le vert reste au joueur : les arrivées adverses ne sont pas des destinations');

  const type = CAT.unites[adverse.type];
  assert.ok(type);
  const rouge = c.vue.surbrillances.filter((s) => s.genre === 'attaque');
  assert.ok(rouge.length > 0, 'une unité armée menace au moins une case hors de ses arrivées');
  for (const s of rouge) {
    assert.ok(!danger.has(`${s.case.x},${s.case.y}`), 'une case d’arrivée n’est pas en plus une case de tir');
    assert.ok(
      s.case.x >= 0 && s.case.y >= 0 && s.case.x < etat.largeur && s.case.y < etat.hauteur,
      'l’enveloppe ne déborde jamais de la carte',
    );
    const sources = type.peutTirerApresMouvement ? [...danger] : [`${adverse.x},${adverse.y}`];
    const portable = sources.some((k) => {
      const [x, y] = k.split(',').map(Number) as [number, number];
      const d = Math.abs(s.case.x - x) + Math.abs(s.case.y - y);
      return d >= type.portee[0] && d <= type.portee[1];
    });
    assert.ok(portable, 'chaque case rouge est à portée depuis une arrivée possible');
  }
  assert.equal(empreinte(c.etat), empreinte(etat), 'inspecter ne touche pas à la partie');
});

test('un clic simple sur une unité adverse ouvre son détail, sans double-clic ni appui long', () => {
  const etat = partieAuContact();
  const c = controleur(etat);
  const adverse = etat.unites.find((u) => u.camp === 1);
  assert.ok(adverse);
  c.clicCase({ x: adverse.x, y: adverse.y });
  assert.equal(c.vue.inspection, adverse.id);
  assert.equal(c.phase, 'inactif', 'l’inspection ne joue rien');
  assert.deepEqual(c.vue.curseur, { x: adverse.x, y: adverse.y });
  assert.ok(c.vue.surbrillances.some((s) => s.genre === 'danger'), 'ses arrivées sont allumées');
  assert.equal(empreinte(c.etat), empreinte(etat), 'un clic sur l’adversaire ne touche pas à la partie');

  // Le double-clic reste, et n'ajoute rien : les deux clics passent par le même
  // chemin, la demande d'inspection qui suit retombe sur la même unité.
  c.clicCase({ x: adverse.x, y: adverse.y });
  assert.equal(c.inspecter({ x: adverse.x, y: adverse.y }), true);
  assert.equal(c.vue.inspection, adverse.id);
});

test('sous brouillard, cliquer la case d’une unité adverse invisible n’ouvre rien', () => {
  const etat = creerPartie(
    sceneDeCarte(carte(), reglagesParDefaut({ meteoForcee: 'clair', brouillard: true })), CAT, 'rendu',
  );
  const vues = new Set(unitesVues(etat, CAT, 0).map((u) => u.id));
  const cachee = etat.unites.find((u) => u.camp === 1 && !vues.has(u.id));
  assert.ok(cachee);
  const c = controleur(etat);
  c.clicCase({ x: cachee.x, y: cachee.y });
  assert.equal(c.vue.inspection, null);
  assert.equal(c.vue.surbrillances.length, 0, 'la portée dirait où elle est');
});

test('l’inspection se referme au clic suivant, à Échap, ou en sélectionnant une unité amie', () => {
  const etat = partieAuContact();
  const adverse = etat.unites.find((u) => u.camp === 1);
  const amie = etat.unites.find((u) => u.camp === 0 && u.type === 'char_leger');
  assert.ok(adverse && amie);

  const c = controleur(etat);
  assert.equal(c.inspecter({ x: adverse.x, y: adverse.y }), true);
  c.clicCase({ x: 0, y: 0 });
  assert.equal(c.vue.inspection, null, 'un clic n’importe où referme');
  assert.equal(c.vue.surbrillances.length, 0);

  assert.equal(c.inspecter({ x: adverse.x, y: adverse.y }), true);
  c.annuler();
  assert.equal(c.vue.inspection, null, 'Échap referme');
  assert.equal(c.phase, 'inactif');

  assert.equal(c.inspecter({ x: adverse.x, y: adverse.y }), true);
  c.poserCurseur({ x: 0, y: 0 });
  assert.deepEqual(c.vue.curseur, { x: adverse.x, y: adverse.y }, 'le survol ne décroche pas la fiche inspectée');
  c.clicCase({ x: amie.x, y: amie.y });
  assert.equal(c.vue.inspection, null, 'sélectionner une unité amie referme');
  assert.equal(c.vue.selection, amie.id);
  assert.equal(c.phase, 'selection');
  assert.ok(c.vue.surbrillances.some((s) => s.genre === 'deplacement'));
  assert.equal(c.vue.surbrillances.some((s) => s.genre === 'danger'), false);
});

test('sous brouillard, une unité adverse invisible ne s’inspecte pas ; une unité vue, si', () => {
  const etat = creerPartie(
    sceneDeCarte(carte(), reglagesParDefaut({ meteoForcee: 'clair', brouillard: true })), CAT, 'rendu',
  );
  const vues = new Set(unitesVues(etat, CAT, 0).map((u) => u.id));
  const cachee = etat.unites.find((u) => u.camp === 1 && !vues.has(u.id));
  assert.ok(cachee, 'la carte de plaine laisse au moins une unité adverse hors de vue au premier jour');
  const c = controleur(etat);
  assert.equal(c.inspecter({ x: cachee.x, y: cachee.y }), false);
  assert.equal(c.vue.inspection, null);
  assert.equal(c.vue.surbrillances.length, 0, 'rien n’est allumé : la portée dirait où elle est');

  // La même unité amenée au contact devient visible, donc inspectable.
  const char = etat.unites.find((u) => u.camp === 0 && u.type === 'char_leger');
  assert.ok(char);
  cachee.x = char.x + 1;
  cachee.y = char.y;
  const c2 = controleur(etat);
  assert.equal(c2.inspecter({ x: cachee.x, y: cachee.y }), true);
  assert.equal(c2.vue.inspection, cachee.id);
});

test('inspecter une unité amie ou une case vide ne change rien à l’existant', () => {
  const etat = partie();
  const c = controleur(etat);
  const amie = etat.unites.find((u) => u.camp === 0 && u.type === 'char_leger');
  assert.ok(amie);
  // Le double-clic arrive comme deux clics puis une demande d'inspection.
  c.clicCase({ x: amie.x, y: amie.y });
  c.clicCase({ x: amie.x, y: amie.y });
  assert.equal(c.phase, 'action', 'deux clics sur une unité amie ouvrent son menu');
  assert.equal(c.inspecter({ x: amie.x, y: amie.y }), false);
  assert.equal(c.phase, 'action', 'la demande d’inspection n’a rien défait');
  assert.equal(c.vue.selection, amie.id);
  assert.equal(c.vue.inspection, null);
  assert.equal(c.inspecter({ x: 0, y: 0 }), false, 'une case vide n’a rien à montrer');
  assert.equal(c.phase, 'action');
});

test('un double-clic qui confirme une attaque n’ouvre pas l’inspection de la cible', () => {
  const etat = partieAuContact();
  const c = viser(etat);
  const premiere = c.vue.visee?.cible;
  assert.ok(premiere);
  const autre = c.vue.visee?.cibles.find((x) => x.x !== premiere.x || x.y !== premiere.y);
  assert.ok(autre);
  c.clicCase(autre);
  c.clicCase(autre);
  assert.notEqual(c.phase, 'cible', 'le second appui a confirmé');
  assert.equal(c.inspecter(autre), false);
  assert.equal(c.vue.inspection, null);
  // Le témoin ne survit pas au clic suivant : le double-clic d'après inspecte.
  const restante = c.etat.unites.find((u) => u.camp === 1 && uniteSur(c.etat, u)?.id === u.id);
  assert.ok(restante, 'il reste une unité adverse sur le plateau');
  c.clicCase(restante);
  c.clicCase(restante);
  assert.equal(c.inspecter(restante), true);
  assert.equal(c.vue.inspection, restante.id);
});

// ---------------------------------------------------------------------------
// Ce que coûte un survol
// ---------------------------------------------------------------------------

/**
 * `portee()` lit `type.carburant` à chaque appel, et rien d'autre ne le lit
 * pendant un survol : un Proxy sur le type d'unité compte donc les Dijkstra.
 */
function catalogueCompteur(cle: string): { cat: typeof CAT; lectures: () => number } {
  let n = 0;
  const type = CAT.unites[cle as keyof typeof CAT.unites];
  assert.ok(type);
  const espion = new Proxy(type, {
    get(cible, prop, recepteur) {
      if (prop === 'carburant') n += 1;
      return Reflect.get(cible, prop, recepteur);
    },
  });
  return { cat: { ...CAT, unites: { ...CAT.unites, [cle]: espion } }, lectures: () => n };
}

test('dix survols en phase de sélection ne rejouent ni le Dijkstra ni l’enveloppe de tir', () => {
  const etat = partie();
  const { cat, lectures } = catalogueCompteur('char_leger');
  const c = new Controleur({ etat, catalogue: cat, camp: 0 });
  const unite = etat.unites.find((u) => u.camp === 0 && u.type === 'char_leger');
  assert.ok(unite);
  c.clicCase({ x: unite.x, y: unite.y });
  const v0 = c.vue;
  const atteignables = v0.surbrillances.filter((s) => s.genre === 'deplacement').map((s) => s.case);
  const attaque = v0.surbrillances.filter((s) => s.genre === 'attaque');
  assert.ok(atteignables.length >= 3);
  assert.ok(attaque.length > 0, 'un char a une enveloppe de tir');
  const apresSelection = lectures();
  assert.ok(apresSelection > 0, 'l’espion voit bien la portée se calculer');

  for (let i = 0; i < 10; i += 1) {
    c.poserCurseur(atteignables[i % atteignables.length]!);
    const v = c.vue;
    assert.equal(v.surbrillances.filter((s) => s.genre === 'attaque').length, attaque.length);
    assert.equal(
      v.surbrillances.find((s) => s.genre === 'attaque')?.case, attaque[0]!.case,
      'l’enveloppe est la même liste, pas une liste recalculée',
    );
  }
  assert.equal(lectures(), apresSelection, 'aucun nouveau calcul de portée');
  assert.ok(c.vue.chemin.length >= 1, 'le chemin, lui, suit le curseur');
});

// ---------------------------------------------------------------------------
// Catalogue 6 : la furtivité, et le débarquement choisi
// ---------------------------------------------------------------------------

/**
 * Une partie en catalogue 6 sur une plaine de cinq sur trois : un chasseur
 * furtif, un transport et deux fantassins du joueur, un fantassin adverse loin
 * de tout — assez pour que la partie ne soit pas finie d'avance.
 */
function partieCatalogue6(): { etat: EtatPartie; cat: Catalogue } {
  const cat = chargerCatalogue(0);
  // `P` : la plaine du catalogue — un point n'est pas un terrain, et une case
  // sans terrain n'est ni franchissable ni débarquable.
  const scene = scenePersonnalisee(['PPPPP', 'PPPPP', 'PPPPP'], {}, [
    { camp: 0, type: 'furtif', x: 0, y: 0 },
    { camp: 0, type: 'transport', x: 2, y: 1 },
    { camp: 0, type: 'infanterie', x: 0, y: 2 },
    { camp: 0, type: 'meca', x: 1, y: 2 },
    { camp: 1, type: 'infanterie', x: 4, y: 2 },
  ]);
  return { etat: creerPartie(scene, cat, 'test'), cat };
}

/** Met un passager dans la cale, comme le moteur l'aurait fait. */
function embarquer(transport: Unite, passager: Unite): void {
  transport.cargo.push(passager.id);
  passager.dansTransport = transport.id;
  passager.x = transport.x;
  passager.y = transport.y;
}

/** Sélectionne l'unité et ouvre son menu sur sa propre case, sans déplacement. */
function ouvrirMenuSurPlace(c: Controleur, u: Unite): void {
  c.clicCase({ x: u.x, y: u.y });
  c.clicCase({ x: u.x, y: u.y });
  assert.equal(c.phase, 'action');
}

test('une unité au trait furtif offre « se cacher », joue l’ordre, puis offre « se montrer » ; les autres n’ont rien', () => {
  const { etat, cat } = partieCatalogue6();
  const c = new Controleur({ etat, catalogue: cat, camp: 0 });
  const furtif = etat.unites.find((u) => u.type === 'furtif');
  assert.ok(furtif);
  ouvrirMenuSurPlace(c, furtif);
  const entree = c.vue.menu?.options.find((o) => o.id === 'furtivite');
  assert.ok(entree, 'offerte sans déplacement');
  assert.equal(entree.cle, 'hud.se_cacher', 'visible : le menu propose de se cacher');
  assert.ok(SUITES_MENU.indexOf('furtivite') < SUITES_MENU.indexOf('attendre'), 'avant « attendre », qui ferme');
  c.choisirSuite('furtivite');
  assert.equal(c.phase, 'inactif');
  const cachee = uniteParId(c.etat, furtif.id);
  assert.equal(cachee?.furtive, true);
  assert.equal(cachee?.etat, 'agi');

  // Le tour suivant, après un déplacement : « se montrer ».
  c.finTour();
  const r = appliquer(c.etat, { type: 'finTour' }, cat);
  assert.ok(r.ok);
  c.poserEtat(r.etat);
  assert.equal(c.monTour, true);
  c.clicCase({ x: furtif.x, y: furtif.y });
  c.clicCase({ x: 1, y: 0 });
  assert.equal(c.phase, 'action');
  const retour = c.vue.menu?.options.find((o) => o.id === 'furtivite');
  assert.equal(retour?.cle, 'hud.se_montrer', 'furtive : le menu propose de se montrer, après un déplacement aussi');
  c.choisirSuite('furtivite');
  const montree = uniteParId(c.etat, furtif.id);
  assert.equal(montree?.furtive, false);
  assert.deepEqual({ x: montree?.x, y: montree?.y }, { x: 1, y: 0 }, 'le déplacement a eu lieu avant la bascule');

  // Un fantassin n'a pas l'ordre.
  const infanterie = c.etat.unites.find((u) => u.camp === 0 && u.type === 'infanterie');
  assert.ok(infanterie);
  ouvrirMenuSurPlace(c, infanterie);
  assert.ok(!c.vue.menu?.options.some((o) => o.id === 'furtivite'));
});

test('« débarquer » ouvre le choix de la case, en vert, sur les cases que le passager peut fouler', () => {
  const { etat, cat } = partieCatalogue6();
  const transport = etat.unites.find((u) => u.type === 'transport');
  const passager = etat.unites.find((u) => u.type === 'infanterie' && u.camp === 0);
  assert.ok(transport && passager);
  embarquer(transport, passager);
  const c = new Controleur({ etat, catalogue: cat, camp: 0 });
  ouvrirMenuSurPlace(c, transport);
  const entree = c.vue.menu?.options.find((o) => o.id === 'debarquer');
  assert.ok(entree);
  assert.equal(entree.cle, 'hud.debarquer_unite', 'l’entrée nomme son passager');
  assert.equal(entree.passager, passager.id);

  c.choisirSuite('debarquer', passager.id);
  assert.equal(c.phase, 'cible');
  const d = c.vue.debarquement;
  assert.ok(d);
  assert.equal(d.transportId, transport.id);
  assert.equal(d.passager, passager.id);
  assert.equal(d.cases.length, 4, 'quatre voisines libres en plaine');
  assert.ok(d.case, 'la première case est pointée d’office : Entrée suffit');
  assert.deepEqual(d.choisis, []);
  const vertes = c.vue.surbrillances.filter((s) => s.genre === 'deplacement');
  assert.equal(vertes.length, 4, 'là où il va : le vert du déplacement');
  assert.equal(c.vue.surbrillances.filter((s) => s.genre === 'attaque').length, 0);
  assert.equal(c.vue.visee, null, 'ce n’est pas une visée de tir');

  // Une autre case : le premier appui pointe, le second confirme.
  const cible = d.cases[3]!;
  c.clicCase(cible);
  assert.equal(c.phase, 'cible', 'pointer n’est pas poser');
  assert.deepEqual(c.vue.debarquement?.case, cible);
  c.clicCase(cible);
  assert.equal(c.phase, 'inactif', 'un seul passager : l’ordre part');
  const pose = uniteParId(c.etat, passager.id);
  assert.ok(pose);
  assert.deepEqual({ x: pose.x, y: pose.y }, cible);
  assert.equal(pose.dansTransport, null);
  assert.equal(uniteParId(c.etat, transport.id)?.cargo.length, 0);
});

test('deux passagers : on choisit qui, puis où, puis « débarquer aussi » ou « terminer » — et un seul ordre part', () => {
  const { etat, cat } = partieCatalogue6();
  const transport = etat.unites.find((u) => u.type === 'transport');
  const inf = etat.unites.find((u) => u.type === 'infanterie' && u.camp === 0);
  const meca = etat.unites.find((u) => u.type === 'meca');
  assert.ok(transport && inf && meca);
  embarquer(transport, inf);
  embarquer(transport, meca);
  const c = new Controleur({ etat, catalogue: cat, camp: 0 });
  // Le transport avance d'une case vers l'est, puis vide sa cale.
  c.clicCase({ x: transport.x, y: transport.y });
  c.clicCase({ x: 3, y: 1 });
  assert.equal(c.phase, 'action');
  const entrees = c.vue.menu?.options.filter((o) => o.id === 'debarquer') ?? [];
  assert.deepEqual(entrees.map((o) => o.passager), [inf.id, meca.id], 'une entrée par passager, dans l’ordre de la cale');
  const rangs = (c.vue.menu?.options ?? []).map((o) => SUITES_MENU.indexOf(o.id as typeof SUITES_MENU[number]));
  assert.deepEqual([...rangs].sort((a, b) => a - b), rangs, 'les deux entrées tiennent la place fixe de « débarquer »');

  // Le méca d'abord : c'est le joueur qui choisit qui descend.
  c.choisirSuite('debarquer', meca.id);
  assert.equal(c.phase, 'cible');
  assert.equal(c.vue.debarquement?.passager, meca.id);
  const premiere = c.vue.debarquement?.case;
  assert.ok(premiere);
  assert.ok(c.vue.debarquement?.cases.some((v) => v.x === 2 && v.y === 1), 'la case que le transport quitte est offerte');
  c.clicCase(premiere);
  assert.equal(c.phase, 'action', 'il reste un passager et une case : le menu revient');
  assert.deepEqual(c.vue.menu?.options.map((o) => o.id), ['debarquer', 'terminer']);
  assert.equal(c.vue.menu?.options[0]?.cle, 'hud.debarquer_aussi');
  assert.equal(c.vue.menu?.options[0]?.passager, inf.id);
  assert.deepEqual(c.vue.debarquement?.choisis, [{ vers: premiere, passager: meca.id }]);
  assert.equal(c.vue.debarquement?.passager, null);
  assert.equal(empreinte(c.etat), empreinte(etat), 'rien n’est encore parti');

  c.choisirSuite('debarquer', inf.id);
  assert.equal(c.phase, 'cible');
  const cases = c.vue.debarquement?.cases ?? [];
  assert.equal(cases.length, 3, 'la case du premier n’est plus offerte');
  assert.ok(!cases.some((v) => v.x === premiere.x && v.y === premiere.y));
  const seconde = cases[1]!;
  c.poserCurseur(seconde);
  assert.deepEqual(c.vue.debarquement?.case, seconde, 'le survol pointe');
  c.clicCase(seconde);
  assert.equal(c.phase, 'inactif');

  // Un seul ordre : le transport a bougé, la cale est vide, chacun sur sa case.
  const t = uniteParId(c.etat, transport.id);
  assert.ok(t);
  assert.deepEqual({ x: t.x, y: t.y }, { x: 3, y: 1 });
  assert.deepEqual(t.cargo, []);
  assert.equal(t.etat, 'agi');
  const m = uniteParId(c.etat, meca.id);
  const i = uniteParId(c.etat, inf.id);
  assert.ok(m && i);
  assert.deepEqual({ x: m.x, y: m.y }, premiere);
  assert.deepEqual({ x: i.x, y: i.y }, seconde);
  assert.equal(m.dansTransport, null);
  assert.equal(i.dansTransport, null);
  assert.equal(m.etat, 'agi');
  assert.equal(i.etat, 'agi');
});

test('« terminer » après un premier passager pose celui-là seul ; annuler à chaque étape ne pose rien', () => {
  const { etat, cat } = partieCatalogue6();
  const transport = etat.unites.find((u) => u.type === 'transport');
  const inf = etat.unites.find((u) => u.type === 'infanterie' && u.camp === 0);
  const meca = etat.unites.find((u) => u.type === 'meca');
  assert.ok(transport && inf && meca);
  embarquer(transport, inf);
  embarquer(transport, meca);
  const c = new Controleur({ etat, catalogue: cat, camp: 0 });

  // Annuler depuis le choix de la case : retour au choix de destination, rien de choisi.
  ouvrirMenuSurPlace(c, transport);
  c.choisirSuite('debarquer');
  assert.equal(c.phase, 'cible');
  assert.equal(c.vue.debarquement?.passager, inf.id, 'sans passager nommé, le premier de la cale');
  c.annuler();
  assert.equal(c.phase, 'selection');
  assert.equal(c.vue.debarquement, null);
  assert.ok(c.vue.surbrillances.some((s) => s.genre === 'deplacement'), 'les arrivées du transport reviennent');

  // Un clic hors des cases offertes annule aussi.
  c.clicCase({ x: transport.x, y: transport.y });
  c.choisirSuite('debarquer', meca.id);
  assert.equal(c.phase, 'cible');
  c.clicCase({ x: 4, y: 0 });
  assert.equal(c.phase, 'selection');
  assert.equal(c.vue.debarquement, null);

  // Après une première case, Échap oublie ce qui était composé.
  c.clicCase({ x: transport.x, y: transport.y });
  c.choisirSuite('debarquer', meca.id);
  // Une vue fraîche à chaque lecture : TypeScript a rétréci `c.vue.debarquement`
  // à `null` sur l'assertion d'au-dessus, et ne sait pas qu'un clic l'a rouvert.
  const vue1 = c.vue;
  const case1 = vue1.debarquement?.case;
  assert.ok(case1);
  c.clicCase(case1);
  assert.equal(c.phase, 'action');
  c.annuler();
  assert.equal(c.phase, 'selection');
  assert.equal(c.vue.debarquement, null);
  assert.equal(empreinte(c.etat), empreinte(etat), 'rien n’est parti');

  // « Terminer » : le premier passager descend, le second reste à bord.
  c.clicCase({ x: transport.x, y: transport.y });
  c.choisirSuite('debarquer', meca.id);
  const vue2 = c.vue;
  const case2 = vue2.debarquement?.case;
  assert.ok(case2);
  c.clicCase(case2);
  assert.equal(c.phase, 'action');
  c.choisirSuite('terminer');
  assert.equal(c.phase, 'inactif');
  const t = uniteParId(c.etat, transport.id);
  assert.deepEqual(t?.cargo, [inf.id], 'le fantassin est resté à bord');
  const m = uniteParId(c.etat, meca.id);
  assert.deepEqual({ x: m?.x, y: m?.y }, case2);
  assert.equal(uniteParId(c.etat, inf.id)?.dansTransport, transport.id);
});

test('le chemin pointé dit ce qu’il coûte, et rien tant qu’on n’a pas bougé', () => {
  const etat = partie();
  const c = controleur(etat);
  const unite = etat.unites.find((u) => u.camp === 0 && u.etat === 'prete');
  assert.ok(unite);
  // On passe par une variable plutôt que d'écrire `assert.equal(c.vue.cheminCout,
  // null)` : sous `node:assert/strict`, `equal` **est** `strictEqual`, dont la
  // signature restreint le chemin de propriété à `null` pour tout le reste du
  // test — la lecture d'après serait typée `never`.
  const inactif = c.vue.cheminCout;
  assert.equal(inactif, null, 'hors phase de chemin, rien à dire');

  c.clicCase({ x: unite.x, y: unite.y });
  assert.equal(c.phase, 'selection');
  // Sur sa propre case, « 0 sur 6 » n'apprend rien : le chemin fait une case.
  const surPlace = c.vue.cheminCout;
  assert.equal(surPlace, null, 'pas de chemin, pas de budget');

  // On pointe une voisine atteignable : le coût vient de la portée du moteur.
  const voisine = c.vue.surbrillances
    .filter((s) => s.genre === 'deplacement')
    .map((s) => s.case)
    .find((k) => k.x !== unite.x || k.y !== unite.y);
  assert.ok(voisine, 'l’unité a au moins une arrivée');
  c.poserCurseur(voisine);
  const budget = c.vue.cheminCout;
  assert.ok(budget, 'un chemin pointé a un coût');
  assert.ok(budget.cout > 0 && budget.cout <= budget.max,
    `coût ${budget.cout} dans le budget ${budget.max}`);
});

test('« unité suivante » parcourt les unités qui n’ont pas joué, en cycle et sans en sauter', () => {
  const etat = partie();
  const c = controleur(etat);
  c.attendre(false);
  const jouables = etat.unites.filter(
    (u) => u.camp === 0 && !u.dansTransport && (u.etat === 'prete' || u.etat === 'deplacee'),
  );
  assert.ok(jouables.length >= 2, 'la carte de test en pose plusieurs');

  // Un tour complet du cycle passe par chacune, une fois.
  const vues = new Set<string>();
  for (let i = 0; i < jouables.length; i += 1) {
    const ou = c.uniteSuivante();
    assert.ok(ou, 'le cycle rend toujours une case');
    const dessus = etat.unites.find((u) => u.x === ou.x && u.y === ou.y && !u.dansTransport);
    assert.ok(dessus);
    vues.add(dessus.id);
  }
  assert.equal(vues.size, jouables.length, 'aucune unité sautée, aucune vue deux fois');
  // Et il boucle : après la dernière, on revient à la première.
  const retour = c.uniteSuivante();
  assert.ok(retour);
  assert.equal(c.vue.selection, jouables[0]?.id ?? null);
});


test('une autre armée alliée se consulte sans ordres ni menaces rouges', () => {
  const etat = partie();
  etat.reglages.equipes = [[0, 1]];
  const alliee = etat.unites.find((u) => u.camp === 1)!;
  const c = controleur(etat);
  const avant = empreinte(etat);
  c.clicCase(alliee);
  assert.equal(c.vue.inspection, alliee.id);
  assert.equal(c.vue.selection, null);
  assert.equal(c.phase, 'inactif');
  assert.equal(c.vue.surbrillances.length, 0);
  assert.equal(empreinte(etat), avant, 'consulter une alliée ne joue pas son tour');
});

// ---------------------------------------------------------------------------
// La visée d'un pouvoir qui demande une case (familles de la faction)
// ---------------------------------------------------------------------------

/** Un commandant de la faction dont le super est une frappe de zone (rayon 2) et le normal une impulsion (rayon 1). */
const COMMANDANT_FACTION: CommandantMoteur = {
  cle: 'cmd_test_faction',
  nom: 'Test',
  passif: null,
  pouvoir: { nom: 'Impulsion', barres: 3, duree: 'ce_tour', effets: [{ cible: 'terrain', iem: { rayon: 1, abattre: false } }] },
  superPouvoir: { nom: 'Grêle', barres: 8, duree: 'ce_tour', effets: [{ cible: 'terrain', frappe: { pv: 2, rayon: 2 } }] },
};

/** Un commandant national dont le super ne demande aucune case. */
const COMMANDANT_SOIN: CommandantMoteur = {
  cle: 'cmd_test_soin',
  nom: 'Test',
  passif: null,
  pouvoir: { nom: 'Soin', barres: 3, duree: 'ce_tour', effets: [{ cible: 'mes_unites', modificateur: { quoi: 'soin', valeur: 2 } }] },
  superPouvoir: { nom: 'Soin', barres: 8, duree: 'ce_tour', effets: [{ cible: 'mes_unites', modificateur: { quoi: 'soin', valeur: 3 } }] },
};

/** Le camp 0 est la faction, jauge pleine ; deux adverses en (5,1) et (6,1), une mienne en (3,1). */
function partieFaction(faction = true, commandant = COMMANDANT_FACTION): { etat: EtatPartie; c: Controleur; actions: Action[] } {
  const scene = scenePersonnalisee(['HPPPPPPP', 'PPPPPPPP', 'PPPPPPPH'], { '0,0': 0, '7,2': 1 }, [
    { camp: 0, type: 'infanterie', x: 1, y: 0 },
    { camp: 0, type: 'char_leger', x: 3, y: 1 },
    { camp: 1, type: 'char_leger', x: 5, y: 1 },
    { camp: 1, type: 'infanterie', x: 6, y: 1 },
  ], faction ? { factionsParCamp: { 0: 'atl' } } : {});
  const etat = creerPartie(scene, CAT, 'visee');
  etat.camps[0]!.jauge = 900;
  etat.camps[0]!.jaugeMax = 900;
  const actions: Action[] = [];
  const c = new Controleur({
    etat, catalogue: CAT, camp: 0, commandants: [commandant, null],
    ecouteur: { surAction: (a) => actions.push(a) },
  });
  return { etat, c, actions };
}

test('un pouvoir qui demande une case ouvre la visée : rayon en danger autour du curseur, rien de joué', () => {
  const { c, actions } = partieFaction();
  c.poserCurseur({ x: 5, y: 1 });
  c.jouerPouvoir('super');
  assert.equal(c.phase, 'pouvoir');
  assert.equal(actions.length, 0, 'la jauge est intacte : rien n’est parti');
  const v = c.vue;
  assert.ok(v.viseePouvoir);
  assert.equal(v.viseePouvoir.niveau, 'super');
  assert.equal(v.viseePouvoir.rayon, 2);
  assert.deepEqual(v.viseePouvoir.centre, { x: 5, y: 1 }, 'la case pointée part du curseur');
  const danger = v.surbrillances.filter((s) => s.genre === 'danger');
  assert.equal(v.surbrillances.length, danger.length, 'le gabarit ne se dit qu’en danger');
  // Treize cases à rayon 2, moins les deux pointes qui sortent d'une carte de trois lignes (y = −1, y = 3).
  assert.equal(danger.length, 13 - 2);
  assert.ok(danger.every((s) => Math.abs(s.case.x - 5) + Math.abs(s.case.y - 1) <= 2));
  // Le bilan est celui du moteur : les deux adverses et le char du joueur (3,1) sont à deux pas ou moins.
  const touchees = v.viseePouvoir.bilan?.touchees ?? [];
  assert.equal(touchees.length, 3);
});

test('le survol déplace le rayon et le bilan ; un clic sur la case pointée confirme avec la case', () => {
  const { etat, c, actions } = partieFaction();
  c.poserCurseur({ x: 1, y: 2 });
  c.jouerPouvoir('super');
  c.poserCurseur({ x: 6, y: 1 });
  assert.deepEqual(c.vue.viseePouvoir?.centre, { x: 6, y: 1 });
  assert.equal(c.vue.viseePouvoir?.bilan?.touchees?.length, 2, 'à (6,1), seuls les deux adverses sont dans le rayon');
  c.clicCase({ x: 6, y: 1 });
  assert.equal(actions.length, 1);
  assert.deepEqual(actions[0], { type: 'pouvoir', niveau: 'super', cases: [{ x: 6, y: 1 }] });
  assert.equal(c.phase, 'inactif');
  assert.equal(c.vue.viseePouvoir, null);
  assert.ok(c.etat.camps[0]!.jauge < 900, 'la jauge a été payée');
  assert.ok(c.etat.unites.find((u) => u.x === 5 && u.y === 1)!.pv < 100, 'le char adverse a encaissé');
  assert.equal(etat.camps[0]!.jauge, 900, 'l’état d’origine n’a pas été muté');
});

test('au doigt : le premier appui pointe, le second confirme ; Échap ou le bouton annulent sans rien dépenser', () => {
  const { c, actions } = partieFaction();
  c.poserCurseur({ x: 1, y: 2 });
  c.jouerPouvoir('super');
  // Un appui ailleurs que sur la case pointée ne fait que pointer.
  c.clicCase({ x: 5, y: 1 });
  assert.equal(c.phase, 'pouvoir');
  assert.equal(actions.length, 0);
  assert.deepEqual(c.vue.viseePouvoir?.centre, { x: 5, y: 1 });
  // Échap referme la visée, la jauge est intacte.
  c.annuler();
  assert.equal(c.phase, 'inactif');
  assert.equal(c.vue.viseePouvoir, null);
  assert.equal(c.etat.camps[0]!.jauge, 900);
  // Un second appui sur le bouton pendant la visée l'annule aussi. (Les vues
  // passent par des variables : `assert.equal` restreint le chemin de propriété.)
  c.jouerPouvoir('normal');
  const normale = c.vue;
  assert.equal(normale.phase, 'pouvoir');
  assert.equal(normale.viseePouvoir?.rayon, 1, 'l’impulsion du pouvoir normal a son propre rayon');
  c.jouerPouvoir('normal');
  assert.equal(c.vue.phase, 'inactif');
  assert.equal(actions.length, 0);
  // Au clavier : le curseur pointe, la touche « valider » confirme.
  c.jouerPouvoir('normal');
  c.bougerCurseur(1, 0);
  const clavier = c.vue;
  assert.deepEqual(clavier.viseePouvoir?.centre, clavier.curseur);
  c.valider();
  assert.equal(actions.length, 1);
  assert.equal(actions[0]?.type, 'pouvoir');
});

test('un pouvoir sans case part tout de suite, comme avant', () => {
  const { c, actions } = partieFaction(false, COMMANDANT_SOIN);
  c.jouerPouvoir('super');
  assert.equal(c.phase, 'inactif');
  assert.deepEqual(actions, [{ type: 'pouvoir', niveau: 'super' }]);
});

test('une jauge insuffisante n’ouvre pas de visée : le refus du moteur est annoncé', () => {
  const { etat, actions } = partieFaction();
  etat.camps[0]!.jauge = 100;
  const refus: string[] = [];
  const c = new Controleur({
    etat, catalogue: CAT, camp: 0, commandants: [COMMANDANT_FACTION, null],
    ecouteur: { surAction: (a) => actions.push(a), surRefus: (_a, m) => refus.push(m) },
  });
  c.jouerPouvoir('super');
  assert.equal(c.phase, 'inactif');
  assert.deepEqual(refus, ['jauge_insuffisante']);
  assert.equal(actions.length, 0);
});
