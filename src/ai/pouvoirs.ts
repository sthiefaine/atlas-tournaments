/**
 * L'IA et ses pouvoirs (10 septembre 2026, revu le soir même).
 *
 * Le matin, la règle tenait en trois lignes — le super dès qu'il est payable,
 * le normal quand un duel bascule, quand un soin rend trois PV ou quand un
 * prix ouvre un achat — et elle ne savait valoriser qu'une famille : mesuré
 * sur `plaine.json`, Ariane (soin) battait Tomas, Noémie, Awa et Devika de
 * 95 à 100 %, quand ces kits entre eux se valaient. Ce module donne **une
 * valeur à chaque famille**, dans une seule monnaie, et déclenche sur un
 * seuil proportionnel aux barres.
 *
 * **La monnaie est le fonds** — celle de toute l'IA (`menace`, `echange`) :
 * un PV affiché vaut un dixième du coût de l'unité, un bâtiment vaut
 * `TOURS_VALEUR_BATIMENT` journées de son revenu, une mise hors jeu une prime.
 *
 * **Rien n'est recopié des règles.** La valeur d'un pouvoir se lit sur l'état
 * **d'après** : on l'applique sur une copie (`appliquerPouvoir` du moteur, sans
 * toucher à la jauge), puis on compare — PV, réserves, revenus, prix, vision,
 * et surtout ce que chaque unité **peut faire de mieux ce tour** (`gainUnite`),
 * rejoué par `prevoirDuel`, `portee`, `peutCapturerIci` du moteur, sur les
 * deux états. Une famille durable qui protège (`tour_complet`, journées) est
 * jugée aussi sur ce que l'adversaire pourra faire de mieux à son tour.
 *
 * Une pose de terrain demande des cases que l'IA ne sait pas choisir : un
 * pouvoir qui en porte une est laissé au joueur humain. Tout est déterministe.
 */

import type { Catalogue, Commandants, CommandantMoteur, EtatPartie, Unite } from '../engine/index';
import { produitesPar } from '../engine/catalogue';
import { brouillardActif, unitesLourdes } from '../engine/climat/index';
import { copierEtat } from '../engine/etat';
import { terrainBrut, terrainLogique } from '../engine/hooks';
import { peutCapturerIci, pointsGagnes, seuilCapture } from '../engine/regles/capture';
import { prevoirDuel } from '../engine/regles/combat';
import {
  consommationEffective, prixProduction, producteursDe, revenuParTour,
} from '../engine/regles/economie';
import { portee, uniteSur } from '../engine/regles/mouvement';
import {
  appliquerPouvoir, estModificateurDurable, estPoseTerrain, evaluerEffets, poserModificateur, verifierPouvoir,
} from '../engine/regles/pouvoirs';
import { visionUnite } from '../engine/regles/vision';
import { depuisCle, manhattan, porte, pvAffiches } from '../engine/types';
import type { Case, CampId, EffetPouvoir } from '../schemas/index';
import { adversairesConnus, capteur, valeur } from './evaluation';
import { aBesoin, manque, peutTirerSur, sourcesRavitaillement } from './logistique';

/**
 * Fonds qu'une barre de jauge doit rapporter pour qu'un pouvoir parte. Une
 * barre, c'est dix PV affichés infligés (§7.1), soit à peu près une infanterie
 * mise hors jeu : la dépenser pour moins que ce qu'elle a coûté est une
 * perte. Le seuil s'applique aux deux niveaux, proportionnellement aux barres.
 */
export const SEUIL_PAR_BARRE = 600;

/** Un bâtiment capturé vaut tant de journées de son revenu. */
export const TOURS_VALEUR_BATIMENT = 6;

/** Le QG vaut la partie : quatre fois un bâtiment, comme `Poids.qg`. */
export const FACTEUR_QG = 4;

/** Prime d'une mise hors jeu, en part du coût de la cible — celle de `meilleureOption`. */
export const PRIME_HORS_JEU = 0.25;

/** Part de la valeur d'une unité que vaut toute sa vision, sous brouillard. */
export const POIDS_VISION = 0.15;

/** Part de la valeur d'une unité que vaut toute sa mobilité, pour une journée. */
export const POIDS_MOBILITE = 0.3;

/**
 * Part de la valeur d'une unité que vaut son plein : un chargeur vide ne vaut
 * pas l'unité — ce qu'il rend de feu ce tour se lit déjà dans `tactique`.
 */
