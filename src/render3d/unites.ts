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
 * `chargerModele()` (`modeles.ts`) tente le **kit national** puis la **géométrie
 * de base**, et **retombe silencieusement sur le placeholder** si aucun des deux
 * n'existe : le jeu tourne pendant que les assets se font attendre, exactement
 * comme le brief l'exige (`doc/10-rendu-3d.md` §7.1). Un modèle qui arrive est
 * déjà conformé — orienté, au gabarit, en niveaux de détail — et ce calque lui
 * pose le même socle à liseré qu'au placeholder, puis joue ses clips dans un
 * `AnimationMixer` que les animations pilotent par `EtatVisuel.clip`.
 *
 * Depuis le passage à `WebGPURenderer` (7 septembre 2026), tout matériau
 * d'ici est un **matériau à nœuds** — `MeshStandardNodeMaterial` pour les sept
 * rôles et leurs doubles, `SpriteNodeMaterial` pour les étiquettes —, aux
 * mêmes paramètres que les classiques qu'ils remplacent. Ce qui change pour
 * ce calque tient en une règle : le clone d'un matériau à nœuds **garde ses
 * nœuds** (le masque d'équipe d'un modèle livré suit donc le double terni) mais
 * pas ce que le nœud lit sur le matériau — `doublerMateriau` le lui rend.
 */

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// On importe les deux modules précis plutôt que `assets/index` : le point
// d'entrée tire aussi le catalogue de spécifications, dont le rendu n'a que
// faire, et avec lui les 24 fiches pays. Ce qui n'est pas importé n'est pas
// embarqué dans le bundle du jeu.
import { gabaritDe, type StyleNation } from '../assets/spec';
import { chargerStyleNation } from '../assets/styles';
import type { Catalogue, EtatPartie, Unite } from '../engine/index';
import { cleCase, pvAffiches, sontAllies } from '../engine/index';
import { paletteDe } from '../render/palettes';
import type { MarqueUnite } from '../render/rendu';
import type { CampId, CleUnite, CodePays, Palette, Silhouette } from '../schemas/types';
import type { ParametresAmbiance } from './eclairage';
import { CASE, NIVEAU_EAU } from './geometrie';
import { symboleRole } from './tactique';
import { EPSILON_UNIFORME } from './programmes';
import {
  appliquerMasque, chargerModele, clonerFigurine, clonerMateriauNoeud, couleurMasquee, creerLecteurClips,
  masqueDe, NOM_FIGURINE, PROPORTIONS, teinterModele, type LecteurClips, type ModeleCharge, type NomClip,
} from './modeles';
import {
  composerSilhouette, echelleTaille, hauteurSilhouette, type Piece, type RolePiece,
} from './pieces';

// Le chargement et la conformation vivent dans `modeles.ts` ; on les réexporte
// d'ici parce que la vitrine et `index.ts` les ont toujours pris à cette porte,
// et qu'une seule porte suffit à qui monte une unité.
export {
  chargerModele, conformerModele, creerLecteurClips, NOM_FIGURINE, NOMS_CLIPS, RACINE_MODELES,
  teinterModele, type LecteurClips, type ModeleCharge, type NomClip,
} from './modeles';

/** Les matériaux neutres, partagés par toutes les nations. */
const NEUTRES: Readonly<Record<'materiel' | 'verre' | 'roulant' | 'peau' | 'repere', number>> = {
  // Un gris d'acier clair : la couleur d'un métal est son reflet, et un acier
  // sombre ne renvoie du studio qu'un reflet sombre.
  materiel: 0x6c757d,
  // Un verre teinté de froid ; sa transparence fait le reste.
  verre: 0x8fcbe6,
  roulant: 0x252b30,
  // Un seul ton de peau pour toutes les nations, mat : celui d'une figurine peinte.
  peau: 0xc9946c,
  // Les repères de socle : une pastille d'ivoire, un marquage et non un vitrage.
  repere: 0xf1eee4,
};

/** Les ornements que le placeholder sait poser lui-même. Le reste vient du kit. */
const ORNEMENTS_PLACEHOLDER = ['antenne', 'fanion'] as const;

/** Ce en quoi un rôle est fait : rugosité, métal, et ce qu'il émet de lui-même. */
interface MatierePiece {
  rugosite: number;
  metal: number;
  /** Intensité émissive, de la couleur propre de la pièce — ou de `LUEUR_VERRE` pour le verre. */
  emission: number;
}

/**
 * Ce en quoi chaque rôle est fait, en PBR *metallic-roughness*, réglé avec la
 * carte d'environnement en place (`16-realisme.md`, A5). Les valeurs d'avant
 * dataient d'une scène qui ne réfléchissait rien : l'émission y compensait
 * l'absence de lumière renvoyée, et le verre opaque cachait qu'il n'y avait
 * rien à refléter. Avec le studio à un tiers le jour, la même émission rendait
 * la tôle plate et lumineuse comme du plastique.
 *
 * - `principal`, `sombre`, `clair` : de la **tôle peinte**. La peinture est un
 *   diélectrique, mais une peinture satinée sur de l'acier accroche un reflet
 *   que le zéro strict refuse : un métal faible et non nul, une rugosité
 *   moyenne. L'émission tombe à un souffle de la couleur propre — il en reste
 *   juste assez pour qu'une nation sombre ne devienne pas un trou noir sous la
 *   lune, où l'environnement vaut moins d'un dixième du jour.
 * - `materiel` : de l'**acier** nu — canons, chenilles, mâts. La lumière y vient
 *   du reflet, pas du diffus, d'où un métal franc.
 * - `verre` : du **verre teinté**, translucide (`OPACITE_VERRE`), presque lisse,
 *   qui reflète le studio ; il garde une lueur propre, celle d'une cabine
 *   allumée, pour rester lisible la nuit.
 * - `roulant` : du **caoutchouc** poussiéreux, mat et sans métal.
 * - `peau` : mate, sans métal.
 *
 * « Sans métal » et « sans émission » valent `EPSILON_UNIFORME`, pas zéro : la
 * clé de programme de three réduit tout nombre à « nul ou non » alors que ces
 * deux-là ne sont que des uniformes — un zéro exact coûtait un programme entier
 * pour un nuanceur identique (`programmes.ts`). Un millième de métal est sous la
 * quantification d'un canal de huit bits, et une émission d'un millième sur un
 * `emissive` noir ne peut rien éclairer.
 */
