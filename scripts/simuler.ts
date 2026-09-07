/**
 * Simulation IA contre IA en ligne de commande (`doc/02-architecture.md` §8, niveau 3).
 *
 * ```
 * npx tsx scripts/simuler.ts --carte tests/engine/cartes/plaine.json --parties 100 --graine 1
 * npx tsx scripts/simuler.ts --carte … --json          # StatsSimulation en JSON
 * npx tsx scripts/simuler.ts --carte … --conditions ete/clair/jour,hiver/neige/nuit
 * npx tsx scripts/simuler.ts --carte … --conditions … --verdict
 * ```
 *
 * Options : `--carte`, `--parties`, `--graine`, `--strategies a,b`, `--journees`,
 * `--climat`, `--saison`, `--meteo`, `--brouillard`, `--catalogue N` (la version
 * de catalogue jouée, celle du moteur par défaut), `--json`, plus deux options
 * de contrôle :
 *
 * - `--conditions ete/clair/jour,hiver/neige/nuit` — passe par la **campagne du
 *   serveur** (`src/serveur/simulation`) : `parties` s'entend alors **par
 *   condition**, et la sortie donne l'agrégat plus une ligne par condition ;
 * - `--verdict` — imprime le `ReviewVerdict` que rendrait la routine contrôle sur
 *   cette carte, vérifications structurelles comprises. Implique `--conditions`
 *   (le sextuor par défaut s'applique si aucune n'est donnée).
 *
 * C'est l'outil d'équilibrage et celui de la routine contrôle : une variation du
 * résultat à graine fixe signale une régression.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { jouerPartie, strategie } from '../src/ai/index';
import {
  chargerCatalogue, creerPartie, reglagesParDefaut, sceneDeCarte, creerRng,
  type EtatPartie,
} from '../src/engine/index';
import { rendreVerdict, verifierCarteControle } from '../src/serveur/controle/index';
import {
  simuler as campagne, type ConditionClimat, type ResultatSimulation,
} from '../src/serveur/simulation';
import { validerMapDef } from '../src/schemas/index';
import type {
  Climat, MapDef, Meteo, PhaseJour, Saison, StatsSimulation, StrategieIa,
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

/** Charge et valide une `MapDef` depuis un fichier JSON. */
export function chargerCarte(chemin: string): MapDef {
  const brut = JSON.parse(readFileSync(path.resolve(chemin), 'utf8')) as unknown;
  const r = validerMapDef(brut);
  if (!r.ok) {
    const details = r.erreurs.map((e) => `  - ${e.chemin} : ${e.message}`).join('\n');
    throw new Error(`Carte invalide (${chemin}) :\n${details}`);
  }
  return r.valeur;
}

/** Médiane d'une liste de nombres. */
function mediane(valeurs: number[]): number {
  if (valeurs.length === 0) return 0;
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  return tri.length % 2 === 0
    ? ((tri[milieu - 1] ?? 0) + (tri[milieu] ?? 0)) / 2
    : (tri[milieu] ?? 0);
}

/** Écart-type d'une liste de nombres. */
function ecartType(valeurs: number[]): number {
  if (valeurs.length === 0) return 0;
  const moyenne = valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
  const variance = valeurs.reduce((a, b) => a + (b - moyenne) ** 2, 0) / valeurs.length;
  return Math.sqrt(variance);
}

/** Paramètres d'une campagne de simulation. */
export interface Campagne {
  carte: MapDef;
  parties: number;
  graine: string;
  strategies: StrategieIa[];
  journees: number;
  climat: Climat;
  saison: Saison | null;
  meteo: Meteo | null;
  brouillard: boolean;
  /** Version de catalogue jouée ; `undefined` laisse le moteur choisir la sienne. */
  catalogue?: number;
}

/** Ce que rend une campagne : les statistiques du contrat, plus le détail. */
export interface Bilan {
  stats: StatsSimulation;
  produites: Record<string, number>;
  motifs: Record<string, number>;
  journees: number[];
}

