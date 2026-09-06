/**
 * L'infanterie de base en GLB — le premier vrai fichier de modèle du projet —,
 * **générée par un script déterministe** : une escouade de trois figurines
 * riggées, six clips, trois niveaux de détail, quatre cartes, conformes à
 * `assets/specs/unite_infanterie_base.json` et déposées dans
 * `public/assets/modeles/`, d'où l'inventaire (`/api/modeles`) les sert sans
 * qu'une ligne du rendu change.
 *
 * ```
 * npm run generer:infanterie              # produit, contrôle, dépose
 * npm run generer:infanterie -- --sec     # produit et contrôle, ne dépose rien
 * npm run generer:infanterie -- --sortie /tmp/livraison
 * ```
 *
 * La règle du dépôt tient ici comme pour un générateur externe : **un fichier
 * refusé par le contrôle n'est pas déposé**. Le verdict imprimé est celui de
 * `validerGlb`, le même que `controler-asset.ts` et que la routine contrôle.
 *
 * Déterministe : deux exécutions donnent les mêmes octets, ce qu'un test
 * vérifie, avec l'identité entre le dépôt et la production du script — un
 * fichier déposé puis retouché à la main serait un mensonge.
 *
 * Ce script sait qu'il fabrique l'infanterie ; le rendu, lui, ne connaît que
 * l'inventaire et les noms de nœuds de la spécification.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';

import {
  nomModele, nomTexture, validerGlb,
  type AssetSpec, type NiveauLod, type VerdictAsset,
} from '../src/assets/index';
import { lireSpec } from './controler-asset';
import { construireClips, type Durees, type FigurineAnimee } from './infanterie/clips';
import {
  ALLURES, construireFigurine, construireSocle, FINESSES, NOMS_OS, PARENT_OS, SOCLE, type NomOs,
} from './infanterie/figurine';
import {
  alleger, assemblerGlb, decouperGlb, dedoublonner, exporterGlb, injecterCartes, type CartesVoisines,
} from './infanterie/gltf';
import { assembler, rigide, Tampon } from './infanterie/maillage';
import { peindreTextures } from './infanterie/textures';

/** L'identifiant de la spécification produite. */
export const ID_INFANTERIE = 'unite_infanterie_base';
/** La spécification, depuis la racine du dépôt. */
export const CHEMIN_SPEC = path.join('assets', 'specs', `${ID_INFANTERIE}.json`);
/** Le dossier de dépôt, depuis la racine du dépôt : celui que Next sert sous `/assets/modeles`. */
export const DOSSIER_DEPOT = path.join('public', 'assets', 'modeles');

/** La racine du dépôt. */
export function racineDepot(): string {
  return path.resolve(import.meta.dirname, '..');
}

/** La spécification de l'infanterie, lue et validée. */
export function specInfanterie(): AssetSpec {
  return lireSpec(path.join(racineDepot(), CHEMIN_SPEC));
}

/** Ce que le générateur produit, en mémoire. */
export interface Livraison {
  /** Nom de fichier → octets : trois GLB et quatre PNG. */
  fichiers: Map<string, Uint8Array>;
  /** Triangles de chaque niveau de détail, socle compris. */
  triangles: Record<NiveauLod, number>;
  spec: AssetSpec;
}

/** Os par figurine : l'ancre, puis les onze os. */
const OS_PAR_FIGURINE = 1 + NOMS_OS.length;

/** L'index de squelette d'un os : `base` est 0, chaque figurine suit avec son ancre puis ses os. */
function indexOs(figurine: number, os: NomOs): number {
  return 2 + figurine * OS_PAR_FIGURINE + NOMS_OS.indexOf(os);
}

/** Une scène prête à exporter : la racine, ce que les clips doivent savoir, le compte de triangles. */
interface SceneNiveau {
  racine: THREE.Group;
  figurines: FigurineAnimee[];
  triangles: number;
}

/**
 * Construit la scène d'un niveau de détail : `racine` → `base` (le squelette :
 * un os racine, puis par figurine une ancre et onze os), `corps` (la peau de
 * l'escouade, deux matériaux), `socle` (la plaque ovale, rigide). Les figurines
 * se tiennent **sur** le socle ; l'origine du modèle reste au centre de
 * l'emprise au sol, sous le socle.
 */
