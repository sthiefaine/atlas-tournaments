/** Installations de scénario : leurs positions et calendriers sont publics. */
import { sontAllies } from '../equipes';
import type { Catalogue, EtatPartie, EvenementJeu } from '../types';
import { frapperUsines, producteursAdversesAutour } from './economie';

export function ouvrirTechnologies(etat: EtatPartie, cat: Catalogue, evts: EvenementJeu[]): void {
  if (etat.campCourant !== etat.camps.find((c) => !c.elimine)?.id) return;
  for (const s of etat.reglages.installationsIem ?? []) {
    if (etat.desaffectes.includes(`${s.x},${s.y}`)) continue;
    const camp = etat.proprietaires[`${s.x},${s.y}`];
    if (camp === undefined || camp === null || etat.camps.find((c) => c.id === camp)?.elimine) continue;
    const delta = etat.journee - s.premiereJournee;
    const intervalle = s.intervalle ?? 3;
    if (delta >= -1 && (delta + 1) % intervalle === 0) {
      evts.push({ type: 'annonce', texte: `IEM ${s.cle} : impulsion demain, rayon ${s.rayon ?? 3}, avions et navires immobilisés un tour. Capturez la station ou quittez la zone.`, icone: 'radar' });
    }
    if (delta < 0 || delta % intervalle !== 0) continue;
    let touches = 0;
    for (const u of etat.unites) {
      const domaine = cat.unites[u.type]?.domaine;
      if (u.dansTransport !== null || sontAllies(etat, camp, u.camp)
        || (domaine !== 'air' && domaine !== 'mer')
        || Math.abs(u.x - s.x) + Math.abs(u.y - s.y) > (s.rayon ?? 3)) continue;
      u.iemJusquaJournee = etat.journee;
      u.etat = 'agi';
      touches += 1;
    }
    // Depuis le 10 septembre 2026, l'impulsion arrête aussi les usines adverses
    // du rayon : elles ne produisent rien à leur tour.
    const usines = frapperUsines(etat, producteursAdversesAutour(etat, cat, camp, s, s.rayon ?? 3), evts);
    evts.push({ type: 'annonce', texte: `IEM ${s.cle} : impulsion émise (${touches} unités, ${usines} usines). Aucun dégât ; arrêt jusqu’à la fin du prochain tour de chaque unité, aucune production ce tour dans les usines touchées.`, icone: 'radar' });
  }
  for (const e of etat.reglages.evenementsClimat ?? []) {
    if (e.journee - 2 === etat.journee) evts.push({ type: 'annonce', texte: `Modification météo annoncée : ${e.meteo} de J${e.journee} à J${e.journee + e.duree - 1}. Camps équipés : ${e.campsAdaptes.join(', ') || 'aucun'}.`, icone: e.meteo });
  }
}
