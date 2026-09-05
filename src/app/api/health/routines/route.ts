/**
 * `GET /api/health/routines` — la sonde « homme mort » (`05-routines.md` §1.7).
 *
 * Publique, sans authentification, et elle ne divulgue aucun contenu : des clés,
 * des horodatages, des booléens. Elle répond **`500`** dès qu'une seule routine
 * dépasse son silence maximal — c'est ce que lit la supervision externe.
 */

import { baseConfiguree } from '@/db/client';
import { json } from '@/serveur/reponses';
import { sonder } from '@/serveur/sonde';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  if (!baseConfiguree()) {
    return json({ ok: false, routines: [], detail: 'base non configurée' }, 500);
  }
  try {
    const etat = await sonder();
    return json(etat, etat.ok ? 200 : 500);
  } catch (e) {
    return json({ ok: false, routines: [], detail: e instanceof Error ? e.message : String(e) }, 500);
  }
}
