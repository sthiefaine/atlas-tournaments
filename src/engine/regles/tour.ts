/**
 * Séquence d'un tour (`doc/04-gameplay.md` §2) : ouverture et hooks, revenus,
 * réparation, carburant, réveil, puis les ordres — et la fermeture.
 *
 * Toutes ces fonctions écrivent dans l'**état de travail** déjà copié par
 * `appliquer`. Les hooks, eux, restent purs : ils rendent des effets, le moteur
 * seul les applique.
 */

import type { CampId } from '../../schemas/index';
import { avancerClimat } from '../climat/index';
import { debutTourHooks, finTourHooks } from '../hooks';
import type {
  Catalogue, EffetMecanique, EtatPartie, EvenementJeu, Rng, SourceModificateur,
} from '../types';
import { cleCase } from '../types';
import { consommerCarburant, reparerEtRavitailler, reveiller, verserRevenus } from './economie';
import { uniteSur } from './mouvement';
import { expirationDe, expirerPoses, poserModificateur } from './pouvoirs';
import { deployerRenforts } from './renforts';
import { evaluerFin } from './victoire';
import { ouvrirTechnologies } from './technologies';

/** Applique les effets déclaratifs d'un hook. Rien d'autre n'écrit dans l'état. */
export function appliquerEffets(
  etat: EtatPartie, cat: Catalogue, effets: EffetMecanique[],
  source: SourceModificateur, evts: EvenementJeu[],
): void {
  for (const effet of effets) {
    if (effet.type === 'annonce') {
      evts.push({ type: 'annonce', texte: effet.texte, icone: effet.icone });
    } else if (effet.type === 'donnee') {
      if (etat.mecanique) etat.mecanique.donnees[effet.cle] = effet.valeur;
    } else if (effet.type === 'changer_terrain') {
      etat.terrainsPoses.push({
        case: cleCase(effet.case),
        terrain: effet.vers,
        jusqu: effet.journees === undefined ? null : etat.journee + effet.journees,
      });
      evts.push({ type: 'terrain_pose', case: effet.case, terrain: effet.vers });
    } else if (effet.type === 'degats') {
      const u = uniteSur(etat, effet.case);
      if (u) {
        // Une mécanique handicape, elle n'élimine jamais : au moins 1 PV interne.
        const perdus = Math.max(0, Math.min(u.pv - 1, Math.round(effet.pv)));
        u.pv -= perdus;
        evts.push({ type: 'degats_mecanique', uniteId: u.id, pv: perdus });
      }
    } else if (effet.type === 'repousser') {
      const u = uniteSur(etat, effet.case);
      if (u && !uniteSur(etat, effet.vers)) {
        u.x = effet.vers.x;
        u.y = effet.vers.y;
        u.pointsCapture = 0;
        evts.push({ type: 'repousse', uniteId: u.id, vers: effet.vers });
      }
    } else if (effet.type === 'modificateur') {
      poserModificateur(
        etat, etat.campCourant, source, effet.effet,
        expirationDe(effet.duree, etat.journee),
      );
    }
  }
}

/** Retire les modificateurs arrivés à échéance au début du tour de `camp`. */
function expirerModificateurs(etat: EtatPartie, camp: CampId): void {
  etat.modificateurs = etat.modificateurs.filter((m) => {
    if (m.expire.type === 'permanent') return true;
    if (m.expire.type === 'ce_tour') return m.camp !== camp;
    if (m.expire.type === 'tour_complet') return m.camp !== camp;
    return etat.journee <= m.expire.jusqu;
  });
}

/** Camp suivant encore en lice, dans l'ordre des camps. */
export function campSuivant(etat: EtatPartie): CampId {
  const n = etat.camps.length;
  const courant = etat.camps.findIndex((c) => c.id === etat.campCourant);
  for (let i = 1; i <= n; i += 1) {
    const candidat = etat.camps[(courant + i) % n];
    if (candidat && !candidat.elimine) return candidat.id;
  }
  return etat.campCourant;
}

/**
 * Phases 1 à 5 du tour de `etat.campCourant`. La journée s'incrémente quand le
 * camp 0 reprend la main, et la couche climat avance avant tout le reste.
 */
export function ouvrirTour(
  etat: EtatPartie, cat: Catalogue, rng: Rng, evts: EvenementJeu[],
): void {
  const camp = etat.campCourant;
  if (camp === etat.camps.find((c) => !c.elimine)?.id) {
    etat.journee += 1;
    if (etat.journee > 1) {
      // Une météo imposée par un pouvoir expire silencieusement : passée sa
      // dernière journée, elle n'est plus lue, et l'état ne la garde pas.
      if (etat.meteoImposee !== undefined && etat.meteoImposee.jusqu < etat.journee) delete etat.meteoImposee;
      etat.climat = avancerClimat(etat.climat, etat.reglages, rng, etat.journee, etat.meteoImposee);
    }
    evts.push({
      type: 'debut_journee', journee: etat.journee, camp,
      saison: etat.climat.saison, phase: etat.climat.phase, meteo: etat.climat.meteo,
    });
  }
  ouvrirTechnologies(etat, cat, evts);
  deployerRenforts(etat, cat, evts);
  evts.push({ type: 'debut_tour', journee: etat.journee, camp });
  expirerModificateurs(etat, camp);
  expirerPoses(etat, cat, evts);

  const hooks = debutTourHooks(etat, cat, rng);
  appliquerEffets(etat, cat, hooks.climat, 'climat', evts);
  if (hooks.meca.length > 0 && etat.mecanique) etat.mecanique.declenchements += 1;
  appliquerEffets(etat, cat, hooks.meca, 'mecanique', evts);

  verserRevenus(etat, camp, evts);
  reparerEtRavitailler(etat, cat, camp, evts);
  consommerCarburant(etat, cat, camp, evts);
  reveiller(etat, camp);
  for (const u of etat.unites) if (u.camp === camp && u.iemJusquaJournee !== undefined) u.etat = "agi";
  const caisse = etat.camps.find((c) => c.id === camp);
  if (caisse) caisse.pouvoirUtiliseCeTour = false;
  evaluerFin(etat, cat, evts);
}

/** Phase 7 — fermeture : hooks, expiration `ce_tour`, victoire, camp suivant. */
export function fermerTour(
  etat: EtatPartie, cat: Catalogue, rng: Rng, evts: EvenementJeu[],
): void {
  const camp = etat.campCourant;
  const hooks = finTourHooks(etat, cat, rng);
  appliquerEffets(etat, cat, hooks.climat, 'climat', evts);
  if (hooks.meca.length > 0 && etat.mecanique) etat.mecanique.declenchements += 1;
  appliquerEffets(etat, cat, hooks.meca, 'mecanique', evts);
  etat.modificateurs = etat.modificateurs.filter(
    (m) => !(m.expire.type === 'ce_tour' && m.camp === camp),
  );
  // Une unité déplacée qui n'a pas donné sa suite (ordre `puis`) la perd :
  // le tour se ferme, elle a joué.
  for (const u of etat.unites) if (u.camp === camp && u.etat === 'deplacee') u.etat = 'agi';
  for (const u of etat.unites) if (u.camp === camp) delete u.iemJusquaJournee;
  // Une réactivation ne vaut que pour le tour où elle a été donnée.
  for (const u of etat.unites) if (u.camp === camp) delete u.reactivee;
  evts.push({ type: 'fin_tour', camp });
  evaluerFin(etat, cat, evts);
  if (etat.partie.terminee) return;
  etat.campCourant = campSuivant(etat);
}
