/**
 * `GET /api/health` — ping de la base, utilisé par le HEALTHCHECK du Dockerfile.
 *
 * Répond `200` si la base répond, `503` sinon. Aucune requête n'est faite à
 * l'import du module : `next build` ne doit jamais exiger de base.
 */

import { baseConfiguree, ping } from '@/db/client';
import { json } from '@/serveur/reponses';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  if (!baseConfiguree()) {
    return json({ ok: false, base: 'non_configuree' }, 503);
  }
  const resultat = await ping();
  if (!resultat.ok) return json({ ok: false, base: 'muette', detail: resultat.erreur }, 503);
  return json({ ok: true, base: 'ok', latence_ms: resultat.ms });
}
