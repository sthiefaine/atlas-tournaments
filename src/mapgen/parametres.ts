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
}

/** Les valeurs servent de défauts : une mission peut préciser sa propre topologie. */
export const PROFILS_BIOME: Record<Biome, ProfilBiome> = {
  plaine: { description: 'Routes rapides, haies protectrices : choisir entre vitesse et couverture.', ratioRelief: .18, ratioMer: 0, densiteRoutes: .8, villesParCamp: 3 },
  foret: { description: 'Les lisières cachent les unités sous brouillard ; la reconnaissance ouvre la marche.', ratioRelief: .4, ratioMer: .05, densiteRoutes: .3, villesParCamp: 3 },
  montagne: { description: 'Les hauteurs donnent +2 de vision. Les véhicules empruntent les cols ; le génie ouvre des routes.', ratioRelief: .4, ratioMer: 0, densiteRoutes: .25, villesParCamp: 2 },
  desert: { description: 'Sables sans couverture et bases rares : protéger les transports de ravitaillement.', ratioRelief: .12, ratioMer: 0, densiteRoutes: .2, villesParCamp: 2 },
  jungle: { description: 'Forêts denses et rivières : reconnaître les berges et sécuriser les ponts avant les blindés.', ratioRelief: .4, ratioMer: .1, densiteRoutes: .1, villesParCamp: 2 },
  neige: { description: 'Reliefs et longs détours : conserver les routes et les bases de soutien. Le gel dépend de la saison.', ratioRelief: .3, ratioMer: .05, densiteRoutes: .15, villesParCamp: 2 },
  volcanique: { description: 'Crêtes sans forêt : les couloirs exposés favorisent le contrôle des cols et le génie.', ratioRelief: .4, ratioMer: .05, densiteRoutes: .1, villesParCamp: 2 },
  cotier: { description: 'La grève ouvre à marée basse puis se referme : coordonner la traversée sur deux journées.', ratioRelief: .15, ratioMer: .35, densiteRoutes: .5, villesParCamp: 3 },
  archipel: { description: 'Terres étroites reliées par passages : contrôler les accès et profiter des marées.', ratioRelief: .1, ratioMer: .55, densiteRoutes: .15, villesParCamp: 2 },
  marais: { description: 'Rivières et couvert fragmenté canalisent les véhicules : construire les traversées utiles.', ratioRelief: .3, ratioMer: .25, densiteRoutes: .1, villesParCamp: 2 },
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

  // Le groupe de symétrie duplique le bâti d'un camp autant de fois qu'il a
  // d'éléments : à trois camps, le quatrième quadrant existe quand même, neutre.
  const orbites = camps >= 3 ? 4 : 2;
  const total = largeur * hauteur;
  const place = (): number =>
    orbites * (1 + villesParCamp + usinesParCamp + aeroportsParCamp) * 3 + villesNeutres * 3 + 8;

  while (place() > total) {
    if (villesParCamp > 2) villesParCamp -= 1;
    else if (villesNeutres > 0) villesNeutres -= 1;
    else if (aeroportsParCamp > 0) aeroportsParCamp -= 1;
    else if (usinesParCamp > 1) usinesParCamp -= 1;
    else break;
  }

  const ratioMer = borner(p.ratioMer, 0, 0.6, profil.ratioMer);
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
    symetrie: p.symetrie,
    densiteRoutes: p.densiteRoutes,
  };
  if (p.mecanique !== undefined) sortie.mecanique = p.mecanique;
  return sortie;
}
