/**
 * `mapgen/` — le générateur de cartes déterministe d'Atlas Tournament.
 *
 * La routine map apporte l'intention (`ParametresCarte`), le code apporte la
 * validité (`02-architecture.md` §3.3). Trois entrées publiques suffisent :
 *
 * ```ts
 * import { genererCarte, verifierCarte, apercuTexte } from '@/mapgen';
 *
 * const carte = genererCarte(parametres, 1832771904); // MapDef complète
 * const rapport = verifierCarte(carte);               // { ok, motifs[] }
 * const texte = apercuTexte(carte);                   // aperçu à commenter
 * ```
 *
 * Garanties :
 * - **Déterminisme.** Mêmes paramètres et même graine donnent le même `MapDef`,
 *   au bit près après `JSON.stringify`. Aucune horloge, aucun `Math.random`,
 *   aucune itération d'objet sans ordre explicite (`02-architecture.md` §7).
 * - **Équité démontrable.** La carte est invariante sous un groupe d'isométries
 *   qui envoie le QG de chaque camp sur celui d'un autre : les valeurs
 *   économiques des camps sont égales par construction, pas par mesure.
 * - **Jouabilité.** Tout QG rejoint tout autre QG et toute usine par voie
 *   terrestre, en infanterie comme en blindé ; aucune case de terre n'est
 *   inatteignable ; aucune propriété n'est plus proche d'un QG adverse que du sien.
 * - **Aucun refus.** Les paramètres hors bornes sont ramenés dans les bornes du
 *   schéma et les effectifs réduits à ce que la surface accepte ; les paramètres
 *   réellement appliqués sont recopiés dans `MapDef.generation.parametres`.
 *
 * Le générateur n'importe que `schemas/` et `content/` (`02-architecture.md` §5),
 * et embarque son propre RNG seedé en attendant celui du moteur (`rng.ts`).
 */

export { genererCarte, MAPGEN_VERSION, DATE_GENERATION } from './generer';
export { verifierCarte, mesurer, toileDepuisMapDef, ECART_VALEUR_MAX, DISTANCE_USINE_MAX } from './verifier';
export type { MotifVerification, RapportVerification } from './verifier';
export { apercuTexte } from './apercu';
export { creerRng, hacher } from './rng';
export type { Rng } from './rng';
export { normaliser, versParametresCarte, reglagesDe } from './parametres';
export type { ParametresNormalises, ReglagesBiome } from './parametres';
export { choisirMotif, creerCadre, creerCadreTrivial } from './symetrie';
export type { Cadre, MotifSymetrie } from './symetrie';

export { PROFILS_BIOME } from './parametres';
export type { ProfilBiome } from './parametres';
