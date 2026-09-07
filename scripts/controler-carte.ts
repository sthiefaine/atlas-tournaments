/**
 * Le contrôle d'une carte en ligne de commande : ce que fait la routine
 * `atlas_controle` sur une mission `controle.map`, sans passer par l'API
 * (`doc/05-routines.md` §4).
 *
 * ```
 * npx tsx scripts/controler-carte.ts --carte tests/engine/cartes/plaine.json
 * npx tsx scripts/controler-carte.ts --generer 16x12 --biome plaine --graine 4242
 * npx tsx scripts/controler-carte.ts --generer 20x14 --biome cotier --mer 0.35 --ports 1 --radars 1
 * npx tsx scripts/controler-carte.ts --carte … --conditions ete/clair/jour,hiver/neige/nuit --parties 10
 * npx tsx scripts/controler-carte.ts --carte … --json     # le ReviewVerdict brut
 * ```
 *
 * Trois étapes, dans l'ordre du document : vérifications structurelles
 * (reproductibilité comprise), campagne de simulation sous plusieurs conditions
 * de climat, puis verdict. Le verdict imprimé est **exactement** celui que le
 * serveur rendrait : c'est le même code.
 *
 * `--apercu` imprime en plus l'aperçu texte que la routine map commente.
 */

import path from 'node:path';
import { chargerCarte, lireConditions } from './simuler';
import { apercuTexte, genererCarte, hacher } from '../src/mapgen/index';
import { rendreVerdict, verifierCarteControle } from '../src/serveur/controle/index';
import { simuler } from '../src/serveur/simulation';
import type {
  Biome, Climat, MapDef, ParametresCarte, ReviewVerdict, StrategieIa, Symetrie,
} from '../src/schemas/index';

/** Lit les options de la ligne de commande. */
function options(argv: string[]): Record<string, string | boolean> {
  const sortie: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === undefined || !a.startsWith('--')) continue;
    const cle = a.slice(2);
    const suivant = argv[i + 1];
    if (suivant === undefined || suivant.startsWith('--')) sortie[cle] = true;
    else {
      sortie[cle] = suivant;
      i += 1;
    }
  }
  return sortie;
}

/** Construit une carte depuis `--generer LxH` et les options de biome. */
export function carteGeneree(o: Record<string, string | boolean>): MapDef {
  const taille = typeof o['generer'] === 'string' ? o['generer'] : '16x12';
  const [l, h] = taille.split('x').map((n) => Number(n));
  const parametres: ParametresCarte = {
    largeur: Number.isFinite(l) ? (l as number) : 16,
    hauteur: Number.isFinite(h) ? (h as number) : 12,
    camps: 2,
    biome: (typeof o['biome'] === 'string' ? o['biome'] : 'plaine') as Biome,
    ratioMer: typeof o['mer'] === 'string' ? Number(o['mer']) : 0,
    ratioRelief: typeof o['relief'] === 'string' ? Number(o['relief']) : 0.12,
    villesParCamp: 3,
    villesNeutres: 2,
    usinesParCamp: 1,
    aeroportsParCamp: 0,
    symetrie: (typeof o['symetrie'] === 'string' ? o['symetrie'] : 'point') as Symetrie,
    densiteRoutes: 0.45,
    // Ports et stations radar (7 septembre 2026) : facultatifs, absents = 0.
    ...(typeof o['ports'] === 'string' ? { portsParCamp: Number(o['ports']) } : {}),
    ...(typeof o['radars'] === 'string' ? { radarsParCamp: Number(o['radars']) } : {}),
  };
  const graine = typeof o['graine'] === 'string' ? o['graine'] : 'controle';
  const n = Number(graine);
  return genererCarte(parametres, Number.isFinite(n) ? n : hacher(graine));
}

/** Rend le verdict en texte lisible : la ligne de bilan d'un run de contrôle. */
export function afficherVerdict(carte: MapDef, v: ReviewVerdict): string {
  const lignes: string[] = [];
  lignes.push(`Carte   : ${carte.nom} (${carte.code}, ${carte.largeur}×${carte.hauteur}, ${carte.camps} camps)`);
  lignes.push(`Verdict : ${v.verdict.toUpperCase()} — ${v.detail ?? ''}`);
  if (v.motifs.length === 0) lignes.push('Motifs  : aucun.');
  else {
    lignes.push('Motifs  :');
    for (const m of v.motifs) {
      const mesures = Object.entries(m.mesure ?? {}).map(([k, n]) => `${k}=${n}`).join(' ');
      lignes.push(`  · ${m.code}`);
      if (m.detail) lignes.push(`      ${m.detail}`);
      if (mesures) lignes.push(`      mesure : ${mesures}`);
    }
  }
  if (v.suggestions.length > 0) {
    lignes.push('Suggestions :');
    for (const s of v.suggestions) lignes.push(`  · ${s}`);
  }
  const stats = v.stats;
  if (stats !== null && !('avec' in stats)) {
    lignes.push('');
    lignes.push(`Stats   : ${stats.parties} parties, victoires ${stats.victoiresCamp.join('-')}, `
      + `${stats.nonTerminees} sans résultat, médiane ${stats.journeesMediane} j, `
      + `${stats.casesJamaisVisitees} cases jamais visitées, ${stats.dureeMoyenneMs} ms/partie`);
  }
  return lignes.join('\n');
}

/** Point d'entrée. */
function principal(): void {
  const o = options(process.argv.slice(2));
  const carte = typeof o['carte'] === 'string' ? chargerCarte(o['carte']) : carteGeneree(o);

  if (o['apercu'] === true) process.stdout.write(`${apercuTexte(carte)}\n\n`);

  const controle = verifierCarteControle(carte);
  const strategies = (typeof o['strategies'] === 'string'
    ? o['strategies'].split(',')
    : ['ponderee', 'agressive']) as StrategieIa[];
  const resultat = simuler({
    carte,
    ...(typeof o['conditions'] === 'string' ? { conditions: lireConditions(o['conditions']) } : {}),
    parties: typeof o['parties'] === 'string' ? Number(o['parties']) : 10,
    strategies,
    journeesMax: typeof o['journees'] === 'string' ? Number(o['journees']) : 40,
    climatPays: (typeof o['climat'] === 'string' ? o['climat'] : 'tempere') as Climat,
  });

  const verdict = rendreVerdict(
    { type: 'carte', cle: carte.code, version: carte.version },
    resultat,
    controle.motifs,
  );

  if (o['json'] === true) {
    process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${afficherVerdict(carte, verdict)}\n`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  principal();
}
