/**
 * `GET /api/i18n/[locale]` — le bundle de traduction d'une langue
 * (`09-i18n.md` §7.4, `02-architecture.md` §3.5).
 *
 * Un objet plat `{ cleChaine: texte }`, **replis déjà appliqués** côté serveur
 * (`locale → en → fr`) : le client reçoit un dictionnaire complet et ne rencontre
 * aucun trou. Le bundle est immuable pour une `chainesVersion` donnée, donc
 * cachable indéfiniment quand `?v=` est fourni.
 */

import { chainesVersion } from '@/serveur/cycle';
import { erreur, json } from '@/serveur/reponses';
import { routePublique } from '@/serveur/routes';
import { localesReq, traductions } from '@/db/requetes/index';
import { REGEX_CODE_LOCALE } from '@/schemas/index';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  requete: Request,
  contexte: { params: Promise<{ locale: string }> },
): Promise<Response> {
  const { locale: brut } = await contexte.params;
  const locale = brut.replace(/\.json$/, '').toLowerCase();
  if (!REGEX_CODE_LOCALE.test(locale)) {
    return erreur('locale_invalide', 400, 'code BCP 47 en minuscules attendu');
  }
  return routePublique(async () => {
    const connue = await localesReq.locale(locale);
    if (!connue) return erreur('locale_inconnue', 404, `la langue ${locale} n’existe pas`);
    const dictionnaire = await traductions.bundle(locale);
    const version = await chainesVersion();
    const demandee = new URL(requete.url).searchParams.get('v');
    // Un bundle demandé par version est figé : il ne changera jamais.
    const cache = demandee !== null && demandee === String(version)
      ? 'public, max-age=31536000, immutable'
      : 'no-store';
    return json(
      { locale, chainesVersion: version, count: Object.keys(dictionnaire).length, chaines: dictionnaire },
      200,
      { 'cache-control': cache },
    );
  })(requete);
}
