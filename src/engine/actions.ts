import { sontAllies } from './equipes';
/**
 * `appliquer(etat, action)` — le contrat du moteur (`doc/02-architecture.md` §3.1).
 *
 * - **Pure** : l'état d'entrée n'est jamais modifié, une copie est renvoyée.
 * - **Totale** : une action illégale ne lève pas, elle rend `{ ok: false, motif }`.
 * - **Déterministe** : tout aléa vient des flux seedés portés par l'état.
 *
 * Un ordre est atomique : déplacement et suite forment une seule action, donc une
 * seule entrée de rejeu et un seul point de tirage.
 */

import type { Case } from '../schemas/index';
import { chargerCatalogue } from './catalogue';
import { copierEtat, JOURNAL_MAX, marquerVisite } from './etat';
import { dansCarte, surMouvementHooks, terrainLogique } from './hooks';
import { avancerCapture, peutCapturerIci } from './regles/capture';
import { peutViser, resoudreAttaque } from './regles/combat';
import { COUT_CONSTRUCTION, terrainConstruction } from './regles/genie';
import { produire, verifierProduction } from './regles/economie';
import {
  coutEntree, uniteParId, uniteSur, verifierChemin, voisines,
} from './regles/mouvement';
import { appliquerPouvoir, verifierPouvoir } from './regles/pouvoirs';
import { fermerTour, ouvrirTour } from './regles/tour';
import { evaluerFin } from './regles/victoire';
import { casesVisibles, unitesVues } from './regles/vision';
import { brouillardActif } from './climat/index';
import { restaurerRng } from './rng';
import type {
  Action, Catalogue, CommandantMoteur, EtatPartie, EvenementJeu, MotifRefus,
  Debarquement, Resultat, Suite, Unite,
} from './types';
import { cleCase, manhattan, porte, pvAffiches } from './types';

const cataloguesMemo = new Map<number, Catalogue>();

/** Catalogue canon, chargé une seule fois : le moteur n'a pas d'autre source. */
export function catalogueParDefaut(version = 2): Catalogue {
  let cat = cataloguesMemo.get(version);
  if (!cat) { cat = chargerCatalogue(version); cataloguesMemo.set(version, cat); }
  return cat;
}

/** Commandants d'une partie, fournis par l'appelant pour les pouvoirs. */
export type Commandants = (CommandantMoteur | null)[];

function refus(motif: MotifRefus, detail?: string): Resultat {
  return detail === undefined ? { ok: false, motif } : { ok: false, motif, detail };
}

/**
 * Applique une action et rend un nouvel état.
 * `commandants` n'est utile qu'aux actions `pouvoir`.
 */
export function appliquer(
  etat: EtatPartie, action: Action,
  cat: Catalogue = catalogueParDefaut(etat.catalogueVersion), commandants: Commandants = [],
): Resultat {
  if (etat.partie.terminee) return refus('partie_terminee');
  const e = copierEtat(etat);
  const rng = restaurerRng(e.graine, e.flux);
  const evts: EvenementJeu[] = [];

  let verdict: { ok: true } | { ok: false; motif: MotifRefus; detail?: string };
  if (action.type === 'ordre') verdict = executerOrdre(e, cat, action, rng, evts);
  else if (action.type === 'produire') verdict = executerProduction(e, cat, action, evts);
  else if (action.type === 'pouvoir') verdict = executerPouvoir(e, cat, action, commandants, evts);
  else if (action.type === 'finTour') verdict = executerFinTour(e, cat, rng, evts);
  else verdict = refus('action_inconnue') as { ok: false; motif: MotifRefus };

  if (!verdict.ok) {
    return verdict.detail === undefined
      ? { ok: false, motif: verdict.motif }
      : { ok: false, motif: verdict.motif, detail: verdict.detail };
  }
  if (action.type !== 'finTour') evaluerFin(e, cat, evts);
  e.flux = rng.instantane();
  e.journal.push(...evts);
  // Le journal est une fenêtre, pas une archive : une partie longue ne doit pas
  // faire grossir l'état sans fin (la sauvegarde, elle, garde toutes les actions).
  if (e.journal.length > JOURNAL_MAX) e.journal = e.journal.slice(-JOURNAL_MAX);
  return { ok: true, etat: e, evenements: evts };
}

