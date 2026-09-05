/**
 * `GET /api/routines/bible/flags` — le catalogue des flags narratifs, en lecture
 * seule (`05-routines.md` §2.2).
 *
 * La routine lore n'invente **aucun** flag : elle choisit dans cette liste. Le
 * fichier `content/flags.json` est écrit à la main et relu en revue de code ; tant
 * qu'il n'existe pas, la route rend une liste vide et le dit — mieux vaut une liste
 * vide qu'un catalogue inventé.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { exigerRoutine } from '@/serveur/auth';
import { json } from '@/serveur/reponses';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(requete: Request): Promise<Response> {
  const refus = exigerRoutine(requete);
  if (refus) return refus;
  try {
    const texte = await readFile(path.resolve(process.cwd(), 'content', 'flags.json'), 'utf8');
    const contenu = JSON.parse(texte) as { flags?: unknown[] };
    const flags = Array.isArray(contenu.flags) ? contenu.flags : [];
    return json({ count: flags.length, flags });
  } catch {
    return json({ count: 0, flags: [], note: 'content/flags.json n’existe pas encore : n’invente aucun flag.' });
  }
}
