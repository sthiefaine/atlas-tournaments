// Le banc d'essai de l'atelier : la carte-catalogue doit être une vraie carte,
// et les gestes rejoués de vrais événements. Aucun DOM, aucun WebGL — ce
// fichier est pur, il se vérifie comme du moteur.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  brouilleParCamp, chargerCatalogue, cleCase, creerPartie, estBrouillee, meteoPossible, sceneDepuis, type EtatPartie,
} from '../../src/engine/index';
import {
  validerMapDef, validerScenario, BIOMES, CARACTERE_PAR_TERRAIN, CLES_TERRAIN, CLIMATS, BASES_SILHOUETTE, PHASES_JOUR,
  type Case, type CleTerrain, type CleUnite,
} from '../../src/schemas/index';
import {
  BASES_JAMAIS_VUES, CHEMIN_BANC, DESCRIPTIONS_GESTES, GENRES_SURBRILLANCE, GESTES_BANC, GRAINE_GRANDE, HAUTEUR_BANC,
  HAUTEUR_GRANDE, LARGEUR_GRANDE, PARAMETRES_GRANDE, PORTS_BANC, PRESETS_AMBIANCE, STATION_ADVERSE_BANC,
  UNITES_GRANDE, UNITES_NAVALES_BANC, VILLE_DESAFFECTEE_BANC,
  LARGEUR_BANC, RANGS, UNITES_BANC, VERSION_CATALOGUE_BANC, carteBanc, carteGrande, catalogueSilhouettes, decoderVue,
  encoderVue, rejouer, scenarioBanc, surbrillancesBanc, visiblesBanc, type VueBanc,
} from '../../src/app/atelier/banc';
import { genererCarte } from '../../src/mapgen/index';
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

test('l’état du banc porte bien les quarante-six unités posées', () => {
  const e = etatBanc();
  assert.equal(e.unites.length, UNITES_BANC.length * 2, 'une unité perdue au montage');
  for (const camp of [0, 1] as const) {
    const types = e.unites.filter((u) => u.camp === camp).map((u) => u.type).sort();
    assert.deepEqual(types, [...UNITES_BANC].sort(), `camp ${camp}`);
  }
});

// Au catalogue 5, la carte-catalogue pose vingt-trois unités par camp, soit
// quarante-six. `validerMapDef` plafonne `unitesDepart` à quarante
// (`src/schemas/valider.ts`, `doc/03-schemas.md` §5) : ce plafond a été écrit
// pour une carte de mission, pas pour un catalogue, et il doit monter à soixante
// — c'est la seule chose qui manque pour que ce test repasse.
test('la carte-catalogue est une carte valide, pas un objet bricolé', () => {
  const r = validerMapDef(carteBanc());
  assert.ok(r.ok, `carte du banc invalide : ${JSON.stringify(r.ok ? [] : r.erreurs)}`);
});

test('elle pose les quatorze terrains du canon, aucun oublié', () => {
  const carte = carteBanc();
  const vus = new Set<CleTerrain>();
  for (const ligne of carte.grille) {
    for (const car of ligne) {
      const cle = CAT.parCaractere[car];
      if (cle) vus.add(cle);
    }
  }
  // C'est tout l'objet du banc : une carte de mission ne les montre jamais
  // tous, on attend qu'ils apparaissent et un défaut se découvre en jouant.
  for (const t of CLES_TERRAIN) {
    assert.ok(vus.has(t), `terrain jamais montré par le banc : ${t} (${CARACTERE_PAR_TERRAIN[t]})`);
  }
});

test('elle pose toutes les unités du catalogue, dans les deux camps, sur des cases distinctes', () => {
  const carte = carteBanc();
  assert.deepEqual([...UNITES_BANC].sort(), Object.keys(CAT.unites).sort());
  for (const camp of [0, 1] as const) {
    const duCamp = carte.unitesDepart.filter((u) => u.camp === camp);
    assert.equal(duCamp.length, UNITES_BANC.length, `camp ${camp}`);
    assert.deepEqual([...duCamp].map((u) => u.type).sort(), [...UNITES_BANC].sort());
  }
  const cases = carte.unitesDepart.map((u) => cleCase(u));
  assert.equal(new Set(cases).size, cases.length, 'deux unités sur la même case');
  // Chacune se pose sur un sol qui lui va : la terre nue pour ce qui roule et
  // ce qui vole, la mer pour ce qui flotte. Une carte de banc n'a pas à être
  // jouable, mais un cuirassé posé sur de l'herbe ne dit rien de son rendu.
  for (const u of carte.unitesDepart) {
    const car = carte.grille[u.y]?.[u.x];
    const attendu = UNITES_NAVALES_BANC.has(u.type) ? 'W' : 'P';
    assert.equal(car, attendu, `unité ${u.type} posée sur '${car}'`);
  }
  // La liste des navires du banc doit être exactement le domaine « mer » du
  // catalogue : une unité navale oubliée ici finirait plantée dans un pré.
  const enMer = (Object.keys(CAT.unites) as CleUnite[]).filter((u) => CAT.unites[u]!.domaine === 'mer');
  assert.deepEqual([...UNITES_NAVALES_BANC].sort(), enMer.sort());
});

