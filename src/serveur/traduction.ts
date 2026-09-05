/**
 * Validation d'une traduction, **chaîne par chaîne** (`09-i18n.md` §8.4).
 *
 * Un lot n'est jamais accepté ou refusé en bloc : ce qui passe est enregistré, ce
 * qui ne passe pas revient dans la file du run suivant. Le catalogue des motifs est
 * **fermé** ; ce sont des refus de la couche API, pas des `MotifRejet` — la routine
 * contrôle ne les voit jamais.
 *
 * Tout ici est pur : la validation se teste sans base.
 */

import type { EntreeGlossaire, ScriptLocale } from '../schemas/index';

/** Le catalogue fermé des motifs de refus d'une traduction. */
export const MOTIFS_TRADUCTION = [
  'placeholder_manquant', 'trop_long', 'glossaire_non_respecte',
  'terme_interdit', 'langue_incorrecte', 'source_modifiee', 'pluriel_incomplet',
] as const;

/** Motif de refus d'une traduction. */
export type MotifTraduction = typeof MOTIFS_TRADUCTION[number];

/** La chaîne source telle que le serveur la connaît. */
export interface SourceAValider {
  cle: string;
  texte: string;
  longueurMax: number | null;
  placeholders: string[];
  pluriel: boolean;
  sourceHash: string;
}

/** Ce que la routine propose : un texte, ou un objet de catégories de pluriel. */
export type TextePropose = string | Record<string, string>;

/** Le glossaire servi avec le lot. */
export interface GlossaireServi {
  termesInterdits: string[];
  entrees: EntreeGlossaire[];
}

/** Refus d'une chaîne, avec ce qu'il faut pour la corriger au run suivant. */
export interface RefusChaine {
  cle: string;
  motif: MotifTraduction;
  detail: string;
  attendu?: string[];
  trouve?: string[];
}

/** Décision sur une chaîne. */
export type DecisionChaine =
  | { ok: true; cle: string; texte: string }
  | { ok: false; refus: RefusChaine };

/** Les catégories de pluriel d'une langue, selon `Intl.PluralRules`. */
export function categoriesPluriel(locale: string): string[] {
  try {
    return [...new Intl.PluralRules(locale).resolvedOptions().pluralCategories];
  } catch {
    return ['other'];
  }
}

/** Extrait les marqueurs `{…}` d'un texte, doublons compris (l'ordre est ignoré). */
export function marqueurs(texte: string): string[] {
  return (texte.match(/\{[a-z][a-z0-9_]*\}/g) ?? []).slice().sort();
}

/** Vrai si le texte porte au moins un caractère du script attendu. */
export function scriptTenu(texte: string, script: ScriptLocale): boolean {
  const sansMarqueurs = texte.replace(/\{[a-z][a-z0-9_]*\}/g, '').trim();
  if (sansMarqueurs === '') return true;
  switch (script) {
    case 'cyrillique':
      return /[Ѐ-ӿ]/.test(sansMarqueurs);
    case 'han_simplifie':
      return /[一-鿿]/.test(sansMarqueurs);
    case 'kana_kanji':
      return /[぀-ヿ一-鿿]/.test(sansMarqueurs);
    case 'latin':
      // Une traduction latine qui n'emploie que du cyrillique ou du han est une
      // confusion de mission, pas une nuance de dialecte.
      return !/^[^\p{Script=Latin}]*$/u.test(sansMarqueurs) || /\d/.test(sansMarqueurs);
    default:
      return true;
  }
}

/** Normalise pour comparer sans se faire piéger par la casse ou les accents. */
function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * Vérifie le glossaire : un `terme_impose`, une `unite` ou un `terrain` présent
 * dans le français doit apparaître dans la traduction avec sa traduction imposée ;
 * un `nom_propre` se recopie, ou s'écrit avec sa translittération.
 */
export function glossaireRespecte(
  source: string,
  traduit: string,
  glossaire: GlossaireServi,
): { ok: true } | { ok: false; terme: string; attendu: string } {
  const src = normaliser(source);
  const trad = normaliser(traduit);
  for (const entree of glossaire.entrees) {
    if (!src.includes(normaliser(entree.terme))) continue;
    if (entree.categorie === 'nom_propre') {
      const formes = [entree.terme, entree.translitteration].filter((f): f is string => typeof f === 'string');
      if (!formes.some((f) => trad.includes(normaliser(f)))) {
        return { ok: false, terme: entree.terme, attendu: formes.join(' ou ') };
      }
      continue;
    }
    if (entree.traduction && !trad.includes(normaliser(entree.traduction))) {
      return { ok: false, terme: entree.terme, attendu: entree.traduction };
    }
  }
  return { ok: true };
}

