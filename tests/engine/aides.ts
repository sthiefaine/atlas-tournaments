/**
 * Aides communes aux tests du moteur : chargement des cartes manuelles,
 * création de parties courtes, et un flux d'aléa figé pour vérifier les
 * formules à la main.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  chargerCatalogue, creerPartie, reglagesParDefaut, sceneDeCarte,
  type Catalogue, type EtatPartie, type InstantaneRng, type ReglagesPartie,
  type Rng, type Scene, type Unite,
} from '../../src/engine/index';
import { validerMapDef, type CampId, type CleUnite, type MapDef } from '../../src/schemas/index';

const RACINE = path.resolve(import.meta.dirname, 'cartes');

/** Le catalogue canon, chargé une fois pour tous les tests. */
export const CAT: Catalogue = chargerCatalogue();

/** Charge et valide une carte de `tests/engine/cartes/`. */
export function carte(nom: string): MapDef {
  const brut = JSON.parse(readFileSync(path.join(RACINE, `${nom}.json`), 'utf8')) as unknown;
  const r = validerMapDef(brut);
  if (!r.ok) throw new Error(`carte ${nom} invalide : ${JSON.stringify(r.erreurs)}`);
  return r.valeur;
}

/** Les trois cartes manuelles. */
export const CARTES = ['plaine', 'riviere', 'relief'] as const;

/** Crée une partie sur une carte, avec des réglages ajustables. */
export function partie(
  nom: string, graine = 'test', reglages: Partial<ReglagesPartie> = {},
): EtatPartie {
  const scene = sceneDeCarte(carte(nom), reglagesParDefaut(reglages));
  return creerPartie(scene, CAT, graine);
}

/** Construit une scène minimale à partir d'une grille écrite à la main. */
export function scenePersonnalisee(
  grille: string[],
  proprietaires: Record<string, CampId>,
  unites: { camp: CampId; type: CleUnite; x: number; y: number; pv?: number }[],
  reglages: Partial<ReglagesPartie> = {},
  mecanique: Scene['mecanique'] = null,
): Scene {
  return {
    scenarioCle: 'test',
    carteCle: 'test',
    largeur: (grille[0] ?? '').length,
    hauteur: grille.length,
    grille,
    proprietaires,
    unitesDepart: unites,
    camps: [0, 1],
    commandants: [],
    mecanique,
    reglages: reglagesParDefaut({ meteoForcee: 'clair', ...reglages }),
  };
}

/** Une partie sur une grille écrite à la main. */
export function partiePersonnalisee(
  grille: string[],
  proprietaires: Record<string, CampId>,
  unites: { camp: CampId; type: CleUnite; x: number; y: number; pv?: number }[],
  reglages: Partial<ReglagesPartie> = {},
  graine = 'test',
  mecanique: Scene['mecanique'] = null,
): EtatPartie {
  return creerPartie(
    scenePersonnalisee(grille, proprietaires, unites, reglages, mecanique), CAT, graine,
  );
}

/** Unité par identifiant, ou une erreur lisible. */
export function u(etat: EtatPartie, id: string): Unite {
  const trouvee = etat.unites.find((x) => x.id === id);
  if (!trouvee) throw new Error(`unité ${id} absente`);
  return trouvee;
}

/** Unité posée sur une case, ou une erreur lisible. */
export function surCase(etat: EtatPartie, x: number, y: number): Unite {
  const trouvee = etat.unites.find((e) => e.x === x && e.y === y && !e.dansTransport);
  if (!trouvee) throw new Error(`aucune unité en ${x},${y}`);
  return trouvee;
}

/**
 * Flux d'aléa figé : `suivant()` rend toujours la même valeur. Avec 0,5, l'aléa
 * de combat vaut exactement 1,00 et la formule du §5 se vérifie à la main.
 */
export function rngFixe(valeur = 0.5): Rng {
  const flux: Rng = {
    chemin: 'fixe',
    etat: [1, 2, 3, 4],
    suivant: () => valeur,
    entier: (borne: number) => Math.floor(valeur * borne) % Math.max(1, borne),
    branche: () => flux,
    instantane: (): InstantaneRng => ({}),
    restaurer: () => { /* rien */ },
  };
  return flux;
}
