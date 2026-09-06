// Le banc d'essai de l'atelier : la carte-catalogue doit être une vraie carte,
// et les gestes rejoués de vrais événements. Aucun DOM, aucun WebGL — ce
// fichier est pur, il se vérifie comme du moteur.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogue, cleCase, creerPartie, sceneDepuis, type EtatPartie } from '../../src/engine/index';
import { validerMapDef, validerScenario, CARACTERE_PAR_TERRAIN, CLES_TERRAIN, BASES_SILHOUETTE, type CleTerrain } from '../../src/schemas/index';
import {
  BASES_JAMAIS_VUES, CHEMIN_BANC, GENRES_SURBRILLANCE, GESTES_BANC, HAUTEUR_BANC, VILLE_DESAFFECTEE_BANC,
  LARGEUR_BANC, RANGS, UNITES_BANC, VERSION_CATALOGUE_BANC, carteBanc, catalogueSilhouettes,
  rejouer, scenarioBanc, surbrillancesBanc, visiblesBanc,
} from '../../src/app/atelier/banc';
import scenarioDemo from '../../content/scenarios/demo.json';

const CAT = chargerCatalogue(VERSION_CATALOGUE_BANC);

function etatBanc(): EtatPartie {
  const s = validerScenario(scenarioDemo);
  if (!s.ok) throw new Error('scénario de démonstration invalide');
  return creerPartie(sceneDepuis(scenarioBanc(s.valeur), carteBanc(), []), CAT, 'banc:1');
}

test('le banc force le catalogue qui porte toutes ses unités', () => {
  // Le scénario de démonstration, celui que l'atelier prête au banc, est en
  // catalogue 1 : dix unités, pas de génie. Sans ce forçage, le banc montait
  // sans broncher une carte à laquelle il manquait une unité.
  const s = validerScenario(scenarioDemo);
  if (!s.ok) throw new Error('scénario de démonstration invalide');
  assert.equal(scenarioBanc(s.valeur).catalogueVersion, VERSION_CATALOGUE_BANC);
  const maigre = chargerCatalogue(1);
  const manquantes = UNITES_BANC.filter((u) => !maigre.unites[u]);
  assert.ok(manquantes.length > 0, 'si le catalogue 1 suffisait, ce forçage serait inutile');
  // Et le catalogue forcé, lui, les porte toutes.
  const complet = chargerCatalogue(VERSION_CATALOGUE_BANC);
  for (const u of UNITES_BANC) assert.ok(complet.unites[u], `unité absente du catalogue du banc : ${u}`);
});

test('l’état du banc porte bien les vingt-huit unités posées', () => {
  const e = etatBanc();
  assert.equal(e.unites.length, UNITES_BANC.length * 2, 'une unité perdue au montage');
  for (const camp of [0, 1] as const) {
    const types = e.unites.filter((u) => u.camp === camp).map((u) => u.type).sort();
    assert.deepEqual(types, [...UNITES_BANC].sort(), `camp ${camp}`);
  }
});

test('la carte-catalogue est une carte valide, pas un objet bricolé', () => {
  const r = validerMapDef(carteBanc());
  assert.ok(r.ok, `carte du banc invalide : ${JSON.stringify(r.ok ? [] : r.erreurs)}`);
});

test('elle pose les douze terrains du canon, aucun oublié', () => {
  const carte = carteBanc();
  const vus = new Set<CleTerrain>();
  for (const ligne of carte.grille) {
    for (const car of ligne) {
      const cle = CAT.parCaractere[car];
      if (cle) vus.add(cle);
    }
  }
  // C'est tout l'objet du banc : une carte de mission ne montre jamais les
  // douze, on attend qu'ils apparaissent et un défaut se découvre en jouant.
  for (const t of CLES_TERRAIN) {
    assert.ok(vus.has(t), `terrain jamais montré par le banc : ${t} (${CARACTERE_PAR_TERRAIN[t]})`);
  }
});

