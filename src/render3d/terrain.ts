/**
 * Le plateau : maillage de la grille, mélange de matières, eau, voies, grille.
 *
 * Le maillage vient directement de `geometrie.ts` : trois subdivisions par case,
 * altitude prise dans le champ continu `hauteurEn`, **sommets partagés** — deux
 * cases voisines ne peuvent pas se décoller — et jonctions adoucies par
 * l'interpolation bilinéaire entre centres de cases.
 *
 * Les matières sont mélangées par une **carte de mélange** (`splat map`)
 * construite depuis la `MapDef` : un texel par case, quatre canaux (herbe,
 * terre et route, roche, sable), lu en filtrage linéaire, donc des lisières
 * fondues sans un seul flou fait main. Le mélange lui-même est écrit en
 * **nœuds TSL** sur un `MeshStandardNodeMaterial` — `colorNode`,
 * `roughnessNode`, `normalNode` — : on garde ainsi l'éclairage PBR complet de
 * three.js — ombres, lumière hémisphérique, brouillard — au lieu de réécrire un
 * matériau de nuanceur qui les perdrait tous. (Portage WebGPU du 7 septembre
 * 2026 : c'était du GLSL greffé par `onBeforeCompile`, que le moteur à nœuds
 * ignore ; chaque formule a gardé sa valeur, seule l'écriture a changé.)
 *
 * L'eau est un plan séparé, sous le niveau des lits de rivière et des fonds
 * marins : partout où le terrain remonte au-dessus d'elle, le tampon de
 * profondeur la cache tout seul. Il ne déborde de la carte que d'une case
 * (`DEBORD_EAU`, révision du 6 septembre 2026) : la nappe qui couvrait tout
 * l'écran au-delà était le poste de remplissage le plus cher de l'image, en
 * matériau éclairé qui lisait la carte d'ombre, pour montrer du bleu que la
 * couleur de fond du ciel donne gratuitement.
 *
 * Le maillage lit `hauteurSol`, la **surface** lit `hauteurEn` : les deux ne
 * diffèrent que sous les ponts, où le sol se creuse au niveau du lit pendant
 * que le tablier — et tout ce qui roule dessus — reste à hauteur de berge.
 *
 * Le **brouillard de guerre** (révision du 6 septembre 2026) est un masque de
 * visibilité : une `DataTexture` d'un octet par case, échantillonnée par tout
 * ce que le plateau dessine — sol, socle, voies, ponts, eau — pour ramener une
 * case hors de vue presque au noir. C'est une règle du jeu rendue visible, pas
 * un effet d'atmosphère : le `FogExp2` de `eclairage.ts` est une autre chose,
 * et `doc/10` §6.4 interdit de les confondre. Le masque n'est réécrit que
 * quand l'ensemble des cases vues change, jamais par image.
 *
 * Une texture WebGPU a une **taille fixe** : quand la carte change de
 * dimensions (l'atelier change de carte sans démonter la scène), la splat, les
 * fonds et le masque sont **remplacés** par des textures neuves, et les nœuds
 * qui les lisent changent de valeur — le moteur relie ses textures tout seul.
 * En WebGL on réécrivait `image` ; ici cela écrirait hors de la texture.
 */

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  clamp, float, materialReference, max, mix, normalize, normalMap, output, positionWorld,
  sin, smoothstep, step, texture, uniform, uv, vec3, vec4,
  type Node, type ShaderNodeObject, type TextureNode, type UniformNode,
} from 'three/tsl';

import type { Biome } from '../schemas/types';
import type { ParametresAmbiance } from './eclairage';
import {
  axePont, CASE, construireSplat, hauteurEn, hauteurSol, NIVEAU_EAU, pieceDeCase,
  terrainBorne, type GrilleTerrain,
} from './geometrie';
import { creerTampon, remplacerGeometrie } from './maillage';
import { normaliserMateriau } from './programmes';
import { jeuMatiere, normalesEau, preparerEau, preparerMatiere, type JeuMatiere } from './textures';
import { APPARENCES, atlasVoies, textureVoies, uvAtlas } from './textures-voies';

/** Subdivisions par case : trois suffisent à arrondir un col de montagne. */
const SUBDIVISIONS = 3;

/** Répétitions de texture de détail, par case. */
const TUILAGE = 0.65;

/**
 * De combien le plan d'eau déborde de la carte, en unités de scène. Une case
 * suffit à ce que le bord du plateau se lise comme une berge sur l'eau, socle
 * compris, et non comme une tranche coupée ; au-delà, on voit la couleur du
 * ciel. Le débord précédent — 1,6 fois la carte plus trente unités — remplissait
 * presque tout l'écran dès qu'on dézoomait.
 */
export const DEBORD_EAU = CASE;

/** Le blanc bleuté de la neige sur les voies et les ponts. */
const NEIGE_VOIE = new THREE.Color(0xf2f5f8);

/**
 * Ce qui reste de la lumière d'une case hors de vue. **Zéro** : « noir noir,
 * 100 % », décision du propriétaire du 7 septembre 2026, qui remplace le
 * « très sombre » de la veille — rien du terrain ne se lit, comme dans Advance
 * Wars. La constante reste pour pouvoir revenir en arrière d'un chiffre.
 */
export const FACTEUR_BROUILLARD = 0;

/**
 * Le plancher d'une case hors de vue, ajouté après l'éclairage. Noir pur avec un
 * facteur nul : le brouillard est un aplat, pas une pénombre.
 */
export const TEINTE_BROUILLARD = 0x000000;

/** Le sol, la grille, les voies et l'eau sont tous vus : la valeur d'un texel du masque. */
const VU = 255;

/** Une couleur de travail pour les mélanges d'ambiance : rien n'est alloué par image. */
const TAMPON = new THREE.Color();

/** Le plateau monté : son groupe, son sol cliquable et ses réglages d'ambiance. */
export interface Plateau {
  readonly groupe: THREE.Group;
  /** Le maillage du sol : c'est lui que le lancer de rayon interroge. */
  readonly sol: THREE.Mesh;
  /**
   * Les tabliers de pont, interrogés **avant** le sol : sous un pont le sol se
   * creuse jusqu'au lit, et un clic sur le tablier tombait dans l'eau d'à côté.
   */
  readonly ponts: THREE.Mesh;
  /**
   * Les uniformes du brouillard. Tout ce qui se pose sur la carte — bâtiments,
   * arbres, pierres, accessoires — se greffe dessus (`grefferBrouillardSur`) :
   * une seule règle d'extinction, appliquée après l'éclairage, pour le sol
   * comme pour ce qui le couvre.
   */
  readonly uniformesBrouillard: UniformesBrouillard;
  /**
   * Les réglages de l'eau — fonds, temps, écume, rive. Le plateau les tient
   * lui-même ; ils sont exposés pour que les tests lisent ce que le nuanceur
   * lit, sans passer par une compilation.
   */
  readonly uniformesEau: UniformesEau;
  /** Altitude du sol en un point du monde. */
  hauteurEn(x: number, z: number): number;
  /** Applique une ambiance (teinte, neige, humidité, couleur de l'eau). */
  appliquerAmbiance(p: ParametresAmbiance): void;
  /** Fait avancer l'eau. Rend vrai tant qu'il faut redessiner. */
  avancer(ms: number): boolean;
  /**
   * Relit la grille et remet le sol à jour : altitudes, mélange de matières,
   * voies et ponts.
   *
   * Sans cela, le plateau reste celui du **premier jour**. C'est ce qui rendait
   * les marées invisibles : `modifTerrain` fait lire une case `mer` comme
   * `plage`, la lecture logique change, l'image ne changeait pas. Un terrain
   * posé par le génie souffrait du même gel.
   *
   * `duree` fait de la mutation un **événement** : le mélange de matières et le
   * relief glissent de l'ancien état au nouveau, l'écume enfle puis retombe. Une
   * mer qui réapparaît d'une image à l'autre se lit comme un défaut d'affichage ;
   * une mer qui monte se lit comme une marée.
   */
  majTerrain(g: GrilleTerrain, duree?: number): void;
  /**
   * Pose le brouillard de guerre : les cases hors de `visibles` s'assombrissent,
   * `null` rend tout visible. Le masque n'est réécrit que si l'ensemble a
   * changé — le survol repasse ici à chaque case, avec le même ensemble.
   */
  majVisibles(visibles: ReadonlySet<string> | null): void;
  dispose(): void;
}