/** Vrai si la traduction emploie un terme interdit. */
export function termeInterditTrouve(traduit: string, interdits: readonly string[]): string | null {
  const trad = normaliser(traduit);
  for (const terme of interdits) {
    if (terme.trim() === '') continue;
    if (trad.includes(normaliser(terme))) return terme;
  }
  return null;
}

/**
 * Valide une chaîne proposée. Renvoie le texte à enregistrer (un objet de
 * pluriels est sérialisé en JSON) ou le refus, avec son motif fermé.
 */
export function validerChaine(entree: {
  source: SourceAValider;
  propose: TextePropose;
  sourceHashRecu: string;
  locale: string;
  script: ScriptLocale;
  glossaire: GlossaireServi;
}): DecisionChaine {
  const { source, propose, locale, script, glossaire } = entree;
  const refus = (motif: MotifTraduction, detail: string, extra?: Partial<RefusChaine>): DecisionChaine =>
    ({ ok: false, refus: { cle: source.cle, motif, detail, ...extra } });

  // Verrou optimiste : le français a-t-il bougé entre le GET et le POST ?
  if (entree.sourceHashRecu !== source.sourceHash) {
    return refus('source_modifiee', 'le texte français a changé depuis la lecture du lot');
  }

  // Pluriel : un objet de catégories, exactement celles annoncées par la langue.
  let formes: string[];
  if (source.pluriel) {
    if (typeof propose !== 'object' || propose === null) {
      return refus('pluriel_incomplet', 'un objet de catégories de pluriel est attendu');
    }
    const attendues = categoriesPluriel(locale);
    const fournies = Object.keys(propose);
    const manquantes = attendues.filter((c) => typeof propose[c] !== 'string' || propose[c] === '');
    if (manquantes.length > 0) {
      return refus('pluriel_incomplet', `catégories manquantes : ${manquantes.join(', ')}`, {
        attendu: attendues, trouve: fournies,
      });
    }
    formes = attendues.map((c) => propose[c] ?? '');
  } else {
    if (typeof propose !== 'string') {
      return refus('pluriel_incomplet', 'cette chaîne n’est pas au pluriel : un texte simple est attendu');
    }
    formes = [propose];
  }

  for (const forme of formes) {
    // Marqueurs recopiés à l'identique : ni traduits, ni supprimés, ni dupliqués.
    const attendus = source.placeholders.slice().sort();
    const trouves = marqueurs(forme);
    if (attendus.join('|') !== trouves.join('|')) {
      return refus('placeholder_manquant', `les marqueurs ne correspondent pas au français`, {
        attendu: attendus, trouve: trouves,
      });
    }
    // Longueur : c'est une protection à la source, pas au rendu.
    if (source.longueurMax !== null && forme.length > source.longueurMax) {
      return refus('trop_long', `${forme.length} caractères pour ${source.longueurMax} au plus`);
    }
    if (!scriptTenu(forme, script)) {
      return refus('langue_incorrecte', `le texte n’est pas écrit dans le script ${script}`);
    }
    const interdit = termeInterditTrouve(forme, glossaire.termesInterdits);
    if (interdit !== null) {
      return refus('terme_interdit', `« ${interdit} » est interdit : le vocabulaire est celui du sport`);
    }
    const g = glossaireRespecte(source.texte, forme, glossaire);
    if (!g.ok) {
      return refus('glossaire_non_respecte', `« ${g.terme} » s’écrit « ${g.attendu} »`);
    }
  }

  const texte = source.pluriel ? JSON.stringify(propose) : formes[0] ?? '';
  return { ok: true, cle: source.cle, texte };
}

/**
 * Tire l'échantillon humain : une chaîne sur `echantillonHumain` part en
 * `brouillon` au lieu de `validee`, tant que la langue est `en_preparation`.
 * Le tirage est déterministe (empreinte de la clé), pour être reproductible.
 */
export function dansEchantillon(cle: string, echantillon: number): boolean {
  if (echantillon <= 0) return false;
  let h = 2166136261;
  for (let i = 0; i < cle.length; i += 1) {
    h ^= cle.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % echantillon === 0;
}

/** Bornes du lot de traduction (`09-i18n.md` §8.5). */
export const BORNES_LOT = { min: 10, max: 60, defaut: 60 } as const;
