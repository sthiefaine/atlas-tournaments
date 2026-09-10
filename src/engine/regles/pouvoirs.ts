import { sontAllies } from '../equipes';
/**
 * Commandants : jauge, passif, pouvoir et super pouvoir (`doc/04-gameplay.md` §7).
 *
 * Les effets sont des données (`EffetPouvoir`) : un modificateur borné, une
 * pose de terrain avec sa table de sept formes, et depuis le 10 septembre 2026
 * les familles **instantanées** — soin, dégâts directs, ravitaillement,
 * réactivation, météo imposée —, appliquées une fois au déclenchement et
 * jamais posées dans `etat.modificateurs`. Les interdits du §7.2 sont des
 * règles du moteur, pas des conventions d'écriture : jamais de mise hors jeu
 * directe (`degats_directs` laisse toujours 1 PV interne), jamais de
 * changement de propriétaire, jamais de production gratuite, jamais d'échange
 * de position, et un seul tour supplémentaire — `reactiver`, au super seul.
 */

import type {
  Case, CampId, CibleEffet, CleTerrain, DureePouvoir, EffetModificateur, EffetPouvoir, FiltreEffet, Meteo,
} from '../../schemas/index';
import { QUOI_INSTANTANES, TABLE_POSER_TERRAIN } from '../../schemas/index';
import { dansCarte, terrainBrut, terrainLogique } from '../hooks';
import type {
  Catalogue, CommandantMoteur, EtatPartie, EvenementJeu, ExpirationModificateur,
  MotifRefus, SourceModificateur, Unite,
} from '../types';
import { cleCase, manhattan, pvAffiches } from '../types';
import { viseUnite } from './modificateurs';
import { uniteSur, voisines } from './mouvement';

/** Points de jauge d'une barre. */
export const POINTS_PAR_BARRE = 100;

/** Vrai si l'effet est une pose de terrain. */
export function estPoseTerrain(e: EffetPouvoir): e is Extract<EffetPouvoir, { poserTerrain: unknown }> {
  return 'poserTerrain' in e;
}

/**
 * Vrai si l'effet est un modificateur **durable**, celui qu'on pose dans
 * l'état pour la durée du pouvoir. Un `soin` ou des `degats_directs` portent
 * la forme d'un modificateur mais s'appliquent une fois : ils n'en sont pas.
 */
export function estModificateurDurable(e: EffetPouvoir): e is EffetModificateur {
  return 'modificateur' in e && !QUOI_INSTANTANES.includes(e.modificateur.quoi);
}

/** Vrai si l'effet s'applique une fois au déclenchement, sans rien laisser dans l'état. */
export function estInstantane(e: EffetPouvoir): boolean {
  if (estPoseTerrain(e)) return false;
  if ('modificateur' in e) return QUOI_INSTANTANES.includes(e.modificateur.quoi);
  return true;
}

/**
 * Les unités qu'un effet vise, pour ce camp : mêmes cible et filtre qu'un
 * modificateur (`viseUnite`). Les unités embarquées comptent quand
 * `embarquees` est vrai — un soin atteint la cale, une réactivation non.
 */
export function unitesVisees(
  etat: EtatPartie, cat: Catalogue, camp: CampId,
  effet: { cible: CibleEffet; filtre?: FiltreEffet }, embarquees: boolean,
): Unite[] {
  return etat.unites.filter((u) => (embarquees || u.dansTransport === null)
    && viseUnite(etat, cat, { camp, effet }, u));
}

/** Ce qu'un soin rend à une unité, en points internes : plafonné à 100. */
function soinDe(u: Unite, n: number): number {
  return Math.max(0, Math.min(100 - u.pv, n * 10));
}

/** Ce que des dégâts directs retirent à une unité : jamais le dernier point. */
function degatsDirectsDe(u: Unite, n: number): number {
  return Math.max(0, Math.min(u.pv - 1, n * 10));
}