test('elle pose les quatorze unités, dans les deux camps, sur des cases distinctes', () => {
  const carte = carteBanc();
  assert.deepEqual([...UNITES_BANC].sort(), Object.keys(CAT.unites).sort());
  for (const camp of [0, 1] as const) {
    const duCamp = carte.unitesDepart.filter((u) => u.camp === camp);
    assert.equal(duCamp.length, UNITES_BANC.length, `camp ${camp}`);
    assert.deepEqual([...duCamp].map((u) => u.type).sort(), [...UNITES_BANC].sort());
  }
  const cases = carte.unitesDepart.map((u) => cleCase(u));
  assert.equal(new Set(cases).size, cases.length, 'deux unités sur la même case');
  // Elles se posent sur de la plaine : une carte de banc n'a pas à être jouable,
  // mais un char au fond de la mer ne dit rien de son rendu.
  for (const u of carte.unitesDepart) {
    assert.equal(carte.grille[u.y]?.[u.x], 'P', `unité ${u.type} hors plaine`);
  }
});

test('les quatre bâtiments sont montrés pris par chaque camp et neutres', () => {
  const carte = carteBanc();
  const rang = carte.grille[RANGS.batiments]!;
  for (const [x, attendu] of [[0, 0], [1, 1], [3, 0], [4, 1], [6, 0], [7, 1], [9, 0], [10, 1]] as const) {
    assert.equal(carte.proprietaires[cleCase({ x, y: RANGS.batiments })], attendu, `bâtiment en ${x}`);
  }
  // Un bâtiment neutre ne se peint pas comme un bâtiment pris : il en faut.
  for (const x of [2, 5, 8]) {
    assert.equal(carte.proprietaires[cleCase({ x, y: RANGS.batiments })], undefined, `case ${x} devrait être neutre`);
    assert.ok(['C', 'U', 'A'].includes(rang[x]!), `case ${x} devrait être capturable`);
  }
  // Et le cas qui a réellement cassé : un bâtiment encastré entre deux montagnes.
  const encastres = carte.grille[RANGS.batimentsEnMontagne]!;
  assert.ok(['C', 'U', 'A'].some((c, i) => encastres[1 + i * 2] === c), 'le rang des bâtiments en montagne a bougé');
  assert.equal(encastres[0], 'M');
  assert.equal(encastres[2], 'M');
});

test('les silhouettes jamais vues apparaissent, sans toucher au canon', () => {
  const truque = catalogueSilhouettes(CAT);
  for (const [cle, base] of Object.entries(BASES_JAMAIS_VUES)) {
    assert.ok(BASES_SILHOUETTE.includes(base), `${base} n’est pas une base connue`);
    assert.equal(truque.unites[cle as keyof typeof truque.unites]?.silhouette.base, base);
    // Le canon reste la vérité : la copie ne le mute pas.
    assert.notEqual(CAT.unites[cle as keyof typeof CAT.unites]?.silhouette.base, base);
  }
  // Les sept bases du schéma sont alors toutes portées par quelque chose.
  const portees = new Set(Object.values(truque.unites).map((u) => u.silhouette.base));
  for (const b of BASES_SILHOUETTE) assert.ok(portees.has(b), `base jamais rendue : ${b}`);
});

test('les cinq surbrillances se posent en bandes, sans se marcher dessus', () => {
  const toutes = surbrillancesBanc(GENRES_SURBRILLANCE);
  assert.equal(new Set(toutes.map((s) => s.genre)).size, 5);
  const parCase = new Map<string, string>();
  for (const s of toutes) {
    const k = cleCase(s.case);
    assert.equal(parCase.get(k), undefined, `deux genres sur ${k}`);
    parCase.set(k, s.genre);
    assert.ok(s.case.x >= 0 && s.case.x < LARGEUR_BANC && s.case.y >= 0 && s.case.y < HAUTEUR_BANC);
  }
  // Filtrer par genre ne rend que ce genre : c'est ce que fait l'interface.
  assert.ok(surbrillancesBanc(['attaque']).every((s) => s.genre === 'attaque'));
  assert.equal(surbrillancesBanc([]).length, 0);
});

