// Le contenu canon de `content/` passe ses validateurs, et la table de dégâts reste
// carrée et cohérente avec le catalogue d'unités (`04-gameplay.md` §8 et §13.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import archetypesJson from '../../content/archetypes.json';
import degatsJson from '../../content/degats.json';
import gabaritsJson from '../../content/gabarits-missions.json';
import glossaireFrJson from '../../content/i18n/glossaire.fr.json';
import mecaniquesJson from '../../content/mecaniques.json';
import terrainsJson from '../../content/terrains.json';
import unitesJson from '../../content/unites.json';
import {
  CLES_GABARIT, CLES_TERRAIN, CLES_UNITE_CANON, validerCatalogueArchetypes,
  validerCatalogueGabaritsComplet, validerCatalogueMecaniques,
  validerCatalogueTerrains, validerCatalogueUnites, validerFil, validerGlossaire,
  validerTableDegats,
  type Resultat, type Scenario,
} from '../../src/schemas/index';
import { validerCountry, validerRegion, validerScenario } from '../../src/schemas/valider';
import {
  chargerArchetypes, chargerDegats, chargerGlossaireFr, chargerMecaniques,
  chargerPays, chargerPaysDe, chargerRegions,
  chargerTerrains, chargerUnites, degatsDe,
} from '../../src/content/index';

function exigerOk<T>(nom: string, r: Resultat<T>): T {
  assert.equal(r.ok, true, r.ok ? '' : `${nom} : ${JSON.stringify(r.erreurs, null, 2)}`);
  if (!r.ok) throw new Error('inatteignable');
  return r.valeur;
}

/** Les neuf unités du catalogue 5 : air, mer et missiles (`04-gameplay.md` §10 quater). */
const CATALOGUE_5 = [
  'barge', 'bombardier', 'chasseur', 'cuirasse', 'missiles_air', 'missiles_sol',
  'porte_avions', 'sous_marin', 'transport_air',
];

test('content/unites.json passe son validateur', () => {
  const catalogue = exigerOk('unites.json', validerCatalogueUnites(unitesJson));
  assert.equal(catalogue.catalogueVersion, 9);
  assert.equal(catalogue.unites.filter((u) => u.statut === 'canon').length, 10);
  assert.ok(catalogue.unites.some((u) => u.cle === 'genie' && u.statut === 'homologuee'));
  // Chaque homologuée entre à sa version d'accueil et jamais avant : le drone et
  // le brouilleur au 3, le char moyen au 4. Le drone filaire a été retiré du canon.
  for (const cle of ['drone', 'brouilleur']) {
    assert.equal(catalogue.unites.find((u) => u.cle === cle)?.homologation?.catalogue, 3, cle);
  }
  assert.equal(catalogue.unites.find((u) => u.cle === 'char_moyen')?.homologation?.catalogue, 4);
  assert.equal(catalogue.unites.find((u) => u.cle === 'drone_filaire'), undefined);
  // Le chasseur furtif entre au 6 : vingt-quatre unités, le plafond du §13.7.
  assert.equal(catalogue.unites.find((u) => u.cle === 'furtif')?.homologation?.catalogue, 6);
  // L'automate de combat méridien (10 septembre 2026) entre au 9 : trente unités.
  assert.equal(catalogue.unites.find((u) => u.cle === 'meridien_automate')?.homologation?.catalogue, 9);
  assert.equal(catalogue.unites.length, 30);
});

test('les neuf unités du catalogue 5 entrent à la version 5, et pas avant', () => {
  const unites = chargerUnites();
  const nouvelles = unites.filter((u) => u.homologation?.catalogue === 5).map((u) => u.cle).sort();
  assert.deepEqual(nouvelles, CATALOGUE_5);
  for (const u of unites.filter((x) => CATALOGUE_5.includes(x.cle))) {
    assert.equal(u.statut, 'homologuee', u.cle);
    assert.equal(u.homologation?.date, '2026-09-07', u.cle);
    assert.ok(u.nomCourt.length <= 12, `${u.cle} : nom court de ${u.nomCourt.length} signes`);
  }
  // Catalogue 7 : vingt-huit unités dont deux exclusives ; le drone marin au 8,
  // l'automate méridien au 9 (troisième exclusive) : trente.
  assert.equal(unites.length, 30);
});

