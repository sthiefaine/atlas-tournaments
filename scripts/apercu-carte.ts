/**
 * Aperçu d'une carte : génère (ou relit) une `MapDef`, écrit un PNG de relecture
 * et affiche l'aperçu texte que la routine map recevra.
 *
 * ```
 * tsx scripts/apercu-carte.ts --params '{"largeur":16,"hauteur":12,"camps":2}' \
 *     --graine 7 --sortie apercus/carte.png
 * tsx scripts/apercu-carte.ts --params '{"biome":"cotier","ratioMer":0.35,"portsParCamp":1,"radarsParCamp":1}' \
 *     --graine 3
 * tsx scripts/apercu-carte.ts --mapdef carte.json --sortie apercus/carte.png
 * ```
 *
 * Options : `--params <json>` `--graine <entier>` `--mapdef <fichier>`
 * `--sortie <fichier.png>` `--tuile <px>` `--sans-texte`.
 *
 * Les champs absents de `--params` prennent une valeur par défaut : la ligne de
 * commande sert à regarder vite, le contrat complet reste `ParametresCarte`
 * (`03-schemas.md` §5).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { apercuTexte, genererCarte, verifierCarte } from '../src/mapgen/index';
import { encoderPng, rasteriserCarte } from '../src/render/apercu/index';
import { validerMapDef, validerParametresCarte } from '../src/schemas/valider';
import type { MapDef, ParametresCarte } from '../src/schemas/types';

/** Paramètres par défaut : de quoi compléter une ligne de commande courte. */
const DEFAUTS: ParametresCarte = {
  largeur: 20,
  hauteur: 14,
  camps: 2,
  biome: 'plaine',
  ratioMer: 0.2,
  ratioRelief: 0.15,
  villesParCamp: 3,
  villesNeutres: 2,
  usinesParCamp: 1,
  aeroportsParCamp: 0,
  portsParCamp: 0,
  radarsParCamp: 0,
  symetrie: 'aucune',
  densiteRoutes: 0.5,
};

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
  process.stderr.write(`apercu-carte : ${message}\n`);
  process.exit(1);
}

/** Écrit sur la sortie standard sans mourir si le tuyau est refermé (`| head`). */
function ecrire(texte: string): void {
  try {
    process.stdout.write(texte);
  } catch {
    // EPIPE : le lecteur est parti, il n'y a rien à sauver.
  }
}

function principal(): void {
  process.stdout.on('error', () => { /* EPIPE */ });
  const options = lireOptions(process.argv.slice(2));
  let carte: MapDef;

  if (options['mapdef'] !== undefined) {
    const brut: unknown = JSON.parse(readFileSync(options['mapdef'], 'utf8'));
    const lue = validerMapDef(brut);
    if (!lue.ok) {
      abandonner(`MapDef invalide :\n${lue.erreurs.map((e) => `  - ${e.chemin} : ${e.message}`).join('\n')}`);
    }
    carte = lue.valeur;
  } else {
    let fournis: Record<string, unknown> = {};
    if (options['params'] !== undefined) {
      const brut: unknown = JSON.parse(options['params']);
      if (typeof brut !== 'object' || brut === null) abandonner('--params doit être un objet JSON');
      fournis = brut as Record<string, unknown>;
    }
    const parametres = { ...DEFAUTS, ...fournis } as ParametresCarte;
    const lus = validerParametresCarte(parametres);
    if (!lus.ok) {
      abandonner(`paramètres invalides :\n${lus.erreurs.map((e) => `  - ${e.chemin} : ${e.message}`).join('\n')}`);
    }
    const graine = Number(options['graine'] ?? '0');
    if (!Number.isFinite(graine)) abandonner('--graine doit être un entier');
    carte = genererCarte(parametres, graine);
  }

  // L'image d'abord : elle est le livrable, le texte n'est que du confort.
  const sortie = options['sortie'];
  if (sortie !== undefined && sortie !== 'true') {
    const tuile = Number(options['tuile'] ?? '16');
    const image = rasteriserCarte(carte, { tuile: Number.isFinite(tuile) ? tuile : 16 });
    mkdirSync(path.dirname(path.resolve(sortie)), { recursive: true });
    writeFileSync(sortie, encoderPng(image));
    ecrire(`Image : ${sortie} (${image.largeur}×${image.hauteur} px)\n\n`);
  }

  if (options['sans-texte'] === undefined) ecrire(`${apercuTexte(carte)}\n\n`);

  const rapport = verifierCarte(carte);
  ecrire(rapport.ok
    ? 'Vérification : aucune anomalie structurelle.\n'
    : `Vérification : ${rapport.motifs.map((m) => `${m.code} (${m.detail})`).join(' ; ')}\n`);
}

principal();