/**
 * Le masque de visibilité : un octet par case, `VU` ou zéro. Écrit dans
 * l'ordre des texels de la splat map, pour que les deux se lisent aux mêmes
 * coordonnées. `null` — pas de brouillard — donne une carte toute vue.
 */
export function donneesVisibles(g: GrilleTerrain, visibles: ReadonlySet<string> | null): Uint8Array<ArrayBuffer> {
  const donnees = new Uint8Array(g.largeur * g.hauteur);
  if (visibles === null) return donnees.fill(VU);
  for (let y = 0; y < g.hauteur; y += 1) {
    for (let x = 0; x < g.largeur; x += 1) {
      if (visibles.has(`${x},${y}`)) donnees[y * g.largeur + x] = VU;
    }
  }
  return donnees;
}

/**
 * Les uniformes du brouillard, partagés par tout ce qui se pose sur la carte,
 * et le **nœud de sortie** qui les lit. Un seul nœud pour tous les matériaux,
 * et pas un par greffe : le moteur à nœuds compose la clé de programme d'un
 * matériau avec l'**identité** de ses nœuds, et deux greffes bâties séparément
 * — même à formule égale — coûteraient deux programmes.
 */
export interface UniformesBrouillard {
  /**
   * Le masque, un octet par case, lu à la position monde du fragment. `.value`
   * est la texture du moment : elle est remplacée quand la carte change de
   * taille, et c'est ici qu'on la relit.
   */
  readonly tVisibles: ShaderNodeObject<TextureNode>;
  readonly uCarteBrouillard: ShaderNodeObject<UniformNode<THREE.Vector2>>;
  readonly uFacteurBrouillard: ShaderNodeObject<UniformNode<number>>;
  readonly uTeinteBrouillard: ShaderNodeObject<UniformNode<THREE.Color>>;
  /** La couleur finale d'un fragment, brouillard compris : posée telle quelle en `outputNode`. */
  readonly sortie: Node;
}

/**
 * Bâtit les uniformes du brouillard et leur nœud de sortie, pour un masque et
 * une carte donnés.
 *
 * L'assombrissement s'applique **après** l'éclairage : appliqué au diffus, le
 * reflet du studio et la lumière du ciel ramèneraient de la clarté sur une case
 * censée être dans le noir. `output` est la couleur que le matériau a finie
 * d'éclairer — et déjà passée au brouillard de scène : une case hors de vue
 * est noire même sous la brume, où le GLSL la fondait dans la brume. À facteur
 * nul et teinte noire, c'est la même chose ; c'est dit, pas caché.
 *
 * Le masque est lu en filtrage linéaire — un texel par case — et resserré par
 * `smoothstep` : la transition tient dans un demi-texel autour de la frontière,
 * au lieu de courir d'un centre de case à l'autre.
 *
 * La case se lit sur la **position monde** du fragment, `positionWorld` : le
 * sommet la calcule après `instanceMatrix`, donc arbres, pierres et accessoires
 * instanciés lisent chacun leur case sans qu'une ligne le dise ici. Le piège du
 * GLSL — « `instanceMatrix` avant `modelMatrix`, sinon tout le lot lit la case
 * de son origine » — n'existe plus.
 */
export function creerUniformesBrouillard(
  masque: THREE.DataTexture, largeur: number, hauteur: number,
): UniformesBrouillard {
  const uCarteBrouillard = uniform(new THREE.Vector2(largeur * CASE, hauteur * CASE)).label('uCarteBrouillard');
  const uFacteurBrouillard = uniform(FACTEUR_BROUILLARD).label('uFacteurBrouillard');
  const uTeinteBrouillard = uniform(new THREE.Color(TEINTE_BROUILLARD)).label('uTeinteBrouillard');
  const uvVisibles = clamp(positionWorld.xz.div(uCarteBrouillard), 0, 1);
  const tVisibles = texture(masque, uvVisibles).label('tVisibles');
  const vu = smoothstep(0.3, 0.7, tVisibles.r);
  const eteinte = output.rgb.mul(uFacteurBrouillard).add(uTeinteBrouillard);
  const sortie = vec4(mix(eteinte, output.rgb, vu), output.a);
  return { tVisibles, uCarteBrouillard, uFacteurBrouillard, uTeinteBrouillard, sortie };
}

/** La clé d'une greffe posée sans en donner : le plateau lui-même. */
const CLE_BROUILLARD = 'atlas-plateau';

/**
 * Les matériaux déjà greffés, et sous quelle clé. La clé ne fait plus rien au
 * programme — c'était un piège du WebGL, où deux matériaux greffés du même code
 * sous la même clé se volaient leur programme ; le moteur à nœuds compose la
 * sienne avec ses nœuds — mais elle dit, au débogage, d'où vient une greffe.
 */
const greffes = new WeakMap<THREE.Material, string>();

/**
 * Greffe la lecture du masque sur un matériau à nœuds : son `outputNode` devient
 * le nœud de sortie partagé. Le sol garde son mélange de matières et l'eau ses
 * rives — ce sont d'autres nœuds, `colorNode` et les siens.
 *
 * Un clone de matériau à nœuds **garde** son `outputNode` (à l'inverse du WebGL,
 * où un clone perdait son `onBeforeCompile`) : le jumeau translucide d'un
 * bâtiment naît greffé, et on ne lui repose pas la même greffe. Un matériau qui
 * porterait déjà un autre `outputNode` le perdrait : aucun n'en a, et plutôt
 * que d'écraser en silence, on refuse.
 */
export function grefferBrouillard(
  materiau: THREE.NodeMaterial, uniformes: UniformesBrouillard, cle: string = CLE_BROUILLARD,
): void {
  if (greffes.has(materiau) || materiau.outputNode === uniformes.sortie) return;
  if (materiau.outputNode !== null) {
    throw new Error(`grefferBrouillard : le matériau « ${materiau.name || materiau.type} » a déjà un outputNode`);
  }
  greffes.set(materiau, cle);
  materiau.outputNode = uniformes.sortie;
}