/** Ce que rend `evaluerEffets` : le bilan d'un pouvoir avant de le payer. */
export interface EvaluationEffets {
  /** PV affichés que le soin rendrait, toutes unités visées confondues. */
  pvSoignes: number;
  /** PV affichés que les dégâts directs retireraient à l'adversaire. */
  pvRetires: number;
  /** Unités qui rejoueraient. */
  reactivees: string[];
  /** Unités dont les munitions ou le carburant remonteraient. */
  ravitaillees: string[];
  /** Météo imposée, ou `null`. */
  meteo: Meteo | null;
}

/**
 * Évalue les effets instantanés d'un pouvoir **sans rien appliquer** : c'est
 * ce que l'IA lit pour décider de payer (`ai/pouvoirs.ts`), et ce que le HUD
 * pourra dire avant confirmation. Les modificateurs durables ne sont pas
 * comptés ici — leur valeur se lit en rejouant un duel sur l'état d'après.
 */
export function evaluerEffets(
  etat: EtatPartie, cat: Catalogue, camp: CampId, effets: readonly EffetPouvoir[],
): EvaluationEffets {
  const bilan: EvaluationEffets = { pvSoignes: 0, pvRetires: 0, reactivees: [], ravitaillees: [], meteo: null };
  for (const effet of effets) {
    if (estPoseTerrain(effet)) continue;
    if ('modificateur' in effet) {
      const { quoi, valeur } = effet.modificateur;
      if (quoi === 'soin') {
        for (const u of unitesVisees(etat, cat, camp, effet, true)) {
          bilan.pvSoignes += pvAffiches(u.pv + soinDe(u, valeur)) - pvAffiches(u.pv);
        }
      } else if (quoi === 'degats_directs') {
        for (const u of unitesVisees(etat, cat, camp, effet, true)) {
          bilan.pvRetires += pvAffiches(u.pv) - pvAffiches(u.pv - degatsDirectsDe(u, valeur));
        }
      }
    } else if ('ravitailler' in effet) {
      for (const u of unitesVisees(etat, cat, camp, effet, true)) {
        if (manqueDe(cat, u, effet.ravitailler)) bilan.ravitaillees.push(u.id);
      }
    } else if ('reactiver' in effet) {
      for (const u of unitesVisees(etat, cat, camp, effet, false)) {
        if ((u.etat === 'agi' || u.etat === 'deplacee') && u.reactivee !== true) bilan.reactivees.push(u.id);
      }
    } else if ('meteo' in effet) {
      bilan.meteo = effet.meteo.valeur;
    }
  }
  return bilan;
}

/** Vrai si un ravitaillement changerait quelque chose à cette unité. */
function manqueDe(cat: Catalogue, u: Unite, quoi: { carburant: boolean; munitions: boolean }): boolean {
  const type = cat.unites[u.type];
  if (!type) return false;
  if (quoi.munitions && type.munitions !== null && u.munitions !== null && u.munitions < type.munitions) return true;
  if (quoi.carburant && type.carburant !== null && u.carburant !== null && u.carburant < type.carburant.max) return true;
  return false;
}

/**
 * Applique un effet instantané dans l'état de travail. Rien ici ne pose de
 * modificateur : ce qui est fait est fait, et l'état ne garde qu'une trace —
 * `reactivee` sur l'unité, `meteoImposee` sur la partie — pour tenir la règle
 * du « une fois par tour » et celle des journées de météo.
 */
