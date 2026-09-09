/**
 * Validation d'un `AssetSpec` : on refuse une spécification bancale **avant** de
 * la donner au générateur, parce qu'une spécification fausse produit un asset
 * faux et fait perdre un aller-retour complet.
 *
 * Écrit avec les combinateurs de `schemas/noyau.ts`, dans le même style et avec
 * les mêmes messages en français (`doc/02-architecture.md` §5 : cette couche
 * n'importe que `schemas/` et `content/`).
 */

import {
  booleen, chaine, cle as lireCle, conclure, Contexte, couleur, entier, enumeration,
  nombre, objet, requis, sansDoublon, sous, type Resultat,
} from '../schemas/noyau';
import {
  BIOMES, REGEX_CLE, REGEX_CODE_PAYS, SAISONS,
  type Biome, type Cle, type CodePays, type Couleur, type Saison,
} from '../schemas/types';
import {
  CANAUX_TEXTURE, CLIPS_ANIMATION, CONTROLES, ELEMENTS_DECOR_REGION, FINITIONS_STYLE,
  FORMATS_TEXTURE, FORMES_TOIT, GABARITS, INTERDITS, INTERDITS_OBLIGATOIRES,
  MATIERES_STYLE, MOTIFS_DALTONIENS, NIVEAUX_LOD, ORNEMENTS_STYLE,
  PLACEMENTS_DECALCOMANIE, PRIORITES, RESOLUTIONS_TEXTURE, TYPES_ASSET,
  type AnimationSpec, type AssetSpec, type Bilingue, type Budget,
  type Controle, type Decalcomanie, type Dimension, type Echelle, type ElementDecorRegion,
  type FinitionStyle, type FormatAsset, type Gabarit, type Interdit, type MatiereStyle,
  type NiveauLod, type Nommage, type OrnementStyle, type PaletteStyle, type Pivot,
  type Priorite, type StyleAsset, type StyleNation, type StyleRegion, type TextureSpec,
  type TypeAsset, type Variantes, type Verification,
} from './spec';

/** Clés admises à la racine d'un `AssetSpec`, dans l'ordre du type. */
const CLES_SPEC = [
  'id', 'type', 'cle', 'priorite', 'description', 'style', 'echelle', 'pivot', 'budget',
  'textures', 'variantes', 'animations', 'format', 'nommage', 'interdits', 'verification',
] as const;

/** Longueur minimale d'une description : en dessous, le générateur invente. */
const DESCRIPTION_MIN = 160;
/** Longueur maximale : au-delà, le générateur se perd et la relecture aussi. */
const DESCRIPTION_MAX = 2400;

/** Lit une description bilingue et refuse deux textes identiques. */
function bilingue(ctx: Contexte, v: unknown, chemin: string): Bilingue | undefined {
  const o = objet(ctx, v, chemin, ['en', 'fr']);
  if (!o || !requis(ctx, o, chemin, ['en', 'fr'])) return undefined;
  const opts = { min: DESCRIPTION_MIN, max: DESCRIPTION_MAX };
  const en = chaine(ctx, o['en'], sous(chemin, 'en'), opts);
  const fr = chaine(ctx, o['fr'], sous(chemin, 'fr'), opts);
  if (en === undefined || fr === undefined) return undefined;
  if (en === fr) {
    ctx.faute(chemin, 'les deux langues ne peuvent pas porter le même texte');
    return undefined;
  }
  return { en, fr };
}

/** Lit une priorité de production : 1, 2 ou 3, et rien d'autre. */
function priorite(ctx: Contexte, v: unknown, chemin: string): Priorite | undefined {
  const n = entier(ctx, v, chemin, { min: 1, max: 3 });
  if (n === undefined) return undefined;
  if (!(PRIORITES as readonly number[]).includes(n)) {
    ctx.faute(chemin, `priorité hors liste : ${PRIORITES.join(', ')}`);
    return undefined;
  }
  return n as Priorite;
}

/** Lit un tableau de chaînes courtes, borné et sans doublon. */
function chaines(
  ctx: Contexte, v: unknown, chemin: string, options: { min: number; max: number; long?: number },
): string[] | undefined {
  if (!Array.isArray(v)) {
    ctx.faute(chemin, 'un tableau de chaînes est attendu');
    return undefined;
  }
  if (v.length < options.min) ctx.faute(chemin, `tableau trop court : ${options.min} entrée(s) au moins`);
  if (v.length > options.max) ctx.faute(chemin, `tableau trop long : ${options.max} entrée(s) au plus`);
  const lues: string[] = [];
  for (let i = 0; i < v.length; i += 1) {
    const s = chaine(ctx, v[i], sous(chemin, i), { max: options.long ?? 120 });
    if (s !== undefined) lues.push(s);
  }
  sansDoublon(ctx, lues, chemin);
  return lues;
}

