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

import type { Biome, CampId, MapDef, Scenario, StrategieIa } from '@/schemas/types';

/** La clé du scénario de démonstration : toujours en tête de la liste. */
export const CLE_DEMONSTRATION = 'demo';

/** Brouillons explicitement ouverts aux essais ; aucun autre brouillon n'est publié. */
export const CLES_ESSAIS_AUBE = [
  'aube_batteries_2v1', 'aube_reserves_1v2', 'aube_nuit_2v2',
  'aube_releve_1v3', 'aube_routes_3v1',
] as const;

/** Les chiffres décrivent la coalition du joueur puis les coalitions adverses. */
export function formatCoalitions(scenario: Scenario): string {
  const equipes = scenario.equipes ?? scenario.commandants.map(c => [c.camp]);
  const nous = equipes.find(e => e.includes(0));
  return [nous?.length ?? 1, ...equipes.filter(e => !e.includes(0)).map(e => e.length)].join(' contre ');
}

/** Section d'essais à part : le statut de production reste brouillon dans le canon. */
export function essaisAube(scenarios: readonly Scenario[], cartes: ReadonlyMap<string, MapDef>): PartieLibre[] {
  const ouverts = scenarios.filter(s => s.statut === 'brouillon'
    && (CLES_ESSAIS_AUBE.some(cle => cle === s.code) || s.code === 'aube_essais_drones' || s.code === 'aube_drone_marin' || s.code === 'aube_essai_maritime_iem_climat'));
  return partiesLibres(ouverts.map(s => ({ ...s, statut: 'en_ligne' })), cartes, []);
}

