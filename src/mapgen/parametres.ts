/**
 * Normalisation des `ParametresCarte` : le générateur ne refuse rien, il **borne**.
 *
 * La routine map envoie une intention (`05-routines.md` §3) ; les bornes du schéma
 * (`03-schemas.md` §5) sont ramenées ici, et les effectifs de bâtiments sont réduits
 * quand la surface disponible ne les accepte pas. Un paramètre corrigé est visible :
 * les paramètres normalisés sont ceux recopiés dans `MapDef.generation.parametres`,
 * donc rejouer la génération depuis la carte enregistrée redonne la même grille.
 */

import {
  BIOMES, SYMETRIES, type Biome, type ParametresCarte, type Symetrie,
} from '../schemas/types';

/** Réglages de relief propres à un biome. */
export interface ReglagesBiome {
  /** Part du relief rendue en montagnes ; le reste part en forêts. */
  partMontagne: number;
  /** Nombre de rivières tracées dans le domaine fondamental. */
  rivieres: number;
  /** Échelle du bruit de valeur, en cases. */
  echelle: number;
}

export interface ProfilBiome {
  description: string;
  ratioRelief: number;
  ratioMer: number;
  densiteRoutes: number;
  villesParCamp: number;
  /**
   * Ports par camp que le biome **recommande** (7 septembre 2026) : un sur les
   * biomes côtier et insulaire, zéro ailleurs. C'est un preset pour qui compose
   * des paramètres à partir d'un biome (atelier, routine) ; `normaliser` ne
   * l'applique **pas** à un champ absent, parce que le schéma dit « absent = 0 »
   * et qu'une carte enregistrée sans le champ doit se régénérer à l'identique.
   */
  portsParCamp: number;
  /** Stations radar par camp recommandées : aucun biome n'en réclame par défaut. */
  radarsParCamp: number;
}

/** Les valeurs servent de défauts : une mission peut préciser sa propre topologie. */
export const PROFILS_BIOME: Record<Biome, ProfilBiome> = {
  plaine: { description: 'Routes rapides, haies protectrices : choisir entre vitesse et couverture.', ratioRelief: .18, ratioMer: 0, densiteRoutes: .8, villesParCamp: 3, portsParCamp: 0, radarsParCamp: 0 },
  foret: { description: 'Les lisières cachent les unités sous brouillard ; la reconnaissance ouvre la marche.', ratioRelief: .4, ratioMer: .05, densiteRoutes: .3, villesParCamp: 3, portsParCamp: 0, radarsParCamp: 0 },
  montagne: { description: 'Les hauteurs donnent +2 de vision. Les véhicules empruntent les cols ; le génie ouvre des routes.', ratioRelief: .4, ratioMer: 0, densiteRoutes: .25, villesParCamp: 2, portsParCamp: 0, radarsParCamp: 0 },
  desert: { description: 'Sables sans couverture et bases rares : protéger les transports de ravitaillement.', ratioRelief: .12, ratioMer: 0, densiteRoutes: .2, villesParCamp: 2, portsParCamp: 0, radarsParCamp: 0 },
  jungle: { description: 'Forêts denses et rivières : reconnaître les berges et sécuriser les ponts avant les blindés.', ratioRelief: .4, ratioMer: .1, densiteRoutes: .1, villesParCamp: 2, portsParCamp: 0, radarsParCamp: 0 },
  neige: { description: 'Reliefs et longs détours : conserver les routes et les bases de soutien. Le gel dépend de la saison.', ratioRelief: .3, ratioMer: .05, densiteRoutes: .15, villesParCamp: 2, portsParCamp: 0, radarsParCamp: 0 },
  volcanique: { description: 'Crêtes sans forêt : les couloirs exposés favorisent le contrôle des cols et le génie.', ratioRelief: .4, ratioMer: .05, densiteRoutes: .1, villesParCamp: 2, portsParCamp: 0, radarsParCamp: 0 },
  cotier: { description: 'La grève ouvre à marée basse puis se referme : coordonner la traversée sur deux journées.', ratioRelief: .15, ratioMer: .35, densiteRoutes: .5, villesParCamp: 3, portsParCamp: 1, radarsParCamp: 0 },
  archipel: { description: 'Terres étroites reliées par passages : contrôler les accès et profiter des marées.', ratioRelief: .1, ratioMer: .55, densiteRoutes: .15, villesParCamp: 2, portsParCamp: 1, radarsParCamp: 0 },
  marais: { description: 'Rivières et couvert fragmenté canalisent les véhicules : construire les traversées utiles.', ratioRelief: .3, ratioMer: .25, densiteRoutes: .1, villesParCamp: 2, portsParCamp: 0, radarsParCamp: 0 },
};

const REGLAGES: Record<Biome, ReglagesBiome> = {
  plaine: { partMontagne: .1, rivieres: 1, echelle: 5 },
  foret: { partMontagne: .05, rivieres: 1, echelle: 3 },
  montagne: { partMontagne: .8, rivieres: 1, echelle: 4 },
  desert: { partMontagne: 1, rivieres: 0, echelle: 6 },
  jungle: { partMontagne: .05, rivieres: 3, echelle: 3 },
  neige: { partMontagne: .45, rivieres: 1, echelle: 5 },
  volcanique: { partMontagne: 1, rivieres: 0, echelle: 3 },
  cotier: { partMontagne: .3, rivieres: 1, echelle: 5 },
  archipel: { partMontagne: .25, rivieres: 0, echelle: 2 },
  marais: { partMontagne: .05, rivieres: 3, echelle: 3 },
};

/** Réglages de relief d'un biome. */
export function reglagesDe(biome: Biome): ReglagesBiome {
  return REGLAGES[biome];
}

