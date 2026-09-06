/**
 * Les unités en 3D : des **placeholders composés depuis la `Silhouette`**, et un
 * chemin de remplacement par vrai modèle qui ne casse jamais.
 *
 * Depuis l'arbitrage du 5 septembre 2026 au soir, le placeholder ne se contente
 * plus d'un palette swap. Quand la nation qui joue est connue, il lit son
 * **style national** (`content/styles/<code>.json`) et en applique quatre
 * choses, dans cet ordre de visibilité :
 *
 * 1. la **palette du style** — `main` sur les grandes surfaces, `dark` sur les
 *    ombres propres, `light` sur les arêtes, et le premier **accent** sur les
 *    ornements : c'est ce qui distingue deux nations de teinte voisine ;
 * 2. le **liseré d'équipe sur le socle** — un anneau plat à la couleur du camp,
 *    et **le seul endroit** où la couleur d'équipe subsiste : deux joueurs d'une
 *    même nation restent distinguables sans que la nation devienne une teinte ;
 * 3. un ou deux **ornements simples** (antenne, fanion) pris dans la liste
 *    fermée du style ; le reste des ornements appartient au kit livré ;
 * 4. le **gabarit** `a | b | c`, qui étire ou ramasse les proportions.
 *
 * Sans nation connue — un aperçu, un test, un camp neutre — rien de tout cela ne
 * manque : on retombe sur la palette de camp, le gabarit `b` et un socle sans
 * ornement. Le placeholder n'a jamais besoin du canon pour fonctionner.
 *
 * `chargerModele()` tente le **kit national** puis la **géométrie de base**, et
 * **retombe silencieusement sur le placeholder** si aucun des deux n'existe : le
 * jeu tourne pendant que les assets se font attendre, exactement comme le brief
 * l'exige (`doc/10-rendu-3d.md` §7.1).
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// On importe les deux modules précis plutôt que `assets/index` : le point
// d'entrée tire aussi le catalogue de spécifications, dont le rendu n'a que
// faire, et avec lui les 24 fiches pays. Ce qui n'est pas importé n'est pas
// embarqué dans le bundle du jeu.
import { gabaritDe, type Gabarit, type StyleNation } from '../assets/spec';
import { chargerStyleNation } from '../assets/styles';
import type { Catalogue, EtatPartie, Unite } from '../engine/index';
import { cleCase, pvAffiches } from '../engine/index';
import { paletteDe } from '../render/palettes';
import type { CampId, CleUnite, CodePays, Palette, Silhouette } from '../schemas/types';
import { CASE, NIVEAU_EAU } from './geometrie';
import {
  composerSilhouette, echelleTaille, hauteurSilhouette, type Piece, type RolePiece,
} from './pieces';

/** Les matériaux neutres, partagés par toutes les nations. */
const NEUTRES: Readonly<Record<'materiel' | 'verre' | 'roulant' | 'peau', number>> = {
  materiel: 0x515c65,
  verre: 0x70bbd2,
  roulant: 0x222b31,
  // Un seul ton de peau pour toutes les nations, mat : celui d'une figurine peinte.
  peau: 0xc9946c,
};

/** Proportions d'un gabarit : longueur (X), hauteur (Y), largeur (Z). */
const PROPORTIONS: Readonly<Record<Gabarit, [number, number, number]>> = {
  a: [0.9, 0.98, 1.06],
  b: [1, 1, 1],
  c: [1.14, 1.06, 0.95],
};

/** Les ornements que le placeholder sait poser lui-même. Le reste vient du kit. */
const ORNEMENTS_PLACEHOLDER = ['antenne', 'fanion'] as const;

/** Un jeu de matériaux par camp et par style : c'est là que vit la couleur. */
export class Materiaux {
  private readonly jeux = new Map<string, Record<RolePiece, THREE.MeshStandardMaterial>>();
  private readonly liseres = new Map<string, THREE.MeshStandardMaterial>();
  private readonly ternis = new Map<THREE.MeshStandardMaterial, THREE.MeshStandardMaterial>();

