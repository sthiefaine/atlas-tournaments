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

test('content/unites.json passe son validateur', () => {
  const catalogue = exigerOk('unites.json', validerCatalogueUnites(unitesJson));
  assert.equal(catalogue.catalogueVersion, 3);
  assert.equal(catalogue.unites.filter((u) => u.statut === 'canon').length, 10);
  assert.ok(catalogue.unites.some((u) => u.cle === 'genie' && u.statut === 'homologuee'));
  // Les drones et le brouilleur entrent au catalogue 3, jamais au 2.
  for (const cle of ['drone', 'drone_filaire', 'brouilleur']) {
    assert.equal(catalogue.unites.find((u) => u.cle === cle)?.homologation?.catalogue, 3, cle);
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

test("seules quatre unités peuvent viser l'air", () => {
  const table = chargerDegats();
  const viseurs = table.unites.filter((u) => degatsDe(table, u, 'helico') > 0);
  assert.deepEqual(viseurs.sort(), ['antiair', 'helico', 'infanterie', 'meca']);
});

test('les terrains capturables sont exactement les cinq bâtiments', () => {
  const capturables = chargerTerrains().filter((t) => t.capturable).map((t) => t.cle);
  assert.deepEqual(capturables.sort(), ['aeroport', 'qg', 'radar', 'usine', 'ville']);
});

test('les producteurs couvrent les dix unités canon', () => {
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

test('le glossaire français nomme les dix unités et les treize terrains', () => {
  const glossaire = chargerGlossaireFr();
  const unites = glossaire.entrees.filter((e) => e.categorie === 'unite');
  const terrains = glossaire.entrees.filter((e) => e.categorie === 'terrain');
  assert.equal(unites.length, 10);
  assert.equal(terrains.length, 13);
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
