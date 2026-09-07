/**
 * Rasteriseur d'aperçu : une `MapDef` en tuiles colorées de 16 px.
 *
 * Ce n'est **pas** le rendu du jeu, qui est la peau 3D de `render3d/` ; ici, on
 * veut une image qu'un humain ouvre en deux secondes pour dire « oui, ça
 * ressemble à une carte jouable ».
 * Les couleurs sont celles de la démo `doc/assets/atlas-render-vector.html`,
 * pour que l'aperçu et le jeu restent de la même famille.
 *
 * Ce sous-dossier n'importe que `schemas/` et `content/`, et ne touche pas au DOM.
 */

import { CARACTERES_CAPTURABLES, type CampId, type MapDef } from '../../schemas/types';
import {
  couleurHex, creerImage, disque, pixel, rectangle, triangle,
  type Image, type Rvb,
} from './png';

/** Côté d'une tuile, en pixels. */
export const TUILE = 16;

/** Couleurs de terrain, reprises de la démo de rendu. */
const COULEURS = {
  eau: couleurHex('#57b0ea'),
  eauSombre: couleurHex('#3b8fd4'),
  ecume: couleurHex('#8fd0f5'),
  herbe: couleurHex('#a3d96b'),
  herbeSombre: couleurHex('#7cb84f'),
  sable: couleurHex('#efe0a4'),
  route: couleurHex('#dccb9f'),
  routeSombre: couleurHex('#bda87c'),
  foret: couleurHex('#2f7a3c'),
  foretClaire: couleurHex('#43a253'),
  montagne: couleurHex('#8a7f6d'),
  montagneClaire: couleurHex('#c6bbaa'),
  riviere: couleurHex('#6fc2f0'),
  bois: couleurHex('#7a5232'),
  ombre: couleurHex('#5e6a4a'),
  trait: couleurHex('#33403a'),
  blanc: couleurHex('#ffffff'),
} as const;

/** Palette des camps, reprise de `ARMY` dans la démo de rendu. */
const CAMPS: readonly { main: Rvb; dark: Rvb; light: Rvb }[] = [
  { main: couleurHex('#3f86e0'), dark: couleurHex('#255a9e'), light: couleurHex('#8dbdf5') },
  { main: couleurHex('#e04b45'), dark: couleurHex('#96292a'), light: couleurHex('#f59a95') },
  { main: couleurHex('#37b35a'), dark: couleurHex('#1f6f38'), light: couleurHex('#8ee0a4') },
  { main: couleurHex('#e9b93a'), dark: couleurHex('#9c7717'), light: couleurHex('#f7dd8c') },
];

const NEUTRE = { main: couleurHex('#b9bec7'), dark: couleurHex('#7c828c'), light: couleurHex('#e2e5ea') };

/** Palette d'un camp, ou la palette neutre pour `null`. */
function paletteCamp(camp: CampId | null): { main: Rvb; dark: Rvb; light: Rvb } {
  return camp === null ? NEUTRE : (CAMPS[camp] ?? NEUTRE);
}

/** Fond d'une tuile : la couleur de base du terrain. */
function fondDe(car: string): Rvb {
  switch (car) {
    case 'W': return COULEURS.eau;
    case 'V': return COULEURS.riviere;
    case 'S': return COULEURS.sable;
    case 'R': case 'N': return COULEURS.route;
    case 'F': return COULEURS.foret;
    case 'M': return COULEURS.montagne;
    default: return COULEURS.herbe;
  }
}