/** Une partie libre, réduite à ce que la page affiche et à ce qu'elle relie. */
export interface PartieLibre {
  cle: string;
  /** Le nom du scénario, déjà en français dans le canon. */
  nom: string;
  /** La carte jouée : c'est par elle que la page retrouve la grille à dessiner. */
  carteCle: string;
  largeur: number;
  hauteur: number;
  biome: Biome;
  camps: MapDef['camps'];
  catalogueVersion: number;
  scenarioVersion?: number;
  /** Le commandant du camp 1 et sa stratégie, s'il est joué par l'IA. */
  adversaire: { commandantCle: string; ia: StrategieIa | null } | null;
  limiteJournees: number | null;
  brouillard: boolean;
  demonstration: boolean;
  format: string;
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
    const allies = s.equipes?.find(e => e.includes(0)) ?? [0];
    const adverse = s.commandants.find((c) => !allies.includes(c.camp));
    parties.push({
      cle: s.code,
      nom: s.nom,
      carteCle: carte.cle,
      largeur: carte.largeur,
      hauteur: carte.hauteur,
      biome: carte.biome,
      camps: carte.camps,
      catalogueVersion: s.catalogueVersion,
      scenarioVersion: s.version,
      adversaire: adverse ? { commandantCle: adverse.commandantCle, ia: adverse.ia ?? null } : null,
      limiteJournees: s.limiteJournees,
      brouillard: s.brouillard,
      demonstration: s.code === CLE_DEMONSTRATION,
      format: formatCoalitions(s),
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
export function etatSauvegarde(brut: string | null, versionMoteur: number, catalogueVersion: number, scenarioVersion = 1): EtatSauvegarde {
  if (!brut) return 'aucune';
  try {
    const v = JSON.parse(brut) as { actions?: unknown; engineVersion?: unknown; catalogueVersion?: unknown; scenarioVersion?: unknown } | null;
    if (!v || typeof v !== 'object' || Array.isArray(v) || !Array.isArray(v.actions) || v.actions.length === 0) return 'aucune';
    return v.engineVersion === versionMoteur && v.catalogueVersion === catalogueVersion && (v.scenarioVersion ?? 1) === scenarioVersion ? 'en_cours' : 'perimee';
  } catch {
    return 'aucune';
  }
}

// ---------------------------------------------------------------------------
// La vignette d'une carte
// ---------------------------------------------------------------------------

/**
 * **On choisit une carte en la regardant.**
 *
 * La liste des parties libres était une grille de fiches produit : un nom, un
 * surtitre, quatre pastilles de chiffres. Rien n'y montrait le jeu — et ce que
 * demande quelqu'un qui choisit entre l'archipel et le bras de mer, ce n'est pas
 * « 20 × 14 », c'est de **voir** deux îles et un goulot. Un écran de sélection de
 * carte montre la carte ; c'est la grammaire du genre depuis toujours.
 *
 * Faute d'illustration (aucun asset n'existe), la vignette est la **grille
 * elle-même**, à raison d'une case par unité de `viewBox`. Le principe est celui
 * de `plateau-accueil.tsx` : les couleurs ne sont pas décoratives, elles sont
 * celles du canon — la palette de chaque terrain dans `content/terrains.json`,
 * celle de chaque camp dans `render/palettes.ts`. Ce module ne les connaît
 * pourtant pas : il reçoit une fonction qui teint une case. C'est ce qui le
 * garde pur, testable, et surtout **sans importer de canon** — l'îlot client de
 * `/jeu` importe `etatSauvegarde` d'ici, et il n'a pas à embarquer les quinze
 * fiches de terrain pour lire une sauvegarde.
 *
 * Les cases de même couleur qui se suivent sur une rangée sont fondues en un
 * seul rectangle, et toutes celles d'une même couleur en un seul tracé : une
 * carte de 20 × 14 tient en huit tracés d'environ soixante rectangles au lieu de
 * deux cent quatre-vingts, ce qui compte quand la charge de la page en porte
 * quatre.
 */

/** Ce qu'il faut d'une carte pour la dessiner en petit. */
export type CarteVignette = Pick<MapDef, 'largeur' | 'hauteur' | 'grille' | 'proprietaires'>;

/** La couleur d'une case : son caractère de terrain, et le camp qui la tient. */
export type CouleurCase = (caractere: string, camp: CampId | null) => string;

/** Toutes les cases d'une même couleur, en un seul tracé SVG. */
export interface CoucheVignette {
  couleur: string;
  /** Un `d` de `<path>`, en unités de case : `M0 0h3v1h-3z`. */
  d: string;
}

/** Une carte réduite à ce qui se dessine : une `viewBox` et des couches. */
export interface Vignette {
  largeur: number;
  hauteur: number;
  /** Dans l'ordre d'apparition, pour que deux rendus donnent le même balisage. */
  couches: readonly CoucheVignette[];
}

/**
 * La vignette d'une carte. Une rangée plus courte que la largeur annoncée laisse
 * un trou plutôt qu'une couleur inventée : une carte mal formée doit se voir
 * mal formée, pas se compléter toute seule.
 */
export function vignetteCarte(carte: CarteVignette, couleur: CouleurCase): Vignette {
  const parCouleur = new Map<string, string[]>();
  const ajouter = (teinte: string, x: number, y: number, n: number): void => {
    const morceaux = parCouleur.get(teinte);
    const trace = `M${x} ${y}h${n}v1h-${n}z`;
    if (morceaux) morceaux.push(trace);
    else parCouleur.set(teinte, [trace]);
  };

  for (let y = 0; y < carte.hauteur; y += 1) {
    const ligne = carte.grille[y] ?? '';
    // Une seule course en cours par rangée : on ne la ferme qu'au changement de
    // couleur, au trou, ou au bout de la rangée.
    let teinte: string | null = null;
    let debut = 0;
    for (let x = 0; x < carte.largeur; x += 1) {
      const caractere = ligne[x];
      const suivante = caractere === undefined
        ? null
        : couleur(caractere, carte.proprietaires[`${x},${y}`] ?? null);
      if (suivante === teinte) continue;
      if (teinte !== null) ajouter(teinte, debut, y, x - debut);
      teinte = suivante;
      debut = x;
    }
    if (teinte !== null) ajouter(teinte, debut, y, carte.largeur - debut);
  }

  return {
    largeur: carte.largeur,
    hauteur: carte.hauteur,
    couches: [...parCouleur].map(([couleurCouche, morceaux]) => ({ couleur: couleurCouche, d: morceaux.join('') })),
  };
}
