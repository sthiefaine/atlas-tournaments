/**
 * Le décor : arbres, rochers et bâtiments.
 *
 * Deux exigences se répondent ici. La première est visuelle : une forêt doit
 * ressembler à une forêt et une ville à une ville, avec des fenêtres qui
 * s'allument la nuit. La seconde est budgétaire : une carte de soixante cases de
 * côté peut porter des milliers d'arbres, et un `Mesh` par arbre ferait fondre
 * la carte graphique. D'où l'`InstancedMesh` — un seul appel de dessin pour tous
 * les troncs, un autre pour toutes les couronnes — et un décor **déterministe**,
 * tiré d'un aléa de case : deux montages rendent exactement la même forêt.
 *
 * Les variantes saisonnières passent par la couleur des matériaux (feuillage
 * vert, doré, nu et enneigé, fleurs au printemps) plutôt que par des maillages
 * différents : c'est instantané au changement de journée.
 */

import * as THREE from 'three';

import { type StyleRegion } from '../assets/spec';
import { styleRegionParMecanique } from '../assets/styles';
import type { EtatPartie } from '../engine/index';
import { cleCase } from '../engine/index';
import { paletteDe } from '../render/palettes';
import type { CampId, Saison } from '../schemas/types';
import type { ParametresAmbiance } from './eclairage';
import { alea, CASE, type GrilleTerrain } from './geometrie';

/** Couleurs de feuillage par saison : c'est la saison qu'on voit d'abord. */
const FEUILLAGE: Readonly<Record<Saison, { conifere: number; feuillu: number }>> = {
  printemps: { conifere: 0x3f8a4a, feuillu: 0x74bf5c },
  ete: { conifere: 0x2f7a3d, feuillu: 0x4e9a3c },
  automne: { conifere: 0x4a7a44, feuillu: 0xc9782a },
  hiver: { conifere: 0x4c6a58, feuillu: 0x9aa79c },
};

/** Ce que `creerDecor` rend au rendu. */
export interface Decor {
  readonly groupe: THREE.Group;
  /** Reconstruit les bâtiments quand un propriétaire change. */
  majProprietaires(etat: EtatPartie): void;
  appliquerAmbiance(p: ParametresAmbiance, saison: Saison): void;
  /** Fait osciller les arbres. Rend vrai tant qu'il faut redessiner. */
  avancer(ms: number): boolean;
  dispose(): void;
}

/** Une place d'arbre tirée de l'aléa de case. */
interface Arbre {
  x: number;
  z: number;
  echelle: number;
  conifere: boolean;
  angle: number;
}

/** Tire les arbres d'une carte : deux à quatre par case de forêt. */
function semerArbres(g: GrilleTerrain): Arbre[] {
  const arbres: Arbre[] = [];
  for (let y = 0; y < g.hauteur; y += 1) {
    for (let x = 0; x < g.largeur; x += 1) {
      if (g.terrainDe(x, y) !== 'foret') continue;
      const nombre = 4 + Math.floor(alea(x, y, 1) * 3);
      for (let i = 0; i < nombre; i += 1) {
        const a = alea(x, y, 10 + i);
        const b = alea(x, y, 40 + i);
        const c = alea(x, y, 70 + i);
        arbres.push({
          x: x * CASE + 0.14 + a * 0.72,
          z: y * CASE + 0.14 + b * 0.72,
          echelle: 0.9 + c * 0.55,
          conifere: alea(x, y, 100 + i) > 0.45,
          angle: alea(x, y, 130 + i) * Math.PI * 2,
        });
      }
    }
  }
  return arbres;
}

/** Tire les rochers : un à trois par case de montagne, jamais au sommet exact. */
function semerRochers(g: GrilleTerrain): Arbre[] {
  const rochers: Arbre[] = [];
  for (let y = 0; y < g.hauteur; y += 1) {
    for (let x = 0; x < g.largeur; x += 1) {
      if (g.terrainDe(x, y) !== 'montagne') continue;
      const nombre = 2 + Math.floor(alea(x, y, 3) * 3);
      for (let i = 0; i < nombre; i += 1) {
        rochers.push({
          x: x * CASE + 0.14 + alea(x, y, 200 + i) * 0.72,
          z: y * CASE + 0.14 + alea(x, y, 230 + i) * 0.72,
          echelle: 0.5 + alea(x, y, 260 + i) * 0.75,
          conifere: false,
          angle: alea(x, y, 290 + i) * Math.PI * 2,
        });
      }
    }
  }
  return rochers;
}

