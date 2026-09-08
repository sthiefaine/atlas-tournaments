// Profiler la construction du monde, poste par poste, hors navigateur.
//
// Bâtir le monde (`render3d/index.ts`, `ouvrirChantier`) est du JavaScript
// pur : synthèse de textures en boucles de pixels, fusion de géométries, semis
// du décor. Aucune carte graphique n'y intervient — Node la mesure donc
// fidèlement, et mieux que le navigateur, dont le volet masqué fausse tout.
//
// Trois mesures, parce qu'elles ne disent pas la même chose : l'horloge autour
// de chaque poste, l'horloge autour de chaque **tranche** telle qu'`index.ts`
// la joue, et un profil V8 agrégé par fonction (où le temps part *dans* un
// poste). Deux colonnes partout : le premier montage d'une page, qui peint
// tout, et le suivant, qui retrouve les toiles et les formes en mémoire.
//
// Lancer : `TOURS=9 PROFIL=1 node --import tsx \
//   --import ./tests/aides/webgpu-en-node.mjs tests/render3d/profil-batir.ts`
//
// Ce qu'elle ne mesure pas : `putImageData` et les dégradés d'un vrai canvas
// 2D, absorbés par la toile en mémoire de `monde.ts` — un navigateur paie donc
// davantage. Les boucles de pixels, elles, sont réelles, et c'est là qu'est le
// temps ; le premier montage d'un vrai navigateur paie en plus son code froid,
// que le JIT de ce banc a déjà chauffé.
import { Session } from 'node:inspector';
import * as THREE from 'three/webgpu';

import { terrainLogique, type Catalogue, type EtatPartie } from '../../src/engine/index';
import { creerDecor } from '../../src/render3d/decor';
import { creerEclairage, parametresAmbiance } from '../../src/render3d/eclairage';
import { creerEffets } from '../../src/render3d/effets';
import type { GrilleTerrain } from '../../src/render3d/geometrie';
import { tailleCarteOmbre } from '../../src/render3d/ombres';
import { creerSurbrillances } from '../../src/render3d/surbrillances';
import { creerPlateau, grefferBrouillardSur, tranchesToilesPlateau } from '../../src/render3d/terrain';
import { creerUnites, oublierFormesUnites, poidsFormesUnites } from '../../src/render3d/unites';
import type { Biome, CleTerrain } from '../../src/schemas/index';
import { documentMemoire, etatDeScenario } from './monde';

export type Postes = Record<string, number>;

/** Un montage complet, chronométré poste par poste. Rend les millisecondes. */
export function monterChronometre(
  e: EtatPartie, cat: Catalogue, biome: Biome = 'plaine', document?: Document,
): { postes: Postes; dispose(): void } {
  const t: Postes = {};
  const top = (nom: string, f: () => void): void => {
    const d = performance.now();
    f();
    t[nom] = (t[nom] ?? 0) + performance.now() - d;
  };
  // Un document neuf par défaut : c'est le **premier** montage d'une page, celui
  // qui paie les toiles. Passer le même document deux fois rejoue ce que fait le
  // navigateur quand on revient à l'accueil ou qu'on change de carte.
  const doc = document ?? documentMemoire();
  const scene = new THREE.Scene();
  const grille: GrilleTerrain = {
    largeur: e.largeur,
    hauteur: e.hauteur,
    terrainDe: (x, y): CleTerrain => terrainLogique(e, cat, { x, y }) ?? 'plaine',
  };
  let plateau!: ReturnType<typeof creerPlateau>;
  let decor!: ReturnType<typeof creerDecor>;
  let unites!: ReturnType<typeof creerUnites>;
  let surbrillances!: ReturnType<typeof creerSurbrillances>;
  let effets!: ReturnType<typeof creerEffets>;
  let eclairage!: ReturnType<typeof creerEclairage>;
  top('creerPlateau', () => { plateau = creerPlateau(grille, doc, biome); });
  top('creerDecor', () => { decor = creerDecor(grille, e, plateau.hauteurEn, biome); });
  top('grefferBrouillard', () => grefferBrouillardSur(decor.groupe, plateau.uniformesBrouillard, 'atlas-brouillard-decor-v1'));
  top('creerUnites', () => { unites = creerUnites(doc, plateau.hauteurEn); });
  top('creerSurbrillances', () => { surbrillances = creerSurbrillances(plateau.hauteurEn); });
  top('creerEffets', () => { effets = creerEffets(doc); });
  const depart = parametresAmbiance(e.climat.saison, e.climat.phase, e.climat.meteo);
  top('creerEclairage', () => {
    eclairage = creerEclairage(
      scene, doc, depart,
      (x, z) => (x >= 0 && z >= 0 && x < e.largeur && z < e.hauteur ? plateau.hauteurEn(x, z) : null),
      { tailleOmbre: tailleCarteOmbre(false) },
    );
  });
  top('ambiance', () => {
    scene.add(plateau.groupe, decor.groupe, unites.groupe, surbrillances.groupe, effets.groupe, eclairage.groupe);
    plateau.appliquerAmbiance(depart);
    decor.appliquerAmbiance(depart, e.climat.saison);
    unites.appliquerAmbiance(depart);
  });
  top('unites.maj', () => { unites.maj(e, cat, null); });
  top('decor.majProprietaires', () => { decor.majProprietaires(e, null); });
  t.total = Object.values(t).reduce((a, b) => a + b, 0);
  return {
    postes: t,
    dispose(): void {
      plateau.dispose(); decor.dispose(); unites.dispose();
      surbrillances.dispose(); effets.dispose(); eclairage.dispose();
    },
  };
}

