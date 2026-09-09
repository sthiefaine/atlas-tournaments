import { sontAllies } from '../equipes';
/**
 * Combat : la formule de dégâts, la riposte, les munitions et la jauge
 * (`doc/04-gameplay.md` §5 et §7.1).
 *
 * ```
 * Fterrain = 1 − 0,10 × E
 * A        = 0,95 + 0,10 × r        r tiré dans rng.branche('combat')
 * D        = ECHELLE_DEGATS × base × (pvAtt / 10) × Matt × Fterrain × (1 / Mdef) × A
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

/**
 * Échelle des dégâts (§5.1, 8 septembre 2026). La matrice de `content/degats.json`
 * dit **qui bat qui** ; ce facteur dit à **quelle vitesse**. Les deux questions
 * sont séparées exprès : rééchelonner les 576 valeurs de dégâts du canon — la
 * matrice 10 × 10 et les colonnes que portent les homologuées — décalerait
 * toutes les lectures relatives du §8, alors qu'un seul nombre déplace le rythme
 * sans toucher à un seul rapport de force.
 *
 * À `0,65`, une infanterie pleine en retire trois à une infanterie pleine sur
 * route au lieu de cinq : un échange n'est plus une demi-unité perdue, et le
 * terrain a la place de peser.
 *
 * Pourquoi 0,65 et pas 0,60, qui se lit pareil (7 PV restants sur route, 8 en
 * forêt) : la falaise est à la base **15**, la bande de grignotage contre un
 * blindé lourd. `arrondi(0,65 × 15)` vaut 10 points internes, donc 1 PV
 * affiché ; `arrondi(0,60 × 15)` vaut 9, donc **rien**. À 0,60, huit des quinze
 * unités qui ont le droit de tirer sur un char lourd ne lui ôtaient aucun PV :
 * une attaque légale qui ne fait rien est une règle incompréhensible. À 0,65,
 * tous les contres du §13.3 tiennent en trois coups au lieu de quatre.
 */
export const ECHELLE_DEGATS = 0.65;

/**
 * Réduction de dégâts par étoile de défense du terrain (§5.1, 8 septembre 2026).
 *
 * Deux changements en un. La valeur double — `0,05` protégeait deux fois moins
 * que le jeu de référence, et sur une forêt la différence avec la route ne se
 * lisait pas d'un PV affiché. Et le terme **ne dépend plus des PV de la cible** :
 * l'ancienne forme `0,05 × E × (pvCible/10)` ramenait la forêt d'une infanterie
 * à 3 PV à 3 % de protection, si bien que l'abri disparaissait au moment précis
 * où il servait. « La forêt enlève 20 % » est une règle qu'un joueur peut
 * énoncer ; une courbe ne l'est pas.
 *
 * Ce qui se perd : une unité entamée sur une montagne est plus dure à achever
 * qu'avant. C'est le prix assumé d'un abri qui vaut aussi pour un blessé.
 */
export const REDUCTION_PAR_ETOILE = 0.10;

/**
 * Facteur de terrain d'une cible posée sur `etoiles` étoiles de défense.
 * Exportée pour que personne n'ait à recopier la formule : une seconde copie
 * finit par mentir (leçon du 7 septembre sur les quatre listes recopiées).
 */
export function facteurTerrain(etoiles: number): number {
  return 1 - REDUCTION_PAR_ETOILE * etoiles;
}