  jeu(camp: CampId | null, style: StyleNation | null): Record<RolePiece, THREE.MeshStandardMaterial> {
    const cle = `${String(camp)}:${style?.code ?? ''}`;
    const memo = this.jeux.get(cle);
    if (memo) return memo;
    // La nation donne la couleur ; le camp ne la donne que faute de nation.
    const p: Palette = style ? style.palette : paletteDe(camp);
    const accent = style?.palette.accents[0] ?? p.light;
    const jeu: Record<RolePiece, THREE.MeshStandardMaterial> = {
      principal: new THREE.MeshStandardMaterial({ color: p.main, emissive: p.main, emissiveIntensity: 0.12, roughness: 0.42, metalness: 0.22 }),
      sombre: new THREE.MeshStandardMaterial({ color: p.dark, roughness: 0.6, metalness: 0.2 }),
      clair: new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.08, roughness: 0.46, metalness: 0.14 }),
      materiel: new THREE.MeshStandardMaterial({ color: NEUTRES.materiel, roughness: 0.42, metalness: 0.62 }),
      verre: new THREE.MeshStandardMaterial({ color: NEUTRES.verre, roughness: 0.19, metalness: 0.42, emissive: 0x153748, emissiveIntensity: 0.24 }),
      roulant: new THREE.MeshStandardMaterial({ color: NEUTRES.roulant, roughness: 0.85, metalness: 0.12 }),
      peau: new THREE.MeshStandardMaterial({ color: NEUTRES.peau, roughness: 0.78, metalness: 0 }),
    };
    this.jeux.set(cle, jeu);
    return jeu;
  }

  /** Le matériau du liseré de socle : la couleur d'équipe, et rien d'autre. */
  lisere(camp: CampId | null): THREE.MeshStandardMaterial {
    const cle = String(camp);
    const memo = this.liseres.get(cle);
    if (memo) return memo;
    const m = new THREE.MeshStandardMaterial({
      color: paletteDe(camp).main, roughness: 0.4, metalness: 0.1,
    });
    this.liseres.set(cle, m);
    return m;
  }

  /**
   * Le double **terni** d'un matériau : celui qu'une unité porte quand elle a
   * déjà joué. Mémorisé par matériau d'origine, donc créé une fois par couple
   * (camp, style) et jamais par image ; l'original n'est **jamais** modifié,
   * c'est ce qui garantit qu'une unité réveillée retrouve ses couleurs au bit
   * près — on lui rend l'objet même, pas une reconstruction.
   *
   * La désaturation est franche (un quart de la saturation, des deux tiers de la
   * clarté) parce qu'un gris timide ne se lit pas à 48 px par case ; l'émission
   * colorée disparaît — c'est elle qui fait « vivre » une pièce — au profit
   * d'une lueur neutre très faible, qui empêche la pièce de devenir un trou
   * noir de nuit sans la faire briller de jour. La rugosité monte : une pièce
   * qui a joué est mate, elle n'accroche plus la lumière.
   */
  terni(origine: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
    const memo = this.ternis.get(origine);
    if (memo) return memo;
    const m = origine.clone();
    origine.color.getHSL(hsl, THREE.SRGBColorSpace);
    m.color.setHSL(hsl.h, hsl.s * 0.25, hsl.l * 0.62, THREE.SRGBColorSpace);
    m.emissive.set(0x1c1d20);
    m.emissiveIntensity = 0.35;
    m.roughness = Math.min(1, origine.roughness + 0.3);
    m.metalness = origine.metalness * 0.5;
    this.ternis.set(origine, m);
    return m;
  }

  dispose(): void {
    for (const jeu of this.jeux.values()) {
      for (const m of Object.values(jeu)) m.dispose();
    }
    this.jeux.clear();
    for (const m of this.liseres.values()) m.dispose();
    this.liseres.clear();
    for (const m of this.ternis.values()) m.dispose();
    this.ternis.clear();
  }
}

/** Tampon de conversion HSL, partagé : `terni` n'alloue rien par appel. */
const hsl = { h: 0, s: 0, l: 0 };

const geometries = new Map<string, THREE.BufferGeometry>();

/**
 * Une boîte **biseautée** : c'est ce biseau, large de deux à trois centimètres
 * de scène, qui fait la différence entre un cube de démonstration et une pièce
 * qui accroche la lumière sur ses arêtes.
 */
