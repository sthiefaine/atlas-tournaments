/**
 * Le contour commun de toutes les routes de l'API des routines.
 *
 * Une route de `/api/routines/*` fait toujours les mêmes quatre choses avant de
 * travailler : elle vérifie le `Bearer`, elle s'assure que la base est joignable,
 * elle compte l'appel dans `routine_runs`, et elle transforme toute exception en
 * réponse codée. Autant l'écrire une fois.
 */

import { baseConfiguree } from '../db/client';
import { runs } from '../db/requetes/index';
import { exigerAdmin, exigerRoutine } from './auth';
import { baseIndisponible, erreur } from './reponses';
import { estGenerationIndisponible, reponseGenerationIndisponible } from './generation';
import { estIndisponible, reponseSimulationIndisponible } from './simulation';
import type { ClePrompt } from '../schemas/index';

/** Enveloppe une route de routine : authentification, base, journal, erreurs. */
export function routeRoutine(
  traitement: (requete: Request) => Promise<Response>,
  options: { journalPour?: ClePrompt } = {},
): (requete: Request) => Promise<Response> {
  return async (requete) => {
    const refus = exigerRoutine(requete);
    if (refus) return refus;
    if (!baseConfiguree()) return baseIndisponible('DATABASE_URL absente');
    try {
      if (options.journalPour) {
        const run = await runs.ouvrirRun(options.journalPour, null);
        await runs.compter(run.id, { appels: 1 });
      }
      return await traitement(requete);
    } catch (e) {
      return traduireErreur(e);
    }
  };
}

/** Enveloppe une route réservée à une session d'administration humaine. */
export function routeAdmin(
  traitement: (requete: Request) => Promise<Response>,
): (requete: Request) => Promise<Response> {
  return async (requete) => {
    const refus = exigerAdmin(requete);
    if (refus) return refus;
    if (!baseConfiguree()) return baseIndisponible('DATABASE_URL absente');
    try {
      return await traitement(requete);
    } catch (e) {
      return traduireErreur(e);
    }
  };
}

/** Enveloppe une route publique qui a besoin de la base. */
export function routePublique(
  traitement: (requete: Request) => Promise<Response>,
): (requete: Request) => Promise<Response> {
  return async (requete) => {
    if (!baseConfiguree()) return baseIndisponible('DATABASE_URL absente');
    try {
      return await traitement(requete);
    } catch (e) {
      return traduireErreur(e);
    }
  };
}

/** Transforme une exception en réponse codée. Aucune trace n'est renvoyée au client. */
export function traduireErreur(e: unknown): Response {
  if (estIndisponible(e)) return reponseSimulationIndisponible(e.message);
  if (estGenerationIndisponible(e)) return reponseGenerationIndisponible(e.message);
  const message = e instanceof Error ? e.message : String(e);
  if (/DATABASE_URL|ECONNREFUSED|ENOTFOUND|timeout/i.test(message)) {
    return baseIndisponible(message);
  }
  console.error('[api] erreur non traitée :', message);
  return erreur('erreur_serveur', 500, 'le serveur n’a pas pu traiter la demande');
}
