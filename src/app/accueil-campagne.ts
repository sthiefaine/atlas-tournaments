/**
 * Ce que le bouton **Campagne** de l'écran-titre calcule, sans React et sans
 * `localStorage` : où il mène, combien d'épreuves sont derrière soi, et ce que
 * dit sa sous-ligne.
 *
 * C'est la règle du dépôt — `jeu/parties-libres.ts` et `campagne/itineraire.ts`
 * font exactement pareil pour leurs écrans : l'îlot client (`menu-campagne.tsx`)
 * ne fait plus que peindre, et ces quatre décisions se vérifient par
 * `tsx --test` au lieu de se relire.
 *
 * La règle qui les traverse toutes : **`victoires` vaut `null` tant que le
 * navigateur n'a pas parlé**, ce qui n'est pas la même chose qu'un tableau vide.
 * Le rendu du serveur ne connaît aucune progression et doit affirmer un neutre
 * *vrai dans tous les cas* — « commencez ici », `/campagne` — plutôt qu'un
 * « 0 sur 6 » qui serait une affirmation fausse pour qui a tout remporté. Le
 * sens de l'hydratation est à sens unique : le serveur pose le neutre, le client
 * l'enrichit, jamais l'inverse.
 */

/** Une épreuve de la campagne, réduite à ce que l'écran-titre affiche. */
export interface Epreuve {
  cle: string;
  titre: string;
}

/**
 * Ce que la sous-ligne du bouton peut dire, déjà traduit par la page. `etat`
 * porte une entrée par nombre de victoires possible, l'épreuve interpolée : les
 * états sont énumérables, autant les énumérer plutôt que d'embarquer `t()` et
 * les 379 chaînes d'interface dans le lot de l'accueil.
 */
export interface LibellesEtat {
  neuf: string;
  fini: string;
  etat: readonly string[];
}

/** Les épreuves remportées parmi celles de la campagne. Zéro si rien n'est lu. */
export function nombreGagnees(
  epreuves: readonly Epreuve[], victoires: readonly string[] | null,
): number {
  if (victoires === null) return 0;
  return epreuves.filter((e) => victoires.includes(e.cle)).length;
}

/**
 * La première épreuve non remportée — celle que le joueur vient chercher neuf
 * fois sur dix. `null` quand tout est derrière soi, ou quand rien n'est lu.
 */
export function prochaineEpreuve(
  epreuves: readonly Epreuve[], victoires: readonly string[] | null,
): Epreuve | null {
  if (victoires === null) return null;
  return epreuves.find((e) => !victoires.includes(e.cle)) ?? null;
}

/**
 * Où mène le bouton : droit sur la prochaine épreuve, ou le carnet quand il n'y
 * en a plus. Le carnet est aussi la destination **neutre** du serveur : elle est
 * vraie dans tous les cas, et c'est la seule qui le soit.
 */
export function destinationCampagne(
  epreuves: readonly Epreuve[], victoires: readonly string[] | null,
): string {
  const prochaine = prochaineEpreuve(epreuves, victoires);
  return prochaine ? `/jeu/${prochaine.cle}` : '/campagne';
}

/** La sous-ligne du bouton : « commencez ici », l'épreuve en cours, ou « tout remporté ». */
export function sousLigneCampagne(
  libelles: LibellesEtat, epreuves: readonly Epreuve[], victoires: readonly string[] | null,
): string {
  const n = nombreGagnees(epreuves, victoires);
  if (victoires === null || n === 0) return libelles.neuf;
  if (n >= epreuves.length) return libelles.fini;
  return libelles.etat[n] ?? libelles.neuf;
}