test('les six bâtiments capturables sont montrés pris par chaque camp et neutres', () => {
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
  // Les trois ports de la rive, à la même règle : pris, pris, neutre — et tous
  // trois sur le bord de l'eau, sinon un quai donnerait sur un pré.
  assert.equal(PORTS_BANC.length, 3);
  const proprios = [0, 1, undefined];
  PORTS_BANC.forEach((port, i) => {
    assert.equal(carte.grille[port.y]?.[port.x], CARACTERE_PAR_TERRAIN.port, `port ${i}`);
    assert.equal(carte.proprietaires[cleCase(port)], proprios[i], `propriétaire du port ${i}`);
    assert.equal(carte.grille[port.y + 1]?.[port.x], 'W', `le port ${i} doit donner sur la mer`);
  });
  // Et le cas qui a réellement cassé : un bâtiment encastré entre deux montagnes.
  const encastres = carte.grille[RANGS.batimentsEnMontagne]!;
  assert.ok(['C', 'U', 'A'].some((c, i) => encastres[1 + i * 2] === c), 'le rang des bâtiments en montagne a bougé');
  assert.equal(encastres[0], 'M');
  assert.equal(encastres[2], 'M');
});

test('la dernière silhouette jamais vue apparaît, sans toucher au canon', () => {
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

// ---------------------------------------------------------------------------
// Descriptions, ambiances prêtes, vue dans l'adresse, gestes du catalogue 3
// ---------------------------------------------------------------------------

test('chaque geste a exactement une description, et rien ne décrit un geste inconnu', () => {
  for (const geste of GESTES_BANC) {
    const siennes = DESCRIPTIONS_GESTES.filter((d) => d.cle === geste);
    assert.equal(siennes.length, 1, `${geste} : ${siennes.length} description(s)`);
    const d = siennes[0]!;
    assert.ok(d.nom.length > 0 && d.nom.length <= 24, `${geste} : un nom court`);
    // L'aide dit ce qu'on doit voir : une phrase, pas un mot-clé.
    assert.ok(d.aide.length > 30, `${geste} : l'aide doit être une phrase`);
    assert.ok(['unites', 'batiments', 'terrain', 'tour'].includes(d.groupe));
  }
  assert.equal(DESCRIPTIONS_GESTES.length, GESTES_BANC.length);
});

test('les ambiances prêtes couvrent les dix biomes, les deux phases et au moins quatre météos', () => {
  const cles = PRESETS_AMBIANCE.map((p) => p.cle);
  assert.equal(new Set(cles).size, cles.length, 'deux presets portent la même clé');
  for (const cle of cles) assert.match(cle, /^[a-z][a-z0-9_]+$/, `clé non conforme : ${cle}`);
  const biomes = new Set(PRESETS_AMBIANCE.map((p) => p.biome));
  for (const b of BIOMES) assert.ok(biomes.has(b), `biome jamais proposé : ${b}`);
  assert.equal(new Set(PRESETS_AMBIANCE.map((p) => p.phase)).size, PHASES_JOUR.length);
  assert.ok(new Set(PRESETS_AMBIANCE.map((p) => p.meteo)).size >= 4);
  // Aucune scène impossible : la table du climat doit pouvoir la tirer quelque part.
  for (const p of PRESETS_AMBIANCE) {
    assert.ok(
      CLIMATS.some((c) => meteoPossible(c, p.saison, p.meteo)),
      `${p.cle} : ${p.meteo} en ${p.saison} ne sort dans aucun climat`,
    );
  }
});

const VUE: VueBanc = {
  monde: 3, biome: 'archipel', saison: 'automne', phase: 'nuit', meteo: 'tempete',
  paysAllie: 'jp', paysAdverse: 'nz', brouillard: true, genres: ['attaque', 'danger'],
};
const DEFAUT: VueBanc = {
  monde: 0, biome: 'plaine', saison: 'printemps', phase: 'jour', meteo: 'clair',
  paysAllie: 'fr', paysAdverse: 'lu', brouillard: false, genres: [...GENRES_SURBRILLANCE],
};

test('la vue fait l’aller-retour par l’adresse, avec ou sans « ? »', () => {
  const texte = encoderVue(VUE);
  assert.ok(!texte.startsWith('?'), 'sans le point d’interrogation');
  assert.deepEqual(decoderVue(texte, DEFAUT), VUE);
  assert.deepEqual(decoderVue(`?${texte}`, DEFAUT), VUE);
  // Sans brouillard et sans surbrillance : deux absences qui doivent survivre.
  const nue: VueBanc = { ...VUE, brouillard: false, genres: [] };
  assert.deepEqual(decoderVue(encoderVue(nue), DEFAUT), nue);
  assert.ok(!encoderVue(nue).includes('brouillard'), 'le brouillard n’est écrit que vrai');
});

test('l’ordre des clés est stable, et ce sont les clés courtes convenues', () => {
  assert.equal(
    encoderVue(VUE),
    'monde=3&biome=archipel&saison=automne&phase=nuit&meteo=tempete&bleu=jp&rouge=nz&brouillard=1&genres=attaque,danger',
  );
  assert.equal(encoderVue(VUE), encoderVue({ ...VUE }), 'deux encodages de la même vue sont identiques');
});

test('une valeur corrompue garde le défaut, clé par clé', () => {
  const corrompue = 'monde=-4&biome=lune&saison=mousson&phase=aube&meteo=grele&bleu=zz&rouge=FR&brouillard=oui&genres=attaque,laser,attaque';
  const v = decoderVue(corrompue, DEFAUT);
  assert.equal(v.monde, 0, 'un monde négatif est borné à zéro');
  assert.equal(v.biome, DEFAUT.biome);
  assert.equal(v.saison, DEFAUT.saison);
  assert.equal(v.phase, DEFAUT.phase);
  assert.equal(v.meteo, DEFAUT.meteo);
  assert.equal(v.paysAllie, DEFAUT.paysAllie);
  assert.equal(v.paysAdverse, DEFAUT.paysAdverse, 'les codes sont en minuscules, rien d’autre');
  assert.equal(v.brouillard, false);
  assert.deepEqual(v.genres, ['attaque'], 'les genres inconnus tombent, les doublons aussi');
  // Une chaîne vide ou absurde rend le défaut entier, sans lever.
  assert.deepEqual(decoderVue('', DEFAUT), DEFAUT);
  assert.deepEqual(decoderVue('?', DEFAUT), DEFAUT);
  assert.deepEqual(decoderVue('&&=&monde=abc', DEFAUT), DEFAUT);
  assert.equal(decoderVue('monde=2.9', DEFAUT).monde, 2, 'un monde est un entier');
  assert.equal(decoderVue('monde=1e400', DEFAUT).monde, DEFAUT.monde, 'l’infini n’est pas un monde');
});

test('« Brouiller » amène le brouilleur rouge sous le drone bleu, à portée', () => {
  const depart = etatBanc();
  const r = rejouer(depart, 'brouillage')!;
  assert.ok(r, 'le banc doit porter un drone et un brouilleur');
  const evt = r.evenements[0]!;
  assert.equal(evt.type, 'deplacement');
  if (evt.type !== 'deplacement') return;
  const brouilleur = r.apres.unites.find((u) => u.id === evt.uniteId)!;
  assert.equal(brouilleur.type, 'brouilleur');
  assert.equal(brouilleur.camp, 1, 'c’est l’adversaire qui brouille');
  const drone = r.apres.unites.find((u) => u.camp === 0 && u.type === 'drone')!;
  assert.equal(Math.abs(brouilleur.x - drone.x) + Math.abs(brouilleur.y - drone.y), 1, 'collé au drone');
  assert.ok(brouilleParCamp(r.apres, CAT, 1, drone), 'le drone est dans le rayon du brouilleur');
  assert.ok(estBrouillee(r.apres, CAT, drone));
  // Le chemin est continu et ne traverse aucune case occupée par une autre unité.
  const occupees = new Set(depart.unites.filter((u) => u.id !== brouilleur.id).map((u) => cleCase(u)));
  // Typé à la main : `assert.ok` est une fonction d'assertion, et le flux de
  // types tourne en rond si `a` et `b` dépendent du rétrécissement de `evt`.
  const chemin: Case[] = evt.chemin;
  for (let i = 1; i < chemin.length; i += 1) {
    const a: Case = chemin[i - 1]!;
    const b: Case = chemin[i]!;
    assert.equal(Math.abs(a.x - b.x) + Math.abs(a.y - b.y), 1, `pas ${i}`);
    assert.ok(!occupees.has(cleCase(b)), `le brouilleur traverse une unité en ${cleCase(b)}`);
  }
  // Déjà en poste, le geste n'a plus rien à rejouer.
  assert.equal(rejouer(r.apres, 'brouillage'), null);
});

test('« Abattre le drone » le fait tomber sur la station adverse et révèle la production', () => {
  const depart = etatBanc();
  assert.equal(depart.proprietaires[cleCase(STATION_ADVERSE_BANC)], 1, 'la station est au camp 1');
  assert.equal(depart.grille[STATION_ADVERSE_BANC.y]?.[STATION_ADVERSE_BANC.x], CARACTERE_PAR_TERRAIN.radar);
  const r = rejouer(depart, 'drone_abattu')!;
  assert.ok(r);
  // L'ordre est celui du moteur : le vol, le tir, la sortie, puis la lecture.
  assert.deepEqual(r.evenements.map((e) => e.type), ['deplacement', 'attaque', 'hors_jeu', 'production_revelee']);
  const [vol, tir, sortie, lecture] = r.evenements;
  if (vol?.type !== 'deplacement' || tir?.type !== 'attaque' || sortie?.type !== 'hors_jeu' || lecture?.type !== 'production_revelee') return;
  const drone = depart.unites.find((u) => u.id === vol.uniteId)!;
  assert.equal(drone.type, 'drone');
  assert.equal(drone.camp, 0, 'c’est le drone du joueur : le HUD n’annonce la révélation que pour lui');
  assert.deepEqual(vol.vers, STATION_ADVERSE_BANC);
  assert.equal(tir.cibleId, drone.id);
  assert.equal(tir.degats, drone.pv, 'le drone tombe d’un coup');
  assert.equal(tir.riposte, 0, 'un drone ne riposte pas');
  assert.equal(depart.unites.find((u) => u.id === tir.attaquantId)!.camp, 1);
  assert.equal(sortie.uniteId, drone.id);
  assert.equal(lecture.camp, 0);
  assert.equal(lecture.proprietaire, 1);
  assert.deepEqual(lecture.case, STATION_ADVERSE_BANC);
  assert.deepEqual(lecture.produites, {}, 'personne n’a rien produit sur le banc, et on ne l’invente pas');
  assert.ok(!r.apres.unites.some((u) => u.id === drone.id), 'le drone a quitté la carte');
  assert.equal(r.apres.unites.length, depart.unites.length - 1);
  // Sans drone, plus rien à abattre.
  assert.equal(rejouer(r.apres, 'drone_abattu'), null);
  // Et avec une production réelle, la lecture la rapporte, celle du camp visé seulement.
  const produit: EtatPartie = { ...depart, produites: { '1:infanterie': 2, '1:char_leger': 1, '0:recon': 5, '1:genie': 0 } };
  const lu = rejouer(produit, 'drone_abattu')!.evenements.find((e) => e.type === 'production_revelee');
  if (lu?.type === 'production_revelee') assert.deepEqual(lu.produites, { infanterie: 2, char_leger: 1 });
});

// ---------------------------------------------------------------------------
// La grande carte : celle du budget de `doc/10` §9.2
// ---------------------------------------------------------------------------

test('la grande carte fait 24 × 16, est valide, et deux constructions donnent le même état', () => {
  const carte = carteGrande();
  assert.equal(carte.largeur, LARGEUR_GRANDE);
  assert.equal(carte.hauteur, HAUTEUR_GRANDE);
  assert.equal(carte.largeur, 24);
  assert.equal(carte.hauteur, 16);
  const r = validerMapDef(carte);
  assert.ok(r.ok, `grande carte invalide : ${JSON.stringify(r.ok ? [] : r.erreurs)}`);
  // Déterminisme : la graine est fixe, la pose des unités aussi.
  assert.equal(JSON.stringify(carteGrande()), JSON.stringify(carte));
  // Et c'est bien la carte du générateur, pas une copie figée qui dériverait de lui.
  const generee = genererCarte(PARAMETRES_GRANDE, GRAINE_GRANDE);
  assert.deepEqual(carte.grille, generee.grille);
  assert.deepEqual(carte.proprietaires, generee.proprietaires);
  // L'état de partie la porte telle quelle : trente unités, rien de perdu.
  const s = validerScenario(scenarioDemo);
  if (!s.ok) throw new Error('scénario de démonstration invalide');
  const a = creerPartie(sceneDepuis(scenarioBanc(s.valeur), carte, []), CAT, 'banc:1');
  const b = creerPartie(sceneDepuis(scenarioBanc(s.valeur), carteGrande(), []), CAT, 'banc:1');
  assert.equal(a.unites.length, 30);
  assert.deepEqual(a, b);
});

test('elle approche les hypothèses du budget : ≈ 30 % de forêt, du relief, de l’eau, ≈ 20 bâtiments possédés', () => {
  const carte = carteGrande();
  const total = carte.largeur * carte.hauteur;
  const compte: Record<string, number> = {};
  for (const ligne of carte.grille) for (const car of ligne) compte[car] = (compte[car] ?? 0) + 1;
  const part = (t: CleTerrain): number => (compte[CARACTERE_PAR_TERRAIN[t]] ?? 0) / total;
  assert.ok(part('foret') >= 0.25 && part('foret') <= 0.35, `forêt : ${(part('foret') * 100).toFixed(1)} %`);
  assert.ok(part('montagne') > 0, 'un peu de relief');
  assert.ok(part('mer') > 0 && part('mer') <= 0.15, `un peu d’eau : ${(part('mer') * 100).toFixed(1)} %`);
  const possedes = Object.keys(carte.proprietaires).length;
  assert.ok(possedes >= 18 && possedes <= 26, `${possedes} bâtiments possédés, une vingtaine attendue`);
  // Les deux QG : un par camp, et le générateur les a placés.
  for (const camp of [0, 1] as const) {
    const qg = Object.entries(carte.proprietaires)
      .filter(([cle, c]) => c === camp && carte.grille[Number(cle.split(',')[1])]?.[Number(cle.split(',')[0])] === CARACTERE_PAR_TERRAIN.qg);
    assert.equal(qg.length, 1, `camp ${camp} : un QG`);
  }
});

test('elle porte trente unités, quinze par camp, un mélange de partie, sur de la terre nue', () => {
  const carte = carteGrande();
  // Quinze, et non le catalogue entier : le budget de `doc/10` §9.2 est écrit
  // sur une trentaine d'unités, et le faire enfler avec le catalogue rendrait
  // incomparables toutes les campagnes de mesure passées. La couverture est
  // l'affaire de la carte-catalogue.
  assert.equal(UNITES_GRANDE.length, 15);
  assert.equal(carte.unitesDepart.length, 30);
  for (const camp of [0, 1] as const) {
    const duCamp = carte.unitesDepart.filter((u) => u.camp === camp);
    assert.equal(duCamp.length, 15, `camp ${camp}`);
    // Toutes existent au catalogue : une clé mal orthographiée ici poserait une
    // unité fantôme, que `creerPartie` laisserait tomber sans rien dire.
    for (const u of duCamp) assert.ok(CAT.unites[u.type], `${u.type} absente du catalogue`);
    // L'infanterie ouvre la liste : « Déplacer » et « Tirer » jouent sur elle.
    assert.equal(duCamp[0]!.type, 'infanterie');
  }
  const cases = carte.unitesDepart.map((u) => cleCase(u));
  assert.equal(new Set(cases).size, cases.length, 'deux unités sur la même case');
  const nue = new Set(['plaine', 'foret', 'route', 'plage'].map((t) => CARACTERE_PAR_TERRAIN[t as CleTerrain]));
  for (const u of carte.unitesDepart) {
    assert.ok(nue.has(carte.grille[u.y]?.[u.x] ?? ''), `${u.type} du camp ${u.camp} posée sur ${carte.grille[u.y]?.[u.x]} en ${u.x},${u.y}`);
  }
  // Les gestes de mesure ont un sens ici : une unité bleue à déplacer, une rouge à frapper.
  const s = validerScenario(scenarioDemo);
  if (!s.ok) throw new Error('scénario de démonstration invalide');
  const etat = creerPartie(sceneDepuis(scenarioBanc(s.valeur), carte, []), CAT, 'banc:1');
  assert.ok(rejouer(etat, 'deplacement'), 'Déplacer joue sur la grande carte');
  assert.ok(rejouer(etat, 'attaque'), 'Tirer joue sur la grande carte');
});