/**
 * Le même montage, mais **tranche par tranche**, dans l'ordre où `ouvrirChantier`
 * (`render3d/index.ts`) les joue. C'est ce tableau qui dit si un bloc du
 * chargement dépasse encore ce qu'un navigateur peut avaler d'un coup.
 */
export function monterEnTranches(
  e: EtatPartie, cat: Catalogue, biome: Biome = 'plaine', document?: Document,
): { postes: Postes; dispose(): void } {
  const t: Postes = {};
  const doc = document ?? documentMemoire();
  const scene = new THREE.Scene();
  const grille: GrilleTerrain = {
    largeur: e.largeur,
    hauteur: e.hauteur,
    terrainDe: (x, y): CleTerrain => terrainLogique(e, cat, { x, y }) ?? 'plaine',
  };
  const depart = parametresAmbiance(e.climat.saison, e.climat.phase, e.climat.meteo);
  let plateau!: ReturnType<typeof creerPlateau>;
  let decor!: ReturnType<typeof creerDecor>;
  let unites!: ReturnType<typeof creerUnites>;
  let surbrillances!: ReturnType<typeof creerSurbrillances>;
  let effets!: ReturnType<typeof creerEffets>;
  let eclairage!: ReturnType<typeof creerEclairage>;
  const toiles = tranchesToilesPlateau(doc, biome);
  const tranches: Array<[string, () => void]> = toiles.map((f, i) => [`toiles ${i + 1}/${toiles.length}`, f]);
  tranches.push(['plateau + lumière', () => {
    plateau = creerPlateau(grille, doc, biome);
    unites = creerUnites(doc, plateau.hauteurEn);
    surbrillances = creerSurbrillances(plateau.hauteurEn);
    effets = creerEffets(doc);
    eclairage = creerEclairage(
      scene, doc, depart,
      (x, z) => (x >= 0 && z >= 0 && x < e.largeur && z < e.hauteur ? plateau.hauteurEn(x, z) : null),
      { tailleOmbre: tailleCarteOmbre(false) },
    );
    scene.add(plateau.groupe, unites.groupe, surbrillances.groupe, effets.groupe, eclairage.groupe);
    plateau.appliquerAmbiance(depart);
    unites.appliquerAmbiance(depart);
  }]);
  tranches.push(['décor + paysage', () => {
    decor = creerDecor(grille, e, plateau.hauteurEn, biome);
    grefferBrouillardSur(decor.groupe, plateau.uniformesBrouillard, 'atlas-brouillard-decor-v1');
    decor.appliquerAmbiance(depart, e.climat.saison);
    scene.add(decor.groupe);
  }]);
  tranches.push(['unités (majMonde)', () => {
    unites.maj(e, cat, null);
    decor.majProprietaires(e, null);
  }]);
  for (const [nom, f] of tranches) {
    const d = performance.now();
    f();
    t[nom] = performance.now() - d;
  }
  t.total = Object.values(t).reduce((a, b) => a + b, 0);
  t['plus longue'] = Math.max(...tranches.map(([nom]) => t[nom] ?? 0));
  return {
    postes: t,
    dispose(): void {
      plateau.dispose(); decor.dispose(); unites.dispose();
      surbrillances.dispose(); effets.dispose(); eclairage.dispose();
    },
  };
}

/** La médiane d'une série. */
export function mediane(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2]! : ((s[s.length / 2 - 1]! + s[s.length / 2]!) / 2);
}

interface Noeud { id: number; callFrame: { functionName: string; url: string }; children?: number[]; }

