/**
 * Les six clips de l'escouade, aux noms et aux durées de la spécification
 * (`doc/11-assets-spec.md` §5.4) : `repos`, `deplacement`, `tir`, `touche`,
 * `hors_jeu`, `capture`.
 *
 * Chaque clip est une **fonction de pose** — le temps vers une rotation par os
 * et un déplacement du bassin —, échantillonnée en images-clés linéaires. Une
 * pose s'écrit en angles d'Euler dans le repère local de l'os, qui est celui de
 * la figurine à la pose de liaison : `x` fait basculer autour de la gauche-droite
 * (négatif pour lancer un membre vers l'avant, positif pour pencher le tronc
 * en avant), `y` tourne autour de la verticale (positif vers la gauche), `z`
 * roule autour de l'avant-arrière.
 *
 * Tous les os reçoivent une piste dans tous les clips, même constante : quand
 * le mixer fond d'un clip vers l'autre, une propriété que l'un anime et pas
 * l'autre reviendrait d'un coup à sa pose de liaison au lieu de fondre.
 *
 * Le ton : `hors_jeu` est un affaissement — les genoux plient, le tronc se
 * voûte, la tête tombe, l'escouade s'assied sur ses talons —, jamais une chute.
 * `capture`, un genou à terre et le bras qui plante le fanion.
 */

import * as THREE from 'three';

import { NOMS_OS, type Articulations, type MesuresFigurine, type NomOs } from './figurine';

/** Ce que les clips savent d'une figurine. */
export interface FigurineAnimee {
  prefixe: string;
  /** Déphasage des clips qui bouclent, en fraction de cycle. */
  phase: number;
  /** Retard des gestes ponctuels, en secondes. */
  delai: number;
  articulations: Articulations;
  mesures: MesuresFigurine;
  /** Vrai si la main gauche ne tient pas le lanceur : le bras gauche est libre de balancer. */
  mainGaucheLibre: boolean;
}

/** Une rotation d'Euler `[x, y, z]`, en radians, ordre `YXZ`. */
type Euler = readonly [number, number, number];

/** Une pose échantillonnée : les rotations des os posés, et le déplacement du bassin. */
interface Pose {
  rotations: Partial<Record<NomOs, Euler>>;
  bassin: Euler;
}

/** Les durées des six clips, en secondes, prises dans la spécification. */
export type Durees = Readonly<Record<'repos' | 'deplacement' | 'tir' | 'touche' | 'hors_jeu' | 'capture', number>>;

const DEUX_PI = Math.PI * 2;

/** Une rampe douce de 0 à 1, bornée. */
function lisser(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

/** Une bosse de 0 à 1 à 0 sur `[0, 1]`, nulle ailleurs. */
function bosse(x: number): number {
  return x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x);
}

/**
 * De combien le bassin doit descendre pour qu'un membre inférieur plié garde
 * son contact au sol : le pied, ou le genou quand on s'agenouille. `cuisse`
 * est l'angle de la cuisse vers l'avant, `flexion` celui du genou.
 */
function chuteBassin(m: MesuresFigurine, cuisse: number, flexion: number, contact: 'pied' | 'genou'): number {
  const genou = { z: m.cuisse * Math.sin(cuisse), y: m.hanche - m.cuisse * Math.cos(cuisse) };
  const tibia = cuisse - flexion;
  const cheville = { z: genou.z + m.jambe * Math.sin(tibia), y: genou.y - m.jambe * Math.cos(tibia) };
  if (contact === 'genou') return m.genou + 0.004 - genou.y;
  const chevilleRepos = m.hanche - m.cuisse - m.jambe;
  return chevilleRepos - cheville.y;
}

// ---------------------------------------------------------------------------
// Les poses
// ---------------------------------------------------------------------------

/** Respiration et léger balancement ; chaque figurine à sa phase. */
function repos(t: number, f: FigurineAnimee, duree: number): Pose {
  const a = (DEUX_PI * t) / duree + f.phase * DEUX_PI;
  return {
    rotations: {
      colonne: [0.02 * Math.sin(a), 0, 0.012 * Math.sin(a + 1.3)],
      tete: [0.02 * Math.sin(a + 0.7), 0.07 * Math.sin(a + 2.1), 0],
      bras_g: [-(f.mainGaucheLibre ? 0.05 : 0.02) * Math.sin(a), 0, 0],
      bras_d: [-0.02 * Math.sin(a), 0, 0],
    },
    bassin: [0, 0.003 * Math.sin(a), 0],
  };
}

