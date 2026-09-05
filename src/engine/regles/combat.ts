/**
 * Combat : la formule de dégâts, la riposte, les munitions et la jauge
 * (`doc/04-gameplay.md` §5 et §7.1).
 *
 * ```
 * Fterrain = 1 − 0,05 × E × (pvCible / 10)
 * A        = 0,95 + 0,10 × r        r tiré dans rng.branche('combat')
 * D        = base × (pvAtt / 10) × Matt × Fterrain × (1 / Mdef) × A
 * pvPerdus = min(pvCible, max(1, arrondi(D)))     si base > 0
 * ```
 *
 * Les fonctions de résolution écrivent dans l'état **de travail** : `appliquer`
 * en a déjà fait une copie, l'état d'entrée n'est jamais touché.
 */

import type { Case } from '../../schemas/index';
import { degatsBase } from '../catalogue';
import { surAttaqueHooks } from '../hooks';
import type {
  Catalogue, EtatPartie, EvenementJeu, MotifRefus, Rng, Unite,
} from '../types';
import { manhattan, porte, pvAffiches } from '../types';
import { terrainSous } from './mouvement';
import { multiplicateur } from './modificateurs';

/** Jauge gagnée par point de PV affiché infligé (§7.1). */
export const JAUGE_PAR_PV_INFLIGE = 10;
/** Jauge gagnée par point de PV affiché encaissé (§7.1). */
export const JAUGE_PAR_PV_SUBI = 5;

/** Vrai si l'attaquant peut viser cette cible depuis cette case. */
export function peutViser(
  etat: EtatPartie, cat: Catalogue, att: Unite, def: Unite, depuis: Case, aBouge: boolean,
): { ok: true } | { ok: false; motif: MotifRefus } {
  const ta = cat.unites[att.type];
  const td = cat.unites[def.type];
  if (!ta || !td) return { ok: false, motif: 'catalogue_inconnu' };
  if (att.camp === def.camp) return { ok: false, motif: 'cible_amie' };
  if (ta.munitions !== null && (att.munitions ?? 0) <= 0) return { ok: false, motif: 'sans_munitions' };
  if (degatsBase(cat, att.type, def.type) <= 0) return { ok: false, motif: 'ne_peut_pas_viser' };
  const d = manhattan(depuis, def);
  if (d < ta.portee[0] || d > ta.portee[1]) return { ok: false, motif: 'cible_hors_portee' };
  if (aBouge && !ta.peutTirerApresMouvement) return { ok: false, motif: 'a_bouge' };
  return { ok: true };
}

/** Dégâts d'une frappe, en PV internes. Consomme un tirage du flux `combat`. */
export function calculerDegats(
  etat: EtatPartie, cat: Catalogue, att: Unite, def: Unite, rng: Rng,
): number {
  const base = degatsBase(cat, att.type, def.type);
  if (base <= 0) return 0;
  const terrain = terrainSous(etat, cat, def);
  const etoiles = terrain ? (cat.terrains[terrain]?.defense ?? 0) : 0;
  const fTerrain = 1 - 0.05 * etoiles * (pvAffiches(def.pv) / 10);
  const mAtt = multiplicateur(etat, cat, att, 'attaque');
  const mDef = multiplicateur(etat, cat, def, 'defense');
  const alea = 0.95 + 0.10 * rng.branche('combat').suivant();
  let d = base * (pvAffiches(att.pv) / 10) * mAtt * fTerrain * (1 / mDef) * alea;
  d = surAttaqueHooks(etat, cat, att, def, d, rng);
  return Math.min(def.pv, Math.max(1, Math.round(d)));
}

/** Ajoute de la jauge à un camp, plafonnée au coût de son super pouvoir. */
export function crediterJauge(etat: EtatPartie, camp: number, points: number): void {
  const c = etat.camps.find((e) => e.id === camp);
  if (!c) return;
  c.jauge = Math.min(c.jaugeMax, c.jauge + points);
}

/** Retire une unité de la carte : mise hors jeu, jamais destruction. */
export function mettreHorsJeu(etat: EtatPartie, id: string, evts: EvenementJeu[]): void {
  const u = etat.unites.find((e) => e.id === id);
  if (!u) return;
  for (const passagerId of u.cargo) {
    const p = etat.unites.find((e) => e.id === passagerId);
    if (p) evts.push({ type: 'hors_jeu', uniteId: p.id, camp: p.camp, unite: p.type });
  }
  const partants = new Set([id, ...u.cargo]);
  etat.unites = etat.unites.filter((e) => !partants.has(e.id));
  evts.push({ type: 'hors_jeu', uniteId: u.id, camp: u.camp, unite: u.type });
}

/** Issue d'une attaque résolue. */
export interface IssueAttaque {
  degats: number;
  riposte: number;
  cibleHorsJeu: boolean;
  attaquantHorsJeu: boolean;
}

/**
 * Résout une attaque complète : frappe, munitions, jauge, riposte éventuelle.
 * Une unité `tir_indirect` ne riposte jamais et ne subit pas de riposte à distance.
 */
export function resoudreAttaque(
  etat: EtatPartie, cat: Catalogue, att: Unite, def: Unite, rng: Rng, evts: EvenementJeu[],
): IssueAttaque {
  const ta = cat.unites[att.type]!;
  const td = cat.unites[def.type]!;
  const avantCible = pvAffiches(def.pv);
  const degats = calculerDegats(etat, cat, att, def, rng);
  def.pv -= degats;
  if (ta.munitions !== null && att.munitions !== null) att.munitions = Math.max(0, att.munitions - 1);
  const retires = avantCible - pvAffiches(Math.max(0, def.pv));
  crediterJauge(etat, att.camp, JAUGE_PAR_PV_INFLIGE * retires);
  crediterJauge(etat, def.camp, JAUGE_PAR_PV_SUBI * retires);

  let riposte = 0;
  const cibleHorsJeu = def.pv <= 0;
  if (!cibleHorsJeu) {
    const peutRendre = td.peutRiposter
      && manhattan(att, def) === 1
      && (td.munitions === null || (def.munitions ?? 0) > 0)
      && degatsBase(cat, def.type, att.type) > 0;
    if (peutRendre) {
      const avantAtt = pvAffiches(att.pv);
      riposte = calculerDegats(etat, cat, def, att, rng);
      att.pv -= riposte;
      if (td.munitions !== null && def.munitions !== null) def.munitions = Math.max(0, def.munitions - 1);
      const rendus = avantAtt - pvAffiches(Math.max(0, att.pv));
      crediterJauge(etat, def.camp, JAUGE_PAR_PV_INFLIGE * rendus);
      crediterJauge(etat, att.camp, JAUGE_PAR_PV_SUBI * rendus);
    }
  }

  evts.push({
    type: 'attaque', attaquantId: att.id, cibleId: def.id, degats, riposte,
  });
  const attaquantHorsJeu = att.pv <= 0;
  if (cibleHorsJeu) mettreHorsJeu(etat, def.id, evts);
  if (attaquantHorsJeu) mettreHorsJeu(etat, att.id, evts);
  return { degats, riposte, cibleHorsJeu, attaquantHorsJeu };
}

/** Vrai si cette unité est une pièce indirecte (au sens du trait). */
export function estIndirecte(cat: Catalogue, u: Unite): boolean {
  const t = cat.unites[u.type];
  return t !== undefined && porte(t, 'tir_indirect');
}
