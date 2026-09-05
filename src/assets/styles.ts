/**
 * Les **styles** : ce qui fait qu'un engin se reconnaît comme suisse ou comme
 * sénégalais avant même qu'on ait vu sa couleur (`BRIEF.md`, « Direction
 * artistique », 5 septembre 2026 au soir).
 *
 * Deux familles, deux fichiers, deux portées :
 *
 * - `content/styles/<code>.json` — le **style national**, qui habille les
 *   **unités** : matières, finitions, ornements, gabarits, décalcomanies ;
 * - `content/styles/regions/<pays>/<region>.json` — le **style régional**, qui
 *   habille les **bâtiments, le décor et le terrain**, jamais les unités.
 *
 * Les styles vivent dans `assets/` et non dans `content/` parce qu'ils sont une
 * commande faite au générateur externe, pas une donnée de jeu : le moteur ne les
 * lit jamais, et une routine n'a rien à y écrire. Comme tout le canon, ils sont
 * importés statiquement et validés au chargement : un style cassé arrête le
 * build (`doc/02-architecture.md` §3.5).
 */

import styleArJson from '../../content/styles/ar.json';
import styleAuJson from '../../content/styles/au.json';
import styleBrJson from '../../content/styles/br.json';
import styleCaJson from '../../content/styles/ca.json';
import styleChJson from '../../content/styles/ch.json';
import styleFjJson from '../../content/styles/fj.json';
import styleFrJson from '../../content/styles/fr.json';
import styleGrJson from '../../content/styles/gr.json';
import styleIdJson from '../../content/styles/id.json';
import styleInJson from '../../content/styles/in.json';
import styleIsJson from '../../content/styles/is.json';
import styleJpJson from '../../content/styles/jp.json';
import styleKeJson from '../../content/styles/ke.json';
import styleLuJson from '../../content/styles/lu.json';
import styleMaJson from '../../content/styles/ma.json';
import styleMgJson from '../../content/styles/mg.json';
import styleMnJson from '../../content/styles/mn.json';
import styleMxJson from '../../content/styles/mx.json';
import styleNaJson from '../../content/styles/na.json';
import styleNlJson from '../../content/styles/nl.json';
import styleNpJson from '../../content/styles/np.json';
import styleNzJson from '../../content/styles/nz.json';
import stylePeJson from '../../content/styles/pe.json';
import styleSnJson from '../../content/styles/sn.json';

import styleAraJson from '../../content/styles/regions/fr/auvergne_rhone_alpes.json';
import styleBfcJson from '../../content/styles/regions/fr/bourgogne_franche_comte.json';
import styleBretagneJson from '../../content/styles/regions/fr/bretagne.json';
import styleCorseJson from '../../content/styles/regions/fr/corse.json';
import styleCvlJson from '../../content/styles/regions/fr/centre_val_de_loire.json';
import styleGrandEstJson from '../../content/styles/regions/fr/grand_est.json';
import styleGuadeloupeJson from '../../content/styles/regions/fr/guadeloupe.json';
import styleGuyaneJson from '../../content/styles/regions/fr/guyane.json';
import styleHdfJson from '../../content/styles/regions/fr/hauts_de_france.json';
import styleIdfJson from '../../content/styles/regions/fr/ile_de_france.json';
import styleLaReunionJson from '../../content/styles/regions/fr/la_reunion.json';
import styleMartiniqueJson from '../../content/styles/regions/fr/martinique.json';
import styleMayotteJson from '../../content/styles/regions/fr/mayotte.json';
import styleNormandieJson from '../../content/styles/regions/fr/normandie.json';
import styleNouvelleAquitaineJson from '../../content/styles/regions/fr/nouvelle_aquitaine.json';
import styleOccitanieJson from '../../content/styles/regions/fr/occitanie.json';
import stylePacaJson from '../../content/styles/regions/fr/provence_alpes_cote_azur.json';
import stylePaysDeLaLoireJson from '../../content/styles/regions/fr/pays_de_la_loire.json';

import { chargerMecaniques } from '../content/index';
import type { Cle, CodePays } from '../schemas/types';
import type { Resultat } from '../schemas/noyau';
import type { StyleNation, StyleRegion } from './spec';
import { validerStyleNation, validerStyleRegion } from './valider';

/** Lève une erreur lisible si un fichier de style ne passe pas son validateur. */
function exiger<T>(fichier: string, resultat: Resultat<T>): T {
  if (resultat.ok) return resultat.valeur;
  const details = resultat.erreurs
    .map((e) => `  - ${e.chemin === '' ? '(racine)' : e.chemin} : ${e.message}`)
    .join('\n');
  throw new Error(`Style invalide dans ${fichier} :\n${details}`);
}

