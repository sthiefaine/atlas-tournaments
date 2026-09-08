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

import * as THREE from 'three/webgpu';

import type { GenreSurbrillance, Surbrillance } from '../render/surbrillance';
import { cleCase } from '../engine/index';
import type { Case } from '../schemas/types';
import { CASE } from './geometrie';
import { creerTampon, type TamponMaille } from './maillage';

/**
 * Couleurs des décalques, reprises du rendu 2D pour ne pas réapprendre en
 * changeant de peau : **vert, j'y vais ; rouge, j'y tire** ; l'or pour un
 * objectif, le bleu pour un chantier.
 */
const COULEURS: Readonly<Record<GenreSurbrillance, number>> = {
  deplacement: 0x28ec96,
  attaque: 0xff2e48,
  capture: 0xffc634,
  production: 0x4eaaff,
  danger: 0xff3c3c,
};

/** Opacité des décalques par genre. */
const OPACITES: Readonly<Record<GenreSurbrillance, number>> = {
  deplacement: 0.56,
  attaque: 0.66,
  capture: 0.56,
  production: 0.56,
  danger: 0.3,
};

/** Largeur du corps de la flèche, en fraction de case. */
const CORPS_FLECHE = 0.3;
/** Longueur de la pointe, mesurée depuis le centre de la case d'arrivée. */
const TETE_FLECHE = 0.34;
/** Demi-largeur de la base de la pointe. */
const AILE_FLECHE = 0.27;
/** Pas d'échantillonnage du ruban : plus il est fin, mieux il colle au relief. */
const PAS_RUBAN = 0.2;

/**
 * Le brouillon d'une maille : deux tableaux **réutilisés** d'un survol à l'autre.
 *
 * Les trois formes d'ici écrivaient chacune une `BufferGeometry` neuve, aussitôt
 * posée sur la maille et aussitôt libérée au survol suivant. Sous WebGPU, échanger
 * une géométrie ne suffit pas à prévenir le moteur (`maillage.ts`), et allouer par
 * mouvement de souris n'a jamais servi à rien : elles écrivent désormais dans ce
 * brouillon, que le tampon de la maille recopie dans ses attributs préalloués.
 *
 * Aucune normale n'est calculée : le WGSL d'un décalque, construit hors navigateur
 * (`tests/render3d/surbrillances.test.ts`), ne lit que `position`. Un matériau
 * basique n'a pas d'éclairage, il n'a donc rien à faire d'une normale.
 */
interface Sortie {
  positions: number[];
  indices: number[];
}

/**
 * La **flèche de déplacement** : un ruban coudé qui suit les cases traversées et
 * une pointe sur la case d'arrivée (`10-rendu-3d.md` §8).
 *
 * Le ruban est échantillonné tous les `PAS_RUBAN` le long de chaque segment, et
 * chaque sommet lit sa propre altitude : c'est ce qui fait monter et descendre
 * la flèche avec le terrain au lieu de la faire flotter au-dessus d'une côte.
 * Les coudes sont bouchés par un carré posé sur l'articulation — la grille étant
 * orthogonale, un carré aligné sur les axes recouvre exactement l'angle.
 */