/** Vrai pour un matériau du moteur à nœuds — le seul qui sache lire une greffe. */
function estMateriauNoeuds(m: THREE.Material): m is THREE.NodeMaterial {
  return (m as { isNodeMaterial?: boolean }).isNodeMaterial === true;
}

/**
 * Greffe le brouillard sur **tout** ce qui pend d'un objet. C'est ainsi que
 * bâtiments, arbres, pierres et accessoires s'éteignent hors de vue : teindre
 * leur couleur en noir ne suffisait pas — un matériau noir garde le reflet du
 * studio et l'éclat du soleil, et c'est ce gris qu'on voyait dans le noir.
 * Le masque, lui, s'applique **après** l'éclairage. Un matériau qui n'est pas
 * à nœuds — une étiquette, un sprite — est laissé tel quel, comme l'étaient
 * les matériaux non standard.
 *
 * La même passe efface les **zéros qui coûtent un programme** (`programmes.ts`) :
 * c'est le seul endroit où tous les matériaux du décor passent, ceux des
 * bâtiments rebâtis et des clones translucides compris, et une vingtaine de
 * constructeurs dispersés dans `decor.ts` et `paysage.ts` laissaient tous le
 * métal à zéro par défaut.
 */
export function grefferBrouillardSur(
  racine: THREE.Object3D, uniformes: UniformesBrouillard, cle: string,
): void {
  racine.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) {
      normaliserMateriau(mat);
      if (estMateriauNoeuds(mat)) grefferBrouillard(mat, uniformes, cle);
    }
  });
}

/** Les jeux de textures du sol, dans l'ordre des canaux de la splat, plus la neige. */
interface JeuxSol {
  herbe: JeuMatiere;
  terre: JeuMatiere;
  roche: JeuMatiere;
  sable: JeuMatiere;
  neige: JeuMatiere;
}

/** Les réglages du sol que l'ambiance fait varier. */
interface UniformesSol {
  uTiling: ShaderNodeObject<UniformNode<THREE.Vector2>>;
  uNeige: ShaderNodeObject<UniformNode<number>>;
  uMouille: ShaderNodeObject<UniformNode<number>>;
}

/** Ce que le nuanceur du sol rend au plateau : ses trois nœuds, et la lecture de la splat. */
interface NoeudsSol {
  /** La splat telle que le sol la lit : c'est ici qu'on la remplace. */
  tSplat: ShaderNodeObject<TextureNode>;
  colorNode: Node;
  roughnessNode: Node;
  normalNode: Node;
}

/**
 * Le nuanceur du sol : mélange de cinq matières par la carte de répartition,
 * neige, humidité, rugosité et normales par matière. C'était du GLSL greffé
 * dans `map_fragment`, `roughnessmap_fragment` et `normal_fragment_maps` ; ce
 * sont trois nœuds — couleur, rugosité, normale — qui **partagent** leurs
 * lectures : la splat, le relief de la roche et la couverture de neige ne se
 * calculent qu'une fois par fragment, le constructeur de nœuds mettant en
 * variable tout ce qui est lu deux fois.
 */
function nuanceurSol(jeux: JeuxSol, u: UniformesSol, splat: THREE.DataTexture): NoeudsSol {
  const uvSol = uv();
  const tSplat = texture(splat, uvSol).label('tSplat');
  // Les quatre canaux se normalisent : une case n'est jamais « moins que pleine ».
  const somme = max(tSplat.r.add(tSplat.g).add(tSplat.b).add(tSplat.a), 0.001);
  const part = tSplat.div(somme);
  const uvD = uvSol.mul(u.uTiling);
  const echRoche = texture(jeux.roche.albedo, uvD.mul(0.6)).label('tRoche');
  // Le `map` du matériau est l'herbe, mais il se lit ici à son propre tuilage,
  // pas par `materialColor` : c'est pour cela que le nœud le rééchantillonne.
  const cHerbe = texture(jeux.herbe.albedo, uvD).label('tHerbe').rgb;
  const cTerre = texture(jeux.terre.albedo, uvD).label('tTerre').rgb;
  const cSable = texture(jeux.sable.albedo, uvD).label('tSable').rgb;
  const matiereNue = cHerbe.mul(part.r).add(cTerre.mul(part.g)).add(echRoche.rgb.mul(part.b)).add(cSable.mul(part.a));
  // Les congères interrompues laissent apparaître pierre et terre sous la neige.
  const reliefFin = echRoche.g;
  const depot = smoothstep(0.04, 0.55, u.uNeige.sub(reliefFin.mul(0.32)));
  const couverture = clamp(depot.mul(part.r.add(part.b).mul(0.38).add(0.62)), 0, 1);
  const matiere = mix(matiereNue, texture(jeux.neige.albedo, uvD.mul(0.8)).label('tNeige').rgb, couverture);
  // La teinte de saison colore surtout la végétation : appliquée telle quelle,
  // elle rendrait la roche brune en automne et le sable bleu en hiver.
  const teinteSaison = mix(vec3(1), materialReference('color', 'color'), clamp(part.r.mul(0.8).add(0.2), 0, 1));
  // La pluie assombrit surtout la terre et forme des zones humides irrégulières.
  const humiditeLocale = u.uMouille.mul(smoothstep(0.12, 0.45, reliefFin).mul(0.5).add(0.5));
  const colorNode = teinteSaison.mul(matiere).mul(humiditeLocale.mul(0.17).oneMinus());

  const rugositeMatiere = part.r.mul(0.95).add(part.g.mul(0.92)).add(part.b.mul(0.78)).add(part.a.mul(0.97));
  const roughnessNode = mix(mix(rugositeMatiere, 0.24, humiditeLocale), 0.68, couverture.mul(0.7));

  const decoder = (t: THREE.Texture, uvN: ShaderNodeObject<Node>, nom: string): ShaderNodeObject<Node> =>
    texture(t, uvN).label(nom).xyz.mul(2).sub(1);
  const nHerbe = decoder(jeux.herbe.normales, uvD, 'nHerbe');
  const nTerre = decoder(jeux.terre.normales, uvD, 'nTerre');
  const nRoche = decoder(jeux.roche.normales, uvD.mul(0.6), 'nRoche');
  const nSable = decoder(jeux.sable.normales, uvD, 'nSable');
  const mapN = normalize(nHerbe.mul(part.r).add(nTerre.mul(part.g)).add(nRoche.mul(part.b)).add(nSable.mul(part.a)));
  const echelle = materialReference('normalScale', 'vec2').mul(couverture.mul(0.6).oneMinus());
  // `normalMap` attend une carte **encodée** — il la décode lui-même, applique
  // l'échelle à `xy` et passe en espace de vue par le repère tangent que three
  // dérive de l'écran, faute de tangentes sur le sol. On lui rend donc le
  // mélange normalisé sous sa forme encodée : c'est exactement `tbn * mapN`.
  const normalNode = normalMap(mapN.mul(0.5).add(0.5), echelle);
  return { tSplat, colorNode, roughnessNode, normalNode };
}

