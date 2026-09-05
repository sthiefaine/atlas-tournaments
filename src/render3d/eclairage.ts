/**
 * L'éclairage : c'est **lui** qui dit la saison, l'heure et le temps qu'il fait.
 *
 * Le brief a tranché : « Saisons, jour et nuit et météo se voient par l'éclairage
 * et les matières, pas seulement par des palettes ». L'`ambiance = f(saison,
 * phase, météo)` du rendu 2D devient donc ici un **jeu de paramètres physiques** :
 * élévation et azimut du soleil, température de couleur, lumière hémisphérique,
 * densité de brouillard de scène, exposition, humidité des matières, hauteur de
 * neige au sol, et un calque de particules.
 *
 * `parametresAmbiance()` est une fonction **pure et mémorisée** : les 48
 * combinaisons (4 saisons × 2 phases × 6 météos) rendent 48 jeux de paramètres
 * distincts et bornés, ce que `tests/render3d/eclairage.test.ts` vérifie une par
 * une. Le reste du fichier n'est que de la plomberie three.js autour d'elles,
 * avec une interpolation douce d'environ 600 ms au changement de journée.
 */

import * as THREE from 'three';

import { melanger, teinter } from '../render/ambiance';
import type { Meteo, PhaseJour, Saison } from '../schemas/types';

/** Les cinq calques de particules possibles. */
export type CalqueParticules = 'aucune' | 'pluie' | 'neige' | 'brume' | 'poussiere';

/** Le calque de particules d'une ambiance. */
export interface ParticulesAmbiance {
  calque: CalqueParticules;
  /** Nombre de particules vivantes, 0 à 4000. */
  nombre: number;
  /** Vitesse de chute, en unités de scène par seconde. */
  vitesse: number;
  /** Inclinaison du vent, 0 (vertical) à 1 (couché). */
  inclinaison: number;
  taille: number;
  couleur: string;
  opacite: number;
}

/** Tout ce que l'éclairage 3D tire d'un climat. */
export interface ParametresAmbiance {
  soleil: { couleur: string; intensite: number; elevation: number; azimut: number };
  hemisphere: { ciel: string; sol: string; intensite: number };
  /** Couleur de fond de la scène. */
  ciel: string;
  brouillard: { couleur: string; densite: number };
  /** Exposition du rendu (`toneMappingExposure`). */
  exposition: number;
  /** Teinte multiplicative du sol : c'est la « saison dans la matière ». */
  teinteSol: string;
  /** Neige posée au sol, 0 à 1. */
  neigeSol: number;
  /** Humidité des matières : elle abaisse la rugosité, donc fait briller. */
  mouille: number;
  /** Oscillation des arbres, 0 à 1. */
  oscillation: number;
  /** Intensité émissive des fenêtres et des fanions. */
  fenetres: number;
  eau: { couleur: string; opacite: number; agitation: number };
  particules: ParticulesAmbiance;
}

// ---------------------------------------------------------------------------
// Les tables : saison, phase, météo
// ---------------------------------------------------------------------------

/** Température de couleur du soleil par saison : chaud l'été, bleuté l'hiver. */
const SOLEIL_SAISON: Readonly<Record<Saison, string>> = {
  printemps: '#ffeed2',
  ete: '#fff4c4',
  automne: '#ffd49a',
  hiver: '#dcebff',
};

/** Correction d'élévation du soleil par saison, en degrés. */
const ELEVATION_SAISON: Readonly<Record<Saison, number>> = {
  printemps: 0, ete: 9, automne: -6, hiver: -14,
};

/** Teinte du sol par saison : le feuillage et l'herbe changent de famille. */
const SOL_SAISON: Readonly<Record<Saison, string>> = {
  printemps: '#e9f3e0',
  ete: '#f3efd8',
  automne: '#f1e2cb',
  hiver: '#e7eef7',
};

/** Ciel et sol de la lumière hémisphérique, par saison. */
const HEMI_SAISON: Readonly<Record<Saison, { ciel: string; sol: string }>> = {
  printemps: { ciel: '#cfe4ff', sol: '#4e6b3e' },
  ete: { ciel: '#d6ecff', sol: '#5f6b33' },
  automne: { ciel: '#e7d9c0', sol: '#6b4f2c' },
  hiver: { ciel: '#dbe7f5', sol: '#8c99a8' },
};

