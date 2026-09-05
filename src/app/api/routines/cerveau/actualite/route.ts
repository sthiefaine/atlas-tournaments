/**
 * `GET /api/routines/cerveau/actualite[?jour=<date>]` — **la seule source
 * d'actualité du projet** (`05-routines.md` §5.2 et §5.5).
 *
 * La routine ne navigue pas, ne cherche rien en ligne, ne connaît pas d'autre
 * domaine : les items sont servis ici, déjà filtrés par catégorie. La routine est
 * la seconde barrière, pas la première.
 *
 * Avec `?jour=`, c'est le volet dépêche : l'échéance, le quota du jour et les items
 * déjà employés dans les 30 derniers jours, pour qu'aucun ne resserve.
 */

import { evenements } from '@/db/requetes/index';
import { communs } from '@/db/requetes/index';
import { echeance, jourLocal, passee } from '@/serveur/depeche';
import { json } from '@/serveur/reponses';
import { routeRoutine } from '@/serveur/routes';
import { REGEX_DATE_ISO } from '@/schemas/index';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = routeRoutine(async (requete) => {
  const brut = new URL(requete.url).searchParams.get('jour');

  if (brut !== null && REGEX_DATE_ISO.test(brut)) {
    const jour = brut;
    const deja = await evenements.depecheDuJour(jour);
    return json({
      jour,
      echeance: echeance(jour, 'proposition').toISOString(),
      quota_restant: deja ? 0 : 1,
      echeance_passee: passee(jour, 'proposition'),
      items: (await evenements.itemsDuJour(jour)).map(habiller),
      deja_utilises_30j: await evenements.itemsUtilises(30),
    });
  }

  const du = jourLocal();
  const au = communs.ajouterJours(du, 42);
  return json({
    fenetre: { du, au },
    items: (await evenements.itemsEntre(du, au)).map(habiller),
  });
});

/** Un item servi à la routine : pré-filtré, sans lien externe à suivre. */
function habiller(item: { id: string; categorie: string; titre: string; date: string; source: string; pays: string[] }) {
  return {
    id: item.id,
    categorie: item.categorie,
    titre: item.titre,
    date: item.date,
    source: item.source,
    pays: item.pays,
  };
}