const MATIERES: Readonly<Record<RolePiece, MatierePiece>> = {
  principal: { rugosite: 0.5, metal: 0.16, emission: 0.045 },
  sombre: { rugosite: 0.58, metal: 0.14, emission: EPSILON_UNIFORME },
  clair: { rugosite: 0.46, metal: 0.12, emission: 0.03 },
  materiel: { rugosite: 0.4, metal: 0.78, emission: EPSILON_UNIFORME },
  verre: { rugosite: 0.1, metal: 0.06, emission: 0.16 },
  roulant: { rugosite: 0.92, metal: EPSILON_UNIFORME, emission: EPSILON_UNIFORME },
  peau: { rugosite: 0.72, metal: EPSILON_UNIFORME, emission: EPSILON_UNIFORME },
};

/** Les sept rôles, dans l'ordre de la table. */
const ROLES = Object.keys(MATIERES) as RolePiece[];

/** L'opacité du verre : on voit la caisse au travers de la cabine, teintée, sans que la cabine disparaisse. */
export const OPACITE_VERRE = 0.58;

/** La lueur propre du verre : un bleu-vert de cabine allumée, froid comme sa teinte. */
const LUEUR_VERRE = 0x1d4a60;

/**
 * Les rôles que la pluie fait luire : la tôle, l'acier et le caoutchouc. Ni le
 * verre, déjà lisse, ni la peau — une figurine peinte ne brille pas sous l'eau.
 */
const ROLES_MOUILLABLES: ReadonlySet<RolePiece> = new Set<RolePiece>(['principal', 'sombre', 'clair', 'materiel', 'roulant']);

/** De combien la pluie abaisse la rugosité d'une matière mouillable, à mouillé plein. */
const MOUILLAGE = 0.3;

/**
 * L'opacité d'une unité qui a joué (décision du propriétaire, 6 septembre 2026 :
 * « je voudrais juste réduire l'opacité »). Elle ne change plus ni de teinte
 * ni de matière : elle s'efface aux six dixièmes, ne porte plus d'ombre, ne
 * respire plus, et son étiquette porte le cadenas. Le verre, déjà plus
 * translucide, garde son opacité propre.
 */
export const OPACITE_JOUEE = 0.6;

/**
 * L'opacité d'une unité **furtive** du joueur (trait `furtif`, catalogue 6) :
 * repérée au contact seulement, elle se lit comme un fantôme, plus effacée
 * qu'une unité qui a joué — la furtivité cache, l'état joué ne fait
 * qu'attendre. Une furtive qui a joué prend la plus faible des deux. Une
 * furtive **adverse** vue au contact se dessine entière : elle est vue. À
 * régler à l'œil, comme `OPACITE_JOUEE`.
 */
export const OPACITE_FURTIVE = 0.45;

/**
 * L'opacité d'un double translucide : celle demandée, sauf pour un matériau
 * déjà transparent — le verre — qui garde la sienne si elle est plus basse.
 */
function opaciteTranslucide(origine: THREE.MeshStandardNodeMaterial, opacite: number): number {
  return origine.transparent ? Math.min(origine.opacity, opacite) : opacite;
}

/**
 * Le double translucide d'un matériau : son clone, à l'opacité demandée, qui
 * écrit sa profondeur — même teinte, même matière, seule l'opacité parle.
 *
 * Le clone d'un matériau à nœuds **garde ses nœuds** : `NodeMaterial.copy`
 * recopie `colorNode`, donc le nœud du masque d'équipe d'un modèle livré suit
 * le double de lui-même. Ce qu'il ne garde pas, ce sont la texture et la
 * couleur que ce nœud lit **sur le matériau** (`Material.copy` ne connaît que
 * ses propres champs) : on les rend ici, avec la couleur d'équipe
 * **inchangée** — un double qui a joué ou qui se cache n'est pas d'un autre
 * camp. Sous WebGL, c'était `onBeforeCompile` que le clone perdait ; le geste
 * est le même, la raison a changé.
 */
function doublerMateriau(origine: THREE.MeshStandardNodeMaterial, opacite: number): THREE.MeshStandardNodeMaterial {
  // Le clone complet, pas `clone()` : en r170 celui-ci perd couleur, matière et
  // cartes d'un matériau à nœuds (`clonerMateriauNoeud`).
  const m = clonerMateriauNoeud(origine);
  m.transparent = true;
  m.opacity = opaciteTranslucide(origine, opacite);
  m.depthWrite = true;
  const masque = masqueDe(origine);
  const couleur = couleurMasquee(origine);
  if (masque && couleur) appliquerMasque(m, masque, couleur);
  return m;
}

/** Un jeu de matériaux par camp et par style : c'est là que vit la couleur. */
export class Materiaux {
  private readonly jeux = new Map<string, Record<RolePiece, THREE.MeshStandardNodeMaterial>>();
  private readonly liseres = new Map<string, THREE.MeshStandardNodeMaterial>();
  /** Les doubles translucides, par matériau d'origine puis par opacité. */
  private readonly doubles = new Map<THREE.MeshStandardNodeMaterial, Map<number, THREE.MeshStandardNodeMaterial>>();
  private materiauRepere: THREE.MeshStandardNodeMaterial | null = null;
  /** L'humidité en cours, 0 à 1 : elle s'applique à tout jeu, existant ou à venir. */
  private mouille = 0;

