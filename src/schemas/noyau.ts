/**
 * Noyau de validation : les combinateurs communs à tous les validateurs.
 * Écrit à la main, sans aucune dépendance (`02-architecture.md` §5).
 *
 * Convention : un combinateur renvoie la valeur lue, ou `undefined` s'il n'a rien
 * pu lire, et consigne au passage une erreur `{ chemin, message }` dans le contexte.
 * Le chemin suit la forme `unites[3].cout`, le message est en français.
 */

import {
  REGEX_CLE, REGEX_CODE_PAYS, REGEX_COULEUR, REGEX_DATE_ISO, REGEX_FLAG,
  type Case, type Cle, type CodePays, type Couleur, type DateIso, type Palette,
} from './types';

/** Une erreur de validation : où, et quoi. */
export interface Erreur { chemin: string; message: string }

/** Résultat uniforme de tout validateur : la valeur typée, ou la liste des erreurs. */
export type Resultat<T> = { ok: true; valeur: T } | { ok: false; erreurs: Erreur[] };

/** Contexte d'une validation : accumule les erreurs rencontrées. */
export class Contexte {
  readonly erreurs: Erreur[] = [];

  /** Consigne une erreur à ce chemin. */
  faute(chemin: string, message: string): void {
    this.erreurs.push({ chemin, message });
  }

  /** Vrai si aucune erreur n'a encore été consignée. */
  get intact(): boolean {
    return this.erreurs.length === 0;
  }
}

/** Compose le résultat final d'un validateur à partir du contexte. */
export function conclure<T>(ctx: Contexte, valeur: T): Resultat<T> {
  if (ctx.erreurs.length > 0) return { ok: false, erreurs: ctx.erreurs };
  return { ok: true, valeur };
}

/** Joint un chemin parent à un segment : `unites` + `3` → `unites[3]`. */
export function sous(chemin: string, segment: string | number): string {
  if (typeof segment === 'number') return `${chemin}[${segment}]`;
  return chemin === '' ? segment : `${chemin}.${segment}`;
}

/** Vrai si la valeur est un objet simple (ni tableau, ni null). */
export function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Vrai si la propriété est présente et renseignée. */
export function presente(o: Record<string, unknown>, cle: string): boolean {
  return cle in o && o[cle] !== undefined;
}

/** Lit un objet et refuse toute clé non prévue par le schéma (`champ_inconnu`). */
export function objet(
  ctx: Contexte,
  v: unknown,
  chemin: string,
  clesConnues: readonly string[],
): Record<string, unknown> | undefined {
  if (!estObjet(v)) {
    ctx.faute(chemin, 'un objet est attendu');
    return undefined;
  }
  for (const cle of Object.keys(v)) {
    if (!clesConnues.includes(cle)) ctx.faute(sous(chemin, cle), 'champ inconnu, refusé par le schéma');
  }
  return v;
}

/** Vérifie qu'aucun champ requis ne manque ; renvoie vrai si tous sont là. */
export function requis(
  ctx: Contexte,
  o: Record<string, unknown>,
  chemin: string,
  cles: readonly string[],
): boolean {
  let complet = true;
  for (const cle of cles) {
    if (!presente(o, cle)) {
      ctx.faute(sous(chemin, cle), 'champ obligatoire manquant');
      complet = false;
    }
  }
  return complet;
}

/** Lit une chaîne, avec longueurs et forme facultatives. */
export function chaine(
  ctx: Contexte,
  v: unknown,
  chemin: string,
  options: { min?: number; max?: number; regex?: RegExp; forme?: string } = {},
): string | undefined {
  if (typeof v !== 'string') {
    ctx.faute(chemin, 'une chaîne de caractères est attendue');
    return undefined;
  }
  const min = options.min ?? 1;
  if (v.length < min) {
    ctx.faute(chemin, `chaîne trop courte : ${min} caractère(s) au moins`);
    return undefined;
  }
  if (options.max !== undefined && v.length > options.max) {
    ctx.faute(chemin, `chaîne trop longue : ${options.max} caractères au plus, ${v.length} reçus`);
    return undefined;
  }
  if (options.regex && !options.regex.test(v)) {
    ctx.faute(chemin, `forme invalide : ${options.forme ?? options.regex.source} attendu`);
    return undefined;
  }
  return v;
}

/** Lit un nombre fini, avec bornes facultatives. */
export function nombre(
  ctx: Contexte,
  v: unknown,
  chemin: string,
  options: { min?: number; max?: number } = {},
): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    ctx.faute(chemin, 'un nombre est attendu');
    return undefined;
  }
  if (options.min !== undefined && v < options.min) {
    ctx.faute(chemin, `valeur hors bornes : ${options.min} au minimum, ${v} reçu`);
    return undefined;
  }
  if (options.max !== undefined && v > options.max) {
    ctx.faute(chemin, `valeur hors bornes : ${options.max} au maximum, ${v} reçu`);
    return undefined;
  }
  return v;
}

/** Lit un entier, avec bornes et pas facultatifs. */
export function entier(
  ctx: Contexte,
  v: unknown,
  chemin: string,
  options: { min?: number; max?: number; multiple?: number } = {},
): number | undefined {
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    ctx.faute(chemin, 'un entier est attendu');
    return undefined;
  }
  const n = nombre(ctx, v, chemin, options);
  if (n === undefined) return undefined;
  if (options.multiple !== undefined && n % options.multiple !== 0) {
    ctx.faute(chemin, `doit être un multiple de ${options.multiple}, ${n} reçu`);
    return undefined;
  }
  return n;
}