function appliquerInstantane(
  etat: EtatPartie, cat: Catalogue, camp: CampId, effet: EffetPouvoir, evts: EvenementJeu[],
): void {
  if (estPoseTerrain(effet)) return;
  if ('modificateur' in effet) {
    const { quoi, valeur } = effet.modificateur;
    if (quoi === 'soin') {
      for (const u of unitesVisees(etat, cat, camp, effet, true)) {
        const pv = soinDe(u, valeur);
        if (pv <= 0) continue;
        u.pv += pv;
        evts.push({ type: 'soin', uniteId: u.id, pv });
      }
    } else if (quoi === 'degats_directs') {
      for (const u of unitesVisees(etat, cat, camp, effet, true)) {
        const pv = degatsDirectsDe(u, valeur);
        if (pv <= 0) continue;
        u.pv -= pv;
        evts.push({ type: 'degats_directs', uniteId: u.id, pv });
      }
    }
    return;
  }
  if ('ravitailler' in effet) {
    for (const u of unitesVisees(etat, cat, camp, effet, true)) {
      const type = cat.unites[u.type];
      if (!type || !manqueDe(cat, u, effet.ravitailler)) continue;
      if (effet.ravitailler.munitions && type.munitions !== null) u.munitions = type.munitions;
      if (effet.ravitailler.carburant && type.carburant !== null) u.carburant = type.carburant.max;
      // Même événement qu'un ravitaillement de voisin : l'unité est sa propre source.
      evts.push({ type: 'ravitaillement', uniteId: u.id, cibleId: u.id });
    }
    return;
  }
  if ('reactiver' in effet) {
    const unites: string[] = [];
    for (const u of unitesVisees(etat, cat, camp, effet, false)) {
      if (u.etat !== 'agi' && u.etat !== 'deplacee') continue;
      if (u.reactivee === true) continue;
      // Les points de capture restent : l'unité rejoue, elle ne repart pas.
      u.etat = 'prete';
      u.reactivee = true;
      unites.push(u.id);
    }
    evts.push({ type: 'reactivation', camp, unites });
    return;
  }
  if ('meteo' in effet) {
    const { valeur, journees } = effet.meteo;
    const jusqu = etat.journee + journees - 1;
    etat.meteoImposee = { meteo: valeur, jusqu, camp };
    // La journée courante change tout de suite ; la prévision de demain aussi
    // si le pouvoir la couvre. Rien n'est tiré : le flux `meteo` ne bouge pas.
    etat.climat.meteo = valeur;
    if (journees >= 2) etat.climat.previsions[0] = valeur;
    evts.push({ type: 'meteo_forcee', camp, meteo: valeur, journees });
  }
}

/** Traduit une durée de pouvoir en expiration d'état. */
export function expirationDe(duree: DureePouvoir, journee: number): ExpirationModificateur {
  if (duree === 'ce_tour') return { type: 'ce_tour' };
  if (duree === 'tour_complet') return { type: 'tour_complet' };
  return { type: 'journees', jusqu: journee + duree.n };
}

/** Pose un modificateur actif dans l'état de travail. */
export function poserModificateur(
  etat: EtatPartie, camp: CampId, source: SourceModificateur,
  effet: EffetModificateur, expire: ExpirationModificateur,
): void {
  etat.modificateurs.push({
    id: etat.prochainModificateur, camp, source, effet, expire,
  });
  etat.prochainModificateur += 1;
}

/** Retire les modificateurs d'une source pour un camp (fin de pouvoir). */
export function retirerModificateurs(
  etat: EtatPartie, garde: (m: EtatPartie['modificateurs'][number]) => boolean,
): void {
  etat.modificateurs = etat.modificateurs.filter(garde);
}

/** Verdict d'une pose de terrain. */
export type VerdictPose =
  | { ok: true; cases: Case[]; vers: CleTerrain }
  | { ok: false; motif: MotifRefus; detail?: string };

/**
 * Vérifie une pose de terrain : couple `depuis → vers` de la table, nombre de
 * cases, contiguïté, et les trois interdits — jamais sur une case capturable,
 * jamais sur une case occupée, jamais à côté d'un QG adverse.
 */