/** Lit le bloc `style`. */
function style(ctx: Contexte, v: unknown, chemin: string): StyleAsset | undefined {
  const cles = ['reference', 'devise', 'matieres', 'motsCles', 'aEviter'];
  const o = objet(ctx, v, chemin, cles);
  if (!o || !requis(ctx, o, chemin, cles)) return undefined;
  const reference = chaine(ctx, o['reference'], sous(chemin, 'reference'), { max: 120 });
  const devise = chaine(ctx, o['devise'], sous(chemin, 'devise'), { min: 12, max: 160 });
  const matieres = chaine(ctx, o['matieres'], sous(chemin, 'matieres'), { min: 20, max: 400 });
  const motsCles = chaines(ctx, o['motsCles'], sous(chemin, 'motsCles'), { min: 3, max: 14 });
  const aEviter = chaines(ctx, o['aEviter'], sous(chemin, 'aEviter'), { min: 1, max: 14 });
  if (reference === undefined || devise === undefined || matieres === undefined
    || motsCles === undefined || aEviter === undefined) return undefined;
  return { reference, devise, matieres, motsCles, aEviter };
}

/** Lit une dimension et vérifie que la tolérance reste utile. */
function dimension(ctx: Contexte, v: unknown, chemin: string): Dimension | undefined {
  const o = objet(ctx, v, chemin, ['cible', 'tolerance']);
  if (!o || !requis(ctx, o, chemin, ['cible', 'tolerance'])) return undefined;
  const cible = nombre(ctx, o['cible'], sous(chemin, 'cible'), { min: 0.02, max: 4 });
  const tolerance = nombre(ctx, o['tolerance'], sous(chemin, 'tolerance'), { min: 0, max: 0.5 });
  if (cible === undefined || tolerance === undefined) return undefined;
  if (tolerance > cible) {
    ctx.faute(chemin, 'une tolérance plus grande que la cible ne contrôle plus rien');
    return undefined;
  }
  return { cible, tolerance };
}

/** Lit le bloc `echelle` : une case vaut un mètre, toujours. */
function echelle(ctx: Contexte, v: unknown, chemin: string): Echelle | undefined {
  const cles = ['caseEnMetres', 'x', 'y', 'z'];
  const o = objet(ctx, v, chemin, cles);
  if (!o || !requis(ctx, o, chemin, cles)) return undefined;
  const caseEnMetres = nombre(ctx, o['caseEnMetres'], sous(chemin, 'caseEnMetres'), { min: 1, max: 1 });
  const x = dimension(ctx, o['x'], sous(chemin, 'x'));
  const y = dimension(ctx, o['y'], sous(chemin, 'y'));
  const z = dimension(ctx, o['z'], sous(chemin, 'z'));
  if (caseEnMetres === undefined || x === undefined || y === undefined || z === undefined) return undefined;
  return { caseEnMetres, x, y, z };
}

/** Lit le bloc `pivot` : centre au sol, avant vers +Z, haut vers +Y. */
function pivot(ctx: Contexte, v: unknown, chemin: string): Pivot | undefined {
  const cles = ['origine', 'avant', 'haut', 'poseAuSol'];
  const o = objet(ctx, v, chemin, cles);
  if (!o || !requis(ctx, o, chemin, cles)) return undefined;
  const origine = enumeration(ctx, o['origine'], sous(chemin, 'origine'), ['centre_au_sol'] as const);
  const avant = enumeration(ctx, o['avant'], sous(chemin, 'avant'), ['+z'] as const);
  const haut = enumeration(ctx, o['haut'], sous(chemin, 'haut'), ['+y'] as const);
  const poseAuSol = booleen(ctx, o['poseAuSol'], sous(chemin, 'poseAuSol'));
  if (origine === undefined || avant === undefined || haut === undefined || poseAuSol === undefined) {
    return undefined;
  }
  return { origine, avant, haut, poseAuSol };
}

/** Lit le bloc `budget` : trois paliers strictement décroissants. */
function budget(ctx: Contexte, v: unknown, chemin: string): Budget | undefined {
  const cles = ['lod0', 'lod1', 'lod2', 'materiauxMax'];
  const o = objet(ctx, v, chemin, cles);
  if (!o || !requis(ctx, o, chemin, cles)) return undefined;
  const lod0 = entier(ctx, o['lod0'], sous(chemin, 'lod0'), { min: 32, max: 60000 });
  const lod1 = entier(ctx, o['lod1'], sous(chemin, 'lod1'), { min: 16, max: 60000 });
  const lod2 = entier(ctx, o['lod2'], sous(chemin, 'lod2'), { min: 8, max: 60000 });
  const materiauxMax = entier(ctx, o['materiauxMax'], sous(chemin, 'materiauxMax'), { min: 1, max: 4 });
  if (lod0 === undefined || lod1 === undefined || lod2 === undefined || materiauxMax === undefined) {
    return undefined;
  }
  if (!(lod0 > lod1 && lod1 > lod2)) {
    ctx.faute(chemin, 'les budgets doivent décroître strictement de lod0 à lod2');
    return undefined;
  }
  return { lod0, lod1, lod2, materiauxMax };
}

