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

const REGLAGES: Record<Biome, ReglagesBiome> = {
  plaine: { partMontagne: 0.30, rivieres: 1, echelle: 5 },
  foret: { partMontagne: 0.20, rivieres: 1, echelle: 5 },
  montagne: { partMontagne: 0.60, rivieres: 2, echelle: 4 },
  desert: { partMontagne: 0.45, rivieres: 0, echelle: 6 },
  jungle: { partMontagne: 0.15, rivieres: 2, echelle: 4 },
  neige: { partMontagne: 0.45, rivieres: 1, echelle: 5 },
  volcanique: { partMontagne: 0.65, rivieres: 0, echelle: 4 },
  cotier: { partMontagne: 0.30, rivieres: 1, echelle: 5 },
  archipel: { partMontagne: 0.25, rivieres: 0, echelle: 3 },
  marais: { partMontagne: 0.15, rivieres: 2, echelle: 6 },
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
  const symetrie: Symetrie = (SYMETRIES as readonly string[]).includes(p.symetrie as string)
    ? p.symetrie : 'aucune';

  let villesParCamp = bornerEntier(p.villesParCamp, 2, 10, 3);
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

  const ratioMer = borner(p.ratioMer, 0, 0.6, 0.2);
  const ratioMerMax = Math.max(0, 1 - place() / total);
  const parametres: ParametresNormalises = {
    largeur,
    hauteur,
    camps,
    biome,
    ratioMer,
    ratioRelief: borner(p.ratioRelief, 0, 0.4, 0.15),
    villesParCamp,
    villesNeutres,
    usinesParCamp,
    aeroportsParCamp,
    symetrie,
    densiteRoutes: borner(p.densiteRoutes, 0, 1, 0.5),
    ratioMerEffectif: Math.min(ratioMer, ratioMerMax),
  };
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
