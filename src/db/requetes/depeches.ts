/** Accès typé à `daily_missions` : au plus une mission par jour réel. */

import { desc, eq, sql } from 'drizzle-orm';

import { db } from '../client';
import { dailyMissions } from '../schema';
import type { Statut } from '../../schemas/index';
import { ajouterJours, identifiant } from './communs';

/** Une ligne de `daily_missions`. */
export type LigneDepeche = typeof dailyMissions.$inferSelect;

/** La dépêche d'un jour donné. */
export async function depeche(jour: string): Promise<LigneDepeche | null> {
  const lignes = await db().select().from(dailyMissions).where(eq(dailyMissions.date, jour)).limit(1);
  return lignes[0] ?? null;
}

/** Les `n` derniers jours, avec ou sans mission : l'historique de l'administration. */
export async function derniers(limite = 7): Promise<LigneDepeche[]> {
  return db().select().from(dailyMissions).orderBy(desc(dailyMissions.date)).limit(limite);
}

/** Les dépêches encore en ligne : ce que voient les joueurs. */
export async function enLigne(): Promise<LigneDepeche[]> {
  return db().select().from(dailyMissions)
    .where(sql`${dailyMissions.statut} = 'en_ligne' and ${dailyMissions.expireLe} >= current_date`)
    .orderBy(desc(dailyMissions.date));
}

/** Ouvre la mission du jour à l'échéance de proposition. `expire_le` = date + 7 jours. */
export async function ouvrir(entree: {
  jour: string;
  eventId: string;
  paysCode: string | null;
  catalogueVersion: number;
  chainesVersion: number;
}): Promise<LigneDepeche> {
  const lignes = await db().insert(dailyMissions).values({
    id: identifiant('dep'),
    date: entree.jour,
    eventId: entree.eventId,
    paysCode: entree.paysCode,
    statut: 'brouillon',
    expireLe: ajouterJours(entree.jour, 7),
    catalogueVersion: entree.catalogueVersion,
    chainesVersion: entree.chainesVersion,
  }).onConflictDoUpdate({
    target: dailyMissions.date,
    set: { eventId: entree.eventId, paysCode: entree.paysCode, majLe: new Date() },
  }).returning();
  const ligne = lignes[0];
  if (!ligne) throw new Error('ouverture de dépêche sans retour');
  return ligne;
}

/** Rattache le scénario produit par la routine map. */
export async function attacherScenario(jour: string, scenarioId: string, catalogueVersion: number): Promise<void> {
  await db().update(dailyMissions)
    .set({ scenarioId, catalogueVersion, majLe: new Date() })
    .where(eq(dailyMissions.date, jour));
}

/** Change le statut d'une dépêche, avec l'étape manquée quand la journée est blanche. */
export async function changerStatut(jour: string, statut: Statut, etapeManquee?: string): Promise<boolean> {
  const lignes = await db().update(dailyMissions)
    .set({ statut, majLe: new Date(), ...(etapeManquee ? { etapeManquee } : {}) })
    .where(eq(dailyMissions.date, jour))
    .returning({ id: dailyMissions.id });
  return lignes.length > 0;
}

/** Arme la publication de 18 h 00 : la décision est humaine, l'heure ne l'est pas. */
export async function armer(jour: string, par: string): Promise<boolean> {
  const lignes = await db().update(dailyMissions)
    .set({ statut: 'valide', validePar: par, valideLe: new Date(), motifRefus: null, majLe: new Date() })
    .where(eq(dailyMissions.date, jour))
    .returning({ id: dailyMissions.id });
  return lignes.length > 0;
}

/** Refuse une dépêche : le motif alimente le taux de rejet humain. */
export async function refuser(jour: string, par: string, motif: string): Promise<boolean> {
  const lignes = await db().update(dailyMissions)
    .set({ statut: 'rejete', validePar: par, valideLe: new Date(), motifRefus: motif, majLe: new Date() })
    .where(eq(dailyMissions.date, jour))
    .returning({ id: dailyMissions.id });
  return lignes.length > 0;
}