test('les neuf unités du catalogue 5 tiennent les quatre contraintes du §13.3', () => {
  const unites = chargerUnites();
  const canon = unites.filter((u) => u.statut === 'canon').map((u) => u.cle);
  for (const u of unites.filter((x) => CATALOGUE_5.includes(x.cle))) {
    assert.ok(u.subitDegats, `${u.cle} : colonne absente`);
    const colonne = u.subitDegats ?? {};
    // 1. La diagonale reste sous cent — zéro quand l'unité ne se vise pas.
    assert.ok((u.degats[u.cle] ?? 0) < 100, `${u.cle} : diagonale ≥ 100`);
    assert.equal(u.degats[u.cle], colonne[u.cle], `${u.cle} : diagonale incohérente`);
    // 2. Un contre au moins parmi les dix canon. 3. Deux canon qu'elle ne perce pas.
    assert.ok(canon.some((c) => (colonne[c] ?? 0) >= 70), `${u.cle} : unité sans contre`);
    assert.ok(canon.filter((c) => (u.degats[c] ?? 0) <= 30).length >= 2, `${u.cle} : unité universelle`);
    // Ligne et colonne complètes : une entrée par unité active.
    for (const autre of unites) {
      assert.ok(autre.cle in u.degats, `${u.cle} : ligne, ${autre.cle} manque`);
      assert.ok(autre.cle in colonne, `${u.cle} : colonne, ${autre.cle} manque`);
    }
  }
});

test('aucune unité active n’est sans contre, les dix canon comprises', () => {
  // §13.3 contrainte 2, étendue aux `canon` le 8 septembre 2026. La règle ne
  // s'appliquait qu'aux candidates à l'homologation, si bien que la table du §8
  // s'exemptait de sa propre exigence : le `char_lourd` n'avait pour meilleure
  // réponse canon que lui-même (55), et personne ne l'avait vu tant que 55
  // suffisait à l'user en deux coups. L'échelle du 8 septembre (§5.1) porte ce
  // même 55 à quatre coups, et le défaut cesse d'être théorique — d'où
  // `roquettes → char_lourd` à 70 (§8).
  //
  // « Pas d'unité sans contre » est une propriété du **jeu**, pas une formalité
  // d'homologation : elle vaut pour les vingt-quatre.
  const unites = chargerUnites();
  const canon = unites.filter((u) => u.statut === 'canon').map((u) => u.cle);
  for (const cible of unites) {
    const meilleur = Math.max(...canon.map((a) => {
      const colonne = cible.subitDegats?.[a];
      if (typeof colonne === 'number') return colonne;
      return unites.find((u) => u.cle === a)?.degats[cible.cle] ?? 0;
    }));
    assert.ok(meilleur >= 70, `${cible.cle} : sans contre canon (meilleur ${meilleur})`);
  }
});

test('la ligne d’une homologuée et la colonne de sa cible disent la même chose', () => {
  // `degatsBase` lit la colonne de la cible **avant** la ligne de l'attaquant : si
  // les deux divergent, la ligne ment sans qu'aucune partie ne le montre.
  const unites = chargerUnites();
  const declarantes = unites.filter((u) => u.subitDegats);
  for (const att of declarantes) {
    for (const def of declarantes) {
      assert.equal(
        att.degats[def.cle], def.subitDegats?.[att.cle],
        `${att.cle} → ${def.cle} : la ligne et la colonne divergent`,
      );
    }
  }
});

test('le sous-marin ne se laisse trouver que par cinq types', () => {
  // Le trait `plongee` cache la coque ; ce qui peut la frapper est une donnée,
  // jamais une exception de combat (`04-gameplay.md` §10 quater).
  const sm = chargerUnites().find((u) => u.cle === 'sous_marin');
  assert.ok(sm?.subitDegats);
  assert.deepEqual(sm.traits, ['plongee']);
  assert.equal(sm.domaine, 'mer');
  const chasseurs = Object.entries(sm.subitDegats)
    .filter(([, d]) => (d ?? 0) > 0).map(([c]) => c).sort();
  assert.deepEqual(chasseurs, ['bombardier', 'cuirasse', 'helico', 'porte_avions', 'sous_marin']);
});

