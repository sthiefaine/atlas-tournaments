/**
 * La caméra du plateau : **perspective, vue de dessus à faible inclinaison**.
 *
 * Le brief fixe le cadre et il ne bouge pas : tangage entre 60° et 75° au-dessus
 * de l'horizontale (68° par défaut), lacet fixe mais tournable **par quarts de
 * tour** (Q et E), zoom **par paliers** (molette, pincement, + et −), glisser au
 * un doigt ou bouton droit. Un tap reste au jeu. Le cadrage conserve des cases
 * lisibles sur téléphone, quitte à explorer la carte en glissant.
 *
 * Les fonctions du haut de fichier sont **pures** : elles ne connaissent ni le
 * DOM ni three.js et se testent directement (`tests/render3d/camera.test.ts`).
 */

import * as THREE from 'three';

import type { Case } from '../schemas/types';
import { CASE, mondeVersCase } from './geometrie';

/** Tangage minimal, en degrés au-dessus de l'horizontale. */
export const TANGAGE_MIN = 60;
/** Tangage maximal : au-delà, la lecture des unités s'aplatit. */
export const TANGAGE_MAX = 75;
/** Tangage par défaut. */
export const TANGAGE_DEFAUT = 68;

/** Champ de vision vertical, en degrés. */
export const FOV = 42;

/** Les paliers de zoom, en distance caméra-cible. */
export const PALIERS_DISTANCE = [5, 7, 9.5, 13, 17.5, 24, 33, 45] as const;

/** L'état de la caméra : une cible au sol, une distance, deux angles. */
export interface EtatCamera {
  /** Point visé au sol, en unités de scène. */
  cible: { x: number; z: number };
  distance: number;
  /** Tangage en degrés, borné à [`TANGAGE_MIN`, `TANGAGE_MAX`]. */
  tangage: number;
  /** Lacet en degrés : 0, 90, 180 ou 270. */
  lacet: number;
}

/** Position de la caméra pour un état donné. */
export function positionCamera(etat: EtatCamera): { x: number; y: number; z: number } {
  const e = (etat.tangage * Math.PI) / 180;
  const a = (etat.lacet * Math.PI) / 180;
  const plat = Math.cos(e) * etat.distance;
  return {
    x: etat.cible.x + Math.sin(a) * plat,
    y: Math.sin(e) * etat.distance,
    z: etat.cible.z + Math.cos(a) * plat,
  };
}

/**
 * La distance qui fait tenir une carte de `largeur × hauteur` cases dans la vue.
 * On prend le pire des deux axes, avec une marge : mieux vaut un peu de ciel
 * autour du plateau qu'une colonne de cases coupée.
 */
export function distanceCadrage(
  largeur: number, hauteur: number, aspect: number, tangage = TANGAGE_DEFAUT, marge = 1.06,
): number {
  const demiFov = Math.tan((FOV * Math.PI) / 360);
  const e = (tangage * Math.PI) / 180;
  const parProfondeur = (hauteur * CASE * Math.sin(e)) / (2 * demiFov);
  const parLargeur = (largeur * CASE) / (2 * demiFov * Math.max(0.2, aspect));
  return Math.max(parProfondeur, parLargeur) * marge;
}

/** Distance maximale pour garder une case lisible au centre de la vue. */
export function distanceLisible(hauteurVue: number, pixelsParCase = 48, tangage = TANGAGE_DEFAUT): number {
  return Math.max(PALIERS_DISTANCE[0],
    (Math.max(1, hauteurVue) * CASE * Math.sin((tangage * Math.PI) / 180))
      / (2 * Math.tan((FOV * Math.PI) / 360) * pixelsParCase));
}

/** Le palier de distance le plus proche d'une valeur. */
export function palierDistance(distance: number): number {
  let meilleur: number = PALIERS_DISTANCE[0];
  let ecart = Number.POSITIVE_INFINITY;
  for (const p of PALIERS_DISTANCE) {
    const d = Math.abs(p - distance);
    if (d < ecart) {
      ecart = d;
      meilleur = p;
    }
  }
  return meilleur;
}

