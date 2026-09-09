/**
 * Le cycle de vie du contenu généré (`02-architecture.md` §6, `05-routines.md` §1.4)
 * et celui, distinct, du catalogue d'unités (`05-routines.md` §9).
 *
 * Tout est ici, et **rien ailleurs** : une route qui change un statut passe par
 * `transitionAutorisee` avant d'écrire. Les fonctions de décision sont pures, donc
 * testables sans base ; seules les deux fonctions d'incrément touchent la base.
 *
 * Deux règles sans exception :
 *   - aucune routine ne pose `en_ligne` ;
 *   - rien n'atteint `valide` sans passer par `atlas_controle`.
 */

import { compteurs, unites } from '../db/requetes/index';
import type { Statut, StatutUnite } from '../schemas/index';

/** Qui demande la transition. Le `serveur` agit seul, sur horloge ou sur mesure. */
export type Acteur = 'routine' | 'atlas_controle' | 'humain' | 'serveur';

/** Une transition permise, et par qui. */
export interface Transition {
  de: Statut;
  vers: Statut;
  acteurs: readonly Acteur[];
  raison: string;
}

/** Le graphe complet des transitions de contenu. Ce qui n'y figure pas est refusé. */
export const TRANSITIONS: readonly Transition[] = [
  { de: 'brouillon', vers: 'en_controle', acteurs: ['serveur'], raison: 'une mission de contrôle est ouverte sur l’objet' },
  { de: 'brouillon', vers: 'valide', acteurs: ['atlas_controle'], raison: 'verdict de contrôle favorable' },
  { de: 'brouillon', vers: 'rejete', acteurs: ['atlas_controle'], raison: 'verdict de contrôle défavorable' },
  { de: 'en_controle', vers: 'valide', acteurs: ['atlas_controle'], raison: 'verdict de contrôle favorable' },
  { de: 'en_controle', vers: 'rejete', acteurs: ['atlas_controle'], raison: 'verdict de contrôle défavorable' },
  { de: 'en_controle', vers: 'brouillon', acteurs: ['serveur', 'humain'], raison: 'mission de contrôle rendue' },
  { de: 'valide', vers: 'en_ligne', acteurs: ['humain'], raison: 'mise en ligne : la seule décision qui change le jeu' },
  { de: 'valide', vers: 'brouillon', acteurs: ['humain'], raison: 'renvoyé en brouillon avec une note' },
  { de: 'valide', vers: 'retire', acteurs: ['humain'], raison: 'écarté sans passer en ligne' },
  { de: 'rejete', vers: 'brouillon', acteurs: ['humain', 'serveur'], raison: 'repris au run suivant, ou rejet annulé par un humain' },
  { de: 'rejete', vers: 'retire', acteurs: ['humain', 'serveur'], raison: 'trois rejets : archivage et alerte' },
  { de: 'en_ligne', vers: 'retire', acteurs: ['humain', 'serveur'], raison: 'dépublié, ou expiré à J+7 pour une dépêche' },
  { de: 'quarantaine', vers: 'brouillon', acteurs: ['humain'], raison: 'rendu par un humain, avec une note' },
  { de: 'quarantaine', vers: 'retire', acteurs: ['humain'], raison: 'écarté définitivement' },
  { de: 'brouillon', vers: 'quarantaine', acteurs: ['routine', 'serveur', 'atlas_controle'], raison: 'anomalie non interprétable' },
  { de: 'en_controle', vers: 'quarantaine', acteurs: ['routine', 'serveur', 'atlas_controle'], raison: 'anomalie non interprétable' },
];

/** Refus motivé d'une transition. */
export interface RefusTransition {
  ok: false;
  code: 'transition_interdite' | 'acteur_interdit';
  detail: string;
}

/** Décision sur une transition demandée. */
export type DecisionTransition = { ok: true; raison: string } | RefusTransition;

/**
 * Le cœur du cycle : cette transition est-elle permise, et à cet acteur ?
 * Une transition vers son propre statut est acceptée sans effet (idempotence).
 */
export function transitionAutorisee(de: Statut, vers: Statut, acteur: Acteur): DecisionTransition {
  if (de === vers) return { ok: true, raison: 'statut inchangé' };
  const candidates = TRANSITIONS.filter((t) => t.de === de && t.vers === vers);
  if (candidates.length === 0) {
    return { ok: false, code: 'transition_interdite', detail: `${de} → ${vers} n’existe pas dans le cycle de vie` };
  }
  const permise = candidates.find((t) => t.acteurs.includes(acteur));
  if (!permise) {
    const qui = [...new Set(candidates.flatMap((t) => t.acteurs))].join(', ');
    return { ok: false, code: 'acteur_interdit', detail: `${de} → ${vers} est réservé à : ${qui}` };
  }
  return { ok: true, raison: permise.raison };
}

