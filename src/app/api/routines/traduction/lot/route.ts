/**
 * `GET /api/routines/traduction/lot?locale=<code>&limite=<n>` — le lot de chaînes
 * à traduire (`09-i18n.md` §8.2).
 *
 * On y sert la locale, son **registre** (extrait du prompt métier et recopié ici,
 * pour que la routine n'ait pas à relire son propre prompt), le **glossaire** de la
 * langue, et les chaînes manquantes puis périmées. Pour une chaîne périmée,
 * l'ancienne traduction est jointe : le français a bougé d'un mot, la traduction ne
 * repart pas de zéro.
 *
 * **Sans glossaire, aucun lot n'est servi** (`error: glossaire_absent`).
 */

import { glossaires, localesReq, traductions } from '@/db/requetes/index';
import { entierBorne, erreur, json } from '@/serveur/reponses';
import { routeRoutine } from '@/serveur/routes';
import { BORNES_LOT, categoriesPluriel } from '@/serveur/traduction';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = routeRoutine(async (requete) => {
  const params = new URL(requete.url).searchParams;
  const code = (params.get('locale') ?? '').toLowerCase();
  if (code === '') return erreur('locale_manquante', 400, 'paramètre ?locale= attendu');
  if (code === 'fr') return erreur('locale_source', 422, 'le français est la source : il ne se traduit pas');

  const locale = await localesReq.locale(code);
  if (!locale) return erreur('locale_inconnue', 404, `la langue ${code} n’existe pas`);

  const glossaire = await glossaires.glossaire(code);
  if (!glossaire) {
    return erreur('glossaire_absent', 409, `content/i18n/glossaire.${code}.json manque : aucun lot n’est servi`);
  }

  const limite = entierBorne(params.get('limite'), BORNES_LOT.defaut, BORNES_LOT.min, BORNES_LOT.max);
  await traductions.semer(code);
  const chaines = await traductions.lot(code, limite);

  return json({
    locale: {
      code: locale.code,
      nom: locale.nom,
      script: locale.script,
      sens: locale.sens,
      statut: locale.statut,
      facteurLongueur: Number(locale.facteurLongueur),
    },
    registre: locale.registre,
    glossaire: { termesInterdits: glossaire.termesInterdits, entrees: glossaire.entrees },
    count: chaines.length,
    chaines: chaines.map((c) => ({
      ...c,
      ...(c.pluriel ? { categoriesPluriel: categoriesPluriel(code) } : {}),
    })),
  });
});