/** Les réglages de l'eau, tenus par le plateau et lus par son nuanceur. */
export interface UniformesEau {
  /** La profondeur sous l'eau, un texel par case ; `.value` est la texture du moment. */
  readonly tFonds: ShaderNodeObject<TextureNode>;
  readonly uCarte: ShaderNodeObject<UniformNode<THREE.Vector2>>;
  /** Le temps, en secondes : `avancer` le fait courir, c'est lui qui anime l'écume. */
  readonly uTemps: ShaderNodeObject<UniformNode<number>>;
  readonly uEcume: ShaderNodeObject<UniformNode<number>>;
  readonly uRive: ShaderNodeObject<UniformNode<THREE.Color>>;
}

/**
 * Le nuanceur de l'eau : hauts-fonds teintés et écume au bord, d'après la
 * profondeur lue à la position monde. C'était du GLSL après `color_fragment` ;
 * la formule est la même, `positionWorld.xz` remplaçant `vMondeEau`.
 */
function nuanceurEau(fonds: THREE.DataTexture, largeur: number, hauteur: number, rive: number): {
  uniformes: UniformesEau; colorNode: Node;
} {
  const uCarte = uniform(new THREE.Vector2(largeur * CASE, hauteur * CASE)).label('uCarte');
  const uTemps = uniform(0).label('uTemps');
  const uEcume = uniform(0.3).label('uEcume');
  const uRive = uniform(new THREE.Color(rive)).label('uRive');
  const uvCarte = positionWorld.xz.div(uCarte);
  const tFonds = texture(fonds, clamp(uvCarte, 0, 1)).label('tFonds');
  const dansCarte = step(0, uvCarte.x).mul(step(0, uvCarte.y)).mul(step(uvCarte.x, 1)).mul(step(uvCarte.y, 1));
  const fond = tFonds.r.mul(1.4).sub(0.4);
  const profondeur = max(0, float(-0.12).sub(fond));
  const peuProfond = smoothstep(0.025, 0.27, profondeur).oneMinus().mul(dansCarte);
  const teinteFonds = mix(materialReference('color', 'color'), uRive, peuProfond.mul(0.65));
  const vague = sin(profondeur.mul(100).sub(uTemps.mul(1.6)).add(sin(positionWorld.x.mul(5).add(positionWorld.z.mul(3)))));
  const bord = smoothstep(0.005, 0.09, profondeur).oneMinus().mul(dansCarte);
  const ecume = smoothstep(0.42, 0.95, vague).mul(bord).mul(uEcume);
  const colorNode = mix(teinteFonds, vec3(0.82, 0.91, 0.86), ecume);
  return { uniformes: { tFonds, uCarte, uTemps, uEcume, uRive }, colorNode };
}

/**
 * Une texture d'un texel par case, lue en linéaire et bornée : la splat, les
 * fonds et le masque de visibilité sont tous faits ainsi.
 */