function boiteBiseautee(l: number, h: number, p: number, biseau: number): THREE.BufferGeometry {
  const cle = `b:${l}:${h}:${p}:${biseau}`;
  const memo = geometries.get(cle);
  if (memo) return memo;
  const b = Math.min(biseau, l / 2.6, h / 2.6, p / 2.6);
  const forme = new THREE.Shape();
  const L = l - 2 * b;
  const P = p - 2 * b;
  const r = Math.min(b * 1.6, L / 3, P / 3);
  forme.moveTo(-L / 2 + r, -P / 2);
  forme.lineTo(L / 2 - r, -P / 2);
  forme.quadraticCurveTo(L / 2, -P / 2, L / 2, -P / 2 + r);
  forme.lineTo(L / 2, P / 2 - r);
  forme.quadraticCurveTo(L / 2, P / 2, L / 2 - r, P / 2);
  forme.lineTo(-L / 2 + r, P / 2);
  forme.quadraticCurveTo(-L / 2, P / 2, -L / 2, P / 2 - r);
  forme.lineTo(-L / 2, -P / 2 + r);
  forme.quadraticCurveTo(-L / 2, -P / 2, -L / 2 + r, -P / 2);
  const geo = new THREE.ExtrudeGeometry(forme, {
    depth: Math.max(0.001, h - 2 * b),
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 1,
    curveSegments: 2,
    steps: 1,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -(h - 2 * b) / 2 - b + h / 2 - h / 2, 0);
  geo.center();
  geo.computeVertexNormals();
  geometries.set(cle, geo);
  return geo;
}

/** La géométrie d'une pièce, mémorisée par dimensions. */
function geometriePiece(p: Piece): THREE.BufferGeometry {
  const [l, h, la] = p.taille;
  const cle = `${p.forme}:${l}:${h}:${la}`;
  const memo = geometries.get(cle);
  if (memo) return memo;
  let geo: THREE.BufferGeometry;
  switch (p.forme) {
    // Les petites pièces — un œil, un doigt de canon, un avant-bras — prennent
    // moins de méridiens : à leur taille, la différence ne se voit pas, et une
    // figurine détaillée en compte trente.
    case 'cylindre':
      geo = new THREE.CylinderGeometry(l / 2, la / 2, h, Math.max(l, la) < 0.04 ? 8 : 12, 1);
      break;
    case 'capsule':
      // Un membre de figurine fait cinq centièmes de case de diamètre : sept
      // méridiens et une calotte d'un segment suffisent, et c'est quatre fois moins
      // de triangles qu'une capsule lisse.
      geo = l < 0.08
        ? new THREE.CapsuleGeometry(l / 2, Math.max(0.01, h - l), 1, 7)
        : new THREE.CapsuleGeometry(l / 2, Math.max(0.01, h - l), 3, 10);
      break;
    case 'sphere': {
      const d = Math.max(l, h, la);
      geo = d < 0.05 ? new THREE.SphereGeometry(0.5, 6, 4)
        : d < 0.07 ? new THREE.SphereGeometry(0.5, 8, 5)
          : d < 0.12 ? new THREE.SphereGeometry(0.5, 10, 6)
            : new THREE.SphereGeometry(0.5, 12, 8);
      geo.scale(l, h, la);
      break;
    }
    case 'cone':
      geo = new THREE.ConeGeometry(Math.max(l, la) / 2, h, 4, 1);
      break;
    case 'plaque':
      if (Math.min(l, h, la) <= 0.022) { geo = new THREE.BoxGeometry(l, h, la); break; }
      return boiteBiseautee(l, h, la, Math.min(l, h, la) * 0.3);
    default: {
      // Un biseau de deux centièmes ne se voit ni sur une sacoche ni sur un
      // chargeur : une pièce mince — ses deux plus petites cotes sous quatre
      // centièmes — est une boîte nue à douze triangles, huit fois moins qu'une
      // boîte biseautée. Le biseau reste aux masses : tronc, bassin, sac, bottes.
      const cotes = [l, h, la].sort((a, b) => a - b);
      if (cotes[1]! <= 0.04) { geo = new THREE.BoxGeometry(l, h, la); break; }
      return boiteBiseautee(l, h, la, Math.min(l, h, la) * 0.22);
    }
  }
  geometries.set(cle, geo);
  return geo;
}

const silhouettesFusionnees = new Map<string, ReadonlyMap<RolePiece, THREE.BufferGeometry>>();

/** Sept maillages au maximum — un par rôle —, partagés entre unités identiques : le détail ne multiplie pas les draw calls. */
export function geometriesSilhouette(s: Silhouette): ReadonlyMap<RolePiece, THREE.BufferGeometry> {
  const cle = JSON.stringify(s);
  const memo = silhouettesFusionnees.get(cle);
  if (memo) return memo;
  const parRole = new Map<RolePiece, THREE.BufferGeometry[]>();
  const transformation = new THREE.Object3D();
  for (const piece of composerSilhouette(s)) {
    if (s.base === 'rotor' && piece.nom.startsWith('pale_')) continue;
    transformation.position.set(...piece.position);
    transformation.rotation.set(...(piece.rotation ?? [0, 0, 0]));
    transformation.updateMatrix();
    const source = geometriePiece(piece);
    const geo = source.index ? source.toNonIndexed() : source.clone();
    geo.applyMatrix4(transformation.matrix);
    const liste = parRole.get(piece.role) ?? [];
    liste.push(geo);
    parRole.set(piece.role, liste);
  }
  const fusionnees = new Map<RolePiece, THREE.BufferGeometry>();
  for (const [role, morceaux] of parRole) {
    const fusion = mergeGeometries(morceaux, false);
    if (fusion) {
      fusion.computeBoundingSphere();
      fusionnees.set(role, fusion);
    }
    for (const morceau of morceaux) morceau.dispose();
  }
  silhouettesFusionnees.set(cle, fusionnees);
  return fusionnees;
}

/** Un disque plat, mémorisé par rayon et hauteur : socle et liseré. */
function disque(rayon: number, hauteur: number): THREE.BufferGeometry {
  const cle = `d:${rayon}:${hauteur}`;
  const memo = geometries.get(cle);
  if (memo) return memo;
  const geo = new THREE.CylinderGeometry(rayon, rayon, hauteur, 20, 1);
  geometries.set(cle, geo);
  return geo;
}

/**
 * Le socle et son **liseré d'équipe** : un disque sombre, et sous lui un disque
 * un peu plus large à la couleur du camp, dont ne dépasse qu'un anneau. C'est le
 * seul reste du masque de couleur d'équipe (`BRIEF.md`) : jamais la seule
 * différence entre deux unités, toujours présent pour la lisibilité.
 */
function piecesSocle(camp: CampId | null, materiaux: Materiaux, jeu: Record<RolePiece, THREE.MeshStandardMaterial>): THREE.Mesh[] {
  const anneau = new THREE.Mesh(disque(0.39, 0.024), materiaux.lisere(camp));
  anneau.name = 'socle_lisere';
  anneau.position.set(0, 0.009, 0);
  anneau.receiveShadow = true;
  const plateau = new THREE.Mesh(disque(0.30, 0.028), jeu.sombre);
  plateau.name = 'socle';
  plateau.position.set(0, 0.014, 0);
  plateau.castShadow = true;
  plateau.receiveShadow = true;
  // Les encoches claires identifient aussi le camp sans dépendre de la couleur.
  const reperes: THREE.Mesh[] = [];
  for (let i = 0; i < (camp === null ? 0 : camp + 1); i += 1) {
    const repere = new THREE.Mesh(boiteBiseautee(0.06, 0.012, 0.09, 0.003), jeu.verre);
    repere.name = `socle_repere_${i}`;
    const angle = -Math.PI / 2 + (i - (camp ?? 0) / 2) * 0.28;
    repere.position.set(Math.cos(angle) * 0.345, 0.03, Math.sin(angle) * 0.345);
    repere.rotation.y = -angle;
    reperes.push(repere);
  }
  return [anneau, plateau, ...reperes];
}

/**
 * Les ornements que le code sait poser : une antenne fouet et un fanion, pris
 * dans le style de la nation quand elle en déclare. Deux au plus — au-delà, la
 * silhouette se brouille, et c'est le travail du kit livré, pas du placeholder.
 */
function piecesOrnements(
  style: StyleNation | null, hauteur: number, jeu: Record<RolePiece, THREE.MeshStandardMaterial>,
): THREE.Mesh[] {
  if (!style) return [];
  const poses: THREE.Mesh[] = [];
  for (const nom of ORNEMENTS_PLACEHOLDER) {
    if (!(style.ornements as readonly string[]).includes(nom)) continue;
    if (nom === 'antenne') {
      const tige = new THREE.Mesh(disque(0.008, 0.26), jeu.materiel);
      tige.name = 'ornement_antenne';
      tige.position.set(-0.16, hauteur + 0.13, 0.1);
      tige.castShadow = true;
      poses.push(tige);
    } else {
      const toile = new THREE.Mesh(boiteBiseautee(0.11, 0.07, 0.012, 0.006), jeu.clair);
      toile.name = 'ornement_fanion';
      toile.position.set(0.13, hauteur + 0.1, -0.09);
      toile.castShadow = true;
      poses.push(toile);
    }
  }
  return poses;
}

/**
 * Monte un placeholder complet depuis une silhouette, habillé du style de sa
 * nation quand elle est connue : palette, gabarit, socle à liseré d'équipe et
 * un ou deux ornements simples.
 */
export function construirePlaceholder(
  s: Silhouette, camp: CampId | null, materiaux: Materiaux,
  style: StyleNation | null = null, cleUnite: CleUnite = '',
): THREE.Group {
  const groupe = new THREE.Group();
  const jeu = materiaux.jeu(camp, style);
  for (const m of piecesSocle(camp, materiaux, jeu)) groupe.add(m);
  const modele = new THREE.Group();
  modele.name = 'figurine_modele';
  groupe.add(modele);
  for (const [role, geometrie] of geometriesSilhouette(s)) {
    const maille = new THREE.Mesh(geometrie, jeu[role]);
    maille.name = `silhouette_${role}`;
    maille.castShadow = true;
    maille.receiveShadow = true;
    modele.add(maille);
  }
  if (s.base === 'rotor') {
    const rotor = new THREE.Group();
    rotor.name = 'rotor_anime';
    rotor.position.set(0.02, 0.41, 0);
    for (const piece of composerSilhouette(s).filter((p) => p.nom.startsWith('pale_'))) {
      const maille = new THREE.Mesh(geometriePiece(piece), jeu[piece.role]);
      maille.name = piece.nom;
      maille.position.set(piece.position[0] - 0.02, piece.position[1] - 0.41, piece.position[2]);
      maille.castShadow = true;
      rotor.add(maille);
    }
    modele.add(rotor);
  }
  // Une troupe à pied ne porte pas de mât : l'antenne et le fanion du style
  // flotteraient entre les têtes. Sa nation se lit sur le bandeau du casque et
  // le rouleau de couchage, qui prennent déjà la couleur d'accent.
  if (s.base !== 'pattes') for (const m of piecesOrnements(style, hauteurSilhouette(s), jeu)) groupe.add(m);
  const e = echelleTaille(s.taille);
  const g = style && cleUnite !== '' ? gabaritDe(style, cleUnite) : 'b';
  const [gx, gy, gz] = PROPORTIONS[g];
  groupe.scale.set(e * gx, e * gy, e * gz);
  return groupe;
}

// ---------------------------------------------------------------------------
// Modèles glTF : l'échappatoire vers les vrais assets
// ---------------------------------------------------------------------------

const modeles = new Map<string, Promise<THREE.Group | null>>();
let chargeur: GLTFLoader | null = null;

/** Racine des modèles livrés par le générateur externe. */
export const RACINE_MODELES = '/assets/modeles';

/** Tente un seul fichier. Rend `null` — jamais une exception — s'il n'existe pas. */
function chargerFichier(id: string): Promise<THREE.Group | null> {
  return new Promise<THREE.Group | null>((resoudre) => {
    try {
      chargeur = chargeur ?? new GLTFLoader();
      chargeur.load(
        `${RACINE_MODELES}/${id}.glb`,
        (gltf) => resoudre(gltf.scene),
        undefined,
        () => resoudre(null),
      );
    } catch {
      resoudre(null);
    }
  }).catch(() => null);
}

/**
 * Charge le modèle d'une unité **pour une nation donnée**, dans l'ordre de repli
 * de `doc/10-rendu-3d.md` §7.1 :
 *
 * ```
 * 1. kit national      kit_<pays>_<unite>.glb
 * 2. géométrie de base unite_<cle>_base.glb
 * 3. rien              → le placeholder reste en place
 * ```
 *
 * Rend `null` — jamais une exception — quand aucun des deux n'existe encore, ce
 * qui est l'état normal du projet tant que le générateur n'a rien livré. Le
 * résultat est mémorisé par couple : un 404 n'est demandé qu'une fois.
 */
export function chargerModele(cle: CleUnite, pays: CodePays | null = null): Promise<THREE.Group | null> {
  const memoCle = `${pays ?? ''}:${cle}`;
  const memo = modeles.get(memoCle);
  if (memo) return memo;
  const candidats = pays === null
    ? [`unite_${cle}_base`, cle]
    : [`kit_${pays}_${cle}`, `unite_${cle}_base`, cle];
  const promesse = (async (): Promise<THREE.Group | null> => {
    for (const id of candidats) {
      const lu = await chargerFichier(id);
      if (lu) return lu;
    }
    return null;
  })();
  modeles.set(memoCle, promesse);
  return promesse;
}

/**
 * Teinte un modèle chargé. Un kit national arrive déjà peint : seuls ses
 * matériaux `equipe*` — le liseré de socle — prennent la couleur du camp, et ses
 * matériaux `accent*` le premier accent du style. Une géométrie de base, elle,
 * est entièrement neutre : c'est le même geste qui la colore en entier.
 */
export function teinterModele(objet: THREE.Object3D, camp: CampId | null): void {
  const p = paletteDe(camp);
  objet.traverse((n) => {
    if (!(n instanceof THREE.Mesh)) return;
    n.castShadow = true;
    n.receiveShadow = true;
    const materiaux = Array.isArray(n.material) ? n.material : [n.material];
    for (const m of materiaux) {
      if (!(m instanceof THREE.MeshStandardMaterial)) continue;
      if (m.name.startsWith('equipe')) m.color.set(p.main);
      else if (m.name.startsWith('accent')) m.color.set(p.light);
    }
  });
}

// ---------------------------------------------------------------------------
// Le calque des unités
// ---------------------------------------------------------------------------

/** L'état visuel d'une unité : ce que les animations poussent, image par image. */
export interface EtatVisuel {
  /** Décalage par rapport à sa case, en unités de scène. */
  dx: number;
  dz: number;
  dy: number;
  /** Orientation, en radians autour de l'axe vertical. */
  cap: number;
  /** Recul de tir, le long du cap. */
  recul: number;
  /** Secousse d'impact. */
  secousse: number;
  opacite: number;
  affaissement: number;
}

/** Un état visuel neutre. */
function etatNeutre(): EtatVisuel {
  return { dx: 0, dz: 0, dy: 0, cap: 0, recul: 0, secousse: 0, opacite: 1, affaissement: 0 };
}

/** Réglages du calque des unités. */
export interface OptionsUnites {
  /**
   * La nation de chaque camp, quand elle est connue : c'est elle qui décide du
   * style national appliqué au placeholder. Un camp absent de la table joue avec
   * sa seule couleur d'équipe, ce qui reste un état parfaitement valide.
   */
  paysParCamp?: Partial<Record<CampId, CodePays>>;
}

/** Ce que `creerUnites` rend au rendu. */
export interface CalqueUnites {
  readonly groupe: THREE.Group;
  /**
   * Avance les rotors, la respiration des figurines et le tassement des unités
   * qui ont joué, sans déplacer les socles. Sous réduction des animations,
   * rien ne tourne ni ne respire, et le tassement s'applique d'un coup.
   */
  avancer(ms: number, mouvementReduit?: boolean): boolean;
  /** Synchronise les maillages avec l'état. */
  maj(etat: EtatPartie, cat: Catalogue, visibles: ReadonlySet<string> | null): void;
  /**
   * Déclare la nation d'un camp après coup — le scénario la connaît, le rendu
   * l'apprend. Les unités déjà posées sont reconstruites au prochain `maj`.
   */
  definirPays(camp: CampId, code: CodePays | null): void;
  /** L'état visuel modifiable d'une unité : c'est la prise des animations. */
  visuel(id: string): EtatVisuel;
  /** Garde une unité à l'écran après sa disparition de l'état (mise hors jeu). */
  retenir(u: Unite): void;
  /** Relâche une unité retenue. */
  liberer(id: string): void;
  /** Position monde du centre d'une unité, ou `null`. */
  positionDe(id: string): THREE.Vector3 | null;
  /** Hauteur d'accroche de l'étiquette de PV. */
  sommetDe(id: string): number;
  dispose(): void;
}

interface Entree {
  id: string;
  type: CleUnite;
  camp: CampId;
  groupe: THREE.Group;
  corps: THREE.Group;
  etiquette: THREE.Sprite | null;
  sommet: number;
  pv: number;
  rotor: THREE.Object3D | null;
  figurines: THREE.Object3D | null;
  /**
   * `null` tant que l'unité n'a pas été posée : la première pose applique
   * l'aspect d'un coup, sans transition — une pièce qui apparaît déjà tassée
   * n'a rien à « rejouer ».
   */
  agie: boolean | null;
  /** Enfoncement courant de la figurine, en unités de scène ; tend vers `TASSEMENT` ou 0. */
  tassement: number;
}

/**
 * De combien une unité qui a joué **s'affaisse** : trois centimètres et demi
 * de scène. Assez pour que la figurine s'enfonce visiblement dans son socle,
 * pas assez pour que le liseré d'équipe disparaisse sous le sol.
 */
export const TASSEMENT = 0.035;
/** Vitesse du tassement, en unités de scène par seconde : un quart de seconde environ. */
const VITESSE_TASSEMENT = 0.16;

/** Texture d'étiquette de PV, mémorisée par (points de vie, camp, a joué). */
const etiquettes = new Map<string, THREE.SpriteMaterial>();

/** Côté du canevas d'étiquette, en pixels ; une pastille de PV le remplit. */
const COTE_ETIQUETTE = 64;
/** Largeur ajoutée quand la pastille porte aussi le cadenas : elle devient une gélule. */
const LARGEUR_CADENAS = 40;

/**
 * Le **cadenas** d'une unité qui a joué : un corps plein et une anse, en blanc
 * comme le chiffre de PV. Vectoriel et sans texte — un glyphe de police
 * changerait d'une machine à l'autre, et « Zz » ne se traduit pas. À 48 px par
 * case l'étiquette fait quatorze pixels de haut : seule une forme pleine et
 * massive y survit, d'où un corps qui occupe la moitié de la hauteur.
 */
function dessinerCadenas(g: CanvasRenderingContext2D, cx: number, cy: number, h: number): void {
  const corpsL = h * 0.62;
  const corpsH = h * 0.46;
  const anseR = h * 0.2;
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#ffffff';
  g.lineWidth = Math.max(3, h * 0.13);
  g.beginPath();
  g.arc(cx, cy - corpsH / 2 + h * 0.02, anseR, Math.PI, 0);
  g.stroke();
  g.fillRect(cx - corpsL / 2, cy - corpsH / 2 + h * 0.06, corpsL, corpsH);
}

function materiauEtiquette(doc: Document, pv: number, camp: CampId, agie: boolean): THREE.SpriteMaterial {
  const cle = `${pv}:${camp}:${agie ? 'a' : 'p'}`;
  const memo = etiquettes.get(cle);
  if (memo) return memo;
  const chiffre = pv < 10;
  const hauteur = COTE_ETIQUETTE;
  // Trois formes : la pastille du chiffre seul, la pastille du cadenas seul
  // (unité intacte qui a joué), et la gélule qui porte les deux.
  const largeur = COTE_ETIQUETTE + (chiffre && agie ? LARGEUR_CADENAS : 0);
  const c = doc.createElement('canvas');
  c.width = largeur;
  c.height = hauteur;
  const g = c.getContext('2d');
  if (g) {
    const r = hauteur / 2 - 4;
    g.clearRect(0, 0, largeur, hauteur);
    g.fillStyle = 'rgba(12,16,24,0.86)';
    g.beginPath();
    g.arc(hauteur / 2, hauteur / 2, r, Math.PI / 2, -Math.PI / 2);
    g.arc(largeur - hauteur / 2, hauteur / 2, r, -Math.PI / 2, Math.PI / 2);
    g.closePath();
    g.fill();
    // Le liseré garde la couleur du camp : l'étiquette dit « qui » avant « quoi ».
    g.strokeStyle = paletteDe(camp).light;
    g.lineWidth = 4;
    g.stroke();
    if (chiffre) {
      g.fillStyle = '#ffffff';
      g.font = 'bold 34px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(pv), hauteur / 2, hauteur / 2 + 2);
    }
    if (agie) dessinerCadenas(g, largeur - hauteur / 2, hauteur / 2, hauteur);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true });
  etiquettes.set(cle, mat);
  return mat;
}

