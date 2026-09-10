/**
 * Le **gras** dans les textes du jeu.
 *
 * Les scénaristes écrivent `**texte**` dans les répliques, les récits de la
 * campagne et les annonces ; c'est la seule marque autorisée, et elle ne se
 * rend jamais par un `innerHTML` posé sur le texte brut. On **segmente**
 * d'abord, puis chaque exécutant construit ses nœuds : la scène de dialogue une
 * lettre à la fois, le HUD une balise, la page un composant.
 *
 * Tolérance : un `**` ouvert et jamais refermé n'est pas une faute qui casse
 * l'écran — il se rend **tel quel**, étoiles comprises, pour que le scénariste
 * le voie et le corrige. Un `****` (gras vide) ne produit rien.
 */

/** Un morceau de texte, gras ou non. */
export interface Segment {
  texte: string;
  gras: boolean;
}

/** La marque du gras, telle qu'elle s'écrit dans le canon. */
export const MARQUE_GRAS = '**';

/** Découpe un texte en segments, en respectant les `**` appariés. */
export function segmenter(texte: string): Segment[] {
  const segments: Segment[] = [];
  const pousser = (t: string, gras: boolean): void => {
    if (t === '') return;
    const dernier = segments[segments.length - 1];
    if (dernier && dernier.gras === gras) dernier.texte += t;
    else segments.push({ texte: t, gras });
  };
  let i = 0;
  while (i < texte.length) {
    const ouverture = texte.indexOf(MARQUE_GRAS, i);
    if (ouverture === -1) {
      pousser(texte.slice(i), false);
      break;
    }
    const fermeture = texte.indexOf(MARQUE_GRAS, ouverture + MARQUE_GRAS.length);
    if (fermeture === -1) {
      // Ouvert, jamais refermé : le reste se lit tel quel, étoiles comprises.
      pousser(texte.slice(i), false);
      break;
    }
    pousser(texte.slice(i, ouverture), false);
    pousser(texte.slice(ouverture + MARQUE_GRAS.length, fermeture), true);
    i = fermeture + MARQUE_GRAS.length;
  }
  return segments;
}

/** Le texte sans ses marques : pour un `title`, un `aria-label`, un journal. */
export function sansGras(texte: string): string {
  return segmenter(texte).map((s) => s.texte).join('');
}

/**
 * Le HTML d'un texte segmenté : chaque morceau échappé par l'appelant — le
 * HUD et la scène ont chacun leur `ech`, et ce module n'en impose pas un
 * troisième —, le gras dans un `<strong>`. Rien d'autre n'est jamais injecté.
 */
export function htmlGras(texte: string, echapper: (s: string) => string): string {
  return segmenter(texte)
    .map((s) => (s.gras ? `<strong>${echapper(s.texte)}</strong>` : echapper(s.texte)))
    .join('');
}