/** Joue N parties IA contre IA sur une carte et rend les statistiques. */
export function simuler(c: Campagne): Bilan {
  const cat = chargerCatalogue(c.catalogue);
  const victoires = new Array<number>(c.carte.camps).fill(0);
  const fonds = new Array<number>(c.carte.camps).fill(0);
  const produites: Record<string, number> = {};
  const motifs: Record<string, number> = {};
  const journees: number[] = [];
  const graines: string[] = [];
  const visitees = new Set<string>();
  let nonTerminees = 0;
  let mecaniqueDeclenchee = c.carte.mecanique ? 0 : null;
  let nuls = 0;
  const debut = process.hrtime.bigint();

  for (let i = 0; i < c.parties; i += 1) {
    const graine = `${c.graine}:${i}`;
    graines.push(graine);
    const reglages = reglagesParDefaut({
      limiteJournees: c.journees,
      climatPays: c.climat,
      brouillard: c.brouillard,
      saisonForcee: c.saison,
      meteoForcee: c.meteo,
    });
    const scene = sceneDeCarte(c.carte, reglages);
    const etat = creerPartie(scene, cat, graine);
    // On alterne les stratégies d'une partie à l'autre : le camp qui commence
    // ne doit pas être le seul à porter la personnalité la plus forte.
    const strategies = (i % 2 === 0 ? c.strategies : [...c.strategies].reverse())
      .map((id) => strategie(id));
    const partie = jouerPartie(etat, strategies, creerRng(`${graine}:ia`), cat);
    const fin: EtatPartie = partie.etat;
    journees.push(fin.journee);
    // « Non terminée » au sens de la routine contrôle : la limite de journées est
    // tombée avant qu'une condition de victoire ne se déclenche (§8, seuil 20 %).
    if (!fin.partie.terminee || fin.partie.motif === 'limite_journees') nonTerminees += 1;
    if (fin.partie.nul) nuls += 1;
    if (fin.partie.vainqueur !== null) {
      // Le vainqueur est ramené à l'ordre des stratégies passées en argument.
      const camp = i % 2 === 0 ? fin.partie.vainqueur : (c.carte.camps - 1 - fin.partie.vainqueur);
      victoires[camp] = (victoires[camp] ?? 0) + 1;
    }
    for (const camp of fin.camps) {
      fonds[camp.id] = (fonds[camp.id] ?? 0) + camp.fonds;
      for (let j = 0; j < camp.visitees.length; j += 1) {
        if (camp.visitees[j] === '1') visitees.add(String(j));
      }
    }
    for (const [k, n] of Object.entries(fin.produites)) {
      const type = k.split(':')[1] ?? k;
      produites[type] = (produites[type] ?? 0) + n;
    }
    if (fin.mecanique && mecaniqueDeclenchee !== null && fin.mecanique.declenchements > 0) {
      mecaniqueDeclenchee += 1;
    }
    if (!fin.partie.terminee) motifs['limite_atteinte'] = (motifs['limite_atteinte'] ?? 0) + 1;
    else if (fin.partie.motif) motifs[fin.partie.motif] = (motifs[fin.partie.motif] ?? 0) + 1;
  }

  let terre = 0;
  for (const ligne of c.carte.grille) {
    for (const car of ligne) if (car !== 'W') terre += 1;
  }
  const dureeMs = Number(process.hrtime.bigint() - debut) / 1e6;

  return {
    stats: {
      parties: c.parties,
      strategie: c.strategies.join(' vs '),
      graines,
      victoiresCamp: victoires,
      nonTerminees,
      journeesMediane: mediane(journees),
      journeesEcartType: Number(ecartType(journees).toFixed(2)),
      fondsMoyenParCamp: fonds.map((f) => Math.round(f / Math.max(1, c.parties))),
      casesJamaisVisitees: Math.max(0, terre - visitees.size),
      mecaniqueDeclenchee,
      climat: {
        saison: c.saison ?? 'printemps',
        meteo: c.meteo ?? 'tiree',
        phase: 'cycle',
      },
      dureeMoyenneMs: Number((dureeMs / Math.max(1, c.parties)).toFixed(2)),
    },
    produites,
    motifs,
    journees: journees.concat(nuls === 0 ? [] : []),
  };
}

