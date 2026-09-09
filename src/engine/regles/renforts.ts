import type { Catalogue, EtatPartie, EvenementJeu, Unite } from '../types';
import { manhattan } from '../types';
import { coutEntree, uniteSur } from './mouvement';

/** Ordre stable : vague, unité, distance au point d'entrée, ligne, colonne. */
export function deployerRenforts(etat: EtatPartie, cat: Catalogue, evts: EvenementJeu[]): void {
  for (const [i, vague] of (etat.reglages.renforts ?? []).entries()) {
    if (vague.journee > etat.journee) continue;
    for (const [j, demande] of vague.unites.entries()) {
      const cle = `${i}:${j}`;
      if (etat.renfortsLivres?.includes(cle)) continue;
      const camp = etat.camps.find((c) => c.id === demande.camp);
      const type = cat.unites[demande.type];
      if (!camp || camp.elimine || !type) continue;
      const unite: Unite = { ...demande, id: `u${etat.prochainId}`, pv: demande.pv ?? 100,
        munitions: type.munitions, carburant: type.carburant?.max ?? null,
        etat: 'prete', pointsCapture: 0, cargo: [], dansTransport: null };
      const libres = [];
      for (let y = 0; y < etat.hauteur; y += 1) for (let x = 0; x < etat.largeur; x += 1) {
        const c = { x, y };
        if (!uniteSur(etat, c) && coutEntree(etat, cat, unite, c) !== null) libres.push(c);
      }
      libres.sort((a, b) => manhattan(a, demande) - manhattan(b, demande) || a.y - b.y || a.x - b.x);
      const position = libres[0];
      if (!position) continue; // Report au prochain début de tour, sans duplication.
      Object.assign(unite, position);
      etat.unites.push(unite);
      etat.prochainId += 1;
      (etat.renfortsLivres ??= []).push(cle);
      evts.push({ type: 'annonce', texte: `Renfort du camp ${demande.camp} arrivé.`, icone: 'renfort' });
    }
  }
}