/** Monte le calque des unités. */
export function creerUnites(
  doc: Document, hauteurEn: (x: number, z: number) => number, options: OptionsUnites = {},
): CalqueUnites {
  const groupe = new THREE.Group();
  groupe.name = 'unites';
  const materiaux = new Materiaux();
  const entrees = new Map<string, Entree>();
  let tempsAnimation = 0;
  const visuels = new Map<string, EtatVisuel>();
  const retenues = new Map<string, Unite>();
  const paysParCamp = new Map<CampId, CodePays>(
    Object.entries(options.paysParCamp ?? {})
      .map(([camp, code]) => [Number(camp) as CampId, code as CodePays]),
  );

  /** Le style de la nation d'un camp, ou `null` si on ne la connaît pas. */
  function styleDe(camp: CampId): StyleNation | null {
    const code = paysParCamp.get(camp);
    return code === undefined ? null : chargerStyleNation(code);
  }

  function visuel(id: string): EtatVisuel {
    const memo = visuels.get(id);
    if (memo) return memo;
    const neuf = etatNeutre();
    visuels.set(id, neuf);
    return neuf;
  }

  function creerEntree(u: Unite, cat: Catalogue): Entree | null {
    const type = cat.unites[u.type];
    if (!type) return null;
    const g = new THREE.Group();
    const corps = construirePlaceholder(type.silhouette, u.camp, materiaux, styleDe(u.camp), u.type);
    g.add(corps);
    groupe.add(g);
    const entree: Entree = {
      id: u.id,
      type: u.type,
      camp: u.camp,
      groupe: g,
      corps,
      etiquette: null,
      sommet: hauteurSilhouette(type.silhouette),
      pv: -1,
      rotor: corps.getObjectByName('rotor_anime') ?? null,
      figurines: type.silhouette.base === 'pattes' ? corps.getObjectByName('figurine_modele') ?? null : null,
      agie: null,
      tassement: 0,
    };
    // Un vrai modèle prend la place du placeholder dès qu'il arrive, sans à-coup.
    void chargerModele(u.type, paysParCamp.get(u.camp) ?? null).then((modele) => {
      if (!modele || !entrees.has(u.id)) return;
      const clone = modele.clone(true);
      teinterModele(clone, u.camp);
      g.remove(entree.corps);
      g.add(clone);
      entree.corps = clone as THREE.Group;
      entree.rotor = null;
      entree.figurines = null;
      // Le modèle arrive avec ses propres matériaux : s'il remplace une pièce
      // déjà ternie, il doit l'être aussi, sinon l'unité « se réveille » à
      // l'instant où l'asset se charge.
      if (entree.agie) ternir(entree, true);
      enfoncer(entree);
    });
    entrees.set(u.id, entree);
    return entree;
  }

  function poser(entree: Entree, u: Unite, v: EtatVisuel): void {
    const x = u.x * CASE + CASE / 2 + v.dx;
    const z = u.y * CASE + CASE / 2 + v.dz;
    // Une unité ne coule pas. Le sol d'une case de mer est à −0,40, très en
    // dessous du plan d'eau : quand une marée reprend une case, la pièce qui s'y
    // trouve encore doit se lire comme en train de patauger, pas comme engloutie.
    // (Le jour où des unités navales existeront, elles feront exception ici.)
    const solide = Math.max(hauteurEn(x, z), NIVEAU_EAU + 0.01);
    const cap = v.cap;
    entree.groupe.position.set(
      x + Math.cos(cap) * v.recul + Math.sin(v.secousse * 40) * v.secousse * 0.05,
      solide + v.dy - v.affaissement * 0.16,
      z - Math.sin(cap) * v.recul,
    );
    orienter(entree.groupe, x, z, cap, v.affaissement);
    entree.groupe.visible = v.opacite > 0.02;
    if (v.opacite < 1) entree.groupe.scale.setScalar(0.6 + v.opacite * 0.4);
    else entree.groupe.scale.setScalar(1);
  }

  /** Portée d'échantillonnage de la pente, en fraction de case. */
  const PAS_PENTE = 0.34;
  /** Part de la pente réellement suivie : au-delà, une pièce paraît culbuter. */
  const SUIVI_PENTE = 0.55;
  /** Inclinaison maximale, en radians (environ 13°). */
  const PENTE_MAX = 0.23;

  const HAUT = new THREE.Vector3(0, 1, 0);
  const normale = new THREE.Vector3();
  const quatSol = new THREE.Quaternion();
  const quatCap = new THREE.Quaternion();
  const quatChute = new THREE.Quaternion();
  const AXE_X = new THREE.Vector3(1, 0, 0);

  /**
   * Oriente une pièce **sur le sol** plutôt qu'à plat.
   *
   * La pente est lue par différences finies autour du point, puis atténuée et
   * bornée : suivre le relief au degré près ferait basculer un char sur une
   * berge, alors qu'on veut seulement qu'il ne flotte pas. C'est ce qui manquait
   * quand une marée creusait le sol sous une unité : elle restait horizontale,
   * à moitié plantée dans la pente.
   */
  function orienter(
    groupe: THREE.Object3D, x: number, z: number, cap: number, affaissement: number,
  ): void {
    const dx = hauteurEn(x + PAS_PENTE, z) - hauteurEn(x - PAS_PENTE, z);
    const dz = hauteurEn(x, z + PAS_PENTE) - hauteurEn(x, z - PAS_PENTE);
    const pente = Math.hypot(dx, dz);
    const frein = pente > 1e-4
      ? Math.min(1, PENTE_MAX / Math.atan(pente / (2 * PAS_PENTE))) * SUIVI_PENTE
      : 0;
    normale.set(-dx * frein, 2 * PAS_PENTE, -dz * frein).normalize();
    quatSol.setFromUnitVectors(HAUT, normale);
    quatCap.setFromAxisAngle(HAUT, cap);
    groupe.quaternion.copy(quatSol).multiply(quatCap);
    // La chute de fin de partie s'ajoute par-dessus, autour de l'axe de la pièce.
    if (affaissement !== 0) {
      quatChute.setFromAxisAngle(AXE_X, affaissement * 0.5);
      groupe.quaternion.multiply(quatChute);
    }
  }

  /**
   * L'étiquette porte les PV entamés **et** le cadenas d'une unité qui a joué.
   * Une unité intacte et prête n'en a pas ; une unité intacte qui a joué en
   * reçoit une avec le seul cadenas — c'est le cas le plus fréquent, et celui
   * où le gris seul pouvait passer pour un effet de lumière.
   */
  function majEtiquette(entree: Entree, pv: number, agie: boolean): void {
    if (pv <= 0 || (pv >= 10 && !agie)) {
      if (entree.etiquette) {
        entree.groupe.remove(entree.etiquette);
        entree.etiquette = null;
      }
      entree.pv = pv;
      return;
    }
    if (entree.pv === pv && entree.agie === agie && entree.etiquette) return;
    if (entree.etiquette) entree.groupe.remove(entree.etiquette);
    const materiau = materiauEtiquette(doc, pv, entree.camp, agie);
    const sprite = new THREE.Sprite(materiau);
    const largeur = (materiau.map?.image as { width?: number } | undefined)?.width ?? COTE_ETIQUETTE;
    // La gélule s'élargit vers l'extérieur : le chiffre reste où il était.
    const ratio = largeur / COTE_ETIQUETTE;
    sprite.scale.set(0.3 * ratio, 0.3, 1);
    sprite.position.set(0.22 + 0.15 * (ratio - 1), entree.sommet + 0.16, 0);
    entree.groupe.add(sprite);
    entree.etiquette = sprite;
    entree.pv = pv;
  }

  /**
   * Échange les matériaux d'une pièce contre leurs doubles ternis, ou les rend.
   * Chaque maillage garde son matériau de repos dans `userData` : au réveil, on
   * lui rend **l'objet même**, pas une copie recolorée. Le liseré de socle est
   * épargné — la couleur d'équipe doit rester lisible sur une unité qui a joué,
   * c'est encore une unité à défendre.
   */
  function ternir(entree: Entree, agie: boolean): void {
    entree.corps.traverse((n) => {
      if (!(n instanceof THREE.Mesh) || n.name === 'socle_lisere') return;
      const repos = (n.userData['repos'] as THREE.Material | THREE.Material[] | undefined) ?? n.material;
      n.userData['repos'] = repos;
      if (!agie) {
        n.material = repos;
        return;
      }
      const ternirUn = (m: THREE.Material): THREE.Material => (
        m instanceof THREE.MeshStandardMaterial ? materiaux.terni(m) : m);
      n.material = Array.isArray(repos) ? repos.map(ternirUn) : ternirUn(repos);
    });
  }

  /** Applique l'enfoncement courant à la figurine, sans toucher au socle. */
  function enfoncer(entree: Entree): void {
    const modele = entree.corps.getObjectByName('figurine_modele') ?? entree.corps;
    // `> 0` plutôt qu'une simple négation : `-0` se compare mal dans les tests.
    modele.position.y = entree.tassement > 0 ? -entree.tassement : 0;
  }

  function retirer(id: string): void {
    const e = entrees.get(id);
    if (!e) return;
    groupe.remove(e.groupe);
    entrees.delete(id);
    visuels.delete(id);
  }

  return {
    groupe,
    visuel,

    avancer(ms: number, mouvementReduit = false): boolean {
      const pas = Math.min(100, Math.max(0, ms));
      tempsAnimation += pas;
      let anime = false;
      let rang = 0;
      for (const entree of entrees.values()) {
        if (!entree.groupe.visible) continue;
        // Le tassement glisse vers sa cible ; sous réduction des animations
        // il y saute, ce qui reste un état final exact et non une omission.
        const cible = entree.agie ? TASSEMENT : 0;
        if (entree.tassement !== cible) {
          const marche = mouvementReduit ? Infinity : VITESSE_TASSEMENT * pas / 1000;
          entree.tassement = entree.tassement < cible
            ? Math.min(cible, entree.tassement + marche)
            : Math.max(cible, entree.tassement - marche);
          enfoncer(entree);
          if (entree.tassement !== cible) anime = true;
        }
        // Une unité qui a joué ne respire plus et ses rotors sont arrêtés :
        // l'immobilité est la moitié du signal, le gris n'est que l'autre.
        if (entree.agie || mouvementReduit) {
          rang++;
          continue;
        }
        if (entree.rotor) {
          entree.rotor.rotation.y = (tempsAnimation * 0.018) % (Math.PI * 2);
          anime = true;
        }
        if (entree.figurines) {
          const phase = tempsAnimation * 0.0017 + rang * 1.7;
          entree.figurines.position.y = Math.sin(phase) * 0.004 - entree.tassement;
          entree.figurines.rotation.z = Math.sin(phase * 0.8) * 0.012;
          anime = true;
        }
        rang++;
      }
      return anime;
    },

    definirPays(camp: CampId, code: CodePays | null): void {
      const avant = paysParCamp.get(camp);
      if (code === null) paysParCamp.delete(camp);
      else paysParCamp.set(camp, code);
      if (avant === (code ?? undefined)) return;
      // Les unités du camp sont reconstruites au prochain passage : le style
      // touche la géométrie (gabarit) autant que la couleur.
      for (const [id, e] of [...entrees]) if (e.camp === camp) retirer(id);
    },

    maj(etat: EtatPartie, cat: Catalogue, visibles: ReadonlySet<string> | null): void {
      const vus = new Set<string>();
      const toutes: Unite[] = [...etat.unites.filter((u) => !u.dansTransport), ...retenues.values()];
      for (const u of toutes) {
        if (visibles && !visibles.has(cleCase({ x: u.x, y: u.y })) && !retenues.has(u.id)) continue;
        vus.add(u.id);
        let entree = entrees.get(u.id);
        if (entree && entree.type !== u.type) {
          retirer(u.id);
          entree = undefined;
        }
        if (!entree) entree = creerEntree(u, cat) ?? undefined;
        if (!entree) continue;
        const v = visuel(u.id);
        poser(entree, u, v);
        // Seul le camp qui joue voit ses unités se ternir : une unité adverse
        // « non prête » n'est qu'un reste du tour précédent, pas une information.
        const agie = u.etat !== 'prete' && u.camp === etat.campCourant;
        majEtiquette(entree, pvAffiches(u.pv), agie);
        if (entree.agie !== agie) {
          const premierePose = entree.agie === null;
          entree.agie = agie;
          entree.groupe.userData['agie'] = agie;
          ternir(entree, agie);
          if (agie && entree.figurines) entree.figurines.rotation.z = 0;
          if (premierePose) {
            entree.tassement = agie ? TASSEMENT : 0;
            enfoncer(entree);
          }
        }
      }
      for (const id of [...entrees.keys()]) if (!vus.has(id)) retirer(id);
    },

    retenir(u: Unite): void {
      retenues.set(u.id, u);
    },

    liberer(id: string): void {
      retenues.delete(id);
      retirer(id);
    },

    positionDe(id: string): THREE.Vector3 | null {
      const e = entrees.get(id);
      return e ? e.groupe.position.clone() : null;
    },

    sommetDe(id: string): number {
      return entrees.get(id)?.sommet ?? 0.3;
    },

    dispose(): void {
      for (const id of [...entrees.keys()]) retirer(id);
      materiaux.dispose();
      for (const m of etiquettes.values()) {
        m.map?.dispose();
        m.dispose();
      }
      etiquettes.clear();
      for (const silhouette of silhouettesFusionnees.values()) {
        for (const g of silhouette.values()) g.dispose();
      }
      silhouettesFusionnees.clear();
      for (const g of geometries.values()) g.dispose();
      geometries.clear();
    },
  };
}