function textureCases(
  donnees: Uint8Array<ArrayBuffer>, largeur: number, hauteur: number, format: THREE.PixelFormat,
): THREE.DataTexture {
  const t = new THREE.DataTexture(donnees, largeur, hauteur, format, THREE.UnsignedByteType);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

/**
 * Remplace la texture que lit un nœud, et libère l'ancienne. Une texture
 * WebGPU ne change pas de taille : à une carte d'autres dimensions, une autre
 * texture — le nœud garde son nom et sa place dans le nuanceur, seule la
 * ressource liée change.
 */
function remplacer(noeud: ShaderNodeObject<TextureNode>, neuve: THREE.DataTexture): THREE.DataTexture {
  const ancienne = noeud.value;
  noeud.value = neuve;
  ancienne.dispose();
  return neuve;
}

/** Construit la géométrie du sol, altitudes comprises. */
function geometrieSol(g: GrilleTerrain): THREE.BufferGeometry {
  const nx = g.largeur * SUBDIVISIONS;
  const nz = g.hauteur * SUBDIVISIONS;
  const positions = new Float32Array((nx + 1) * (nz + 1) * 3);
  const uvs = new Float32Array((nx + 1) * (nz + 1) * 2);
  const pas = CASE / SUBDIVISIONS;
  for (let j = 0; j <= nz; j += 1) {
    for (let i = 0; i <= nx; i += 1) {
      const k = j * (nx + 1) + i;
      const x = i * pas;
      const z = j * pas;
      positions[k * 3] = x;
      positions[k * 3 + 1] = hauteurSol(g, x, z);
      positions[k * 3 + 2] = z;
      uvs[k * 2] = x / (g.largeur * CASE);
      uvs[k * 2 + 1] = z / (g.hauteur * CASE);
    }
  }
  const indices: number[] = [];
  for (let j = 0; j < nz; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + (nx + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** Le socle du diorama : la tranche de terre qui porte le plateau. */
function geometrieSocle(g: GrilleTerrain): THREE.BufferGeometry {
  const L = g.largeur * CASE;
  const H = g.hauteur * CASE;
  const bas = -1.1;
  const positions: number[] = [];
  const normales: number[] = [];
  const pas = CASE / SUBDIVISIONS;

  const mur = (
    x0: number, z0: number, x1: number, z1: number, nx: number, nz: number,
  ): void => {
    const y0 = hauteurSol(g, x0, z0) + 0.001;
    const y1 = hauteurSol(g, x1, z1) + 0.001;
    positions.push(x0, y0, z0, x0, bas, z0, x1, bas, z1);
    positions.push(x0, y0, z0, x1, bas, z1, x1, y1, z1);
    for (let i = 0; i < 6; i += 1) normales.push(nx, 0, nz);
  };

  for (let i = 0; i < g.largeur * SUBDIVISIONS; i += 1) {
    mur(i * pas, 0, (i + 1) * pas, 0, 0, -1);
    mur((i + 1) * pas, H, i * pas, H, 0, 1);
  }
  for (let j = 0; j < g.hauteur * SUBDIVISIONS; j += 1) {
    mur(0, (j + 1) * pas, 0, j * pas, -1, 0);
    mur(L, j * pas, L, (j + 1) * pas, 1, 0);
  }
  // Le fond, pour que le socle ne soit pas creux vu d'en dessous.
  positions.push(0, bas, 0, L, bas, 0, L, bas, H, 0, bas, 0, L, bas, H, 0, bas, H);
  for (let i = 0; i < 6; i += 1) normales.push(0, -1, 0);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normales, 3));
  return geo;
}

/** Hauteur du décalque de voie au-dessus de la surface. */
const HAUT_VOIE = 0.022;

/**
 * Le décalque des voies : pour chaque case de route ou de pont, une nappe de
 * `SUBDIVISIONS × SUBDIVISIONS` quads **aux mêmes sommets que le sol**, donc
 * exactement parallèle à lui — échantillonnée plus fin, elle passerait sous les
 * facettes du maillage entre deux sommets —, et des UV tournés vers la tuile
 * de l'atlas que `pieceDeCase` a choisie. Une seule géométrie, un seul appel.
 */
function geometrieVoies(g: GrilleTerrain): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const pas = CASE / SUBDIVISIONS;
  for (let y = 0; y < g.hauteur; y += 1) {
    for (let x = 0; x < g.largeur; x += 1) {
      const piece = pieceDeCase(g, x, y);
      if (!piece) continue;
      const base = positions.length / 3;
      for (let j = 0; j <= SUBDIVISIONS; j += 1) {
        for (let i = 0; i <= SUBDIVISIONS; i += 1) {
          const px = x * CASE + i * pas;
          const pz = y * CASE + j * pas;
          positions.push(px, hauteurEn(g, px, pz) + HAUT_VOIE, pz);
          const [u, v] = uvAtlas(piece.forme, piece.rotation, i / SUBDIVISIONS, j / SUBDIVISIONS);
          uvs.push(u, v);
        }
      }
      for (let j = 0; j < SUBDIVISIONS; j += 1) {
        for (let i = 0; i < SUBDIVISIONS; i += 1) {
          const a = base + j * (SUBDIVISIONS + 1) + i;
          const b = a + 1;
          const c = a + (SUBDIVISIONS + 1);
          const d = c + 1;
          // Même diagonale que le sol : les deux nappes restent parallèles.
          indices.push(a, c, b, b, c, d);
        }
      }
    }
  }
  if (positions.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Les cotes d'un pont, en cases : tablier, parapets, piles. */
const PONT = {
  /** Largeur hors tout du tablier : un peu plus que la chaussée et ses accotements. */
  largeur: 0.64,
  epaisseurTablier: 0.07,
  /** Le dessus du tablier, juste sous le décalque de voie. */
  dessus: -0.006,
  parapet: { largeur: 0.05, hauteur: 0.11 },
  pile: { cote: 0.1, long: 0.33, travers: 0.2, fond: -0.36 },
} as const;

/**
 * Les ponts : un tablier, deux parapets et quatre piles par case, dans l'axe
 * que `axePont` a lu sur les voisines, le tout **fusionné** en une géométrie.
 * Les piles descendent sous le lit : elles ne flottent pas quand la marée
 * baisse. Le tablier est plat à la hauteur du terrain `pont`, c'est-à-dire là
 * où `hauteurEn` pose les unités qui le traversent.
 */
function geometriePonts(g: GrilleTerrain): THREE.BufferGeometry | null {
  const morceaux: THREE.BufferGeometry[] = [];
  const boite = (l: number, h: number, p: number, x: number, y: number, z: number): THREE.BufferGeometry =>
    new THREE.BoxGeometry(l, h, p).translate(x, y, z);
  for (let y = 0; y < g.hauteur; y += 1) {
    for (let x = 0; x < g.largeur; x += 1) {
      if (terrainBorne(g, x, y) !== 'pont') continue;
      const axe = axePont(g, x, y);
      // Composé dans l'axe nord-sud (le long de Z), puis tourné s'il le faut.
      const parts = [
        boite(PONT.largeur, PONT.epaisseurTablier, CASE, 0, PONT.dessus - PONT.epaisseurTablier / 2, 0),
      ];
      for (const cote of [-1, 1]) {
        const bord = (PONT.largeur - PONT.parapet.largeur) / 2 * cote;
        parts.push(boite(PONT.parapet.largeur, PONT.parapet.hauteur, CASE, bord, PONT.dessus + PONT.parapet.hauteur / 2, 0));
        for (const bout of [-1, 1]) {
          const haut = PONT.dessus - PONT.epaisseurTablier;
          parts.push(boite(
            PONT.pile.cote, haut - PONT.pile.fond, PONT.pile.cote,
            PONT.pile.travers * cote, (haut + PONT.pile.fond) / 2, PONT.pile.long * bout,
          ));
        }
      }
      const pont = mergeGeometries(parts);
      parts.forEach((p) => p.dispose());
      if (!pont) continue;
      if (axe === 'eo') pont.rotateY(Math.PI / 2);
      pont.translate(x * CASE + CASE / 2, 0, y * CASE + CASE / 2);
      morceaux.push(pont);
    }
  }
  if (morceaux.length === 0) return null;
  const geo = mergeGeometries(morceaux);
  morceaux.forEach((m) => m.dispose());
  return geo;
}

/** Le plan d'eau : la carte, plus `DEBORD_EAU` de chaque côté. */
function geometrieEau(g: GrilleTerrain): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(
    g.largeur * CASE + 2 * DEBORD_EAU, g.hauteur * CASE + 2 * DEBORD_EAU, 1, 1,
  );
}

/**
 * La profondeur sous l'eau, un texel par case : c'est elle qui teinte les
 * hauts-fonds et pose l'écume. Elle se relit à chaque changement de sol, sans
 * quoi une marée déplacerait la berge et laisserait l'écume sur l'ancienne.
 */
function donneesFonds(g: GrilleTerrain): Uint8Array<ArrayBuffer> {
  const fonds = new Uint8Array(g.largeur * g.hauteur * 4);
  for (let y = 0; y < g.hauteur; y += 1) {
    for (let x = 0; x < g.largeur; x += 1) {
      const i = (y * g.largeur + x) * 4;
      fonds[i] = Math.round((hauteurSol(g, x + 0.5, y + 0.5) + 0.4) / 1.4 * 255);
      fonds[i + 3] = 255;
    }
  }
  return fonds;
}

/** La grille au sol : des lignes fines, posées juste au-dessus du terrain. */
function geometrieGrille(g: GrilleTerrain): THREE.BufferGeometry {
  const positions: number[] = [];
  const pas = CASE / SUBDIVISIONS;
  const HAUT = 0.012;
  const ligne = (x0: number, z0: number, x1: number, z1: number): void => {
    positions.push(x0, hauteurSol(g, x0, z0) + HAUT, z0, x1, hauteurSol(g, x1, z1) + HAUT, z1);
  };
  for (let x = 0; x <= g.largeur; x += 1) {
    for (let j = 0; j < g.hauteur * SUBDIVISIONS; j += 1) {
      ligne(x * CASE, j * pas, x * CASE, (j + 1) * pas);
    }
  }
  for (let y = 0; y <= g.hauteur; y += 1) {
    for (let i = 0; i < g.largeur * SUBDIVISIONS; i += 1) {
      ligne(i * pas, y * CASE, (i + 1) * pas, y * CASE);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

/**
 * Les cinq matières du sol, avec la taille de leur toile. La neige n'est reprise
 * par aucune palette de biome (`textures.ts`) : elle garde donc la sienne
 * partout, et c'est ce qui lui vaut une seule toile pour toutes les cartes.
 *
 * **Une seule liste**, lue par `creerPlateau` et par `tranchesToilesPlateau` :
 * deux copies divergeraient, et la seconde préparerait des toiles que la
 * première ne demande pas — la faute déjà commise quatre fois sur les listes de
 * bâtiments (`CLAUDE.md`, catalogue 5).
 */
const MATIERES_SOL = [
  { matiere: 'herbe', taille: 256, teintee: true },
  { matiere: 'terre', taille: 256, teintee: true },
  { matiere: 'roche', taille: 256, teintee: true },
  { matiere: 'sable', taille: 256, teintee: true },
  { matiere: 'neige', taille: 128, teintee: false },
] as const;

/**
 * Les toiles du plateau, en tranches : une par appel, à jouer chacune dans sa
 * propre tâche avant `creerPlateau` (`index.ts`). Rien n'est rendu — les pixels
 * vont dans la mémoire de `textures.ts`, où `creerPlateau` les retrouvera sans
 * repeindre. Un plateau bâti sans avoir joué ces tranches marche exactement
 * pareil, il paie simplement tout d'un coup : c'est ce que font le banc, la
 * vitrine et les tests.
 */
export function tranchesToilesPlateau(doc: Document, biome: Biome = 'plaine'): Array<() => void> {
  const tranches: Array<() => void> = MATIERES_SOL.map((d) => (): void => {
    preparerMatiere(doc, d.matiere, d.taille, d.teintee ? biome : 'plaine');
  });
  // L'eau et l'atlas des voies gardent la taille par défaut de leur fonction :
  // c'est ainsi que `creerPlateau` les demande, et deux appels sans taille ne
  // peuvent pas diverger.
  tranches.push((): void => { preparerEau(doc); });
  tranches.push((): void => { atlasVoies(doc, biome); });
  return tranches;
}

/** Monte le plateau complet dans un groupe. */
export function creerPlateau(g: GrilleTerrain, doc: Document, biome: Biome = 'plaine'): Plateau {
  const groupe = new THREE.Group();
  groupe.name = 'plateau';

  const [herbe, terre, roche, sable, neige] = MATIERES_SOL.map(
    (d) => jeuMatiere(doc, d.matiere, d.taille, d.teintee ? biome : 'plaine'),
  ) as [JeuMatiere, JeuMatiere, JeuMatiere, JeuMatiere, JeuMatiere];

  // Les textures d'un texel par case sont **remplacées** quand la carte change
  // de taille : ces trois-là sont les textures du moment, jamais gelées.
  let splat = textureCases(construireSplat(g), g.largeur, g.hauteur, THREE.RGBAFormat);

  // --- Le brouillard de guerre : un octet par case, lu par tout le plateau.
  //     `null` au départ : un plateau naît tout vu, `majVisibles` le voile.
  let visiblesCourants: ReadonlySet<string> | null = null;
  let tVisibles = textureCases(donneesVisibles(g, null), g.largeur, g.hauteur, THREE.RedFormat);
  const uBrouillard = creerUniformesBrouillard(tVisibles, g.largeur, g.hauteur);

  const uSol: UniformesSol = {
    uTiling: uniform(new THREE.Vector2(g.largeur * TUILAGE, g.hauteur * TUILAGE)).label('uTiling'),
    uNeige: uniform(0).label('uNeige'),
    uMouille: uniform(0).label('uMouille'),
  };
  const noeudsSol = nuanceurSol({ herbe, terre, roche, sable, neige }, uSol, splat);

  // `map` et `normalMap` restent au matériau : c'est là qu'on libère l'herbe,
  // et c'est ce qui dit de quelle matière le sol est fait par défaut. Les
  // nœuds les rééchantillonnent à leur tuilage, ils ne passent pas par eux.
  const matSol = new THREE.MeshStandardNodeMaterial({
    map: herbe.albedo,
    normalMap: herbe.normales,
    normalScale: new THREE.Vector2(0.58, 0.58),
    roughness: 0.95,
    metalness: 0,
  });
  matSol.colorNode = noeudsSol.colorNode;
  matSol.roughnessNode = noeudsSol.roughnessNode;
  matSol.normalNode = noeudsSol.normalNode;
  grefferBrouillard(matSol, uBrouillard, 'atlas-sol');

  const sol = new THREE.Mesh(geometrieSol(g), matSol);
  sol.name = 'sol';
  sol.receiveShadow = true;
  sol.castShadow = true;
  groupe.add(sol);

  const matSocle = new THREE.MeshStandardNodeMaterial({
    map: terre.albedo,
    normalMap: terre.normales,
    roughness: 0.98,
    metalness: 0,
    color: 0x7d6c56,
  });
  grefferBrouillard(matSocle, uBrouillard, 'atlas-socle');
  const socle = new THREE.Mesh(geometrieSocle(g), matSocle);
  const tamponSocle = creerTampon(socle);
  socle.name = 'socle';
  socle.receiveShadow = true;
  groupe.add(socle);

  // --- Les voies : un décalque par case de route ou de pont, tous dans une
  //     seule géométrie. Le décalque écrit la profondeur malgré sa
  //     transparence : sans cela, le plan d'eau — dessiné après lui — repeindrait
  //     la chaussée d'un pont, puisque le sol sous le tablier est un lit de
  //     rivière. `alphaTest` jette les pixels vides pour qu'ils ne le fassent pas.
  //     Le décalage de polygone est gardé mais **inerte** : le moteur WebGPU de
  //     r170 ne le traduit pas ; c'est `HAUT_VOIE` qui tient le décalque hors du sol.
  const apparence = APPARENCES[biome];
  const texVoies = textureVoies(doc, biome);
  const matVoie = new THREE.MeshStandardNodeMaterial({
    map: texVoies,
    roughness: 0.88,
    metalness: 0,
    transparent: true,
    alphaTest: 0.03,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  // Les voies et les ponts ont leurs propres matériaux : sans la greffe, une
  // route claire traverserait le noir comme un trait de craie.
  grefferBrouillard(matVoie, uBrouillard, 'atlas-voie');
  const voies = new THREE.Mesh(new THREE.BufferGeometry(), matVoie);
  const tamponVoies = creerTampon(voies);
  voies.name = 'voies';
  voies.receiveShadow = true;
  voies.visible = false;
  groupe.add(voies);

  const matPont = new THREE.MeshStandardNodeMaterial({
    color: apparence.pont,
    roughness: 0.82,
    metalness: 0,
  });
  grefferBrouillard(matPont, uBrouillard, 'atlas-pont');
  const ponts = new THREE.Mesh(new THREE.BufferGeometry(), matPont);
  const tamponPonts = creerTampon(ponts);
  ponts.name = 'ponts';
  ponts.castShadow = true;
  ponts.receiveShadow = true;
  ponts.visible = false;
  groupe.add(ponts);

  /**
   * Recoud voies et ponts sur une grille, ou les cache s'il n'y en a plus.
   *
   * Par tampon, et non par échange : une marée passe ici à chaque fois, et sous
   * WebGPU un échange de géométrie coûte un objet de rendu et un nuanceur neufs
   * pour **chacune** des passes où la maille paraît — la principale, l'ombre,
   * les normales du GTAO —, avec le risque qu'une passe qui a manqué l'échange
   * retombe sur une clé déjà vue (`maillage.ts`).
   */
  function majVoies(suivante: GrilleTerrain): void {
    for (const [tampon, maille, batir] of [
      [tamponVoies, voies, geometrieVoies], [tamponPonts, ponts, geometriePonts],
    ] as const) {
      const geo = batir(suivante);
      tampon.poser(geo);
      maille.visible = geo !== null;
    }
  }
  majVoies(g);

  // La grille au sol n'a pas de greffe : c'est déjà un trait sombre et presque
  // transparent, qui ne peut pas dessiner la carte en clair dans le noir.
  const matGrille = new THREE.LineBasicNodeMaterial({
    color: 0x0a1220, transparent: true, opacity: 0.17, depthWrite: false,
  });
  const grille = new THREE.LineSegments(geometrieGrille(g), matGrille);
  const tamponGrille = creerTampon(grille);
  grille.name = 'grille';
  grille.renderOrder = 1;
  groupe.add(grille);

  // --- L'eau : un plan qui déborde de la carte d'une case, pour que le socle
  //     se lise comme posé sur l'eau ; le reste de l'écran est au ciel.
  const nEau = normalesEau(doc);
  nEau.repeat.set(6, 6);
  const matEau = new THREE.MeshStandardNodeMaterial({
    color: 0x2a6ea8,
    normalMap: nEau,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.34,
    metalness: 0.0,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  // Un champ d'altitude partagé avec le sol donne une profondeur réelle à l'eau.
  // Une seule texture basse résolution, aucune géométrie par vague ou par rive.
  let tFonds = textureCases(donneesFonds(g), g.largeur, g.hauteur, THREE.RGBAFormat);
  const teintesRive: Partial<Record<Biome, number>> = {
    archipel: 0x66c9b3, cotier: 0x80b9b0, marais: 0x929b68,
    volcanique: 0x7d979a, neige: 0xb7d6da,
  };
  const noeudsEau = nuanceurEau(tFonds, g.largeur, g.hauteur, teintesRive[biome] ?? 0x91b9ad);
  const uEau = noeudsEau.uniformes;
  matEau.colorNode = noeudsEau.colorNode;
  // L'eau aussi : une mer claire dans le noir dessinerait la carte en négatif.
  grefferBrouillard(matEau, uBrouillard, 'atlas-eau');
  const eau = new THREE.Mesh(geometrieEau(g), matEau);
  eau.name = 'eau';
  eau.rotation.x = -Math.PI / 2;
  eau.position.set((g.largeur * CASE) / 2, NIVEAU_EAU, (g.hauteur * CASE) / 2);
  // Un pont porte son ombre sur l'eau qu'il franchit : c'est elle qui dit
  // qu'il est au-dessus, et non posé dessus.
  eau.receiveShadow = true;
  eau.renderOrder = 2;
  groupe.add(eau);

  let agitation = 0.4;
  let temps = 0;
  // Le terrain courant : il change quand la marée monte ou qu'on pose un pont.
  let terrain = g;

  /** La mutation en cours, ou `null`. Les tableaux sont les deux états à mêler. */
  let mutation: {
    ecoule: number;
    duree: number;
    splatAvant: Uint8Array;
    splatApres: Uint8Array;
    yAvant: Float32Array;
    yApres: Float32Array;
  } | null = null;

  /** L'écume au repos, pour l'agitation courante. */
  const ecumeRepos = (): number => 0.32 + agitation * 0.36;

  /**
   * Repose sur le sol courant ce qui en dérive sans être le maillage : le
   * socle, la grille et la profondeur lue par l'eau. Ils étaient bâtis une
   * fois au montage — le gel déjà rencontré pour le terrain lui-même : après
   * une marée, la grille flottait ou s'enterrait et l'écume restait sur
   * l'ancienne berge. Le plan d'eau, lui, ne dépend que des dimensions.
   */
  function reposer(g2: GrilleTerrain): void {
    tamponSocle.poser(geometrieSocle(g2));
    tamponGrille.poser(geometrieGrille(g2));
    const donnees = donneesFonds(g2);
    if (tFonds.image.width === g2.largeur && tFonds.image.height === g2.hauteur) {
      (tFonds.image.data as Uint8Array).set(donnees);
      tFonds.needsUpdate = true;
    } else {
      // Une autre taille, une autre texture : le nœud qui lit les fonds change
      // de valeur, et le moteur relie la nouvelle au prochain rendu.
      tFonds = remplacer(uEau.tFonds, textureCases(donnees, g2.largeur, g2.hauteur, THREE.RGBAFormat));
      uEau.uCarte.value.set(g2.largeur * CASE, g2.hauteur * CASE);
      remplacerGeometrie(eau, geometrieEau(g2));
      eau.position.set((g2.largeur * CASE) / 2, NIVEAU_EAU, (g2.hauteur * CASE) / 2);
      // Le masque de visibilité a la taille de la carte : il suit, avec le
      // dernier ensemble connu — la texture des fonds fait exactement cela.
      tVisibles = remplacer(
        uBrouillard.tVisibles,
        textureCases(donneesVisibles(g2, visiblesCourants), g2.largeur, g2.hauteur, THREE.RedFormat),
      );
      uBrouillard.uCarteBrouillard.value.set(g2.largeur * CASE, g2.hauteur * CASE);
    }
  }

  /** Termine une mutation : on pose l'état d'arrivée, exactement. */
  function acheverMutation(): void {
    const m = mutation;
    if (!m) return;
    (splat.image.data as Uint8Array).set(m.splatApres);
    splat.needsUpdate = true;
    const pos = sol.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < m.yApres.length; i += 1) pos.setY(i, m.yApres[i]!);
    pos.needsUpdate = true;
    // Les normales ne sont recalculées **qu'ici** : les rafraîchir à chaque image
    // de la transition coûterait plus que tout le reste, pour un gain invisible
    // pendant une seconde de mouvement.
    sol.geometry.computeVertexNormals();
    mutation = null;
    reposer(terrain);
    uEau.uEcume.value = ecumeRepos();
  }

  /** La dernière ambiance appliquée : la même identité ne se réapplique pas. */
  let ambiance: ParametresAmbiance | null = null;

  return {
    groupe,
    sol,
    ponts,
    uniformesBrouillard: uBrouillard,
    uniformesEau: uEau,
    hauteurEn: (x, z) => hauteurEn(terrain, x, z),

    majTerrain(suivante: GrilleTerrain, duree = 0): void {
      acheverMutation();
      terrain = suivante;
      const donnees = construireSplat(suivante);
      const neuve = geometrieSol(suivante);
      const yApres = new Float32Array(neuve.getAttribute('position').count);
      const posNeuve = neuve.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < yApres.length; i += 1) yApres[i] = posNeuve.getY(i);

      // Les dimensions ne changent jamais **en cours de partie** : tant qu'elles
      // tiennent, on garde la géométrie et on ne fait glisser que les altitudes.
      // Mais le plateau survit à un changement de carte — l'atelier en change
      // sans démonter la scène —, et une splat écrite au chausse-pied dans une
      // texture d'une autre taille lève un `RangeError` qui blanchit la page.
      const posCourante = sol.geometry.getAttribute('position') as THREE.BufferAttribute;
      const memeMaillage = posCourante.count === yApres.length;
      const memeTaille = splat.image.width === suivante.largeur
        && splat.image.height === suivante.hauteur;
      if (!memeTaille) {
        // Une nouvelle texture plutôt qu'une écriture : sous WebGPU une texture
        // ne change pas de taille, le nœud du sol lit désormais celle-ci.
        splat = remplacer(noeudsSol.tSplat, textureCases(donnees, suivante.largeur, suivante.hauteur, THREE.RGBAFormat));
        remplacerGeometrie(sol, neuve);
        majVoies(suivante);
        reposer(suivante);
        return;
      }
      if (duree > 0 && memeMaillage) {
        const yAvant = new Float32Array(yApres.length);
        for (let i = 0; i < yAvant.length; i += 1) yAvant[i] = posCourante.getY(i);
        mutation = {
          ecoule: 0,
          duree,
          splatAvant: (splat.image.data as Uint8Array).slice(),
          splatApres: donnees,
          yAvant,
          yApres,
        };
        neuve.dispose();
      } else if (memeMaillage) {
        // Le même maillage : on **écrit** les altitudes dans la géométrie du sol
        // au lieu de l'échanger. Sous WebGPU un échange invalide trois objets de
        // rendu — la passe principale, la carte d'ombre, les normales du GTAO —
        // et fait recompiler autant de nuanceurs ; une écriture ne coûte qu'un
        // téléversement, que `NodeMaterialObserver` déclenche sur la version de
        // l'attribut. C'est le chemin de la toute première carte affichée.
        for (let i = 0; i < yApres.length; i += 1) posCourante.setY(i, yApres[i]!);
        posCourante.needsUpdate = true;
        sol.geometry.computeVertexNormals();
        neuve.dispose();
        (splat.image.data as Uint8Array).set(donnees);
        splat.needsUpdate = true;
        reposer(suivante);
      } else {
        // Même carte mais autre maillage : cela n'arrive pas aujourd'hui, la
        // subdivision étant constante. On échange, et le témoin monotone de
        // `remplacerGeometrie` garantit qu'aucune passe ne garde l'ancienne.
        remplacerGeometrie(sol, neuve);
        (splat.image.data as Uint8Array).set(donnees);
        splat.needsUpdate = true;
        reposer(suivante);
      }
      majVoies(suivante);
    },

    majVisibles(visibles: ReadonlySet<string> | null): void {
      // La vue arrive à chaque survol avec un ensemble **neuf** mais égal :
      // on compare les octets, et l'on ne renvoie la texture au processeur
      // graphique que si une case a changé de camp. Le masque a la taille de
      // la carte courante — `reposer` l'y a mis si elle a changé.
      const donnees = donneesVisibles(terrain, visibles);
      const courant = tVisibles.image.data as Uint8Array;
      let identique = courant.length === donnees.length;
      for (let i = 0; identique && i < donnees.length; i += 1) identique = courant[i] === donnees[i];
      visiblesCourants = visibles;
      if (identique) return;
      courant.set(donnees);
      tVisibles.needsUpdate = true;
    },

    // `eclairage.courant` rend le **même** objet d'une image à l'autre tant
    // qu'aucune transition ne joue, et un objet neuf par image pendant l'une
    // d'elles : l'identité suffit à ne travailler que quand la lumière bouge.
    appliquerAmbiance(p: ParametresAmbiance): void {
      if (p === ambiance) return;
      ambiance = p;
      matSol.color.set(p.teinteSol);
      matSocle.color.set(p.teinteSol).multiplyScalar(0.55);
      // Le revêtement ne prend qu'un soupçon de la teinte de saison : une route
      // qui vire au sable en automne se lit comme un chemin de terre. La neige
      // qui tombe, elle, le blanchit à moitié — jamais tout à fait, une voie
      // déneigée reste lisible, c'est même ce qui la rend utile.
      matVoie.color.set(0xffffff).lerp(TAMPON.set(p.teinteSol), 0.1)
        .lerp(NEIGE_VOIE, p.neigeSol * 0.5);
      matPont.color.set(apparence.pont).lerp(NEIGE_VOIE, p.neigeSol * 0.35);
      matVoie.roughness = 0.88 - p.mouille * 0.45;
      uSol.uNeige.value = Math.max(p.neigeSol, biome === 'neige' ? 0.78 : 0);
      uSol.uMouille.value = p.mouille;
      matEau.color.set(p.eau.couleur);
      matEau.opacity = p.eau.opacite;
      matEau.roughness = 0.26 + p.mouille * 0.08;
      agitation = p.eau.agitation;
      // Pendant une marée, `avancer` module l'écume : on ne lui reprend pas la main.
      if (!mutation) uEau.uEcume.value = ecumeRepos();
      uEau.uRive.value.set(teintesRive[biome] ?? 0x91b9ad).multiply(TAMPON.set(p.teinteSol));
      matGrille.opacity = 0.16 + p.neigeSol * 0.06;
    },

    // L'eau avance à chaque image mais ne **réclame** jamais d'image : au repos,
    // c'est la relance à une image par seconde qui la fait dériver doucement.
    avancer(ms: number): boolean {
      temps += ms;
      uEau.uTemps.value = temps / 1000;
      let encore = false;
      const m = mutation;
      if (m) {
        m.ecoule += ms;
        const brut = Math.min(1, m.ecoule / m.duree);
        if (brut >= 1) {
          acheverMutation();
        } else {
          // Une marée part vite et s'étale : c'est l'étale de fin de course.
          const t = 1 - (1 - brut) ** 3;
          const octets = splat.image.data as Uint8Array;
          for (let i = 0; i < octets.length; i += 1) {
            octets[i] = m.splatAvant[i]! + (m.splatApres[i]! - m.splatAvant[i]!) * t;
          }
          splat.needsUpdate = true;
          const pos = sol.geometry.getAttribute('position') as THREE.BufferAttribute;
          for (let i = 0; i < m.yAvant.length; i += 1) {
            pos.setY(i, m.yAvant[i]! + (m.yApres[i]! - m.yAvant[i]!) * t);
          }
          pos.needsUpdate = true;
          // L'écume enfle au passage du front, puis retombe : c'est elle qui
          // raconte le mouvement, plus que le niveau lui-même.
          uEau.uEcume.value = ecumeRepos() * (1 + Math.sin(brut * Math.PI) * 1.1);
          encore = true;
        }
      }
      const dt = Math.min(2, ms / 1000);
      nEau.offset.x += dt * 0.012 * (0.4 + agitation);
      nEau.offset.y += dt * 0.019 * (0.4 + agitation);
      matEau.normalScale.setScalar(0.18 + Math.sin(temps / 2400) * 0.03 + agitation * 0.16);
      return encore;
    },

    dispose(): void {
      sol.geometry.dispose();
      // Ces quatre-là ne possèdent plus leur géométrie : c'est leur tampon.
      tamponSocle.dispose();
      tamponGrille.dispose();
      tamponVoies.dispose();
      tamponPonts.dispose();
      eau.geometry.dispose();
      matSol.dispose();
      matSocle.dispose();
      matVoie.dispose();
      matPont.dispose();
      matGrille.dispose();
      matEau.dispose();
      // Les textures du moment : celles d'avant un changement de taille ont
      // été libérées en étant remplacées.
      splat.dispose();
      tFonds.dispose();
      tVisibles.dispose();
      texVoies.dispose();
      nEau.dispose();
      for (const j of [herbe, terre, roche, sable, neige]) {
        j.albedo.dispose();
        j.normales.dispose();
      }
    },
  };
}
