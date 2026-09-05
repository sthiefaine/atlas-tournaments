/**
 * La génération de carte, côté serveur.
 *
 * « La routine map n'envoie pas une grille, elle envoie des paramètres, et c'est
 * le générateur déterministe qui produit la carte » (`05-routines.md` §1.3). Le
 * générateur vit dans `src/mapgen/` ; ce fichier est la seule frontière entre lui
 * et les routes.
 *
 * Deux garanties sont posées **ici**, pas dans `mapgen/` :
 *
 * 1. **Reproductibilité vérifiée à la soumission** (`02-architecture.md` §6 et
 *    §7). La carte est générée, puis **régénérée** depuis les mêmes paramètres et
 *    la même graine, et les deux sont comparées. Si elles diffèrent, le
 *    générateur a changé sans que `mapgenVersion` bouge : on refuse d'écrire une
 *    carte qu'on ne saura pas reconstruire.
 * 2. **Aperçu et mesures publiables** : l'aperçu texte que la routine commente
 *    une seule fois (§3.3) et les mesures structurelles qui l'accompagnent.
 *
 * L'unique itération d'aperçu (`ITERATION_EPUISEE`) reste à la charge de la
 * route : c'est une règle de mission, pas une règle de génération.
 */

import { chargerTerrains } from '../content/index';
import {
  apercuTexte, genererCarte, hacher, MAPGEN_VERSION, mesurer, verifierCarte,
} from '../mapgen/index';
import type { MapDef, ParametresCarte } from '../schemas/index';
import type { ApercuCarte } from '../db/schema';
import { erreur } from './reponses';

/** Ce qu'une génération rend : la carte, son aperçu commentable, son diagnostic. */
export interface CarteProduite {
  carte: MapDef;
  apercu: ApercuCarte;
  diagnostic: Record<string, number>;
}

/** Ce que le serveur sait générer. */
export interface Generateur {
  readonly disponible: boolean;
  readonly nom: string;
  readonly version: string;
  generer(parametres: ParametresCarte, graine: string): Promise<CarteProduite>;
  /** Les vérifications structurelles de la carte produite (`mapgen/verifier`). */
  verifier(carte: MapDef): { ok: boolean; motifs: { code: string; detail: string }[] };
  /** L'aperçu texte que la routine commente une seule fois. */
  apercu(carte: MapDef): string;
}

/** Erreur levée par un générateur absent : elle se traduit en `503`. */
export class GenerationIndisponible extends Error {
  /** Code stable renvoyé au client. */
  readonly code = 'generation_indisponible';

  constructor(detail = 'le générateur de cartes n’est pas encore branché sur ce serveur') {
    super(detail);
    this.name = 'GenerationIndisponible';
  }
}

/** L'implémentation de repli : elle ne génère rien et le dit franchement. */
export const generateurIndisponible: Generateur = {
  disponible: false,
  nom: 'indisponible',
  version: '0.0.0',
  generer() {
    return Promise.reject(new GenerationIndisponible());
  },
  verifier() {
    throw new GenerationIndisponible();
  },
  apercu() {
    throw new GenerationIndisponible();
  },
};

/** Vrai si l'erreur attrapée est une indisponibilité de génération. */
export function estGenerationIndisponible(e: unknown): e is GenerationIndisponible {
  return e instanceof GenerationIndisponible;
}

/** La réponse `503 {"error":"generation_indisponible"}`. */
export function reponseGenerationIndisponible(detail?: string): Response {
  return erreur('generation_indisponible', 503, detail ?? new GenerationIndisponible().message);
}

/** Une graine reproductible tirée de la cible et de l'instant de dépôt. */
export function graineDe(cible: string, quand = new Date()): string {
  return `${cible}:${quand.toISOString().slice(0, 10)}:${Math.floor(quand.getTime() / 1000)}`;
}

/**
 * Ramène une graine de mission — une chaîne — à l'entier 32 bits qu'attend
 * `genererCarte`. Une graine déjà numérique est reprise telle quelle, pour qu'une
 * carte régénérée depuis `MapDef.generation.graine` retombe sur elle-même.
 */
export function graineNumerique(graine: string): number {
  const brut = Number(graine);
  if (Number.isInteger(brut) && brut >= 0 && brut <= 0xffffffff) return brut;
  return hacher(graine);
}

/**
 * La légende de l'aperçu texte, servie avec lui (`05-routines.md` §3.3). Elle
 * reprend **les caractères de grille du schéma**, comme l'aperçu lui-même : la
 * routine lit la carte dans l'alphabet qu'elle retrouvera dans la `MapDef`.
 */
export const LEGENDE_APERCU: Record<string, string> = ((): Record<string, string> => {
  const table: Record<string, string> = {};
  for (const t of chargerTerrains()) table[t.car] = t.nom.toLowerCase();
  return table;
})();

/**
 * Le générateur réel. Il génère deux fois et compare : une carte qu'on ne sait
 * pas reconstruire n'a pas le droit d'entrer en base, parce qu'elle casserait le
 * rejeu et le contrôle en même temps.
 */
export const generateurMapgen: Generateur = {
  disponible: true,
  nom: 'mapgen',
  version: `${MAPGEN_VERSION}.0.0`,

  generer(parametres: ParametresCarte, graine: string): Promise<CarteProduite> {
    const n = graineNumerique(graine);
    const carte = genererCarte(parametres, n);
    const rejeu = genererCarte(parametres, n);
    if (JSON.stringify(rejeu) !== JSON.stringify(carte)) {
      return Promise.reject(new GenerationIndisponible(
        'le générateur ne reproduit pas la même carte à graine égale : génération refusée',
      ));
    }

    const rapport = verifierCarte(carte);
    const mesures: Record<string, number | boolean> = { ...mesurer(carte), reproductible: true };
    mesures['chemin_qg_qg'] = rapport.mesures['chemin_qg_qg'] === 1;
    mesures['verifications_ok'] = rapport.ok;
    const apercu: ApercuCarte = {
      ascii: apercuTexte(carte),
      legende: LEGENDE_APERCU,
      mesures,
    };
    const diagnostic: Record<string, number> = {
      ...rapport.mesures,
      motifs: rapport.motifs.length,
      mapgen_version: MAPGEN_VERSION,
      surface_terre: carte.diagnostic?.surfaceTerre ?? 0,
      distance_qg_qg: carte.diagnostic?.distanceQgQg ?? 0,
      zones_isolees: carte.diagnostic?.zonesIsolees ?? 0,
    };
    return Promise.resolve({ carte, apercu, diagnostic });
  },

  verifier(carte: MapDef) {
    const rapport = verifierCarte(carte);
    return { ok: rapport.ok, motifs: rapport.motifs.map((m) => ({ code: m.code, detail: m.detail })) };
  },

  apercu(carte: MapDef): string {
    return apercuTexte(carte);
  },
};

/** Le générateur branché sur les routes. */
export function generateurCourant(): Generateur {
  return generateurMapgen;
}