export const PART_RAVITAILLEMENT = 0.25;

/** Tours d'autonomie sous lesquels une unité aérienne adverse est en danger de panne. */
export const TOURS_PANNE = 2;

/** Part de la valeur d'une unité aérienne poussée sous `TOURS_PANNE` tours d'autonomie. */
export const PART_PANNE = 0.5;

/** Niveau de pouvoir qu'une stratégie déclenche, ou `null` pour garder sa jauge. */
export type DecisionPouvoir = 'normal' | 'super' | null;

/** Un pouvoir tel que le moteur le porte : nom, barres, effets, durée. */
export type PouvoirMoteur = CommandantMoteur['pouvoir'];

/** Ce que `valeurPouvoir` a besoin de savoir en plus du pouvoir. */
export interface ContextePouvoir {
  niveau: 'normal' | 'super';
}

/** La valeur d'un pouvoir, famille par famille, en fonds. */
export interface DetailPouvoir {
  /** `soin` : PV affichés rendus × coût/10. */
  soin: number;
  /** `degats_directs` : PV affichés retirés aux adversaires connus × coût/10. */
  degatsDirects: number;
  /** `ravitailler` : manque comblé, en fonds, des unités qui en avaient besoin. */
  ravitailler: number;
  /** `reactiver` : ce que chaque unité réactivée peut faire de mieux. */
  reactiver: number;
  /**
   * Modificateurs durables et météo rejoués sur les duels, captures et
   * ravitaillements : ce que mes unités prêtes gagnent, plus ce que
   * l'adversaire perd à son tour si la durée le couvre.
   */
  tactique: number;
  /** `vision`, en brouillard seulement : la part de vue gagnée ou ôtée. */
  vision: number;
  /** `fonds` sur les revenus à venir, `prix` sur l'achat prévu ce tour. */
  economie: number;
  /** `meteo` : la mobilité que la météo imposée ôte à chaque camp, signée. */
  meteo: number;
  /** `carburant` adverse : les appareils poussés au bord de la panne. */
  carburant: number;
  total: number;
}

const VIDE: DetailPouvoir = {
  soin: 0, degatsDirects: 0, ravitailler: 0, reactiver: 0, tactique: 0,
  vision: 0, economie: 0, meteo: 0, carburant: 0, total: 0,
};

/**
 * Vrai au **début** du tour de ce camp : aucune de ses unités n'a encore
 * joué. C'est là que le pouvoir normal se juge — après, les duels qu'il aurait
 * changés sont déjà joués.
 */
export function debutDeTour(etat: EtatPartie, camp: CampId): boolean {
  return !etat.unites.some((u) => u.camp === camp && (u.etat === 'agi' || u.etat === 'deplacee'));
}

/** Vrai quand plus aucune unité du camp n'est prête : la dernière occasion du tour. */
export function rienDePret(etat: EtatPartie, camp: CampId): boolean {
  return !etat.unites.some((u) => u.camp === camp && u.etat === 'prete' && u.dansTransport === null);
}

/** Vrai si ce pouvoir demande des cases que l'IA ne sait pas choisir. */
function demandeDesCases(pouvoir: PouvoirMoteur): boolean {
  return pouvoir.effets.some(estPoseTerrain);
}

/**
 * L'état d'après le pouvoir, sur une copie, **sans toucher à la jauge** : on
 * veut savoir ce que le pouvoir vaut, pas s'il est payable. La canicule est
 * la seule météo dont l'effet passe par un modificateur que le moteur pose au
 * début de la journée (hook `debutTour` du climat) : imposée en cours de tour,
 * on le pose de la même main, pour lire le même monde que lui.
 */
export function etatApresPouvoir(
  etat: EtatPartie, cat: Catalogue, camp: CampId, pouvoir: PouvoirMoteur, niveau: 'normal' | 'super',
): EtatPartie | null {
  const e = copierEtat(etat);
  const verdict = { ok: true as const, cout: 0, nom: pouvoir.nom, effets: pouvoir.effets, duree: pouvoir.duree };
  const r = appliquerPouvoir(e, cat, camp, niveau, verdict, [], []);
  if (!r.ok) return null;
  if (e.climat.meteo === 'canicule' && etat.climat.meteo !== 'canicule') {
    const lourdes = unitesLourdes(cat);
    if (lourdes.length > 0) {
      poserModificateur(e, camp, 'climat', {
        cible: 'toutes_unites', filtre: { types: lourdes }, modificateur: { quoi: 'mouvement', valeur: -1 },
      }, { type: 'tour_complet' });
    }
  }
  return e;
}

