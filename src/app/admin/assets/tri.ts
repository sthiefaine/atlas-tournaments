/**
 * Ce que la section « Assets » de l'administration sait faire **sans React** :
 * lire des filtres depuis l'URL, décider du territoire d'une spécification,
 * filtrer, compter, et comparer le catalogue au dossier `assets/specs/`.
 *
 * La page ne fait que présenter ce qui sort d'ici. C'est ce qui rend la logique
 * testable en Node (`tests/app/assets-tri.test.ts`) alors que la page, elle, ne
 * se rend qu'à l'intérieur de Next.
 */

import {
  PRIORITES, TYPES_ASSET, type AssetSpec, type Priorite, type TypeAsset,
} from '@/assets/index';
import { REGEX_CODE_PAYS, type Cle, type CodePays } from '@/schemas/index';

/** Les filtres que l'URL de la liste accepte, déjà validés. */
export interface FiltresAssets {
  type: TypeAsset | null;
  priorite: Priorite | null;
  /** Un code pays, ou `partage` pour ce qui n'appartient à aucune nation. */
  pays: CodePays | 'partage' | null;
  /** Sous-chaîne cherchée dans l'identifiant, en minuscules. */
  recherche: string;
}

/** Le territoire d'une spécification : une nation, éventuellement une région, ou rien. */
export interface TerritoireAsset {
  pays: CodePays | null;
  /** Le nom court de la région (`bretagne`), jamais sa clé complète. */
  region: Cle | null;
}

/**
 * Le statut de livraison de **toute** spécification aujourd'hui. Aucun `.glb`
 * réel n'a jamais été livré ni enregistré nulle part (`CLAUDE.md`, manque n° 5) :
 * il n'existe ni table, ni dossier, ni champ à consulter. Quand une livraison
 * existera, c'est ici qu'on la lira — et nulle part ailleurs dans la page.
 */
export const STATUT_LIVRAISON = 'placeholder' as const;

/** Libellés des familles d'assets, dans le vocabulaire de `doc/11` §3.1. */
export const LIBELLES_TYPE: Record<TypeAsset, string> = {
  unite: 'Géométrie de base',
  kit: 'Kit national',
  terrain: 'Terrain',
  batiment: 'Bâtiment',
  decor: 'Décor',
  commandant: 'Buste de commandant',
  effet: 'Effet',
};

/** Ce que chaque priorité de production contient (`doc/11` §3.1 bis). */
export const LIBELLES_PRIORITE: Record<Priorite, string> = {
  1: 'France, Luxembourg, Suisse et le partagé',
  2: 'Autres pays phares et reste de l’Europe',
  3: 'Les seize autres nations',
};

/** Ce que l'URL peut porter : des chaînes, ou rien. */
export type ParametresBruts = Record<string, string | string[] | undefined>;

/**
 * Lit les filtres de l'URL en refusant tout ce qui n'est pas dans une liste
 * fermée : un `?type=` inconnu vaut « pas de filtre », pas une erreur, parce
 * qu'un lien périmé ne doit pas casser une page d'administration.
 */
export function lireFiltres(params: ParametresBruts, codesPays: ReadonlySet<string>): FiltresAssets {
  const un = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
  const type = un(params['type']);
  const priorite = Number(un(params['priorite']));
  const pays = un(params['pays']);
  return {
    type: (TYPES_ASSET as readonly string[]).includes(type ?? '') ? (type as TypeAsset) : null,
    priorite: (PRIORITES as readonly number[]).includes(priorite) ? (priorite as Priorite) : null,
    pays: pays === 'partage' ? 'partage' : pays !== undefined && codesPays.has(pays) ? (pays as CodePays) : null,
    recherche: (un(params['q']) ?? '').trim().toLowerCase().slice(0, 48),
  };
}