test('le chasseur furtif entre au catalogue 6, seul, et le plafond de vingt-quatre est atteint', () => {
  const unites = chargerUnites();
  const sixieme = unites.filter((u) => u.homologation?.catalogue === 6).map((u) => u.cle);
  assert.deepEqual(sixieme, ['furtif']);
  const furtif = unites.find((u) => u.cle === 'furtif');
  assert.ok(furtif && furtif.subitDegats);
  assert.equal(furtif.statut, 'homologuee');
  assert.deepEqual(furtif.homologation, { date: '2026-09-07', catalogue: 6 });
  assert.deepEqual(furtif.traits, ['vol', 'furtif']);
  assert.equal(furtif.domaine, 'air');
  assert.ok(furtif.carburant && furtif.carburant.parTour >= 1, 'une voilure consomme immobile');
  assert.ok(furtif.nomCourt.length <= 12);
  const canon = unites.filter((u) => u.statut === 'canon').map((u) => u.cle);
  const colonne = furtif.subitDegats;
  // §13.3 : diagonale sous cent, un contre canon, deux canon qu'il ne perce pas.
  assert.ok((furtif.degats.furtif ?? 0) < 100);
  assert.equal(furtif.degats.furtif, colonne.furtif);
  assert.ok(canon.some((c) => (colonne[c] ?? 0) >= 70), 'unité sans contre');
  assert.ok(canon.filter((c) => (furtif.degats[c] ?? 0) <= 30).length >= 2, 'unité universelle');
  // Règle des quatre viseurs de l'air, et la seule exception écrite : le porte-avions.
  for (const [v, d] of Object.entries(colonne)) {
    if ((d ?? 0) <= 0) continue;
    const t = unites.find((u) => u.cle === v);
    assert.ok(t, v);
    const autorise = t.traits.includes('anti_air') || t.traits.includes('vol')
      || v === 'infanterie' || v === 'meca' || v === 'porte_avions';
    assert.ok(autorise, `${v} vise le furtif sans en avoir le droit`);
  }
  // Le sous-marin garde ses cinq chasseurs : un avion furtif ne traque pas les coques.
  assert.equal(furtif.degats.sous_marin, 0);
  // Ligne et colonne complètes, sur les vingt-quatre.
  for (const autre of unites) {
    assert.ok(autre.cle in furtif.degats, `ligne : ${autre.cle} manque`);
    assert.ok(autre.cle in colonne, `colonne : ${autre.cle} manque`);
  }
});

test('le porte-avions et le camion ravitaillent leur cale, la barge et le transport d’assaut non', () => {
  const par = Object.fromEntries(chargerUnites().map((u) => [u.cle, u]));
  assert.equal(par['porte_avions']?.transport?.ravitaille, true);
  assert.equal(par['transport']?.transport?.ravitaille, true);
  assert.notEqual(par['barge']?.transport?.ravitaille, true);
  assert.notEqual(par['transport_air']?.transport?.ravitaille, true);
});

test('les transports du catalogue 5 ne tirent sur rien', () => {
  for (const cle of ['transport_air', 'barge']) {
    const u = chargerUnites().find((x) => x.cle === cle);
    assert.ok(u);
    assert.equal(u.munitions, null, cle);
    assert.ok(Object.values(u.degats).every((d) => d === 0), cle);
    assert.ok(u.transport && u.transport.places === 2, cle);
  }
});

test('le char moyen respecte les contraintes de forme du §13.3', () => {
  const unites = chargerUnites();
  const moyen = unites.find((u) => u.cle === 'char_moyen');
  assert.ok(moyen && moyen.subitDegats);
  const canon = unites.filter((u) => u.statut === 'canon').map((u) => u.cle);
  // Diagonale sous 100, un contre parmi les canon, deux canon qu'il ne perce pas.
  assert.ok((moyen.degats['char_moyen'] ?? 0) < 100);
  assert.equal(moyen.degats['char_moyen'], moyen.subitDegats['char_moyen'], 'ligne et colonne coïncident sur la diagonale');
  assert.ok(canon.some((c) => (moyen.subitDegats?.[c] ?? 0) >= 70), 'pas d’unité sans contre');
  assert.ok(canon.filter((c) => (moyen.degats[c] ?? 0) <= 30).length >= 2, 'pas d’unité universelle');
  // Ligne et colonne complètes : une entrée par unité active, lui-même compris.
  for (const u of unites) {
    assert.ok(u.cle in moyen.degats, `ligne : ${u.cle} manque`);
    assert.ok(u.cle in moyen.subitDegats, `colonne : ${u.cle} manque`);
    // La colonne du char moyen et les lignes des autres disent la même chose.
    assert.equal(u.degats['char_moyen'], moyen.subitDegats[u.cle], `${u.cle} → char_moyen`);
    if (u.subitDegats) assert.equal(u.subitDegats['char_moyen'], moyen.degats[u.cle], `char_moyen → ${u.cle}`);
  }
  // Un char : il fait l'air à zéro, comme les deux autres.
  assert.equal(moyen.degats['helico'], 0);
});

test('le transport est un ravitailleur à deux places qui accepte le génie', () => {
  const t = chargerUnites().find((u) => u.cle === 'transport');
  assert.ok(t);
  assert.deepEqual([...t.traits].sort(), ['ravitaillement', 'transport']);
  // `ravitaille` (catalogue 6) : le camion fait aussi le plein de sa cale.
  assert.deepEqual(t.transport, { places: 2, accepte: ['infanterie', 'meca', 'genie'], ravitaille: true });
  assert.equal(t.cout, 5000);
  assert.equal(t.munitions, null);
});