/** Le palier suivant (`sens = +1` rapproche) ou précédent. */
export function palierSuivant(distance: number, sens: number): number {
  const courant = palierDistance(distance);
  const i = PALIERS_DISTANCE.indexOf(courant as (typeof PALIERS_DISTANCE)[number]);
  const j = Math.max(0, Math.min(PALIERS_DISTANCE.length - 1, i - Math.sign(sens)));
  return PALIERS_DISTANCE[j] ?? courant;
}

/** Ramène la cible dans la carte : on ne sort jamais du plateau. */
export function limiterCible(
  etat: EtatCamera, carte: { largeur: number; hauteur: number },
): EtatCamera {
  const marge = 1.5;
  etat.cible.x = Math.max(-marge, Math.min(carte.largeur * CASE + marge, etat.cible.x));
  etat.cible.z = Math.max(-marge, Math.min(carte.hauteur * CASE + marge, etat.cible.z));
  etat.tangage = Math.max(TANGAGE_MIN, Math.min(TANGAGE_MAX, etat.tangage));
  etat.distance = Math.max(
    PALIERS_DISTANCE[0],
    Math.min(PALIERS_DISTANCE[PALIERS_DISTANCE.length - 1] ?? 45, etat.distance),
  );
  etat.lacet = ((Math.round(etat.lacet / 90) * 90) % 360 + 360) % 360;
  return etat;
}

/**
 * Traduit un glisser d'écran en déplacement de la cible, dans le repère tourné
 * par le lacet : glisser vers la droite fait glisser la carte vers la droite,
 * quel que soit le quart de tour courant.
 */
export function deplacerCible(
  etat: EtatCamera, dxEcran: number, dyEcran: number, hauteurVue: number,
): EtatCamera {
  const echelle = (2 * etat.distance * Math.tan((FOV * Math.PI) / 360)) / Math.max(1, hauteurVue);
  const a = (etat.lacet * Math.PI) / 180;
  const dx = -dxEcran * echelle;
  const dz = -dyEcran * echelle / Math.sin((etat.tangage * Math.PI) / 180);
  etat.cible.x += dx * Math.cos(a) + dz * Math.sin(a);
  etat.cible.z += -dx * Math.sin(a) + dz * Math.cos(a);
  return etat;
}

// ---------------------------------------------------------------------------
// La caméra three.js
// ---------------------------------------------------------------------------

/** La caméra montée, avec ses commandes et son picking. */
export interface Vue3d {
  readonly camera: THREE.PerspectiveCamera;
  readonly etat: EtatCamera;
  readonly cible: THREE.Vector3;
  /** Déclare la taille de la vue et recalcule la projection. */
  redimensionner(largeur: number, hauteur: number): void;
  /** Recopie l'état dans la caméra three.js. */
  appliquer(): void;
  /** Cadre la carte dans la limite de lisibilité des cases. */
  cadrerCarte(): void;
  /** Amène une case dans le champ, sans brutalité. */
  cadrerCase(c: Case, hauteurSol: number): void;
  centrerCase(c: Case): void;
  glisser(dx: number, dy: number): void;
  zoomer(sens: number): void;
  facteurZoom(facteur: number, ancre?: { x: number; y: number }): void;
  tourner(sens: number): void;
  /** Point d'écran → case, par lancer de rayon sur le sol. */
  /** Les cibles sont interrogées ensemble ; la plus proche de la caméra l'emporte. */
  caseSous(x: number, y: number, sol: THREE.Object3D | readonly THREE.Object3D[] | null): Case | null;
  /** Point du monde → point d'écran en pixels logiques, ou `null` si derrière. */
  versEcran(point: THREE.Vector3): { x: number; y: number } | null;
}

