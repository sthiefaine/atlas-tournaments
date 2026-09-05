/**
 * Les surbrillances : portée de déplacement, cibles, chemin et curseur.
 *
 * En 2D c'étaient des rectangles peints sur la tuile. En 3D ce sont des
 * **décalques au sol** : des plans épousant le relief, posés deux centimètres de
 * scène au-dessus du terrain, en matériau transparent qui **teste** la
 * profondeur sans l'écrire. La conséquence est celle que le brief demande : une
 * case allumée éclaire le sol sans jamais passer devant l'unité qui s'y trouve.
 *
 * La sélection ajoute un anneau qui bat lentement — c'est la seule chose animée
 * en permanence dans cette couche, et elle suffit à dire « c'est celle-ci ».
 */

import * as THREE from 'three';

import type { GenreSurbrillance, Surbrillance } from '../render/scene';
import type { Case } from '../schemas/types';
import { CASE } from './geometrie';

/** Couleurs des décalques, reprises du rendu 2D pour ne pas réapprendre. */
const COULEURS: Readonly<Record<GenreSurbrillance, number>> = {
  deplacement: 0x5ab4ff,
  attaque: 0xff6054,
  capture: 0x78e18c,
  production: 0xf0c85a,
  danger: 0xff4646,
};

/** Opacité des décalques par genre. */
const OPACITES: Readonly<Record<GenreSurbrillance, number>> = {
  deplacement: 0.5,
  attaque: 0.52,
  capture: 0.5,
  production: 0.5,
  danger: 0.3,
};

/** Ce que le rendu attend de la couche. */
export interface CoucheSurbrillances {
  readonly groupe: THREE.Group;
  maj(
    surbrillances: readonly Surbrillance[],
    chemin: readonly Case[],
    curseur: Case | null,
    positionSelection: THREE.Vector3 | null,
  ): void;
  /** Fait battre l'anneau de sélection. Rend vrai tant qu'il faut redessiner. */
  avancer(ms: number): boolean;
  dispose(): void;
}

/**
 * Construit un décalque pour un ensemble de cases : une nappe de quadrilatères
 * subdivisés, plaqués sur le relief. Le retrait (`marge`) laisse voir la grille
 * entre deux cases allumées, ce qui garde la lecture case par case.
 */
