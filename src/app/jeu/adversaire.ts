import { jouerTour, strategie } from '@/ai/index';
import { chargerCatalogue, restaurerRng, type Action, type CommandantMoteur, type EtatPartie } from '@/engine/index';
import type { Adversaire } from '@/render/index';
import type { StrategieIa } from '@/schemas/index';

/**
 * Branche l'IA du jeu sur le rendu.
 *
 * `render/` n'a pas le droit d'importer `ai/` (`02-architecture.md` §5, vérifié
 * par `tests/frontieres.test.ts`) : le rendu déclare seulement ce qu'il attend
 * d'un adversaire — une suite d'actions pour le tour du camp courant — et c'est
 * la page de jeu, qui a le droit d'importer les deux, qui les relie.
 *
 * L'IA reste déterministe : elle ne tire que du flux `ia` porté par l'état.
 */
export function adversaireIa(
  id: StrategieIa | undefined,
  catalogueVersion: number,
  commandants: (CommandantMoteur | null)[],
  strategiesParCamp: Partial<Record<number, StrategieIa>> = {},
): Adversaire {
  const cat = chargerCatalogue(catalogueVersion);
  const strat = strategie(id ?? 'ponderee');
  return (etat: EtatPartie): Action[] => jouerTour(
    etat, strategiesParCamp[etat.campCourant] ? strategie(strategiesParCamp[etat.campCourant]!) : strat, restaurerRng(etat.graine, etat.flux), cat, commandants,
  ).actions;
}