function construireScene(lod: NiveauLod, materiaux: readonly [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial]): SceneNiveau {
  const finesse = FINESSES[lod];
  const tampons = { corps: new Tampon(0), details: new Tampon(1) };
  const construites = ALLURES.map((allure, i) => {
    const repere = { origine: new THREE.Vector3(allure.ancre.x, SOCLE.hauteur, allure.ancre.z), lacet: allure.ancre.lacet };
    tampons.corps.poser(repere);
    tampons.details.poser(repere);
    return construireFigurine(allure, finesse, tampons, (os) => indexOs(i, os));
  });
  tampons.corps.poser(null);
  tampons.details.poser(null);
  const geometrie = assembler([tampons.corps, tampons.details]);

  const base = new THREE.Bone();
  base.name = 'base';
  const os: THREE.Bone[] = [base];
  ALLURES.forEach((allure, i) => {
    const ancre = new THREE.Bone();
    ancre.name = `${allure.prefixe}_ancre`;
    ancre.position.set(allure.ancre.x, SOCLE.hauteur, allure.ancre.z);
    ancre.rotation.y = allure.ancre.lacet;
    base.add(ancre);
    os.push(ancre);
    const art = construites[i]!.articulations;
    const parNom = new Map<NomOs, THREE.Bone>();
    for (const nom of NOMS_OS) {
      const b = new THREE.Bone();
      b.name = `${allure.prefixe}_${nom}`;
      const parent = PARENT_OS[nom];
      // Les os ont une rotation de liaison identité : leur repère local est
      // celui de la figurine, et les clips s'y écrivent en clair.
      b.position.copy(art[nom]);
      if (parent !== null) b.position.sub(art[parent]);
      (parent === null ? ancre : parNom.get(parent)!).add(b);
      parNom.set(nom, b);
      os.push(b);
    }
  });

  const racine = new THREE.Group();
  racine.name = 'racine';
  racine.add(base);
  const corps = new THREE.SkinnedMesh(geometrie, [...materiaux]);
  corps.name = 'corps';
  racine.add(corps);
  const tamponSocle = new Tampon(0);
  construireSocle(tamponSocle, finesse, rigide(0));
  const socle = new THREE.Mesh(assembler([tamponSocle], { peau: false }), materiaux[1]);
  socle.name = 'socle';
  racine.add(socle);
  racine.updateMatrixWorld(true);
  corps.bind(new THREE.Skeleton(os));

  const figurines: FigurineAnimee[] = ALLURES.map((allure, i) => ({
    prefixe: allure.prefixe,
    phase: allure.phase,
    delai: allure.delai,
    articulations: construites[i]!.articulations,
    mesures: construites[i]!.mesures,
    mainGaucheLibre: allure.mainGauche !== 'lanceur',
  }));
  const triangles = (tampons.corps.triangles + tampons.details.triangles + tamponSocle.triangles);
  return { racine, figurines, triangles };
}

/** Les durées des six clips, lues dans la spécification ; un clip qui y manquerait serait une erreur, pas un défaut. */
function dureesDe(spec: AssetSpec): Durees {
  const duree = (nom: string): number => {
    const clip = spec.animations.find((a) => a.nom === nom);
    if (!clip) throw new Error(`la spécification ne déclare pas le clip ${nom}`);
    return clip.dureeMs / 1000;
  };
  return {
    repos: duree('repos'), deplacement: duree('deplacement'), tir: duree('tir'),
    touche: duree('touche'), hors_jeu: duree('hors_jeu'), capture: duree('capture'),
  };
}

/** Génère l'escouade en mémoire : trois GLB, quatre PNG. */
export async function genererInfanterie(): Promise<Livraison> {
  const spec = specInfanterie();
  const textures = peindreTextures();
  const cartes: CartesVoisines = {
    albedo: nomTexture(spec, 'albedo'),
    normale: nomTexture(spec, 'normale'),
    rugosite: nomTexture(spec, 'rugosite'),
    masque_equipe: nomTexture(spec, 'masque_equipe'),
  };
  const fichiers = new Map<string, Uint8Array>();
  fichiers.set(cartes.albedo, textures.albedo);
  fichiers.set(cartes.normale, textures.normale);
  fichiers.set(cartes.rugosite, textures.rugosite);
  fichiers.set(cartes.masque_equipe, textures.masque);

  // Rugosité et métal à 1 : ce sont les cartes qui décident, le facteur ne fait que les multiplier.
  const materiaux = [
    new THREE.MeshStandardMaterial({ name: 'mat_corps', roughness: 1, metalness: 1 }),
    new THREE.MeshStandardMaterial({ name: 'mat_details', roughness: 1, metalness: 1 }),
  ] as const;
  const durees = dureesDe(spec);
  const triangles: Record<NiveauLod, number> = { 0: 0, 1: 0, 2: 0 };
  let clips: THREE.AnimationClip[] | null = null;
  for (const lod of [0, 1, 2] as const) {
    const scene = construireScene(lod, materiaux);
    // Les articulations ne dépendent pas de la finesse : les clips se
    // construisent une fois et servent aux trois niveaux, qui portent les
    // mêmes noms d'os.
    clips = clips ?? construireClips(scene.figurines, durees);
    const brut = await exporterGlb(scene.racine, clips);
    const { document, bin } = decouperGlb(brut);
    const binReduit = dedoublonner(document, bin);
    alleger(document);
    injecterCartes(document, cartes);
    const asset = (document['asset'] ?? {}) as Record<string, unknown>;
    document['asset'] = { ...asset, generator: `atlas-tournaments generer-infanterie · ${String(asset['generator'] ?? '')}` };
    fichiers.set(nomModele(spec, lod), assemblerGlb(document, binReduit));
    triangles[lod] = scene.triangles;
  }
  return { fichiers, triangles, spec };
}

