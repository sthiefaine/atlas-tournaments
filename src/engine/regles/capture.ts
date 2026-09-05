/**
 * Capture : vingt points, les PV affichés de l'unité, un multiplicateur borné
 * (`doc/04-gameplay.md` §6). Les points repartent de zéro au mouvement, jamais
 * aux dégâts.
 */

import { BORNES_MODIFICATEUR } from '../../schemas/index';
import { terrainLogique } from '../hooks';
import type { Catalogue, EtatPartie, EvenementJeu, Unite } from '../types';
import { cleCase, porte, pvAffiches } from '../types';
import { multiplicateur } from './modificateurs';

/** Le seuil de capture : l'unité de compte de tout le projet. */
export const SEUIL_CAPTURE = 20;

/** Vrai si cette unité peut capturer la case où elle se trouve. */
export function peutCapturerIci(etat: EtatPartie, cat: Catalogue, u: Unite): boolean {
  const type = cat.unites[u.type];
  if (!type || !porte(type, 'capture') || !type.capture) return false;
  const terrain = terrainLogique(etat, cat, u);
  if (terrain === null) return false;
  const t = cat.terrains[terrain];
  if (!t || !t.capturable) return false;
  return etat.proprietaires[cleCase(u)] !== u.camp;
}

/** Points de capture gagnés par cette unité en un tour. */
export function pointsGagnes(etat: EtatPartie, cat: Catalogue, u: Unite): number {
  const bornes = BORNES_MODIFICATEUR.capture;
  const mult = Math.min(bornes.max, Math.max(bornes.min, multiplicateur(etat, cat, u, 'capture')));
  return Math.max(1, Math.round(pvAffiches(u.pv) * mult));
}

/**
 * Avance une capture. Rend `true` si le bâtiment change de propriétaire.
 * Écrit dans l'état de travail.
 */
export function avancerCapture(
  etat: EtatPartie, cat: Catalogue, u: Unite, evts: EvenementJeu[],
): boolean {
  const k = cleCase(u);
  u.pointsCapture += pointsGagnes(etat, cat, u);
  if (u.pointsCapture < SEUIL_CAPTURE) {
    evts.push({
      type: 'capture', uniteId: u.id, case: { x: u.x, y: u.y },
      points: u.pointsCapture, acquis: false, camp: u.camp,
    });
    return false;
  }
  u.pointsCapture = 0;
  etat.proprietaires[k] = u.camp;
  evts.push({
    type: 'capture', uniteId: u.id, case: { x: u.x, y: u.y },
    points: SEUIL_CAPTURE, acquis: true, camp: u.camp,
  });
  return true;
}

/** Remet à zéro les points de capture d'une unité qui a bougé ou changé d'ordre. */
export function reinitialiserCapture(u: Unite): void {
  u.pointsCapture = 0;
}
