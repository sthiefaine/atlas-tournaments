/**
 * L'emballage des images d'une entrée en pages d'atlas. Pur.
 *
 * Des étagères : les images, triées par hauteur décroissante, se rangent de
 * gauche à droite sur une étagère aussi haute que la première ; une étagère
 * pleine en ouvre une autre dessous, une page pleine une autre page. Pour des
 * images de tailles voisines — les images d'un même modèle —, c'est à
 * quelques pour cent de l'optimum, et le résultat se lit d'un coup d'œil.
 *
 * La largeur de page est essayée parmi quelques puissances de deux et retenue
 * au plus petit nombre de pages, puis à la plus petite surface. Les pages sont
 * ensuite rognées au multiple de quatre supérieur : WebGL 2 prend des textures
 * de toute taille, et une page à moitié vide ne pèse rien de moins.
 */

export interface Taille { l: number; h: number }

export interface Placement { page: number; x: number; y: number }

export interface Emballage {
  placements: Placement[];
  pages: { largeur: number; hauteur: number }[];
}

function multipleDe4(n: number): number {
  return Math.ceil(n / 4) * 4;
}

function essayer(tailles: readonly Taille[], ordre: readonly number[], largeur: number, max: number, espacement: number): Emballage | null {
  const placements: Placement[] = new Array(tailles.length);
  const pages: { largeur: number; hauteur: number }[] = [];
  let page = 0;
  let x = 0;
  let y = 0;
  let etagere = 0;
  let largeurUtilisee = 0;
  let hauteurUtilisee = 0;
  const fermer = (): void => {
    pages.push({ largeur: multipleDe4(largeurUtilisee), hauteur: multipleDe4(hauteurUtilisee) });
  };
  for (const i of ordre) {
    const t = tailles[i]!;
    if (t.l > largeur || t.h > max) return null;
    if (x > 0 && x + t.l > largeur) {
      y += etagere + espacement;
      x = 0;
      etagere = 0;
    }
    if (y + t.h > max) {
      fermer();
      page++;
      x = 0;
      y = 0;
      etagere = 0;
      largeurUtilisee = 0;
      hauteurUtilisee = 0;
    }
    placements[i] = { page, x, y };
    largeurUtilisee = Math.max(largeurUtilisee, x + t.l);
    hauteurUtilisee = Math.max(hauteurUtilisee, y + t.h);
    etagere = Math.max(etagere, t.h);
    x += t.l + espacement;
  }
  if (tailles.length > 0) fermer();
  return { placements, pages };
}

/**
 * Range `tailles` dans des pages d'au plus `max × max`. Lève si une image est
 * plus grande qu'une page : cela ne peut venir que d'un canevas faux.
 */
export function emballer(tailles: readonly Taille[], max: number, espacement: number): Emballage {
  if (tailles.length === 0) return { placements: [], pages: [] };
  const ordre = tailles.map((_, i) => i).sort((a, b) => tailles[b]!.h - tailles[a]!.h || tailles[b]!.l - tailles[a]!.l || a - b);
  let meilleur: Emballage | null = null;
  let surfaceMeilleure = Infinity;
  for (let largeur = 256; largeur <= max; largeur *= 2) {
    const e = essayer(tailles, ordre, largeur, max, espacement);
    if (!e) continue;
    const surface = e.pages.reduce((s, p) => s + p.largeur * p.hauteur, 0);
    if (!meilleur || e.pages.length < meilleur.pages.length || (e.pages.length === meilleur.pages.length && surface < surfaceMeilleure)) {
      meilleur = e;
      surfaceMeilleure = surface;
    }
  }
  if (!meilleur) {
    const trop = tailles.find((t) => t.l > max || t.h > max);
    throw new Error(`une image de ${trop?.l}×${trop?.h} ne tient pas dans une page de ${max}×${max}`);
  }
  return meilleur;
}
