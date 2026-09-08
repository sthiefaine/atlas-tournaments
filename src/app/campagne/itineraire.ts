/**
 * Ce que le fil de la campagne calcule, sans React et sans DOM.
 *
 * Le carnet (`carnet.tsx`) ne fait plus que peindre : l'état d'une station, la
 * station qui s'ouvre par défaut et le nom court d'une épreuve sont ici, purs,
 * et vérifiés par `tests/campagne/itineraire.test.ts`. C'est la règle du dépôt —
 * `parties-libres.ts` fait exactement pareil pour la page `/jeu`.
 */

/** L'état d'une station de l'itinéraire, dans l'ordre où il se lit. */
export type EtatStation = 'gagnee' | 'ouverte' | 'verrouillee';

/**
 * Le nom court d'une épreuve : ce qui suit le dernier point médian quand le
 * titre en porte un — « Entraînement 1 · Premier contact » devient « Premier
 * contact ». Sur une station large de cent pixels, le rang est déjà dit par le
 * losange, et le répéter mangerait la seule ligne disponible.
 */
export function nomCourt(titre: string): string {
  const morceaux = titre.split('·');
  const dernier = morceaux[morceaux.length - 1] ?? titre;
  const court = dernier.trim();
  return court === '' ? titre.trim() : court;
}

/**
 * L'état d'une station.
 *
 * `pret` dit si la progression du navigateur a été lue. Tant qu'elle ne l'est
 * pas — le rendu du serveur —, on affirme le **neutre** : la première épreuve
 * est ouverte, les autres attendent. C'est vrai dans tous les cas, y compris
 * pour qui a déjà tout remporté, alors qu'annoncer « remportée » puis se raviser
 * se lirait comme une progression perdue.
 */
export function etatStation(
  codes: readonly string[], index: number, victoires: readonly string[], pret: boolean,
): EtatStation {
  const code = codes[index];
  if (code === undefined) return 'verrouillee';
  if (victoires.includes(code)) return 'gagnee';
  if (!pret) return index === 0 ? 'ouverte' : 'verrouillee';
  const precedent = codes[index - 1];
  return index === 0 || (precedent !== undefined && victoires.includes(precedent))
    ? 'ouverte'
    : 'verrouillee';
}

/**
 * La station ouverte à l'arrivée : la première non remportée, c'est-à-dire ce
 * que le joueur vient chercher neuf fois sur dix. Tout remporté, on revient à
 * la première — il n'y a plus de « prochaine », et un carnet vide serait pire.
 */
export function stationParDefaut(codes: readonly string[], victoires: readonly string[]): number {
  const index = codes.findIndex((c) => !victoires.includes(c));
  return index >= 0 ? index : 0;
}

/**
 * L'état de **toutes** les stations, en un appel.
 *
 * Le carnet comptait les victoires d'un côté (pour la jauge) et peignait les
 * stations de l'autre (par `etatStation`) : deux façons de compter la même
 * chose, donc deux occasions de ne pas dire pareil. La jauge se lit désormais
 * sur ce tableau — le nombre de stations `gagnee` —, et il n'y a plus qu'une
 * source.
 */
export function etatsItineraire(
  codes: readonly string[], victoires: readonly string[], pret: boolean,
): EtatStation[] {
  return codes.map((_, i) => etatStation(codes, i, victoires, pret));
}