test('les armes secondaires visent des unités du catalogue à dégâts non nuls', () => {
  const unites = chargerUnites();
  const cles = new Set(unites.map((u) => u.cle));
  const armees = unites.filter((u) => u.armeSecondaire);
  assert.deepEqual(armees.map((u) => u.cle).sort(), ['char_leger', 'char_lourd', 'char_moyen', 'helico', 'meca']);
  for (const u of armees) {
    assert.notEqual(u.munitions, null, `${u.cle} : une arme secondaire suppose une arme principale qui compte`);
    assert.ok((u.degatsSecondaire ?? 0) >= 1 && (u.degatsSecondaire ?? 0) <= 30, `${u.cle} : tir à sec hors liste borné`);
    for (const cible of u.armeSecondaire ?? []) {
      assert.ok(cles.has(cible), `${u.cle} : ${cible} inconnue`);
      assert.ok((u.degats[cible] ?? 0) > 0, `${u.cle} → ${cible} : à 0, rien ne se vise`);
    }
  }
});

test('content/terrains.json passe son validateur', () => {
  const catalogue = exigerOk('terrains.json', validerCatalogueTerrains(terrainsJson));
  assert.equal(catalogue.terrains.length, CLES_TERRAIN.length);
});

test('content/degats.json passe son validateur', () => {
  exigerOk('degats.json', validerTableDegats(degatsJson));
});

test('content/archetypes.json passe son validateur', () => {
  exigerOk('archetypes.json', validerCatalogueArchetypes(archetypesJson));
});

test('content/mecaniques.json passe son validateur', () => {
  const catalogue = exigerOk('mecaniques.json', validerCatalogueMecaniques(mecaniquesJson));
  assert.equal(catalogue.mecaniques.length, 18);
});

test('content/i18n/glossaire.fr.json passe son validateur', () => {
  const glossaire = exigerOk('glossaire.fr.json', validerGlossaire(glossaireFrJson));
  assert.equal(glossaire.locale, 'fr');
  for (const categorie of ['nom_propre', 'terme_impose', 'unite', 'terrain'] as const) {
    assert.ok(
      glossaire.entrees.some((e) => e.categorie === categorie),
      `le glossaire source couvre la catégorie ${categorie}`,
    );
  }
});

test('la table de dégâts est carrée et couvre les dix unités canon', () => {
  const table = chargerDegats();
  assert.equal(table.unites.length, CLES_UNITE_CANON.length);
  assert.deepEqual([...table.unites].sort(), [...CLES_UNITE_CANON].sort());
  assert.equal(table.matrice.length, table.unites.length);
  for (const ligne of table.matrice) assert.equal(ligne.length, table.unites.length);
});

test('la ligne de chaque unité coïncide avec la table de dégâts', () => {
  const table = chargerDegats();
  for (const unite of chargerUnites().filter((u) => u.statut === 'canon')) {
    for (const cible of table.unites) {
      const declare = unite.degats[cible] ?? 0;
      assert.equal(
        declare,
        degatsDe(table, unite.cle, cible),
        `${unite.cle} → ${cible} : la fiche d'unité et la table divergent`,
      );
    }
  }
});

test('la diagonale reste sous 100 et le transport ne vise personne', () => {
  const table = chargerDegats();
  for (const unite of table.unites) {
    assert.ok(degatsDe(table, unite, unite) < 100, `diagonale ≥ 100 pour ${unite}`);
  }
  for (const cible of table.unites) {
    assert.equal(degatsDe(table, 'transport', cible), 0);
  }
});

test("seules quatre unités canon peuvent viser l'air", () => {
  // La règle des quatre viseurs porte sur la table 10 × 10 du §8, que nul
  // catalogue ultérieur ne réécrit : les viseurs venus des catalogues 3 à 5
  // (`missiles_air`, `chasseur`, le pont d'envol du porte-avions) déclarent leur
  // ligne dans `content/unites.json`, jamais ici.
  const table = chargerDegats();
  const viseurs = table.unites.filter((u) => degatsDe(table, u, 'helico') > 0);
  assert.deepEqual(viseurs.sort(), ['antiair', 'helico', 'infanterie', 'meca']);
});

test('les terrains capturables sont exactement les six bâtiments', () => {
  const capturables = chargerTerrains().filter((t) => t.capturable).map((t) => t.cle);
  assert.deepEqual(capturables.sort(), ['aeroport', 'port', 'qg', 'radar', 'usine', 'ville']);
});

test('le port est le seul terrain qu’une coque franchisse avec la mer', () => {
  const terrains = chargerTerrains();
  const navigables = terrains.filter((t) => t.couts.mer !== undefined).map((t) => t.cle);
  assert.deepEqual(navigables.sort(), ['mer', 'port']);
  const port = terrains.find((t) => t.cle === 'port');
  assert.ok(port);
  // Il se capture, il rapporte comme une ville, il ravitaille et il soigne.
  assert.equal(port.car, 'O');
  assert.equal(port.capturable, true);
  assert.equal(port.revenus, 1000);
  assert.equal(port.defense, 3);
  assert.equal(port.ravitaille, true);
  assert.deepEqual([...port.produit].sort(), ['barge', 'cuirasse', 'drone_marin', 'porte_avions', 'sous_marin']);
  // La plage et la rivière restent terrestres : le naval ne remonte pas les fleuves.
  for (const cle of ['plage', 'riviere', 'pont']) {
    assert.equal(terrains.find((t) => t.cle === cle)?.couts.mer, undefined, cle);
  }
});