/** Cases où l'unité peut finir son déplacement : atteignables et libres, la sienne comprise. */
function arrivees(etat: EtatPartie, cat: Catalogue, u: Unite): Case[] {
  const p = portee(etat, cat, u);
  const largeur = etat.largeur;
  const sortie: Case[] = [];
  for (let i = 0; i < p.couts.length; i += 1) {
    if ((p.couts[i] ?? -1) < 0) continue;
    const x = i % largeur;
    const c = { x, y: (i - x) / largeur };
    if ((c.x === u.x && c.y === u.y) || !uniteSur(etat, c)) sortie.push(c);
  }
  return sortie;
}

/** Nombre de cases qu'une unité peut atteindre : sa mobilité, telle que le moteur la calcule. */
function mobilite(etat: EtatPartie, cat: Catalogue, u: Unite): number {
  const p = portee(etat, cat, u);
  let n = 0;
  for (let i = 0; i < p.couts.length; i += 1) if ((p.couts[i] ?? -1) >= 0) n += 1;
  return n;
}

/** Comment lire une unité dans `gainUnite`. */
export interface LectureGain {
  /** Ne compter que les unités prêtes ; faux pour un adversaire, qui jouera toutes les siennes. */
  prete: boolean;
  /**
   * Retrancher la riposte et la mort de l'attaquant ; faux pour la lecture
   * **défensive** d'un adversaire, où seul compte ce qu'il peut m'infliger —
   * une unité adverse entamée a moins à perdre en riposte, et compter ce
   * qu'elle risque ferait paraître un dégât direct comme un cadeau.
   */
  net: boolean;
}

const MIENNE: LectureGain = { prete: true, net: true };
const ADVERSE: LectureGain = { prete: false, net: false };

/**
 * Ce qu'une unité peut faire de mieux ce tour, en fonds : le meilleur duel
 * (dégâts rendus, riposte et prime de mise hors jeu), la meilleure capture
 * (part du seuil gagnée × valeur du bâtiment), ou le ravitaillement qu'elle
 * atteint si elle en a besoin. Tout vient du moteur : `portee`, `prevoirDuel`,
 * `peutCapturerIci`, `pointsGagnes` — un pouvoir qui touche l'une de ces
 * règles se lit ici sans que ce module le connaisse.
 */
export function gainUnite(etat: EtatPartie, cat: Catalogue, u: Unite, lecture: LectureGain = MIENNE): number {
  if (u.dansTransport !== null) return 0;
  if (lecture.prete && u.etat !== 'prete') return 0;
  const type = cat.unites[u.type];
  if (!type) return 0;
  const cases = arrivees(etat, cat, u);
  let meilleur = 0;

  const indirect = !type.peutTirerApresMouvement;
  const [pMin, pMax] = type.portee;
  for (const def of adversairesConnus(etat, cat, u.camp)) {
    if (!peutTirerSur(cat, u, def.type)) continue;
    let depuis: Case | null = null;
    if (indirect) {
      const d = manhattan(u, def);
      if (d >= pMin && d <= pMax) depuis = { x: u.x, y: u.y };
    } else {
      for (const c of cases) {
        const d = manhattan(c, def);
        if (d >= pMin && d <= pMax) { depuis = c; break; }
      }
    }
    if (!depuis) continue;
    const prev = prevoirDuel(etat, cat, u, def, depuis);
    const coutDef = cat.unites[def.type]?.cout ?? 0;
    const gain = ((pvAffiches(def.pv) - prev.pvCible) * coutDef) / 10;
    const perte = lecture.net
      ? ((pvAffiches(u.pv) - prev.pvAttaquant) * type.cout) / 10 + (prev.pvAttaquant <= 0 ? PRIME_HORS_JEU * type.cout : 0)
      : 0;
    const net = gain - perte + (prev.cibleHorsJeu ? PRIME_HORS_JEU * coutDef : 0);
    if (net > meilleur) meilleur = net;
  }

  if (capteur(cat, u) || porte(type, 'genie')) {
    const revenu = etat.reglages.revenusParBatimentParCamp?.[u.camp] ?? etat.reglages.revenusParBatiment;
    for (const c of cases) {
      const fictive: Unite = { ...u, x: c.x, y: c.y };
      if (!peutCapturerIci(etat, cat, fictive)) continue;
      const surPlace = c.x === u.x && c.y === u.y;
      const points = pointsGagnes(etat, cat, fictive) + (surPlace ? u.pointsCapture : 0);
      const part = Math.min(1, points / seuilCapture(etat, cat, fictive));
      const facteur = terrainBrut(etat, cat, c) === 'qg' ? FACTEUR_QG : 1;
      const v = part * revenu * TOURS_VALEUR_BATIMENT * facteur;
      if (v > meilleur) meilleur = v;
    }
  }

  if (aBesoin(etat, cat, u)) {
    const sources = sourcesRavitaillement(etat, cat, u);
    if (cases.some((c) => sources.some((s) => s.x === c.x && s.y === c.y))) {
      // À la même échelle que le `ravitailler` instantané : un plein reçu d'un
      // pouvoir et un plein qu'on va chercher valent pareil, l'un ôte l'autre.
      const v = manque(cat, u) * (pvAffiches(u.pv) / 10) * PART_RAVITAILLEMENT;
      if (v > meilleur) meilleur = v;
    }
  }
  return meilleur;
}