/**
 * Ce que la riposte garde de sa force (§5.1, 8 septembre 2026).
 *
 * Frapper en premier ne payait que sur terrain égal. Le propriétaire l'a
 * rapporté sur le cas exact qui le montre : deux infanteries à 8 PV, la sienne
 * sur route, l'autre en ville — son coup retirait 20 points internes, la
 * riposte lui en rendait **21**. Les trois étoiles de la ville retiraient 30 %
 * à son coup, quand la cible, tombée à 6 PV, ne perdait que 25 % de sa force en
 * ripostant : l'abri effaçait l'avantage de l'initiative, et un peu plus.
 *
 * Ce n'était pas une faute de calcul — c'est la règle d'Advance Wars, où
 * attaquer une ville depuis la route est un mauvais échange. Mais c'est un
 * mauvais échange **illisible** : les deux camps affichaient « 8 → 6 », et le
 * joueur croyait faire jeu égal alors qu'il perdait.
 *
 * À `0,80`, l'initiative repasse devant l'abri : dans cette scène, l'attaquant
 * sort à 7 et la cible à 6, ce qui était la demande. Sur terrain égal, où
 * attaquer payait déjà, l'écart se creuse au lieu de s'inverser — route contre
 * route à 10 PV, la cible tombe à 7 et l'attaquant garde 8.
 *
 * **Pourquoi 0,80 et pas 0,70**, qui donne le même 7 contre 6 à l'écran : parce
 * que le facteur ne se lit pas seulement dans un duel, il change tout le jeu.
 * Mesuré sur vingt parties de `plaine.json`, graine 1, catalogue 6, pondérée
 * contre agressive : sans facteur 60/40, à 0,80 **50/50**, à 0,70 **15/85** —
 * une riposte trop faible récompense tant l'attaque que la stratégie agressive
 * écrase la prudente, et le jeu n'a plus qu'un plan. À 0,80 les deux écoles se
 * valent, aucune partie ne finit au chronomètre, et les matchs s'allongent de
 * trois journées médianes (34 → 37) : les unités survivent un échange de plus.
 *
 * Le facteur ne s'applique qu'à la **riposte**, jamais au coup : c'est
 * l'initiative qu'il récompense, pas la puissance.
 */
export const FACTEUR_RIPOSTE = 0.80;

/**
 * Les dégâts d'une riposte : la formule du coup, atténuée. Une seule fonction
 * pour les deux appelants du moteur — la résolution et la prévision —, sans
 * quoi l'écran promettrait un chiffre et le tour en jouerait un autre.
 */
export function degatsRiposte(
  etat: EtatPartie, cat: Catalogue, def: Unite, att: Unite, rng: Rng,
): number {
  const plein = calculerDegats(etat, cat, def, att, rng);
  if (plein <= 0) return 0;
  // Le plancher d'un point interne vaut pour la riposte comme pour le coup :
  // une riposte légale qui ne retire rien serait une règle incompréhensible.
  return Math.min(att.pv, Math.max(1, Math.round(plein * FACTEUR_RIPOSTE)));
}

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
  if (sontAllies(etat, att.camp, def.camp)) return { ok: false, motif: 'cible_amie' };
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
  const fTerrain = facteurTerrain(etoiles);
  const mAtt = multiplicateur(etat, cat, att, 'attaque');
  const mDef = multiplicateur(etat, cat, def, 'defense');
  const alea = 0.95 + 0.10 * rng.branche('combat').suivant();
  // L'échelle s'applique **avant** les hooks : un hook de climat ou de mécanique
  // est un rapport (× 0,8 sous la tempête), il doit mordre sur les dégâts réels.
  let d = ECHELLE_DEGATS * base * (pvAffiches(att.pv) / 10) * mAtt * fTerrain * (1 / mDef) * alea;
  d = surAttaqueHooks(etat, cat, att, def, d, rng);
  return Math.min(def.pv, Math.max(1, Math.round(d)));
}

/** Ajoute de la jauge à un camp, plafonnée au coût de son super pouvoir. */
export function crediterJauge(etat: EtatPartie, camp: number, points: number): void {
  const c = etat.camps.find((e) => e.id === camp);
  if (!c) return;
  c.jauge = Math.min(c.jaugeMax, c.jauge + Math.round(points * (camp === 0 ? etat.reglages.vitesseJaugeJoueur ?? 1 : 1)));
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
  if (proprietaire === undefined || sontAllies(etat, proprietaire, u.camp)) return;
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
    const peutRendre = td.peutRiposter && def.iemJusquaJournee === undefined
      && manhattan(att, def) === 1
      && degatsArme(cat, def, att.type) > 0;
    if (peutRendre) {
      const avantAtt = pvAffiches(att.pv);
      riposte = degatsRiposte(etat, cat, def, att, rng);
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
    const peutRendre = td.peutRiposter && def.iemJusquaJournee === undefined
      && manhattan(depuis, def) === 1
      && degatsArme(cat, def, att.type) > 0;
    // La riposte se calcule sur les PV **d'après** la frappe, et atténuée par
    // FACTEUR_RIPOSTE : c'est ce qui rend rentable le fait de frapper en
    // premier, et le joueur doit le voir avant de confirmer.
    if (peutRendre) riposte = degatsRiposte(etat, cat, { ...def, pv: restant }, arrive, RNG_MEDIAN);
  }

  return {
    degats,
    pvCible: pvAffiches(Math.max(0, restant)),
    riposte,
    pvAttaquant: pvAffiches(Math.max(0, att.pv - riposte)),
    cibleHorsJeu,
  };
}
