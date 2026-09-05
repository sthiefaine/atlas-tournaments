/**
 * Lecture de la session d'administration depuis un composant serveur.
 *
 * Le cookie est signé en HMAC (`src/serveur/auth.ts`) : il n'y a pas de table de
 * sessions, donc rien à interroger. Se déconnecter, c'est effacer le cookie ;
 * faire tomber toutes les sessions, c'est changer `AUTH_SECRET`.
 */

import { cookies } from 'next/headers';

import { COOKIE_ADMIN, verifierSession, type SessionAdmin } from '@/serveur/auth';

/** La session courante, ou `null`. */
export async function sessionCourante(): Promise<SessionAdmin | null> {
  const magasin = await cookies();
  return verifierSession(magasin.get(COOKIE_ADMIN)?.value);
}
