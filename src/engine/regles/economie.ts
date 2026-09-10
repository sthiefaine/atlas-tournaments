/**
 * Économie d'un tour : revenus, réparation payante, ravitaillement, carburant,
 * et production (`doc/04-gameplay.md` §2, phases 2 à 5, et §3).
 */

import type { Case, CampId, CleTerrain, CleUnite, UnitType } from '../../schemas/index';
import { coutBase, produitesPar } from '../catalogue';
import { sontAllies } from '../equipes';
import { terrainLogique } from '../hooks';
import type {
  Catalogue, EtatPartie, EvenementJeu, MotifRefus, Unite,
} from '../types';
import { cleCase, depuisCle, porte, pvAffiches } from '../types';
import { multiplicateur, multiplicateurFonds, multiplicateurPrix } from './modificateurs';
import { mettreHorsJeu } from './combat';
import { uniteSur } from './mouvement';
import { superusineSur } from './superusines';

/** Bâtiments capturables possédés par un camp, clés de case triées. */
export function batimentsDe(etat: EtatPartie, camp: CampId): string[] {
  return Object.entries(etat.proprietaires)
    .filter(([, c]) => c === camp)
    .map(([k]) => k)
    .sort();
}

/**
 * Bâtiments producteurs **adverses** à `rayon` pas de `centre` : ce qu'une
 * impulsion IEM arrête (10 septembre 2026). Adverse veut dire : ni le camp, ni
 * un allié, ni un camp éliminé. Chaque clé de case est rendue une fois, dans
 * l'ordre des camps puis l'ordre trié de `producteursDe`.
 */
export function producteursAdversesAutour(
  etat: EtatPartie, cat: Catalogue, camp: CampId, centre: Case, rayon: number,
): { camp: CampId; case: Case }[] {
  const sortie: { camp: CampId; case: Case }[] = [];
  for (const autre of etat.camps) {
    if (autre.elimine || sontAllies(etat, camp, autre.id)) continue;
    for (const k of producteursDe(etat, cat, autre.id)) {
      const c = depuisCle(k);
      if (Math.abs(c.x - centre.x) + Math.abs(c.y - centre.y) <= rayon) sortie.push({ camp: autre.id, case: c });
    }
  }
  return sortie;
}

/**
 * Pose l'impulsion sur ces bâtiments et rend leur nombre : `usinesIem[case]`
 * vaut la journée, et `verifierProduction` refuse `usine_iem` tant que
 * l'entrée est là. Un événement `usine_iem` par bâtiment, pour le HUD.
 */
export function frapperUsines(
  etat: EtatPartie, usines: { camp: CampId; case: Case }[], evts: EvenementJeu[],
): number {
  for (const u of usines) {
    (etat.usinesIem ??= {})[cleCase(u.case)] = etat.journee;
    evts.push({ type: 'usine_iem', camp: u.camp, case: u.case });
  }
  return usines.length;
}

/** Bâtiments producteurs possédés par un camp. */
export function producteursDe(etat: EtatPartie, cat: Catalogue, camp: CampId): string[] {
  return batimentsDe(etat, camp).filter((k) => {
    const c = depuisCle(k);
    // Une superusine de scénario ne produit qu'automatiquement, et pour son
    // seul camp d'origine : au menu, elle est inerte pour tout le monde
    // (`usine_inerte`), donc elle n'est un producteur pour personne.
    if (superusineSur(etat, c)) return false;
    const terrain = terrainLogique(etat, cat, c);
    return terrain !== null && produitesPar(cat, terrain, etat, camp).length > 0;
  });
}

/**
 * Ce qu'un camp touchera à l'ouverture de sa prochaine journée.
 *
 * C'est la formule de `verserRevenus`, isolée pour qu'on puisse l'**afficher** :
 * le solde dit où l'on en est, le revenu dit où l'on va, et c'est la seconde
 * moitié qui manquait à l'écran. Isolée, et pas recopiée dans le HUD — un
 * multiplicateur de pouvoir ou une règle régionale changerait la vraie et
 * laisserait la copie mentir, ce qui est exactement la faute que le dépôt a
 * déjà commise quatre fois avec des listes de bâtiments et une fois avec la
 * formule de dégâts.
 */
export function revenuParTour(etat: EtatPartie, camp: CampId): number {
  const nb = batimentsDe(etat, camp).length;
  return Math.round(nb * (etat.reglages.revenusParBatimentParCamp?.[camp] ?? etat.reglages.revenusParBatiment) * multiplicateurFonds(etat, camp));
}

/** Phase 2 — revenus. */
export function verserRevenus(
  etat: EtatPartie, camp: CampId, evts: EvenementJeu[],
): void {
  const c = etat.camps.find((e) => e.id === camp);
  if (!c) return;
  const montant = revenuParTour(etat, camp);
  c.fonds += montant;
  evts.push({ type: 'revenus', camp, montant });
}

/** Vrai si ce terrain ravitaille cette unité (compatibilité de domaine, §2 phase 3). */
export function ravitailleCetteUnite(cat: Catalogue, terrain: CleTerrain, domaine: string): boolean {
  const t = cat.terrains[terrain];
  if (!t || !t.ravitaille) return false;
  if (domaine === 'air') return terrain === 'aeroport' || terrain === 'ville';
  // Une coque ne se ravitaille qu'à quai : le port est le seul bâtiment qu'elle
  // atteigne, et c'est ce qui donne son prix à une carte côtière (§10 quater).
  if (domaine === 'mer') return terrain === 'port';
  return terrain === 'ville' || terrain === 'usine' || terrain === 'qg';
}

