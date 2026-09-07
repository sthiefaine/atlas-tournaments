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

import type { Case, CleUnite, UnitType } from '../../schemas/index';
import { degatsBase } from '../catalogue';
import { surAttaqueHooks } from '../hooks';
import type {
  Catalogue, EtatPartie, EtatRng, EvenementJeu, InstantaneRng, MotifRefus, Rng, Unite,
} from '../types';
import { cleCase, manhattan, porte, pvAffiches } from '../types';
import { terrainSous } from './mouvement';
import { multiplicateur } from './modificateurs';

/** Jauge gagnée par point de PV affiché infligé (§7.1). */
export const JAUGE_PAR_PV_INFLIGE = 10;
/** Jauge gagnée par point de PV affiché encaissé (§7.1). */
export const JAUGE_PAR_PV_SUBI = 5;

/**
 * Vrai si `type` tire sur `cible` avec son arme secondaire (`04-gameplay.md`
 * §5.3) : sans consommer de munition, et même à zéro. C'est une donnée du
 * catalogue, jamais un nom d'unité : le moteur ne sait pas ce qu'est un char.
 */
export function tireSansMunitions(type: UnitType, cible: CleUnite): boolean {
  return type.armeSecondaire?.includes(cible) ?? false;
}

/**
 * Base de dégâts **effective** de `att` contre `cible`, munitions comprises
 * (§5.3) : `0` si elle ne peut pas tirer ; la base pleine si le tir est
 * illimité, s'il reste des munitions ou si la cible est listée à l'arme
 * secondaire ; sinon `degatsSecondaire` — la mitrailleuse contre un blindé,
 * pour peu — ou `0` s'il n'y en a pas. Seule source de la formule, de la
 * prévision et de l'IA : un chiffre calculé à deux endroits finit par mentir.
 */
export function degatsArme(cat: Catalogue, att: Unite, cible: CleUnite): number {
  const ta = cat.unites[att.type];
  if (!ta) return 0;
  const base = degatsBase(cat, att.type, cible);
  if (base <= 0) return 0;
  if (ta.munitions === null || (att.munitions ?? 0) > 0 || tireSansMunitions(ta, cible)) return base;
  return ta.degatsSecondaire ?? 0;
}

/** Vrai si l'attaquant peut viser cette cible depuis cette case. */
export function peutViser(
  etat: EtatPartie, cat: Catalogue, att: Unite, def: Unite, depuis: Case, aBouge: boolean,
): { ok: true } | { ok: false; motif: MotifRefus } {
  const ta = cat.unites[att.type];
  const td = cat.unites[def.type];
  if (!ta || !td) return { ok: false, motif: 'catalogue_inconnu' };
  if (att.camp === def.camp) return { ok: false, motif: 'cible_amie' };
  if (degatsBase(cat, att.type, def.type) <= 0) return { ok: false, motif: 'ne_peut_pas_viser' };
  if (degatsArme(cat, att, def.type) <= 0) return { ok: false, motif: 'sans_munitions' };
  const d = manhattan(depuis, def);
  if (d < ta.portee[0] || d > ta.portee[1]) return { ok: false, motif: 'cible_hors_portee' };
  if (aBouge && !ta.peutTirerApresMouvement) return { ok: false, motif: 'a_bouge' };
  return { ok: true };
}

