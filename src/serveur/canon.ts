/**
 * Règles de service du canon (`GET /api/canon/[...chemin]`).
 *
 * Une seule règle vit ici, et elle est là pour être testable : **le registre des
 * secrets n'est jamais servi**. La garantie principale est structurelle — la route
 * ne sert que `content/`, donc `doc/14-secrets.md` lui est inaccessible par
 * construction. Ceci en est la seconde barrière : si un fichier de `content/` venait
 * un jour à porter un secret, il serait refusé ici plutôt que servi à une routine.
 * Une routine qui ne connaît pas un secret ne peut pas l'écrire dans un dialogue.
 */

/**
 * Préfixes de `content/` interdits de service, en chemins relatifs à la racine du
 * canon. Rien ne porte ces noms aujourd'hui : c'est une interdiction, pas un filtre.
 */
export const PREFIXES_SECRETS = ['secrets', 'personnages'] as const;

/**
 * Vrai si ce chemin, relatif à la racine du canon, relève du registre des secrets.
 *
 * Attrape le dossier (`secrets/…`), le fichier (`secrets.json`) et les variantes
 * datées ou suffixées (`secrets-2026.json`, `secrets_easter.json`), sans confondre
 * avec un mot qui commence pareil (`secretariat.json` passe). Seule la racine du
 * canon est filtrée : un `cartes/secrets.json` n'est pas un registre de secrets, et
 * s'il en devenait un, ce serait une décision humaine à inscrire ici.
 */
export function estSecret(relatif: string): boolean {
  const normalise = relatif.replace(/\\/g, '/').toLowerCase();
  return PREFIXES_SECRETS.some((p) => normalise === p
    || normalise.startsWith(`${p}/`)
    || normalise.startsWith(`${p}.`)
    || normalise.startsWith(`${p}-`)
    || normalise.startsWith(`${p}_`));
}