test('les producteurs couvrent toutes les unités du catalogue', () => {
  const produits = new Set(chargerTerrains().flatMap((t) => t.produit));
  assert.deepEqual([...produits].sort(), chargerUnites().map((u) => u.cle).sort());
});

test('les caractères de grille sont uniques', () => {
  const cars = chargerTerrains().map((t) => t.car);
  assert.equal(new Set(cars).size, cars.length);
});

test('chaque mécanique régionale déclare un hook connu et une clé unique', () => {
  const mecaniques = chargerMecaniques();
  const cles = mecaniques.map((m) => m.cle);
  assert.equal(new Set(cles).size, cles.length);
  for (const m of mecaniques) assert.match(m.cle, /^meca_/);
});

test('les dix archétypes canon sont présents une seule fois', () => {
  const cles = chargerArchetypes().map((a) => a.cle);
  assert.equal(cles.length, 10);
  assert.equal(new Set(cles).size, 10);
});

test('le glossaire français nomme les dix unités canon et les quinze terrains', () => {
  // Le glossaire couvre le vocabulaire **imposé** aux traductions, pas le
  // catalogue vivant : il s'arrête aux dix unités canon. Les terrains, eux, y
  // sont tous : le port et les hautes herbes y sont entrés le 7 septembre 2026.
  const glossaire = chargerGlossaireFr();
  const unites = glossaire.entrees.filter((e) => e.categorie === 'unite');
  const terrains = glossaire.entrees.filter((e) => e.categorie === 'terrain');
  assert.equal(unites.length, 10);
  assert.equal(terrains.length, CLES_TERRAIN.length);
});

// ---------------------------------------------------------------------------
// Campagne : gabarits de mission et fils secondaires (`doc/13-campagne.md`)
// ---------------------------------------------------------------------------

/** Charge les fils de `content/fils/` depuis le disque : ils ne sont pas dans le bundle. */
function chargerFilsBruts(): { fichier: string; contenu: unknown }[] {
  const dossier = path.resolve(import.meta.dirname, '..', '..', 'content', 'fils');
  return readdirSync(dossier)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ fichier: f, contenu: JSON.parse(readFileSync(path.join(dossier, f), 'utf8')) as unknown }));
}

test('content/gabarits-missions.json couvre les neuf gabarits canon', () => {
  const catalogue = exigerOk('gabarits-missions.json', validerCatalogueGabaritsComplet(gabaritsJson));
  assert.equal(catalogue.gabarits.length, CLES_GABARIT.length);
  for (const g of catalogue.gabarits) {
    assert.ok(g.dureeVisee.min >= 10, `${g.cle} : une mission de moins de dix minutes n'est pas une mission`);
    assert.ok(g.journees.min >= 5, `${g.cle} : cinq journées au moins`);
  }
});

test('le gabarit exhibition est le plus court de tous', () => {
  const catalogue = exigerOk('gabarits-missions.json', validerCatalogueGabaritsComplet(gabaritsJson));
  const exhibition = catalogue.gabarits.find((g) => g.cle === 'exhibition');
  assert.ok(exhibition);
  for (const g of catalogue.gabarits) {
    if (g.cle === 'exhibition') continue;
    assert.ok(exhibition.dureeVisee.max <= g.dureeVisee.max,
      `la Dépêche doit rester plus courte que ${g.cle}`);
  }
});

test('chaque fil de content/fils passe son validateur', () => {
  const fils = chargerFilsBruts();
  assert.ok(fils.length >= 6 && fils.length <= 12, 'entre six et douze fils exemples');
  for (const { fichier, contenu } of fils) exigerOk(`fils/${fichier}`, validerFil(contenu));
});

test('les clés de fil sont uniques et le nom de fichier porte la clé', () => {
  const cles = new Set<string>();
  for (const { fichier, contenu } of chargerFilsBruts()) {
    const fil = exigerOk(`fils/${fichier}`, validerFil(contenu));
    assert.equal(`${fil.code}.json`, fichier, 'un fil se range sous sa propre clé');
    assert.equal(fil.cle, fil.code);
    assert.ok(!cles.has(fil.code), `clé de fil en double : ${fil.code}`);
    cles.add(fil.code);
  }
});