test('le chemin de démonstration est continu et coudé deux fois', () => {
  let coudes = 0;
  for (let i = 1; i < CHEMIN_BANC.length; i += 1) {
    const a = CHEMIN_BANC[i - 1]!;
    const b = CHEMIN_BANC[i]!;
    assert.equal(Math.abs(a.x - b.x) + Math.abs(a.y - b.y), 1, `pas ${i} : un seul cran orthogonal`);
    if (i >= 2) {
      const z = CHEMIN_BANC[i - 2]!;
      if ((z.x === a.x) !== (a.x === b.x)) coudes += 1;
    }
  }
  // Un coude unique ne dit pas si la flèche sait tourner deux fois.
  assert.equal(coudes, 2, `${coudes} coude(s), deux attendus`);
});

test('le brouillard cache la moitié droite et rien d’autre', () => {
  const vues = visiblesBanc();
  assert.ok(vues.has(cleCase({ x: 0, y: 0 })));
  assert.ok(!vues.has(cleCase({ x: LARGEUR_BANC - 1, y: 0 })));
  assert.equal(vues.size, (LARGEUR_BANC / 2) * HAUTEUR_BANC);
});

test('chaque geste rend un état d’après cohérent avec ses événements', () => {
  const depart = etatBanc();
  for (const geste of GESTES_BANC) {
    const r = rejouer(depart, geste);
    assert.ok(r, `geste sans effet : ${geste}`);
    assert.ok(r.evenements.length > 0, `${geste} n’émet aucun événement`);
    // L'état de départ n'est jamais muté : le banc compose, il n'applique pas.
    assert.equal(depart.unites.length, etatBanc().unites.length);
  }

  const bouge = rejouer(depart, 'deplacement')!;
  const evt = bouge.evenements[0]!;
  assert.equal(evt.type, 'deplacement');
  if (evt.type === 'deplacement') {
    const arrivee = evt.chemin[evt.chemin.length - 1]!;
    assert.deepEqual(evt.vers, arrivee, 'la flèche doit finir là où l’unité finit');
    const apres = bouge.apres.unites.find((u) => u.id === evt.uniteId)!;
    assert.deepEqual({ x: apres.x, y: apres.y }, arrivee, 'l’état d’après doit suivre le chemin');
  }

  const tir = rejouer(depart, 'attaque')!;
  const cible = tir.evenements[0]!;
  if (cible.type === 'attaque') {
    const cibleAvant = depart.unites.find((u) => u.id === cible.cibleId)!;
    const cibleApres = tir.apres.unites.find((u) => u.id === cible.cibleId)!;
    assert.equal(cibleAvant.pv - cibleApres.pv, cible.degats);
    // Une riposte ne tue jamais l'attaquant sur le banc : on veut pouvoir
    // rejouer le geste, pas nettoyer la carte à chaque essai.
    assert.ok(tir.apres.unites.find((u) => u.id === cible.attaquantId)!.pv > 0);
  }

  const prise = rejouer(depart, 'capture')!;
  const ville = prise.evenements[0]!;
  assert.equal(ville.type, 'capture');
  if (ville.type === 'capture') {
    // La ville part tenue par l'autre camp : c'est ce qui fait voir l'ancien
    // drapeau qu'on amène avant de hisser le nouveau.
    assert.equal(depart.proprietaires[cleCase(ville.case)], 1, 'la ville doit partir tenue par le camp 1');
    assert.equal(ville.camp, 0);
    assert.ok(ville.acquis);
    assert.equal(prise.apres.proprietaires[cleCase(ville.case)], 0);
    const capteur = prise.apres.unites.find((u) => u.id === ville.uniteId)!;
    assert.deepEqual({ x: capteur.x, y: capteur.y }, ville.case, 'le capteur est posé sur la ville');
    // Rejoué depuis l'état d'après, le geste rend la ville au camp 1 : il se rejoue sans fin.
    const reprise = rejouer(prise.apres, 'capture')!;
    assert.equal(reprise.apres.proprietaires[cleCase(ville.case)], 1);
  }

  const entamee = rejouer(depart, 'capture_en_cours')!;
  const debut = entamee.evenements[0]!;
  if (debut.type === 'capture') {
    assert.ok(!debut.acquis);
    assert.ok(debut.points > 0 && debut.points < 20, 'une capture entamée est entre zéro et le seuil');
    assert.equal(entamee.apres.proprietaires[cleCase(debut.case)], 1, 'la ville ne change pas encore de mains');
    const capteur = entamee.apres.unites.find((u) => u.id === debut.uniteId)!;
    assert.equal(capteur.pointsCapture, debut.points, 'l’état porte la progression, le drapeau la lit');
    // Achever la capture entamée : le capteur déjà posé est celui qui la finit.
    const finie = rejouer(entamee.apres, 'capture')!;
    const fin = finie.evenements[0]!;
    if (fin.type === 'capture') assert.equal(fin.uniteId, debut.uniteId);
  }

  const perdue = rejouer(depart, 'hors_jeu')!;
  assert.equal(perdue.apres.unites.length, depart.unites.length - 1);

  // La remise en service : la carte porte une ville désaffectée, le moteur
  // émet la remise **puis** la capture, et le geste se rejoue en refermant.
  const cleDesaffectee = cleCase(VILLE_DESAFFECTEE_BANC);
  assert.ok(depart.desaffectes.includes(cleDesaffectee), 'le banc part avec une ville désaffectée');
  assert.equal(depart.proprietaires[cleDesaffectee], undefined, 'désaffectée, donc neutre');
  const remise = rejouer(depart, 'remise_en_service')!;
  assert.deepEqual(remise.evenements.map((e) => e.type), ['remise_en_service', 'capture']);
  assert.ok(!remise.apres.desaffectes.includes(cleDesaffectee));
  assert.equal(remise.apres.proprietaires[cleDesaffectee], 0);
  const capture = remise.evenements[1]!;
  if (capture.type === 'capture') assert.equal(capture.points, 40, 'un bâtiment désaffecté se prend à quarante');
  const refermee = rejouer(remise.apres, 'remise_en_service')!;
  assert.ok(refermee.apres.desaffectes.includes(cleDesaffectee), 'rejoué, le geste referme la ville');
  assert.equal(refermee.apres.proprietaires[cleDesaffectee], undefined);
  assert.equal(refermee.evenements.length, 0);
});