function fleche(
  s: Sortie,
  cases: readonly Case[], hauteurEn: (x: number, z: number) => number, altitude: number,
  echelle = 1,
): void {
  const { positions, indices } = s;
  const sommet = (x: number, z: number): number => {
    const i = positions.length / 3;
    positions.push(x, hauteurEn(x, z) + altitude, z);
    return i;
  };
  const quadrilatere = (a: number, b: number, c: number, d: number): void => {
    indices.push(a, b, c, a, c, d);
  };

  const centres = cases.map((c) => ({ x: (c.x + 0.5) * CASE, z: (c.y + 0.5) * CASE }));
  const fin = centres[centres.length - 1];
  const precedent = centres[centres.length - 2];
  if (!fin || !precedent) return;
  const dx = Math.sign(fin.x - precedent.x);
  const dz = Math.sign(fin.z - precedent.z);

  // Le corps s'arrête au ras de la pointe : sans ce retrait, la jonction gonfle.
  const tete = TETE_FLECHE * CASE * echelle;
  const corps = [
    ...centres.slice(0, -1),
    { x: fin.x - dx * tete, z: fin.z - dz * tete },
  ];
  const demi = (CORPS_FLECHE * CASE * echelle) / 2;

  for (let i = 0; i < corps.length - 1; i += 1) {
    const a = corps[i];
    const b = corps[i + 1];
    if (!a || !b) continue;
    const lx = b.x - a.x;
    const lz = b.z - a.z;
    const longueur = Math.hypot(lx, lz);
    if (longueur < 1e-4) continue;
    // Normale au segment, dans le plan du sol.
    const nx = (-lz / longueur) * demi;
    const nz = (lx / longueur) * demi;
    const pas = Math.max(1, Math.round(longueur / PAS_RUBAN));
    let gaucheAvant = -1;
    let droiteAvant = -1;
    for (let k = 0; k <= pas; k += 1) {
      const t = k / pas;
      const px = a.x + lx * t;
      const pz = a.z + lz * t;
      const gauche = sommet(px + nx, pz + nz);
      const droite = sommet(px - nx, pz - nz);
      if (k > 0) quadrilatere(gaucheAvant, droiteAvant, droite, gauche);
      gaucheAvant = gauche;
      droiteAvant = droite;
    }
  }

  // Bouchons de coude, sur les articulations intérieures du corps.
  for (let i = 1; i < corps.length - 1; i += 1) {
    const j = corps[i];
    if (!j) continue;
    quadrilatere(
      sommet(j.x - demi, j.z - demi), sommet(j.x + demi, j.z - demi),
      sommet(j.x + demi, j.z + demi), sommet(j.x - demi, j.z + demi),
    );
  }

  // La pointe : un triangle dont la base est perpendiculaire au dernier pas.
  const bx = fin.x - dx * tete;
  const bz = fin.z - dz * tete;
  const aile = AILE_FLECHE * CASE * echelle;
  indices.push(
    sommet(fin.x + dx * 0.06 * CASE, fin.z + dz * 0.06 * CASE),
    sommet(bx - dz * aile, bz + dx * aile),
    sommet(bx + dz * aile, bz - dx * aile),
  );
}

/**
 * L'altitude d'un décalque posé sur une case **hors de vue**. Le brouillard est
 * un aplat noir : une nappe qui épouserait le relief invisible le trahirait —
 * une montagne se devine à la bosse rouge de l'enveloppe de tir. Ces cases ont
 * donc un décalque **plat**, au niveau du sol nu, et qui ne teste pas la
 * profondeur : sans quoi la montagne noire y découperait un trou, ce qui
 * reviendrait à dessiner la montagne.
 */
const ALTITUDE_BROUILLARD = 0.026;

/** Ce que le rendu attend de la couche. */
export interface CoucheSurbrillances {
  readonly groupe: THREE.Group;
  /**
   * Les cases que le joueur voit, ou `null` hors brouillard. Les autres
   * reçoivent un décalque plat (`ALTITUDE_BROUILLARD`) : on sait où l'on peut
   * aller et frapper, on ne sait pas ce qu'il y a là.
   */
  majVisibles(visibles: ReadonlySet<string> | null): void;
  maj(
    surbrillances: readonly Surbrillance[],
    chemin: readonly Case[],
    curseur: Case | null,
    positionSelection: THREE.Vector3 | null,
  ): void;
  /** Fait battre l'anneau de sélection. Rend vrai tant qu'il faut redessiner. */
  avancer(ms: number): boolean;
  /**
   * Le relief a bougé : les décalques sont rebâtis sur la dernière vue posée,
   * quelles que soient leurs cases. Sans cela, une marée laisserait la nappe
   * verte flotter à l'ancienne altitude jusqu'au prochain changement de cases.
   */
  invalider(): void;
  dispose(): void;
}