/** Les 24 styles nationaux bruts, dans l'ordre du canon (`doc/06` §6). */
const STYLES_BRUTS: readonly [CodePays, unknown][] = [
  ['fr', styleFrJson], ['lu', styleLuJson], ['is', styleIsJson], ['ch', styleChJson],
  ['nl', styleNlJson], ['gr', styleGrJson], ['jp', styleJpJson], ['mn', styleMnJson],
  ['np', styleNpJson], ['id', styleIdJson], ['in', styleInJson], ['ma', styleMaJson],
  ['sn', styleSnJson], ['ke', styleKeJson], ['na', styleNaJson], ['mg', styleMgJson],
  ['br', styleBrJson], ['ar', styleArJson], ['pe', stylePeJson], ['mx', styleMxJson],
  ['ca', styleCaJson], ['au', styleAuJson], ['nz', styleNzJson], ['fj', styleFjJson],
];

/** Les styles régionaux bruts, par pays puis par région, dans l'ordre du parcours. */
const STYLES_REGIONS_BRUTS: Readonly<Record<string, readonly [string, unknown][]>> = {
  fr: [
    ['bretagne', styleBretagneJson], ['normandie', styleNormandieJson],
    ['pays_de_la_loire', stylePaysDeLaLoireJson], ['centre_val_de_loire', styleCvlJson],
    ['hauts_de_france', styleHdfJson], ['grand_est', styleGrandEstJson],
    ['bourgogne_franche_comte', styleBfcJson], ['guadeloupe', styleGuadeloupeJson],
    ['martinique', styleMartiniqueJson], ['guyane', styleGuyaneJson],
    ['la_reunion', styleLaReunionJson], ['mayotte', styleMayotteJson],
    ['nouvelle_aquitaine', styleNouvelleAquitaineJson], ['occitanie', styleOccitanieJson],
    ['auvergne_rhone_alpes', styleAraJson], ['provence_alpes_cote_azur', stylePacaJson],
    ['corse', styleCorseJson], ['ile_de_france', styleIdfJson],
  ],
};

let memoNations: StyleNation[] | null = null;
let memoRegions: Map<string, StyleRegion[]> | null = null;

/** Charge les 24 styles nationaux, validés. Le résultat est mémorisé. */
export function chargerStylesNations(): StyleNation[] {
  if (memoNations) return memoNations;
  memoNations = STYLES_BRUTS.map(([code, brut]) => exiger(
    `content/styles/${code}.json`, validerStyleNation(brut),
  ));
  return memoNations;
}

/** Le style d'une nation, ou `null` si le pays n'est pas un pays de départ. */
export function chargerStyleNation(code: CodePays): StyleNation | null {
  return chargerStylesNations().find((s) => s.code === code) ?? null;
}

/** Charge les styles régionaux d'un pays phare, validés. */
export function chargerStylesRegions(paysCode: CodePays): StyleRegion[] {
  memoRegions = memoRegions ?? new Map<string, StyleRegion[]>();
  const memo = memoRegions.get(paysCode);
  if (memo) return memo;
  const brutes = STYLES_REGIONS_BRUTS[paysCode] ?? [];
  const lus = brutes.map(([nom, brut]) => exiger(
    `content/styles/regions/${paysCode}/${nom}.json`, validerStyleRegion(brut),
  ));
  memoRegions.set(paysCode, lus);
  return lus;
}

/** Le style d'une région par sa clé (`region_fr_bretagne`), ou `null`. */
export function chargerStyleRegion(paysCode: CodePays, code: Cle): StyleRegion | null {
  return chargerStylesRegions(paysCode).find((s) => s.code === code) ?? null;
}

/**
 * Le style régional que porte une **mécanique** de carte.
 *
 * C'est le seul lien qu'a le rendu : une carte ne déclare pas sa région, elle
 * déclare sa mécanique (`EtatPartie.mecanique.cle`), et le registre des
 * mécaniques dit à quelle région chacune appartient (`content/mecaniques.json`).
 * Une carte sans mécanique, ou dont la mécanique n'appartient à aucune région
 * connue, n'a pas de style régional — et c'est un cas normal, pas une erreur.
 */
export function styleRegionParMecanique(cleMecanique: Cle | null | undefined): StyleRegion | null {
  if (cleMecanique === null || cleMecanique === undefined || cleMecanique === '') return null;
  const fiche = chargerMecaniques().find((m) => m.cle === cleMecanique);
  if (!fiche) return null;
  return chargerStyleRegion(fiche.paysCode, fiche.regionCle);
}