  jeu(camp: CampId | null, style: StyleNation | null): Record<RolePiece, THREE.MeshStandardNodeMaterial> {
    const cle = `${String(camp)}:${style?.code ?? ''}`;
    const memo = this.jeux.get(cle);
    if (memo) return memo;
    // La nation donne la couleur ; le camp ne la donne que faute de nation.
    const p: Palette = style ? style.palette : paletteDe(camp);
    const accent = style?.palette.accents[0] ?? p.light;
    const matiere = (role: RolePiece): { roughness: number; metalness: number; emissiveIntensity: number } => ({
      roughness: MATIERES[role].rugosite, metalness: MATIERES[role].metal, emissiveIntensity: MATIERES[role].emission,
    });
    // Des matériaux à nœuds, aux paramètres des classiques qu'ils remplacent :
    // le constructeur accepte le même objet, et `color`, `roughness`,
    // `opacity` se règlent de la même main — c'est `WebGPURenderer` qui exige
    // la famille, pas le calque.
    const jeu: Record<RolePiece, THREE.MeshStandardNodeMaterial> = {
      principal: new THREE.MeshStandardNodeMaterial({ color: p.main, emissive: p.main, ...matiere('principal') }),
      sombre: new THREE.MeshStandardNodeMaterial({ color: p.dark, ...matiere('sombre') }),
      clair: new THREE.MeshStandardNodeMaterial({ color: accent, emissive: accent, ...matiere('clair') }),
      materiel: new THREE.MeshStandardNodeMaterial({ color: NEUTRES.materiel, ...matiere('materiel') }),
      // Le verre écrit sa profondeur : une cabine est un volume convexe posé sur
      // une caisse, et sans écriture un décalque au sol ou un bâtiment effacé
      // dessiné après elle se peindrait par-dessus. Il ne projette pas d'ombre
      // (`construirePlaceholder`) : une ombre pleine trahirait sa transparence.
      verre: new THREE.MeshStandardNodeMaterial({
        color: NEUTRES.verre, emissive: LUEUR_VERRE, transparent: true, opacity: OPACITE_VERRE, depthWrite: true,
        ...matiere('verre'),
      }),
      roulant: new THREE.MeshStandardNodeMaterial({ color: NEUTRES.roulant, ...matiere('roulant') }),
      peau: new THREE.MeshStandardNodeMaterial({ color: NEUTRES.peau, ...matiere('peau') }),
    };
    this.rugosites(jeu);
    this.jeux.set(cle, jeu);
    return jeu;
  }

  /** Le matériau du liseré de socle : la couleur d'équipe, et rien d'autre. */
  lisere(camp: CampId | null): THREE.MeshStandardNodeMaterial {
    const cle = String(camp);
    const memo = this.liseres.get(cle);
    if (memo) return memo;
    const m = new THREE.MeshStandardNodeMaterial({
      color: paletteDe(camp).main, roughness: 0.4, metalness: 0.1,
    });
    this.liseres.set(cle, m);
    return m;
  }

  /**
   * Le matériau des repères de socle — les encoches qui comptent le camp sans
   * dépendre de sa couleur. Une pastille d'ivoire opaque, la même pour tous :
   * c'est un marquage, et un verre translucide posé sur l'anneau de camp en
   * prendrait la couleur, ce qui est précisément ce que les encoches évitent.
   */
  repere(): THREE.MeshStandardNodeMaterial {
    if (!this.materiauRepere) {
      this.materiauRepere = new THREE.MeshStandardNodeMaterial({ color: NEUTRES.repere, roughness: 0.5, metalness: 0.02 });
    }
    return this.materiauRepere;
  }

  /**
   * Mouille — ou sèche — tous les jeux : la pluie abaisse la rugosité de la
   * tôle, de l'acier et du caoutchouc, comme le plateau le fait déjà pour ses
   * voies. C'est un réglage **par jeu de matériaux**, une douzaine d'objets au
   * plus, jamais par unité ni par image : l'appel est gratuit quand rien ne
   * change, et les doubles ternis suivent leur original de la même marche.
   */
  mouiller(mouille: number): void {
    const m = Math.min(1, Math.max(0, mouille));
    if (m === this.mouille) return;
    this.mouille = m;
    for (const jeu of this.jeux.values()) this.rugosites(jeu);
    for (const [origine, parOpacite] of this.doubles) {
      for (const double of parOpacite.values()) double.roughness = origine.roughness;
    }
  }

  /** La rugosité de chaque rôle d'un jeu : la sèche, moins ce que la pluie en ôte. */
  private rugosites(jeu: Record<RolePiece, THREE.MeshStandardNodeMaterial>): void {
    for (const role of ROLES) {
      jeu[role].roughness = MATIERES[role].rugosite - (ROLES_MOUILLABLES.has(role) ? this.mouille * MOUILLAGE : 0);
    }
  }

  /**
   * Le double **terni** d'un matériau : celui qu'une unité porte quand elle a
   * déjà joué. C'est le double translucide à `OPACITE_JOUEE`, et rien d'autre.
   */
  terni(origine: THREE.MeshStandardNodeMaterial): THREE.MeshStandardNodeMaterial {
    return this.translucide(origine, OPACITE_JOUEE);
  }

  /**
   * Le double **translucide** d'un matériau, à une opacité donnée : celui
   * qu'une unité porte quand elle a joué (`OPACITE_JOUEE`) ou quand elle est
   * furtive (`OPACITE_FURTIVE`). Mémorisé par matériau d'origine et par
   * opacité, donc créé une fois par couple (camp, style) et par niveau, jamais
   * par image ; l'original n'est **jamais** modifié, c'est ce qui garantit
   * qu'une unité réveillée retrouve ses couleurs au bit près — on lui rend
   * l'objet même, pas une reconstruction.
   *
   * Depuis le 6 septembre 2026, le double ne change **que l'opacité** : même
   * teinte, même saturation, même matière — le gris et le noir d'avant
   * faisaient lire une unité fatiguée comme une unité adverse ou hors service.
   * Il écrit sa profondeur, comme le verre : une figurine convexe en sept
   * mailles sans écriture de profondeur se trie mal et montre ses arrières au
   * travers de ses avants. Le verre, plus translucide que le seuil, reste à sa
   * propre opacité.
   */
  translucide(origine: THREE.MeshStandardNodeMaterial, opacite: number): THREE.MeshStandardNodeMaterial {
    let parOpacite = this.doubles.get(origine);
    if (!parOpacite) {
      parOpacite = new Map();
      this.doubles.set(origine, parOpacite);
    }
    const memo = parOpacite.get(opacite);
    if (memo) return memo;
    const m = doublerMateriau(origine, opacite);
    parOpacite.set(opacite, m);
    return m;
  }

  /**
   * Oublie les doubles d'un matériau qui quitte la scène, et les libère.
   * Les matériaux partagés des placeholders vivent aussi longtemps que le
   * calque ; ceux d'un modèle livré appartiennent à une seule unité, et leurs
   * doubles s'accumuleraient ici à chaque unité retirée. Rend vrai s'il y
   * avait une entrée.
   */
  oublier(origine: THREE.Material): boolean {
    // Seul un matériau standard à nœuds a pu recevoir un double.
    if (!(origine instanceof THREE.MeshStandardNodeMaterial)) return false;
    const parOpacite = this.doubles.get(origine);
    if (!parOpacite) return false;
    for (const m of parOpacite.values()) m.dispose();
    this.doubles.delete(origine);
    return true;
  }

