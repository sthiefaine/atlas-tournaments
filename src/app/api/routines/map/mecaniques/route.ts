/**
 * `GET /api/routines/map/mecaniques` — le catalogue des mécaniques régionales
 * déclarées, en lecture seule (`05-routines.md` §3.2).
 *
 * Une mécanique absente de cette liste n'existe pas : la routine map la met en
 * quarantaine au lieu de la supposer.
 */

import { chargerMecaniques } from '@/content/index';
import { exigerRoutine } from '@/serveur/auth';
import { json } from '@/serveur/reponses';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(requete: Request): Promise<Response> {
  const refus = exigerRoutine(requete);
  if (refus) return refus;
  const mecaniques = chargerMecaniques();
  return json({ count: mecaniques.length, mecaniques });
}
