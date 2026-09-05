/**
 * `GET /api/routines/catalogue/unites?statut=<statut>` — le catalogue d'unités
 * actif et la `catalogueVersion` courante (`05-routines.md` §9.4).
 *
 * Lecture seule, servie à `atlas_map` et `atlas_controle`. Les dix unités canon
 * embarquées dans `content/unites.json` sont **fusionnées** avec les lignes de la
 * base, jamais remplacées par elles : une partie hors ligne joue au moins les dix.
 */

import { chargerCatalogueUnites } from '@/content/index';
import { unites } from '@/db/requetes/index';
import { catalogueVersion } from '@/serveur/cycle';
import { erreur, json } from '@/serveur/reponses';
import { routeRoutine } from '@/serveur/routes';
import { STATUTS_UNITE, type StatutUnite, type UnitType } from '@/schemas/index';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = routeRoutine(async (requete) => {
  const brut = new URL(requete.url).searchParams.get('statut');
  if (brut !== null && !(STATUTS_UNITE as readonly string[]).includes(brut)) {
    return erreur('statut_inconnu', 400, `statut attendu parmi : ${STATUTS_UNITE.join(', ')}`);
  }
  const filtre = brut as StatutUnite | null;

  const canon = chargerCatalogueUnites();
  const enBase = await unites.catalogue();
  const parCle = new Map<string, UnitType>();
  for (const u of canon.unites) parCle.set(u.cle, u);
  for (const l of enBase) parCle.set(l.cle, { ...l.donnees, statut: l.statut });

  const catalogue = [...parCle.values()]
    .filter((u) => (filtre === null ? true : u.statut === filtre))
    .sort((a, b) => (a.cle < b.cle ? -1 : 1));

  return json({
    catalogueVersion: await catalogueVersion(),
    count: catalogue.length,
    actives: catalogue.filter((u) => u.statut !== 'retiree').length,
    unites: catalogue,
  });
});