  dispose(): void {
    for (const jeu of this.jeux.values()) {
      for (const m of Object.values(jeu)) m.dispose();
    }
    this.jeux.clear();
    for (const m of this.liseres.values()) m.dispose();
    this.liseres.clear();
    for (const parOpacite of this.doubles.values()) {
      for (const m of parOpacite.values()) m.dispose();
    }
    this.doubles.clear();
    this.materiauRepere?.dispose();
    this.materiauRepere = null;
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

/**
 * Ce que les formes mémorisées pèsent : la somme des tampons de tous les
 * attributs et index gardés. Le catalogue en compte vingt-quatre silhouettes,
 * soit quelques centaines de kilo-octets — mesuré par
 * `tests/render3d/unites.test.ts`, qui échoue si cela dérive.
 */
export function poidsFormesUnites(): { formes: number; octets: number } {
  const vues = new Set<THREE.BufferGeometry>();
  for (const silhouette of silhouettesFusionnees.values()) for (const g of silhouette.values()) vues.add(g);
  for (const g of geometries.values()) vues.add(g);
  let octets = 0;
  for (const g of vues) {
    for (const attribut of Object.values(g.attributes)) {
      octets += (attribut as THREE.BufferAttribute).array.byteLength;
    }
    octets += g.index?.array.byteLength ?? 0;
  }
  return { formes: vues.size, octets };
}

/**
 * Libère les formes mémorisées. Rien ne l'appelle en jeu — c'est justement
 * l'intérêt du cache —, mais un test qui veut mesurer à froid en a besoin.
 */
export function oublierFormesUnites(): void {
  for (const silhouette of silhouettesFusionnees.values()) for (const g of silhouette.values()) g.dispose();
  silhouettesFusionnees.clear();
  for (const g of geometries.values()) g.dispose();
  geometries.clear();
}

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
function piecesSocle(camp: CampId | null, materiaux: Materiaux, jeu: Record<RolePiece, THREE.MeshStandardNodeMaterial>): THREE.Mesh[] {
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
    const repere = new THREE.Mesh(boiteBiseautee(0.06, 0.012, 0.09, 0.003), materiaux.repere());
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
  style: StyleNation | null, hauteur: number, jeu: Record<RolePiece, THREE.MeshStandardNodeMaterial>,
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
  modele.name = NOM_FIGURINE;
  groupe.add(modele);
  for (const [role, geometrie] of geometriesSilhouette(s)) {
    const maille = new THREE.Mesh(geometrie, jeu[role]);
    maille.name = `silhouette_${role}`;
    // Le verre est translucide : une ombre pleine sous une cabine trahirait sa
    // transparence, et la caisse qu'elle coiffe porte déjà la sienne.
    maille.castShadow = role !== 'verre';
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
// Un modèle livré, monté comme un placeholder
// ---------------------------------------------------------------------------

/**
 * Monte un modèle conformé pour un camp, exactement comme `construirePlaceholder`
 * monte une silhouette : le **même socle à liseré d'équipe** dessous — base
 * comme kit, c'est le rendu qui le dessine, jamais le fichier —, puis la
 * figurine clonée et teintée. Le socle reste à sa taille nominale : le gabarit
 * est déjà dans la figurine, et une case vaut un mètre, donc aucune échelle de
 * taille ne s'applique à un modèle livré.
 */
export function monterModele(
  modele: ModeleCharge, camp: CampId | null, materiaux: Materiaux, style: StyleNation | null = null,
): THREE.Group {
  const groupe = new THREE.Group();
  const jeu = materiaux.jeu(camp, style);
  for (const m of piecesSocle(camp, materiaux, jeu)) groupe.add(m);
  const figurine = clonerFigurine(modele.objet);
  materiauxPropres.set(groupe, teinterModele(figurine, camp, { style, kit: modele.kit }));
  groupe.add(figurine);
  return groupe;
}

/**
 * Les matériaux qui n'appartiennent qu'à un corps monté par `monterModele` —
 * les clones teintés —, à libérer avec lui. Ceux d'un placeholder sont
 * partagés par `Materiaux` et n'y figurent pas.
 */
const materiauxPropres = new WeakMap<THREE.Object3D, THREE.Material[]>();

/** Les matériaux propres d'un corps monté, vides pour un placeholder. */
export function materiauxPropresDe(corps: THREE.Object3D): readonly THREE.Material[] {
  return materiauxPropres.get(corps) ?? [];
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
  /**
   * Le clip logique demandé (`doc/10` §7.3) : `repos` par défaut. Une unité dont
   * le modèle porte des clips le joue dans son mixer ; un placeholder l'ignore.
   */
  clip: NomClip;
  /**
   * La durée du geste que le clip accompagne, en millisecondes, `0` pour la
   * durée naturelle du clip. Un clip qui ne boucle pas y est **ajusté** : le
   * geste — tir, coup encaissé, mise hors jeu — a la durée que l'animation lui
   * donne, et le clip se joue en entier dans ce temps au lieu d'être coupé.
   */
  clipDuree: number;
  /**
   * Les points de vie **retenus** le temps d'un geste, ou `null` pour ceux de
   * l'état. L'état logique est en avance sur l'image : sans cela, l'étiquette
   * annonce la perte avant que le coup soit parti. Le geste qui encaisse retient
   * les points d'avant et les relâche en finissant.
   */
  pv: number | null;
  /**
   * Le **voile** de la furtivité pendant un fondu : `0` à `1`, `1` étant
   * `OPACITE_FURTIVE` ; `null` hors fondu — l'état dit alors si l'unité est
   * furtive. Les gestes `voiler` et `devoiler` le poussent, le calque décide
   * pour qui il compte (le camp du joueur) et l'applique.
   */
  voile: number | null;
}

/** Un état visuel neutre. */
function etatNeutre(): EtatVisuel {
  return {
    dx: 0, dz: 0, dy: 0, cap: 0, recul: 0, secousse: 0, opacite: 1, affaissement: 0, clip: 'repos', clipDuree: 0, pv: null,
    voile: null,
  };
}

/**
 * Ce que le calque sait de la vision du joueur : son camp — c'est pour lui que
 * ses furtives se voilent — et les unités qu'il voit (`unitesVues` du moteur),
 * `null` pour toutes. Sans vision — le banc, la vitrine, les tests —, on
 * dessine tout et toute furtive se voile.
 */
export interface VisionRendu {
  camp: CampId | null;
  unites: ReadonlySet<string> | null;
  /**
   * Les marques du télégraphage d'un super adverse (`MarqueUnite`) : un
   * chevron orange sur une unité qu'un rayon désignerait, un « ! » orange sur
   * un appareil qu'une impulsion abattrait. Absent ou `null` : aucune.
   */
  marques?: ReadonlyMap<string, MarqueUnite> | null;
}

/** Ce qui va chercher le modèle d'un couple (unité, nation) : `chargerModele`, ou un double de test. */
export type ChargeurModele = (cle: CleUnite, pays: CodePays | null) => Promise<ModeleCharge | null>;

/** Réglages du calque des unités. */
export interface OptionsUnites {
  /**
   * La nation de chaque camp, quand elle est connue : c'est elle qui décide du
   * style national appliqué au placeholder. Un camp absent de la table joue avec
   * sa seule couleur d'équipe, ce qui reste un état parfaitement valide.
   */
  paysParCamp?: Partial<Record<CampId, CodePays>>;
  /**
   * Remplace `chargerModele` : c'est la porte des tests, qui n'ont ni réseau ni
   * fichier et posent un modèle construit en mémoire.
   */
  chargeur?: ChargeurModele;
}

/** Ce que `creerUnites` rend au rendu. */
export interface CalqueUnites {
  readonly groupe: THREE.Group;
  /**
   * Avance les rotors, la respiration des figurines et les mixers des modèles
   * livrés, sans déplacer les socles. Sous réduction des animations, rien ne
   * tourne ni ne respire.
   */
  avancer(ms: number, mouvementReduit?: boolean): boolean;
  /**
   * Reçoit l'ambiance : la pluie mouille les tôles. C'est un réglage par jeu
   * de matériaux (`Materiaux.mouiller`), gratuit quand rien ne change, donc
   * appelable à chaque image comme pour le plateau et le décor.
   */
  appliquerAmbiance(p: ParametresAmbiance): void;
  /**
   * Synchronise les maillages avec l'état. Rend **vrai** si une unité a été
   * posée, est apparue ou a disparu — ce qui change la scène telle que l'ombre
   * la voit —, faux si tout était déjà en place : c'est le cas d'un survol.
   * `vision` dit ce que le joueur voit et pour qui les furtives se voilent.
   */
  maj(etat: EtatPartie, cat: Catalogue, visibles: ReadonlySet<string> | null, vision?: VisionRendu): boolean;
  /**
   * Repose toutes les unités sur le relief courant, à l'état près : ce qui
   * repose sur le sol doit se reposer avec lui. Une pose ne se refait sinon que
   * si l'unité ou son état visuel ont changé — pas quand le sol seul a bougé,
   * ce qu'une unité ne peut pas savoir. À appeler après une mutation du terrain.
   */
  majRelief(): void;
  /**
   * Annonce que le sol va glisser pendant `ms` : les unités se reposent à
   * chaque image de `avancer` jusqu'au bout, puis une dernière fois. C'est ce
   * qui les fait suivre une marée au lieu d'attendre la prochaine vue.
   */
  suivreSol(ms: number): void;
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
  modeTactique(actif: boolean): void;
  /** Le clip que joue le mixer d'une unité, `null` pour un placeholder ou un modèle sans clip. */
  clipJoue(id: string): NomClip | null;
  dispose(): void;
}

interface Entree {
  id: string;
  type: CleUnite;
  camp: CampId;
  groupe: THREE.Group;
  corps: THREE.Group;
  etiquette: THREE.Sprite | null;
  repereTactique: THREE.Sprite | null;
  /** La marque du télégraphage, et laquelle : `null` sans marque. */
  marque: THREE.Sprite | null;
  marqueGenre: MarqueUnite | null;
  symbole: string;
  sommet: number;
  pv: number;
  rotor: THREE.Object3D | null;
  figurines: THREE.Object3D | null;
  /**
   * `null` tant que l'unité n'a pas été posée : c'est ce qui distingue une
   * première pose d'un changement d'état.
   */
  agie: boolean | null;
  /** Le lecteur de clips du modèle livré, `null` pour un placeholder ou un modèle sans clip. */
  lecteur: LecteurClips | null;
  /** Le dernier clip demandé par les animations — distinct de celui qui joue, qui peut être revenu au repos. */
  clipDemande: NomClip;
  /** Ce sur quoi la dernière pose a été faite, `null` avant la première. */
  pose: PoseUnite | null;
  /** L'opacité dont la pièce est habillée : `1`, ses matériaux de repos. */
  opacite: number;
  /** Vrai si les doubles portés sont ceux du calque (`Materiaux.translucide`), faux pendant un fondu. */
  partage: boolean;
  /**
   * Les doubles **propres** à l'unité le temps d'un fondu, par matériau
   * d'origine : leur opacité se règle à chaque image sans rien recréer. Libérés
   * dès que le fondu finit ou que l'unité s'en va.
   */
  fondu: Map<THREE.MeshStandardNodeMaterial, THREE.MeshStandardNodeMaterial> | null;
}

/**
 * Tout ce dont une pose dépend, hormis le sol : la case et l'état visuel. Une
 * unité dont rien de cela n'a changé n'est pas reposée — cinq lectures du
 * relief et trois quaternions par unité, à chaque case survolée, pour retrouver
 * exactement la même position.
 */
interface PoseUnite {
  x: number;
  y: number;
  dx: number;
  dz: number;
  dy: number;
  cap: number;
  recul: number;
  secousse: number;
  opacite: number;
  affaissement: number;
}

function memePose(p: PoseUnite | null, x: number, y: number, v: EtatVisuel): boolean {
  return p !== null && p.x === x && p.y === y && p.dx === v.dx && p.dz === v.dz && p.dy === v.dy
    && p.cap === v.cap && p.recul === v.recul && p.secousse === v.secousse
    && p.opacite === v.opacite && p.affaissement === v.affaissement;
}

/** Texture d'étiquette de PV, mémorisée par (points de vie, camp, a joué). */
const etiquettes = new Map<string, THREE.SpriteNodeMaterial>();

/** Textures des marques du télégraphage, une par genre. */
const marques = new Map<MarqueUnite, THREE.SpriteNodeMaterial>();

/** L'orange du matériel à l'essai : le badge des Gris, et la couleur de ce qu'ils visent. */
const ORANGE_MARQUE = '#ff9a2e';

/**
 * La marque du télégraphage : un **chevron** pointé vers le bas pour une unité
 * désignée par un rayon, un **« ! »** pour un appareil qu'une impulsion
 * abattrait. Vectoriels, sur une pastille sombre, en orange — la couleur du
 * badge que les Gris portent et que leurs pièces n'ont pas. Le « ! » est une
 * ponctuation comme celui de l'embuscade : il n'a rien à traduire.
 */
export function materiauMarque(doc: Document, genre: MarqueUnite): THREE.SpriteNodeMaterial {
  const memo = marques.get(genre);
  if (memo) return memo;
  const cote = COTE_ETIQUETTE;
  const c = doc.createElement('canvas');
  c.width = cote;
  c.height = cote;
  const g = c.getContext('2d');
  if (g) {
    g.clearRect(0, 0, cote, cote);
    g.fillStyle = 'rgba(12,16,24,0.86)';
    g.beginPath();
    g.arc(cote / 2, cote / 2, cote / 2 - 4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = ORANGE_MARQUE;
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = ORANGE_MARQUE;
    g.strokeStyle = ORANGE_MARQUE;
    if (genre === 'designee') {
      g.lineWidth = 9;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(cote * 0.28, cote * 0.38);
      g.lineTo(cote * 0.5, cote * 0.64);
      g.lineTo(cote * 0.72, cote * 0.38);
      g.stroke();
    } else {
      g.font = 'bold 40px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('!', cote / 2, cote / 2 + 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteNodeMaterial({ map: tex, depthTest: false, transparent: true });
  marques.set(genre, mat);
  return mat;
}

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

function materiauEtiquette(doc: Document, pv: number, camp: CampId, agie: boolean): THREE.SpriteNodeMaterial {
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
  const mat = new THREE.SpriteNodeMaterial({ map: tex, depthTest: true, transparent: true });
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
  let tactique = false;
  const reperes = new Map<string, THREE.SpriteNodeMaterial>();
  function majRepere(entree: Entree): void {
    if (!tactique) { if (entree.repereTactique) entree.repereTactique.visible = false; return; }
    if (!entree.repereTactique) {
      const cle = `${entree.camp}:${entree.symbole}`;
      let mat = reperes.get(cle);
      if (!mat) {
        const toile = doc.createElement('canvas');
        toile.width = 128; toile.height = 64;
        const g = toile.getContext('2d');
        if (g) {
          g.fillStyle = '#10222e'; g.fillRect(0, 0, 128, 64);
          g.strokeStyle = paletteDe(entree.camp).light; g.lineWidth = 8; g.strokeRect(4, 4, 120, 56);
          g.fillStyle = '#ffffff'; g.font = 'bold 36px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(`${entree.camp + 1} ${entree.symbole}`, 64, 33);
        }
        const tex = new THREE.CanvasTexture(toile); tex.colorSpace = THREE.SRGBColorSpace;
        mat = new THREE.SpriteNodeMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
        reperes.set(cle, mat);
      }
      const sprite = new THREE.Sprite(mat);
      sprite.name = 'repere-tactique'; sprite.scale.set(0.58, 0.29, 1); sprite.renderOrder = 20;
      entree.groupe.add(sprite); entree.repereTactique = sprite;
    }
    entree.repereTactique.visible = true;
    entree.repereTactique.position.set(-0.1, entree.sommet + 0.45, 0);
  }
  let tempsAnimation = 0;
  const visuels = new Map<string, EtatVisuel>();
  const retenues = new Map<string, Unite>();
  const paysParCamp = new Map<CampId, CodePays>(
    Object.entries(options.paysParCamp ?? {})
      .map(([camp, code]) => [Number(camp) as CampId, code as CodePays]),
  );
  const charger: ChargeurModele = options.chargeur ?? chargerModele;

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
      repereTactique: null,
      marque: null,
      marqueGenre: null,
      symbole: symboleRole(type),
      sommet: hauteurSilhouette(type.silhouette),
      pv: -1,
      rotor: corps.getObjectByName('rotor_anime') ?? null,
      figurines: type.silhouette.base === 'pattes' ? corps.getObjectByName(NOM_FIGURINE) ?? null : null,
      agie: null,
      lecteur: null,
      clipDemande: 'repos',
      pose: null,
      opacite: 1,
      partage: true,
      fondu: null,
    };
    // Un vrai modèle prend la place du placeholder dès qu'il arrive, sans à-coup.
    void charger(u.type, paysParCamp.get(u.camp) ?? null).then((modele) => {
      if (!modele || entrees.get(u.id) !== entree) return;
      installerModele(entree, modele);
    });
    entrees.set(u.id, entree);
    return entree;
  }

  /** Remplace le placeholder d'une entrée par son modèle livré, et lui prépare ses clips. */
  function installerModele(entree: Entree, modele: ModeleCharge): void {
    const corps = monterModele(modele, entree.camp, materiaux, styleDe(entree.camp));
    entree.groupe.remove(entree.corps);
    entree.groupe.add(corps);
    entree.corps = corps;
    entree.rotor = null;
    entree.figurines = null;
    // L'étiquette s'accroche au sommet du modèle, pas à celui de la silhouette
    // qu'il remplace ; si elle existe déjà, on la remonte sans la redessiner.
    entree.sommet = modele.hauteur > 0 ? modele.hauteur : entree.sommet;
    if (entree.etiquette) entree.etiquette.position.y = entree.sommet + 0.16;
    if (entree.marque) entree.marque.position.y = entree.sommet + 0.42;
    majRepere(entree);
    // Le modèle arrive avec ses propres matériaux : s'il remplace une pièce
    // déjà translucide — jouée, furtive —, il doit l'être aussi, sinon l'unité
    // « se réveille » à l'instant où l'asset se charge. Les doubles d'un fondu
    // appartenaient à l'ancien corps : on repart des matériaux du nouveau.
    libererFondu(entree);
    if (entree.opacite < 1) habiller(entree, entree.opacite, entree.partage);

    const figurine = corps.getObjectByName(NOM_FIGURINE);
    if (!figurine) return;
    entree.lecteur = creerLecteurClips(figurine, modele.clips);
    // Le modèle arrive peut-être au milieu d'un geste : il reprend le clip
    // demandé, à sa durée naturelle — on ne sait plus où en est le geste.
    const v = visuels.get(entree.id);
    entree.clipDemande = v?.clip ?? 'repos';
    entree.lecteur?.jouer(entree.clipDemande);
  }

  function poser(entree: Entree, cx: number, cy: number, v: EtatVisuel): void {
    entree.pose = {
      x: cx, y: cy, dx: v.dx, dz: v.dz, dy: v.dy, cap: v.cap, recul: v.recul,
      secousse: v.secousse, opacite: v.opacite, affaissement: v.affaissement,
    };
    const x = cx * CASE + CASE / 2 + v.dx;
    const z = cy * CASE + CASE / 2 + v.dz;
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
   * La marque du télégraphage, au-dessus de la tête et devant tout (sans test
   * de profondeur : une marque cachée par un toit ne dirait rien). Posée ou
   * retirée seulement quand le genre change.
   */
  function majMarque(entree: Entree, genre: MarqueUnite | null): void {
    if (entree.marqueGenre === genre) return;
    if (entree.marque) {
      entree.groupe.remove(entree.marque);
      entree.marque = null;
    }
    entree.marqueGenre = genre;
    if (genre === null) return;
    const sprite = new THREE.Sprite(materiauMarque(doc, genre));
    sprite.scale.set(0.34, 0.34, 1);
    sprite.position.set(-0.2, entree.sommet + 0.42, 0);
    sprite.renderOrder = 6;
    entree.groupe.add(sprite);
    entree.marque = sprite;
  }

  /** Le double propre à une unité pour un fondu, créé une fois par matériau d'origine puis réglé. */
  function fonduDe(entree: Entree, origine: THREE.MeshStandardNodeMaterial, opacite: number): THREE.MeshStandardNodeMaterial {
    entree.fondu ??= new Map();
    const memo = entree.fondu.get(origine);
    if (memo) {
      memo.opacity = opaciteTranslucide(origine, opacite);
      return memo;
    }
    const m = doublerMateriau(origine, opacite);
    entree.fondu.set(origine, m);
    return m;
  }

  /** Libère les doubles d'un fondu : ils n'ont vécu que le temps du geste. */
  function libererFondu(entree: Entree): void {
    if (!entree.fondu) return;
    for (const m of entree.fondu.values()) m.dispose();
    entree.fondu = null;
  }

  /**
   * Habille une pièce à une opacité : ses matériaux de repos à `1`, sinon des
   * doubles translucides — **partagés** (`Materiaux.translucide`, un par
   * matériau et par niveau : l'état joué, l'état furtif) ou **propres** à
   * l'unité le temps d'un fondu (`fondu`), dont l'opacité se règle à chaque
   * image sans rien recréer ni parcourir. Chaque maillage garde son matériau de
   * repos et son ombre dans `userData` : au retour à `1`, on lui rend
   * **l'objet même**, pas une copie recolorée. Le liseré de socle est épargné
   * — la couleur d'équipe doit rester lisible sur une unité qui a joué ou qui
   * se cache, c'est encore une unité à défendre.
   *
   * Une pièce translucide est **sans ombre portée** : la leçon du verre et des
   * bâtiments effacés — une ombre pleine sous une pièce qu'on voit au travers
   * trahit sa transparence. L'ombre d'avant est gardée dans `userData` et
   * rendue au retour, telle quelle. Rend vrai si le port d'ombre a changé, ce
   * qui vaut une carte d'ombre ; un fondu qui ne fait que régler ses doubles ne
   * vaut rien.
   */
  function habiller(entree: Entree, opacite: number, partage: boolean): boolean {
    const avant = entree.opacite;
    entree.opacite = opacite;
    entree.partage = partage;
    if (opacite < 1 && !partage && entree.fondu) {
      for (const [origine, double] of entree.fondu) double.opacity = opaciteTranslucide(origine, opacite);
      return false;
    }
    if (opacite >= 1 || partage) libererFondu(entree);
    entree.corps.traverse((n) => {
      if (!(n instanceof THREE.Mesh) || n.name === 'socle_lisere') return;
      const repos = (n.userData['repos'] as THREE.Material | THREE.Material[] | undefined) ?? n.material;
      n.userData['repos'] = repos;
      const ombre = (n.userData['ombre'] as boolean | undefined) ?? n.castShadow;
      n.userData['ombre'] = ombre;
      if (opacite >= 1) {
        n.material = repos;
        n.castShadow = ombre;
        return;
      }
      n.castShadow = false;
      // Un double — partagé ou propre au fondu — est un clone complet : même
      // matière, et le masque d'équipe rendu avec sa couleur (`doublerMateriau`).
      // Seul un matériau standard à nœuds se double ; un modèle conformé n'en
      // porte pas d'autre.
      const doubler = (m: THREE.Material): THREE.Material => {
        if (!(m instanceof THREE.MeshStandardNodeMaterial)) return m;
        return partage ? materiaux.translucide(m, opacite) : fonduDe(entree, m, opacite);
      };
      n.material = Array.isArray(repos) ? repos.map(doubler) : doubler(repos);
    });
    return (avant >= 1) !== (opacite >= 1);
  }

  /** Repose chaque unité déjà posée, là où elle est, sur le sol tel qu'il est maintenant. */
  function reposerTout(): void {
    for (const entree of entrees.values()) {
      const p = entree.pose;
      if (p) poser(entree, p.x, p.y, visuel(entree.id));
    }
  }

  /** Temps restant pendant lequel le sol glisse sous les unités, en millisecondes. */
  let solEnMouvement = 0;

  function retirer(id: string): void {
    const e = entrees.get(id);
    if (!e) return;
    e.lecteur?.dispose();
    e.lecteur = null;
    libererFondu(e);
    // Un modèle livré a des matériaux à lui — les clones teintés — et, s'il a
    // joué ou s'est caché, leurs doubles dans la table : on rend les deux. Un
    // placeholder ne possède rien, ses matériaux sont ceux du calque.
    for (const m of materiauxPropresDe(e.corps)) {
      materiaux.oublier(m);
      m.dispose();
    }
    materiauxPropres.delete(e.corps);
    groupe.remove(e.groupe);
    entrees.delete(id);
    visuels.delete(id);
  }

  return {
    groupe,
    visuel,
    modeTactique(actif: boolean): void {
      if (tactique === actif) return;
      tactique = actif;
      for (const entree of entrees.values()) majRepere(entree);
    },

    appliquerAmbiance(p: ParametresAmbiance): void {
      materiaux.mouiller(p.mouille);
    },

    avancer(ms: number, mouvementReduit = false): boolean {
      const pas = Math.min(100, Math.max(0, ms));
      tempsAnimation += pas;
      let anime = false;
      // Le sol glisse : les unités le suivent image par image, et une fois de
      // plus quand il s'arrête, pour se poser sur sa position finale exacte.
      if (solEnMouvement > 0) {
        solEnMouvement = Math.max(0, solEnMouvement - pas);
        reposerTout();
        anime = true;
      }
      let rang = 0;
      for (const entree of entrees.values()) {
        if (!entree.groupe.visible) continue;
        // Le modèle livré joue le clip que les animations demandent. Sous
        // réduction des animations, rien n'avance : la pièce saute à la
        // première image du clip demandé, et l'état — position, cap — est
        // tenu par `poser`.
        if (entree.lecteur) {
          const v = visuels.get(entree.id);
          const demande = v?.clip ?? 'repos';
          if (demande !== entree.clipDemande) {
            entree.clipDemande = demande;
            entree.lecteur.jouer(demande, v?.clipDuree ?? 0, !mouvementReduit);
          }
          // Une unité qui a joué se fige dans son repos — l'immobilité fait
          // partie du signal — mais encaisse encore un coup ou tire encore, et
          // le fondu qui la ramène au repos va jusqu'au bout : figer pendant
          // le fondu la laisserait sur la dernière image du geste.
          const figee = entree.agie === true && entree.lecteur.courant === 'repos' && !entree.lecteur.enTransition;
          if (!mouvementReduit && !figee && entree.lecteur.avancer(pas / 1000)) anime = true;
        }
        // Une unité qui a joué ne respire plus et ses rotors sont arrêtés :
        // l'immobilité est la moitié du signal, la transparence n'est que l'autre.
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
          entree.figurines.position.y = Math.sin(phase) * 0.004;
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

    maj(etat: EtatPartie, cat: Catalogue, visibles: ReadonlySet<string> | null, vision?: VisionRendu): boolean {
      const vus = new Set<string>();
      let change = false;
      const toutes: Unite[] = [...etat.unites.filter((u) => !u.dansTransport), ...retenues.values()];
      for (const u of toutes) {
        if (visibles && !visibles.has(cleCase({ x: u.x, y: u.y })) && !retenues.has(u.id)) continue;
        // Ce que le joueur ne voit pas — une furtive hors contact, une unité
        // tapie en forêt — n'est pas dessiné, même sur une case éclairée : la
        // règle est celle du moteur (`unitesVues`), le calque ne fait que la lire.
        if (vision?.unites && !vision.unites.has(u.id) && !retenues.has(u.id)) continue;
        vus.add(u.id);
        let entree = entrees.get(u.id);
        if (entree && entree.type !== u.type) {
          retirer(u.id);
          entree = undefined;
        }
        if (!entree) {
          entree = creerEntree(u, cat) ?? undefined;
          change = true;
        }
        if (!entree) continue;
        majRepere(entree);
        const v = visuel(u.id);
        if (!memePose(entree.pose, u.x, u.y, v)) {
          poser(entree, u.x, u.y, v);
          change = true;
        }
        // Seul le camp qui joue voit ses unités se ternir : une unité adverse
        // « non prête » n'est qu'un reste du tour précédent, pas une information.
        // Une unité `deplacee` (ordre en deux temps, 7 septembre 2026) a encore sa
        // suite à donner : elle ne s'éteint pas. Seules `agi` et `produite` ont joué.
        const agie = (u.etat === 'agi' || u.etat === 'produite') && u.camp === etat.campCourant;
        // Les points retenus par un geste en cours l'emportent : l'étiquette
        // ne devance pas le coup (`animations.ts`, `encaisser`).
        majEtiquette(entree, visuel(u.id).pv ?? pvAffiches(u.pv), agie);
        majMarque(entree, vision?.marques?.get(u.id) ?? null);
        if (entree.agie !== agie) {
          entree.agie = agie;
          entree.groupe.userData['agie'] = agie;
          // Figée au repos : la respiration s'arrête là où elle en était, à plat.
          if (agie && entree.figurines) {
            entree.figurines.rotation.z = 0;
            entree.figurines.position.y = 0;
          }
        }
        // Le voile de la furtivité ne vaut que pour le camp du joueur : une
        // furtive adverse qu'on tient au contact est vue, donc entière. Sans
        // camp connu, toute furtive se voile. Pendant un fondu, `voile` dit où
        // en est le geste ; sinon l'état dit tout. Jouée **et** furtive, la
        // pièce prend la plus faible des deux opacités.
        const voilable = !vision || vision.camp === null || sontAllies(etat, u.camp, vision.camp);
        const part = voilable ? (v.voile ?? (u.furtive === true ? 1 : 0)) : 0;
        // Aux deux bouts, la constante elle-même : un `1 − 1 × (1 − 0,45)` ne
        // vaut pas 0,45 en flottant, et c'est sur cette valeur que les doubles
        // partagés sont mémorisés.
        const opaciteVoile = part <= 0 ? 1 : part >= 1 ? OPACITE_FURTIVE : 1 - part * (1 - OPACITE_FURTIVE);
        const opacite = Math.min(agie ? OPACITE_JOUEE : 1, opaciteVoile);
        const partage = opacite >= 1 || v.voile === null;
        if (entree.opacite !== opacite || entree.partage !== partage) {
          if (habiller(entree, opacite, partage)) change = true;
        }
      }
      for (const id of [...entrees.keys()]) {
        if (vus.has(id)) continue;
        retirer(id);
        change = true;
      }
      return change;
    },

    majRelief(): void {
      reposerTout();
    },

    suivreSol(ms: number): void {
      solEnMouvement = Math.max(solEnMouvement, ms);
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

    clipJoue(id: string): NomClip | null {
      return entrees.get(id)?.lecteur?.courant ?? null;
    },

    dispose(): void {
      for (const id of [...entrees.keys()]) retirer(id);
      materiaux.dispose();
      for (const m of etiquettes.values()) {
        m.map?.dispose();
        m.dispose();
      }
      etiquettes.clear();
      for (const m of marques.values()) { m.map?.dispose(); m.dispose(); }
      marques.clear();
      for (const m of reperes.values()) { m.map?.dispose(); m.dispose(); }
      reperes.clear();
      // Les formes **restent** : une silhouette ne dépend que du catalogue, et
      // le calque n'en est pas propriétaire. Les vider ici faisait payer à
      // chaque montage — revenir à l'accueil, changer de carte, ouvrir la
      // vitrine — la fusion des sept rôles de chaque unité posée, alors que le
      // cache est prévu pour la vie de la page (`poidsFormesUnites`).
    },
  };
}
