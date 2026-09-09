import { sontAllies } from '../equipes';
/**
 * Commandants : jauge, passif, pouvoir et super pouvoir (`doc/04-gameplay.md` §7).
 *
 * Les effets sont des données (`EffetPouvoir`) : un modificateur borné, ou la
 * seule famille nouvelle, `poser_terrain`, avec sa table de sept formes.
 * Les interdits du §7.2 sont des règles du moteur, pas des conventions d'écriture.
 */

import type {
  Case, CampId, CleTerrain, DureePouvoir, EffetModificateur, EffetPouvoir,
} from '../../schemas/index';
import { TABLE_POSER_TERRAIN } from '../../schemas/index';
import { dansCarte, terrainBrut, terrainLogique } from '../hooks';
import type {
  Catalogue, CommandantMoteur, EtatPartie, EvenementJeu, ExpirationModificateur,
  MotifRefus, SourceModificateur,
} from '../types';
import { cleCase, manhattan } from '../types';
import { uniteSur, voisines } from './mouvement';

/** Points de jauge d'une barre. */
export const POINTS_PAR_BARRE = 100;

/** Vrai si l'effet est une pose de terrain. */
export function estPoseTerrain(e: EffetPouvoir): e is Extract<EffetPouvoir, { poserTerrain: unknown }> {
  return 'poserTerrain' in e;
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
    poserModificateur(etat, camp, source, effet, expirationDe(verdict.duree, etat.journee));
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