/** Monte le décor complet. */
export function creerDecor(
  g: GrilleTerrain, etat: EtatPartie, hauteurEn: (x: number, z: number) => number,
): Decor {
  const groupe = new THREE.Group();
  groupe.name = 'decor';

  // --- Arbres
  const arbres = semerArbres(g);
  const geoTronc = new THREE.CylinderGeometry(0.028, 0.042, 0.2, 6);
  const matTronc = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.92 });
  const geoConifere = new THREE.ConeGeometry(0.16, 0.46, 7);
  const geoFeuillu = new THREE.IcosahedronGeometry(0.17, 0);
  const matConifere = new THREE.MeshStandardMaterial({ color: FEUILLAGE.ete.conifere, roughness: 0.82 });
  const matFeuillu = new THREE.MeshStandardMaterial({ color: FEUILLAGE.ete.feuillu, roughness: 0.84 });

  const troncs = new THREE.InstancedMesh(geoTronc, matTronc, Math.max(1, arbres.length));
  const coniferes = new THREE.InstancedMesh(
    geoConifere, matConifere, Math.max(1, arbres.filter((a) => a.conifere).length),
  );
  const feuillus = new THREE.InstancedMesh(
    geoFeuillu, matFeuillu, Math.max(1, arbres.filter((a) => !a.conifere).length),
  );
  for (const m of [troncs, coniferes, feuillus]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.count = 0;
    m.frustumCulled = false;
    groupe.add(m);
  }

  const mat4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const ech = new THREE.Vector3();
  const axe = new THREE.Vector3(0, 1, 0);

  function poserArbres(souffle: number): void {
    let iTronc = 0;
    let iCon = 0;
    let iFeu = 0;
    for (const a of arbres) {
      const sol = hauteurEn(a.x, a.z);
      const penche = Math.sin(souffle + a.angle) * 0.09 * oscillation;
      quat.setFromAxisAngle(axe, a.angle);
      pos.set(a.x, sol + 0.1 * a.echelle, a.z);
      ech.setScalar(a.echelle);
      mat4.compose(pos, quat, ech);
      troncs.setMatrixAt(iTronc, mat4);
      iTronc += 1;
      const hautCouronne = sol + (a.conifere ? 0.34 : 0.3) * a.echelle;
      quat.setFromEuler(new THREE.Euler(penche, a.angle, penche * 0.6));
      pos.set(a.x + penche * 0.12, hautCouronne, a.z + penche * 0.08);
      ech.set(a.echelle * (a.conifere ? 1 : 1.05), a.echelle * (a.conifere ? 1 : 0.9), a.echelle);
      mat4.compose(pos, quat, ech);
      if (a.conifere) {
        coniferes.setMatrixAt(iCon, mat4);
        iCon += 1;
      } else {
        feuillus.setMatrixAt(iFeu, mat4);
        iFeu += 1;
      }
    }
    troncs.count = iTronc;
    coniferes.count = iCon;
    feuillus.count = iFeu;
    troncs.instanceMatrix.needsUpdate = true;
    coniferes.instanceMatrix.needsUpdate = true;
    feuillus.instanceMatrix.needsUpdate = true;
  }

  // --- Rochers
  const rochers = semerRochers(g);
  const geoRocher = new THREE.DodecahedronGeometry(0.16, 0);
  const matRocher = new THREE.MeshStandardMaterial({ color: 0x8c929b, roughness: 0.95, flatShading: true });
  const blocs = new THREE.InstancedMesh(geoRocher, matRocher, Math.max(1, rochers.length));
  blocs.castShadow = true;
  blocs.receiveShadow = true;
  blocs.frustumCulled = false;
  blocs.count = rochers.length;
  rochers.forEach((r, i) => {
    quat.setFromEuler(new THREE.Euler(r.angle * 0.3, r.angle, r.angle * 0.2));
    pos.set(r.x, hauteurEn(r.x, r.z) + 0.06 * r.echelle, r.z);
    ech.set(r.echelle, r.echelle * 0.8, r.echelle * 1.1);
    mat4.compose(pos, quat, ech);
    blocs.setMatrixAt(i, mat4);
  });
  blocs.instanceMatrix.needsUpdate = true;
  groupe.add(blocs);

  // --- Bâtiments
  const batiments = new THREE.Group();
  batiments.name = 'batiments';
  groupe.add(batiments);
  const matFenetres = new THREE.MeshStandardMaterial({
    color: 0x2a3242, emissive: 0xffd98a, emissiveIntensity: 0.05, roughness: 0.25, metalness: 0.1,
  });
  // Le style régional, quand la carte en porte un : la mécanique de la carte dit
  // sa région (`content/mecaniques.json`), la région dit ses toits et ses murs.
  // Une carte sans mécanique garde les teintes neutres, ce qui est un cas normal.
  const styleRegion: StyleRegion | null = styleRegionParMecanique(etat.mecanique?.cle ?? null);
  const couleurMur = styleRegion ? styleRegion.murs.couleur : '#d9d3c6';
  const couleurToit = styleRegion ? styleRegion.toits.couleur : '#6d6a66';
  const matBeton = new THREE.MeshStandardMaterial({ color: couleurMur, roughness: 0.9 });
  const matToit = new THREE.MeshStandardMaterial({ color: couleurToit, roughness: 0.85 });
  const matsCamp = new Map<string, THREE.MeshStandardMaterial>();
  const geosBatiment: THREE.BufferGeometry[] = [];

  function matCamp(camp: CampId | null): THREE.MeshStandardMaterial {
    const cle = String(camp);
    const memo = matsCamp.get(cle);
    if (memo) return memo;
    const m = new THREE.MeshStandardMaterial({ color: paletteDe(camp).main, roughness: 0.62, metalness: 0.1 });
    matsCamp.set(cle, m);
    return m;
  }

  function bloc(
    l: number, h: number, p: number, mat: THREE.Material,
  ): THREE.Mesh {
    const geo = new THREE.BoxGeometry(l, h, p);
    geosBatiment.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function construireBatiments(e: EtatPartie): void {
    for (const enfant of [...batiments.children]) batiments.remove(enfant);
    for (let y = 0; y < g.hauteur; y += 1) {
      for (let x = 0; x < g.largeur; x += 1) {
        const terrain = g.terrainDe(x, y);
        if (!['ville', 'qg', 'usine', 'aeroport'].includes(terrain)) continue;
        const proprio = e.proprietaires[cleCase({ x, y })] ?? null;
        const cx = x * CASE + CASE / 2;
        const cz = y * CASE + CASE / 2;
        const sol = hauteurEn(cx, cz);
        const groupeCase = new THREE.Group();
        groupeCase.position.set(cx, sol, cz);
        const teinte = matCamp(proprio);

        if (terrain === 'ville') {
          const n = 2 + Math.floor(alea(x, y, 5) * 2);
          const places: [number, number][] = [[-0.17, -0.17], [0.18, 0.14], [0.16, -0.19]];
          for (let i = 0; i < n; i += 1) {
            const h = 0.34 + alea(x, y, 300 + i) * 0.36;
            const l = 0.26 + alea(x, y, 330 + i) * 0.1;
            const place = places[i] ?? [0, 0];
            const b = bloc(l, h, l, i === 0 ? teinte : matBeton);
            b.position.set(place[0], h / 2, place[1]);
            groupeCase.add(b);
            // Les fenêtres sont une ceinture légèrement plus large : la nuit,
            // c'est elle qui fait de la ville un phare (`04-gameplay.md` §12.3).
            const vitres = bloc(l * 1.02, h * 0.34, l * 0.62, matFenetres);
            vitres.position.set(place[0], h * 0.58, place[1]);
            vitres.castShadow = false;
            groupeCase.add(vitres);
            const toitPlat = bloc(l * 1.1, 0.04, l * 1.1, matToit);
            toitPlat.position.set(place[0], h + 0.02, place[1]);
            groupeCase.add(toitPlat);
          }
        } else if (terrain === 'qg') {
          const socle = bloc(0.66, 0.34, 0.66, teinte);
          socle.position.y = 0.17;
          groupeCase.add(socle);
          const etage = bloc(0.42, 0.3, 0.42, teinte);
          etage.position.y = 0.5;
          groupeCase.add(etage);
          const vitres = bloc(0.44, 0.12, 0.44, matFenetres);
          vitres.position.y = 0.5;
          vitres.castShadow = false;
          groupeCase.add(vitres);
          const couronne = bloc(0.5, 0.05, 0.5, matBeton);
          couronne.position.y = 0.67;
          groupeCase.add(couronne);
          const mat = new THREE.Mesh(
            new THREE.CylinderGeometry(0.014, 0.014, 0.5, 6), matBeton,
          );
          geosBatiment.push(mat.geometry);
          mat.position.set(0.2, 0.94, 0.2);
          mat.castShadow = true;
          groupeCase.add(mat);
          const fanion = bloc(0.26, 0.15, 0.008, teinte);
          fanion.position.set(0.34, 1.1, 0.2);
          groupeCase.add(fanion);
        } else if (terrain === 'usine') {
          const hangar = bloc(0.7, 0.3, 0.56, teinte);
          hangar.position.y = 0.15;
          groupeCase.add(hangar);
          const toit = new THREE.Mesh(
            new THREE.CylinderGeometry(0.29, 0.29, 0.7, 14, 1, false, 0, Math.PI), matToit,
          );
          geosBatiment.push(toit.geometry);
          toit.rotation.z = Math.PI / 2;
          toit.position.y = 0.3;
          toit.castShadow = true;
          toit.receiveShadow = true;
          groupeCase.add(toit);
          const porte = bloc(0.02, 0.2, 0.34, matFenetres);
          porte.position.set(0.36, 0.11, 0);
          porte.castShadow = false;
          groupeCase.add(porte);
          const cheminee = new THREE.Mesh(
            new THREE.CylinderGeometry(0.055, 0.07, 0.52, 8), matBeton,
          );
          geosBatiment.push(cheminee.geometry);
          cheminee.position.set(-0.26, 0.5, -0.2);
          cheminee.castShadow = true;
          groupeCase.add(cheminee);
        } else {
          const tour = bloc(0.24, 0.46, 0.24, teinte);
          tour.position.set(-0.24, 0.23, -0.22);
          groupeCase.add(tour);
          const terminal = bloc(0.56, 0.2, 0.36, teinte);
          terminal.position.set(0.12, 0.1, 0.14);
          groupeCase.add(terminal);
          const vitres = bloc(0.26, 0.1, 0.26, matFenetres);
          vitres.position.set(-0.24, 0.4, -0.22);
          vitres.castShadow = false;
          groupeCase.add(vitres);
        }
        batiments.add(groupeCase);
      }
    }
  }

  let signature = '';
  let oscillation = 0.12;
  let souffle = 0;

  function majProprietaires(e: EtatPartie): void {
    const cle = JSON.stringify(e.proprietaires);
    if (cle === signature) return;
    signature = cle;
    construireBatiments(e);
  }

  majProprietaires(etat);
  poserArbres(0);

  return {
    groupe,
    majProprietaires,

    appliquerAmbiance(p: ParametresAmbiance, saison: Saison): void {
      const f = FEUILLAGE[saison];
      const neige = p.neigeSol;
      matConifere.color.set(f.conifere).lerp(new THREE.Color(0xffffff), neige * 0.55);
      matFeuillu.color.set(f.feuillu).lerp(new THREE.Color(0xffffff), neige * 0.6);
      // Au printemps, les feuillus fleurissent : un soupçon de rose sur le vert.
      if (saison === 'printemps') matFeuillu.color.lerp(new THREE.Color(0xf3c6d8), 0.16);
      matTronc.color.set(0x6b4a2f).lerp(new THREE.Color(0xd8dde4), neige * 0.25);
      matRocher.color.set(0x8c929b).lerp(new THREE.Color(0xffffff), neige * 0.5);
      matBeton.color.set(couleurMur).lerp(new THREE.Color(p.teinteSol), 0.25);
      // Un toit d'ardoise ou de tôle blanchit sous la neige comme le reste.
      matToit.color.set(couleurToit).lerp(new THREE.Color(0xffffff), neige * 0.45);
      matFenetres.emissiveIntensity = p.fenetres;
      oscillation = p.oscillation;
      // L'hiver dénude les feuillus : on les rétrécit plutôt que de les cacher.
      feuillus.scale.setScalar(saison === 'hiver' ? 0.58 : 1);
    },

    avancer(ms: number): boolean {
      if (oscillation < 0.3) return false;
      souffle += ms / 320;
      poserArbres(souffle);
      return true;
    },

    dispose(): void {
      geoTronc.dispose();
      geoConifere.dispose();
      geoFeuillu.dispose();
      geoRocher.dispose();
      for (const g2 of geosBatiment) g2.dispose();
      matTronc.dispose();
      matConifere.dispose();
      matFeuillu.dispose();
      matRocher.dispose();
      matBeton.dispose();
      matToit.dispose();
      matFenetres.dispose();
      for (const m of matsCamp.values()) m.dispose();
    },
  };
}