/** Lit une carte de texture. */
function texture(ctx: Contexte, v: unknown, chemin: string): TextureSpec | undefined {
  const cles = ['canal', 'resolution', 'format', 'obligatoire', 'note'];
  const o = objet(ctx, v, chemin, cles);
  if (!o || !requis(ctx, o, chemin, cles)) return undefined;
  const canal = enumeration(ctx, o['canal'], sous(chemin, 'canal'), CANAUX_TEXTURE);
  const resolutionBrute = entier(ctx, o['resolution'], sous(chemin, 'resolution'), { min: 256, max: 2048 });
  const format = enumeration(ctx, o['format'], sous(chemin, 'format'), FORMATS_TEXTURE);
  const obligatoire = booleen(ctx, o['obligatoire'], sous(chemin, 'obligatoire'));
  const note = chaine(ctx, o['note'], sous(chemin, 'note'), { min: 8, max: 240 });
  if (canal === undefined || resolutionBrute === undefined || format === undefined
    || obligatoire === undefined || note === undefined) return undefined;
  if (!(RESOLUTIONS_TEXTURE as readonly number[]).includes(resolutionBrute)) {
    ctx.faute(sous(chemin, 'resolution'), `résolution hors liste : ${RESOLUTIONS_TEXTURE.join(', ')}`);
    return undefined;
  }
  const resolution = resolutionBrute as TextureSpec['resolution'];
  return { canal, resolution, format, obligatoire, note };
}

/** Lit le bloc `variantes`. */
function variantes(ctx: Contexte, v: unknown, chemin: string): Variantes | undefined {
  const cles = ['saisons', 'biomes', 'nations'];
  const o = objet(ctx, v, chemin, cles);
  if (!o || !requis(ctx, o, chemin, cles)) return undefined;
  const lire = <T extends string>(brut: unknown, nom: string, valeurs: readonly T[]): T[] | undefined => {
    const c = sous(chemin, nom);
    if (!Array.isArray(brut)) {
      ctx.faute(c, 'un tableau est attendu');
      return undefined;
    }
    const lues: T[] = [];
    for (let i = 0; i < brut.length; i += 1) {
      const e = enumeration(ctx, brut[i], sous(c, i), valeurs);
      if (e !== undefined) lues.push(e);
    }
    sansDoublon(ctx, lues, c);
    return lues;
  };
  const saisons = lire<Saison>(o['saisons'], 'saisons', SAISONS);
  const biomes = lire<Biome>(o['biomes'], 'biomes', BIOMES);
  const cNations = sous(chemin, 'nations');
  const nations: CodePays[] = [];
  const brutNations: unknown = o['nations'];
  if (!Array.isArray(brutNations)) ctx.faute(cNations, 'un tableau est attendu');
  else {
    for (let i = 0; i < brutNations.length; i += 1) {
      const n = chaine(ctx, brutNations[i], sous(cNations, i), {
        regex: REGEX_CODE_PAYS, forme: 'code de camp en minuscules (ISO 3166-1 alpha-2, ou trois lettres pour une équipe sans drapeau)',
      });
      if (n !== undefined) nations.push(n);
    }
    sansDoublon(ctx, nations, cNations);
  }
  if (saisons === undefined || biomes === undefined) return undefined;
  return { saisons, biomes, nations };
}

/** Lit un clip d'animation. */
function animation(ctx: Contexte, v: unknown, chemin: string): AnimationSpec | undefined {
  const cles = ['nom', 'dureeMs', 'boucle', 'obligatoire'];
  const o = objet(ctx, v, chemin, cles);
  if (!o || !requis(ctx, o, chemin, cles)) return undefined;
  const nom = enumeration(ctx, o['nom'], sous(chemin, 'nom'), CLIPS_ANIMATION);
  const dureeMs = entier(ctx, o['dureeMs'], sous(chemin, 'dureeMs'), { min: 120, max: 8000 });
  const boucle = booleen(ctx, o['boucle'], sous(chemin, 'boucle'));
  const obligatoire = booleen(ctx, o['obligatoire'], sous(chemin, 'obligatoire'));
  if (nom === undefined || dureeMs === undefined || boucle === undefined || obligatoire === undefined) {
    return undefined;
  }
  if (nom === 'hors_jeu' && boucle) {
    ctx.faute(sous(chemin, 'boucle'), 'la sortie de terrain ne boucle pas');
    return undefined;
  }
  return { nom, dureeMs, boucle, obligatoire };
}

