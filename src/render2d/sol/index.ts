/**
 * Le sol de la peau 2D — **point d'entrée provisoire**, posé avec le contrat
 * le 23 septembre 2026 pour que le moteur 2D et le lot du terrain travaillent
 * en même temps sans s'attendre. Il ne dessine rien et ne place aucun décor ;
 * le lot du terrain le remplace entièrement, en gardant ce nom et cette
 * signature (`FabriqueSol`, `src/render2d/contrat.ts`).
 */

import type { CoucheSol, FabriqueSol } from '../contrat';

export const creerSol: FabriqueSol = (): CoucheSol => ({
  maj: () => false,
  volumes: () => [],
  enMouvement: () => false,
  dessiner: () => {},
  dispose: () => {},
});
