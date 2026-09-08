/**
 * `t()` — la résolution d'une clé à l'écran, côté client comme côté serveur
 * (`09-i18n.md` §4).
 *
 * L'ordre de repli est unique et sans exception :
 *
 *     langue demandée  →  en  →  fr (la source, toujours présente)
 *
 * et **une clé brute ne s'affiche jamais**. Quand tout manque — cas qui ne devrait
 * pas exister, puisque c'est la chaîne source qui crée la ligne —, `t()` renvoie
 * une chaîne vide et journalise un incident : le rendu affiche un espace, pas
 * `hud.fin_de_tour`.
 *
 * Le repli entre langues est normalement **déjà appliqué par le serveur** à la
 * construction du bundle ; celui d'ici est la ceinture qui va avec les bretelles,
 * pour le cas d'un bundle partiel ou d'un chargement interrompu.
 *
 * Cette couche n'importe que `schemas` (`02-architecture.md` §5).
 */

import { SOURCE_FR, chaineSource } from './source';

export { CHAINES_INTERFACE, SOURCE_FR, chaineSource } from './source';
export type { ChaineInterface } from './source';

/** Un bundle : un dictionnaire plat `{ cleChaine: texte }`. */
export type Bundle = Readonly<Record<string, string>>;

/** Paramètres de substitution d'une chaîne : `{n}`, `{unite}`, `{pays}`. */
export type Params = Record<string, string | number>;

/** Un incident de résolution : une clé qui n'existe nulle part. */
export interface IncidentI18n {
  cle: string;
  locale: string;
  quand: string;
}

const bundles = new Map<string, Bundle>([['fr', SOURCE_FR]]);
const incidents: IncidentI18n[] = [];

/** Enregistre (ou remplace) le bundle d'une langue. Le rendu salit ensuite la scène. */
export function enregistrerBundle(locale: string, bundle: Bundle): void {
  bundles.set(locale, Object.freeze({ ...bundle }));
}

/** Le bundle d'une langue, ou `undefined` s'il n'est pas chargé. */
export function bundleDe(locale: string): Bundle | undefined {
  return bundles.get(locale);
}

/** Les langues dont le bundle est chargé. */
export function languesChargees(): string[] {
  return [...bundles.keys()];
}

/** Oublie un bundle. Sert aux tests et au changement de `chainesVersion`. */
export function oublierBundle(locale: string): void {
  if (locale !== 'fr') bundles.delete(locale);
}

/** Les incidents relevés depuis le démarrage : la métrique « clé brute à l'écran ». */
export function incidentsI18n(): readonly IncidentI18n[] {
  return incidents;
}

/** Remet le compteur d'incidents à zéro. */
export function viderIncidents(): void {
  incidents.length = 0;
}

/** La chaîne de repli d'une locale : `xx-yy → xx → en → fr`. */
export function chaineDeRepli(locale: string): string[] {
  const etapes: string[] = [locale];
  const tiret = locale.indexOf('-');
  if (tiret > 0) etapes.push(locale.slice(0, tiret));
  if (!etapes.includes('en')) etapes.push('en');
  if (!etapes.includes('fr')) etapes.push('fr');
  return etapes;
}

/** Remplace les marqueurs `{nom}` par leur valeur. Un marqueur sans valeur reste tel quel. */
export function substituer(texte: string, params?: Params): string {
  if (!params) return texte;
  return texte.replace(/\{([a-z][a-z0-9_]*)\}/g, (entier, nom: string) => {
    const valeur = params[nom];
    return valeur === undefined ? entier : String(valeur);
  });
}

/**
 * Résout une clé sans substitution ni pluriel. Rend `null` si aucune étape du
 * repli ne connaît la clé — c'est l'appelant qui décide quoi en faire.
 */
