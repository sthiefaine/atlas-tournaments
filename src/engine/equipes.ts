import type { CampId } from '../schemas/index';
import type { EtatPartie } from './types';
/** Une case neutre n'appartient à aucune équipe. */
export function sontAllies(etat: EtatPartie, a: CampId | undefined | null, b: CampId | undefined | null): boolean {
  if (a == null || b == null) return false;
  return a === b || (etat.reglages.equipes ?? []).some((e) => e.includes(a) && e.includes(b));
}
/** Représentant stable, camp joueur compris même après son élimination. */
export function equipeDe(etat: EtatPartie, camp: CampId): CampId {
  return Math.min(...((etat.reglages.equipes ?? []).find((e) => e.includes(camp)) ?? [camp])) as CampId;
}
