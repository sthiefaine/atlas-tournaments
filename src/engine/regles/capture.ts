import { sontAllies } from '../equipes';
/**
 * Capture : vingt points, les PV affichés de l'unité, un multiplicateur borné
 * (`doc/04-gameplay.md` §6). Les points repartent de zéro au mouvement, jamais
 * aux dégâts.
 *
 * Deux bâtiments coûtent le double : le **QG**, qu'on ne prend pas en deux tours
 * sous le nez de son propriétaire, et un bâtiment **désaffecté**, qu'il faut
 * remettre en service avant d'en tirer quoi que ce soit (§6 bis). Le génie, seule
 * unité bâtisseuse, remet en service deux fois plus vite qu'une infanterie.
 */

import { BORNES_MODIFICATEUR } from '../../schemas/index';
import { terrainLogique } from '../hooks';
import type { Catalogue, EtatPartie, EvenementJeu, Unite } from '../types';
import { cleCase, porte, pvAffiches } from '../types';
import { multiplicateur } from './modificateurs';

/** Le seuil de capture : l'unité de compte de tout le projet. */
export const SEUIL_CAPTURE = 20;

/**
 * Prime versée au camp qui remet un bâtiment en service (`04-gameplay.md` §6 bis).
 * Doublée quand c'est le génie : quatre tours d'infanterie immobile coûtent
 * déjà assez cher pour que la prime récompense d'abord le bâtisseur.
 */
export const PRIME_REMISE_EN_SERVICE = 1000;

/** Vrai si la case de cette unité porte un bâtiment désaffecté. */
export function estDesaffecte(etat: EtatPartie, c: { x: number; y: number }): boolean {
  return etat.desaffectes.includes(cleCase(c));
}

/** Points à accumuler pour prendre la case où se trouve l'unité. */
export function seuilCapture(etat: EtatPartie, cat: Catalogue, c: { x: number; y: number }): number {
  const terrain = terrainLogique(etat, cat, c);
  return terrain === 'qg' || estDesaffecte(etat, c) ? SEUIL_CAPTURE * 2 : SEUIL_CAPTURE;
}

/** Vrai si cette unité peut capturer la case où elle se trouve. */
export function peutCapturerIci(etat: EtatPartie, cat: Catalogue, u: Unite): boolean {
  const type = cat.unites[u.type];
  if (!type) return false;
  const terrain = terrainLogique(etat, cat, u);
  if (terrain === null) return false;
  const t = cat.terrains[terrain];
  if (!t || !t.capturable) return false;
  // Le génie ne capture pas : il remet en service, et seulement ce qui est désaffecté.
  const capteur = porte(type, 'capture') && type.capture;
  if (!capteur && !(porte(type, 'genie') && estDesaffecte(etat, u))) return false;
  return !sontAllies(etat, etat.proprietaires[cleCase(u)], u.camp);
}

/** Points de capture gagnés par cette unité en un tour. */
export function pointsGagnes(etat: EtatPartie, cat: Catalogue, u: Unite): number {
  const bornes = BORNES_MODIFICATEUR.capture;
  const mult = Math.min(bornes.max, Math.max(bornes.min, multiplicateur(etat, cat, u, 'capture')));
  const type = cat.unites[u.type];
  // Un chantier de remise en service va deux fois plus vite avec des bâtisseurs.
  const batisseur = type && porte(type, 'genie') && estDesaffecte(etat, u) ? 2 : 1;
  return Math.max(1, Math.round(pvAffiches(u.pv) * mult * batisseur));
}

/**
 * Avance une capture. Rend `true` si le bâtiment change de propriétaire.
 * Écrit dans l'état de travail.
 */
export function avancerCapture(
  etat: EtatPartie, cat: Catalogue, u: Unite, evts: EvenementJeu[],
): boolean {
  const k = cleCase(u);
  const seuil = seuilCapture(etat, cat, u);
  u.pointsCapture += pointsGagnes(etat, cat, u);
  if (u.pointsCapture < seuil) {
    evts.push({
      type: 'capture', uniteId: u.id, case: { x: u.x, y: u.y },
      points: u.pointsCapture, acquis: false, camp: u.camp,
    });
    return false;
  }
  u.pointsCapture = 0;
  etat.proprietaires[k] = u.camp;
  if (estDesaffecte(etat, u)) {
    etat.desaffectes = etat.desaffectes.filter((d) => d !== k);
    const type = cat.unites[u.type];
    const prime = PRIME_REMISE_EN_SERVICE * (type && porte(type, 'genie') ? 2 : 1);
    const caisse = etat.camps.find((c) => c.id === u.camp);
    if (caisse) caisse.fonds += prime;
    evts.push({ type: 'remise_en_service', uniteId: u.id, case: { x: u.x, y: u.y }, camp: u.camp, prime });
  }
  evts.push({
    type: 'capture', uniteId: u.id, case: { x: u.x, y: u.y },
    points: seuil, acquis: true, camp: u.camp,
  });
  return true;
}

/** Remet à zéro les points de capture d'une unité qui a bougé ou changé d'ordre. */
export function reinitialiserCapture(u: Unite): void {
  u.pointsCapture = 0;
}