// ---------------------------------------------------------------------------
// Ordres
// ---------------------------------------------------------------------------

type Verdict = { ok: true } | { ok: false; motif: MotifRefus; detail?: string };

function executerOrdre(
  e: EtatPartie, cat: Catalogue,
  action: Extract<Action, { type: 'ordre' }>,
  rng: ReturnType<typeof restaurerRng>, evts: EvenementJeu[],
): Verdict {
  const u = uniteParId(e, action.uniteId);
  if (!u) return refus('unite_inconnue') as Verdict;
  if (u.camp !== e.campCourant) return refus('pas_mon_unite') as Verdict;
  // Une unité `deplacee` (ordre en deux temps) ne donne plus que sa suite, sur
  // place : un chemin ou un nouveau `puis` seraient un second déplacement.
  const dejaDeplacee = u.etat === 'deplacee';
  if (u.etat !== 'prete' && !dejaDeplacee) return refus('unite_deja_agi') as Verdict;
  if (u.dansTransport !== null) return refus('unite_deja_agi', 'unité embarquée') as Verdict;
  if (dejaDeplacee) {
    const surPlace = action.chemin.length <= 1
      && (action.chemin[0] === undefined || (action.chemin[0].x === u.x && action.chemin[0].y === u.y));
    if (!surPlace) return refus('deja_deplacee', 'une unité déjà déplacée donne sa suite sans bouger') as Verdict;
    if (action.suite.type === 'puis') return refus('deja_deplacee', 'un seul déplacement par tour') as Verdict;
  }
  const type = cat.unites[u.type];
  if (!type) return refus('catalogue_inconnu') as Verdict;

  let chemin = action.chemin.length > 0 ? action.chemin : [{ x: u.x, y: u.y }];
  const hook = surMouvementHooks(e, cat, u, chemin);
  if (!hook.ok) return refus('chemin_invalide', hook.motif) as Verdict;
  if ('cheminTronque' in hook) chemin = hook.cheminTronque;

  const verif = verifierChemin(e, cat, u, chemin);
  if (!verif.ok) {
    return verif.detail === undefined
      ? refus(verif.motif) as Verdict
      : refus(verif.motif, verif.detail) as Verdict;
  }

  // Interruption sous brouillard : une unité adverse révélée sur le trajet arrête net.
  let arrivee = verif.arrivee;
  let interrompu = false;
  if (brouillardActif(e) && chemin.length > 1) {
    const vues = new Set(unitesVues(e, cat, u.camp).filter((a) => !sontAllies(e, a.camp, u.camp)).map((a) => a.id));
    for (let i = 1; i < chemin.length; i += 1) {
      const c = chemin[i]!;
      // Une unité cachée n'arrête la marche que si elle **barre la route** —
       // exactement sur la case où l'on va. Jusqu'au 8 septembre 2026, elle
       // l'arrêtait aussi depuis une case **voisine** (`manhattan <= 1`) : on
       // allait tout droit, une silhouette passait à droite sans qu'on la
       // touche, et le tour s'achevait là. C'est une embuscade quand on se
       // cogne dedans, pas quand on passe devant.
      const surprise = e.unites.find(
        (a) => !sontAllies(e, a.camp, u.camp) && !a.dansTransport && !vues.has(a.id) && a.x === c.x && a.y === c.y,
      );
      if (surprise) {
        // On s'arrête sur la **dernière case libre** du trajet parcouru : ni sur
        // la surprise elle-même (elle peut occuper la case), ni sur un allié
        // traversé — en reculant jusqu'au départ s'il le faut. Avant le
        // 7 septembre 2026, l'arrêt tombait sur la case et l'ordre était
        // refusé `case_occupee`, ce qui trahissait la présence cachée.
        let j = i;
        while (j > 0) {
          const occupant = uniteSur(e, chemin[j]!);
          if (occupant === undefined || occupant.id === u.id) break;
          j -= 1;
        }
        arrivee = chemin[j]!;
        interrompu = true;
        break;
      }
    }
  }

  const depart = { x: u.x, y: u.y };
  // Déjà déplacée : elle a bougé ce tour, et les règles « après mouvement »
  // (tir indirect, tir après déplacement) la traitent comme telle.
  const aBouge = dejaDeplacee || arrivee.x !== u.x || arrivee.y !== u.y;
  if (aBouge) {
    if (!uniteSur(e, arrivee) || uniteSur(e, arrivee)?.id === u.id) {
      let cout = 0;
      const jusqua = chemin.findIndex((c) => c.x === arrivee.x && c.y === arrivee.y);
      for (let i = 1; i <= (jusqua < 0 ? chemin.length - 1 : jusqua); i += 1) {
        cout += coutEntree(e, cat, u, chemin[i]!) ?? 0;
      }
      u.x = arrivee.x;
      u.y = arrivee.y;
      u.pointsCapture = 0;
      if (type.carburant !== null && u.carburant !== null) {
        u.carburant = Math.max(0, u.carburant - cout * type.carburant.parCase);
      }
      const camp = e.camps.find((c) => c.id === u.camp);
      if (camp) marquerVisite(camp, arrivee.y * e.largeur + arrivee.x);
    } else {
      return refus('case_occupee') as Verdict;
    }
  }
  // Le chemin transmis au rendu est celui qui a été **parcouru** : on le tronque
  // à la case d'arrêt, sinon une interruption sous brouillard ferait glisser la
  // figurine jusqu'au bout d'un trajet qu'elle n'a pas fait.
  const arret = chemin.findIndex((c) => c.x === u.x && c.y === u.y);
  const parcouru = (arret < 0 ? chemin : chemin.slice(0, arret + 1)).map((c) => ({ x: c.x, y: c.y }));
  evts.push({
    type: 'deplacement',
    uniteId: u.id,
    de: depart,
    vers: { x: u.x, y: u.y },
    chemin: parcouru.length > 1 ? parcouru : [depart, { x: u.x, y: u.y }],
    interrompu,
  });

  const suite: Suite = interrompu ? { type: 'rien' } : action.suite;
  const resultat = executerSuite(e, cat, u, suite, aBouge, rng, evts);
  if (!resultat.ok) return resultat;
  if (e.unites.some((x) => x.id === u.id)) {
    // `puis` sans embuscade : la suite reste à donner. Une embuscade, elle,
    // clôt le tour — on s'est fait surprendre, on ne joue plus.
    u.etat = suite.type === 'puis' ? 'deplacee' : 'agi';
  }
  return { ok: true };
}

