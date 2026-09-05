/**
 * Chargeurs du contenu canon : les JSON de `content/` sont importés statiquement
 * (ils sont donc dans le bundle, jamais récupérés par le réseau — `02-architecture.md`
 * §3.5), validés au chargement, puis servis typés. Un contenu invalide lève : le canon
 * cassé doit arrêter le build et les tests, pas produire une partie bancale.
 *
 * Cette couche n'importe que `schemas` (`02-architecture.md` §5).
 */

import archetypesJson from '../../content/archetypes.json';
import degatsJson from '../../content/degats.json';
import glossaireFrJson from '../../content/i18n/glossaire.fr.json';
import mecaniquesJson from '../../content/mecaniques.json';
import terrainsJson from '../../content/terrains.json';
import unitesJson from '../../content/unites.json';

import paysArJson from '../../content/pays/ar.json';
import paysAuJson from '../../content/pays/au.json';
import paysBrJson from '../../content/pays/br.json';
import paysCaJson from '../../content/pays/ca.json';
import paysChJson from '../../content/pays/ch.json';
import paysFjJson from '../../content/pays/fj.json';
import paysFrJson from '../../content/pays/fr.json';
import paysGrJson from '../../content/pays/gr.json';
import paysIdJson from '../../content/pays/id.json';
import paysInJson from '../../content/pays/in.json';
import paysIsJson from '../../content/pays/is.json';
import paysJpJson from '../../content/pays/jp.json';
import paysKeJson from '../../content/pays/ke.json';
import paysLuJson from '../../content/pays/lu.json';
import paysMaJson from '../../content/pays/ma.json';
import paysMgJson from '../../content/pays/mg.json';
import paysMnJson from '../../content/pays/mn.json';
import paysMxJson from '../../content/pays/mx.json';
import paysNaJson from '../../content/pays/na.json';
import paysNlJson from '../../content/pays/nl.json';
import paysNpJson from '../../content/pays/np.json';
import paysNzJson from '../../content/pays/nz.json';
import paysPeJson from '../../content/pays/pe.json';
import paysSnJson from '../../content/pays/sn.json';

import regionAraJson from '../../content/regions/fr/auvergne_rhone_alpes.json';
import regionBfcJson from '../../content/regions/fr/bourgogne_franche_comte.json';
import regionBretagneJson from '../../content/regions/fr/bretagne.json';
import regionCorseJson from '../../content/regions/fr/corse.json';
import regionCvlJson from '../../content/regions/fr/centre_val_de_loire.json';
import regionGrandEstJson from '../../content/regions/fr/grand_est.json';
import regionGuadeloupeJson from '../../content/regions/fr/guadeloupe.json';
import regionGuyaneJson from '../../content/regions/fr/guyane.json';
import regionHdfJson from '../../content/regions/fr/hauts_de_france.json';
import regionIdfJson from '../../content/regions/fr/ile_de_france.json';
import regionLaReunionJson from '../../content/regions/fr/la_reunion.json';
import regionMartiniqueJson from '../../content/regions/fr/martinique.json';
import regionMayotteJson from '../../content/regions/fr/mayotte.json';
import regionNormandieJson from '../../content/regions/fr/normandie.json';
import regionNouvelleAquitaineJson from '../../content/regions/fr/nouvelle_aquitaine.json';
import regionOccitanieJson from '../../content/regions/fr/occitanie.json';
import regionPacaJson from '../../content/regions/fr/provence_alpes_cote_azur.json';
import regionPaysDeLaLoireJson from '../../content/regions/fr/pays_de_la_loire.json';

import {
  validerCatalogueArchetypes, validerCatalogueMecaniques, validerCatalogueTerrains,
  validerCatalogueUnites, validerCountry, validerGlossaire, validerRegion, validerTableDegats,
  type CatalogueUnites, type CleUnite, type CodePays, type Country, type FicheArchetype,
  type FicheMecanique, type Glossaire, type Region, type Resultat, type TableDegats,
  type Terrain, type UnitType,
} from '../schemas/index';

/** Lève une erreur lisible si un fichier de contenu ne passe pas son validateur. */
function exiger<T>(fichier: string, resultat: Resultat<T>): T {
  if (resultat.ok) return resultat.valeur;
  const details = resultat.erreurs
    .map((e) => `  - ${e.chemin === '' ? '(racine)' : e.chemin} : ${e.message}`)
    .join('\n');
  throw new Error(`Contenu canon invalide dans ${fichier} :\n${details}`);
}

/** Charge le catalogue d'unités canon avec sa version (`content/unites.json`). */
export function chargerCatalogueUnites(): CatalogueUnites {
  return exiger('content/unites.json', validerCatalogueUnites(unitesJson));
}

/** Charge les dix types d'unité canon. */
export function chargerUnites(): UnitType[] {
  return chargerCatalogueUnites().unites;
}

/** Charge les douze terrains (`content/terrains.json`). */
export function chargerTerrains(): Terrain[] {
  return exiger('content/terrains.json', validerCatalogueTerrains(terrainsJson)).terrains;
}

