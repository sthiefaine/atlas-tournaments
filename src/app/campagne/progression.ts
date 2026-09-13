/** Progression de la qualification locale : aucune autorité sur un classement en ligne. */
import { REGEX_CODE_COMMANDANT, type Cle, type DateIso, type Mode, type ProfilCampagne } from '../../schemas/types';
import { evaluerCondition } from '../../engine/deblocages';
import type { RosterJouables } from '../../content/commandants-jouables';
import { VERSION_CANON_AUBE, cleDecision, optionsDecision } from './consequences';
import { cleSourceBanc, cleSourceCommandant, estSourceCommandant } from './bancs';
import { cleProgression, profilActif, type Profil } from '../preferences';

export interface DecisionLocale {
  scenario: string;
  scenarioVersion: number;
  canonVersion: number;
  choix: string;
}
export interface Rencontre { genre: 'unite' | 'commandant'; cle: string; relation: 'allie' | 'adversaire'; mission: string; journee: number }
export interface Progression {
  rencontres?: Rencontre[];
  version: 1;
  victoires: string[];
  victoiresParMode?: Partial<Record<Mode, string[]>>;
  canonVersion?: number;
  decisions?: Record<string, DecisionLocale>;
  /**
   * Combien de manches ont été gagnées **sans perdre une seule unité**. Un
   * secret du vestiaire le lit (`monde.tournoi.matchs_sans_perte`), et rien
   * d'autre : c'est un accomplissement, pas une statistique d'après-match.
   */
  matchsSansPerte?: number;
  journal?: string[];
  /**
   * Les commandants **débloqués**, par clé de roster, sans doublon et dans
   * l'ordre où ils se sont ouverts (`content/commandants-jouables.json`).
   *
   * Le champ est facultatif, et il le reste : une progression écrite avant le
   * vestiaire se lit sans rien perdre, elle recalcule simplement ses ouvertures
   * à la première lecture. Ce qui est **enregistré** ici, ce sont les secrets —
   * une condition remplie une fois ne se reperd pas parce que le profil a
   * changé —, les ouvertures par victoire se redéduisant toujours des victoires.
   */
  commandants?: string[];
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
  if (typeof p.matchsSansPerte === 'number' && Number.isFinite(p.matchsSansPerte) && p.matchsSansPerte > 0) {
    resultat.matchsSansPerte = Math.floor(p.matchsSansPerte);
  }
  if (p.victoiresParMode && typeof p.victoiresParMode === 'object') {
    resultat.victoiresParMode = {};
    for (const mode of ['normal', 'difficile'] as const) {
      const liste = p.victoiresParMode[mode];
      if (Array.isArray(liste)) resultat.victoiresParMode[mode] = [...new Set(liste.filter((code) => typeof code === 'string' && resultat.victoires.includes(code)))];
    }
  }
  if (Array.isArray(p.rencontres)) resultat.rencontres = p.rencontres.filter(r => r && ['unite', 'commandant'].includes(r.genre) && ['allie', 'adversaire'].includes(r.relation) && typeof r.cle === 'string' && /^[a-z][a-z0-9_]{1,47}$/.test(r.cle) && typeof r.mission === 'string' && Number.isInteger(r.journee) && r.journee > 0).slice(0, 512);
  const lireDecision = (d: unknown): DecisionLocale | null => {
    if (!d || typeof d !== 'object') return null;
    const x = d as Partial<DecisionLocale>;
    if (typeof x.scenario !== 'string' || !Number.isInteger(x.scenarioVersion) || (x.scenarioVersion ?? 0) < 1
      || x.canonVersion !== VERSION_CANON_AUBE) return null;
    // Un choix de commandant se lit contre la **forme** d'une clé, pas contre une
    // liste d'options : la liste dépend du roster et de ce que le joueur a
    // débloqué, et la normalisation doit répondre sans charger de contenu.
    const connu = estSourceCommandant(x.scenario)
      ? typeof x.choix === 'string' && REGEX_CODE_COMMANDANT.test(x.choix)
      : optionsDecision(x.scenario).some((o) => o.cle === x.choix);
    if (!connu) return null;
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
  // Les commandants débloqués. Le roster n'est pas lisible d'ici — la
  // normalisation doit répondre sans charger de contenu —, on ne garde donc que
  // la **forme** d'une clé de commandant ; une clé absente du roster est ignorée
  // par `commandantsDebloques`, qui, lui, l'a sous la main.
  if (Array.isArray(p.commandants)) {
    const cles = [...new Set(p.commandants.filter((c): c is string => typeof c === 'string' && REGEX_CODE_COMMANDANT.test(c)))];
    if (cles.length > 0) resultat.commandants = cles;
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

export function enregistrerVictoire(
  code: string, profil: Profil = profilActif(), mode: Mode = 'normal', sansPerte = false,
): boolean {
  const progression = lireProgression(profil);
  const parMode = progression.victoiresParMode ?? { normal: progression.victoires };
  // Le compte ne monte qu'à la victoire : perdre sans perdre une unité n'est
  // pas un exploit, c'est une limite de journées atteinte.
  const sansPerteTotal = (progression.matchsSansPerte ?? 0) + (sansPerte ? 1 : 0);
  session = normaliserProgression({ ...progression, victoires: [...progression.victoires, code],
    matchsSansPerte: sansPerteTotal,
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

// ---------------------------------------------------------------------------
// Le vestiaire : les commandants que la campagne ouvre
// ---------------------------------------------------------------------------

/**
 * Ce que la progression locale ne sait pas dire, et que l'appelant fournit s'il
 * l'a : la date du serveur, les secrets déjà trouvés ailleurs, les nations
 * visitées, la confiance des généraux. Tout est facultatif, tout écrase la
 * valeur déduite.
 */
export type EtatCampagne = Partial<ProfilCampagne> & { aujourdhui?: DateIso };

/**
 * Le préfixe des flags que la progression locale sait poser. `monde.tournoi` est
 * un domaine de `REGEX_FLAG`, et c'est le bon : ce qu'on enregistre ici, ce sont
 * des titres, pas des faits de monde.
 */
export const PREFIXE_FLAG_TOURNOI = 'monde.tournoi.';

/**
 * Le jour par défaut d'une évaluation locale. Le client **n'a pas d'horloge de
 * confiance** — le moteur ne lit jamais l'heure, et le serveur est seul à savoir
 * quel jour on est (`engine/deblocages.ts`). Une condition `date` est donc
 * évaluée contre cette borne d'origine tant que l'appelant ne passe pas mieux :
 * un secret daté ne s'ouvre pas tout seul sur un appareil.
 */
export const JOUR_SANS_HORLOGE: DateIso = '1970-01-01';

/**
 * Un `ProfilCampagne` construit depuis la progression locale, pour que
 * `evaluerCondition` puisse être appelé sans dupliquer une ligne de sa logique.
 *
 * La traduction est volontairement pauvre et **écrite ici une fois** : un titre
 * pose `monde.tournoi.<code>` (et `<code>_difficile` s'il a été gagné en
 * difficile), les compteurs comptent les titres et les décisions, `scenariosFinis`
 * reprend les victoires. Tout le reste — pays visités, relations, confiance,
 * modes finis — n'existe pas localement : c'est zéro, sauf si `etat` le donne.
 */
export function profilDepuisProgression(p: Progression, etat: EtatCampagne = {}): ProfilCampagne {
  const difficiles = p.victoiresParMode?.difficile ?? [];
  const booleens: Record<Cle, true> = {};
  for (const code of p.victoires) booleens[`${PREFIXE_FLAG_TOURNOI}${code}`] = true;
  for (const code of difficiles) booleens[`${PREFIXE_FLAG_TOURNOI}${code}_difficile`] = true;
  const compteurs: Record<Cle, number> = {
    [`${PREFIXE_FLAG_TOURNOI}victoires`]: p.victoires.length,
    [`${PREFIXE_FLAG_TOURNOI}victoires_difficile`]: difficiles.length,
    [`${PREFIXE_FLAG_TOURNOI}decisions`]: Object.keys(p.decisions ?? {}).length,
    [`${PREFIXE_FLAG_TOURNOI}matchs_sans_perte`]: p.matchsSansPerte ?? 0,
  };
  return {
    cle: 'profil_local',
    paysDepart: 'fr',
    mode: 'normal',
    deblocages: [],
    filsEnCours: [],
    filsFinis: [],
    secretsTrouves: [],
    paysVisites: [],
    modesFinis: [],
    relations: {},
    confiance: {},
    serieDepeches: 0,
    catalogueVersion: 0,
    chainesVersion: 1,
    creeLe: JOUR_SANS_HORLOGE,
    majLe: JOUR_SANS_HORLOGE,
    ...etat,
    scenariosFinis: etat.scenariosFinis ?? [...p.victoires],
    flags: {
      booleens: { ...booleens, ...etat.flags?.booleens },
      compteurs: { ...compteurs, ...etat.flags?.compteurs },
      journal: etat.flags?.journal ?? [],
    },
  };
}

/**
 * Les commandants **ouverts par les victoires** du profil, dans l'ordre du
 * roster : `debut` toujours, un code de scénario dès qu'il est remporté,
 * `a_venir` jamais.
 *
 * La fonction est pure et ne lit ni le stockage ni les secrets : c'est la
 * moitié du vestiaire qui se redéduit intégralement des victoires, donc celle
 * qu'on n'a pas besoin d'enregistrer.
 */
export function commandantsDebloques(p: Progression, roster: RosterJouables): string[] {
  const gagnes = new Set(p.victoires);
  return roster.jouables
    .filter((j) => j.ouvertPar === 'debut' || gagnes.has(j.ouvertPar))
    .map((j) => j.cle);
}

/**
 * Les commandants **secrets** dont la condition est remplie, dans l'ordre du
 * roster, plus ceux que la progression a déjà enregistrés — une condition
 * remplie une fois ne se reperd pas parce qu'on a rejoué une mission autrement.
 *
 * L'évaluation passe par `evaluerCondition` du moteur, jamais par une lecture
 * maison : le rendu n'a aucune autorité sur un déblocage (`deblocages.ts`).
 */
export function secretsAcquis(p: Progression, roster: RosterJouables, etat: EtatCampagne = {}): string[] {
  const profil = profilDepuisProgression(p, etat);
  const contexte = { aujourdhui: etat.aujourdhui ?? JOUR_SANS_HORLOGE };
  const deja = new Set(p.commandants ?? []);
  return roster.secrets
    .filter((s) => deja.has(s.cle) || evaluerCondition(s.condition, profil, contexte))
    .map((s) => s.cle);
}

/**
 * Tout le vestiaire ouvert : les victoires d'abord, les secrets ensuite, sans
 * doublon et dans l'ordre du roster. C'est la liste que le briefing propose.
 */
export function vestiaire(p: Progression, roster: RosterJouables, etat: EtatCampagne = {}): string[] {
  return [...new Set([...commandantsDebloques(p, roster), ...secretsAcquis(p, roster, etat)])];
}

/**
 * Enregistre ce qui est ouvert et rend **ce qui vient de s'ouvrir**, pour que
 * l'écran puisse l'annoncer. Rien de nouveau : un tableau vide, et aucune
 * écriture.
 *
 * On enregistre l'ensemble du vestiaire, secrets compris, parce que c'est la
 * seule façon qu'un secret survive à une progression qui change ; les
 * ouvertures par victoire s'y retrouvent aussi, mais elles se redéduiraient de
 * toute façon. Le stockage refusé ne fait pas échouer l'annonce : la liste
 * rendue est vraie, elle sera simplement recalculée à la prochaine ouverture.
 */
export function debloquerCommandants(
  roster: RosterJouables,
  profil: Profil = profilActif(),
  etat: EtatCampagne = {},
): string[] {
  const p = lireProgression(profil);
  const deja = new Set(p.commandants ?? []);
  const ouverts = vestiaire(p, roster, etat);
  const nouveaux = ouverts.filter((cle) => !deja.has(cle));
  if (nouveaux.length === 0) return [];
  const suivant = normaliserProgression({ ...p, commandants: [...(p.commandants ?? []), ...nouveaux] });
  try { localStorage.setItem(cleProgression(profil), JSON.stringify(suivant)); session = suivant; }
  catch { session = suivant; }
  return nouveaux;
}

/**
 * Le **commandant** choisi au briefing d'un scénario `choixCommandant`,
 * enregistré sous la source `<scenario>:commandant`.
 *
 * Mêmes règles qu'`enregistrerBanc`, pour le même geste : pas de victoire à
 * exiger, un choix qui se refait à chaque nouvelle partie de la même épreuve, et
 * une ligne unique au journal. Une seule différence : la liste des options n'est
 * pas dans le canon mais dans le vestiaire du joueur, l'appelant passe donc les
 * clés qu'il a réellement proposées (`optionsCommandant`) — enregistrer un
 * commandant que le briefing n'offrait pas serait le déverrouiller par la
 * sauvegarde.
 */
export function enregistrerCommandant(
  scenario: string,
  version: number,
  choix: string,
  proposes: readonly string[],
  profil: Profil = profilActif(),
): boolean {
  const p = lireProgression(profil);
  if (!proposes.includes(choix)) return false;
  const source = cleSourceCommandant(scenario);
  const cle = cleDecision(source, version);
  const d: DecisionLocale = { scenario: source, scenarioVersion: version, canonVersion: VERSION_CANON_AUBE, choix };
  const suivant = normaliserProgression({ ...p, canonVersion: VERSION_CANON_AUBE,
    decisions: { ...p.decisions, [cle]: d }, journal: [...(p.journal ?? []), cle] });
  try { localStorage.setItem(cleProgression(profil), JSON.stringify(suivant)); session = suivant; return true; }
  catch { return false; }
}

/** Le commandant enregistré pour cette épreuve dans cette version, ou `null`. */
export function commandantEnregistre(scenario: string, version: number, p: Progression): string | null {
  return p.decisions?.[cleDecision(cleSourceCommandant(scenario), version)]?.choix ?? null;
}

/** Le premier contact est conservé ; aucun catalogue entier n’est marqué rencontré. */
export function enregistrerRencontres(rencontres: readonly Rencontre[], profil: Profil): void {
  const p = lireProgression(profil);
  const precedentes = p.rencontres ?? [];
  const cles = new Set(precedentes.map(r => `${r.genre}:${r.cle}:${r.relation}`));
  const ajouts = rencontres.filter(r => { const id = `${r.genre}:${r.cle}:${r.relation}`; if (cles.has(id)) return false; cles.add(id); return true; });
  if (!ajouts.length) return;
  session = normaliserProgression({ ...p, rencontres: [...precedentes, ...ajouts] });
  try { localStorage.setItem(cleProgression(profil), JSON.stringify(session)); } catch { /* Conserver les découvertes en mémoire pour cette session. */ }
}