/** Pose un passager sur une case adjacente ; refuse sans rien poser sinon. */
function debarquerUn(
  e: EtatPartie, cat: Catalogue, u: Unite, demande: Debarquement, evts: EvenementJeu[],
): Verdict {
  const passagerId = demande.passager ?? u.cargo[0];
  if (passagerId === undefined) return refus('debarquement_impossible', 'aucun passager') as Verdict;
  if (!u.cargo.includes(passagerId)) return refus('debarquement_impossible', 'passager absent de la cale') as Verdict;
  const passager = uniteParId(e, passagerId);
  if (!passager) return refus('debarquement_impossible') as Verdict;
  if (!dansCarte(e, demande.vers) || manhattan(u, demande.vers) !== 1) {
    return refus('debarquement_impossible', 'case non adjacente') as Verdict;
  }
  if (uniteSur(e, demande.vers)) return refus('case_occupee') as Verdict;
  const tp = cat.unites[passager.type];
  const terrain = terrainLogique(e, cat, demande.vers);
  if (!tp || terrain === null || cat.terrains[terrain]?.couts[tp.typeMouvement] === undefined) {
    return refus('debarquement_impossible', 'terrain infranchissable') as Verdict;
  }
  u.cargo = u.cargo.filter((id) => id !== passagerId);
  passager.dansTransport = null;
  passager.x = demande.vers.x;
  passager.y = demande.vers.y;
  // Le débarqué ne se déplace plus ce tour (§2, phase 6).
  passager.etat = 'agi';
  evts.push({ type: 'debarquement', uniteId: passager.id, transportId: u.id, vers: demande.vers });
  return { ok: true };
}