/** Le cycle de marche : deux pas par cycle, le genou plie pendant le balancé. */
function deplacement(t: number, f: FigurineAnimee, duree: number): Pose {
  const a = (DEUX_PI * t) / duree + f.phase * DEUX_PI;
  const flexion = (x: number): number => 0.85 * Math.max(0, Math.cos(x)) ** 1.5 + 0.12 * Math.max(0, -Math.sin(x));
  const balance = f.mainGaucheLibre ? 0.28 : 0.07;
  return {
    rotations: {
      cuisse_g: [-0.42 * Math.sin(a), 0, 0],
      jambe_g: [flexion(a), 0, 0],
      cuisse_d: [0.42 * Math.sin(a), 0, 0],
      jambe_d: [flexion(a + Math.PI), 0, 0],
      bras_g: [balance * Math.sin(a), 0, 0],
      avant_bras_g: [f.mainGaucheLibre ? -0.15 + 0.1 * Math.sin(a) : 0, 0, 0],
      bras_d: [-0.07 * Math.sin(a), 0, 0],
      colonne: [0.06 + 0.02 * Math.sin(2 * a), 0.06 * Math.sin(a), 0.03 * Math.sin(a)],
      tete: [-0.03, -0.05 * Math.sin(a), 0],
    },
    bassin: [0.005 * Math.sin(a), -0.008 + 0.008 * Math.cos(2 * a), 0],
  };
}

/** Le temps propre d'un geste ponctuel : retardé, puis resserré pour finir dans la durée du clip. */
function tempsPropre(t: number, f: FigurineAnimee, duree: number, part: number): number {
  const retard = f.delai * part;
  return Math.max(0, t - retard) * (duree / Math.max(1e-6, duree - retard));
}

/** Épauler, tirer, revenir : le recul est une bosse brève sur le tronc et le bras. */
function tir(t: number, f: FigurineAnimee, duree: number): Pose {
  const u = tempsPropre(t, f, duree, 1);
  const e = lisser(u / 0.16) * (1 - lisser((u - 0.36) / 0.34));
  const r = bosse((u - 0.25) / 0.09);
  return {
    rotations: {
      bras_d: [-0.65 * e + 0.18 * r, 0, -0.12 * e],
      avant_bras_d: [-0.3 * e, 0, 0],
      bras_g: f.mainGaucheLibre ? [-0.3 * e, 0, 0.3 * e] : [-0.5 * e, 0, 0.12 * e],
      avant_bras_g: [-0.25 * e, 0, 0],
      colonne: [0.06 * e - 0.1 * r, -0.2 * e, 0],
      tete: [-0.08 * e - 0.05 * r, -0.1 * e, 0],
    },
    bassin: [0, -0.004 * e, -0.01 * r],
  };
}

/** Le coup encaissé : le buste part en arrière, les bras s'écartent, tout revient. */
function touche(t: number, f: FigurineAnimee, duree: number): Pose {
  const u = tempsPropre(t, f, duree, 0.4);
  const j = u < 0.12 ? Math.sin((Math.PI * u) / 0.24) : lisser(1 - (u - 0.12) / 0.36);
  return {
    rotations: {
      colonne: [-0.22 * j, 0.12 * j, 0.05 * j],
      tete: [-0.18 * j, 0.08 * j, 0],
      bras_g: [0.1 * j, 0, 0.3 * j],
      bras_d: [0.1 * j, 0, -0.3 * j],
      avant_bras_g: [-0.2 * j, 0, 0],
      avant_bras_d: [-0.2 * j, 0, 0],
    },
    bassin: [0, -0.008 * j, -0.02 * j],
  };
}

/** L'affaissement : les genoux plient, le bassin descend avec les pieds au sol, le tronc se voûte, la tête tombe. */
function horsJeu(t: number, f: FigurineAnimee, duree: number): Pose {
  const u = tempsPropre(t, f, duree, 0.5);
  const s1 = lisser(u / 0.5);
  const s2 = lisser((u - 0.22) / 0.5);
  const s3 = lisser((u - 0.6) / 0.3);
  const cuisse = 1.05 * s1;
  const flexion = 1.9 * s1;
  return {
    rotations: {
      cuisse_g: [-cuisse, 0, 0.08 * s1],
      cuisse_d: [-cuisse, 0, -0.08 * s1],
      jambe_g: [flexion, 0, 0],
      jambe_d: [flexion, 0, 0],
      colonne: [0.55 * s2 + 0.08 * s3, 0.15 * s2, 0.1 * s2],
      tete: [0.45 * s2 + 0.1 * s3, 0.1 * s2, 0.05 * s2],
      bras_g: [0.1 * s2, 0, 0.15 * s2],
      bras_d: [0.05 * s2, 0, -0.12 * s2],
      avant_bras_g: [-0.25 * s2, 0, 0],
      avant_bras_d: [-0.15 * s2, 0, 0],
    },
    bassin: [0, chuteBassin(f.mesures, cuisse, flexion, 'pied') - 0.012 * s3, 0.01 * s1],
  };
}

