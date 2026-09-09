/**
 * Le **dépôt d'un asset livré** : ce qu'on accepte d'écrire dans
 * `public/assets/modeles/`, et à quelles conditions.
 *
 * Deux règles tiennent ce module, et elles sont là pour la même raison — un
 * dossier servi publiquement est une porte :
 *
 * - **un nom livré n'est jamais repris tel quel.** On ne compare pas, on
 *   **reconnaît** : un fichier n'est accepté que si son nom est exactement l'un
 *   de ceux que la fiche impose (`nomModele`, `nomTexture`, variantes
 *   saisonnières comprises). Un `../../.env` ou un `final_v3.png` ne ressemble à
 *   aucun d'eux et se refuse tout seul, sans qu'on ait à filtrer des chemins ;
 * - **rien n'est écrit avant que tout soit contrôlé.** Le verdict porte sur le
 *   lot entier ; un niveau de détail refusé n'en laisse pas deux sur le disque
 *   et un troisième manquant, état qu'aucun chargeur ne sait lire.
 *
 * Le contrôle est celui du dépôt (`validerGlb`), pas un second écrit pour
 * l'occasion : c'est le même verdict que `npm run controler:asset` et que la
 * routine de contrôle rendraient.
 */

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { controlerBinaire } from '../assets/controle-binaire';
import { LIMITE_FICHIER, LIMITE_LOT } from '../assets/production';
import { empreinteGeometrie } from '../assets/geometrie-partagee';
import { baseRequise } from './chantier-assets';
import { controlerTextures } from './controle-textures';

import {
  decomposerNomModele, nomModele, nomTexture, validerGlb, lireGlb,
  type AssetSpec, type MotifAsset, type NiveauLod, type VerdictAsset,
} from '../assets/index';

/** Un fichier présenté au dépôt : son nom livré et son contenu. */
export interface FichierLivre {
  nom: string;
  octets: Uint8Array;
}

/** Ce que le dépôt répond, qu'il ait écrit ou non. */
export interface VerdictDepot {
  ok: boolean;
  motifs: MotifAsset[];
  /** Les noms retenus, dans l'ordre où ils seraient écrits. */
  acceptes: string[];
  /** Les noms refusés parce que la fiche ne les attend pas. */
  inconnus: string[];
  /** Les niveaux de détail exigés par la fiche et absents du lot. */
  lodManquants: NiveauLod[];
}

/** Tous les noms de fichiers que cette fiche attend, modèles et textures. */
export function nomsAttendus(spec: AssetSpec): string[] {
  const noms: string[] = spec.verification.lodRequis.map((lod) => nomModele(spec, lod));
  for (const t of spec.textures) {
    noms.push(nomTexture(spec, t.canal));
    for (const saison of spec.variantes.saisons) noms.push(nomTexture(spec, t.canal, saison));
  }
  return noms;
}

/**
 * Trie un lot livré : ce que la fiche attend, ce qu'elle n'attend pas, et les
 * niveaux de détail qui manquent encore. Pure — c'est elle qu'on teste.
 *
 * Le nom seul décide. Un fichier dont le nom n'est pas attendu n'est pas une
 * erreur du livreur mais un refus du dépôt : il ne sera pas écrit, et il est
 * rendu dans `inconnus` pour qu'on voie **pourquoi** rien n'est arrivé.
 */
export function classerDepot(spec: AssetSpec, noms: readonly string[]): {
  acceptes: string[]; inconnus: string[]; lodManquants: NiveauLod[];
} {
  const attendus = new Set(nomsAttendus(spec));
  const acceptes: string[] = [];
  const inconnus: string[] = [];
  for (const nom of noms) {
    // Le nom de base seul : un navigateur peut livrer « dossier/fichier.glb ».
    const base = nom.split(/[\\/]/).pop() ?? nom;
    if (attendus.has(base)) acceptes.push(base);
    else inconnus.push(nom);
  }
  const lodPresents = new Set(
    acceptes.map((n) => decomposerNomModele(n)?.lod).filter((l): l is NiveauLod => l !== undefined),
  );
  const lodManquants = spec.verification.lodRequis.filter((l) => !lodPresents.has(l));
  return { acceptes, inconnus, lodManquants };
}

/**
 * Contrôle un lot livré **sans rien écrire**, et rend le verdict d'ensemble.
 *
 * Chaque GLB est relu contre la fiche à son propre niveau de détail, en lui
 * donnant la liste des fichiers livrés à côté : c'est ainsi qu'une texture
 * fournie en PNG voisin compte autant qu'une texture embarquée dans le GLB.
 */