/** Lit le bloc `format` : tout y est imposé sauf les noms. */
function format(ctx: Contexte, v: unknown, chemin: string): FormatAsset | undefined {
  const cles = [
    'conteneur', 'versionGltf', 'axeHaut', 'unite', 'materiaux', 'noeudRacine',
    'noeuds', 'materiauxAttendus',
  ];
  const o = objet(ctx, v, chemin, cles);
  if (!o || !requis(ctx, o, chemin, cles)) return undefined;
  const conteneur = enumeration(ctx, o['conteneur'], sous(chemin, 'conteneur'), ['glb'] as const);
  const versionGltf = enumeration(ctx, o['versionGltf'], sous(chemin, 'versionGltf'), ['2.0'] as const);
  const axeHaut = enumeration(ctx, o['axeHaut'], sous(chemin, 'axeHaut'), ['y'] as const);
  const unite = enumeration(ctx, o['unite'], sous(chemin, 'unite'), ['metre'] as const);
  const materiaux = enumeration(ctx, o['materiaux'], sous(chemin, 'materiaux'), ['pbr_metallic_roughness'] as const);
  const noeudRacine = lireCle(ctx, o['noeudRacine'], sous(chemin, 'noeudRacine'));
  const noeuds = chaines(ctx, o['noeuds'], sous(chemin, 'noeuds'), { min: 2, max: 16, long: 48 });
  const materiauxAttendus = chaines(ctx, o['materiauxAttendus'], sous(chemin, 'materiauxAttendus'), {
    min: 1, max: 4, long: 48,
  });
  if (conteneur === undefined || versionGltf === undefined || axeHaut === undefined
    || unite === undefined || materiaux === undefined || noeudRacine === undefined
    || noeuds === undefined || materiauxAttendus === undefined) return undefined;
  if (!noeuds.includes(noeudRacine)) {
    ctx.faute(sous(chemin, 'noeuds'), `le nœud racine ${noeudRacine} doit figurer dans la liste`);
    return undefined;
  }
  return {
    conteneur, versionGltf, axeHaut, unite, materiaux, noeudRacine, noeuds, materiauxAttendus,
  };
}

/** Lit le bloc `nommage` et vérifie que les gabarits portent leurs marqueurs. */
function nommage(ctx: Contexte, v: unknown, chemin: string): Nommage | undefined {
  const cles = ['modele', 'texture', 'exemples'];
  const o = objet(ctx, v, chemin, cles);
  if (!o || !requis(ctx, o, chemin, cles)) return undefined;
  const modele = chaine(ctx, o['modele'], sous(chemin, 'modele'), { max: 120 });
  const texture_ = chaine(ctx, o['texture'], sous(chemin, 'texture'), { max: 120 });
  const exemples = chaines(ctx, o['exemples'], sous(chemin, 'exemples'), { min: 2, max: 8 });
  if (modele === undefined || texture_ === undefined || exemples === undefined) return undefined;
  for (const marqueur of ['{id}', '{lod}']) {
    if (!modele.includes(marqueur)) ctx.faute(sous(chemin, 'modele'), `gabarit sans ${marqueur}`);
  }
  for (const marqueur of ['{id}', '{canal}', '{ext}']) {
    if (!texture_.includes(marqueur)) ctx.faute(sous(chemin, 'texture'), `gabarit sans ${marqueur}`);
  }
  if (!modele.endsWith('.glb')) ctx.faute(sous(chemin, 'modele'), 'un modèle se livre en .glb');
  return { modele, texture: texture_, exemples };
}