/** Ce que la météo fait au reste : densités, facteurs et particules. */
interface EffetMeteo {
  densite: number;
  facteurIntensite: number;
  facteurExposition: number;
  mouille: number;
  neige: number;
  oscillation: number;
  voile: string;
  voileForce: number;
  particules: ParticulesAmbiance;
}

const METEO: Readonly<Record<Meteo, EffetMeteo>> = {
  clair: {
    densite: 0.004, facteurIntensite: 1, facteurExposition: 1, mouille: 0, neige: 0,
    oscillation: 0.12, voile: '#ffffff', voileForce: 0,
    particules: { calque: 'aucune', nombre: 0, vitesse: 0, inclinaison: 0, taille: 0, couleur: '#ffffff', opacite: 0 },
  },
  pluie: {
    densite: 0.020, facteurIntensite: 0.55, facteurExposition: 0.78, mouille: 0.75, neige: 0,
    oscillation: 0.35, voile: '#33455e', voileForce: 0.28,
    particules: { calque: 'pluie', nombre: 1400, vitesse: 17, inclinaison: 0.22, taille: 0.42, couleur: '#a8c8ee', opacite: 0.45 },
  },
  neige: {
    densite: 0.014, facteurIntensite: 0.72, facteurExposition: 0.94, mouille: 0.18, neige: 1,
    oscillation: 0.2, voile: '#dfe9f4', voileForce: 0.2,
    particules: { calque: 'neige', nombre: 1300, vitesse: 1.6, inclinaison: 0.14, taille: 0.13, couleur: '#ffffff', opacite: 0.95 },
  },
  brouillard: {
    densite: 0.075, facteurIntensite: 0.4, facteurExposition: 0.86, mouille: 0.35, neige: 0,
    oscillation: 0.08, voile: '#d5e0e8', voileForce: 0.4,
    particules: { calque: 'brume', nombre: 420, vitesse: 0.25, inclinaison: 0.9, taille: 0.55, couleur: '#e4ecf2', opacite: 0.16 },
  },
  tempete: {
    densite: 0.030, facteurIntensite: 0.4, facteurExposition: 0.66, mouille: 0.92, neige: 0,
    oscillation: 1, voile: '#2b3646', voileForce: 0.4,
    particules: { calque: 'pluie', nombre: 2600, vitesse: 26, inclinaison: 0.62, taille: 0.6, couleur: '#c2d6ee', opacite: 0.5 },
  },
  canicule: {
    densite: 0.010, facteurIntensite: 1.12, facteurExposition: 1.14, mouille: 0, neige: 0,
    oscillation: 0.05, voile: '#ffb547', voileForce: 0.14,
    particules: { calque: 'poussiere', nombre: 560, vitesse: 0.5, inclinaison: 0.75, taille: 0.14, couleur: '#e8cf9a', opacite: 0.3 },
  },
};

const MEMOIRE = new Map<string, ParametresAmbiance>();

