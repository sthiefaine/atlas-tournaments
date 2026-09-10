/**
 * Les superusines de scénario (`doc/04-gameplay.md` §7.7, 10 septembre 2026).
 *
 * Une superusine est un bâtiment producteur du camp qui, au **début du tour**
 * de ce camp, fait paraître une unité neuve **sans coût** quand la journée est
 * due — la seule production gratuite du jeu, et elle n'existe qu'ici : jamais
 * par un pouvoir (§7.2), jamais par une mécanique. L'unité est `prete`, au
 * plein de munitions et de carburant, et joue le tour même.
 *
 * Elle s'arrête d'elle-même, sans état à tenir : dès que la case n'est plus au
 * camp — capturée par un adversaire, ou désaffectée —, rien ne sort. C'est ce
 * qui la rend prenable : capturer le bâtiment suffit, comme pour toute usine.
 *
 * Et **on ne peut rien en faire** (10 septembre 2026 au soir, décision du
 * propriétaire) : une superusine ne répond à aucun menu de production, pour
 * qui la tient comme pour son camp d'origine, qui n'a que la production
 * automatique. `verifierProduction` refuse `usine_inerte`, et `producteursDe`
 * ne la compte pas — ni l'IA pour ses achats, ni l'impulsion IEM, qui ne
 * touche que ce qui produit au menu.
 */

import type { Case, Superusine } from '../../schemas/index';
import { dansCarte } from '../hooks';
import type { Catalogue, EtatPartie, EvenementJeu, Unite } from '../types';
import { cleCase } from '../types';
import { coutEntree, uniteSur, voisines } from './mouvement';

/** La superusine du scénario posée sur cette case, ou `null` : une case en porte une au plus. */
export function superusineSur(etat: EtatPartie, c: Case): Superusine | null {
  return (etat.reglages.superusines ?? []).find((s) => s.x === c.x && s.y === c.y) ?? null;
}

/** Vrai si cette superusine doit produire à cette journée, calendrier seul. */
export function superusineDue(s: { depuisJournee?: number; chaque?: number }, journee: number): boolean {
  const depuis = s.depuisJournee ?? 1;
  const chaque = Math.max(1, s.chaque ?? 1);
  return journee >= depuis && (journee - depuis) % chaque === 0;
}

/**
 * La case où l'unité paraît : le bâtiment s'il est libre, sinon la première
 * voisine libre et franchissable dans l'ordre fixe de `voisines` ; `null`
 * quand tout est pris — la production est alors sautée, sans report ni compte.
 */
export function caseDApparition(etat: EtatPartie, cat: Catalogue, u: Unite, c: Case): Case | null {
  if (!uniteSur(etat, c)) return c;
  for (const v of voisines(c)) {
    if (dansCarte(etat, v) && !uniteSur(etat, v) && coutEntree(etat, cat, u, v) !== null) return v;
  }
  return null;
}

/** Début de tour : chaque superusine active du camp courant produit si la journée est due. */
export function produireSuperusines(etat: EtatPartie, cat: Catalogue, evts: EvenementJeu[]): void {
  const camp = etat.campCourant;
  for (const [i, s] of (etat.reglages.superusines ?? []).entries()) {
    if (s.camp !== camp || !superusineDue(s, etat.journee)) continue;
    const k = cleCase(s);
    // Capturée ou désaffectée : la superusine est arrêtée, sans autre marque.
    if (etat.proprietaires[k] !== camp || etat.desaffectes.includes(k)) continue;
    const produites = etat.superusinesProduites?.[String(i)] ?? 0;
    if (s.max !== undefined && produites >= s.max) continue;
    const type = cat.unites[s.type];
    const caisse = etat.camps.find((c) => c.id === camp);
    if (!type || !caisse || caisse.elimine) continue;
    const unite: Unite = {
      id: `u${etat.prochainId}`, camp, type: s.type, x: s.x, y: s.y, pv: 100,
      munitions: type.munitions, carburant: type.carburant ? type.carburant.max : null,
      etat: 'prete', pointsCapture: 0, cargo: [], dansTransport: null,
    };
    const position = caseDApparition(etat, cat, unite, { x: s.x, y: s.y });
    if (!position) continue;
    unite.x = position.x;
    unite.y = position.y;
    etat.unites.push(unite);
    etat.prochainId += 1;
    (etat.superusinesProduites ??= {})[String(i)] = produites + 1;
    etat.produites[`${camp}:${s.type}`] = (etat.produites[`${camp}:${s.type}`] ?? 0) + 1;
    evts.push({ type: 'production_automatique', camp, uniteId: unite.id, unite: s.type, case: position });
  }
}
