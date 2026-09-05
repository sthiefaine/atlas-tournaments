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
import { CASE } from './geometrie';
import {
  composerSilhouette, echelleTaille, hauteurSilhouette, type Piece, type RolePiece,
} from './pieces';

/** Les matériaux neutres, partagés par toutes les nations. */
const NEUTRES: Readonly<Record<'materiel' | 'verre' | 'roulant', number>> = {
  materiel: 0x3b414a,
  verre: 0xa9d8ff,
  roulant: 0x24272c,
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
class Materiaux {
  private readonly jeux = new Map<string, Record<RolePiece, THREE.MeshStandardMaterial>>();
  private readonly liseres = new Map<string, THREE.MeshStandardMaterial>();

  jeu(camp: CampId | null, style: StyleNation | null): Record<RolePiece, THREE.MeshStandardMaterial> {
    const cle = `${String(camp)}:${style?.code ?? ''}`;
    const memo = this.jeux.get(cle);
    if (memo) return memo;
    // La nation donne la couleur ; le camp ne la donne que faute de nation.
    const p: Palette = style ? style.palette : paletteDe(camp);
    const accent = style?.palette.accents[0] ?? p.light;
    const jeu: Record<RolePiece, THREE.MeshStandardMaterial> = {
      principal: new THREE.MeshStandardMaterial({ color: p.main, roughness: 0.52, metalness: 0.18 }),
      sombre: new THREE.MeshStandardMaterial({ color: p.dark, roughness: 0.6, metalness: 0.2 }),
      clair: new THREE.MeshStandardMaterial({ color: accent, roughness: 0.46, metalness: 0.14 }),
      materiel: new THREE.MeshStandardMaterial({ color: NEUTRES.materiel, roughness: 0.42, metalness: 0.62 }),
      verre: new THREE.MeshStandardMaterial({ color: NEUTRES.verre, roughness: 0.12, metalness: 0.3 }),
      roulant: new THREE.MeshStandardMaterial({ color: NEUTRES.roulant, roughness: 0.85, metalness: 0.12 }),
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

  dispose(): void {
    for (const jeu of this.jeux.values()) {
      for (const m of Object.values(jeu)) m.dispose();
    }
    this.jeux.clear();
    for (const m of this.liseres.values()) m.dispose();
    this.liseres.clear();
  }
}

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
    bevelSegments: 2,
    curveSegments: 4,
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
    case 'cylindre':
      geo = new THREE.CylinderGeometry(l / 2, la / 2, h, 16, 1);
      break;
    case 'capsule':
      geo = new THREE.CapsuleGeometry(l / 2, Math.max(0.01, h - l), 4, 12);
      break;
    case 'sphere':
      geo = new THREE.SphereGeometry(0.5, 16, 12);
      geo.scale(l, h, la);
      break;
    case 'cone':
      geo = new THREE.ConeGeometry(Math.max(l, la) / 2, h, 4, 1);
      break;
    case 'plaque':
      return boiteBiseautee(l, h, la, Math.min(l, h, la) * 0.3);
    default:
      return boiteBiseautee(l, h, la, Math.min(l, h, la) * 0.22);
  }
  geometries.set(cle, geo);
  return geo;
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
  const anneau = new THREE.Mesh(disque(0.34, 0.018), materiaux.lisere(camp));
  anneau.name = 'socle_lisere';
  anneau.position.set(0, 0.009, 0);
  anneau.receiveShadow = true;
  const plateau = new THREE.Mesh(disque(0.29, 0.024), jeu.sombre);
  plateau.name = 'socle';
  plateau.position.set(0, 0.014, 0);
  plateau.castShadow = true;
  plateau.receiveShadow = true;
  return [anneau, plateau];
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
  for (const piece of composerSilhouette(s)) {
    const maille = new THREE.Mesh(geometriePiece(piece), jeu[piece.role]);
    maille.name = piece.nom;
    maille.position.set(piece.position[0], piece.position[1], piece.position[2]);
    if (piece.rotation) maille.rotation.set(piece.rotation[0], piece.rotation[1], piece.rotation[2]);
    maille.castShadow = true;
    maille.receiveShadow = true;
    groupe.add(maille);
  }
  for (const m of piecesOrnements(style, hauteurSilhouette(s), jeu)) groupe.add(m);
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
}

/** Texture d'étiquette de PV, mémorisée par (points de vie, camp). */
const etiquettes = new Map<string, THREE.SpriteMaterial>();

function materiauEtiquette(doc: Document, pv: number, camp: CampId): THREE.SpriteMaterial {
  const cle = `${pv}:${camp}`;
  const memo = etiquettes.get(cle);
  if (memo) return memo;
  const taille = 64;
  const c = doc.createElement('canvas');
  c.width = taille;
  c.height = taille;
  const g = c.getContext('2d');
  if (g) {
    g.clearRect(0, 0, taille, taille);
    g.fillStyle = 'rgba(12,16,24,0.86)';
    g.beginPath();
    g.arc(taille / 2, taille / 2, taille / 2 - 4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = paletteDe(camp).light;
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = '#ffffff';
    g.font = 'bold 34px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(pv), taille / 2, taille / 2 + 2);
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
    };
    // Un vrai modèle prend la place du placeholder dès qu'il arrive, sans à-coup.
    void chargerModele(u.type, paysParCamp.get(u.camp) ?? null).then((modele) => {
      if (!modele || !entrees.has(u.id)) return;
      const clone = modele.clone(true);
      teinterModele(clone, u.camp);
      g.remove(entree.corps);
      g.add(clone);
      entree.corps = clone as THREE.Group;
    });
    entrees.set(u.id, entree);
    return entree;
  }

  function poser(entree: Entree, u: Unite, v: EtatVisuel): void {
    const x = u.x * CASE + CASE / 2 + v.dx;
    const z = u.y * CASE + CASE / 2 + v.dz;
    const solide = hauteurEn(x, z);
    const cap = v.cap;
    entree.groupe.position.set(
      x + Math.cos(cap) * v.recul + Math.sin(v.secousse * 40) * v.secousse * 0.05,
      solide + v.dy - v.affaissement * 0.16,
      z - Math.sin(cap) * v.recul,
    );
    entree.groupe.rotation.set(v.affaissement * 0.5, cap, 0);
    entree.groupe.visible = v.opacite > 0.02;
    if (v.opacite < 1) entree.groupe.scale.setScalar(0.6 + v.opacite * 0.4);
    else entree.groupe.scale.setScalar(1);
  }

  function majEtiquette(entree: Entree, pv: number): void {
    if (pv >= 10 || pv <= 0) {
      if (entree.etiquette) {
        entree.groupe.remove(entree.etiquette);
        entree.etiquette = null;
      }
      entree.pv = pv;
      return;
    }
    if (entree.pv === pv && entree.etiquette) return;
    if (entree.etiquette) entree.groupe.remove(entree.etiquette);
    const sprite = new THREE.Sprite(materiauEtiquette(doc, pv, entree.camp));
    sprite.scale.setScalar(0.3);
    sprite.position.set(0.22, entree.sommet + 0.16, 0);
    entree.groupe.add(sprite);
    entree.etiquette = sprite;
    entree.pv = pv;
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
        majEtiquette(entree, pvAffiches(u.pv));
        // Une unité qui a déjà agi se ternit : la même information qu'en 2D.
        const agie = u.etat !== 'prete' && u.camp === etat.campCourant;
        entree.corps.traverse((n) => {
          if (n instanceof THREE.Mesh) n.renderOrder = agie ? 0 : 1;
        });
        entree.groupe.userData['agie'] = agie;
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
      for (const g of geometries.values()) g.dispose();
      geometries.clear();
    },
  };
}
