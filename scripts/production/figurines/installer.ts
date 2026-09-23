/**
 * L'installation d'une figurine dans le jeu — par le coordinateur, jamais par
 * un agent d'unité (`README.md`, « Ce que vous ne touchez pas »).
 *
 *   npm run installer:figurine -- --cle <cle> [--lot <dossier>]
 *
 * Le lot de `tmp/figurines/<cle>/lot/` est contrôlé contre la fiche
 * **officielle** (`assets/specs/unite_<cle>_base.json`) : ses dimensions ont
 * été reportées d'abord de la fiche mesurée dans `src/assets/catalogue.ts`
 * (`DIMENSIONS_FIGURINES`), puis les fiches régénérées. Un lot refusé n'est pas
 * installé, et l'ancien modèle reste.
 *
 * Puis il est rangé comme tout modèle du dépôt : chaque fichier **une fois**,
 * sous son empreinte, dans `public/assets/donnees/`, et `public/assets/modeles/`
 * n'en porte que des liens relatifs — deux PNG identiques (une variante d'hiver
 * qui ne change rien) ne coûtent qu'un fichier. Un nom de l'unité que le lot ne
 * livre plus est retiré, et le registre `assets/production/activation-jeu.json`
 * suit. Le plan de production (`assets/production/plan-modeles-3d.json`) n'est
 * pas touché : il décrit la chaîne d'avant les figurines.
 *
 * Reste à recuire l'image : `npm run cuire:sprites -- --id unite_<cle>_base`.
 */

import { createHash } from 'node:crypto';
import {
  existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';

import type { AssetSpec } from '../../../src/assets/spec';
import { controlerDepot } from '../../../src/serveur/depot-modeles';

const MODELES = 'public/assets/modeles';
const DONNEES = 'public/assets/donnees';
const ACTIVATION = 'assets/production/activation-jeu.json';

/** L'empreinte SHA-256 d'un fichier, en hexadécimal. */
export function empreinte(octets: Uint8Array): string {
  return createHash('sha256').update(octets).digest('hex');
}

/**
 * La révision d'un lot : l'empreinte de la liste de ses fichiers et de leurs
 * empreintes, triée par nom. Deux lots identiques ont la même révision, quel
 * que soit l'ordre dans lequel on les lit.
 */
export function revisionLot(fichiers: readonly { nom: string; sha256: string }[]): string {
  const h = createHash('sha256');
  for (const f of [...fichiers].sort((a, b) => a.nom.localeCompare(b.nom))) h.update(`${f.nom}\0${f.sha256}\n`);
  return h.digest('hex');
}

/**
 * Les noms d'une unité déjà installés que le lot ne livre plus : un ancien
 * modèle avait peut-être une carte que le nouveau n'a pas. Seuls les noms de
 * **cette** unité sont regardés (`<id>_…`), jamais ceux d'une autre.
 */
export function nomsObsoletes(id: string, installes: readonly string[], livres: readonly string[]): string[] {
  const garde = new Set(livres);
  return installes.filter((n) => n.startsWith(`${id}_`) && !garde.has(n)).sort();
}

/** Un lien relatif de `modeles/<nom>` vers `donnees/<empreinte><ext>`, comme les autres modèles. */
export function cibleLien(sha256: string, nom: string): string {
  return path.posix.join('..', 'donnees', sha256 + path.extname(nom));
}

function argument(nom: string): string | undefined {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function installer(): void {
  const cle = argument('cle');
  if (!cle || !/^[a-z0-9_]+$/.test(cle)) throw new Error('--cle <cle> attendue');
  const id = `unite_${cle}_base`;
  const lot = argument('lot') ?? path.join('tmp/figurines', cle, 'lot');
  const spec = JSON.parse(readFileSync(path.join('assets/specs', `${id}.json`), 'utf8')) as AssetSpec;

  const noms = readdirSync(lot).filter((n) => n.startsWith(`${id}_`)).sort();
  const fichiers = noms.map((nom) => ({ nom, octets: new Uint8Array(readFileSync(path.join(lot, nom))) }));
  const verdict = controlerDepot(spec, fichiers);
  if (!verdict.ok) {
    console.error(JSON.stringify(verdict.motifs, null, 2));
    throw new Error(`${id} : le lot est refusé par la fiche officielle ; rien n'est installé`);
  }

  mkdirSync(DONNEES, { recursive: true });
  const ranges = fichiers.map((f) => ({ nom: f.nom, octets: f.octets, sha256: empreinte(f.octets) }));
  for (const f of ranges) {
    const blob = path.join(DONNEES, f.sha256 + path.extname(f.nom));
    if (!existsSync(blob)) writeFileSync(blob, f.octets, { flag: 'wx' });
    else if (!readFileSync(blob).equals(Buffer.from(f.octets))) throw new Error(`collision d'empreinte : ${blob}`);
    const lien = path.join(MODELES, f.nom);
    if (existsSync(lien) || lstatSync(lien, { throwIfNoEntry: false })) unlinkSync(lien);
    symlinkSync(cibleLien(f.sha256, f.nom), lien);
  }
  const retires = nomsObsoletes(id, readdirSync(MODELES), noms);
  for (const n of retires) unlinkSync(path.join(MODELES, n));

  const glb = ranges.find((f) => f.nom.endsWith('_lod0.glb'));
  if (!glb) throw new Error(`${id} : aucun GLB dans le lot`);
  const revision = revisionLot(ranges);
  const activation = JSON.parse(readFileSync(ACTIVATION, 'utf8')) as { date: string; assets: { id: string }[] };
  activation.date = new Date().toISOString().slice(0, 10);
  activation.assets = activation.assets.filter((a) => a.id !== id);
  activation.assets.push({
    id,
    fichierActif: `${MODELES}/${glb.nom}`,
    donnees: cibleLien(glb.sha256, glb.nom),
    revision,
    controle: 'ok',
    provenance: 'figurine',
  } as { id: string });
  activation.assets.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(ACTIVATION, JSON.stringify(activation, null, 2) + '\n');

  console.log(JSON.stringify({
    id, revision, fichiers: ranges.length, octets: ranges.reduce((s, f) => s + f.octets.byteLength, 0), retires,
    suite: `npm run cuire:sprites -- --id ${id}`,
  }, null, 2));
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  try {
    installer();
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  }
}