/** Somme de ce que les unités prêtes du camp peuvent faire de mieux, sauf celles qu'on exclut. */
function gainsDuCamp(etat: EtatPartie, cat: Catalogue, camp: CampId, sauf: Set<string>): number {
  let total = 0;
  for (const u of etat.unites) {
    if (u.camp !== camp || sauf.has(u.id)) continue;
    total += gainUnite(etat, cat, u);
  }
  return total;
}

/** Somme de ce que les adversaires connus pourront faire de mieux à leur tour. */
function gainsAdverses(etat: EtatPartie, cat: Catalogue, camp: CampId): number {
  let total = 0;
  for (const a of adversairesConnus(etat, cat, camp)) total += gainUnite(etat, cat, a, ADVERSE);
  return total;
}

/**
 * Ce que l'adversaire trouvera du pouvoir à son tour : ses modificateurs qui
 * survivent à la fermeture (`tour_complet`, journées), ses dégâts directs et
 * sa météo. Pas ce qui ne change que mes unités — soin, ravitaillement,
 * réactivation —, qui se lit de mon côté : compté ici, un soin ferait
 * **monter** ce que l'adversaire peut me prendre, puisqu'une unité remontée a
 * plus de PV à perdre, et le pouvoir se jugerait pire d'avoir soigné.
 */
function pouvoirPourTourAdverse(pouvoir: PouvoirMoteur): PouvoirMoteur {
  const effets = pouvoir.effets.filter((e) => {
    if ('meteo' in e) return true;
    if (!('modificateur' in e)) return false;
    if (e.modificateur.quoi === 'degats_directs') return true;
    return estModificateurDurable(e) && pouvoir.duree !== 'ce_tour';
  });
  return { ...pouvoir, effets };
}

/** Journées de revenus qu'une durée couvre : `ouvrirTour` expire avant de verser, seules les journées comptent. */
function journeesDeRevenus(duree: PouvoirMoteur['duree']): number {
  return typeof duree === 'object' ? duree.n : 0;
}

/**
 * Ce que le camp économise sur l'achat prévu ce tour : sur chaque producteur,
 * l'unité la plus chère que la caisse paie au prix du moteur, et la différence
 * entre son coût de catalogue et ce prix. Nul sans `prix`. Un producteur
 * occupé compte : au début du tour, la recrue de la veille est encore dessus,
 * et l'achat se fait en fin de tour, une fois qu'elle a bougé.
 */
export function economiesAchat(etat: EtatPartie, cat: Catalogue, camp: CampId): number {
  const caisse = etat.camps.find((c) => c.id === camp);
  if (!caisse) return 0;
  let fonds = caisse.fonds;
  let total = 0;
  for (const k of producteursDe(etat, cat, camp)) {
    const c = depuisCle(k);
    const terrain = terrainLogique(etat, cat, c);
    if (terrain === null) continue;
    let meilleur: { cout: number; prix: number } | null = null;
    for (const cle of produitesPar(cat, terrain, etat, camp)) {
      const t = cat.unites[cle];
      if (!t) continue;
      const prix = prixProduction(etat, cat, camp, cle);
      if (prix > fonds) continue;
      if (!meilleur || t.cout > meilleur.cout) meilleur = { cout: t.cout, prix };
    }
    if (!meilleur) continue;
    total += meilleur.cout - meilleur.prix;
    fonds -= meilleur.prix;
  }
  return total;
}