function decalque(
  cases: readonly Case[], hauteurEn: (x: number, z: number) => number,
  marge: number, altitude: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const S = 2;
  for (const c of cases) {
    const base = positions.length / 3;
    const x0 = c.x * CASE + marge;
    const z0 = c.y * CASE + marge;
    const pas = (CASE - marge * 2) / S;
    for (let j = 0; j <= S; j += 1) {
      for (let i = 0; i <= S; i += 1) {
        const x = x0 + i * pas;
        const z = z0 + j * pas;
        positions.push(x, hauteurEn(x, z) + altitude, z);
      }
    }
    for (let j = 0; j < S; j += 1) {
      for (let i = 0; i < S; i += 1) {
        const a = base + j * (S + 1) + i;
        indices.push(a, a + S + 1, a + 1, a + 1, a + S + 1, a + S + 2);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Le contour d'une case : quatre bandes fines, pour le curseur. */
function contour(
  c: Case, hauteurEn: (x: number, z: number) => number, epaisseur: number, altitude: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const x0 = c.x * CASE;
  const z0 = c.y * CASE;
  const e = epaisseur;
  const bandes: [number, number, number, number][] = [
    [x0, z0, x0 + CASE, z0 + e],
    [x0, z0 + CASE - e, x0 + CASE, z0 + CASE],
    [x0, z0 + e, x0 + e, z0 + CASE - e],
    [x0 + CASE - e, z0 + e, x0 + CASE, z0 + CASE - e],
  ];
  for (const [ax, az, bx, bz] of bandes) {
    const base = positions.length / 3;
    const coins: [number, number][] = [[ax, az], [bx, az], [bx, bz], [ax, bz]];
    for (const [x, z] of coins) positions.push(x, hauteurEn(x, z) + altitude, z);
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Monte la couche de surbrillances. */
export function creerSurbrillances(
  hauteurEn: (x: number, z: number) => number,
): CoucheSurbrillances {
  const groupe = new THREE.Group();
  groupe.name = 'surbrillances';
  groupe.renderOrder = 3;

  const genres: GenreSurbrillance[] = ['deplacement', 'attaque', 'capture', 'production', 'danger'];
  const nappes = new Map<GenreSurbrillance, THREE.Mesh>();
  for (const genre of genres) {
    const mat = new THREE.MeshBasicMaterial({
      color: COULEURS[genre],
      transparent: true,
      opacity: OPACITES[genre],
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    const maille = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    maille.renderOrder = 3;
    maille.frustumCulled = false;
    nappes.set(genre, maille);
    groupe.add(maille);
  }

  const matChemin = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false,
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
  });
  const chemin = new THREE.Mesh(new THREE.BufferGeometry(), matChemin);
  chemin.renderOrder = 4;
  chemin.frustumCulled = false;
  groupe.add(chemin);

  const matCurseur = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false,
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8,
  });
  const curseurMaille = new THREE.Mesh(new THREE.BufferGeometry(), matCurseur);
  curseurMaille.renderOrder = 5;
  curseurMaille.frustumCulled = false;
  groupe.add(curseurMaille);

  const geoAnneau = new THREE.TorusGeometry(0.4, 0.055, 8, 30);
  const matAnneau = new THREE.MeshBasicMaterial({
    // `depthTest` reste vrai : un décalque ne passe jamais devant une unité.
    color: 0xffe27a, transparent: true, opacity: 0.95, depthWrite: false,
  });
  const anneau = new THREE.Mesh(geoAnneau, matAnneau);
  anneau.rotation.x = -Math.PI / 2;
  anneau.renderOrder = 5;
  anneau.visible = false;
  groupe.add(anneau);

  let temps = 0;
  let anime = false;

  return {
    groupe,

    maj(surbrillances, cheminCases, curseur, positionSelection): void {
      const parGenre = new Map<GenreSurbrillance, Case[]>();
      for (const s of surbrillances) {
        const liste = parGenre.get(s.genre) ?? [];
        liste.push(s.case);
        parGenre.set(s.genre, liste);
      }
      for (const genre of genres) {
        const maille = nappes.get(genre);
        if (!maille) continue;
        const cases = parGenre.get(genre) ?? [];
        maille.geometry.dispose();
        maille.geometry = cases.length > 0
          ? decalque(cases, hauteurEn, 0.06, 0.026)
          : new THREE.BufferGeometry();
        maille.visible = cases.length > 0;
      }
      chemin.geometry.dispose();
      const pas = cheminCases.length > 1 ? [...cheminCases] : [];
      chemin.geometry = pas.length > 0
        ? decalque(pas, hauteurEn, 0.3, 0.034)
        : new THREE.BufferGeometry();
      chemin.visible = pas.length > 0;

      curseurMaille.geometry.dispose();
      curseurMaille.geometry = curseur
        ? contour(curseur, hauteurEn, 0.055, 0.04)
        : new THREE.BufferGeometry();
      curseurMaille.visible = curseur !== null;

      anneau.visible = positionSelection !== null;
      if (positionSelection) anneau.position.copy(positionSelection).setY(positionSelection.y + 0.05);
      anime = positionSelection !== null;
    },

    avancer(ms: number): boolean {
      if (!anime) return false;
      temps += ms;
      const battement = 1 + Math.sin(temps / 340) * 0.11;
      anneau.scale.set(battement, battement, 1);
      matAnneau.opacity = 0.8 + Math.sin(temps / 340) * 0.18;
      return true;
    },

    dispose(): void {
      for (const maille of nappes.values()) {
        maille.geometry.dispose();
        (maille.material as THREE.Material).dispose();
      }
      chemin.geometry.dispose();
      matChemin.dispose();
      curseurMaille.geometry.dispose();
      matCurseur.dispose();
      geoAnneau.dispose();
      matAnneau.dispose();
    },
  };
}
