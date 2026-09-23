/**
 * Le sol de la peau 2D dans un **vrai** WebGL 2 : ses nuanceurs compilent et
 * se lient, et une image dessinée dit par ses pixels ce que le code promet —
 * une case cachée est **noire**, la mer est bleue, la plaine verte, et une
 * marée se joue en transition.
 *
 * Ce spec n'a besoin d'aucun serveur : il pose une page vide et y injecte le
 * sol, empaqueté par esbuild (livré avec tsx). La configuration du dépôt lance
 * `npm run dev` sur le port 3400 si `E2E_BASE_URL` manque ; on la neutralise en
 * donnant une adresse qu'on ne visite jamais :
 *
 *   E2E_BASE_URL=http://127.0.0.1:9 npx playwright test e2e/sol-2d.spec.ts
 *   E2E_BASE_URL=http://127.0.0.1:9 npx playwright test e2e/sol-2d.spec.ts --browser=webkit
 *
 * Sur une machine partagée, ajouter `--output=<un dossier à soi>` : le dossier
 * `test-results/` est vidé par toute autre exécution de Playwright, traces
 * comprises, et la course fait échouer un test qui passait.
 */

import { expect, test, type Page } from '@playwright/test';
import { buildSync } from 'esbuild';
import path from 'node:path';

import {
  chargerCatalogue, creerPartie, reglagesParDefaut, sceneDeCarte, type EtatPartie,
} from '../src/engine/index';
import { SOURCE_FRAGMENT_SOL, SOURCE_SOMMET_SOL, UNIFORMES_SOL } from '../src/render2d/sol/nuanceurs';
import type { MapDef } from '../src/schemas/types';

const RACINE = path.resolve(__dirname, '..');

// L'empaquetage et la première compilation d'un nuanceur de cette taille
// prennent quelques secondes sur une machine calme, bien plus sous charge.
test.describe.configure({ timeout: 180_000 });

/** Le sol et ce qu'il faut pour le nourrir, en un seul script pour la page. */
function empaqueter(): string {
  const r = buildSync({
    stdin: {
      contents: [
        "import { creerSol } from './src/render2d/sol/index';",
        "import { niveauxBrouillard, SIN_TANGAGE, PIXELS_PAR_CASE } from './src/render2d/contrat';",
        "import { ambiance } from './src/render/ambiance';",
        '(globalThis as Record<string, unknown>).__sol = { creerSol, niveauxBrouillard, ambiance, SIN_TANGAGE, PIXELS_PAR_CASE };',
      ].join('\n'),
      resolveDir: RACINE,
      sourcefile: 'entree-sol.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    write: false,
    logLevel: 'silent',
  });
  const sortie = r.outputFiles[0];
  if (!sortie) throw new Error('esbuild n’a rien produit');
  return sortie.text;
}

/**
 * La carte d'essai : forêt et montagne en haut, hautes herbes, une route vers
 * une ville, la mer et sa plage à gauche avec un port, une rivière franchie par
 * un pont. La case (7, 5) sera cachée, et (6, 5) juste à côté restera vue.
 */
const GRILLE = [
  'PPFFMMPP',
  'PGGRRRCP',
  'WWSPPVPP',
  'WWSRRNRR',
  'WOSPPVPP',
  'WWPPHPPP',
];

function etatEssai(): { etat: EtatPartie; cat: ReturnType<typeof chargerCatalogue> } {
  const carte = {
    code: 'essai_sol', largeur: 8, hauteur: 6, camps: 2, grille: GRILLE, proprietaires: {}, unitesDepart: [],
  } as unknown as MapDef;
  const cat = chargerCatalogue(6);
  const etat = creerPartie(sceneDeCarte(carte, reglagesParDefaut()), cat, 'sol:1');
  return { etat, cat };
}

/** Les erreurs de console : un sol qui marche n'en écrit aucune. */
function ecouterErreurs(page: Page): string[] {
  const erreurs: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') erreurs.push(m.text());
  });
  page.on('pageerror', (e) => erreurs.push(String(e)));
  return erreurs;
}

