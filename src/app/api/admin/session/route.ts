/**
 * `POST /api/admin/session` — ouverture et fermeture de la session d'administration.
 *
 * Le mot de passe est comparé en temps constant, la session est un jeton signé en
 * HMAC-SHA-256 avec `AUTH_SECRET`, valable douze heures. La réponse est une
 * redirection : l'administration fonctionne sans une ligne de JavaScript client.
 */

import { cookieFermeture, cookieOuverture, DUREE_SESSION_MS, motDePasseAdminValide, signerSession } from '@/serveur/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function redirection(vers: string, cookie?: string): Response {
  const entetes: Record<string, string> = { location: vers, 'cache-control': 'no-store' };
  if (cookie) entetes['set-cookie'] = cookie;
  return new Response(null, { status: 303, headers: entetes });
}

export async function POST(requete: Request): Promise<Response> {
  const url = new URL(requete.url);
  if (url.searchParams.get('methode') === 'fermer') {
    return redirection('/admin/login', cookieFermeture());
  }

  if (!process.env['AUTH_SECRET'] || !process.env['ADMIN_PASSWORD']) {
    return redirection('/admin/login?erreur=configuration');
  }

  const formulaire = await requete.formData();
  const propose = String(formulaire.get('motDePasse') ?? '');
  if (!motDePasseAdminValide(propose)) {
    return redirection('/admin/login?erreur=mot_de_passe');
  }

  const jeton = signerSession({ sujet: 'admin', expire: Date.now() + DUREE_SESSION_MS });
  return redirection('/admin', cookieOuverture(jeton));
}
