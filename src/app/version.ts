/**
 * La mention de version de l'écran-titre et des réglages : la date et l'heure
 * de la **mise en ligne**, et le début du commit qui la porte.
 *
 * Les deux valeurs sont calculées **au build** par `next.config.ts` (`env`) et
 * inscrites dans les bundles : elles changent à chaque `next build`, donc à
 * chaque push déployé par Coolify, sans aucune action GitHub. En développement,
 * c'est l'heure de lancement du serveur. Sans variables (un test, un bundle
 * ancien), la mention est vide et la page n'affiche rien plutôt qu'une date
 * inventée.
 *
 * L'heure est celle de Paris, fixe : le tampon dit quand *le serveur* a mis en
 * ligne, pas où se trouve le visiteur, et deux joueurs qui comparent un bug
 * doivent lire la même chaîne (tranché le 7 septembre 2026 par deux personas,
 * un joueur novateur et un ado : date et heure, commit court, pas de préfixe).
 */

import { t } from '@/i18n/index';

/** Ce que le build a laissé : l'instant ISO de la mise en ligne, le commit court. */
export interface VersionBuild {
  date: string | null;
  commit: string;
}

/** Les deux variables telles que `next.config.ts` les pose. */
export interface VariablesVersion {
  ATLAS_VERSION_DATE?: string | undefined;
  ATLAS_VERSION_COMMIT?: string | undefined;
}

/**
 * Lit la version laissée par le build. Sans argument, elle lit `process.env`
 * par accès direct — c'est cette forme que Next remplace à la compilation.
 */
export function versionBuild(variables?: VariablesVersion): VersionBuild {
  const date = variables ? variables.ATLAS_VERSION_DATE : process.env.ATLAS_VERSION_DATE;
  const commit = variables ? variables.ATLAS_VERSION_COMMIT : process.env.ATLAS_VERSION_COMMIT;
  const valide = typeof date === 'string' && !Number.isNaN(new Date(date).getTime());
  return {
    date: valide ? date : null,
    commit: typeof commit === 'string' && /^[0-9a-f]{7,40}$/i.test(commit) ? commit.slice(0, 7) : '',
  };
}

/** « 7 sept. 2026, 21:14 », à l'heure de Paris ; vide si l'instant est illisible. */
export function formaterHorodatage(iso: string, locale = 'fr'): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : locale, {
    timeZone: 'Europe/Paris', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(instant);
}

/**
 * Le libellé affiché, par la clé d'écran (`accueil` ou `reglages`) : avec le
 * commit quand il existe, la date seule sinon, rien du tout sans date.
 */
export function libelleVersion(locale: string, ecran: 'accueil' | 'reglages', version: VersionBuild): string {
  if (version.date === null) return '';
  const date = formaterHorodatage(version.date, locale);
  if (date === '') return '';
  return version.commit === ''
    ? t(locale, `${ecran}.version_sans_commit`, { date })
    : t(locale, `${ecran}.version`, { date, commit: version.commit });
}
