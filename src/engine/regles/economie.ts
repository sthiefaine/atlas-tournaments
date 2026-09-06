/**
 * Économie d'un tour : revenus, réparation payante, ravitaillement, carburant,
 * et production (`doc/04-gameplay.md` §2, phases 2 à 5, et §3).
 */

import type { Case, CampId, CleTerrain, CleUnite } from '../../schemas/index';
import { coutBase, produitesPar } from '../catalogue';
import { terrainLogique } from '../hooks';
import type {
  Catalogue, EtatPartie, EvenementJeu, MotifRefus, Unite,
} from '../types';
import { cleCase, depuisCle, porte, pvAffiches } from '../types';
import { multiplicateurFonds } from './modificateurs';
import { mettreHorsJeu } from './combat';
import { uniteSur } from './mouvement';

/** Bâtiments capturables possédés par un camp, clés de case triées. */
export function batimentsDe(etat: EtatPartie, camp: CampId): string[] {
  return Object.entries(etat.proprietaires)
    .filter(([, c]) => c === camp)
    .map(([k]) => k)
    .sort();
}

/** Bâtiments producteurs possédés par un camp. */
export function producteursDe(etat: EtatPartie, cat: Catalogue, camp: CampId): string[] {
  return batimentsDe(etat, camp).filter((k) => {
    const terrain = terrainLogique(etat, cat, depuisCle(k));
    return terrain !== null && produitesPar(cat, terrain).length > 0;
  });
}

/** Phase 2 — revenus. */
export function verserRevenus(
  etat: EtatPartie, camp: CampId, evts: EvenementJeu[],
): void {
  const c = etat.camps.find((e) => e.id === camp);
  if (!c) return;
  const nb = batimentsDe(etat, camp).length;
  const montant = Math.round(nb * etat.reglages.revenusParBatiment * multiplicateurFonds(etat, camp));
  c.fonds += montant;
  evts.push({ type: 'revenus', camp, montant });
}

/** Vrai si ce terrain ravitaille cette unité (compatibilité de domaine, §2 phase 3). */
export function ravitailleCetteUnite(cat: Catalogue, terrain: CleTerrain, domaine: string): boolean {
  const t = cat.terrains[terrain];
  if (!t || !t.ravitaille) return false;
  if (domaine === 'air') return terrain === 'aeroport' || terrain === 'ville';
  return terrain === 'ville' || terrain === 'usine' || terrain === 'qg';
}

/** Phase 3 — réparation payante et ravitaillement gratuit. */
export function reparerEtRavitailler(
  etat: EtatPartie, cat: Catalogue, camp: CampId, evts: EvenementJeu[],
): void {
  const caisse = etat.camps.find((e) => e.id === camp);
  if (!caisse) return;
  for (const u of etat.unites) {
    if (u.camp !== camp || u.dansTransport) continue;
    const type = cat.unites[u.type];
    if (!type) continue;
    const terrain = terrainLogique(etat, cat, u);
    if (terrain === null) continue;
    if (etat.proprietaires[cleCase(u)] !== camp) continue;
    if (!ravitailleCetteUnite(cat, terrain, type.domaine)) continue;
    // Munitions et carburant : gratuits.
    if (type.munitions !== null) u.munitions = type.munitions;
    if (type.carburant !== null) u.carburant = type.carburant.max;
    // PV : +2 PV affichés, payés au prorata du coût de l'unité.
    if (u.pv >= 100) continue;
    const souhaites = Math.min(2, Math.ceil((100 - u.pv) / 10));
    const coutParPv = type.cout / 10;
    const abordables = coutParPv <= 0 ? souhaites : Math.floor(caisse.fonds / coutParPv);
    const rendus = Math.max(0, Math.min(souhaites, abordables));
    if (rendus <= 0) continue;
    const cout = Math.round(rendus * coutParPv);
    caisse.fonds -= cout;
    u.pv = Math.min(100, u.pv + rendus * 10);
    evts.push({ type: 'reparation', uniteId: u.id, pv: rendus * 10, cout });
  }
}

