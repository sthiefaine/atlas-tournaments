/**
 * `GET /api/canon/[...chemin]` — lecture seule du `content/` versionné
 * (`02-architecture.md` §3.5).
 *
 * C'est ce qui permet à la routine lore d'écrire contre **la même vérité** que le
 * jeu. Quatre garde-fous : uniquement des fichiers `.json`, uniquement sous
 * `content/`, jamais d'écriture, et **jamais un secret**. Un chemin qui sort du
 * dossier est refusé avant toute lecture — le `..` est la faille classique de ce
 * genre de route.
 *
 * **Les easter eggs ne passent pas par ici.** Le registre des secrets est
 * `doc/14-secrets.md` : cette route ne sert que `content/`, donc `doc/` lui est
 * inaccessible par construction, et c'est la garantie principale. La liste
 * `PREFIXES_SECRETS` en est la seconde : si un fichier de `content/` venait un jour à
 * porter un secret, il serait refusé ici plutôt que servi à une routine. Une routine
 * qui ne connaît pas un secret ne peut pas l'écrire dans un dialogue par mégarde.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { exigerRoutine } from '@/serveur/auth';
import { estSecret } from '@/serveur/canon';
import { erreur, json } from '@/serveur/reponses';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Le dossier canon, résolu depuis la racine du dépôt. */
function racineCanon(): string {
  return path.resolve(process.cwd(), 'content');
}

export async function GET(
  requete: Request,
  contexte: { params: Promise<{ chemin: string[] }> },
): Promise<Response> {
  const refus = exigerRoutine(requete);
  if (refus) return refus;

  const { chemin } = await contexte.params;
  const racine = racineCanon();

  if (chemin.length === 0) {
    return json({ chemin: '', fichiers: await lister(racine, racine) });
  }
  if (chemin.some((s) => s === '..' || s === '.' || s.includes('/') || s.includes('\\'))) {
    return erreur('chemin_invalide', 400, 'aucun segment de chemin relatif n’est accepté');
  }

  const cible = path.resolve(racine, ...chemin);
  if (cible !== racine && !cible.startsWith(racine + path.sep)) {
    return erreur('chemin_invalide', 400, 'chemin hors du dossier canon');
  }
  if (estSecret(chemin.join('/'))) {
    return erreur('type_refuse', 403, 'le registre des secrets n’est jamais servi aux routines');
  }

  let infos;
  try {
    infos = await stat(cible);
  } catch {
    return erreur('introuvable', 404, `${chemin.join('/')} n’existe pas dans le canon`);
  }

  if (infos.isDirectory()) {
    return json({ chemin: chemin.join('/'), fichiers: await lister(cible, racine) });
  }
  if (!cible.endsWith('.json')) {
    return erreur('type_refuse', 415, 'seuls les fichiers .json du canon sont servis');
  }
  const texte = await readFile(cible, 'utf8');
  try {
    return json({ chemin: chemin.join('/'), contenu: JSON.parse(texte) });
  } catch {
    return erreur('canon_illisible', 500, `${chemin.join('/')} n’est pas du JSON valide`);
  }
}

/** Liste récursive des `.json` d'un dossier, en chemins relatifs à la racine. */
async function lister(dossier: string, racine: string): Promise<string[]> {
  const sortie: string[] = [];
  const entrees = await readdir(dossier, { withFileTypes: true });
  for (const e of entrees) {
    const complet = path.join(dossier, e.name);
    const relatif = path.relative(racine, complet).split(path.sep).join('/');
    if (estSecret(relatif)) continue;
    if (e.isDirectory()) sortie.push(...await lister(complet, racine));
    else if (e.name.endsWith('.json')) sortie.push(relatif);
  }
  return sortie.sort();
}