test('les gabarits employés par les fils existent tous au catalogue', () => {
  const connus = new Set(
    exigerOk('gabarits-missions.json', validerCatalogueGabaritsComplet(gabaritsJson))
      .gabarits.map((g) => g.cle),
  );
  for (const { fichier, contenu } of chargerFilsBruts()) {
    const fil = exigerOk(`fils/${fichier}`, validerFil(contenu));
    for (const m of fil.missions) {
      assert.ok(connus.has(m.gabarit), `${fil.code} : gabarit inconnu ${m.gabarit}`);
    }
  }
});

test('la durée de chaque mission de fil tient dans la fenêtre de son gabarit', () => {
  const parCle = new Map(
    exigerOk('gabarits-missions.json', validerCatalogueGabaritsComplet(gabaritsJson))
      .gabarits.map((g) => [g.cle, g]),
  );
  for (const { fichier, contenu } of chargerFilsBruts()) {
    const fil = exigerOk(`fils/${fichier}`, validerFil(contenu));
    for (const m of fil.missions) {
      const g = parCle.get(m.gabarit);
      assert.ok(g);
      assert.ok(
        m.dureeVisee >= g.dureeVisee.min && m.dureeVisee <= g.dureeVisee.max,
        `${fil.code} étape ${m.ordre} : ${m.dureeVisee} min hors de [${g.dureeVisee.min} ; ${g.dureeVisee.max}]`,
      );
    }
  }
});

/** Les cinq flags de portée commandant (`08-narration-choix.md` §9.5). */
const GABARITS_CMD = ['respect', 'grief', 'co_commandant', 'rival_jure', 'dette'];

test('tout flag écrit par un fil est déclaré au catalogue canon des flags', () => {
  const catalogue = JSON.parse(
    readFileSync(path.resolve(import.meta.dirname, '..', '..', 'content', 'flags.json'), 'utf8'),
  ) as { auteurs: Record<string, string> };
  const connus = new Set(Object.keys(catalogue.auteurs));
  for (const { fichier, contenu } of chargerFilsBruts()) {
    const fil = exigerOk(`fils/${fichier}`, validerFil(contenu));
    for (const f of fil.flagsEcrits) {
      if (f.startsWith('cmd.')) {
        // La portée commandant est un gabarit (`08-narration-choix.md` §9.5) : cinq
        // noms, applicables à tout commandant nommé. C'est le suffixe qui fait foi.
        const nom = f.split('.').slice(2).join('.');
        assert.ok(
          GABARITS_CMD.includes(nom),
          `${fil.code} écrit un flag de commandant hors gabarit : ${f}`,
        );
        continue;
      }
      assert.ok(
        connus.has(f),
        `${fil.code} écrit un flag absent de content/flags.json : ${f}`,
      );
    }
  }
});

test('aucun fichier de content/ ne porte de secret : le registre vit dans doc/14', () => {
  const racine = path.resolve(import.meta.dirname, '..', '..', 'content');
  for (const nom of readdirSync(racine)) {
    assert.ok(!/^secrets/i.test(nom), `content/${nom} : les easter eggs ne passent jamais par le canon servi`);
  }
});

test('aucun fil ne pose un flag monde.secret.*', () => {
  for (const { fichier, contenu } of chargerFilsBruts()) {
    const fil = exigerOk(`fils/${fichier}`, validerFil(contenu));
    for (const f of fil.flagsEcrits) assert.ok(!f.startsWith('monde.secret.'));
  }
});

// ---------------------------------------------------------------------------
// Les 24 fiches pays et les 18 régions de France
// ---------------------------------------------------------------------------

test('les 24 fiches pays passent validerCountry', () => {
  const pays = chargerPays();
  assert.equal(pays.length, 24);
  for (const p of pays) exigerOk(`content/pays/${p.code}.json`, validerCountry(p));
  const codes = pays.map((p) => p.code);
  assert.equal(new Set(codes).size, 24, 'un code pays est en double');
});

test('les rivalités forment douze paires réciproques', () => {
  // `doc/06-pays-de-depart.md` §6 : chaque commandant est le rival de celui qui
  // le cite, personne n'est cité deux fois, personne n'est orphelin. La routine
  // lore peut donc traiter une rivalité comme une arête unique.
  const pays = chargerPays();
  const rival = new Map(pays.map((p) => [p.code, p.rivalNaturel]));
  const paires = new Set<string>();
  for (const [code, r] of rival) {
    assert.notEqual(code, r, `${code} est son propre rival`);
    assert.ok(rival.has(r), `${code} cite un rival inconnu : ${r}`);
    assert.equal(rival.get(r), code, `rivalité non réciproque : ${code} → ${r} → ${rival.get(r)}`);
    paires.add([code, r].sort().join('-'));
  }
  assert.equal(paires.size, 12);
});