test('« Déplacer » fait jouer l’unité, et « Fin de tour » la réveille', () => {
  const depart = etatBanc();
  const bouge = rejouer(depart, 'deplacement')!;
  const evt = bouge.evenements[0]!;
  assert.equal(evt.type, 'deplacement');
  if (evt.type !== 'deplacement') return;
  const deplacee = bouge.apres.unites.find((u) => u.id === evt.uniteId)!;
  assert.equal(deplacee.camp, bouge.apres.campCourant, 'c’est une unité du camp qui joue : elle se ternira');
  assert.equal(deplacee.etat, 'agi', 'elle se lit comme « a joué »');
  assert.ok(bouge.apres.unites.filter((u) => u.id !== evt.uniteId).every((u) => u.etat === 'prete'), 'les autres restent prêtes');

  const fin = rejouer(bouge.apres, 'fin_de_tour')!;
  assert.deepEqual(fin.evenements, [{ type: 'fin_tour', camp: bouge.apres.campCourant }]);
  assert.equal(fin.apres.campCourant, bouge.apres.campCourant, 'le camp ne change pas : on veut revoir les mêmes pièces');
  assert.ok(fin.apres.unites.every((u) => u.etat === 'prete'), 'toutes réveillées');
});

test('la marée réécrit le sol, et la marée basse défait la haute', () => {
  const depart = etatBanc();
  const haute = rejouer(depart, 'maree_haute')!;
  assert.notDeepEqual(haute.apres.grille, depart.grille, 'la marée haute doit changer la grille');
  assert.ok(haute.evenements.every((e) => e.type === 'terrain_pose'));
  // La signature du terrain doit bouger, sinon le rendu 3D garde son sol du
  // premier jour — c'est exactement le gel qu'on a corrigé.
  assert.notEqual(haute.apres.grille.join(''), depart.grille.join(''));

  const basse = rejouer(haute.apres, 'maree_basse')!;
  assert.ok(basse.evenements.every((e) => e.type === 'terrain_retire'));
  assert.notDeepEqual(basse.apres.grille, haute.apres.grille);
});