/**
 * Lit `--conditions ete/clair/jour,hiver/neige/nuit`. Une condition mal formée
 * arrête le script : mieux vaut refuser que simuler autre chose que demandé.
 */
export function lireConditions(brut: string): ConditionClimat[] {
  const sortie: ConditionClimat[] = [];
  for (const morceau of brut.split(',')) {
    const [saison, meteo, phase] = morceau.trim().split('/');
    if (!saison || !meteo || !phase) {
      throw new Error(`condition mal formée : « ${morceau} » (attendu saison/meteo/phase)`);
    }
    sortie.push({ saison: saison as Saison, meteo: meteo as Meteo, phase: phase as PhaseJour });
  }
  return sortie;
}

/** Rend la campagne multi-conditions en texte, agrégat puis ligne par ligne. */
function afficherCampagne(carte: MapDef, r: ResultatSimulation): string {
  const lignes: string[] = [];
  const s = r.stats;
  lignes.push(`Carte      : ${carte.nom} (${carte.code}, ${carte.largeur}×${carte.hauteur})`);
  lignes.push(`Campagne   : ${s.parties} parties — ${s.strategie} — ${r.parCondition.length} condition(s)`);
  lignes.push(`Simulation : ${r.simulationId} en ${r.dureeCalculMs} ms`);
  lignes.push('');
  lignes.push(`Victoires par camp   : ${s.victoiresCamp.join(' / ')} (camp 1 commence : ${((r.horsSchema['victoires_camp_1'] ?? 0) * 100).toFixed(1)} %)`);
  lignes.push(`Parties sans résultat: ${s.nonTerminees} (${((r.horsSchema['non_terminees'] ?? 0) * 100).toFixed(1)} %)`);
  lignes.push(`Parties à la limite  : ${((r.horsSchema['parties_a_la_limite'] ?? 0) * 100).toFixed(1)} %`);
  lignes.push(`Durée médiane        : ${s.journeesMediane} journées (écart-type ${s.journeesEcartType})`);
  lignes.push(`Cases jamais visitées: ${s.casesJamaisVisitees} (${((r.horsSchema['part_cases_jamais_visitees'] ?? 0) * 100).toFixed(1)} % de la terre)`);
  lignes.push(`Mécanique déclenchée : ${s.mecaniqueDeclenchee ?? '—'}`);
  lignes.push(`Durée de calcul      : ${s.dureeMoyenneMs} ms par partie`);
  if (r.conditionsEcartees.length > 0) {
    lignes.push(`Conditions écartées   : ${r.conditionsEcartees.map((c) => `${c.saison}/${c.meteo}/${c.phase}`).join(', ')}`);
  }
  lignes.push('');
  lignes.push('Par condition :');
  for (const l of r.parCondition) {
    const nom = `${l.condition.saison}/${l.condition.meteo}/${l.condition.phase}`;
    lignes.push(`  ${nom.padEnd(28)} victoires ${l.stats.victoiresCamp.join('-')}  sans résultat ${((l.horsSchema['non_terminees'] ?? 0) * 100).toFixed(0)} %  médiane ${l.stats.journeesMediane} j`);
  }
  return lignes.join('\n');
}

