/**
 * Produit `assets/specs/*.json` : une spécification par asset, depuis le canon.
 *
 * ```
 * npx tsx scripts/generer-specs-assets.ts
 * npx tsx scripts/generer-specs-assets.ts --sortie assets/specs --verifier
 * ```
 *
 * Options :
 * - `--sortie <dossier>` — où écrire (défaut `assets/specs`) ;
 * - `--verifier` — n'écrit rien, échoue si un fichier existant diffère de ce que
 *   le canon produit aujourd'hui. C'est le mode de l'intégration continue :
 *   `assets/specs/` est versionné, il ne doit jamais dériver du canon ;
 * - `--type <famille>` — ne produire qu'une famille (`unite`, `kit`, `terrain`,
 *   `batiment`, `decor`, `commandant`) ;
 * - `--priorite <1|2|3>` — ne produire que les assets d'une priorité de
 *   production (1 = la France et ses premiers adversaires). À combiner avec
 *   `--sortie` : filtrer sans changer de dossier ferait échouer `--verifier`,
 *   qui compare le dossier **entier** au canon ;
 * - `--silencieux` — pas de bilan sur la sortie standard.
 *
 * Le script ne décide de rien : tout vient de `src/assets/catalogue.ts`, qui lit
 * `content/unites.json`, `content/terrains.json`, `content/archetypes.json`, les
 * 24 fiches de `content/pays/`, les régions de `content/regions/` et les styles
 * de `content/styles/`. Chaque spécification est **repassée dans son propre
 * validateur** avant d'être écrite : le dépôt ne livre jamais au générateur
 * externe un contrat qu'il refuserait lui-même.
 */

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { bilanPriorites, bilanSpecs, genererSpecs } from '../src/assets/catalogue';
import { validerLotAssetSpec } from '../src/assets/valider';
import { PRIORITES, TYPES_ASSET, type AssetSpec, type Priorite, type TypeAsset } from '../src/assets/spec';

/** Lit les options `--clef valeur` de la ligne de commande. */
function lireOptions(argv: readonly string[]): Record<string, string> {
  const options: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const brut = argv[i];
    if (brut === undefined || !brut.startsWith('--')) continue;
    const clef = brut.slice(2);
    const suivant = argv[i + 1];
    if (suivant === undefined || suivant.startsWith('--')) options[clef] = 'true';
    else { options[clef] = suivant; i += 1; }
  }
  return options;
}

/** Termine le programme sur une erreur lisible. */
function abandonner(message: string): never {
  process.stderr.write(`generer-specs-assets : ${message}\n`);
  process.exit(1);
}

/** Sérialise une spécification : deux espaces, saut de ligne final, ordre stable. */
function serialiser(spec: AssetSpec): string {
  return `${JSON.stringify(spec, null, 2)}\n`;
}

const options = lireOptions(process.argv.slice(2));
const racine = path.resolve(import.meta.dirname, '..');
const sortie = path.resolve(racine, options['sortie'] ?? 'assets/specs');
const verifier = options['verifier'] === 'true';
const silencieux = options['silencieux'] === 'true';

const filtre = options['type'];
if (filtre !== undefined && !(TYPES_ASSET as readonly string[]).includes(filtre)) {
  abandonner(`famille inconnue : ${filtre} (attendu ${TYPES_ASSET.join(', ')})`);
}

const filtrePriorite = options['priorite'];
if (filtrePriorite !== undefined && !['1', '2', '3'].includes(filtrePriorite)) {
  abandonner(`priorité inconnue : ${filtrePriorite} (attendu ${PRIORITES.join(', ')})`);
}

let specs = genererSpecs();
if (filtre !== undefined) specs = specs.filter((s) => s.type === (filtre as TypeAsset));
if (filtrePriorite !== undefined) {
  specs = specs.filter((s) => s.priorite === (Number(filtrePriorite) as Priorite));
}
if (specs.length === 0) abandonner('aucune spécification produite : le canon est-il vide ?');

// Le dépôt ne livre jamais un contrat qu'il refuserait lui-même.
const controle = validerLotAssetSpec(specs);
if (!controle.ok) {
  const details = controle.erreurs
    .map((e) => `  - ${e.chemin === '' ? '(racine)' : e.chemin} : ${e.message}`)
    .join('\n');
  abandonner(`spécifications invalides, rien n'a été écrit :\n${details}`);
}

if (verifier) {
  const ecarts: string[] = [];
  let presents: string[] = [];
  try {
    presents = readdirSync(sortie).filter((f) => f.endsWith('.json'));
  } catch {
    abandonner(`dossier absent : ${path.relative(racine, sortie)} (lancer le script sans --verifier)`);
  }
  const attendus = new Set(specs.map((s) => `${s.id}.json`));
  for (const f of presents) {
    if (!attendus.has(f)) ecarts.push(`fichier en trop : ${f}`);
  }
  for (const spec of specs) {
    const chemin = path.join(sortie, `${spec.id}.json`);
    let lu: string;
    try {
      lu = readFileSync(chemin, 'utf8');
    } catch {
      ecarts.push(`fichier manquant : ${spec.id}.json`);
      continue;
    }
    if (lu !== serialiser(spec)) ecarts.push(`fichier périmé : ${spec.id}.json`);
  }
  if (ecarts.length > 0) {
    abandonner(`assets/specs a dérivé du canon :\n${ecarts.map((e) => `  - ${e}`).join('\n')}`);
  }
  if (!silencieux) process.stdout.write(`assets/specs est à jour : ${specs.length} spécifications.\n`);
  process.exit(0);
}

// Écriture : on repart d'un dossier propre pour qu'un asset retiré du canon
// disparaisse aussi du dépôt.
try {
  rmSync(sortie, { recursive: true, force: true });
  mkdirSync(sortie, { recursive: true });
} catch (e) {
  abandonner(`impossible de préparer ${path.relative(racine, sortie)} : ${String(e)}`);
}

for (const spec of specs) {
  writeFileSync(path.join(sortie, `${spec.id}.json`), serialiser(spec), 'utf8');
}

if (!silencieux) {
  const bilan = bilanSpecs(specs);
  const parPriorite = bilanPriorites(specs);
  const lignes = TYPES_ASSET
    .filter((t) => bilan[t] > 0)
    .map((t) => `  ${t.padEnd(11)} ${String(bilan[t]).padStart(3)}`);
  // La priorité est ce qu'on lit en premier : elle dit ce qu'on commande cette
  // semaine, et ce qui attend le passage des routines.
  const priorites = PRIORITES
    .map((p) => `  priorité ${p}  ${String(parPriorite[p]).padStart(3)}`)
    .join('\n');
  process.stdout.write(
    `${specs.length} spécifications écrites dans ${path.relative(racine, sortie)}\n`
    + `${lignes.join('\n')}\n${priorites}\n`,
  );
}