export function resoudre(locale: string, cle: string): string | null {
  for (const etape of chaineDeRepli(locale)) {
    const texte = bundles.get(etape)?.[cle];
    if (typeof texte === 'string' && texte !== '') return texte;
  }
  const source = SOURCE_FR[cle];
  return typeof source === 'string' ? source : null;
}

/**
 * La fonction de traduction. **Ne renvoie jamais la clé.**
 *
 * Une valeur stockée comme objet de catégories de pluriel (`{"one":…,"other":…}`)
 * est résolue par `Intl.PluralRules` sur `params.n`.
 */
export function t(locale: string, cle: string, params?: Params): string {
  const brut = resoudre(locale, cle);
  if (brut === null) {
    incidents.push({ cle, locale, quand: new Date().toISOString() });
    return '';
  }
  let texte = brut;
  if (texte.startsWith('{"') && texte.endsWith('}')) {
    // Une chaîne à pluriel est stockée en JSON de catégories (`09-i18n.md` §7.1).
    try {
      const formes = JSON.parse(texte) as Record<string, string>;
      const n = Number(params?.['n'] ?? 0);
      const categorie = categorieDe(locale, n);
      texte = formes[categorie] ?? formes['other'] ?? brut;
    } catch {
      texte = brut;
    }
  }
  return substituer(texte, params);
}

/** La catégorie de pluriel d'un nombre dans une langue. */
export function categorieDe(locale: string, n: number): string {
  try {
    return new Intl.PluralRules(locale).select(n);
  } catch {
    return 'other';
  }
}

/** Les nombres du HUD utilisent les mêmes réglages à chaque image. Cache borné. */
const formatsNombres = new Map<string, Intl.NumberFormat>();
const MAX_FORMATS_NOMBRES = 32;

/** Formate un nombre selon la langue : `38 400` en français, `38,400` en anglais. */
export function nombre(locale: string, valeur: number, options?: Intl.NumberFormatOptions): string {
  // Les options personnalisées restent rares ; on conserve leur sémantique
  // complète (y compris les accesseurs) sans construire de clé approximative.
  if (options !== undefined) {
    try { return new Intl.NumberFormat(locale, options).format(valeur); }
    catch { return new Intl.NumberFormat('fr', options).format(valeur); }
  }
  let format = formatsNombres.get(locale);
  if (!format) {
    try { format = new Intl.NumberFormat(locale); }
    catch { format = new Intl.NumberFormat('fr'); }
    if (formatsNombres.size >= MAX_FORMATS_NOMBRES) formatsNombres.clear();
    formatsNombres.set(locale, format);
  }
  return format.format(valeur);
}

/**
 * Formate une date de match. La date vient de `Scenario.date`, jamais de
 * `Date.now()` — le rendu ne connaît pas l'heure courante.
 */
export function date(locale: string, jourIso: string, options?: Intl.DateTimeFormatOptions): string {
  const d = new Date(`${jourIso}T00:00:00Z`);
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'UTC', dateStyle: 'long', ...options };
  try {
    return new Intl.DateTimeFormat(locale, opts).format(d);
  } catch {
    return new Intl.DateTimeFormat('fr', opts).format(d);
  }
}

/** Formate une liste : « la Bretagne, la Corse et la Réunion ». */
export function liste(locale: string, valeurs: readonly string[]): string {
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(valeurs);
  } catch {
    return valeurs.join(', ');
  }
}

/**
 * La longueur maximale d'une chaîne dans une langue cible : la borne de la source,
 * corrigée par le facteur de longueur de la langue (`09-i18n.md` §2.2).
 */
export function longueurMaxCible(cle: string, facteurLongueur: number): number | null {
  const source = chaineSource(cle);
  if (!source || source.longueurMax === null) return null;
  return Math.max(1, Math.round(source.longueurMax * Math.max(0.5, facteurLongueur)));
}

/** Un `t()` déjà lié à une langue : ce que le rendu garde en main. */
export function traducteur(locale: string): (cle: string, params?: Params) => string {
  return (cle, params) => t(locale, cle, params);
}