/**
 * Déduit le territoire d'une spécification de la **forme de sa clé**, telle que
 * `catalogue.ts` la compose : `fr_char_leger` pour un kit, `ville_fr_bretagne`
 * ou `ville_jp` pour un bâtiment, `arbre_cotier_fr_bretagne` ou `arbre_desert_ma`
 * pour un arbre. Le catalogue ne garde pas le territoire dans la spécification —
 * le générateur externe n'en a pas besoin —, et le rejouer ici évite d'y ajouter
 * un champ que personne d'autre ne lirait.
 *
 * Un segment qui ressemble à un code pays mais n'en est pas un (une clé exotique,
 * une unité homologuée nommée `xx_…`) vaut « aucun territoire » plutôt qu'une
 * attribution fausse.
 */
export function territoireDe(spec: AssetSpec, codesPays: ReadonlySet<string>): TerritoireAsset {
  const parts = spec.cle.split('_');
  const depuis = (i: number, avecRegion: boolean): TerritoireAsset => {
    const code = parts[i];
    if (code === undefined || !REGEX_CODE_PAYS.test(code) || !codesPays.has(code)) {
      return { pays: null, region: null };
    }
    const reste = parts.slice(i + 1).join('_');
    return { pays: code as CodePays, region: avecRegion && reste !== '' ? reste : null };
  };
  switch (spec.type) {
    // Un kit est national, jamais régional : ce qui suit le code est l'unité.
    case 'kit': return depuis(0, false);
    case 'batiment': return depuis(1, true);
    // `arbre_<biome>_<territoire>` porte un pays ; `rocher_<biome>` est géologique.
    case 'decor': return parts[0] === 'arbre' ? depuis(2, true) : { pays: null, region: null };
    default: return { pays: null, region: null };
  }
}

/** Applique les filtres, sans changer l'ordre du catalogue (trié par identifiant). */
export function filtrerSpecs(
  specs: readonly AssetSpec[], filtres: FiltresAssets, codesPays: ReadonlySet<string>,
): AssetSpec[] {
  return specs.filter((s) => {
    if (filtres.type !== null && s.type !== filtres.type) return false;
    if (filtres.priorite !== null && s.priorite !== filtres.priorite) return false;
    if (filtres.pays !== null) {
      const pays = territoireDe(s, codesPays).pays;
      if (filtres.pays === 'partage' ? pays !== null : pays !== filtres.pays) return false;
    }
    if (filtres.recherche !== '' && !s.id.includes(filtres.recherche)) return false;
    return true;
  });
}

/** Compte les spécifications par pays ; la clé `partage` reçoit ce qui n'a pas de nation. */
export function compterParPays(
  specs: readonly AssetSpec[], codesPays: ReadonlySet<string>,
): Map<CodePays | 'partage', number> {
  const comptes = new Map<CodePays | 'partage', number>();
  for (const s of specs) {
    const cle = territoireDe(s, codesPays).pays ?? 'partage';
    comptes.set(cle, (comptes.get(cle) ?? 0) + 1);
  }
  return comptes;
}

/** L'écart entre le catalogue et un dossier de fichiers `<id>.json`. */
export interface EcartDossier {
  manquants: string[];
  enTrop: string[];
}

/**
 * Compare les identifiants du canon aux fichiers d'un dossier, comme le fait
 * `generer-specs-assets.ts --verifier` — sans lire le contenu : la page compte,
 * le script seul décide qu'un fichier est périmé.
 */
export function comparerAuDossier(ids: readonly string[], fichiers: readonly string[]): EcartDossier {
  const attendus = new Set(ids.map((id) => `${id}.json`));
  const presents = new Set(fichiers.filter((f) => f.endsWith('.json')));
  return {
    manquants: [...attendus].filter((f) => !presents.has(f)).sort(),
    enTrop: [...presents].filter((f) => !attendus.has(f)).sort(),
  };
}

/** Construit l'URL de la liste pour un jeu de filtres, sans paramètre vide. */
export function urlListe(filtres: Partial<FiltresAssets>): string {
  const p = new URLSearchParams();
  if (filtres.type) p.set('type', filtres.type);
  if (filtres.priorite) p.set('priorite', String(filtres.priorite));
  if (filtres.pays) p.set('pays', filtres.pays);
  if (filtres.recherche) p.set('q', filtres.recherche);
  const q = p.toString();
  return q === '' ? '/admin/assets' : `/admin/assets?${q}`;
}
