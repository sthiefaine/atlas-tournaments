/** Utilitaires partagés par les requêtes : identifiants, dates, empreintes. */

import { createHash, randomBytes } from 'node:crypto';

/** Identifiant opaque et court, préfixé par domaine : `msn_7Q2f…`. */
export function identifiant(prefixe: string): string {
  return `${prefixe}_${randomBytes(9).toString('base64url')}`;
}

/** Empreinte SHA-256 complète, en hexadécimal minuscule. */
export function empreinte(texte: string): string {
  return createHash('sha256').update(texte, 'utf8').digest('hex');
}

/** Empreinte SHA-256 tronquée à 16 caractères : le `sourceHash` de `09-i18n.md` §2.2. */
export function empreinteCourte(texte: string): string {
  return empreinte(texte).slice(0, 16);
}

/** Le jour courant en ISO (AAAA-MM-JJ), en UTC. */
export function jourIso(quand: Date = new Date()): string {
  return quand.toISOString().slice(0, 10);
}

/** Ajoute `n` jours à une date ISO et rend le résultat en ISO. */
export function ajouterJours(jour: string, n: number): string {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