test('les nuanceurs du sol compilent, se lient, et chaque uniforme est actif', async ({ page }) => {
  const erreurs = ecouterErreurs(page);
  await page.setContent('<canvas id="c" width="64" height="64"></canvas>');
  const r = await page.evaluate(({ vs, fs, noms }) => {
    const canvas = document.getElementById('c') as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2');
    if (!gl) return { webgl2: false } as const;
    const compiler = (type: number, source: string): { n: WebGLShader; ok: boolean; journal: string } => {
      const n = gl.createShader(type)!;
      gl.shaderSource(n, source);
      gl.compileShader(n);
      return { n, ok: gl.getShaderParameter(n, gl.COMPILE_STATUS) === true, journal: gl.getShaderInfoLog(n) ?? '' };
    };
    const v = compiler(gl.VERTEX_SHADER, vs);
    const f = compiler(gl.FRAGMENT_SHADER, fs);
    const p = gl.createProgram()!;
    gl.attachShader(p, v.n);
    gl.attachShader(p, f.n);
    gl.bindAttribLocation(p, 0, 'aCoin');
    gl.linkProgram(p);
    return {
      webgl2: true,
      sommets: v.ok,
      journalSommets: v.journal,
      fragments: f.ok,
      journalFragments: f.journal,
      lie: gl.getProgramParameter(p, gl.LINK_STATUS) === true,
      journalLien: gl.getProgramInfoLog(p) ?? '',
      inactifs: noms.filter((nom) => gl.getUniformLocation(p, nom) === null),
      erreurGl: gl.getError(),
    };
  }, { vs: SOURCE_SOMMET_SOL, fs: SOURCE_FRAGMENT_SOL, noms: [...UNIFORMES_SOL] });

  expect(r.webgl2, 'WebGL 2 indisponible dans ce navigateur').toBe(true);
  if (!r.webgl2) return;
  expect(r.journalSommets.trim(), 'journal du nuanceur de sommets').toBe('');
  expect(r.sommets).toBe(true);
  expect(r.journalFragments.trim(), 'journal du nuanceur de fragments').toBe('');
  expect(r.fragments).toBe(true);
  expect(r.lie, r.journalLien).toBe(true);
  expect(r.inactifs, 'uniformes déclarés mais jamais lus').toEqual([]);
  expect(r.erreurGl).toBe(0);
  expect(erreurs).toEqual([]);
});