/**
 * Construit un décalque pour un ensemble de cases : une nappe de quadrilatères
 * subdivisés, plaqués sur le relief. Le retrait (`marge`) laisse voir la grille
 * entre deux cases allumées, ce qui garde la lecture case par case.
 */
function decalque(
  s: Sortie,
  cases: readonly Case[], hauteurEn: (x: number, z: number) => number,
  marge: number, altitude: number,
): void {
  const { positions, indices } = s;
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
}

/** Le contour d'une case : quatre bandes fines, pour le curseur. */
function contour(
  s: Sortie,
  c: Case, hauteurEn: (x: number, z: number) => number, epaisseur: number, altitude: number,
): void {
  const { positions, indices } = s;
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
}

/**
 * Les capacités de départ, en éléments. Une réallocation coûte un état de
 * pipeline (`maillage.ts`) : mieux vaut partir large sur ce qui change au survol.
 *
 * Une nappe fait neuf sommets et vingt-quatre indices par case ; 192 cases
 * couvrent la portée d'un mouvement 9 (181 cases) et la plupart des enveloppes
 * de tir. La flèche ne peut pas dépasser le mouvement maximal du catalogue plus
 * une case, soit dix cases, donc environ 145 sommets et 325 indices : 512 et
 * 1024 mettent trois fois la marge. Le curseur est de taille fixe, exactement.
 */
const CASES_NAPPE = 192;
const SOMMETS_NAPPE = CASES_NAPPE * 9;
const INDICES_NAPPE = CASES_NAPPE * 24;
const SOMMETS_FLECHE = 512;
const INDICES_FLECHE = 1024;
const SOMMETS_CURSEUR = 16;
const INDICES_CURSEUR = 24;