test('la répartition des pays suit le tableau du canon', () => {
  const pays = chargerPays();
  const parArchetype = new Map<string, number>();
  for (const p of pays) {
    parArchetype.set(p.archetypeCommandant, (parArchetype.get(p.archetypeCommandant) ?? 0) + 1);
  }
  assert.equal(parArchetype.size, 10, 'les dix archétypes canon sont employés');
  for (const [cle, n] of parArchetype) {
    assert.ok(n >= 2 && n <= 3, `archétype déséquilibré : ${cle} porté par ${n} pays`);
  }
  // Les hémisphères sont ceux des 24 fiches de `doc/06` §5, comptés une par une :
  // 14 nord, 8 sud, 2 à l'équateur. La ligne de synthèse de `doc/06` §6 annonce
  // 13 / 9 / 2 — c'est le décompte de la synthèse qui est faux, pas les fiches,
  // et il n'appartient pas à ce test de réécrire ce document.
  const hemispheres = { nord: 0, sud: 0, equateur: 0 };
  for (const p of pays) hemispheres[p.hemisphere] += 1;
  assert.equal(hemispheres.nord + hemispheres.sud + hemispheres.equateur, 24);
  assert.deepEqual(hemispheres, { nord: 14, sud: 8, equateur: 2 });
  const phares = pays.filter((p) => p.phare).map((p) => p.code).sort();
  assert.deepEqual(phares, ['br', 'fr', 'jp', 'lu']);
  for (const p of pays) {
    assert.equal(p.phare, (p.regions ?? []).length > 0, `${p.code} : phare et régions divergent`);
    assert.equal(p.specialite.portee, 'pays');
    assert.ok(p.interdits.length >= 1, `${p.code} : la charte de sensibilité doit être écrite`);
  }
  assert.equal(chargerPaysDe('fr')?.nom, 'France');
  assert.equal(chargerPaysDe('zz'), null);
});

test('les 18 régions de France passent validerRegion', () => {
  const regions = chargerRegions('fr');
  assert.equal(regions.length, 18);
  for (const r of regions) exigerOk(`content/regions/fr/${r.code}.json`, validerRegion(r));
  const ordres = regions.map((r) => r.ordreConseille).sort((a, b) => a - b);
  assert.deepEqual(ordres, Array.from({ length: 18 }, (_, i) => i + 1));
  const outreMer = regions.filter((r) => r.type === 'outre_mer').map((r) => r.code);
  assert.equal(outreMer.length, 5, 'la zone E compte cinq étapes');
  // L'Île-de-France est toujours la dernière : c'est la finale nationale.
  const finale = regions.find((r) => r.ordreConseille === 18);
  assert.equal(finale?.code, 'region_fr_ile_de_france');
});

test('chaque région pointe une mécanique du registre, et réciproquement', () => {
  const regions = chargerRegions('fr');
  const mecaniques = chargerMecaniques();
  for (const r of regions) {
    const m = mecaniques.find((x) => x.cle === r.mecanique.cle);
    assert.ok(m, `${r.code} déclare une mécanique inconnue : ${r.mecanique.cle}`);
    assert.equal(m.regionCle, r.code, `${m.cle} ne pointe pas ${r.code}`);
    assert.equal(m.paysCode, r.paysCode);
    assert.equal(r.specialiteLocale.portee, 'region');
    for (const f of r.flagsPropres) assert.ok(f.startsWith('pays.fr.'), `${r.code} : ${f}`);
  }
  const clesRegions = new Set(regions.map((r) => r.code));
  for (const m of mecaniques) {
    assert.ok(clesRegions.has(m.regionCle), `mécanique orpheline : ${m.cle} → ${m.regionCle}`);
  }
});

test('la France déclare exactement ses dix-huit régions', () => {
  const france = chargerPaysDe('fr');
  assert.ok(france);
  const declarees = [...(france.regions ?? [])].sort();
  const ecrites = chargerRegions('fr').map((r) => r.code).sort();
  assert.deepEqual(declarees, ecrites);
});

test('tout flag déclaré par un pays ou une région existe dans le canon', () => {
  const connus = new Set(Object.keys(
    (JSON.parse(readFileSync(path.join(import.meta.dirname, '../../content/flags.json'), 'utf8')) as
      { auteurs: Record<string, string> }).auteurs,
  ));
  for (const p of chargerPays()) {
    for (const f of p.flagsDisponibles) assert.ok(connus.has(f), `flag inconnu : ${f}`);
  }
  for (const r of chargerRegions('fr')) {
    for (const f of r.flagsPropres) assert.ok(connus.has(f), `flag inconnu : ${f}`);
  }
});