/** Le verdict de chaque niveau, textures voisines comprises : exactement ce que `controler:asset` rendrait. */
export function controlerLivraison(livraison: Livraison): Record<NiveauLod, VerdictAsset> {
  const livres = [...livraison.fichiers.keys()];
  const verdict = (lod: NiveauLod): VerdictAsset => {
    const octets = livraison.fichiers.get(nomModele(livraison.spec, lod));
    if (!octets) return { ok: false, motifs: [{ code: 'asset_format', detail: `lod${lod} absent de la livraison` }] };
    return validerGlb(octets, livraison.spec, { lod, fichiersLivres: livres });
  };
  return { 0: verdict(0), 1: verdict(1), 2: verdict(2) };
}

/** Lit les options : `--sortie <dossier>`, `--sec`. */
function options(argv: string[]): { sortie: string; sec: boolean } {
  let sortie = path.join(racineDepot(), DOSSIER_DEPOT);
  let sec = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--sec') sec = true;
    else if (a === '--sortie' && argv[i + 1] !== undefined) {
      sortie = path.resolve(argv[i + 1]!);
      i += 1;
    }
  }
  return { sortie, sec };
}

/** Exécute la commande : produit, contrôle, dépose si tout est accepté. Rend le code de sortie. */
export async function executer(argv: string[]): Promise<{ code: number; texte: string }> {
  const o = options(argv);
  const livraison = await genererInfanterie();
  const verdicts = controlerLivraison(livraison);
  const lignes: string[] = [];
  lignes.push(`Asset   : ${livraison.spec.id} — ${livraison.fichiers.size} fichiers`);
  let refuse = false;
  for (const lod of [0, 1, 2] as const) {
    const nom = nomModele(livraison.spec, lod);
    const v = verdicts[lod];
    const octets = livraison.fichiers.get(nom)?.byteLength ?? 0;
    lignes.push(`  ${nom} : ${livraison.triangles[lod]} triangles (budget ${livraison.spec.budget[`lod${lod}`]}), ${octets} octets — ${v.ok ? 'ACCEPTÉ' : 'REFUSÉ'}`);
    for (const m of v.motifs) {
      const mesures = Object.entries(m.mesure ?? {}).map(([k, n]) => `${k}=${n}`).join(' ');
      lignes.push(`      · ${m.code} ${m.detail ?? ''}${mesures ? ` (${mesures})` : ''}`);
    }
    refuse = refuse || !v.ok;
  }
  for (const [nom, octets] of livraison.fichiers) {
    if (nom.endsWith('.png')) lignes.push(`  ${nom} : ${octets.byteLength} octets`);
  }
  const total = [...livraison.fichiers.values()].reduce((n, f) => n + f.byteLength, 0);
  lignes.push(`Total   : ${total} octets`);
  if (refuse) {
    lignes.push('Verdict : REFUSÉ — rien n’est déposé.');
    return { code: 1, texte: lignes.join('\n') };
  }
  if (o.sec) {
    lignes.push('Verdict : ACCEPTÉ — à sec, rien n’est déposé.');
    return { code: 0, texte: lignes.join('\n') };
  }
  mkdirSync(o.sortie, { recursive: true });
  let ecrits = 0;
  for (const [nom, octets] of livraison.fichiers) {
    const chemin = path.join(o.sortie, nom);
    if (existsSync(chemin) && Buffer.compare(readFileSync(chemin), Buffer.from(octets)) === 0) continue;
    writeFileSync(chemin, octets);
    ecrits += 1;
  }
  lignes.push(`Verdict : ACCEPTÉ — ${ecrits} fichier(s) écrit(s) dans ${o.sortie}, ${livraison.fichiers.size - ecrits} inchangé(s).`);
  return { code: 0, texte: lignes.join('\n') };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  void executer(process.argv.slice(2)).then((r) => {
    process.stdout.write(`${r.texte}\n`);
    process.exitCode = r.code;
  }, (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
    process.exitCode = 1;
  });
}