/** Phase 4 — carburant : une unité aérienne à sec est mise hors jeu. */
export function consommerCarburant(
  etat: EtatPartie, cat: Catalogue, camp: CampId, evts: EvenementJeu[],
): void {
  const aRetirer: string[] = [];
  for (const u of etat.unites) {
    if (u.camp !== camp || u.dansTransport) continue;
    const type = cat.unites[u.type];
    if (!type || type.carburant === null || u.carburant === null) continue;
    if (type.carburant.parTour <= 0) continue;
    u.carburant = Math.max(0, u.carburant - type.carburant.parTour);
    if (u.carburant <= 0 && type.domaine === 'air') aRetirer.push(u.id);
  }
  for (const id of aRetirer) {
    evts.push({ type: 'panne_seche', uniteId: id });
    mettreHorsJeu(etat, cat, id, evts);
  }
}

/** Phase 5 — réveil : toutes les unités du camp repassent en `prete`. */
export function reveiller(etat: EtatPartie, camp: CampId): void {
  for (const u of etat.unites) {
    if (u.camp !== camp) continue;
    u.etat = 'prete';
  }
}

/** Verdict d'une demande de production. */
export type VerdictProduction =
  | { ok: true; cout: number }
  | { ok: false; motif: MotifRefus; detail?: string };

/** Vérifie une production : bâtiment possédé, libre, liste et fonds. */
export function verifierProduction(
  etat: EtatPartie, cat: Catalogue, camp: CampId, batiment: Case, unite: CleUnite,
): VerdictProduction {
  const terrain = terrainLogique(etat, cat, batiment);
  if (terrain === null) return { ok: false, motif: 'batiment_inconnu' };
  const k = cleCase(batiment);
  if (etat.proprietaires[k] !== camp) return { ok: false, motif: 'batiment_adverse' };
  if (uniteSur(etat, batiment)) return { ok: false, motif: 'batiment_occupe' };
  if (!produitesPar(cat, terrain).includes(unite)) {
    return { ok: false, motif: 'unite_non_produite_ici' };
  }
  const type = cat.unites[unite];
  if (!type) return { ok: false, motif: 'catalogue_inconnu' };
  if (coutBase(cat, terrain, type.typeMouvement, type) === null) {
    return { ok: false, motif: 'terrain_infranchissable' };
  }
  const caisse = etat.camps.find((e) => e.id === camp);
  if (!caisse || caisse.fonds < type.cout) return { ok: false, motif: 'fonds_insuffisants' };
  return { ok: true, cout: type.cout };
}

/** Produit une unité sur un bâtiment : elle ne joue qu'au tour suivant. */
export function produire(
  etat: EtatPartie, cat: Catalogue, camp: CampId, batiment: Case, cle: CleUnite,
  evts: EvenementJeu[],
): Unite {
  const type = cat.unites[cle]!;
  const caisse = etat.camps.find((e) => e.id === camp)!;
  caisse.fonds -= type.cout;
  const u: Unite = {
    id: `u${etat.prochainId}`,
    camp,
    type: cle,
    x: batiment.x,
    y: batiment.y,
    pv: 100,
    munitions: type.munitions,
    carburant: type.carburant ? type.carburant.max : null,
    etat: 'produite',
    pointsCapture: 0,
    cargo: [],
    dansTransport: null,
  };
  etat.prochainId += 1;
  etat.unites.push(u);
  etat.produites[`${camp}:${cle}`] = (etat.produites[`${camp}:${cle}`] ?? 0) + 1;
  evts.push({ type: 'production', camp, unite: cle, case: batiment, cout: type.cout });
  return u;
}

/** Valeur en fonds des unités d'un camp encore en jeu, PV compris (§9.1). */
export function valeurArmee(etat: EtatPartie, cat: Catalogue, camp: CampId): number {
  let total = 0;
  for (const u of etat.unites) {
    if (u.camp !== camp) continue;
    const type = cat.unites[u.type];
    if (!type) continue;
    total += type.cout * (pvAffiches(u.pv) / 10);
  }
  return total;
}

/** Vrai si l'unité porte le trait `ravitaillement` et peut servir un voisin. */
export function estRavitailleur(cat: Catalogue, u: Unite): boolean {
  const t = cat.unites[u.type];
  return t !== undefined && porte(t, 'ravitaillement');
}
