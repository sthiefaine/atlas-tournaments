/**
 * Réponses HTTP communes : codes stables, jamais de prose seule
 * (`05-routines.md` §1.10).
 */

import type { Erreur } from '../schemas/index';

/** Corps d'erreur normalisé de l'API des routines. */
export interface CorpsErreur {
  error: string;
  detail?: string;
  chemins?: string[];
}

/** Réponse JSON, sans cache : toutes les routes de l'API sont dynamiques. */
export function json(corps: unknown, statut = 200, entetes: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...entetes },
  });
}

/** Réponse d'erreur : un code stable, un détail facultatif, les chemins fautifs. */
export function erreur(code: string, statut: number, detail?: string, chemins?: string[]): Response {
  const corps: CorpsErreur = { error: code };
  if (detail !== undefined) corps.detail = detail;
  if (chemins !== undefined && chemins.length > 0) corps.chemins = chemins;
  return json(corps, statut);
}

/** Transforme les erreurs d'un validateur en réponse `422 schema_invalide`. */
export function schemaInvalide(erreurs: Erreur[], objet?: string): Response {
  return erreur(
    'schema_invalide',
    422,
    objet ? `${objet} : ${erreurs.length} champ(s) refusé(s)` : `${erreurs.length} champ(s) refusé(s)`,
    erreurs.map((e) => `${e.chemin || '(racine)'} — ${e.message}`),
  );
}

/** Lit un corps JSON en refusant proprement ce qui n'en est pas. */
export async function lireJson(requete: Request): Promise<{ ok: true; valeur: unknown } | { ok: false; reponse: Response }> {
  const type = requete.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) {
    return { ok: false, reponse: erreur('content_type_invalide', 415, 'application/json attendu') };
  }
  try {
    return { ok: true, valeur: await requete.json() };
  } catch {
    return { ok: false, reponse: erreur('json_invalide', 400, 'le corps n’est pas du JSON') };
  }
}

/** Entier de requête borné, avec valeur par défaut. */
export function entierBorne(brut: string | null, defaut: number, min: number, max: number): number {
  if (brut === null || brut.trim() === '') return defaut;
  const n = Number(brut);
  if (!Number.isInteger(n)) return defaut;
  return Math.min(max, Math.max(min, n));
}

/** Réponse d'indisponibilité de base, quand `DATABASE_URL` manque ou que la base est muette. */
export function baseIndisponible(detail?: string): Response {
  return erreur('base_indisponible', 503, detail ?? 'la base de données n’est pas joignable');
}