/** Monte la caméra sur une carte donnée. */
export function creerVue3d(carte: { largeur: number; hauteur: number }): Vue3d {
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 400);
  const etat: EtatCamera = {
    cible: { x: (carte.largeur * CASE) / 2, z: (carte.hauteur * CASE) / 2 },
    distance: 18,
    tangage: TANGAGE_DEFAUT,
    lacet: 0,
  };
  const cible = new THREE.Vector3();
  const rayon = new THREE.Raycaster();
  const plan = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let largeurVue = 1;
  let hauteurVue = 1;

  function appliquer(): void {
    limiterCible(etat, carte);
    etat.distance = Math.min(etat.distance, distanceLisible(hauteurVue));
    const p = positionCamera(etat);
    camera.position.set(p.x, p.y, p.z);
    cible.set(etat.cible.x, 0, etat.cible.z);
    camera.lookAt(cible);
    camera.updateMatrixWorld();
  }

  function cadrerCarte(): void {
    etat.cible.x = (carte.largeur * CASE) / 2;
    etat.cible.z = (carte.hauteur * CASE) / 2;
    // On prend la distance exacte plutôt que le palier au-dessus : coller au
    // palier laisserait jusqu'à un tiers de l'écran vide autour du plateau.
    etat.distance = Math.min(
      distanceCadrage(carte.largeur, carte.hauteur, camera.aspect, etat.tangage),
      distanceLisible(hauteurVue, 64),
    );
    appliquer();
  }

  return {
    camera,
    etat,
    cible,

    redimensionner(l: number, h: number): void {
      largeurVue = Math.max(1, l);
      hauteurVue = Math.max(1, h);
      camera.aspect = largeurVue / hauteurVue;
      camera.updateProjectionMatrix();
      appliquer();
    },

    appliquer,
    cadrerCarte,

    centrerCase(c: Case): void {
      etat.cible.x = c.x * CASE + CASE / 2;
      etat.cible.z = c.y * CASE + CASE / 2;
      appliquer();
    },

    cadrerCase(c: Case, hauteurSol: number): void {
      const p = new THREE.Vector3(c.x * CASE + CASE / 2, hauteurSol, c.y * CASE + CASE / 2);
      const ecran = this.versEcran(p);
      const marge = 0.16;
      if (
        ecran
        && ecran.x > largeurVue * marge && ecran.x < largeurVue * (1 - marge)
        && ecran.y > hauteurVue * marge && ecran.y < hauteurVue * (1 - marge)
      ) return;
      etat.cible.x = p.x;
      etat.cible.z = p.z;
      appliquer();
    },

    glisser(dx: number, dy: number): void {
      deplacerCible(etat, dx, dy, hauteurVue);
      appliquer();
    },

    zoomer(sens: number): void {
      etat.distance = palierSuivant(etat.distance, sens);
      appliquer();
    },

    facteurZoom(facteur: number, ancre?: { x: number; y: number }): void {
      if (!Number.isFinite(facteur) || facteur <= 0) return;
      const auSol = (): THREE.Vector3 | null => {
        if (!ancre) return null;
        rayon.setFromCamera(new THREE.Vector2(
          (ancre.x / largeurVue) * 2 - 1, -(ancre.y / hauteurVue) * 2 + 1,
        ), camera);
        return rayon.ray.intersectPlane(plan, new THREE.Vector3());
      };
      const avant = auSol();
      etat.distance = etat.distance / Math.max(0.2, facteur);
      appliquer();
      const apres = auSol();
      if (avant && apres) {
        etat.cible.x += avant.x - apres.x;
        etat.cible.z += avant.z - apres.z;
        appliquer();
      }
    },

    tourner(sens: number): void {
      etat.lacet += Math.sign(sens) * 90;
      appliquer();
    },

    caseSous(x: number, y: number, sol: THREE.Object3D | readonly THREE.Object3D[] | null): Case | null {
      const ndc = new THREE.Vector2(
        (x / largeurVue) * 2 - 1,
        -(y / hauteurVue) * 2 + 1,
      );
      rayon.setFromCamera(ndc, camera);
      if (sol) {
        const touches = rayon.intersectObjects(Array.isArray(sol) ? [...sol] : [sol as THREE.Object3D], false);
        const premiere = touches[0];
        if (premiere) {
          const c = mondeVersCase(premiere.point.x, premiere.point.z);
          if (c.x >= 0 && c.y >= 0 && c.x < carte.largeur && c.y < carte.hauteur) return c;
        }
      }
      const point = new THREE.Vector3();
      if (!rayon.ray.intersectPlane(plan, point)) return null;
      const c = mondeVersCase(point.x, point.z);
      if (c.x < 0 || c.y < 0 || c.x >= carte.largeur || c.y >= carte.hauteur) return null;
      return c;
    },

    versEcran(point: THREE.Vector3): { x: number; y: number } | null {
      const p = point.clone().project(camera);
      if (p.z > 1) return null;
      return {
        x: (p.x * 0.5 + 0.5) * largeurVue,
        y: (-p.y * 0.5 + 0.5) * hauteurVue,
      };
    },
  };
}