test('le budget de fils de doc/13-campagne.md §2.2 correspond aux fichiers', () => {
  // Le budget d'heures de la campagne est une addition, pas une intention : si un fil
  // change de longueur, c'est ce test qui rappelle d'aller corriger le document.
  let missions = 0;
  let minutes = 0;
  for (const { fichier, contenu } of chargerFilsBruts()) {
    const fil = exigerOk(`fils/${fichier}`, validerFil(contenu));
    missions += fil.missions.length;
    for (const m of fil.missions) minutes += m.dureeVisee;
  }
  assert.equal(missions, 45, 'doc/13-campagne.md §2.2 annonce 45 missions de fil');
  assert.equal(minutes, 1492, 'doc/13-campagne.md §2.2 annonce 24 h 52 de fils');
});

// ---------------------------------------------------------------------------
// Les scénarios du canon
// ---------------------------------------------------------------------------

const SCENARIOS = path.resolve(import.meta.dirname, '..', '..', 'content', 'scenarios');

/** Les scénarios canon, lus une fois pour les trois vérifications qui suivent. */
function scenarios(): { fichier: string; scenario: Scenario }[] {
  return readdirSync(SCENARIOS)
    .filter((f) => f.endsWith('.json'))
    .map((fichier) => {
      const brut: unknown = JSON.parse(readFileSync(path.join(SCENARIOS, fichier), 'utf8'));
      return { fichier, scenario: exigerOk(fichier, validerScenario(brut)) };
    });
}

test('chaque scénario de content/scenarios passe son validateur', () => {
  const lus = scenarios();
  assert.ok(lus.length >= 6, 'le canon porte au moins les six missions de campagne');
  for (const { fichier, scenario } of lus) {
    assert.equal(scenario.code, path.basename(fichier, '.json'), 'le code vaut le nom du fichier');
  }
});

test('les scènes de dialogue nomment des locuteurs de la distribution', () => {
  for (const { fichier, scenario } of scenarios()) {
    const distribution = new Set(scenario.commandants.map((c) => c.commandantCle));
    const repliques = [
      ...scenario.dialogueOuverture, ...scenario.dialogueVictoire, ...scenario.dialogueDefaite,
      ...(scenario.scenesDialogue ?? []).flatMap((s) => s.repliques),
    ];
    for (const r of repliques) {
      assert.ok(
        distribution.has(r.locuteur),
        `${fichier} : ${r.locuteur} parle sans être au tableau des commandants`,
      );
    }
  }
});

test('un déclencheur de production ne cite qu’une unité du catalogue', () => {
  // Le catalogue complet, pas seulement les dix unités canon : le génie est une
  // unité de catalogue 2, et une scène a le droit de le nommer.
  const connues = new Set(chargerUnites().map((u) => u.cle));
  for (const { fichier, scenario } of scenarios()) {
    for (const scene of scenario.scenesDialogue ?? []) {
      if (scene.declencheur.type !== 'production' || scene.declencheur.unite === undefined) continue;
      assert.ok(
        connues.has(scene.declencheur.unite),
        `${fichier} : la scène ${scene.cle} attend une unité inconnue`,
      );
    }
  }
});

test('les bornes de conception du §13.4 ne dérivent pas sans être nommées', () => {
  // Les bornes de la routine contrôle ne sont vérifiées par aucun validateur :
  // ce test tient le registre des écarts assumés (`04-gameplay.md` §10 quater,
  // §13.4). Un écart neuf échoue ici ; un écart résorbé doit être retiré d'ici.
  const ECARTS_ASSUMES: Record<string, string[]> = {
    drone: ['vision 5 sans vision_etendue'],
    missiles_sol: ['portée 6 > 5'],
    chasseur: ['mouvement 9 > 6 au-dessus de 10 000'],
    bombardier: ['mouvement 7 > 6 au-dessus de 10 000'],
    cuirasse: ['portée 6 > 5', 'fenêtre 4 > 3'],
  };
  const constates: Record<string, string[]> = {};
  for (const u of chargerUnites().filter((x) => x.statut !== 'canon')) {
    const ecarts: string[] = [];
    if (u.cout >= 10000 && u.mouvement > 6) ecarts.push(`mouvement ${u.mouvement} > 6 au-dessus de 10 000`);
    if (u.domaine === 'terre' && u.portee[1] >= 3 && u.mouvement > 4) ecarts.push('longue portée mobile');
    if (u.portee[1] > 1 && u.portee[1] > 5) ecarts.push(`portée ${u.portee[1]} > 5`);
    if (u.portee[1] > 1 && u.portee[1] - u.portee[0] > 3) ecarts.push(`fenêtre ${u.portee[1] - u.portee[0]} > 3`);
    if (u.vision >= 5 && !u.traits.includes('vision_etendue')) ecarts.push(`vision ${u.vision} sans vision_etendue`);
    if (ecarts.length > 0) constates[u.cle] = ecarts;
  }
  assert.deepEqual(constates, ECARTS_ASSUMES);
});
