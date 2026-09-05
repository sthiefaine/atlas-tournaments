/**
 * Les **vérifications structurelles** de la routine contrôle (`05-routines.md`
 * §4.1, point 2) : elles ne simulent aucune partie, elles relisent la carte.
 *
 * Tout est déjà écrit dans `mapgen/verifier.ts`, qui rend des motifs pris dans
 * l'énumération fermée `MotifRejet`. Ce fichier y ajoute la seule vérification
 * que le générateur ne peut pas faire sur lui-même : **la reproductibilité**.
 * `02-architecture.md` §7 en fait une règle dure — mêmes paramètres et même
 * graine donnent la même grille, au bit près après `JSON.stringify` —, et §6
 * demande qu'on la rejoue à la soumission. Une carte qui ne se régénère pas à
 * l'identique porte le motif `grille_non_reproductible`.
 */

import { genererCarte, mesurer, verifierCarte, type MotifVerification } from '../../mapgen/index';
import type { MapDef } from '../../schemas/index';

/** Ce que rend le contrôle structurel d'une carte. */
export interface RapportControle {
  ok: boolean;
  motifs: MotifVerification[];
  mesures: Record<string, number>;
}

/**
 * Rejoue la génération d'une carte à partir de ce qu'elle déclare et compare.
 * Une carte sans bloc `generation` n'est pas vérifiable ainsi : elle n'est pas
 * pour autant fautive (une carte écrite à la main n'a pas de graine), donc on
 * rend `null` plutôt qu'un motif.
 */
export function reproductible(carte: MapDef): boolean | null {
  const g = carte.generation;
  if (g === undefined) return null;
  const graine = Number(g.graine);
  if (!Number.isFinite(graine)) return null;
  const rejouee = genererCarte(g.parametres, graine);
  return JSON.stringify(rejouee.grille) === JSON.stringify(carte.grille)
    && JSON.stringify(rejouee.proprietaires) === JSON.stringify(carte.proprietaires)
    && JSON.stringify(rejouee.unitesDepart) === JSON.stringify(carte.unitesDepart);
}

/**
 * Le contrôle structurel complet : les vérifications de `mapgen`, plus la
 * reproductibilité. Le serveur recalcule tout : il ne fait confiance ni à la
 * routine, ni aux mesures stockées avec la carte.
 */
export function verifierCarteControle(carte: MapDef): RapportControle {
  const rapport = verifierCarte(carte);
  const motifs: MotifVerification[] = [...rapport.motifs];
  const mesures: Record<string, number> = { ...rapport.mesures };

  const rejeu = reproductible(carte);
  if (rejeu !== null) {
    mesures['reproductible'] = rejeu ? 1 : 0;
    if (!rejeu) {
      motifs.push({
        code: 'grille_non_reproductible',
        detail: 'la carte régénérée depuis sa graine et ses paramètres diffère de celle qui est stockée',
        mesure: { reproductible: 0 },
      });
    }
  }
  if (rapport.ok && motifs.length === 0) {
    Object.assign(mesures, mesurer(carte));
  }
  return { ok: motifs.length === 0, motifs, mesures };
}