/** Point d'entrée en ligne de commande. */
function principal(): void {
  const o = options(process.argv.slice(2));
  const chemin = typeof o['carte'] === 'string' ? o['carte'] : 'tests/engine/cartes/plaine.json';
  const carte = chargerCarte(chemin);
  const strategies = (typeof o['strategies'] === 'string'
    ? o['strategies'].split(',')
    : ['ponderee', 'agressive']) as StrategieIa[];

  // Mode contrôle : la campagne multi-conditions du serveur, et son verdict.
  if (typeof o['conditions'] === 'string' || o['verdict'] === true) {
    const conditions = typeof o['conditions'] === 'string' ? lireConditions(o['conditions']) : undefined;
    const resultat = campagne({
      carte,
      conditions,
      parties: typeof o['parties'] === 'string' ? Number(o['parties']) : 20,
      strategies,
      journeesMax: typeof o['journees'] === 'string' ? Number(o['journees']) : 40,
      climatPays: (typeof o['climat'] === 'string' ? o['climat'] : 'tempere') as Climat,
      ...(typeof o['graine'] === 'string' ? { graine: o['graine'] } : {}),
    });
    if (o['verdict'] === true) {
      const controle = verifierCarteControle(carte);
      const verdict = rendreVerdict({ type: 'carte', cle: carte.code, version: carte.version },
        resultat, controle.motifs);
      process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
      return;
    }
    if (o['json'] === true) {
      process.stdout.write(`${JSON.stringify(resultat.stats, null, 2)}\n`);
      return;
    }
    process.stdout.write(`${afficherCampagne(carte, resultat)}\n`);
    return;
  }

  const bilan = simuler({
    carte,
    parties: typeof o['parties'] === 'string' ? Number(o['parties']) : 20,
    graine: typeof o['graine'] === 'string' ? o['graine'] : '1',
    strategies,
    journees: typeof o['journees'] === 'string' ? Number(o['journees']) : 40,
    climat: (typeof o['climat'] === 'string' ? o['climat'] : 'tempere') as Climat,
    saison: typeof o['saison'] === 'string' ? (o['saison'] as Saison) : null,
    meteo: typeof o['meteo'] === 'string' ? (o['meteo'] as Meteo) : null,
    brouillard: o['brouillard'] === true,
    ...(typeof o['catalogue'] === 'string' ? { catalogue: Number(o['catalogue']) } : {}),
  });

  if (o['json'] === true) {
    process.stdout.write(`${JSON.stringify(bilan.stats, null, 2)}\n`);
    return;
  }

  const s = bilan.stats;
  const lignes: string[] = [];
  lignes.push(`Carte      : ${carte.nom} (${carte.code}, ${carte.largeur}×${carte.hauteur})`);
  lignes.push(`Parties    : ${s.parties}  —  ${s.strategie}  —  graine ${bilan.stats.graines[0] ?? ''}…`);
  lignes.push('');
  lignes.push('Victoires par camp :');
  s.victoiresCamp.forEach((v, i) => {
    const part = ((v / Math.max(1, s.parties)) * 100).toFixed(1);
    lignes.push(`  camp ${i} (${strategies[i] ?? '—'}) : ${v} (${part} %)`);
  });
  const decidees = s.victoiresCamp.reduce((a, b) => a + b, 0);
  lignes.push(`  matchs nuls        : ${s.parties - decidees}`);
  lignes.push('');
  lignes.push(`Durée moyenne      : ${(bilan.journees.reduce((a, b) => a + b, 0) / Math.max(1, s.parties)).toFixed(1)} journées`);
  lignes.push(`Durée médiane      : ${s.journeesMediane} journées (écart-type ${s.journeesEcartType})`);
  lignes.push(`Parties non terminées : ${s.nonTerminees}`);
  lignes.push(`Cases jamais visitées : ${s.casesJamaisVisitees}`);
  lignes.push(`Fonds moyens        : ${s.fondsMoyenParCamp.join(' / ')}`);
  lignes.push(`Mécanique déclenchée : ${s.mecaniqueDeclenchee ?? '—'}`);
  lignes.push(`Durée de calcul     : ${s.dureeMoyenneMs} ms par partie`);
  lignes.push('');
  lignes.push('Unités produites par type :');
  for (const [type, n] of Object.entries(bilan.produites).sort((a, b) => b[1] - a[1])) {
    lignes.push(`  ${type.padEnd(12)} ${n}`);
  }
  lignes.push('');
  lignes.push('Fins de partie :');
  for (const [motif, n] of Object.entries(bilan.motifs).sort((a, b) => b[1] - a[1])) {
    lignes.push(`  ${motif.padEnd(22)} ${n}`);
  }
  process.stdout.write(`${lignes.join('\n')}\n`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  principal();
}