function executerSuite(
  e: EtatPartie, cat: Catalogue, u: Unite, suite: Suite, aBouge: boolean,
  rng: ReturnType<typeof restaurerRng>, evts: EvenementJeu[],
): Verdict {
  if (suite.type === 'rien') return { ok: true };

  if (suite.type === 'attaquer') {
    const cible = uniteSur(e, suite.cible);
    if (!cible) return refus('cible_absente') as Verdict;
    const peut = peutViser(e, cat, u, cible, { x: u.x, y: u.y }, aBouge);
    if (!peut.ok) return refus(peut.motif) as Verdict;
    if (brouillardActif(e) && !casesVisibles(e, cat, u.camp).has(cleCase(suite.cible))) {
      return refus('cible_invisible') as Verdict;
    }
    resoudreAttaque(e, cat, u, cible, rng, evts);
    return { ok: true };
  }

  if (suite.type === 'capturer') {
    if (!peutCapturerIci(e, cat, u)) return refus('capture_impossible') as Verdict;
    avancerCapture(e, cat, u, evts);
    return { ok: true };
  }

  if (suite.type === 'embarquer') {
    const transport = uniteParId(e, suite.transport);
    if (!transport || transport.camp !== u.camp) return refus('transport_impossible') as Verdict;
    const tt = cat.unites[transport.type];
    const tu = cat.unites[u.type];
    if (!tt || !tu || !porte(tt, 'transport') || tt.transport === null) {
      return refus('transport_impossible') as Verdict;
    }
    if (!tt.transport.accepte.includes(u.type)) return refus('transport_impossible') as Verdict;
    if (porte(tu, 'transport')) return refus('transport_impossible', 'pas de transport dans un transport') as Verdict;
    if (transport.cargo.length >= tt.transport.places) return refus('transport_plein') as Verdict;
    if (manhattan(transport, u) > 1) return refus('transport_impossible', 'transport hors de portée') as Verdict;
    transport.cargo.push(u.id);
    u.dansTransport = transport.id;
    u.x = transport.x;
    u.y = transport.y;
    u.pointsCapture = 0;
    evts.push({ type: 'embarquement', uniteId: u.id, transportId: transport.id });
    return { ok: true };
  }

  if (suite.type === 'debarquer') {
    // Un ordre, plusieurs débarquements (catalogue 6) : une barge à deux places
    // vide sa cale en une fois, chaque passager sur sa case. Le premier est
    // porté par `vers`/`passager`, les suivants par `autres` ; un seul refus
    // annule tout, `appliquer` ayant travaillé sur une copie.
    const demandes: Debarquement[] = [{ vers: suite.vers, passager: suite.passager }, ...(suite.autres ?? [])];
    for (const demande of demandes) {
      const verdict = debarquerUn(e, cat, u, demande, evts);
      if (!verdict.ok) return verdict;
    }
    return { ok: true };
  }

  // `puis` : rien à faire ici, la suite viendra par un second ordre.
  if (suite.type === 'puis') return { ok: true };

  if (suite.type === 'furtivite') {
    // Se cacher ou se montrer (trait `furtif`, catalogue 6) : une bascule, après
    // le déplacement comme toute suite. Cachée, l'unité n'est repérée qu'au
    // contact (`cacheeAuContact`) et paie un surcoût de carburant par tour.
    const type = cat.unites[u.type];
    if (!type || !porte(type, 'furtif')) return refus('furtivite_impossible') as Verdict;
    u.furtive = u.furtive !== true;
    evts.push({ type: 'furtivite', uniteId: u.id, furtive: u.furtive });
    return { ok: true };
  }

  if (suite.type === 'fusionner') {
    const cible = uniteParId(e, suite.avec);
    if (!cible || cible.camp !== u.camp || cible.type !== u.type || cible.id === u.id) {
      return refus('fusion_impossible') as Verdict;
    }
    if (manhattan(cible, u) > 1) return refus('fusion_impossible', 'unités non adjacentes') as Verdict;
    const type = cat.unites[u.type]!;
    const total = cible.pv + u.pv;
    const surplus = Math.max(0, total - 100);
    cible.pv = Math.min(100, total);
    if (cible.munitions !== null && u.munitions !== null) {
      cible.munitions = Math.max(cible.munitions, u.munitions);
    }
    if (cible.carburant !== null && u.carburant !== null) {
      cible.carburant = Math.max(cible.carburant, u.carburant);
    }
    const caisse = e.camps.find((c) => c.id === u.camp);
    const rembourse = Math.round((surplus / 100) * type.cout);
    if (caisse) caisse.fonds += rembourse;
    e.unites = e.unites.filter((x) => x.id !== u.id);
    evts.push({ type: 'fusion', uniteId: u.id, avecId: cible.id, rembourse });
    return { ok: true };
  }

  if (suite.type === 'ravitailler') {
    const type = cat.unites[u.type];
    if (!type || !porte(type, 'ravitaillement')) return refus('ravitaillement_impossible') as Verdict;
    const cible = uniteSur(e, suite.cible);
    if (!cible || !sontAllies(e, cible.camp, u.camp)) return refus('ravitaillement_impossible') as Verdict;
    if (manhattan(cible, u) !== 1) return refus('ravitaillement_impossible', 'unité non adjacente') as Verdict;
    const tc = cat.unites[cible.type];
    if (!tc) return refus('catalogue_inconnu') as Verdict;
    if (tc.munitions !== null) cible.munitions = tc.munitions;
    if (tc.carburant !== null) cible.carburant = tc.carburant.max;
    evts.push({ type: 'ravitaillement', uniteId: u.id, cibleId: cible.id });
    return { ok: true };
  }

  if (suite.type === 'construire') {
    const terrain = terrainConstruction(e, cat, u, suite.cible);
    if (!terrain) return refus('construction_impossible') as Verdict;
    const camp = e.camps.find((c) => c.id === u.camp)!;
    camp.fonds -= COUT_CONSTRUCTION;
    e.terrainsPoses.push({ case: cleCase(suite.cible), terrain, jusqu: null });
    evts.push({ type: 'terrain_pose', case: suite.cible, terrain });
    return { ok: true };
  }

  return refus('action_inconnue') as Verdict;
}