/** Dessine le décor d'une tuile : ce qui n'est ni bâtiment ni unité. */
function decor(image: Image, car: string, px: number, py: number): void {
  const t = TUILE;
  switch (car) {
    case 'W':
      rectangle(image, px, py + t - 4, t, 4, COULEURS.eauSombre);
      rectangle(image, px + 3, py + 5, 5, 1, COULEURS.ecume);
      rectangle(image, px + 9, py + 10, 4, 1, COULEURS.ecume);
      break;
    case 'V':
      rectangle(image, px, py, t, 1, COULEURS.eauSombre);
      rectangle(image, px, py + t - 1, t, 1, COULEURS.eauSombre);
      rectangle(image, px + 4, py + 7, 6, 1, COULEURS.blanc);
      break;
    case 'F':
      disque(image, px + 5, py + 6, 3, COULEURS.foretClaire);
      disque(image, px + 11, py + 10, 3, COULEURS.foretClaire);
      rectangle(image, px + 4, py + 9, 2, 3, COULEURS.bois);
      rectangle(image, px + 10, py + 13, 2, 2, COULEURS.bois);
      break;
    case 'M':
      triangle(image, px + 8, py + t - 3, 13, 10, COULEURS.montagneClaire);
      triangle(image, px + 8, py + t - 3, 6, 5, COULEURS.blanc);
      break;
    case 'S':
      rectangle(image, px + 2, py + 4, 3, 1, COULEURS.herbeSombre);
      rectangle(image, px + 9, py + 11, 4, 1, COULEURS.herbeSombre);
      break;
    case 'R':
      rectangle(image, px, py, t, 1, COULEURS.routeSombre);
      rectangle(image, px, py + t - 1, t, 1, COULEURS.routeSombre);
      for (let x = 2; x < t - 2; x += 5) rectangle(image, px + x, py + 7, 3, 1, COULEURS.blanc);
      break;
    case 'N':
      rectangle(image, px, py, t, 2, COULEURS.bois);
      rectangle(image, px, py + t - 2, t, 2, COULEURS.bois);
      for (let x = 1; x < t - 1; x += 4) rectangle(image, px + x, py + 3, 2, t - 6, COULEURS.routeSombre);
      break;
    case 'P':
      rectangle(image, px + 3, py + 11, 3, 1, COULEURS.herbeSombre);
      rectangle(image, px + 10, py + 4, 3, 1, COULEURS.herbeSombre);
      break;
    case 'G': // hautes herbes : des touffes hautes, serrées, qui lisent « ça cache »
      for (let x = 2; x < t - 2; x += 4) {
        rectangle(image, px + x, py + 4, 1, 9, COULEURS.herbeSombre);
        rectangle(image, px + x + 1, py + 6, 1, 7, COULEURS.foretClaire);
      }
      break;
    default:
      break;
  }
}

