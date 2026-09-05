/** Lecture des objectifs pour les deux peaux : les cases vertes sont des repères publics. */
import type { Catalogue, EtatPartie } from '../engine/index';
import { cleCase } from '../engine/types';
import type { Case } from '../schemas/types';
import type { Surbrillance } from './surbrillance';

type Traduire = (cle: string, params?: Record<string, string | number>) => string;

export function casesObjectifs(etat: EtatPartie): Surbrillance[] {
  const cases: Case[] = [];
  for (const [i, objectif] of etat.reglages.victoire.entries()) {
    if (objectif.type === 'proteger' && objectif.destination) cases.push(objectif.destination);
    if (objectif.type === 'relais') {
      const cible = objectif.cases[etat.relais?.[String(i)] ?? 0];
      if (cible) cases.push(cible);
    }
    if (objectif.type === 'capturer' || objectif.type === 'tenir') cases.push(...objectif.cases);
  }
  return [...new Map(cases.map(c => [cleCase(c), c])).values()].map(c => ({ case: c, genre: 'capture' }));
}

export function textesObjectifs(etat: EtatPartie, cat: Catalogue, t: Traduire): string[] {
  const lignes: string[] = [];
  for (const [i, o] of etat.reglages.victoire.entries()) {
    if (o.type === 'capture_qg' || o.type === 'hors_jeu_total') lignes.push(t(`objectif.${o.type}`));
    if (o.type === 'capturer') lignes.push(t('objectif.capturer', { n: o.cases.filter(c => etat.proprietaires[cleCase(c)] === 0).length, total: o.combien }));
    if (o.type === 'tenir') lignes.push(t('objectif.tenir', { n: o.journees }));
    if (o.type === 'survivre') lignes.push(t('objectif.survivre', { n: Math.min(o.journees, Math.max(0, etat.journee - 1)), total: o.journees }));
    if (o.type === 'points') lignes.push(t('objectif.points', { n: o.seuil }));
    if (o.type === 'proteger') {
      const unite = etat.unites.find(u => u.id === o.uniteRef);
      const nom = unite ? cat.unites[unite.type]?.nom ?? o.uniteRef : o.uniteRef;
      lignes.push(o.destination ? t('objectif.proteger', { unite: nom, x: o.destination.x + 1, y: o.destination.y + 1 }) : t('objectif.proteger_unite', { unite: nom }));
    }
    if (o.type === 'relais') {
      const n = etat.relais?.[String(i)] ?? 0;
      const c = o.cases[Math.min(n, o.cases.length - 1)];
      if (c) lignes.push(t('objectif.relais', { n, total: o.cases.length, x: c.x + 1, y: c.y + 1 }));
    }
  }
  if (etat.reglages.limiteJournees !== null) lignes.push(t('objectif.limite', { n: etat.reglages.limiteJournees }));
  return lignes;
}
