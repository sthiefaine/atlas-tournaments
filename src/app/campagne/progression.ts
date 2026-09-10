/** Progression de la qualification locale : aucune autorité sur un classement en ligne. */
import type { Mode } from '../../schemas/types';
import { VERSION_CANON_AUBE, cleDecision, optionsDecision } from './consequences';
import { cleSourceBanc } from './bancs';
import { cleProgression, profilActif, type Profil } from '../preferences';

export interface DecisionLocale {
  scenario: string;
  scenarioVersion: number;
  canonVersion: number;
  choix: string;
}
export interface Progression {
  version: 1;
  victoires: string[];
  victoiresParMode?: Partial<Record<Mode, string[]>>;
  canonVersion?: number;
  decisions?: Record<string, DecisionLocale>;
  journal?: string[];
}
const vide = (): Progression => ({ version: 1, victoires: [] });

// La mémoire de session ne vaut que pour **un** profil : basculer de A à B
// doit rendre la progression de B, même quand le stockage refuse de répondre.
let session: Progression = vide();
let sessionProfil: Profil | null = null;

export function normaliserProgression(brut: unknown): Progression {
  if (!brut || typeof brut !== 'object') return vide();
  const p = brut as Partial<Progression>;
  if (p.version !== 1 || !Array.isArray(p.victoires)) return vide();
  const resultat: Progression = { version: 1, victoires: [...new Set(p.victoires.filter((x): x is string => typeof x === 'string' && /^[a-z][a-z0-9_]{1,47}$/.test(x)))] };
  if (p.victoiresParMode && typeof p.victoiresParMode === 'object') {
    resultat.victoiresParMode = {};
    for (const mode of ['normal', 'difficile'] as const) {
      const liste = p.victoiresParMode[mode];
      if (Array.isArray(liste)) resultat.victoiresParMode[mode] = [...new Set(liste.filter((code) => typeof code === 'string' && resultat.victoires.includes(code)))];
    }
  }
  const lireDecision = (d: unknown): DecisionLocale | null => {
    if (!d || typeof d !== 'object') return null;
    const x = d as Partial<DecisionLocale>;
    if (typeof x.scenario !== 'string' || !Number.isInteger(x.scenarioVersion) || (x.scenarioVersion ?? 0) < 1
      || x.canonVersion !== VERSION_CANON_AUBE || !optionsDecision(x.scenario).some((o) => o.cle === x.choix)) return null;
    return { scenario: x.scenario, scenarioVersion: x.scenarioVersion!, canonVersion: VERSION_CANON_AUBE, choix: x.choix! };
  };
  if (p.decisions && typeof p.decisions === 'object') {
    resultat.decisions = {};
    for (const brut of Object.values(p.decisions)) {
      const d = lireDecision(brut);
      if (d) resultat.decisions[cleDecision(d.scenario, d.scenarioVersion)] = d;
    }
    resultat.canonVersion = VERSION_CANON_AUBE;
    resultat.journal = Array.isArray(p.journal)
      ? [...new Set(p.journal.filter((cle) => typeof cle === 'string' && Object.hasOwn(resultat.decisions!, cle)))] : [];
  }
  return resultat;
}

/** La progression du profil actif. La clé dépend du profil (`preferences.ts`). */
export function lireProgression(profil: Profil = profilActif()): Progression {
  if (profil !== sessionProfil) { session = vide(); sessionProfil = profil; }
  try {
    const texte = localStorage.getItem(cleProgression(profil));
    // Une clé absente est une progression vide, pas « la dernière lue » : sinon
    // un profil neuf hériterait en mémoire des victoires de l'autre.
    session = texte ? normaliserProgression(JSON.parse(texte)) : vide();
  } catch { /* Le carnet reste utilisable en mémoire si le stockage est refusé. */ }
  return session;
}