/** Vrai si un effet touche le carburant d'unités qui ne sont pas les miennes. */
function brideLeCarburantAdverse(e: EffetPouvoir): boolean {
  return 'modificateur' in e && e.modificateur.quoi === 'carburant' && e.cible !== 'mes_unites';
}

/**
 * La valeur d'un pouvoir, famille par famille (`DetailPouvoir`). Chaque terme
 * est une **différence** entre l'état d'avant et l'état d'après : une famille
 * qui ne change rien — une météo déjà là, une réactivation sans unité qui a
 * joué, un prix sans achat possible — vaut exactement zéro.
 */
export function detailPouvoir(
  etat: EtatPartie, cat: Catalogue, camp: CampId, pouvoir: PouvoirMoteur, contexte: ContextePouvoir,
): DetailPouvoir {
  if (demandeDesCases(pouvoir)) return VIDE;
  const apres = etatApresPouvoir(etat, cat, camp, pouvoir, contexte.niveau);
  if (!apres) return VIDE;
  const bilan = evaluerEffets(etat, cat, camp, pouvoir.effets);
  const avantParId = new Map(etat.unites.map((u) => [u.id, u]));
  const connus = adversairesConnus(etat, cat, camp);
  const connusIds = new Set(connus.map((a) => a.id));
  const d: DetailPouvoir = { ...VIDE };

  // Les instantanés se lisent sur les unités, relues par identifiant.
  for (const a of apres.unites) {
    const v = avantParId.get(a.id);
    if (!v) continue;
    const cout = cat.unites[a.type]?.cout ?? 0;
    const delta = pvAffiches(a.pv) - pvAffiches(v.pv);
    if (a.camp === camp) {
      if (delta > 0) d.soin += (delta * cout) / 10;
      if (aBesoin(etat, cat, v)) {
        // Le manque est en fonds de coût plein : on le ramène à la valeur de l'unité.
        const comble = Math.max(0, manque(cat, v) - manque(cat, a)) * (pvAffiches(v.pv) / 10);
        d.ravitailler += comble * PART_RAVITAILLEMENT;
      }
    } else if (connusIds.has(a.id) && delta < 0) {
      d.degatsDirects += (-delta * cout) / 10;
    }
  }

  // Réactivées : ce qu'elles peuvent faire de mieux, maintenant qu'elles rejouent.
  const reactivees = new Set(bilan.reactivees);
  for (const id of reactivees) {
    const a = apres.unites.find((x) => x.id === id);
    if (a) d.reactiver += gainUnite(apres, cat, a);
  }

  // Le tour rejoué sur les deux états, mes unités prêtes d'abord ; puis le
  // tour adverse, sur ce que le pouvoir lui laissera.
  d.tactique += gainsDuCamp(apres, cat, camp, reactivees) - gainsDuCamp(etat, cat, camp, reactivees);
  const adverse = pouvoirPourTourAdverse(pouvoir);
  if (adverse.effets.length > 0) {
    const apresAdverse = etatApresPouvoir(etat, cat, camp, adverse, contexte.niveau);
    if (apresAdverse) d.tactique += gainsAdverses(etat, cat, camp) - gainsAdverses(apresAdverse, cat, camp);
  }

  // La vision ne vaut que là où quelque chose est caché. Ce que l'adversaire y
  // gagne ou y perd compte si le pouvoir couvre son tour — une météo le couvre
  // toujours, elle s'impose aux deux camps pour la journée.
  if (brouillardActif(etat) || brouillardActif(apres)) {
    const couvre = pouvoir.duree !== 'ce_tour' || bilan.meteo !== null;
    for (const a of apres.unites) {
      const v = avantParId.get(a.id);
      if (!v || v.dansTransport !== null) continue;
      const avant = visionUnite(etat, cat, v);
      const delta = visionUnite(apres, cat, a) - avant;
      if (delta === 0) continue;
      if (a.camp === camp) d.vision += (delta / Math.max(1, avant)) * POIDS_VISION * valeur(cat, v);
      else if (couvre && connusIds.has(a.id)) d.vision -= (delta / Math.max(1, avant)) * POIDS_VISION * valeur(cat, v);
    }
  }

  // Économie : les revenus que la durée couvre, et l'achat de ce tour.
  d.economie += journeesDeRevenus(pouvoir.duree) * (revenuParTour(apres, camp) - revenuParTour(etat, camp));
  d.economie += economiesAchat(apres, cat, camp) - economiesAchat(etat, cat, camp);

  // Météo imposée : la mobilité qu'elle ôte à chaque camp, autant de journées qu'elle dure.
  if (bilan.meteo !== null && bilan.meteo !== etat.climat.meteo) {
    const effet = pouvoir.effets.find((e) => 'meteo' in e);
    const journees = effet && 'meteo' in effet ? effet.meteo.journees : 1;
    for (const a of apres.unites) {
      const v = avantParId.get(a.id);
      if (!v || v.dansTransport !== null) continue;
      if (a.camp !== camp && !connusIds.has(a.id)) continue;
      const avant = mobilite(etat, cat, v);
      if (avant <= 0) continue;
      const perte = (1 - mobilite(apres, cat, a) / avant) * POIDS_MOBILITE * valeur(cat, v) * journees;
      d.meteo += a.camp === camp ? -perte : perte;
    }
  }

  // Carburant adverse : les appareils poussés au bord de la panne sèche.
  if (pouvoir.effets.some(brideLeCarburantAdverse)) {
    for (const a of connus) {
      const t = cat.unites[a.type];
      const ap = apres.unites.find((x) => x.id === a.id);
      if (!t || !ap || t.domaine !== 'air' || a.carburant === null || ap.carburant === null) continue;
      const toursAvant = a.carburant / Math.max(1, consommationEffective(etat, cat, a));
      const toursApres = ap.carburant / Math.max(1, consommationEffective(apres, cat, ap));
      if (toursApres < TOURS_PANNE && toursAvant >= TOURS_PANNE) d.carburant += PART_PANNE * valeur(cat, a);
    }
  }

  d.total = d.soin + d.degatsDirects + d.ravitailler + d.reactiver + d.tactique
    + d.vision + d.economie + d.meteo + d.carburant;
  return d;
}