/** Monte la couche de surbrillances. */
export function creerSurbrillances(
  hauteurEn: (x: number, z: number) => number,
): CoucheSurbrillances {
  const groupe = new THREE.Group();
  groupe.name = 'surbrillances';
  groupe.renderOrder = 3;

  const genres: GenreSurbrillance[] = ['deplacement', 'attaque', 'capture', 'production', 'danger'];
  const nappes = new Map<GenreSurbrillance, THREE.Mesh>();
  /** Les mêmes nappes, à plat, pour les cases hors de vue. */
  const nappesBrouillard = new Map<GenreSurbrillance, THREE.Mesh>();
  /**
   * Le tampon de chaque maille, sous le nom que `cles` lui donne. C'est lui qui
   * tient la géométrie : elle est allouée une fois et **remplie** ensuite, si
   * bien que l'objet de rendu du moteur reste valide quoi qu'il arrive — y
   * compris après une image où la maille était invisible, ce qui est très
   * exactement ce qui faisait disparaître la flèche.
   */
  const tampons = new Map<string, TamponMaille>();
  // Des matériaux à nœuds (`WebGPURenderer`), aux réglages des classiques. Le
  // décalage de polygone n'est honoré que par le repli WebGL du moteur — la
  // chaîne WebGPU de r170 ne le connaît pas — ; c'est l'altitude posée sur
  // chaque sommet (deux à quatre centimètres de scène) qui tient les décalques
  // au-dessus du sol, le décalage n'a jamais été qu'une ceinture de plus.
  for (const genre of genres) {
    const reglages = {
      color: COULEURS[genre],
      transparent: true,
      opacity: OPACITES[genre],
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    };
    const mat = new THREE.MeshBasicNodeMaterial(reglages);
    const maille = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    maille.renderOrder = 3;
    maille.frustumCulled = false;
    nappes.set(genre, maille);
    tampons.set(genre, creerTampon(maille, { sommets: SOMMETS_NAPPE, indices: INDICES_NAPPE }));
    groupe.add(maille);

    // La même couleur, à plat et sans test de profondeur, pour les cases hors
    // de vue. Rien de visible ne peut la masquer : dans le brouillard, il n'y a
    // ni unité dessinée ni bâtiment éclairé à recouvrir. Construite des mêmes
    // réglages, pas clonée : en r170, `clone()` d'un matériau à nœuds ne
    // recopie pas sa couleur, et la nappe de brouillard serait blanche.
    const matPlat = new THREE.MeshBasicNodeMaterial({ ...reglages, depthTest: false });
    const plate = new THREE.Mesh(new THREE.BufferGeometry(), matPlat);
    plate.renderOrder = 4;
    plate.frustumCulled = false;
    nappesBrouillard.set(genre, plate);
    tampons.set(`${genre}:brouillard`, creerTampon(plate, { sommets: SOMMETS_NAPPE, indices: INDICES_NAPPE }));
    groupe.add(plate);
  }

  const matLisere = new THREE.MeshBasicNodeMaterial({
    color: 0x0d2419, transparent: true, opacity: 0.72, depthWrite: false,
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5,
  });
  const lisere = new THREE.Mesh(new THREE.BufferGeometry(), matLisere);
  lisere.name = 'lisere';
  lisere.renderOrder = 4;
  lisere.frustumCulled = false;
  tampons.set('lisere', creerTampon(lisere, { sommets: SOMMETS_FLECHE, indices: INDICES_FLECHE }));
  groupe.add(lisere);

  const matChemin = new THREE.MeshBasicNodeMaterial({
    color: 0xf4fff6, transparent: true, opacity: 0.96, depthWrite: false,
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
  });
  const chemin = new THREE.Mesh(new THREE.BufferGeometry(), matChemin);
  chemin.name = 'chemin';
  chemin.renderOrder = 5;
  chemin.frustumCulled = false;
  tampons.set('chemin', creerTampon(chemin, { sommets: SOMMETS_FLECHE, indices: INDICES_FLECHE }));
  groupe.add(chemin);

  const matCurseur = new THREE.MeshBasicNodeMaterial({
    color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false,
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8,
  });
  const curseurMaille = new THREE.Mesh(new THREE.BufferGeometry(), matCurseur);
  curseurMaille.name = 'curseur';
  curseurMaille.renderOrder = 5;
  curseurMaille.frustumCulled = false;
  tampons.set('curseur', creerTampon(curseurMaille, { sommets: SOMMETS_CURSEUR, indices: INDICES_CURSEUR }));
  groupe.add(curseurMaille);

  const geoAnneau = new THREE.TorusGeometry(0.4, 0.055, 8, 30);
  const matAnneau = new THREE.MeshBasicNodeMaterial({
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

  /**
   * La clé des cases que porte chaque maille. Une géométrie n'est rebâtie que si
   * sa clé change : au survol, seuls la flèche et le curseur bougent, et les
   * cinq nappes — dont la verte, la plus lourde — restent telles quelles. Un
   * décalque coûte neuf sommets et un calcul de normales par case, sept fois par
   * survol avant cela.
   */
  const cles = new Map<string, string>();
  const cleDe = (cases: readonly Case[]): string => cases.map((c) => `${c.x},${c.y}`).join(' ');
  /** Le brouillon, vidé avant chaque forme et réutilisé : rien ne s'alloue ici. */
  const sortie: Sortie = { positions: [], indices: [] };
  const remplacer = (nom: string, cle: string, construire: (s: Sortie) => void): void => {
    if (cles.get(nom) === cle) return;
    cles.set(nom, cle);
    const tampon = tampons.get(nom);
    if (!tampon) return;
    sortie.positions.length = 0;
    sortie.indices.length = 0;
    construire(sortie);
    // Aucun échange de géométrie : le tampon remplit ses attributs et bouge sa
    // plage. C'est ce qui fait que le moteur n'a rien à réapprendre, et donc que
    // la flèche se redessine même après une image passée invisible.
    tampon.ecrire({
      attributs: { position: { valeurs: sortie.positions, taille: 3 } },
      indices: sortie.indices,
    });
  };
  /** Les cases vues par le joueur, ou `null` : hors brouillard, tout est vu. */
  let visiblesCourantes: ReadonlySet<string> | null = null;
  const vue = (c: Case): boolean => visiblesCourantes === null || visiblesCourantes.has(cleCase(c));
  /** Le sol plat du brouillard : la même altitude partout, donc aucun relief. */
  const solPlat = (): number => 0;

  /** La dernière vue posée, pour rebâtir sur un relief qui a bougé. */
  let derniere: {
    surbrillances: readonly Surbrillance[]; chemin: readonly Case[]; curseur: Case | null;
  } | null = null;

  function poser(
    surbrillances: readonly Surbrillance[], cheminCases: readonly Case[], curseur: Case | null,
  ): void {
    const parGenre = new Map<GenreSurbrillance, Case[]>();
    for (const s of surbrillances) {
      const liste = parGenre.get(s.genre) ?? [];
      liste.push(s.case);
      parGenre.set(s.genre, liste);
    }
    for (const genre of genres) {
      const maille = nappes.get(genre);
      const plate = nappesBrouillard.get(genre);
      if (!maille || !plate) continue;
      const toutes = parGenre.get(genre) ?? [];
      const cases = toutes.filter(vue);
      const cachees = toutes.filter((c) => !vue(c));
      remplacer(genre, cleDe(cases), (s) => {
        if (cases.length > 0) decalque(s, cases, hauteurEn, 0.06, 0.026);
      });
      maille.visible = cases.length > 0;
      remplacer(`${genre}:brouillard`, cleDe(cachees), (s) => {
        if (cachees.length > 0) decalque(s, cachees, solPlat, 0.06, ALTITUDE_BROUILLARD);
      });
      plate.visible = cachees.length > 0;
    }
    const pas = cheminCases.length > 1 ? [...cheminCases] : [];
    const cleChemin = cleDe(pas);
    remplacer('chemin', cleChemin, (s) => {
      if (pas.length > 0) fleche(s, pas, hauteurEn, 0.036);
    });
    remplacer('lisere', cleChemin, (s) => {
      if (pas.length > 0) fleche(s, pas, hauteurEn, 0.032, 1.3);
    });
    chemin.visible = pas.length > 0;
    lisere.visible = pas.length > 0;

    remplacer('curseur', curseur ? `${curseur.x},${curseur.y}` : '', (s) => {
      if (curseur) contour(s, curseur, hauteurEn, 0.055, 0.04);
    });
    curseurMaille.visible = curseur !== null;
  }

  return {
    groupe,

    maj(surbrillances, cheminCases, curseur, positionSelection): void {
      derniere = { surbrillances, chemin: cheminCases, curseur };
      poser(surbrillances, cheminCases, curseur);
      anneau.visible = positionSelection !== null;
      if (positionSelection) anneau.position.copy(positionSelection).setY(positionSelection.y + 0.05);
      anime = positionSelection !== null;
    },

    majVisibles(visibles: ReadonlySet<string> | null): void {
      if (visibles === visiblesCourantes) return;
      const memes = visibles !== null && visiblesCourantes !== null
        && visibles.size === visiblesCourantes.size
        && [...visibles].every((k) => visiblesCourantes!.has(k));
      visiblesCourantes = visibles;
      if (memes) return;
      // Le partage vu / caché change : les nappes se rebâtissent des deux côtés.
      cles.clear();
      if (derniere) poser(derniere.surbrillances, derniere.chemin, derniere.curseur);
    },

    invalider(): void {
      cles.clear();
      if (derniere) poser(derniere.surbrillances, derniere.chemin, derniere.curseur);
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
      for (const tampon of tampons.values()) tampon.dispose();
      tampons.clear();
      for (const maille of nappesBrouillard.values()) (maille.material as THREE.Material).dispose();
      for (const maille of nappes.values()) (maille.material as THREE.Material).dispose();
      matChemin.dispose();
      matLisere.dispose();
      matCurseur.dispose();
      geoAnneau.dispose();
      matAnneau.dispose();
    },
  };
}