/**
 * Les victoires d'un profil **nommé**, sans toucher au profil actif ni à la
 * mémoire de session.
 *
 * `lireProgression` ne sait lire que le profil courant, et c'est ce qu'il faut
 * partout ailleurs. L'écran-titre, lui, doit montrer les **deux** sauvegardes
 * avant que le joueur n'en choisisse une : il ne peut pas basculer le profil
 * actif pour lire l'autre, ce serait changer l'état de l'appareil pour afficher
 * une ligne.
 */
export function victoiresDe(profil: Profil): readonly string[] {
  try {
    const texte = localStorage.getItem(cleProgression(profil));
    return texte ? normaliserProgression(JSON.parse(texte)).victoires : [];
  } catch {
    // Stockage refusé : une sauvegarde illisible est une sauvegarde vide, et
    // l'écran reste utilisable.
    return [];
  }
}

export function enregistrerVictoire(code: string, profil: Profil = profilActif(), mode: Mode = 'normal'): boolean {
  const progression = lireProgression(profil);
  const parMode = progression.victoiresParMode ?? { normal: progression.victoires };
  session = normaliserProgression({ ...progression, victoires: [...progression.victoires, code],
    victoiresParMode: { ...parMode, [mode]: [...(parMode[mode] ?? []), code] } });
  try { localStorage.setItem(cleProgression(profil), JSON.stringify(session)); return true; }
  catch { return false; }
}

export function missionOuverte(codes: readonly string[], code: string, progression: Progression): boolean {
  const index = codes.indexOf(code);
  return index >= 0 && (progression.victoires.includes(code) || index === 0 || progression.victoires.includes(codes[index - 1]!));
}


export function enregistrerDecision(scenario: string, version: number, choix: string, profil: Profil = profilActif()): boolean {
  const p = lireProgression(profil);
  const cle = cleDecision(scenario, version);
  if (!p.victoires.includes(scenario) || !optionsDecision(scenario).some((o) => o.cle === choix)) return false;
  if (p.decisions?.[cle]) return p.decisions[cle].choix === choix;
  const d: DecisionLocale = { scenario, scenarioVersion: version, canonVersion: VERSION_CANON_AUBE, choix };
  const suivant = normaliserProgression({ ...p, canonVersion: VERSION_CANON_AUBE,
    decisions: { ...p.decisions, [cle]: d }, journal: [...(p.journal ?? []), cle] });
  // Une décision annoncée irréversible doit réellement avoir été enregistrée.
  try { localStorage.setItem(cleProgression(profil), JSON.stringify(suivant)); session = suivant; return true; }
  catch { return false; }
}

/**
 * Le **banc** choisi au briefing d'un scénario (`bancs.ts`), enregistré sous la
 * source `<scenario>:banc`.
 *
 * Deux différences avec `enregistrerDecision`, et elles tiennent au moment du
 * geste : un banc se choisit **avant** de jouer, donc sans victoire à exiger ;
 * et il se **rechoisit** à chaque nouvelle partie de la même épreuve — on ne
 * condamne pas quelqu'un à des couleurs pour avoir essayé. La branche qui suit
 * lit le dernier banc joué, et le carnet garde la ligne à sa place.
 *
 * Rend `false` si l'option est inconnue ou si le stockage refuse ; dans ce
 * second cas, la page garde le choix en mémoire pour la partie en cours.
 */
export function enregistrerBanc(scenario: string, version: number, choix: string, profil: Profil = profilActif()): boolean {
  const p = lireProgression(profil);
  const source = cleSourceBanc(scenario);
  if (!optionsDecision(source).some((o) => o.cle === choix)) return false;
  const cle = cleDecision(source, version);
  const d: DecisionLocale = { scenario: source, scenarioVersion: version, canonVersion: VERSION_CANON_AUBE, choix };
  const suivant = normaliserProgression({ ...p, canonVersion: VERSION_CANON_AUBE,
    decisions: { ...p.decisions, [cle]: d }, journal: [...(p.journal ?? []), cle] });
  try { localStorage.setItem(cleProgression(profil), JSON.stringify(suivant)); session = suivant; return true; }
  catch { return false; }
}