/** Dégâts d'une frappe, en PV internes. Consomme un tirage du flux `combat`. */
export function calculerDegats(
  etat: EtatPartie, cat: Catalogue, att: Unite, def: Unite, rng: Rng,
): number {
  const base = degatsArme(cat, att, def.type);
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
export function mettreHorsJeu(etat: EtatPartie, cat: Catalogue, id: string, evts: EvenementJeu[]): void {
  const u = etat.unites.find((e) => e.id === id);
  if (!u) return;
  for (const passagerId of u.cargo) {
    const p = etat.unites.find((e) => e.id === passagerId);
    if (p) evts.push({ type: 'hors_jeu', uniteId: p.id, camp: p.camp, unite: p.type });
  }
  const partants = new Set([id, ...u.cargo]);
  etat.unites = etat.unites.filter((e) => !partants.has(e.id));
  evts.push({ type: 'hors_jeu', uniteId: u.id, camp: u.camp, unite: u.type });
  revelerProduction(etat, cat, u, evts);
}

/**
 * Un drone qui tombe au-dessus d'un bâtiment adverse a eu le temps de lire ce
 * qui en sort (`04-gameplay.md` §10 bis) : son camp apprend tout ce que le
 * propriétaire a produit depuis le début du match. Seule consolation d'un œil
 * perdu, et une raison de le risquer au-dessus d'une usine.
 */
function revelerProduction(etat: EtatPartie, cat: Catalogue, u: Unite, evts: EvenementJeu[]): void {
  const type = cat.unites[u.type];
  if (!type || !porte(type, 'drone')) return;
  const proprietaire = etat.proprietaires[cleCase(u)];
  if (proprietaire === undefined || proprietaire === u.camp) return;
  const produites: Record<CleUnite, number> = {};
  const prefixe = `${proprietaire}:`;
  for (const [k, n] of Object.entries(etat.produites)) {
    if (k.startsWith(prefixe) && n > 0) produites[k.slice(prefixe.length)] = n;
  }
  evts.push({ type: 'production_revelee', camp: u.camp, proprietaire, case: { x: u.x, y: u.y }, produites });
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
  // Le canon compte ; la mitrailleuse — cible listée, ou tir à sec — jamais.
  if (ta.munitions !== null && att.munitions !== null && att.munitions > 0 && !tireSansMunitions(ta, def.type)) {
    att.munitions -= 1;
  }
  const retires = avantCible - pvAffiches(Math.max(0, def.pv));
  crediterJauge(etat, att.camp, JAUGE_PAR_PV_INFLIGE * retires);
  crediterJauge(etat, def.camp, JAUGE_PAR_PV_SUBI * retires);

  let riposte = 0;
  const cibleHorsJeu = def.pv <= 0;
  if (!cibleHorsJeu) {
    const peutRendre = td.peutRiposter
      && manhattan(att, def) === 1
      && degatsArme(cat, def, att.type) > 0;
    if (peutRendre) {
      const avantAtt = pvAffiches(att.pv);
      riposte = calculerDegats(etat, cat, def, att, rng);
      att.pv -= riposte;
      if (td.munitions !== null && def.munitions !== null && def.munitions > 0 && !tireSansMunitions(td, att.type)) {
        def.munitions -= 1;
      }
      const rendus = avantAtt - pvAffiches(Math.max(0, att.pv));
      crediterJauge(etat, def.camp, JAUGE_PAR_PV_INFLIGE * rendus);
      crediterJauge(etat, att.camp, JAUGE_PAR_PV_SUBI * rendus);
    }
  }

  evts.push({
    type: 'attaque', attaquantId: att.id, cibleId: def.id, degats, riposte,
  });
  const attaquantHorsJeu = att.pv <= 0;
  if (cibleHorsJeu) mettreHorsJeu(etat, cat, def.id, evts);
  if (attaquantHorsJeu) mettreHorsJeu(etat, cat, att.id, evts);
  return { degats, riposte, cibleHorsJeu, attaquantHorsJeu };
}

/** Vrai si cette unité est une pièce indirecte (au sens du trait). */
export function estIndirecte(cat: Catalogue, u: Unite): boolean {
  const t = cat.unites[u.type];
  return t !== undefined && porte(t, 'tir_indirect');
}

// ---------------------------------------------------------------------------
// Prévision : ce que le joueur voit **avant** de confirmer une attaque
// ---------------------------------------------------------------------------

/**
 * Flux médian : la prévision rejoue la formule de dégâts **sans consommer
 * d'aléa**. Deux raisons, et la seconde est la vraie : un tirage avancerait le
 * flux `combat` et casserait le déterminisme du rejeu, et une prévision qui
 * bouge d'un survol à l'autre n'est pas une information mais un bruit. `0,5`
 * place `A` exactement au centre de sa fourchette (`0,95` à `1,05`), donc à
 * `1,00` : la prévision est la valeur nominale, à un demi-point près.
 */
const RNG_MEDIAN: Rng = {
  chemin: 'median',
  etat: [0, 0, 0, 0] as EtatRng,
  suivant(): number { return 0.5; },
  entier(borne: number): number { return Math.floor(borne / 2); },
  branche(): Rng { return RNG_MEDIAN; },
  instantane(): InstantaneRng { return {}; },
  restaurer(): void { /* rien : ce flux n'a pas d'état */ },
};

/** Ce que la barre de duel affiche : les deux côtés du même échange. */
export interface PrevisionDuel {
  /** PV internes retirés à la cible. */
  degats: number;
  /** PV affichés de la cible après la frappe. */
  pvCible: number;
  /** PV internes rendus par la riposte, `0` s'il n'y en a pas. */
  riposte: number;
  /** PV affichés de l'attaquant après la riposte. */
  pvAttaquant: number;
  /** Vrai si la cible sort du jeu. */
  cibleHorsJeu: boolean;
}

/**
 * Prévoit l'échange complet — frappe puis riposte — depuis la case d'**arrivée**
 * de l'attaquant, sans rien muter et sans tirer d'aléa.
 *
 * L'attaquant est cloné à sa case d'arrivée : le vent de `surAttaque` lit la
 * direction du tir, et prévoir depuis la case de départ mentirait sur un
 * déplacement qui change de cap.
 */
export function prevoirDuel(
  etat: EtatPartie, cat: Catalogue, att: Unite, def: Unite, depuis: Case,
): PrevisionDuel {
  const arrive: Unite = { ...att, x: depuis.x, y: depuis.y };
  const degats = Math.min(def.pv, calculerDegats(etat, cat, arrive, def, RNG_MEDIAN));
  const restant = def.pv - degats;
  const cibleHorsJeu = restant <= 0;

  let riposte = 0;
  const td = cat.unites[def.type];
  if (!cibleHorsJeu && td) {
    const peutRendre = td.peutRiposter
      && manhattan(depuis, def) === 1
      && degatsArme(cat, def, att.type) > 0;
    // La riposte se calcule sur les PV **d'après** la frappe : c'est ce qui rend
    // rentable le fait de frapper en premier, et le joueur doit le voir.
    if (peutRendre) riposte = calculerDegats(etat, cat, { ...def, pv: restant }, arrive, RNG_MEDIAN);
  }

  return {
    degats,
    pvCible: pvAffiches(Math.max(0, restant)),
    riposte,
    pvAttaquant: pvAffiches(Math.max(0, att.pv - riposte)),
    cibleHorsJeu,
  };
}