export function controlerDepot(spec: AssetSpec, fichiers: readonly FichierLivre[], base: readonly FichierLivre[] = []): VerdictDepot {
  const { acceptes, inconnus, lodManquants } = classerDepot(spec, fichiers.map((f) => f.nom));
  const motifs: MotifAsset[] = [];
  if (new Set(acceptes).size !== acceptes.length) motifs.push({ code: 'asset_format', detail: 'noms de fichiers dupliqués dans le lot' });
  if (inconnus.length) motifs.push({ code: 'asset_format', detail: `noms inattendus : ${inconnus.join(', ')}` });
  if (fichiers.reduce((s, f) => s + f.octets.byteLength, 0) > LIMITE_LOT || fichiers.some((f) => f.octets.byteLength > LIMITE_FICHIER))
    return { ok: false, motifs: [...motifs, { code: 'asset_budget', detail: 'limite : 24 Mio par fichier, 96 Mio par lot' }], acceptes, inconnus, lodManquants };

  for (const lod of lodManquants) {
    motifs.push({ code: 'asset_format', detail: `niveau de détail manquant : ${nomModele(spec, lod)}` });
  }

  const parNom = new Map(fichiers.map((f) => [f.nom.split(/[\\/]/).pop() ?? f.nom, f.octets]));
  let structure: string | null = null;
  for (const nom of acceptes) {
    const decompose = decomposerNomModele(nom);
    if (!decompose) continue;
    const octets = parNom.get(nom);
    if (!octets) continue;
    const donnees = controlerBinaire(octets, spec);
    const idBase = baseRequise(spec);
    if (idBase) {
      const origine = base.find((f) => f.nom === `${idBase}_lod${decompose.lod}.glb`);
      if (!origine) donnees.push({ code: 'asset_format', detail: `géométrie de base requise : ${idBase}_lod${decompose.lod}.glb` });
      else if (empreinteGeometrie(octets) !== empreinteGeometrie(origine.octets)) donnees.push({ code: 'asset_format', detail: 'le kit a modifié la géométrie, les UV, le squelette ou les clips de sa base' });
    }
    const lu = lireGlb(octets);
    if (lu.ok && Array.isArray(lu.document.images)) for (const image of lu.document.images) {
      if (image?.uri && !parNom.has(image.uri)) donnees.push({ code: 'asset_texture_absente', detail: `image référencée absente : ${image.uri}` });
    }
    // Une structure hostile n'atteint pas le lecteur déclaratif, qui suppose un document typé.
    let verdict: VerdictAsset;
    try { verdict = donnees.length ? { ok: false, motifs: donnees } : validerGlb(octets, spec, { lod: decompose.lod, fichiersLivres: acceptes }); }
    catch { verdict = { ok: false, motifs: [{ code: 'asset_format', detail: 'structure glTF invalide' }] }; }
    if (verdict.ok && lu.ok) {
      const noeuds = lu.document.nodes ?? [];
      const signature = JSON.stringify(noeuds.map((n, i) => ({
        nom: n.name, parent: noeuds.find((p) => p.children?.includes(i))?.name ?? null,
        translation: n.translation ?? [0, 0, 0], rotation: n.rotation ?? [0, 0, 0, 1], scale: n.scale ?? [1, 1, 1], matrix: n.matrix,
      })).sort((a, b) => (a.nom ?? '').localeCompare(b.nom ?? '')));
      if (structure !== null && structure !== signature) motifs.push({ code: 'asset_format', detail: `${nom} : noms, parents ou pivots différents entre les LOD` });
      structure = structure ?? signature;
    }
    for (const m of verdict.motifs) {
      motifs.push({ ...m, detail: `${nom} — ${m.detail}` });
    }
  }

  motifs.push(...controlerTextures(spec, parNom));

  return { ok: motifs.length === 0 && acceptes.length > 0, motifs, acceptes, inconnus, lodManquants };
}

/**
 * Écrit un lot **déjà contrôlé** dans le dossier des modèles livrés.
 *
 * Ne prend que des noms sortis de `classerDepot` : on ne rejoint jamais le nom
 * reçu du réseau au dossier, on rejoint celui que la fiche attend. La création
 * du dossier fait partie du dépôt — il n'existe pas tant que rien n'est livré.
 */
export function ecrireDepot(
  dossier: string,
  fichiers: readonly FichierLivre[],
  acceptes: readonly string[],
): string[] {
  mkdirSync(dossier, { recursive: true });
  const parNom = new Map(fichiers.map((f) => [f.nom.split(/[\\/]/).pop() ?? f.nom, f.octets]));
  const preparation = mkdtempSync(path.join(dossier, '.reception-'));
  const ecrits: string[] = [];
  const anciens = new Set<string>();
  try {
    for (const nom of acceptes) {
      if (path.basename(nom) !== nom || !/^[a-z0-9_]+\.(glb|png|ktx2)$/.test(nom)) throw new Error('nom de dépôt non reconnu');
      const octets = parNom.get(nom); if (!octets) throw new Error(`contenu absent : ${nom}`);
      writeFileSync(path.join(preparation, nom), octets);
      if (existsSync(path.join(dossier, nom))) { copyFileSync(path.join(dossier, nom), path.join(preparation, `${nom}.ancien`)); anciens.add(nom); }
    }
    for (const nom of acceptes) { renameSync(path.join(preparation, nom), path.join(dossier, nom)); ecrits.push(nom); }
    return ecrits;
  } catch (e) {
    for (const nom of ecrits) {
      if (anciens.has(nom)) renameSync(path.join(preparation, `${nom}.ancien`), path.join(dossier, nom));
      else rmSync(path.join(dossier, nom), { force: true });
    }
    throw e;
  } finally { rmSync(preparation, { recursive: true, force: true }); }

}