/** Lit le bloc `verification`. */
function verification(ctx: Contexte, v: unknown, chemin: string): Verification | undefined {
  const cles = ['controles', 'toleranceAabb', 'lodRequis'];
  const o = objet(ctx, v, chemin, cles);
  if (!o || !requis(ctx, o, chemin, cles)) return undefined;
  const cControles = sous(chemin, 'controles');
  const controles: Controle[] = [];
  const brutControles: unknown = o['controles'];
  if (!Array.isArray(brutControles)) ctx.faute(cControles, 'un tableau est attendu');
  else {
    for (let i = 0; i < brutControles.length; i += 1) {
      const c = enumeration(ctx, brutControles[i], sous(cControles, i), CONTROLES);
      if (c !== undefined) controles.push(c);
    }
    sansDoublon(ctx, controles, cControles);
  }
  if (!controles.includes('format')) ctx.faute(cControles, 'le contrôle de format est toujours exigé');
  const toleranceAabb = nombre(ctx, o['toleranceAabb'], sous(chemin, 'toleranceAabb'), { min: 0, max: 0.35 });
  const cLod = sous(chemin, 'lodRequis');
  const lodRequis: NiveauLod[] = [];
  const brutLod: unknown = o['lodRequis'];
  if (!Array.isArray(brutLod)) ctx.faute(cLod, 'un tableau est attendu');
  else {
    for (let i = 0; i < brutLod.length; i += 1) {
      const n = entier(ctx, brutLod[i], sous(cLod, i), { min: 0, max: 2 });
      if (n !== undefined && (NIVEAUX_LOD as readonly number[]).includes(n)) lodRequis.push(n as NiveauLod);
    }
    sansDoublon(ctx, lodRequis, cLod);
  }
  if (!lodRequis.includes(0)) ctx.faute(cLod, 'le niveau de détail 0 est toujours exigé');
  if (toleranceAabb === undefined) return undefined;
  return { controles, toleranceAabb, lodRequis };
}

/** Vérifie les règles qui lient deux blocs entre eux. */
function coherence(
  ctx: Contexte, type: TypeAsset, textures: TextureSpec[], animations: AnimationSpec[],
  budgetLu: Budget, formatLu: FormatAsset, verif: Verification,
): void {
  const canaux = textures.map((t) => t.canal);
  sansDoublon(ctx, canaux, 'textures');
  if (!canaux.includes('albedo')) ctx.faute('textures', 'la carte d’albédo est obligatoire partout');

  const aMasque = textures.some((t) => t.canal === 'masque_equipe' && t.obligatoire);
  const veutMasque = verif.controles.includes('masque_equipe');
  if (veutMasque && !aMasque) {
    ctx.faute('textures', 'le contrôle du masque d’équipe exige une carte masque_equipe obligatoire');
  }
  if ((type === 'unite' || type === 'batiment') && !aMasque) {
    ctx.faute('textures', 'une unité et un bâtiment portent la couleur de leur nation : masque_equipe obligatoire');
  }

  const noms = animations.map((a) => a.nom);
  sansDoublon(ctx, noms, 'animations');
  if (verif.controles.includes('animations') && animations.length === 0) {
    ctx.faute('animations', 'le contrôle des animations exige au moins un clip');
  }
  if (type === 'unite') {
    for (const attendu of ['repos', 'deplacement', 'hors_jeu'] as const) {
      if (!noms.includes(attendu)) ctx.faute('animations', `clip obligatoire absent pour une unité : ${attendu}`);
    }
  }
  const repos = animations.find((a) => a.nom === 'repos');
  if (repos && !repos.boucle) ctx.faute('animations', 'le clip de repos boucle');

  if (formatLu.materiauxAttendus.length > budgetLu.materiauxMax) {
    ctx.faute('format.materiauxAttendus', `plus de matériaux attendus que le budget n’en admet (${budgetLu.materiauxMax})`);
  }
  if (verif.controles.includes('noeuds') && formatLu.noeuds.length < 2) {
    ctx.faute('format.noeuds', 'le contrôle des nœuds exige au moins la racine et une pièce');
  }
}

/**
 * Valide une spécification d'asset. Le contrat est le même que celui de tous les
 * validateurs du projet : la valeur typée, ou la liste complète des erreurs.
 */