/** Paramètres bornés, prêts pour le pipeline. */
export interface ParametresNormalises extends ParametresCarte {
  biome: Biome;
  symetrie: Symetrie;
  /** Toujours présents une fois normalisés : le générateur ne relit jamais un champ absent. */
  portsParCamp: number;
  radarsParCamp: number;
  /** Ratio de mer réellement applicable après réservation de la place au bâti. */
  ratioMerEffectif: number;
}

function borner(valeur: unknown, min: number, max: number, defaut: number): number {
  const n = typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : defaut;
  return Math.min(max, Math.max(min, n));
}

function bornerEntier(valeur: unknown, min: number, max: number, defaut: number): number {
  return Math.round(borner(valeur, min, max, defaut));
}

/**
 * Ramène les paramètres dans les bornes du schéma, puis réduit les effectifs
 * jusqu'à ce que le bâti tienne sur la surface terrestre disponible.
 */
export function normaliser(p: ParametresCarte): ParametresNormalises {
  const largeur = bornerEntier(p.largeur, 10, 40, 20);
  const hauteur = bornerEntier(p.hauteur, 10, 30, 14);
  const camps = bornerEntier(p.camps, 2, 4, 2) as 2 | 3 | 4;
  const biome: Biome = (BIOMES as readonly string[]).includes(p.biome as string)
    ? p.biome : 'plaine';
  const profil = PROFILS_BIOME[biome];
  const symetrie: Symetrie = (SYMETRIES as readonly string[]).includes(p.symetrie as string)
    ? p.symetrie : 'aucune';

  let villesParCamp = bornerEntier(p.villesParCamp, 2, 10, profil.villesParCamp);
  let villesNeutres = bornerEntier(p.villesNeutres, 0, 12, 0);
  let usinesParCamp = bornerEntier(p.usinesParCamp, 1, 3, 1);
  let aeroportsParCamp = bornerEntier(p.aeroportsParCamp, 0, 2, 0);
  // Ports et radars (7 septembre 2026) : facultatifs, absents = 0 — c'est le
  // contrat du schéma, et ce qui garde identiques les cartes générées avant eux.
  let portsParCamp = bornerEntier(p.portsParCamp, 0, 2, 0);
  let radarsParCamp = bornerEntier(p.radarsParCamp, 0, 2, 0);

  const ratioMer = borner(p.ratioMer, 0, 0.6, profil.ratioMer);
  // Un port sans mer n'est pas un port : sur un biome sans mer, on ramène les
  // ports à zéro plutôt que de refuser. La correction est visible dans les
  // paramètres recopiés sur la carte (`generation.parametres.portsParCamp`),
  // et `mesurer` publie `ports_par_camp` — il n'existe pas d'autre mécanisme
  // d'avertissement dans une `MapDef`.
  if (ratioMer <= 0) portsParCamp = 0;

  // Le groupe de symétrie duplique le bâti d'un camp autant de fois qu'il a
  // d'éléments : à trois camps, le quatrième quadrant existe quand même, neutre.
  const orbites = camps >= 3 ? 4 : 2;
  const total = largeur * hauteur;
  const place = (): number =>
    orbites * (1 + villesParCamp + usinesParCamp + aeroportsParCamp + portsParCamp + radarsParCamp) * 3
    + villesNeutres * 3 + 8;
  // Une carte à ports met la mer en ceinture (`relief.ts`) : le pourtour n'est
  // plus constructible, la surface qui reste au bâti est celle de l'intérieur.
  const surface = (): number => total - (portsParCamp > 0 ? 2 * (largeur + hauteur) - 4 : 0);

  while (place() > surface()) {
    if (villesParCamp > 2) villesParCamp -= 1;
    else if (villesNeutres > 0) villesNeutres -= 1;
    else if (radarsParCamp > 0) radarsParCamp -= 1;
    else if (portsParCamp > 0) portsParCamp -= 1;
    else if (aeroportsParCamp > 0) aeroportsParCamp -= 1;
    else if (usinesParCamp > 1) usinesParCamp -= 1;
    else break;
  }

  const ratioMerMax = Math.max(0, 1 - place() / total);
  const parametres: ParametresNormalises = {
    largeur,
    hauteur,
    camps,
    biome,
    ratioMer,
    ratioRelief: borner(p.ratioRelief, 0, 0.4, profil.ratioRelief),
    villesParCamp,
    villesNeutres,
    usinesParCamp,
    aeroportsParCamp,
    portsParCamp,
    radarsParCamp,
    symetrie,
    densiteRoutes: borner(p.densiteRoutes, 0, 1, profil.densiteRoutes),
    ratioMerEffectif: Math.min(ratioMer, ratioMerMax),
  };
  if ((biome === 'cotier' || biome === 'archipel') && p.mecanique === undefined) parametres.mecanique = 'meca_marees';
  if (typeof p.mecanique === 'string' && p.mecanique !== '') parametres.mecanique = p.mecanique;
  return parametres;
}

/** Les paramètres publiables : la vue `ParametresCarte` d'un jeu normalisé. */
export function versParametresCarte(p: ParametresNormalises): ParametresCarte {
  const sortie: ParametresCarte = {
    largeur: p.largeur,
    hauteur: p.hauteur,
    camps: p.camps,
    biome: p.biome,
    ratioMer: p.ratioMer,
    ratioRelief: p.ratioRelief,
    villesParCamp: p.villesParCamp,
    villesNeutres: p.villesNeutres,
    usinesParCamp: p.usinesParCamp,
    aeroportsParCamp: p.aeroportsParCamp,
    portsParCamp: p.portsParCamp,
    radarsParCamp: p.radarsParCamp,
    symetrie: p.symetrie,
    densiteRoutes: p.densiteRoutes,
  };
  if (p.mecanique !== undefined) sortie.mecanique = p.mecanique;
  return sortie;
}
