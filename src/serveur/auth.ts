/**
 * Authentification du serveur, deux mécanismes distincts et jamais interchangeables :
 *
 * 1. **Les routines** présentent `Authorization: Bearer $CRON_SECRET` sur tous les
 *    appels `/api/routines/*`. La comparaison est en **temps constant** : un secret
 *    comparé caractère par caractère se devine, un octet à la fois.
 * 2. **L'administration humaine** présente un cookie de session signé en HMAC-SHA-256
 *    avec `AUTH_SECRET`. Le `CRON_SECRET` n'ouvre aucune route d'administration, et la
 *    session d'administration n'ouvre aucune route de routine
 *    (`05-routines.md` §7.2 : `PATCH /api/routines/catalogue/unites/{cle}` est la seule
 *    route de cette table interdite aux routines, et c'est cette séparation qui la tient).
 *
 * Aucun état en base : la session est un jeton signé, borné dans le temps. Se
 * déconnecter, c'est effacer le cookie ; faire tomber toutes les sessions, c'est
 * changer `AUTH_SECRET`.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import { erreur } from './reponses';

/** Nom du cookie de session d'administration. */
export const COOKIE_ADMIN = 'atlas_admin';

/** Durée de vie d'une session d'administration : douze heures. */
export const DUREE_SESSION_MS = 12 * 60 * 60 * 1000;

/**
 * Comparaison en temps constant de deux chaînes. Les deux valeurs sont d'abord
 * réduites à une empreinte de taille fixe, pour que la **longueur** du secret ne
 * fuie pas non plus.
 */
export function egalConstant(a: string, b: string): boolean {
  const cle = 'atlas.comparaison';
  const ha = createHmac('sha256', cle).update(a, 'utf8').digest();
  const hb = createHmac('sha256', cle).update(b, 'utf8').digest();
  return timingSafeEqual(ha, hb);
}

/** Extrait le jeton d'un en-tête `Authorization: Bearer …`. */
export function jetonPorteur(entete: string | null): string | null {
  if (!entete) return null;
  const m = /^Bearer[ ]+(.+)$/.exec(entete.trim());
  return m && m[1] ? m[1].trim() : null;
}

/**
 * Vérifie le secret des routines. Un `CRON_SECRET` absent ou vide **refuse tout** :
 * une variable oubliée ne doit pas ouvrir l'API, elle doit la fermer.
 */
export function secretRoutineValide(entete: string | null, secret = process.env['CRON_SECRET']): boolean {
  if (!secret) return false;
  const jeton = jetonPorteur(entete);
  if (!jeton) return false;
  return egalConstant(jeton, secret);
}

/** Garde des routes `/api/routines/*` : rend `null` si l'appel passe, une `401` sinon. */
export function exigerRoutine(requete: Request): Response | null {
  if (secretRoutineValide(requete.headers.get('authorization'))) return null;
  // Un appel non authentifié répond 401 sans corps (`05-routines.md` §7.2).
  return new Response(null, { status: 401 });
}

// ---------------------------------------------------------------------------
// Session d'administration
// ---------------------------------------------------------------------------

/** Charge utile d'un jeton de session. */
export interface SessionAdmin {
  sujet: string;
  expire: number;
}

function base64url(donnees: Buffer | string): string {
  return Buffer.from(donnees).toString('base64url');
}

function signature(charge: string, secret: string): string {
  return createHmac('sha256', secret).update(charge, 'utf8').digest('base64url');
}

/** Signe une session : `<charge>.<signature>`, tout en base64url. */
export function signerSession(
  session: SessionAdmin,
  secret = process.env['AUTH_SECRET'] ?? '',
): string {
  if (!secret) throw new Error('AUTH_SECRET manquant : impossible de signer une session.');
  const charge = base64url(JSON.stringify(session));
  return `${charge}.${signature(charge, secret)}`;
}

/**
 * Vérifie un jeton de session. Rend la session si la signature tient **et** que
 * l'expiration n'est pas passée ; `null` dans tous les autres cas — jeton mal
 * formé, signature fausse, secret absent, session périmée.
 */
export function verifierSession(
  jeton: string | null | undefined,
  secret = process.env['AUTH_SECRET'] ?? '',
  maintenant = Date.now(),
): SessionAdmin | null {
  if (!jeton || !secret) return null;
  const point = jeton.lastIndexOf('.');
  if (point <= 0) return null;
  const charge = jeton.slice(0, point);
  const signee = jeton.slice(point + 1);
  if (!egalConstant(signee, signature(charge, secret))) return null;
  try {
    const brut: unknown = JSON.parse(Buffer.from(charge, 'base64url').toString('utf8'));
    if (typeof brut !== 'object' || brut === null) return null;
    const o = brut as Record<string, unknown>;
    if (typeof o['sujet'] !== 'string' || typeof o['expire'] !== 'number') return null;
    if (o['expire'] <= maintenant) return null;
    return { sujet: o['sujet'], expire: o['expire'] };
  } catch {
    return null;
  }
}

/** Vérifie le mot de passe d'administration, en temps constant. */
export function motDePasseAdminValide(propose: string, attendu = process.env['ADMIN_PASSWORD']): boolean {
  if (!attendu) return false;
  return egalConstant(propose, attendu);
}

/** Lit un cookie dans un en-tête `Cookie:` brut. */
export function lireCookie(entete: string | null, nom: string): string | null {
  if (!entete) return null;
  for (const morceau of entete.split(';')) {
    const i = morceau.indexOf('=');
    if (i < 0) continue;
    if (morceau.slice(0, i).trim() === nom) return decodeURIComponent(morceau.slice(i + 1).trim());
  }
  return null;
}

/** La session portée par une requête, ou `null`. */
export function sessionDe(requete: Request): SessionAdmin | null {
  return verifierSession(lireCookie(requete.headers.get('cookie'), COOKIE_ADMIN));
}

/** Garde des routes réservées à un humain : rend `null` si l'appel passe, une `403` sinon. */
export function exigerAdmin(requete: Request): Response | null {
  if (sessionDe(requete)) return null;
  return erreur('session_admin_requise', 403, 'cette route exige une session d’administration humaine');
}

/** L'en-tête `Set-Cookie` d'ouverture de session. */
export function cookieOuverture(jeton: string, secure = process.env.NODE_ENV === 'production'): string {
  const attributs = [
    `${COOKIE_ADMIN}=${encodeURIComponent(jeton)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(DUREE_SESSION_MS / 1000)}`,
  ];
  if (secure) attributs.push('Secure');
  return attributs.join('; ');
}

/** L'en-tête `Set-Cookie` de fermeture de session. */
export function cookieFermeture(): string {
  return `${COOKIE_ADMIN}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