export function validerAssetSpec(valeur: unknown): Resultat<AssetSpec> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', CLES_SPEC);
  if (!o) return conclure(ctx, valeur as AssetSpec);
  requis(ctx, o, '', CLES_SPEC);

  const id = lireCle(ctx, o['id'], 'id');
  const type = enumeration(ctx, o['type'], 'type', TYPES_ASSET);
  const cle = lireCle(ctx, o['cle'], 'cle');
  if (id !== undefined && type !== undefined && cle !== undefined && id !== `${type}_${cle}`) {
    ctx.faute('id', `l’identifiant doit être <type>_<cle>, soit ${type}_${cle}`);
  }
  priorite(ctx, o['priorite'], 'priorite');

  bilingue(ctx, o['description'], 'description');
  style(ctx, o['style'], 'style');
  echelle(ctx, o['echelle'], 'echelle');
  pivot(ctx, o['pivot'], 'pivot');
  const budgetLu = budget(ctx, o['budget'], 'budget');

  const textures: TextureSpec[] = [];
  const brutTextures: unknown = o['textures'];
  if (!Array.isArray(brutTextures)) ctx.faute('textures', 'un tableau est attendu');
  else {
    if (brutTextures.length === 0) ctx.faute('textures', 'au moins la carte d’albédo est attendue');
    if (brutTextures.length > CANAUX_TEXTURE.length) ctx.faute('textures', 'plus de cartes que de canaux connus');
    for (let i = 0; i < brutTextures.length; i += 1) {
      const t = texture(ctx, brutTextures[i], sous('textures', i));
      if (t !== undefined) textures.push(t);
    }
  }

  variantes(ctx, o['variantes'], 'variantes');

  const animations: AnimationSpec[] = [];
  const brutAnimations: unknown = o['animations'];
  if (!Array.isArray(brutAnimations)) ctx.faute('animations', 'un tableau est attendu');
  else {
    if (brutAnimations.length > CLIPS_ANIMATION.length) ctx.faute('animations', 'plus de clips que de noms connus');
    for (let i = 0; i < brutAnimations.length; i += 1) {
      const a = animation(ctx, brutAnimations[i], sous('animations', i));
      if (a !== undefined) animations.push(a);
    }
  }

  const formatLu = format(ctx, o['format'], 'format');
  nommage(ctx, o['nommage'], 'nommage');

  const interdits: Interdit[] = [];
  const brutInterdits: unknown = o['interdits'];
  if (!Array.isArray(brutInterdits)) ctx.faute('interdits', 'un tableau est attendu');
  else {
    for (let i = 0; i < brutInterdits.length; i += 1) {
      const it = enumeration(ctx, brutInterdits[i], sous('interdits', i), INTERDITS);
      if (it !== undefined) interdits.push(it);
    }
    sansDoublon(ctx, interdits, 'interdits');
    for (const attendu of INTERDITS_OBLIGATOIRES) {
      if (!interdits.includes(attendu)) ctx.faute('interdits', `interdit obligatoire absent : ${attendu}`);
    }
  }

  const verif = verification(ctx, o['verification'], 'verification');

  if (type !== undefined && budgetLu !== undefined && formatLu !== undefined && verif !== undefined) {
    coherence(ctx, type, textures, animations, budgetLu, formatLu, verif);
  }

  return conclure(ctx, o as unknown as AssetSpec);
}

// ---------------------------------------------------------------------------
// Le style d'une nation et le style d'une région
// ---------------------------------------------------------------------------

/** Clés admises à la racine d'un `StyleNation`. */
const CLES_STYLE_NATION = [
  'code', 'nom', 'ligneDirectrice', 'palette', 'matieres', 'finitions', 'ornements',
  'gabarits', 'decalcomanies', 'motifDaltonien', 'priorite', 'justification',
] as const;

/** Clés admises à la racine d'un `StyleRegion`. */
const CLES_STYLE_REGION = [
  'code', 'paysCode', 'nom', 'ligneDirectrice', 'toits', 'murs', 'vegetation',
  'elementsDecor', 'priorite', 'justification',
] as const;

/** Lit une ligne directrice bilingue : courte, mais jamais la même dans les deux langues. */
function ligneDirectrice(ctx: Contexte, v: unknown, chemin: string): Bilingue | undefined {
  const o = objet(ctx, v, chemin, ['en', 'fr']);
  if (!o || !requis(ctx, o, chemin, ['en', 'fr'])) return undefined;
  const opts = { min: 24, max: 240 };
  const en = chaine(ctx, o['en'], sous(chemin, 'en'), opts);
  const fr = chaine(ctx, o['fr'], sous(chemin, 'fr'), opts);
  if (en === undefined || fr === undefined) return undefined;
  if (en === fr) {
    ctx.faute(chemin, 'les deux langues ne peuvent pas porter le même texte');
    return undefined;
  }
  return { en, fr };
}

/** Lit une liste fermée bornée, sans doublon. */
function liste<T extends string>(
  ctx: Contexte, v: unknown, chemin: string, valeurs: readonly T[], min: number, max: number,
): T[] | undefined {
  if (!Array.isArray(v)) {
    ctx.faute(chemin, 'un tableau est attendu');
    return undefined;
  }
  if (v.length < min) ctx.faute(chemin, `tableau trop court : ${min} entrée(s) au moins`);
  if (v.length > max) ctx.faute(chemin, `tableau trop long : ${max} entrée(s) au plus`);
  const lues: T[] = [];
  for (let i = 0; i < v.length; i += 1) {
    const e = enumeration(ctx, v[i], sous(chemin, i), valeurs);
    if (e !== undefined) lues.push(e);
  }
  sansDoublon(ctx, lues, chemin);
  return lues;
}