/**
 * Surcoût de carburant par tour d'une unité furtive (trait `furtif`, catalogue
 * 6) : se cacher coûte, sans quoi rien ne ferait jamais réapparaître un chasseur.
 */
export const SURCOUT_CARBURANT_FURTIF = 3;

/**
 * Carburant consommé par tour par cette unité, immobile : la furtivité
 * s'ajoute, puis le tout est multiplié par `facteur` — le modificateur
 * `carburant` d'un pouvoir (10 septembre 2026), que `consommationEffective`
 * lit dans l'état. Sans facteur, c'est la consommation nominale du catalogue.
 */
export function consommationParTour(type: UnitType, u: Pick<Unite, 'furtive'>, facteur = 1): number {
  if (type.carburant === null) return 0;
  const base = type.carburant.parTour + (u.furtive === true ? SURCOUT_CARBURANT_FURTIF : 0);
  return base <= 0 ? 0 : Math.max(1, Math.round(base * facteur));
}

/** Consommation par tour d'une unité en jeu, modificateur `carburant` compris. */
export function consommationEffective(etat: EtatPartie, cat: Catalogue, u: Unite): number {
  const type = cat.unites[u.type];
  if (!type) return 0;
  return consommationParTour(type, u, multiplicateur(etat, cat, u, 'carburant'));
}

/** Phase 3 — réparation payante et ravitaillement gratuit. */
export function reparerEtRavitailler(
  etat: EtatPartie, cat: Catalogue, camp: CampId, evts: EvenementJeu[],
): void {
  const caisse = etat.camps.find((e) => e.id === camp);
  if (!caisse) return;
  for (const u of etat.unites) {
    if (u.camp !== camp) continue;
    const type = cat.unites[u.type];
    if (!type) continue;
    if (u.dansTransport !== null) {
      // À bord d'un transport qui ravitaille (`transport.ravitaille`, catalogue 6),
      // le plein se fait en cale : munitions et carburant, jamais les PV — on ne
      // répare pas en mer. Les autres transports ne font que porter.
      const porteur = etat.unites.find((t) => t.id === u.dansTransport);
      const tp = porteur ? cat.unites[porteur.type] : undefined;
      if (tp?.transport?.ravitaille !== true) continue;
      if (type.munitions !== null) u.munitions = type.munitions;
      if (type.carburant !== null) u.carburant = type.carburant.max;
      continue;
    }
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
    const conso = consommationEffective(etat, cat, u);
    if (conso <= 0) continue;
    u.carburant = Math.max(0, u.carburant - conso);
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

/**
 * Prix d'achat d'une unité pour ce camp : le coût du catalogue, multiplié par
 * le modificateur `prix` de ses pouvoirs (10 septembre 2026), arrondi à la
 * centaine — les fonds se comptent par centaines, un prix de 6 517 ne se lit
 * pas. Seule source du prix : la vérification, la production, le HUD et l'IA
 * la lisent tous.
 */
export function prixProduction(etat: EtatPartie, cat: Catalogue, camp: CampId, cle: CleUnite): number {
  const type = cat.unites[cle];
  if (!type) return 0;
  return Math.round((type.cout * multiplicateurPrix(etat, camp)) / 100) * 100;
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
  // Une superusine de scénario (10 septembre 2026 au soir) se capture, mais ne
  // sert à rien : aucun menu de production n'y répond, pour qui la tient comme
  // pour son camp d'origine — celui-ci n'a que la production automatique. Le
  // motif passe avant l'occupation : l'inertie est celle de la case, qu'une
  // unité y soit ou non.
  if (superusineSur(etat, batiment)) return { ok: false, motif: 'usine_inerte' };
  if (uniteSur(etat, batiment)) return { ok: false, motif: 'batiment_occupe' };
  // Sous impulsion IEM (10 septembre 2026), le bâtiment ne produit rien de ce
  // tour : l'entrée est levée à la fermeture du tour de son propriétaire.
  if (etat.usinesIem?.[k] !== undefined) return { ok: false, motif: 'usine_iem' };
  if (!produitesPar(cat, terrain, etat, camp).includes(unite)) {
    return { ok: false, motif: 'unite_non_produite_ici' };
  }
  const type = cat.unites[unite];
  if (!type) return { ok: false, motif: 'catalogue_inconnu' };
  if (coutBase(cat, terrain, type.typeMouvement, type) === null) {
    return { ok: false, motif: 'terrain_infranchissable' };
  }
  const caisse = etat.camps.find((e) => e.id === camp);
  const prix = prixProduction(etat, cat, camp, unite);
  if (!caisse || caisse.fonds < prix) return { ok: false, motif: 'fonds_insuffisants' };
  return { ok: true, cout: prix };
}

/** Produit une unité sur un bâtiment : elle ne joue qu'au tour suivant. */
export function produire(
  etat: EtatPartie, cat: Catalogue, camp: CampId, batiment: Case, cle: CleUnite,
  evts: EvenementJeu[],
): Unite {
  const type = cat.unites[cle]!;
  const caisse = etat.camps.find((e) => e.id === camp)!;
  const prix = prixProduction(etat, cat, camp, cle);
  caisse.fonds -= prix;
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
  evts.push({ type: 'production', camp, unite: cle, case: batiment, cout: prix });
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
