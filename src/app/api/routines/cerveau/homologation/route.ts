/**
 * `GET /api/routines/cerveau/homologation` — le contexte complet de proposition
 * d'une unité (`05-routines.md` §5.6).
 *
 * On y sert tout ce qui **ferme** le champ des possibles : le catalogue courant et
 * sa version, la table de dégâts, les listes fermées de traits et de pièces de
 * silhouette, le plafond, les quotas, et l'historique des candidates rejetées —
 * une routine qui a proposé un obusier trop fort en août ne doit pas le reproposer
 * en septembre sous un autre nom.
 */

import { chargerCatalogueUnites, chargerDegats } from '@/content/index';
import { reviews, unites } from '@/db/requetes/index';
import { catalogueVersion, JOURS_ESSAI, PLAFOND_CATALOGUE } from '@/serveur/cycle';
import { json } from '@/serveur/reponses';
import { routeRoutine } from '@/serveur/routes';
import {
  BASES_SILHOUETTE, CORPS_SILHOUETTE, MODULES_SILHOUETTE, TAILLES_SILHOUETTE, TRAITS,
} from '@/schemas/index';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = routeRoutine(async () => {
  const canon = chargerCatalogueUnites();
  const enBase = await unites.catalogue();
  const actives = await unites.actives();

  const semaine = new Date(Date.now() - 7 * 86_400_000);
  const debutMois = new Date().toISOString().slice(0, 8) + '01';

  const rejetees = (await reviews.derniers(60))
    .filter((r) => r.cibleType === 'unite' && r.verdict === 'rejete')
    .slice(0, 10)
    .map((r) => ({
      cle: r.cibleCle,
      date: r.createdAt.toISOString().slice(0, 10),
      motifs: r.codesMotifs,
      mesure: r.motifs[0]?.mesure ?? {},
    }));

  const table = chargerDegats();
  return json({
    catalogueVersion: await catalogueVersion(),
    plafond: {
      actives_max: PLAFOND_CATALOGUE,
      actives_courantes: Math.max(actives, canon.unites.length),
      canon_intouchables: canon.unites.length,
    },
    quota: {
      candidates_restantes_cette_semaine: Math.max(0, 1 - await unites.candidatesDepuis(semaine)),
      homologations_restantes_ce_mois: Math.max(0, 1 - await unites.homologationsDepuis(debutMois)),
    },
    jours_essai: JOURS_ESSAI,
    catalogue: [
      ...canon.unites,
      ...enBase.map((u) => ({ ...u.donnees, statut: u.statut, essai_jusqu_au: u.essaiJusquAu })),
    ],
    tableDegats: { lignes: table.unites, colonnes: table.unites, valeurs: table.matrice },
    traitsDisponibles: TRAITS,
    silhouettePieces: {
      base: BASES_SILHOUETTE,
      corps: CORPS_SILHOUETTE,
      modules: MODULES_SILHOUETTE,
      taille: TAILLES_SILHOUETTE,
    },
    technologies: [],
    candidates_rejetees: rejetees,
  });
});
