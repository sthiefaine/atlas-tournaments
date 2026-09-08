/**
 * **Le chantier** : quel asset produire maintenant, et pourquoi celui-là.
 *
 * Le catalogue en décrit 973 et un seul est livré. Les prendre dans l'ordre du
 * canon ne marche pas : un **kit national se peint sur la géométrie de base**
 * (`doc/11` §5.2 bis), et commander un kit avant sa base fait réclamer au
 * générateur un maillage qui n'existe pas. C'est arrivé trois fois de suite sur
 * `kit_fr_artillerie`, et c'est ce que ce module supprime — il n'y a plus à s'en
 * souvenir, l'ordre le sait.
 *
 * Deux règles, et rien d'autre :
 *
 * 1. un asset **bloqué** ne se propose jamais — un kit dont la base n'est pas
 *    livrée n'est pas « à faire », il est « en attente » ;
 * 2. à égalité, la **priorité** du canon décide, puis les géométries de base
 *    avant tout le reste : ce sont elles qui débloquent le plus d'autres.
 */

import { type AssetSpec } from '../assets/index';

/** Un asset à produire, et ce qui le retient s'il est retenu. */
export interface Etape {
  spec: AssetSpec;
  /** L'identifiant de l'asset qu'il faut livrer d'abord, ou `null`. */
  bloquePar: string | null;
}

/**
 * La géométrie de base sur laquelle un kit se peint, ou `null` si l'asset n'en
 * dépend pas. La clé d'un kit est `<code pays>_<clé d'unité>` : le code tient
 * en deux ou trois lettres, donc le premier segment.
 */
export function baseRequise(spec: AssetSpec): string | null {
  if (spec.type !== 'kit') return null;
  const separateur = spec.cle.indexOf('_');
  if (separateur < 0) return null;
  return `unite_${spec.cle.slice(separateur + 1)}_base`;
}

/** Le rang de tri : la priorité du canon, puis les bases avant le reste. */
function rang(spec: AssetSpec): number {
  return spec.priorite * 10 + (spec.type === 'unite' ? 0 : 1);
}

/**
 * Tout ce qui reste à produire, dans l'ordre où le produire, chaque entrée
 * disant ce qui la retient. Les livrés n'y sont pas.
 */
export function chantier(specs: readonly AssetSpec[], livres: ReadonlySet<string>): Etape[] {
  return specs
    .filter((s) => !livres.has(s.id))
    .map((spec) => {
      const base = baseRequise(spec);
      return { spec, bloquePar: base !== null && !livres.has(base) ? base : null };
    })
    .sort((a, b) => {
      // Ce qui est prêt passe avant ce qui attend, à quelque priorité que ce soit :
      // proposer un asset bloqué est précisément la faute qu'on corrige.
      if ((a.bloquePar === null) !== (b.bloquePar === null)) return a.bloquePar === null ? -1 : 1;
      const r = rang(a.spec) - rang(b.spec);
      return r !== 0 ? r : a.spec.id.localeCompare(b.spec.id);
    });
}

/** Le prochain asset à produire, ou `null` s'il ne reste rien de faisable. */
export function prochain(specs: readonly AssetSpec[], livres: ReadonlySet<string>): Etape | null {
  const suite = chantier(specs, livres);
  const pret = suite.find((e) => e.bloquePar === null);
  return pret ?? suite[0] ?? null;
}