/** Lit la palette d'un style : les trois couleurs de la nation, plus ses accents. */
function paletteStyle(ctx: Contexte, v: unknown, chemin: string): PaletteStyle | undefined {
  const cles = ['main', 'dark', 'light', 'accents'];
  const o = objet(ctx, v, chemin, cles);
  if (!o || !requis(ctx, o, chemin, cles)) return undefined;
  const main = couleur(ctx, o['main'], sous(chemin, 'main'));
  const dark = couleur(ctx, o['dark'], sous(chemin, 'dark'));
  const light = couleur(ctx, o['light'], sous(chemin, 'light'));
  const cAccents = sous(chemin, 'accents');
  const accents: Couleur[] = [];
  if (!Array.isArray(o['accents'])) ctx.faute(cAccents, 'un tableau est attendu');
  else {
    const brut = o['accents'];
    if (brut.length < 1) ctx.faute(cAccents, 'un accent au moins : c’est ce qui distingue deux nations de même teinte');
    if (brut.length > 3) ctx.faute(cAccents, 'trois accents au plus');
    for (let i = 0; i < brut.length; i += 1) {
      const c = couleur(ctx, brut[i], sous(cAccents, i));
      if (c !== undefined) accents.push(c);
    }
    sansDoublon(ctx, accents, cAccents);
  }
  if (main === undefined || dark === undefined || light === undefined) return undefined;
  if (new Set([main, dark, light]).size !== 3) {
    ctx.faute(chemin, 'les trois couleurs de la palette doivent être distinctes');
    return undefined;
  }
  return { main, dark, light, accents };
}

/** Lit une décalcomanie : un motif abstrait, jamais un symbole réel. */
function decalcomanie(ctx: Contexte, v: unknown, chemin: string): Decalcomanie | undefined {
  const cles = ['motif', 'placement', 'couleur', 'note'];
  const o = objet(ctx, v, chemin, cles);
  if (!o || !requis(ctx, o, chemin, cles)) return undefined;
  const motif = enumeration(ctx, o['motif'], sous(chemin, 'motif'), MOTIFS_DALTONIENS);
  const placement = enumeration(ctx, o['placement'], sous(chemin, 'placement'), PLACEMENTS_DECALCOMANIE);
  const c = couleur(ctx, o['couleur'], sous(chemin, 'couleur'));
  const note = chaine(ctx, o['note'], sous(chemin, 'note'), { min: 8, max: 200 });
  if (motif === undefined || placement === undefined || c === undefined || note === undefined) {
    return undefined;
  }
  return { motif, placement, couleur: c, note };
}

/** Lit la table des gabarits : une clé d'unité, une variante de forme. */
function gabarits(ctx: Contexte, v: unknown, chemin: string): Record<Cle, Gabarit> | undefined {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    ctx.faute(chemin, 'un objet « clé d’unité → gabarit » est attendu');
    return undefined;
  }
  const entrees = Object.entries(v as Record<string, unknown>);
  if (entrees.length < 1) ctx.faute(chemin, 'une nation retient au moins un gabarit');
  if (entrees.length > 32) ctx.faute(chemin, 'plus de gabarits que le catalogue n’admet d’unités');
  const table: Record<Cle, Gabarit> = {};
  for (const [k, brut] of entrees) {
    if (!REGEX_CLE.test(k)) {
      ctx.faute(sous(chemin, k), 'la clé doit être une clé d’unité du catalogue');
      continue;
    }
    const g = enumeration(ctx, brut, sous(chemin, k), GABARITS);
    if (g !== undefined) table[k] = g;
  }
  return table;
}

/**
 * Valide un style national. Le style ne touche à aucune règle : il n'y a donc
 * rien à borner ici qu'un vocabulaire fermé et des comptes.
 */
export function validerStyleNation(valeur: unknown): Resultat<StyleNation> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', CLES_STYLE_NATION);
  if (!o) return conclure(ctx, valeur as StyleNation);
  requis(ctx, o, '', CLES_STYLE_NATION);

  chaine(ctx, o['code'], 'code', { regex: REGEX_CODE_PAYS, forme: 'code de camp en minuscules (ISO 3166-1 alpha-2, ou trois lettres pour une équipe sans drapeau)' });
  chaine(ctx, o['nom'], 'nom', { max: 64 });
  ligneDirectrice(ctx, o['ligneDirectrice'], 'ligneDirectrice');
  paletteStyle(ctx, o['palette'], 'palette');
  liste<MatiereStyle>(ctx, o['matieres'], 'matieres', MATIERES_STYLE, 3, 6);
  liste<FinitionStyle>(ctx, o['finitions'], 'finitions', FINITIONS_STYLE, 1, 3);
  liste<OrnementStyle>(ctx, o['ornements'], 'ornements', ORNEMENTS_STYLE, 2, 4);
  gabarits(ctx, o['gabarits'], 'gabarits');

  const cDecals = 'decalcomanies';
  if (!Array.isArray(o['decalcomanies'])) ctx.faute(cDecals, 'un tableau est attendu');
  else {
    const brut = o['decalcomanies'];
    if (brut.length < 1) ctx.faute(cDecals, 'un motif au moins : c’est ce qui remplace le drapeau');
    if (brut.length > 3) ctx.faute(cDecals, 'trois motifs au plus');
    for (let i = 0; i < brut.length; i += 1) decalcomanie(ctx, brut[i], sous(cDecals, i));
  }

  enumeration(ctx, o['motifDaltonien'], 'motifDaltonien', MOTIFS_DALTONIENS);
  priorite(ctx, o['priorite'], 'priorite');
  chaine(ctx, o['justification'], 'justification', { min: 40, max: 400 });
  return conclure(ctx, o as unknown as StyleNation);
}