/** Vrai si l'objet est visible des joueurs. Un seul statut l'est. */
export function visibleParLesJoueurs(statut: Statut): boolean {
  return statut === 'en_ligne';
}

/** Le statut d'un objet après un verdict de contrôle. */
export function statutApresVerdict(verdict: 'valide' | 'rejete'): Statut {
  return verdict === 'valide' ? 'valide' : 'rejete';
}

/** Trois rejets sur le même objet l'archivent et remontent une alerte (`02` §6). */
export const REJETS_AVANT_ARCHIVAGE = 3;

/** Vrai si le compte de rejets impose l'archivage. */
export function doitEtreArchive(rejets: number): boolean {
  return rejets >= REJETS_AVANT_ARCHIVAGE;
}

/** Les trois motifs qui déclenchent une alerte humaine et gèlent les promotions. */
export const MOTIFS_ALERTE = ['sujet_interdit', 'personne_reelle', 'categorie_hors_liste_blanche'] as const;

/** Vrai si un verdict porte un motif d'alerte. */
export function porteUneAlerte(codes: readonly string[]): boolean {
  return codes.some((c) => (MOTIFS_ALERTE as readonly string[]).includes(c));
}

// ---------------------------------------------------------------------------
// Le second axe : la place d'une unité dans le catalogue
// ---------------------------------------------------------------------------

/** Transitions permises sur `UnitType.statut` (`05-routines.md` §9.4). */
export const TRANSITIONS_UNITE: readonly { de: StatutUnite | 'candidate'; vers: StatutUnite }[] = [
  { de: 'candidate', vers: 'essai' },
  { de: 'essai', vers: 'homologuee' },
  { de: 'essai', vers: 'retiree' },
  { de: 'homologuee', vers: 'retiree' },
];

/**
 * Une transition de catalogue est-elle permise ? `canon → *` est refusée
 * **toujours** : les dix unités de base ne se retirent jamais. Seul un humain
 * décide — le `CRON_SECRET` n'ouvre pas cette porte.
 */
export function transitionUniteAutorisee(
  de: StatutUnite,
  vers: StatutUnite,
  cycleCourant: Statut,
  acteur: Acteur,
): DecisionTransition {
  if (acteur !== 'humain') {
    return { ok: false, code: 'acteur_interdit', detail: 'le catalogue ne se modifie que depuis une session d’administration' };
  }
  if (de === 'canon') {
    return { ok: false, code: 'transition_interdite', detail: 'une unité canon ne change jamais de statut' };
  }
  // Une candidate vit en base avec `statut = 'essai'` **demandé** ; c'est son
  // avancement de pipeline qui décide si la mise en essai réelle est possible.
  // Une unité déjà homologuée ou retirée ne redescend jamais en essai.
  if (vers === 'essai') {
    if (de !== 'essai') {
      return { ok: false, code: 'transition_interdite', detail: `${de} → essai n’existe pas : seule une candidate entre en essai` };
    }
    if (cycleCourant !== 'valide') {
      return { ok: false, code: 'transition_interdite', detail: 'une candidate doit être certifiée (valide) avant la mise en essai' };
    }
    return { ok: true, raison: 'mise en essai : 30 jours, missions du jour uniquement' };
  }
  const permise = TRANSITIONS_UNITE.some((t) => t.de === de && t.vers === vers);
  if (!permise) {
    return { ok: false, code: 'transition_interdite', detail: `${de} → ${vers} n’est pas une transition de catalogue` };
  }
  return { ok: true, raison: `${de} → ${vers}` };
}

/** Le plafond du catalogue : 28 unités actives, dont 10 `canon` intouchables. */
export const PLAFOND_CATALOGUE = 28;

/** Durée de l'essai d'une unité, en jours. */
export const JOURS_ESSAI = 30;

// ---------------------------------------------------------------------------
// Les deux compteurs de version
// ---------------------------------------------------------------------------

/**
 * Incrémente `catalogueVersion`. Appelée à **chaque** changement de statut
 * d'unité, sans exception : un changement qui n'incrémente pas est un bug de
 * serveur (`05-routines.md` §9.3).
 */
export async function incrementerCatalogueVersion(): Promise<number> {
  return compteurs.incrementer('catalogue_version');
}

/** Incrémente `chainesVersion` : une validation de traduction, une version de plus. */
export async function incrementerChainesVersion(): Promise<number> {
  return compteurs.incrementer('chaines_version');
}

/** La `catalogueVersion` courante. */
export async function catalogueVersion(): Promise<number> {
  return compteurs.lire('catalogue_version');
}

/** La `chainesVersion` courante. */
export async function chainesVersion(): Promise<number> {
  return compteurs.lire('chaines_version');
}

/**
 * Le plafond est-il atteint ? Rendu ici parce que c'est une règle de cycle,
 * pas une règle de route.
 */
export async function catalogueSature(): Promise<boolean> {
  return (await unites.actives()) >= PLAFOND_CATALOGUE;
}
