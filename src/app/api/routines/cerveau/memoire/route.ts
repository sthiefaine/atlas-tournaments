/**
 * `POST /api/routines/cerveau/memoire` — dépôt d'une `MemoryEntry`
 * (`05-routines.md` §5.3).
 *
 * Une entrée est **structurée, datée, sourcée, expirante**. Jamais un texte
 * cumulatif : le fichier de mémoire qui grossit indéfiniment est explicitement
 * proscrit. Le serveur déduplique avant insertion et applique le plafond de 200
 * entrées vivantes par portée.
 */

import { memoire } from '@/db/requetes/index';
import { erreur, json, lireJson } from '@/serveur/reponses';
import { routeRoutine } from '@/serveur/routes';
import { validerMemoryEntry } from '@/schemas/index';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Plafond d'entrées vivantes par portée. */
const PLAFOND_PORTEE = 200;

/** Durées de vie admises pour une entrée produite par une routine, en jours. */
const EXPIRATION_MAX_JOURS = 180;

export const POST = routeRoutine(async (requete) => {
  const corps = await lireJson(requete);
  if (!corps.ok) return corps.reponse;
  const brut = (corps.valeur as Record<string, unknown>)['entry'];
  if (typeof brut !== 'object' || brut === null) {
    return erreur('charge_invalide', 400, '{"entry": {…}} attendu');
  }

  const valide = validerMemoryEntry(brut);
  if (!valide.ok) {
    return json({
      accepte: [], refuse: [{ objet: 'entry', error: 'schema_invalide', chemins: valide.erreurs.map((e) => `${e.chemin || '(racine)'} — ${e.message}`) }],
    }, 422);
  }
  const entree = valide.valeur;

  // `expireLe` est obligatoire pour une routine : seul un humain écrit `null`.
  if (entree.expireLe === null) {
    return erreur('expiration_manquante', 422, 'une entrée produite par une routine expire toujours');
  }
  const jours = Math.round(
    (Date.parse(`${entree.expireLe}T00:00:00Z`) - Date.parse(`${entree.date}T00:00:00Z`)) / 86_400_000,
  );
  if (!Number.isFinite(jours) || jours <= 0 || jours > EXPIRATION_MAX_JOURS) {
    return erreur('expiration_hors_bornes', 422, `expireLe doit tomber entre 1 et ${EXPIRATION_MAX_JOURS} jours après la date`);
  }

  const vivantes = await memoire.compterVivantes(entree.portee);
  if (vivantes >= PLAFOND_PORTEE) {
    return erreur('portee_saturee', 409, `${PLAFOND_PORTEE} entrées vivantes au plus par portée`);
  }

  const { dedupliquee } = await memoire.deposer(entree);
  return json({
    accepte: ['entry'],
    refuse: [],
    dedupliquee,
    detail: dedupliquee ? 'entrée proche existante : occurrences incrémentées et expiration repoussée' : undefined,
  });
});