/** Le temps propre par (fichier, fonction), depuis un profil V8. */
function agregerProfil(profil: { nodes: Noeud[]; samples?: number[]; timeDeltas?: number[] }): Map<string, number> {
  const parId = new Map<number, Noeud>();
  for (const n of profil.nodes) parId.set(n.id, n);
  const par = new Map<string, number>();
  const samples = profil.samples ?? [];
  const deltas = profil.timeDeltas ?? [];
  for (let i = 0; i < samples.length; i += 1) {
    const n = parId.get(samples[i]!);
    if (!n) continue;
    const url = n.callFrame.url.replace(/^.*\/(src|node_modules)\//, '$1/');
    const cle = `${url}:${n.callFrame.functionName || '(anonyme)'}`;
    par.set(cle, (par.get(cle) ?? 0) + (deltas[i] ?? 0) / 1000);
  }
  return par;
}

/** Lance le profileur V8 autour de `f` et rend le temps propre par fonction. */
export function profiler(f: () => void): Map<string, number> {
  const session = new Session();
  session.connect();
  let profil: { nodes: Noeud[]; samples?: number[]; timeDeltas?: number[] } | null = null;
  session.post('Profiler.enable');
  session.post('Profiler.setSamplingInterval', { interval: 100 });
  session.post('Profiler.start');
  f();
  session.post('Profiler.stop', (_e, r) => { profil = (r as { profile: typeof profil }).profile; });
  session.disconnect();
  return profil ? agregerProfil(profil) : new Map();
}

/** Point d'entrée : `node --import tsx --import ./tests/aides/webgpu-en-node.mjs tests/render3d/profil-batir.ts`. */
async function principal(): Promise<void> {
  const cas: Array<{ nom: string; carte: string; scenario: string }> = [
    { nom: 'premier_contact', carte: 'carte_premier_contact', scenario: 'premier_contact' },
    { nom: 'demo', carte: 'carte_plaine_symetrique', scenario: 'demo' },
  ];
  const tours = Number(process.env.TOURS ?? 5);
  for (const c of cas) {
    const carte = (await import(`../../content/cartes/${c.carte}.json`, { with: { type: 'json' } })).default;
    const scenario = (await import(`../../content/scenarios/${c.scenario}.json`, { with: { type: 'json' } })).default;
    const { etat, cat } = etatDeScenario(carte, scenario);
    // Une chauffe : JIT et modules chargés. Le premier montage d'une page les
    // paie aussi, mais il paie surtout l'analyse du bundle, qu'on ne mesure pas ici.
    monterChronometre(etat, cat).dispose();
    const series: Postes[] = [];
    const rendus: Postes[] = [];
    const memePage = documentMemoire();
    monterChronometre(etat, cat, 'plaine', memePage).dispose();
    for (let i = 0; i < tours; i += 1) {
      // Le premier montage d'une page ne connaît ni toile ni forme d'unité.
      oublierFormesUnites();
      const m = monterChronometre(etat, cat);
      series.push(m.postes);
      m.dispose();
      const r = monterChronometre(etat, cat, 'plaine', memePage);
      rendus.push(r.postes);
      r.dispose();
    }
    const noms = Object.keys(series[0]!);
    console.log(`\n=== ${c.nom} (${etat.largeur}×${etat.hauteur}, ${etat.unites.length} unités) — médiane de ${tours} montages`);
    console.log(`${''.padEnd(24)} ${'1er'.padStart(7)}  ${'2nd'.padStart(7)}`);
    for (const n of noms) {
      const v = mediane(series.map((s) => s[n] ?? 0));
      const w = mediane(rendus.map((s) => s[n] ?? 0));
      if (v >= 0.05 || w >= 0.05 || n === 'total') {
        console.log(`${n.padEnd(24)} ${v.toFixed(1).padStart(7)}  ${w.toFixed(1).padStart(7)} ms`);
      }
    }
    // Le même montage, découpé comme `ouvrirChantier` le découpe.
    oublierFormesUnites();
    monterEnTranches(etat, cat).dispose();
    const parTranche: Postes[] = [];
    const memeChantier = documentMemoire();
    monterEnTranches(etat, cat, 'plaine', memeChantier).dispose();
    const parTrancheChaud: Postes[] = [];
    for (let i = 0; i < tours; i += 1) {
      oublierFormesUnites();
      const m = monterEnTranches(etat, cat);
      parTranche.push(m.postes);
      m.dispose();
      const r = monterEnTranches(etat, cat, 'plaine', memeChantier);
      parTrancheChaud.push(r.postes);
      r.dispose();
    }
    console.log('  -- par tranche, dans l’ordre où index.ts les joue');
    for (const n of Object.keys(parTranche[0]!)) {
      const v = mediane(parTranche.map((s) => s[n] ?? 0));
      const w = mediane(parTrancheChaud.map((s) => s[n] ?? 0));
      console.log(`     ${n.padEnd(21)} ${v.toFixed(1).padStart(7)}  ${w.toFixed(1).padStart(7)} ms`);
    }
    const poids = poidsFormesUnites();
    console.log(`  formes d'unités gardées : ${poids.formes}, ${(poids.octets / 1024).toFixed(0)} ko`);
    if (process.env.PROFIL) {
      const par = profiler(() => {
        for (let i = 0; i < 3; i += 1) monterChronometre(etat, cat).dispose();
      });
      const total = [...par.values()].reduce((a, b) => a + b, 0);
      console.log(`  -- profil V8, temps propre par fonction (3 montages, ${total.toFixed(0)} ms au total)`);
      for (const [cle, ms] of [...par.entries()].sort((a, b) => b[1] - a[1]).slice(0, 26)) {
        console.log(`     ${(ms / 3).toFixed(1).padStart(7)} ms  ${cle}`);
      }
    }
  }
}

if (process.argv[1]?.endsWith('profil-batir.ts')) void principal();
