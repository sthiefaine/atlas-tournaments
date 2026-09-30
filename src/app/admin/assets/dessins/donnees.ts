import { open, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

import type { CollectionDessins, DessinReference, DomaineDessin, FamilleDessin } from './types';

const DOSSIER = path.resolve('assets/direction-artistique/collection-base-v1');
const PLAN = path.join(DOSSIER, 'plan.json');
const SIGNATURE_PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ID = /^[a-z0-9_]+$/;
const FAMILLES: readonly string[] = ['unite', 'batiment', 'decor', 'terrain', 'portrait'];
const DOMAINES: readonly string[] = ['terre', 'air', 'mer'];
const GROUPES = new Map<string, string>([
  ['unite', 'unites'], ['batiment', 'batiments'], ['sol', 'sols'], ['pont', 'ponts'], ['biome', 'biomes'],
  ['rocher', 'rochers'], ['accessoire', 'accessoires'], ['portrait', 'portraits'], ['decor', 'decors'],
]);

type EntreePlan = Omit<DessinReference, 'disponible' | 'revision'> & { fichier: string };

function objet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);
}

/** Les métadonnées facultatives n'empêchent jamais la lecture d'une ancienne entrée. */
function cleFacultative(valeur: unknown): string | null {
  if (typeof valeur !== 'string' || !valeur.trim() || valeur.length > 80) return null;
  const cle = valeur.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s-]+/g, '_');
  return /^[a-z0-9_]+$/.test(cle) ? cle : null;
}

function groupeAncien(famille: FamilleDessin, cle: string): string {
  if (famille === 'unite') return 'unites';
  if (famille === 'batiment') return 'batiments';
  if (famille === 'portrait') return 'portraits';
  if (/(^|_)(pont|passerelle)(_|$)/.test(cle)) return 'ponts';
  if (famille === 'terrain') return 'sols';
  if (/(^|_)(foret|feuillu|conifere|arbre|palmier|buisson|roseau|touffe|herbe|vegetation)(_|$)/.test(cle)) return 'vegetation';
  if (/(^|_)(rocher|roc)(_|$)/.test(cle)) return 'rochers';
  return 'decors';
}

function dansDossier(racine: string, fichier: string): boolean {
  const relatif = path.relative(racine, fichier);
  return relatif !== '' && relatif !== '..' && !relatif.startsWith(`..${path.sep}`) && !path.isAbsolute(relatif);
}

/** Le fichier vient du plan local, jamais d'un paramètre de chemin du client. */
function cheminDuPlan(fichier: string): string | null {
  if (!fichier.endsWith('.png') || fichier.includes('\\') || fichier.includes('\0') || path.isAbsolute(fichier)) return null;
  if (fichier.split('/').some(partie => !partie || partie === '.' || partie === '..')) return null;
  const absolu = path.resolve(DOSSIER, fichier);
  return dansDossier(DOSSIER, absolu) ? absolu : null;
}

async function lirePlan(): Promise<{ entrees: EntreePlan[]; ecartees: number }> {
  const brut: unknown = JSON.parse(await readFile(PLAN, 'utf8'));
  if (!objet(brut) || !Array.isArray(brut.entrees)) throw new Error('plan de dessins invalide');
  const entrees: EntreePlan[] = [];
  const ids = new Set<string>();
  for (const e of brut.entrees) {
    if (!objet(e) || typeof e.id !== 'string' || !ID.test(e.id) || ids.has(e.id)
      || typeof e.cle !== 'string' || typeof e.nom !== 'string' || !e.nom.trim()
      || typeof e.famille !== 'string' || !FAMILLES.includes(e.famille)
      || typeof e.fichier !== 'string' || !cheminDuPlan(e.fichier)
      || typeof e.statut !== 'string') continue;
    ids.add(e.id);
    const famille = e.famille as FamilleDessin;
    const groupe = cleFacultative(e.groupe);
    entrees.push({
      id: e.id, cle: e.cle, nom: e.nom, famille,
      domaine: typeof e.domaine === 'string' && DOMAINES.includes(e.domaine) ? e.domaine as DomaineDessin : null,
      groupe: groupe ? GROUPES.get(groupe) ?? groupe : groupeAncien(famille, e.cle),
      biome: cleFacultative(e.biome),
      fichier: e.fichier, statut: e.statut,
    });
  }
  return { entrees, ecartees: brut.entrees.length - entrees.length };
}

/** Contrôle lexical puis contrôle réel : un lien symbolique hors collection est refusé. */
async function fichierAutorise(fichier: string): Promise<{ chemin: string; revision: string } | null> {
  const absolu = cheminDuPlan(fichier);
  if (!absolu) return null;
  try {
    const [racineReelle, fichierReel] = await Promise.all([realpath(DOSSIER), realpath(absolu)]);
    if (!dansDossier(racineReelle, fichierReel)) return null;
    const infos = await stat(fichierReel);
    if (!infos.isFile() || infos.size < SIGNATURE_PNG.length) return null;
    const lecture = await open(fichierReel, 'r');
    try {
      const entete = Buffer.alloc(SIGNATURE_PNG.length);
      const { bytesRead } = await lecture.read(entete, 0, entete.length, 0);
      if (bytesRead !== SIGNATURE_PNG.length || !entete.equals(SIGNATURE_PNG)) return null;
    } finally {
      await lecture.close();
    }
    return { chemin: fichierReel, revision: `${Math.trunc(infos.mtimeMs)}-${infos.size}` };
  } catch {
    return null;
  }
}

/** Lecture fraîche à chaque visite ; le plan et les images arrivent progressivement. */
export async function chargerCollectionDessins(): Promise<CollectionDessins> {
  try {
    const plan = await lirePlan();
    const dessins = await Promise.all(plan.entrees.map(async ({ fichier, ...entree }): Promise<DessinReference> => {
      const image = await fichierAutorise(fichier);
      return { ...entree, disponible: image !== null, revision: image?.revision ?? '' };
    }));
    return { dessins, erreur: null, ecartees: plan.ecartees };
  } catch {
    return { dessins: [], erreur: 'La collection de dessins est momentanément indisponible.', ecartees: 0 };
  }
}

/** Appelé après authentification par la route PNG ; aucune autre source n'est autorisée. */
export async function lireDessinAutorise(id: string): Promise<ArrayBuffer | null> {
  if (!ID.test(id)) return null;
  try {
    const { entrees } = await lirePlan();
    const entree = entrees.find(e => e.id === id);
    if (!entree) return null;
    const image = await fichierAutorise(entree.fichier);
    if (!image) return null;
    const contenu = await readFile(image.chemin);
    if (!contenu.subarray(0, SIGNATURE_PNG.length).equals(SIGNATURE_PNG)) return null;
    return new Uint8Array(contenu).buffer;
  } catch {
    return null;
  }
}
