/** Accès typé à `events` et `actualite_items` : l'actualité et la dépêche. */

import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';

import { db } from '../client';
import { actualiteItems, events } from '../schema';
import type { Event, Statut } from '../../schemas/index';
import { identifiant } from './communs';

/** Une ligne d'`events`. */
export type LigneEvent = typeof events.$inferSelect;
/** Une ligne d'`actualite_items`. */
export type LigneItem = typeof actualiteItems.$inferSelect;

/** Un événement par son code. */
export async function evenement(code: string): Promise<LigneEvent | null> {
  const lignes = await db().select().from(events).where(eq(events.code, code)).limit(1);
  return lignes[0] ?? null;
}

/** Les événements d'un ou plusieurs statuts. */
export async function parStatut(statuts: Statut[], limite = 50): Promise<LigneEvent[]> {
  return db().select().from(events)
    .where(inArray(events.statut, statuts))
    .orderBy(desc(events.creeLe))
    .limit(limite);
}

/** L'événement de dépêche d'un jour donné, s'il existe. */
export async function depecheDuJour(jour: string): Promise<LigneEvent | null> {
  const lignes = await db().select().from(events).where(eq(events.depecheJour, jour)).limit(1);
  return lignes[0] ?? null;
}

/** Dépose un `Event` en brouillon. `debut` et `fin` sont posés par le serveur. */
export async function deposer(entree: {
  donnees: Event;
  inspiration: { item_id: string; categorie: string } | null;
  depecheJour: string | null;
  debut: string;
  fin: string;
}): Promise<LigneEvent> {
  const d = entree.donnees;
  const lignes = await db().insert(events).values({
    id: identifiant('evt'),
    code: d.code,
    sourceUrl: d.sourceUrl,
    sourceNom: d.sourceNom,
    categorie: d.categorie,
    donnees: d,
    inspiration: entree.inspiration,
    depecheJour: entree.depecheJour,
    debut: entree.debut,
    fin: entree.fin,
    statut: 'brouillon',
  }).returning();
  const ligne = lignes[0];
  if (!ligne) throw new Error('dépôt d’événement sans retour');
  return ligne;
}

/** Change le statut d'un événement, et le drapeau de validation humaine avec lui. */
export async function changerStatut(code: string, statut: Statut, valideParHumain?: boolean): Promise<boolean> {
  const lignes = await db().update(events)
    .set({
      statut,
      majLe: new Date(),
      ...(valideParHumain === undefined ? {} : { valideParHumain }),
    })
    .where(eq(events.code, code))
    .returning({ id: events.id });
  return lignes.length > 0;
}

/** Les items d'actualité d'une fenêtre : le calendrier interne servi au cerveau. */
export async function itemsEntre(du: string, au: string): Promise<LigneItem[]> {
  return db().select().from(actualiteItems)
    .where(sql`${actualiteItems.date} between ${du} and ${au}`)
    .orderBy(asc(actualiteItems.date));
}

/** Les items d'un jour précis : la source unique du volet dépêche. */
export async function itemsDuJour(jour: string): Promise<LigneItem[]> {
  return db().select().from(actualiteItems).where(eq(actualiteItems.date, jour));
}

/** Les identifiants d'items déjà utilisés dans les 30 derniers jours. */
export async function itemsUtilises(jours: number): Promise<string[]> {
  const lignes = await db().select({ id: actualiteItems.id }).from(actualiteItems)
    .where(and(
      isNotNull(actualiteItems.utiliseLe),
      sql`${actualiteItems.utiliseLe} >= (current_date - make_interval(days => ${jours}))`,
    ));
  return lignes.map((l) => l.id);
}

/** Marque un item comme consommé : c'est ce qui empêche la réutilisation à 30 jours. */
export async function marquerItemUtilise(id: string, jour: string): Promise<void> {
  await db().update(actualiteItems).set({ utiliseLe: jour }).where(eq(actualiteItems.id, id));
}
