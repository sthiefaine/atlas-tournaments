/** Installations de scénario : leurs positions et calendriers sont publics. */
import { sontAllies } from '../equipes';
import type { Catalogue, EtatPartie, EvenementJeu } from '../types';
import { crediterJauge, JAUGE_PAR_PV_SUBI, mettreHorsJeu } from './combat';
import { pvAffiches } from '../types';
import { frapperUsines, producteursAdversesAutour } from './economie';

export function ouvrirTechnologies(etat: EtatPartie, cat: Catalogue, evts: EvenementJeu[]): void {
  if (etat.campCourant !== etat.camps.find((c) => !c.elimine)?.id) return;
  for (const s of etat.reglages.installationsIem ?? []) {
    if (etat.desaffectes.includes(`${s.x},${s.y}`)) continue;
    const camp = etat.proprietaires[`${s.x},${s.y}`];
    if (camp === undefined || camp === null || etat.camps.find((c) => c.id === camp)?.elimine) continue;
    if (s.portee === 'carte' && camp !== s.campProtege) continue;
    const delta = etat.journee - s.premiereJournee;
    const renforcee = s.mode === 'renforcee';
    const globale = s.portee === 'carte';
    const rayon = globale ? etat.largeur + etat.hauteur : s.rayon ?? (renforcee ? 2 : 3);
    const intervalle = s.intervalle ?? (renforcee ? 6 : 3);
    const reste = delta < 0 ? -delta : (intervalle - delta % intervalle) % intervalle;
    if (renforcee && reste > 0) {
      evts.push({ type: 'annonce', texte: `IEM renforcée ${s.cle} (${s.x},${s.y}) : impulsion dans ${reste} journée(s), ${globale ? 'toute la carte' : `rayon ${rayon}`}. Avions, hélicoptères et drones aériens ennemis détruits ; navires immobilisés un tour. ${globale ? 'Capturez la station pour la désactiver.' : 'Capturez la station ou quittez la zone.'}`, icone: 'radar' });
    }
    if (!renforcee && delta >= -1 && (delta + 1) % intervalle === 0) {
      evts.push({ type: 'annonce', texte: `IEM ${s.cle} : impulsion demain, rayon ${s.rayon ?? 3}, avions et navires immobilisés un tour. Capturez la station ou quittez la zone.`, icone: 'radar' });
    }
    if (delta < 0 || delta % intervalle !== 0) continue;
    let touches = 0;
    const abattues: string[] = [];
    const immobilisees: string[] = [];
    for (const u of etat.unites) {
      const domaine = cat.unites[u.type]?.domaine;
      if (u.dansTransport !== null || sontAllies(etat, camp, u.camp)
        || (domaine !== 'air' && domaine !== 'mer')
        || Math.abs(u.x - s.x) + Math.abs(u.y - s.y) > rayon) continue;
      if (renforcee && domaine === 'air') {
        crediterJauge(etat, u.camp, JAUGE_PAR_PV_SUBI * pvAffiches(u.pv));
        mettreHorsJeu(etat, cat, u.id, evts);
        abattues.push(u.id);
        continue;
      }
      u.iemJusquaJournee = etat.journee;
      u.etat = 'agi';
      immobilisees.push(u.id);
      touches += 1;
    }
    // Depuis le 10 septembre 2026, l'impulsion arrête aussi les usines adverses
    // du rayon : elles ne produisent rien à leur tour.
    const usines = frapperUsines(etat, producteursAdversesAutour(etat, cat, camp, s, rayon), evts);
    if (renforcee) {
      evts.push({ type: 'iem_pouvoir', camp, centre: { x: s.x, y: s.y }, rayon, abattues, immobilisees, usines });
      evts.push({ type: 'annonce', texte: `IEM renforcée ${s.cle} : ${abattues.length} aéronefs détruits, ${touches} navires immobilisés, ${usines} usines arrêtées. Prochaine impulsion à J${etat.journee + intervalle}.`, icone: 'radar' });
      continue;
    }
    evts.push({ type: 'annonce', texte: `IEM ${s.cle} : impulsion émise (${touches} unités, ${usines} usines). Aucun dégât ; arrêt jusqu’à la fin du prochain tour de chaque unité, aucune production ce tour dans les usines touchées.`, icone: 'radar' });
  }
  for (const e of etat.reglages.evenementsClimat ?? []) {
    if (e.journee - 2 === etat.journee) evts.push({ type: 'annonce', texte: `Modification météo annoncée : ${e.meteo} de J${e.journee} à J${e.journee + e.duree - 1}. Camps équipés : ${e.campsAdaptes.join(', ') || 'aucun'}.`, icone: e.meteo });
  }
}