/** Valide un style régional : toits, murs, végétation, éléments de décor. */
export function validerStyleRegion(valeur: unknown): Resultat<StyleRegion> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', CLES_STYLE_REGION);
  if (!o) return conclure(ctx, valeur as StyleRegion);
  requis(ctx, o, '', CLES_STYLE_REGION);

  lireCle(ctx, o['code'], 'code');
  chaine(ctx, o['paysCode'], 'paysCode', { regex: REGEX_CODE_PAYS, forme: 'code de camp en minuscules (ISO 3166-1 alpha-2, ou trois lettres pour une équipe sans drapeau)' });
  chaine(ctx, o['nom'], 'nom', { max: 48 });
  ligneDirectrice(ctx, o['ligneDirectrice'], 'ligneDirectrice');

  const cToits = 'toits';
  const t = objet(ctx, o['toits'], cToits, ['forme', 'matiere', 'couleur']);
  if (t && requis(ctx, t, cToits, ['forme', 'matiere', 'couleur'])) {
    enumeration(ctx, t['forme'], sous(cToits, 'forme'), FORMES_TOIT);
    enumeration(ctx, t['matiere'], sous(cToits, 'matiere'), MATIERES_STYLE);
    couleur(ctx, t['couleur'], sous(cToits, 'couleur'));
  }

  const cMurs = 'murs';
  const m = objet(ctx, o['murs'], cMurs, ['matiere', 'couleur', 'finition']);
  if (m && requis(ctx, m, cMurs, ['matiere', 'couleur', 'finition'])) {
    enumeration(ctx, m['matiere'], sous(cMurs, 'matiere'), MATIERES_STYLE);
    couleur(ctx, m['couleur'], sous(cMurs, 'couleur'));
    enumeration(ctx, m['finition'], sous(cMurs, 'finition'), FINITIONS_STYLE);
  }

  const cVeg = 'vegetation';
  const veg = objet(ctx, o['vegetation'], cVeg, ['dominante', 'secondaire', 'couleur']);
  if (veg && requis(ctx, veg, cVeg, ['dominante', 'secondaire', 'couleur'])) {
    chaine(ctx, veg['dominante'], sous(cVeg, 'dominante'), { min: 3, max: 64 });
    chaine(ctx, veg['secondaire'], sous(cVeg, 'secondaire'), { min: 3, max: 64 });
    couleur(ctx, veg['couleur'], sous(cVeg, 'couleur'));
  }

  liste<ElementDecorRegion>(ctx, o['elementsDecor'], 'elementsDecor', ELEMENTS_DECOR_REGION, 2, 4);
  priorite(ctx, o['priorite'], 'priorite');
  chaine(ctx, o['justification'], 'justification', { min: 40, max: 400 });
  return conclure(ctx, o as unknown as StyleRegion);
}

/** Valide un lot de spécifications et refuse deux identifiants identiques. */
export function validerLotAssetSpec(valeur: unknown): Resultat<AssetSpec[]> {
  const ctx = new Contexte();
  if (!Array.isArray(valeur)) {
    ctx.faute('', 'un tableau de spécifications est attendu');
    return conclure(ctx, [] as AssetSpec[]);
  }
  const ids: string[] = [];
  const lues: AssetSpec[] = [];
  for (let i = 0; i < valeur.length; i += 1) {
    const chemin = `[${i}]`;
    const r = validerAssetSpec(valeur[i]);
    if (!r.ok) {
      for (const e of r.erreurs) ctx.faute(e.chemin === '' ? chemin : `${chemin}.${e.chemin}`, e.message);
      continue;
    }
    ids.push(r.valeur.id);
    lues.push(r.valeur);
  }
  sansDoublon(ctx, ids, '');
  return conclure(ctx, lues);
}
