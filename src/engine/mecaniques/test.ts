/**
 * `meca_test` — la mécanique de démonstration du contrat de hooks.
 * Elle n'appartient à aucune région : elle sert aux tests du moteur et de modèle
 * à qui écrit une mécanique réelle (`doc/04-gameplay.md` §11.1).
 *
 * Effet : une journée sur deux, la colonne `colonne` de plaines est vue comme une
 * forêt (couvert temporaire), et le compteur `appels` avance à chaque début de tour.
 */

import type { CleTerrain } from '../../schemas/index';
import type { CtxMecanique, EffetMecanique, Mecanique } from '../types';

/** Paramètres de `meca_test`. */
export interface ParametresTest {
  colonne: number;
  periodeJournees: number;
}

/** Vrai si le couvert de test est levé à cette journée. */
export function couvertActif(p: ParametresTest, journee: number): boolean {
  const periode = Math.max(1, p.periodeJournees);
  return journee % (2 * periode) < periode;
}

/** La mécanique de test. */
export const MECANIQUE_TEST: Mecanique<ParametresTest> = {
  cle: 'meca_test',
  nom: 'Mécanique de test',
  parametresParDefaut: { colonne: 0, periodeJournees: 1 },
  hooks: {
    debutTour(ctx: CtxMecanique<ParametresTest>): EffetMecanique[] {
      const appels = Number(ctx.donnees['appels'] ?? 0) + 1;
      return [
        { type: 'donnee', cle: 'appels', valeur: appels },
        {
          type: 'annonce',
          texte: couvertActif(ctx.parametres, ctx.journee)
            ? 'Couvert de test levé sur la colonne.'
            : 'Colonne dégagée.',
          icone: 'meca_test',
        },
      ];
    },
    modifTerrain(ctx: CtxMecanique<ParametresTest>, c, terrain: CleTerrain): CleTerrain {
      if (terrain !== 'plaine') return terrain;
      if (c.x !== ctx.parametres.colonne) return terrain;
      return couvertActif(ctx.parametres, ctx.journee) ? 'foret' : terrain;
    },
  },
};