export function verifierPose(
  etat: EtatPartie, cat: Catalogue, camp: CampId,
  effet: Extract<EffetPouvoir, { poserTerrain: unknown }>, cases: Case[],
): VerdictPose {
  const p = effet.poserTerrain;
  const table = TABLE_POSER_TERRAIN[p.forme];
  if (!table) return { ok: false, motif: 'pose_invalide', detail: 'forme inconnue' };
  if (p.vers !== table.vers) return { ok: false, motif: 'pose_invalide', detail: 'terrain de sortie hors table' };
  if (cases.length < 1 || cases.length > Math.min(4, p.casesMax)) {
    return { ok: false, motif: 'pose_invalide', detail: 'nombre de cases hors bornes' };
  }
  const qgAdverses = Object.entries(etat.proprietaires)
    .filter(([k, c]) => !sontAllies(etat, c, camp) && terrainBrut(etat, cat, {
      x: Number(k.split(',')[0]), y: Number(k.split(',')[1]),
    }) === 'qg')
    .map(([k]) => ({ x: Number(k.split(',')[0]), y: Number(k.split(',')[1]) }));

  for (const c of cases) {
    if (!dansCarte(etat, c)) return { ok: false, motif: 'pose_invalide', detail: 'case hors carte' };
    const terrain = terrainLogique(etat, cat, c);
    if (terrain === null) return { ok: false, motif: 'pose_invalide' };
    if (!table.depuis.includes(terrain) || !p.depuis.includes(terrain)) {
      return { ok: false, motif: 'pose_invalide', detail: `terrain ${terrain} hors table` };
    }
    const t = cat.terrains[terrain];
    if (t?.capturable) return { ok: false, motif: 'pose_invalide', detail: 'case capturable' };
    if (uniteSur(etat, c)) return { ok: false, motif: 'pose_invalide', detail: 'case occupée' };
    for (const qg of qgAdverses) {
      if (manhattan(qg, c) <= 1) return { ok: false, motif: 'pose_invalide', detail: 'adjacente à un QG adverse' };
    }
  }
  if (p.contigu && cases.length > 1) {
    const restantes = cases.slice(1);
    const groupe = [cases[0]!];
    let progresse = true;
    while (progresse && restantes.length > 0) {
      progresse = false;
      for (let i = restantes.length - 1; i >= 0; i -= 1) {
        const c = restantes[i]!;
        if (groupe.some((g) => voisines(g).some((v) => v.x === c.x && v.y === c.y))) {
          groupe.push(c);
          restantes.splice(i, 1);
          progresse = true;
        }
      }
    }
    if (restantes.length > 0) return { ok: false, motif: 'pose_invalide', detail: 'cases non contiguës' };
  }
  return { ok: true, cases, vers: p.vers };
}

/** Verdict d'une demande de pouvoir. */
export type VerdictPouvoir =
  | { ok: true; cout: number; nom: string; effets: EffetPouvoir[]; duree: DureePouvoir }
  | { ok: false; motif: MotifRefus; detail?: string };

/** Vérifie qu'un camp peut déclencher ce niveau de pouvoir. */
export function verifierPouvoir(
  etat: EtatPartie, commandant: CommandantMoteur | null, camp: CampId, niveau: 'normal' | 'super',
): VerdictPouvoir {
  const caisse = etat.camps.find((e) => e.id === camp);
  if (!caisse) return { ok: false, motif: 'pas_de_commandant' };
  if (!commandant) return { ok: false, motif: 'pas_de_commandant' };
  if (caisse.pouvoirUtiliseCeTour) return { ok: false, motif: 'pouvoir_deja_utilise' };
  const p = niveau === 'super' ? commandant.superPouvoir : commandant.pouvoir;
  // Les deux exceptions nommées du §7.2 sont réservées au super : un pouvoir
  // normal qui les porte n'est jamais prêt, quelle que soit la jauge.
  if (niveau !== 'super') {
    for (const e of p.effets) {
      if ('reactiver' in e) {
        return { ok: false, motif: 'pouvoir_invalide', detail: 'réactiver ses unités est réservé au super pouvoir' };
      }
      if ('meteo' in e && e.meteo.journees > 1) {
        return { ok: false, motif: 'pouvoir_invalide', detail: 'une météo de deux journées est réservée au super pouvoir' };
      }
    }
  }
  const cout = p.barres * POINTS_PAR_BARRE;
  if (caisse.jauge < cout) return { ok: false, motif: 'jauge_insuffisante' };
  return { ok: true, cout, nom: p.nom, effets: p.effets, duree: p.duree };
}

