/**
 * Rejeu et empreinte (`doc/02-architecture.md` §7).
 *
 * Une partie se résume à `{ scenarioCle, graine, catalogueVersion, actions[] }` :
 * quelques kilo-octets au lieu d'un état complet. Rejouer les actions dans
 * l'ordre doit retomber **exactement** sur le même état.
 */

import type { Sauvegarde } from '../schemas/index';
import { creerPartie, VERSION_MOTEUR } from './etat';
import { appliquer, type Commandants } from './actions';
import { fnv1a } from './rng';
import type { Action, Catalogue, EtatPartie, MotifRefus, Scene } from './types';

/** Sauvegarde du moteur : la `Sauvegarde` du contrat, avec ses actions typées. */
export interface SauvegardeMoteur extends Sauvegarde {
  actions: Action[];
}

/** Compose une sauvegarde depuis une partie et sa suite d'actions. */
export function enregistrer(etat: EtatPartie, actions: Action[]): SauvegardeMoteur {
  return {
    scenarioCle: etat.scenarioCle,
    graine: etat.graine,
    catalogueVersion: etat.catalogueVersion,
    engineVersion: etat.engineVersion,
    mapgenVersion: etat.mapgenVersion,
    contentVersion: etat.contentVersion,
    actions,
  };
}

/** Ce qu'un rejeu rend : l'état final et les actions refusées en chemin. */
export interface ResultatRejeu {
  etat: EtatPartie;
  refus: { indice: number; motif: MotifRefus }[];
}

/**
 * Rejoue une sauvegarde sur une scène. Une action refusée n'interrompt pas le
 * rejeu : elle est consignée, exactement comme au premier passage.
 */
export function rejouer(
  scene: Scene, cat: Catalogue, sauvegarde: SauvegardeMoteur,
  commandants: Commandants = [],
): ResultatRejeu {
  if (sauvegarde.catalogueVersion !== cat.version) throw new Error('Catalogue de sauvegarde incompatible : recommencer la partie avec le catalogue actuel.');
  let etat = creerPartie(scene, cat, sauvegarde.graine);
  const refus: { indice: number; motif: MotifRefus }[] = [];
  for (let i = 0; i < sauvegarde.actions.length; i += 1) {
    const r = appliquer(etat, sauvegarde.actions[i]!, cat, commandants);
    if (r.ok) etat = r.etat;
    else refus.push({ indice: i, motif: r.motif });
  }
  return { etat, refus };
}

/** Sérialisation canonique : clés triées, donc hachage stable. */
export function canonique(valeur: unknown): string {
  if (valeur === null || typeof valeur !== 'object') return JSON.stringify(valeur) ?? 'null';
  if (Array.isArray(valeur)) return `[${valeur.map(canonique).join(',')}]`;
  const o = valeur as Record<string, unknown>;
  const cles = Object.keys(o).sort();
  return `{${cles.map((k) => `${JSON.stringify(k)}:${canonique(o[k])}`).join(',')}}`;
}

/**
 * Empreinte stable d'un état : deux parties identiques ont la même, deux parties
 * qui divergent d'un PV ne l'ont pas. Le journal en est exclu — c'est de la
 * narration, pas de l'état de jeu.
 */
export function empreinte(etat: EtatPartie): string {
  const reste: Record<string, unknown> = { ...etat };
  delete reste['journal'];
  const texte = canonique(reste);
  // Deux passes FNV-1a (sur le texte, puis sur sa longueur) : 64 bits lisibles.
  const a = fnv1a(texte);
  const b = fnv1a(`${texte.length}:${texte}`);
  return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

/** Version du moteur figée dans les sauvegardes. */
export { VERSION_MOTEUR };