/** Lit un booléen. */
export function booleen(ctx: Contexte, v: unknown, chemin: string): boolean | undefined {
  if (typeof v !== 'boolean') {
    ctx.faute(chemin, 'un booléen est attendu');
    return undefined;
  }
  return v;
}

/** Lit une valeur d'énumération fermée. */
export function enumeration<T extends string>(
  ctx: Contexte,
  v: unknown,
  chemin: string,
  valeurs: readonly T[],
): T | undefined {
  if (typeof v !== 'string' || !(valeurs as readonly string[]).includes(v)) {
    ctx.faute(chemin, `valeur hors énumération : ${valeurs.join(', ')}`);
    return undefined;
  }
  return v as T;
}

/** Lit un tableau borné ; les éléments illisibles sont écartés, leurs erreurs consignées. */
export function tableau<T>(
  ctx: Contexte,
  v: unknown,
  chemin: string,
  options: { min?: number; max?: number },
  element: (valeur: unknown, chemin: string) => T | undefined,
): T[] | undefined {
  if (!Array.isArray(v)) {
    ctx.faute(chemin, 'un tableau est attendu');
    return undefined;
  }
  if (options.min !== undefined && v.length < options.min) {
    ctx.faute(chemin, `tableau trop court : ${options.min} entrée(s) au moins, ${v.length} reçue(s)`);
  }
  if (options.max !== undefined && v.length > options.max) {
    ctx.faute(chemin, `tableau trop long : ${options.max} entrée(s) au plus, ${v.length} reçue(s)`);
  }
  const lues: T[] = [];
  for (let i = 0; i < v.length; i += 1) {
    const lu = element(v[i], sous(chemin, i));
    if (lu !== undefined) lues.push(lu);
  }
  return lues;
}

/** Refuse les doublons dans un tableau de valeurs comparables. */
export function sansDoublon(ctx: Contexte, valeurs: readonly unknown[], chemin: string): void {
  const vus = new Set<string>();
  for (let i = 0; i < valeurs.length; i += 1) {
    const empreinte = JSON.stringify(valeurs[i]);
    if (vus.has(empreinte)) ctx.faute(sous(chemin, i), 'doublon interdit dans ce tableau');
    vus.add(empreinte);
  }
}

/** Lit une `Cle` : minuscules, chiffres et tirets bas. */
export function cle(ctx: Contexte, v: unknown, chemin: string): Cle | undefined {
  return chaine(ctx, v, chemin, { regex: REGEX_CLE, forme: 'identifiant en minuscules (^[a-z][a-z0-9_]{1,47}$)' });
}

/** Lit un `CodePays` : deux lettres minuscules. */
export function codePays(ctx: Contexte, v: unknown, chemin: string): CodePays | undefined {
  return chaine(ctx, v, chemin, { regex: REGEX_CODE_PAYS, forme: 'code ISO 3166-1 alpha-2 en minuscules' });
}

/** Lit une `DateIso` et vérifie qu'elle désigne un jour réel. */
export function dateIso(ctx: Contexte, v: unknown, chemin: string): DateIso | undefined {
  const texte = chaine(ctx, v, chemin, { regex: REGEX_DATE_ISO, forme: 'date ISO 8601 (AAAA-MM-JJ)' });
  if (texte === undefined) return undefined;
  const d = new Date(`${texte}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== texte) {
    ctx.faute(chemin, 'date inexistante au calendrier');
    return undefined;
  }
  return texte;
}

/** Lit une clé de flag et vérifie la convention de portée. */
export function cleFlag(ctx: Contexte, v: unknown, chemin: string): Cle | undefined {
  return chaine(ctx, v, chemin, {
    regex: REGEX_FLAG,
    forme: 'clé de flag pays.<iso2>.<nom>, monde.<domaine>.<nom> ou cmd.<id>.<nom>',
  });
}

/** Lit une `Couleur` hexadécimale. */
export function couleur(ctx: Contexte, v: unknown, chemin: string): Couleur | undefined {
  return chaine(ctx, v, chemin, { regex: REGEX_COULEUR, forme: 'couleur hexadécimale minuscule (#3f86e0)' });
}

/** Lit une `Palette` et refuse deux couleurs identiques. */
export function palette(ctx: Contexte, v: unknown, chemin: string): Palette | undefined {
  const o = objet(ctx, v, chemin, ['main', 'dark', 'light']);
  if (!o || !requis(ctx, o, chemin, ['main', 'dark', 'light'])) return undefined;
  const main = couleur(ctx, o['main'], sous(chemin, 'main'));
  const dark = couleur(ctx, o['dark'], sous(chemin, 'dark'));
  const light = couleur(ctx, o['light'], sous(chemin, 'light'));
  if (main === undefined || dark === undefined || light === undefined) return undefined;
  if (new Set([main, dark, light]).size !== 3) {
    ctx.faute(chemin, 'les trois couleurs de la palette doivent être distinctes');
    return undefined;
  }
  return { main, dark, light };
}

/** Lit une `Case` : deux entiers positifs. */
export function caseGrille(ctx: Contexte, v: unknown, chemin: string): Case | undefined {
  const o = objet(ctx, v, chemin, ['x', 'y']);
  if (!o || !requis(ctx, o, chemin, ['x', 'y'])) return undefined;
  const x = entier(ctx, o['x'], sous(chemin, 'x'), { min: 0, max: 99 });
  const y = entier(ctx, o['y'], sous(chemin, 'y'), { min: 0, max: 99 });
  if (x === undefined || y === undefined) return undefined;
  return { x, y };
}