/** Applique un pouvoir déjà vérifié : jauge, modificateurs, poses de terrain. */
export function appliquerPouvoir(
  etat: EtatPartie, cat: Catalogue, camp: CampId, niveau: 'normal' | 'super',
  verdict: Extract<VerdictPouvoir, { ok: true }>, cases: Case[], evts: EvenementJeu[],
): { ok: true } | { ok: false; motif: MotifRefus; detail?: string } {
  const source: SourceModificateur = niveau === 'super' ? 'super' : 'pouvoir';
  const poses: { cases: Case[]; vers: CleTerrain; jusqu: number | null }[] = [];
  for (const effet of verdict.effets) {
    if (!estPoseTerrain(effet)) continue;
    const v = verifierPose(etat, cat, camp, effet, cases);
    if (!v.ok) return v;
    const duree = effet.poserTerrain.duree;
    if (duree === 'permanent' && niveau !== 'super') {
      return { ok: false, motif: 'pose_invalide', detail: 'pose permanente réservée au super pouvoir' };
    }
    poses.push({
      cases: v.cases,
      vers: v.vers,
      jusqu: duree === 'permanent' ? null : etat.journee + duree.n,
    });
  }
  const caisse = etat.camps.find((e) => e.id === camp)!;
  caisse.jauge -= verdict.cout;
  caisse.pouvoirUtiliseCeTour = true;
  for (const effet of verdict.effets) {
    if (estPoseTerrain(effet)) continue;
    if (estModificateurDurable(effet)) {
      poserModificateur(etat, camp, source, effet, expirationDe(verdict.duree, etat.journee));
    } else {
      appliquerInstantane(etat, cat, camp, effet, evts);
    }
  }
  for (const pose of poses) {
    for (const c of pose.cases) {
      etat.terrainsPoses.push({ case: cleCase(c), terrain: pose.vers, jusqu: pose.jusqu });
      evts.push({ type: 'terrain_pose', case: c, terrain: pose.vers });
    }
  }
  evts.push({ type: 'pouvoir', camp, niveau, nom: verdict.nom });
  return { ok: true };
}

/** Retire les poses de terrain arrivées à expiration et repousse ce qui reste dessus. */
export function expirerPoses(etat: EtatPartie, cat: Catalogue, evts: EvenementJeu[]): void {
  const gardees = etat.terrainsPoses.filter((p) => p.jusqu === null || p.jusqu >= etat.journee);
  const retirees = etat.terrainsPoses.filter((p) => !(p.jusqu === null || p.jusqu >= etat.journee));
  if (retirees.length === 0) return;
  etat.terrainsPoses = gardees;
  for (const pose of retirees) {
    const [x, y] = pose.case.split(',');
    const c = { x: Number(x), y: Number(y) };
    evts.push({ type: 'terrain_retire', case: c });
    const u = uniteSur(etat, c);
    if (!u) continue;
    const type = cat.unites[u.type];
    if (!type) continue;
    const terrain = terrainLogique(etat, cat, c);
    if (terrain === null) continue;
    if (cat.terrains[terrain]?.couts[type.typeMouvement] !== undefined) continue;
    // Case redevenue infranchissable : l'unité est repoussée, jamais mise hors jeu.
    const refuge = voisines(c).find((v) => {
      if (!dansCarte(etat, v) || uniteSur(etat, v)) return false;
      const t = terrainLogique(etat, cat, v);
      return t !== null && cat.terrains[t]?.couts[type.typeMouvement] !== undefined;
    });
    if (refuge) {
      u.x = refuge.x;
      u.y = refuge.y;
      u.pointsCapture = 0;
      evts.push({ type: 'repousse', uniteId: u.id, vers: refuge });
    }
  }
}