/** Dessine un bâtiment aux couleurs de son camp, sur fond d'herbe. */
function batiment(image: Image, car: string, px: number, py: number, camp: CampId | null): void {
  const t = TUILE;
  const couleur = paletteCamp(camp);
  rectangle(image, px, py, t, t, COULEURS.herbe);
  switch (car) {
    case 'C': // ville : deux corps de bâtiment
      rectangle(image, px + 2, py + 6, 5, 8, couleur.dark);
      rectangle(image, px + 2, py + 5, 5, 2, couleur.main);
      rectangle(image, px + 8, py + 4, 6, 10, couleur.dark);
      rectangle(image, px + 8, py + 3, 6, 2, couleur.main);
      rectangle(image, px + 10, py + 7, 2, 2, couleur.light);
      break;
    case 'U': // usine : halle et cheminée
      rectangle(image, px + 2, py + 6, 12, 8, couleur.dark);
      rectangle(image, px + 2, py + 5, 12, 2, couleur.main);
      rectangle(image, px + 10, py + 2, 3, 5, couleur.dark);
      rectangle(image, px + 4, py + 9, 6, 3, couleur.light);
      break;
    case 'A': // aéroport : piste et manche à air
      rectangle(image, px + 1, py + 5, 14, 7, couleur.dark);
      rectangle(image, px + 2, py + 8, 12, 2, COULEURS.blanc);
      rectangle(image, px + 2, py + 6, 3, 2, couleur.light);
      break;
    case 'H': // QG : bloc massif, toit clair, fanion
      rectangle(image, px + 2, py + 5, 12, 9, couleur.dark);
      rectangle(image, px + 2, py + 4, 12, 2, couleur.main);
      rectangle(image, px + 5, py + 8, 6, 4, couleur.light);
      rectangle(image, px + 12, py + 1, 1, 4, COULEURS.trait);
      rectangle(image, px + 9, py + 1, 3, 2, couleur.main);
      break;
    case 'O': // port : un quai sur l'eau, deux bittes, une grue
      rectangle(image, px, py, t, t, COULEURS.eau);
      rectangle(image, px + 1, py + 7, 14, 7, couleur.dark);
      rectangle(image, px + 1, py + 6, 14, 2, couleur.main);
      rectangle(image, px + 3, py + 9, 2, 2, couleur.light);
      rectangle(image, px + 11, py + 9, 2, 2, couleur.light);
      rectangle(image, px + 7, py + 2, 1, 5, COULEURS.trait);
      rectangle(image, px + 7, py + 2, 5, 1, COULEURS.trait);
      break;
    case 'T': // station radar : un abri bas, un mât, une parabole
      rectangle(image, px + 3, py + 9, 10, 5, couleur.dark);
      rectangle(image, px + 3, py + 8, 10, 2, couleur.main);
      rectangle(image, px + 7, py + 3, 2, 6, COULEURS.trait);
      disque(image, px + 8, py + 4, 3, couleur.light);
      break;
    default:
      break;
  }
}

/** Options de rendu de l'aperçu. */
export interface OptionsRendu {
  /** Côté d'une tuile en pixels ; 16 par défaut. */
  tuile?: number;
  /** Trace un liseré de grille ; vrai par défaut. */
  grille?: boolean;
  /** Marque les unités de départ ; vrai par défaut. */
  unites?: boolean;
}

/**
 * Rend une carte en image. Une tuile = un caractère de grille ; les bâtiments
 * prennent la couleur de leur camp, gris quand ils sont neutres ; les unités de
 * départ sont marquées d'une pastille au centre de leur case.
 */
export function rasteriserCarte(map: MapDef, options: OptionsRendu = {}): Image {
  const t = options.tuile ?? TUILE;
  const grille = options.grille ?? true;
  const marquerUnites = options.unites ?? true;
  const image = creerImage(map.largeur * t, map.hauteur * t, COULEURS.eau);

  for (let y = 0; y < map.hauteur; y += 1) {
    const ligne = map.grille[y] ?? '';
    for (let x = 0; x < map.largeur; x += 1) {
      const car = ligne[x] ?? 'W';
      const px = x * t;
      const py = y * t;
      // Dérivé du canon, jamais recopié : la liste à la main taisait le port et le radar.
      if (CARACTERES_CAPTURABLES.includes(car)) {
        const proprietaire = map.proprietaires[`${x},${y}`];
        batiment(image, car, px, py, proprietaire === undefined ? null : proprietaire);
      } else {
        rectangle(image, px, py, t, t, fondDe(car));
        decor(image, car, px, py);
      }
      if (grille) {
        for (let i = 0; i < t; i += 2) {
          pixel(image, px + i, py, COULEURS.ombre);
          pixel(image, px, py + i, COULEURS.ombre);
        }
      }
    }
  }

  if (marquerUnites) {
    for (const unite of map.unitesDepart) {
      const cx = unite.x * t + Math.floor(t / 2);
      const cy = unite.y * t + Math.floor(t / 2);
      const couleur = paletteCamp(unite.camp);
      disque(image, cx, cy, Math.max(3, Math.floor(t / 4)), COULEURS.trait);
      disque(image, cx, cy, Math.max(2, Math.floor(t / 4) - 1), couleur.main);
      pixel(image, cx - 1, cy - 1, couleur.light);
    }
  }
  return image;
}