// ---------------------------------------------------------------------------
// Production, pouvoir, fin de tour
// ---------------------------------------------------------------------------

function executerProduction(
  e: EtatPartie, cat: Catalogue,
  action: Extract<Action, { type: 'produire' }>, evts: EvenementJeu[],
): Verdict {
  const v = verifierProduction(e, cat, e.campCourant, action.batiment, action.unite);
  if (!v.ok) return v.detail === undefined ? refus(v.motif) as Verdict : refus(v.motif, v.detail) as Verdict;
  produire(e, cat, e.campCourant, action.batiment, action.unite, evts);
  return { ok: true };
}

function executerPouvoir(
  e: EtatPartie, cat: Catalogue,
  action: Extract<Action, { type: 'pouvoir' }>, commandants: Commandants,
  evts: EvenementJeu[],
): Verdict {
  const commandant = commandants[e.campCourant] ?? null;
  const v = verifierPouvoir(e, commandant, e.campCourant, action.niveau);
  if (!v.ok) return v.detail === undefined ? refus(v.motif) as Verdict : refus(v.motif, v.detail) as Verdict;
  const cases: Case[] = action.cases ?? [];
  return appliquerPouvoir(e, cat, e.campCourant, action.niveau, v, cases, evts);
}

function executerFinTour(
  e: EtatPartie, cat: Catalogue,
  rng: ReturnType<typeof restaurerRng>, evts: EvenementJeu[],
): Verdict {
  fermerTour(e, cat, rng, evts);
  if (!e.partie.terminee) ouvrirTour(e, cat, rng, evts);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Aides de lecture, utiles au rendu et à l'IA
// ---------------------------------------------------------------------------

/** Cases où cette unité peut aller, coût compris (Dijkstra borné). */
export { portee } from './regles/mouvement';

/** Cibles qu'une unité peut viser depuis une case donnée. */
export function ciblesDepuis(
  etat: EtatPartie, cat: Catalogue, u: Unite, depuis: Case, aBouge: boolean,
): Unite[] {
  const visibles = brouillardActif(etat) ? casesVisibles(etat, cat, u.camp) : null;
  return etat.unites.filter((cible) => {
    if (cible.dansTransport) return false;
    if (visibles && !visibles.has(cleCase(cible))) return false;
    return peutViser(etat, cat, u, cible, depuis, aBouge).ok;
  });
}

/** Cases voisines libres d'une case, dans l'ordre fixe des voisines. */
export function voisinesLibres(etat: EtatPartie, c: Case): Case[] {
  return voisines(c).filter((v) => dansCarte(etat, v) && !uniteSur(etat, v));
}

/** PV affichés d'une unité : ce que voit le joueur. */
export { pvAffiches };