/** Charge la table de dégâts 10 × 10 (`content/degats.json`). */
export function chargerDegats(): TableDegats {
  return exiger('content/degats.json', validerTableDegats(degatsJson));
}

/** Charge les dix archétypes de commandant (`content/archetypes.json`). */
export function chargerArchetypes(): FicheArchetype[] {
  return exiger('content/archetypes.json', validerCatalogueArchetypes(archetypesJson)).archetypes;
}

/** Charge le registre des mécaniques régionales (`content/mecaniques.json`). */
export function chargerMecaniques(): FicheMecanique[] {
  return exiger('content/mecaniques.json', validerCatalogueMecaniques(mecaniquesJson)).mecaniques;
}

/** Charge le glossaire français, source de toutes les traductions. */
export function chargerGlossaireFr(): Glossaire {
  return exiger('content/i18n/glossaire.fr.json', validerGlossaire(glossaireFrJson));
}

// ---------------------------------------------------------------------------
// Les 24 fiches pays et les 18 régions de France
// ---------------------------------------------------------------------------

/**
 * Les fiches pays brutes, dans l'ordre des 24 de `doc/06-pays-de-depart.md` §6.
 * L'ordre est celui du canon, pas l'ordre alphabétique : c'est celui que la carte
 * du monde et la sélection de départ présentent au joueur.
 */
const PAYS_BRUTS: readonly [string, unknown][] = [
  ['fr', paysFrJson], ['lu', paysLuJson], ['is', paysIsJson], ['ch', paysChJson],
  ['nl', paysNlJson], ['gr', paysGrJson], ['jp', paysJpJson], ['mn', paysMnJson],
  ['np', paysNpJson], ['id', paysIdJson], ['in', paysInJson], ['ma', paysMaJson],
  ['sn', paysSnJson], ['ke', paysKeJson], ['na', paysNaJson], ['mg', paysMgJson],
  ['br', paysBrJson], ['ar', paysArJson], ['pe', paysPeJson], ['mx', paysMxJson],
  ['ca', paysCaJson], ['au', paysAuJson], ['nz', paysNzJson], ['fj', paysFjJson],
];

/** Les 18 régions de France, dans l'ordre du chemin recommandé (`doc/07` §2.1). */
const REGIONS_BRUTES: Readonly<Record<string, readonly [string, unknown][]>> = {
  fr: [
    ['bretagne', regionBretagneJson], ['normandie', regionNormandieJson],
    ['pays_de_la_loire', regionPaysDeLaLoireJson], ['centre_val_de_loire', regionCvlJson],
    ['hauts_de_france', regionHdfJson], ['grand_est', regionGrandEstJson],
    ['bourgogne_franche_comte', regionBfcJson], ['guadeloupe', regionGuadeloupeJson],
    ['martinique', regionMartiniqueJson], ['guyane', regionGuyaneJson],
    ['la_reunion', regionLaReunionJson], ['mayotte', regionMayotteJson],
    ['nouvelle_aquitaine', regionNouvelleAquitaineJson], ['occitanie', regionOccitanieJson],
    ['auvergne_rhone_alpes', regionAraJson], ['provence_alpes_cote_azur', regionPacaJson],
    ['corse', regionCorseJson], ['ile_de_france', regionIdfJson],
  ],
};

/**
 * Charge les 24 fiches pays de départ (`content/pays/<code>.json`). Chaque fiche
 * passe `validerCountry` au chargement : une fiche cassée arrête les tests et le
 * build, elle ne produit jamais une partie bancale.
 */
export function chargerPays(): Country[] {
  return PAYS_BRUTS.map(([code, brut]) => exiger(`content/pays/${code}.json`, validerCountry(brut)));
}

/** Charge une fiche pays par son code ISO, ou `null` si le pays n'est pas de départ. */
export function chargerPaysDe(code: CodePays): Country | null {
  return chargerPays().find((p) => p.code === code) ?? null;
}

/**
 * Charge les régions d'un pays phare (`content/regions/<pays>/<region>.json`).
 * Seule la France est écrite à la main aujourd'hui ; le Luxembourg, le Japon et
 * le Brésil suivront le même gabarit (`doc/07-france-regions.md` §7).
 */
export function chargerRegions(paysCode: CodePays): Region[] {
  const brutes = REGIONS_BRUTES[paysCode] ?? [];
  return brutes.map(([nom, brut]) => exiger(`content/regions/${paysCode}/${nom}.json`, validerRegion(brut)));
}

/** Lit une valeur de la table de dégâts : ce que `attaquant` inflige à `cible`. */
export function degatsDe(table: TableDegats, attaquant: CleUnite, cible: CleUnite): number {
  const ligne = table.unites.indexOf(attaquant);
  const colonne = table.unites.indexOf(cible);
  if (ligne < 0 || colonne < 0) return 0;
  return table.matrice[ligne]?.[colonne] ?? 0;
}
