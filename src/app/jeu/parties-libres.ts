/**
 * Les **parties libres** : ce que la page `/jeu` liste, calculé sans React ni
 * disque pour se vérifier par `tsx --test` — la page lit le canon, ce module
 * le trie.
 *
 * Le critère est le seul que le canon offre : un scénario est libre quand
 * **aucune épreuve de `content/campagne.json` ne le cite**. `Scenario` n'a pas
 * de champ « libre » ; les fils narratifs ne citent pas les scénarios de
 * l'entraînement ; et `recompenses.flags` ne dit rien — la démonstration en
 * écrit un, les deux cartes navales aucun. Il faut aussi que le scénario soit
 * **en ligne** : un brouillon se joue à son adresse pour qui la connaît, il ne
 * s'affiche pas. Et il faut que sa carte existe : `/jeu/<cle>` rendrait 404, on
 * ne promet pas une porte fermée.
 *
 * L'ordre : la démonstration d'abord — c'est la porte que tout le monde
 * connaît, celle que le bouton de l'accueil ouvrait seule —, puis les autres
 * par clé, ce qui rend la liste identique d'un rendu à l'autre.
 */

import type { Biome, MapDef, Scenario, StrategieIa } from '@/schemas/types';

/** La clé du scénario de démonstration : toujours en tête de la liste. */
export const CLE_DEMONSTRATION = 'demo';

/** Une partie libre, réduite à ce que la page affiche et à ce qu'elle relie. */
export interface PartieLibre {
  cle: string;
  /** Le nom du scénario, déjà en français dans le canon. */
  nom: string;
  largeur: number;
  hauteur: number;
  biome: Biome;
  camps: MapDef['camps'];
  catalogueVersion: number;
  /** Le commandant du camp 1 et sa stratégie, s'il est joué par l'IA. */
  adversaire: { commandantCle: string; ia: StrategieIa | null } | null;
  limiteJournees: number | null;
  brouillard: boolean;
  demonstration: boolean;
}

/** Un scénario est libre s'il est en ligne et qu'aucune épreuve de la campagne ne le cite. */
export function estLibre(scenario: Pick<Scenario, 'code' | 'statut'>, missions: readonly string[]): boolean {
  return scenario.statut === 'en_ligne' && !missions.includes(scenario.code);
}

/**
 * Les parties libres parmi des scénarios, avec leurs cartes. `missions` est la
 * liste des `scenarioCle` de `content/campagne.json`, dans n'importe quel ordre.
 */
export function partiesLibres(
  scenarios: readonly Scenario[],
  cartes: ReadonlyMap<string, MapDef>,
  missions: readonly string[],
): PartieLibre[] {
  const parties: PartieLibre[] = [];
  for (const s of scenarios) {
    if (!estLibre(s, missions)) continue;
    const carte = cartes.get(s.carteCle);
    if (!carte) continue;
    const adverse = s.commandants.find((c) => c.camp === 1);
    parties.push({
      cle: s.code,
      nom: s.nom,
      largeur: carte.largeur,
      hauteur: carte.hauteur,
      biome: carte.biome,
      camps: carte.camps,
      catalogueVersion: s.catalogueVersion,
      adversaire: adverse ? { commandantCle: adverse.commandantCle, ia: adverse.ia ?? null } : null,
      limiteJournees: s.limiteJournees,
      brouillard: s.brouillard,
      demonstration: s.code === CLE_DEMONSTRATION,
    });
  }
  parties.sort((a, b) => {
    if (a.demonstration !== b.demonstration) return a.demonstration ? -1 : 1;
    return a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0;
  });
  return parties;
}

/** Ce qu'une sauvegarde locale vaut : rien, une partie à reprendre, ou une partie d'une autre version. */
export type EtatSauvegarde = 'aucune' | 'en_cours' | 'perimee';

/**
 * Lit l'état d'une sauvegarde à partir de son **texte** tel qu'il est en stock,
 * pour rester pur : c'est l'îlot client qui interroge `localStorage`.
 *
 * La règle est celle de la page de jeu (`jeu/[scenario]/toile.tsx`) : une
 * partie se reprend si elle a au moins une action et si le moteur et le
 * catalogue sont ceux d'aujourd'hui ; sinon elle est périmée, et la page de jeu
 * repartira de zéro. Un texte illisible n'est pas une erreur : il n'y a pas de
 * partie, c'est tout.
 */
export function etatSauvegarde(brut: string | null, versionMoteur: number, catalogueVersion: number): EtatSauvegarde {
  if (!brut) return 'aucune';
  try {
    const v = JSON.parse(brut) as { actions?: unknown; engineVersion?: unknown; catalogueVersion?: unknown } | null;
    if (!v || typeof v !== 'object' || Array.isArray(v) || !Array.isArray(v.actions) || v.actions.length === 0) return 'aucune';
    return v.engineVersion === versionMoteur && v.catalogueVersion === catalogueVersion ? 'en_cours' : 'perimee';
  } catch {
    return 'aucune';
  }
}
