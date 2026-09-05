/**
 * `PATCH /api/routines/catalogue/unites/{cle}` — changement de statut
 * d'homologation.
 *
 * **La seule route de cette table interdite aux routines** : elle exige une session
 * d'administration humaine, le `CRON_SECRET` ne l'ouvre pas (`05-routines.md`
 * §7.2). Chaque transition incrémente `catalogueVersion` — un changement qui
 * n'incrémente pas est un bug de serveur, pas une optimisation.
 *
 * Transitions acceptées : `valide → essai`, `essai → homologuee`, `essai → retiree`,
 * `homologuee → retiree`. `canon → *` est refusée **toujours**.
 */

import { unites } from '@/db/requetes/index';
import { communs } from '@/db/requetes/index';
import {
  catalogueSature, incrementerCatalogueVersion, JOURS_ESSAI, transitionUniteAutorisee,
} from '@/serveur/cycle';
import { erreur, json, lireJson } from '@/serveur/reponses';
import { routeAdmin } from '@/serveur/routes';
import { STATUTS_UNITE, type StatutUnite } from '@/schemas/index';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(
  requete: Request,
  contexte: { params: Promise<{ cle: string }> },
): Promise<Response> {
  const { cle } = await contexte.params;
  return routeAdmin(async (req) => {
    const ligne = await unites.unite(cle);
    if (!ligne) return erreur('unite_inconnue', 404, `l’unité ${cle} n’existe pas`);

    const corps = await lireJson(req);
    if (!corps.ok) return corps.reponse;
    const brut = (corps.valeur as Record<string, unknown>)['statut'];
    if (typeof brut !== 'string' || !(STATUTS_UNITE as readonly string[]).includes(brut)) {
      return erreur('statut_inconnu', 422, `statut attendu parmi : ${STATUTS_UNITE.join(', ')}`);
    }
    const vers = brut as StatutUnite;

    const decision = transitionUniteAutorisee(ligne.statut, vers, ligne.statutCycle, 'humain');
    if (!decision.ok) return erreur(decision.code, 409, decision.detail);

    if (vers === 'essai' && await catalogueSature()) {
      return erreur('catalogue_plein', 409, 'le catalogue est plafonné à 24 unités actives');
    }

    const version = await incrementerCatalogueVersion();
    const jour = communs.jourIso();
    const ok = await unites.changerStatutCatalogue({
      cle,
      statut: vers,
      catalogueVersion: version,
      ...(vers === 'essai'
        ? { essaiJusquAu: communs.ajouterJours(jour, JOURS_ESSAI), statutCycle: 'en_ligne' as const }
        : {}),
      ...(vers === 'homologuee' ? { homologueeLe: jour } : {}),
    });
    if (!ok) return erreur('transition_interdite', 409, 'une unité canon ne change jamais de statut');

    return json({ cle, statut: vers, catalogueVersion: version });
  })(requete);
}