/** Un genou à terre, le pied gauche devant, et le bras gauche qui lève puis plante. */
function capture(t: number, f: FigurineAnimee, duree: number): Pose {
  const u = tempsPropre(t, f, duree, 0.7);
  const s1 = lisser(u / 0.5);
  const s2 = lisser((u - 0.35) / 0.3);
  const s3 = lisser((u - 0.7) / 0.25);
  const s4 = lisser((u - 1.0) / 0.3);
  // Le genou droit touche le sol, le pied gauche reste posé : deux contraintes
  // pour une seule hauteur de bassin, on prend le milieu.
  const chute = (chuteBassin(f.mesures, -0.2, 1.4, 'genou') + chuteBassin(f.mesures, 1.5, 1.5, 'pied')) / 2;
  return {
    rotations: {
      cuisse_d: [0.2 * s1, 0, -0.1 * s1],
      jambe_d: [1.4 * s1, 0, 0],
      cuisse_g: [-1.5 * s1, 0, 0.1 * s1],
      jambe_g: [1.5 * s1, 0, 0],
      colonne: [0.25 * s1 + 0.12 * s3 - 0.06 * s4, 0.12 * s1, 0],
      tete: [0.3 * s1 + 0.05 * s3, 0.05 * s1, 0],
      bras_g: [-1.3 * s2 + 0.75 * s3, 0, 0.15 * s2],
      avant_bras_g: [-0.45 * s2 + 0.3 * s3, 0, 0],
      bras_d: [0.15 * s1, 0, -0.1 * s1],
      avant_bras_d: [-0.1 * s1, 0, 0],
    },
    bassin: [0, chute * s1, 0.02 * s1],
  };
}

// ---------------------------------------------------------------------------
// L'échantillonnage
// ---------------------------------------------------------------------------

/**
 * Une piste, réduite à deux images quand elle est constante : un os qui ne
 * bouge pas dans un clip ne coûte que sa pose de liaison, deux fois.
 */
function piste(
  nom: string, temps: readonly number[], valeurs: readonly number[], taille: number,
  fabrique: new (nom: string, temps: number[], valeurs: number[]) => THREE.KeyframeTrack,
): THREE.KeyframeTrack {
  let constante = true;
  for (let i = taille; i < valeurs.length && constante; i += 1) {
    if (Math.abs(valeurs[i]! - valeurs[i % taille]!) > 1e-7) constante = false;
  }
  if (constante) {
    const premiere = valeurs.slice(0, taille);
    return new fabrique(nom, [temps[0]!, temps[temps.length - 1]!], [...premiere, ...premiere]);
  }
  return new fabrique(nom, [...temps], [...valeurs]);
}

/** Échantillonne une fonction de pose en `nb` intervalles, pour toutes les figurines. */
function echantillonner(
  nom: string, duree: number, nb: number, figurines: readonly FigurineAnimee[],
  pose: (t: number, f: FigurineAnimee, duree: number) => Pose,
): THREE.AnimationClip {
  const temps = Array.from({ length: nb + 1 }, (_, i) => Number(((i / nb) * duree).toFixed(6)));
  const pistes: THREE.KeyframeTrack[] = [];
  for (const f of figurines) {
    const poses = temps.map((t) => pose(t, f, duree));
    for (const os of NOMS_OS) {
      const valeurs: number[] = [];
      for (const p of poses) {
        const [x, y, z] = p.rotations[os] ?? [0, 0, 0];
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
        valeurs.push(q.x, q.y, q.z, q.w);
      }
      pistes.push(piste(`${f.prefixe}_${os}.quaternion`, temps, valeurs, 4, THREE.QuaternionKeyframeTrack));
    }
    const repos = f.articulations.bassin;
    const positions: number[] = [];
    for (const p of poses) positions.push(repos.x + p.bassin[0], repos.y + p.bassin[1], repos.z + p.bassin[2]);
    pistes.push(piste(`${f.prefixe}_bassin.position`, temps, positions, 3, THREE.VectorKeyframeTrack));
  }
  return new THREE.AnimationClip(nom, duree, pistes);
}

/** Les six clips, dans l'ordre de la spécification. */
export function construireClips(figurines: readonly FigurineAnimee[], durees: Durees): THREE.AnimationClip[] {
  return [
    echantillonner('repos', durees.repos, 16, figurines, repos),
    echantillonner('deplacement', durees.deplacement, 20, figurines, deplacement),
    echantillonner('tir', durees.tir, 18, figurines, tir),
    echantillonner('touche', durees.touche, 12, figurines, touche),
    echantillonner('hors_jeu', durees.hors_jeu, 15, figurines, horsJeu),
    echantillonner('capture', durees.capture, 20, figurines, capture),
  ];
}