/** La valeur totale d'un pouvoir, en fonds : `detailPouvoir(...).total`. */
export function valeurPouvoir(
  etat: EtatPartie, cat: Catalogue, camp: CampId, pouvoir: PouvoirMoteur, contexte: ContextePouvoir,
): number {
  return detailPouvoir(etat, cat, camp, pouvoir, contexte).total;
}

/**
 * Décide du pouvoir à jouer maintenant pour ce camp. `null` quand le camp n'a
 * pas de commandant, a déjà joué son pouvoir ce tour, ou ferait mieux de
 * garder sa jauge.
 *
 * Le **super** se juge à tout moment du tour, dès qu'il est payable — et
 * payable veut dire jauge pleine, puisqu'elle plafonne à son coût. Il part
 * quand sa valeur dépasse `SEUIL_PAR_BARRE × barres` ; sinon, la jauge ne
 * pouvant plus monter, il part **au début du tour** s'il vaut quelque chose,
 * ou **à la dernière occasion** — plus rien de prêt — quand sa valeur ne vient
 * qu'en fin de tour, comme une réactivation. Un super qui ne change rien est
 * gardé : le jouer pour rien, c'est le perdre. Le **normal** se juge au début
 * du tour seulement, sur le même seuil ; en deçà, la jauge attend le super.
 */
export function decisionPouvoir(
  etat: EtatPartie, cat: Catalogue, camp: CampId, commandants: Commandants,
): DecisionPouvoir {
  const commandant = commandants[camp] ?? null;
  if (!commandant) return null;
  if (verifierPouvoir(etat, commandant, camp, 'super').ok && !demandeDesCases(commandant.superPouvoir)) {
    const p = commandant.superPouvoir;
    const v = valeurPouvoir(etat, cat, camp, p, { niveau: 'super' });
    if (v >= SEUIL_PAR_BARRE * p.barres) return 'super';
    if (v > 0 && (debutDeTour(etat, camp) || rienDePret(etat, camp))) return 'super';
    return null;
  }
  if (!debutDeTour(etat, camp)) return null;
  if (!verifierPouvoir(etat, commandant, camp, 'normal').ok || demandeDesCases(commandant.pouvoir)) return null;
  const p = commandant.pouvoir;
  return valeurPouvoir(etat, cat, camp, p, { niveau: 'normal' }) >= SEUIL_PAR_BARRE * p.barres ? 'normal' : null;
}