/** Borne une valeur. */
function borner(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Les paramètres d'éclairage d'un climat. Pure et mémorisée : deux appels avec
 * le même triplet rendent le **même objet**, ce qui rend la comparaison triviale.
 */
export function parametresAmbiance(
  saison: Saison, phase: PhaseJour, meteo: Meteo,
): ParametresAmbiance {
  const cle = `${saison}:${phase}:${meteo}`;
  const memo = MEMOIRE.get(cle);
  if (memo) return memo;

  const m = METEO[meteo];
  const nuit = phase === 'nuit';
  const hemi = HEMI_SAISON[saison];

  // Le soleil : de jour la couleur de la saison, de nuit une lune froide qui
  // garde une trace de cette couleur — sans quoi deux saisons nocturnes
  // seraient identiques, ce qui n'est pas vrai à l'œil.
  const couleurSoleil = nuit
    ? melanger(SOLEIL_SAISON[saison], '#8fb4ff', 0.74)
    : SOLEIL_SAISON[saison];
  const elevation = borner((nuit ? 40 : 58) + ELEVATION_SAISON[saison] * (nuit ? 0.5 : 1), 12, 82);
  const azimut = nuit ? 302 : 132;
  const intensiteBase = nuit ? 1.05 : 3.15;

  const cielBase = nuit ? '#121d33' : melanger('#b9d6f2', hemi.ciel, 0.45);
  const ciel = melanger(cielBase, m.voile, m.voileForce * (nuit ? 0.5 : 1));

  const teinteSol = melanger(
    nuit ? melanger(SOL_SAISON[saison], '#5f7099', 0.45) : SOL_SAISON[saison],
    m.voile,
    m.voileForce * 0.35,
  );

  const eauBase = nuit ? '#101f33' : melanger('#2a6ea8', hemi.ciel, 0.14);

  const valeur: ParametresAmbiance = {
    soleil: {
      couleur: couleurSoleil,
      intensite: borner(intensiteBase * m.facteurIntensite, 0, 6),
      elevation,
      azimut,
    },
    hemisphere: {
      ciel: nuit ? melanger(hemi.ciel, '#22304f', 0.72) : hemi.ciel,
      sol: nuit ? teinter(hemi.sol, 0.45) : hemi.sol,
      intensite: borner((nuit ? 0.62 : 0.95) * (m.facteurIntensite * 0.5 + 0.5), 0, 3),
    },
    ciel,
    brouillard: {
      couleur: melanger(ciel, m.voile, 0.35),
      densite: borner(m.densite + (nuit ? 0.002 : 0), 0, 0.2),
    },
    exposition: borner((nuit ? 1.02 : 1) * m.facteurExposition, 0.4, 1.8),
    teinteSol,
    neigeSol: borner(Math.max(m.neige, saison === 'hiver' ? 0.55 : 0), 0, 1),
    mouille: borner(m.mouille, 0, 1),
    oscillation: borner(m.oscillation, 0, 1),
    fenetres: nuit ? 1 : 0.06,
    eau: {
      couleur: melanger(eauBase, m.voile, m.voileForce * 0.5),
      opacite: borner(nuit ? 0.97 : 0.94, 0, 1),
      agitation: borner(0.3 + m.oscillation * 0.7, 0, 1),
    },
    particules: { ...m.particules },
  };
  MEMOIRE.set(cle, valeur);
  return valeur;
}

/** Mélange linéaire de deux jeux de paramètres : la transition de journée. */
export function melangerParametres(
  a: ParametresAmbiance, b: ParametresAmbiance, t: number,
): ParametresAmbiance {
  const k = borner(t, 0, 1);
  const n = (x: number, y: number): number => x + (y - x) * k;
  const c = (x: string, y: string): string => melanger(x, y, k);
  return {
    soleil: {
      couleur: c(a.soleil.couleur, b.soleil.couleur),
      intensite: n(a.soleil.intensite, b.soleil.intensite),
      elevation: n(a.soleil.elevation, b.soleil.elevation),
      azimut: n(a.soleil.azimut, b.soleil.azimut),
    },
    hemisphere: {
      ciel: c(a.hemisphere.ciel, b.hemisphere.ciel),
      sol: c(a.hemisphere.sol, b.hemisphere.sol),
      intensite: n(a.hemisphere.intensite, b.hemisphere.intensite),
    },
    ciel: c(a.ciel, b.ciel),
    brouillard: {
      couleur: c(a.brouillard.couleur, b.brouillard.couleur),
      densite: n(a.brouillard.densite, b.brouillard.densite),
    },
    exposition: n(a.exposition, b.exposition),
    teinteSol: c(a.teinteSol, b.teinteSol),
    neigeSol: n(a.neigeSol, b.neigeSol),
    mouille: n(a.mouille, b.mouille),
    oscillation: n(a.oscillation, b.oscillation),
    fenetres: n(a.fenetres, b.fenetres),
    eau: {
      couleur: c(a.eau.couleur, b.eau.couleur),
      opacite: n(a.eau.opacite, b.eau.opacite),
      agitation: n(a.eau.agitation, b.eau.agitation),
    },
    // Le calque de particules ne s'interpole pas : il bascule, mais son nombre
    // monte progressivement, ce qui suffit à ne pas voir la coupure.
    particules: {
      ...(k < 0.5 ? a.particules : b.particules),
      nombre: Math.round(n(a.particules.nombre, b.particules.nombre)),
    },
  };
}

/** Direction du soleil depuis son élévation et son azimut, en unités de scène. */
export function directionSoleil(elevation: number, azimut: number, distance = 1): THREE.Vector3 {
  const e = (elevation * Math.PI) / 180;
  const a = (azimut * Math.PI) / 180;
  return new THREE.Vector3(
    Math.cos(e) * Math.sin(a) * distance,
    Math.sin(e) * distance,
    Math.cos(e) * Math.cos(a) * distance,
  );
}

// ---------------------------------------------------------------------------
// La plomberie three.js
// ---------------------------------------------------------------------------

/** Durée de la transition d'ambiance, en millisecondes. */
export const MS_TRANSITION = 600;

/** Ce que `creerEclairage` rend à la scène. */
export interface Eclairage {
  readonly groupe: THREE.Group;
  readonly soleil: THREE.DirectionalLight;
  /** Les paramètres réellement appliqués à cette image. */
  readonly courant: ParametresAmbiance;
  /** Vise une nouvelle ambiance ; `immediat` saute la transition. */
  viser(p: ParametresAmbiance, immediat?: boolean): void;
  /** Fait avancer transition et particules. Rend vrai s'il faut redessiner. */
  avancer(ms: number, centre: THREE.Vector3): boolean;
  dispose(): void;
}

/** Texture ronde et douce des flocons, poussières et nappes de brume. */
function textureGrain(doc: Document): THREE.Texture {
  const c = doc.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.65)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Nombre maximal de particules réservées : au-delà, on ne verrait plus la carte. */
const PARTICULES_MAX = 2600;

/**
 * Monte le soleil, la lune, la lumière hémisphérique, le brouillard de scène et
 * le calque de particules. Le groupe rendu est à ajouter à la scène ; l'appelant
 * garde la main sur la boucle, qui appelle `avancer()` à chaque image.
 */
export function creerEclairage(
  scene: THREE.Scene, doc: Document, depart: ParametresAmbiance,
): Eclairage {
  const groupe = new THREE.Group();
  groupe.name = 'eclairage';

  const soleil = new THREE.DirectionalLight(0xffffff, 1);
  soleil.castShadow = true;
  // 1024² suffit pour un plateau : la carte d'ombre couvre la carte entière et
  // quatre fois plus de texels coûtent quatre fois plus cher pour un liseré.
  soleil.shadow.mapSize.set(1024, 1024);
  soleil.shadow.bias = -0.0009;
  soleil.shadow.normalBias = 0.03;
  const cam = soleil.shadow.camera;
  cam.near = 0.5;
  cam.far = 120;
  groupe.add(soleil);
  groupe.add(soleil.target);

  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x404040, 1);
  groupe.add(hemisphere);

  // Un appoint frontal très doux : sans lui, les faces à l'ombre du soleil
  // deviennent des silhouettes noires et les unités cessent d'être lisibles.
  const appoint = new THREE.DirectionalLight(0xffffff, 0.25);
  groupe.add(appoint);

  const brouillard = new THREE.FogExp2(0xffffff, 0.01);
  scene.fog = brouillard;

  // --- Particules : des points pour la neige, la poussière et la brume, des
  //     segments pour la pluie et la tempête (une goutte est une traînée).
  const grain = textureGrain(doc);
  const posPoints = new Float32Array(PARTICULES_MAX * 3);
  const geoPoints = new THREE.BufferGeometry();
  geoPoints.setAttribute('position', new THREE.BufferAttribute(posPoints, 3));
  const matPoints = new THREE.PointsMaterial({
    map: grain, transparent: true, depthWrite: false, sizeAttenuation: true,
    size: 0.1, opacity: 0.8, blending: THREE.NormalBlending,
  });
  const points = new THREE.Points(geoPoints, matPoints);
  points.frustumCulled = false;
  points.visible = false;
  groupe.add(points);

  const posTraits = new Float32Array(PARTICULES_MAX * 6);
  const geoTraits = new THREE.BufferGeometry();
  geoTraits.setAttribute('position', new THREE.BufferAttribute(posTraits, 3));
  const matTraits = new THREE.LineBasicMaterial({
    transparent: true, depthWrite: false, opacity: 0.45,
  });
  const traits = new THREE.LineSegments(geoTraits, matTraits);
  traits.frustumCulled = false;
  traits.visible = false;
  groupe.add(traits);

  const ETENDUE = 26;
  const HAUT = 15;
  const etats = new Float32Array(PARTICULES_MAX * 4); // x, y, z, dérive
  for (let i = 0; i < PARTICULES_MAX; i += 1) {
    etats[i * 4] = (Math.random() - 0.5) * ETENDUE;
    etats[i * 4 + 1] = Math.random() * HAUT;
    etats[i * 4 + 2] = (Math.random() - 0.5) * ETENDUE;
    etats[i * 4 + 3] = Math.random() * Math.PI * 2;
  }

  let courant = depart;
  let source = depart;
  let cible = depart;
  let progression = 1;

  function appliquer(p: ParametresAmbiance): void {
    courant = p;
    soleil.color.set(p.soleil.couleur);
    soleil.intensity = p.soleil.intensite;
    const d = directionSoleil(p.soleil.elevation, p.soleil.azimut, 40);
    soleil.position.copy(d);
    appoint.color.set(p.hemisphere.ciel);
    appoint.intensity = p.soleil.intensite * 0.09 + 0.12;
    appoint.position.set(-d.x * 0.6, Math.abs(d.y) * 0.5, -d.z * 0.6);
    hemisphere.color.set(p.hemisphere.ciel);
    hemisphere.groundColor.set(p.hemisphere.sol);
    hemisphere.intensity = p.hemisphere.intensite;
    brouillard.color.set(p.brouillard.couleur);
    brouillard.density = p.brouillard.densite;
    scene.background = new THREE.Color(p.ciel);
    matPoints.color.set(p.particules.couleur);
    matPoints.size = Math.max(0.01, p.particules.taille);
    matPoints.opacity = p.particules.opacite;
    matTraits.color.set(p.particules.couleur);
    matTraits.opacity = p.particules.opacite;
    const pluie = p.particules.calque === 'pluie';
    points.visible = p.particules.nombre > 0 && !pluie;
    traits.visible = p.particules.nombre > 0 && pluie;
  }

  appliquer(depart);

  function avancer(ms: number, centre: THREE.Vector3): boolean {
    let encore = false;
    if (progression < 1) {
      progression = Math.min(1, progression + ms / MS_TRANSITION);
      appliquer(melangerParametres(source, cible, progression));
      encore = true;
    }
    soleil.target.position.copy(centre);
    soleil.target.updateMatrixWorld();
    soleil.position.copy(centre).add(directionSoleil(courant.soleil.elevation, courant.soleil.azimut, 40));
    soleil.updateMatrixWorld();

    const p = courant.particules;
    const n = Math.min(PARTICULES_MAX, Math.round(p.nombre));
    if (n > 0) {
      encore = true;
      const dt = Math.min(0.1, ms / 1000);
      const derive = p.inclinaison * p.vitesse;
      const pluie = p.calque === 'pluie';
      for (let i = 0; i < n; i += 1) {
        const b = i * 4;
        let y = (etats[b + 1] ?? 0) - p.vitesse * dt;
        let x = (etats[b] ?? 0) + derive * dt;
        let z = (etats[b + 2] ?? 0) + derive * dt * 0.4;
        const flotte = p.calque === 'neige' || p.calque === 'brume' || p.calque === 'poussiere';
        if (flotte) {
          const phi = (etats[b + 3] ?? 0) + dt * 1.4;
          etats[b + 3] = phi;
          x += Math.sin(phi) * dt * 0.6;
          z += Math.cos(phi * 0.7) * dt * 0.6;
        }
        if (y < -2) {
          y = HAUT;
          x = (Math.random() - 0.5) * ETENDUE;
          z = (Math.random() - 0.5) * ETENDUE;
        }
        if (x > ETENDUE / 2) x -= ETENDUE;
        if (z > ETENDUE / 2) z -= ETENDUE;
        etats[b] = x;
        etats[b + 1] = y;
        etats[b + 2] = z;
        const wx = centre.x + x;
        const wy = y;
        const wz = centre.z + z;
        if (pluie) {
          const j = i * 6;
          posTraits[j] = wx;
          posTraits[j + 1] = wy;
          posTraits[j + 2] = wz;
          posTraits[j + 3] = wx - derive * 0.045;
          posTraits[j + 4] = wy + p.vitesse * 0.045;
          posTraits[j + 5] = wz - derive * 0.018;
        } else {
          const j = i * 3;
          posPoints[j] = wx;
          posPoints[j + 1] = wy;
          posPoints[j + 2] = wz;
        }
      }
      if (pluie) {
        geoTraits.setDrawRange(0, n * 2);
        const attr = geoTraits.attributes['position'];
        if (attr) attr.needsUpdate = true;
      } else {
        geoPoints.setDrawRange(0, n);
        const attr = geoPoints.attributes['position'];
        if (attr) attr.needsUpdate = true;
      }
    }
    return encore;
  }

  return {
    groupe,
    soleil,
    get courant() { return courant; },
    viser: (p, immediat = false) => {
      if (immediat) {
        source = p;
        cible = p;
        progression = 1;
        appliquer(p);
        return;
      }
      source = courant;
      cible = p;
      progression = 0;
    },
    avancer,
    dispose: () => {
      grain.dispose();
      geoPoints.dispose();
      geoTraits.dispose();
      matPoints.dispose();
      matTraits.dispose();
      scene.fog = null;
    },
  };
}