test('une image du sol : la case cachée est noire, la mer bleue, la plaine verte', async ({ page }) => {
  const erreurs = ecouterErreurs(page);
  const { etat, cat } = etatEssai();
  await page.setContent('<!doctype html><body></body>');
  await page.addScriptTag({ content: empaqueter() });

  const r = await page.evaluate(({ etat, cat }) => {
    type Ctx = Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- le paquet injecté n'a pas de types dans la page
    const s = (globalThis as unknown as { __sol: Record<string, any> }).__sol;
    const largeur = etat.largeur as number;
    const hauteur = etat.hauteur as number;
    const echelle = 0.5;
    const W = Math.round(largeur * s.PIXELS_PAR_CASE * echelle);
    const H = Math.round(hauteur * s.PIXELS_PAR_CASE * s.SIN_TANGAGE * echelle);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    document.body.appendChild(canvas);
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) return { webgl2: false } as const;

    const sol = s.creerSol(gl, etat, { biome: 'plaine', reduit: true, manifeste: null });
    const climat = etat.climat as { saison: string; phase: string; meteo: string };
    const vue = { catalogue: cat, ambiance: s.ambiance(climat.saison, climat.phase, climat.meteo) };
    const visibles = new Set<string>();
    for (let y = 0; y < hauteur; y += 1) for (let x = 0; x < largeur; x += 1) if (!(x === 7 && y === 5)) visibles.add(`${x},${y}`);
    const niveaux = s.niveauxBrouillard(largeur, hauteur, visibles);
    const premiere = sol.maj(etat, vue, niveaux);
    const seconde = sol.maj(etat, vue, new Uint8Array(niveaux));

    // Le plan entier dans la toile : X ∈ [0, W / échelle] → [−1, 1], Y vers le bas.
    const Wp = W / echelle;
    const Hp = H / echelle;
    const matrice = new Float32Array([2 / Wp, 0, 0, 0, -2 / Hp, 0, -1, 1, 1]);
    const dessiner = (tempsMs: number, reduit: boolean): void => {
      gl.viewport(0, 0, W, H);
      gl.clearColor(0.25, 0.25, 0.25, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const ctx: Ctx = { gl, planVersDecoupe: matrice, echelle, largeur: W, hauteur: H, tempsMs, reduit };
      sol.dessiner(ctx);
    };
    dessiner(1000, true);
    const pixels = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const erreurGl = gl.getError();
    const px = (x: number, y: number): number[] => {
      const i = ((H - 1 - Math.floor(y)) * W + Math.floor(x)) * 4;
      return [pixels[i]!, pixels[i + 1]!, pixels[i + 2]!, pixels[i + 3]!];
    };
    // Un point du sol, en cases → le pixel de la toile.
    const au = (x: number, y: number): number[] => px(x * s.PIXELS_PAR_CASE * echelle, y * s.PIXELS_PAR_CASE * s.SIN_TANGAGE * echelle);
    const lum = (p: number[]): number => p[0]! + p[1]! + p[2]!;

    // Une marée, jouée par un terrain posé (le génie écrit comme la mer) : le
    // sol doit le voir et se mettre en transition, puis s'arrêter.
    const sol2 = s.creerSol(gl, etat, { biome: 'plaine', reduit: false, manifeste: null });
    sol2.maj(etat, vue, niveaux);
    const apres = JSON.parse(JSON.stringify(etat));
    apres.terrainsPoses = [{ case: '1,2', terrain: 'plage', jusqu: null }];
    const mareeVue = sol2.maj(apres, vue, niveaux);
    const pendant = sol2.enMouvement();
    const ctx2 = (t: number): Ctx => ({ gl, planVersDecoupe: matrice, echelle, largeur: W, hauteur: H, tempsMs: t, reduit: false });
    sol2.dessiner(ctx2(5000));
    sol2.dessiner(ctx2(5700));
    const auMilieu = sol2.enMouvement();
    sol2.dessiner(ctx2(6500));
    const fini = sol2.enMouvement();
    const erreurGl2 = gl.getError();
    sol2.dispose();
    sol.dispose();

    return {
      webgl2: true,
      premiere,
      seconde,
      erreurGl,
      cachee: au(7.5, 5.5),
      cacheeBord: au(7.08, 5.5),
      vueBord: au(6.97, 5.5),
      vueCentre: au(6.5, 5.5),
      mer: au(0.5, 3.5),
      plaine: au(0.5, 0.5),
      foret: au(2.5, 0.7),
      montagne: au(4.5, 0.5),
      // La route de la rangée 1 va du centre de (3, 1) à la ville : on la suit
      // en travers de deux frontières de case, à côté de sa ligne médiane.
      route: [3.5, 3.9, 4.0, 4.1, 4.5, 4.9, 5.0, 5.1, 5.5, 5.9].map((x) => au(x, 1.62)),
      // La rivière de la colonne 5 passe sous le pont de (5, 3) : de l'eau
      // au-dessus et au-dessous du tablier, et le tablier lui-même.
      riviere: [[5.5, 2.6], [5.5, 2.95], [5.5, 3.05], [5.5, 3.95], [5.5, 4.2]].map(([x, y]) => au(x!, y!)),
      tablier: au(5.5, 3.5),
      lumVueBord: lum(au(6.97, 5.5)),
      lumVueCentre: lum(au(6.5, 5.5)),
      mareeVue,
      pendant,
      auMilieu,
      fini,
      erreurGl2,
    };
  }, { etat: etat as unknown as Record<string, unknown>, cat: cat as unknown as Record<string, unknown> });

  expect(r.webgl2, 'WebGL 2 indisponible dans ce navigateur').toBe(true);
  if (!r.webgl2) return;
  if (process.env.SOL_JOURNAL) console.log(JSON.stringify(r));
  expect(r.erreurGl).toBe(0);
  expect(r.premiere, 'la première mise à jour demande une image').toBe(true);
  expect(r.seconde, 'une vue identique ne demande rien').toBe(false);

  // Le brouillard : noir d'un bord à l'autre de la case cachée, la transition
  // prise du côté vu.
  expect(r.cachee).toEqual([0, 0, 0, 255]);
  expect(r.cacheeBord).toEqual([0, 0, 0, 255]);
  expect(r.lumVueBord).toBeLessThan(r.lumVueCentre);
  expect(r.vueCentre[3]).toBe(255);

  // La mer est bleue, la plaine verte ; forêt et montagne ne sont pas de la plaine.
  const [mr, , mb] = r.mer;
  expect(mb!).toBeGreaterThan(mr!);
  expect(mb!).toBeGreaterThan(60);
  const [pr, pg, pb] = r.plaine;
  expect(pg!).toBeGreaterThan(pr!);
  expect(pg!).toBeGreaterThan(pb!);
  expect(r.foret).not.toEqual(r.plaine);
  const [tr, tg, tb] = r.montagne;
  expect(Math.abs(tr! - tg!)).toBeLessThan(45);
  expect(Math.abs(tg! - tb!)).toBeLessThan(45);

  // Les voies se raccordent : pas un pixel d'herbe le long de la chaussée, pas
  // un pixel de berge dans le chenal, et le tablier n'est pas de l'eau.
  for (const [rr, rg, rb] of r.route) {
    expect(Math.abs(rr! - rg!), `route ${[rr, rg, rb]}`).toBeLessThan(30);
    expect(Math.abs(rg! - rb!), `route ${[rr, rg, rb]}`).toBeLessThan(30);
  }
  for (const [er, , eb] of r.riviere) expect(eb! - er!, `rivière ${r.riviere}`).toBeGreaterThan(15);
  expect(r.tablier[2]! - r.tablier[0]!).toBeLessThan(15);

  // La marée : vue, jouée, finie.
  expect(r.mareeVue).toBe(true);
  expect(r.pendant).toBe(true);
  expect(r.auMilieu).toBe(true);
  expect(r.fini).toBe(false);
  expect(r.erreurGl2).toBe(0);
  expect(erreurs).toEqual([]);
});
