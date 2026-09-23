/**
 * Les **vraies** images cuites passent dans la peau 2D — vérifié par la lecture
 * de pixels, jamais à l'œil (`doc/refonte/sprites-reglages.md`).
 *
 * Deux parties.
 *
 * **Le lot sur un vrai WebGL 2, sans serveur** : le nuanceur des images
 * (`render2d/lot.ts`), empaqueté par esbuild et posé sur une page vide, dessine
 * des pages construites à la main, et l'on relit ses pixels :
 *
 * - une zone d'équipe cuite en blanc prend le **gris neutre** sans propriétaire ;
 * - la page d'émission s'**ajoute**, pondérée : 0,06 le jour, 1 la nuit ;
 * - le **voile** d'une image du monde rend exactement ce que reçoit le sol ;
 * - une lumière **additive** s'ajoute à ce qu'elle couvre ;
 * - les pages s'arrêtent au **niveau de détail 2**, et c'est ce qui empêche une
 *   silhouette de baver sur sa voisine : on le mesure, en relevant la borne.
 *
 * **La partie `premier_contact`** (`/jeu/premier_contact?rendu=2d`) :
 *
 * - les pages demandées au réseau sont celles des entrées présentes sur la
 *   carte — ses trois unités, ses deux QG, le pont, le décor de la plaine —,
 *   pas les 101 du manifeste ;
 * - chaque unité et chaque QG dessinent **leur image cuite** autour de leur
 *   pivot : les pixels de la capture sont ceux de la page, à la bonne place,
 *   dans le bon sens — et donc pas ceux d'un repli ;
 * - la couleur d'équipe apparaît sur les zones masquées (la France bleue, le
 *   Luxembourg cyan) ; le QG **neutre** n'a pas de blanc pur là où son masque
 *   est plein, mais le gris neutre ;
 * - la nuit, les fenêtres du QG français s'allument par-dessus le voile ;
 * - l'atlas ne dessine aucun repli d'une entrée que le manifeste connaît.
 *
 * Il relève aussi, pour `doc/refonte/sprites-reglages.md` : les octets
 * téléchargés en images, les pages chargées, la mémoire de textures estimée, et
 * le coût du dessin d'une image (`mesurer()`), écrits en annotations.
 *
 * Lancer contre un serveur à soi :
 * `NEXT_DIST_DIR=.next-images npx next dev --turbopack -p 3416`, puis
 * `E2E_BASE_URL=http://localhost:3416 npx playwright test e2e/images-cuites-2d.spec.ts [--browser=webkit]`.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { buildSync } from 'esbuild';

test.setTimeout(420_000);
test.use({
  viewport: { width: 1280, height: 800 },
  trace: 'off',
  // Sous Chromium sur macOS, le dessin passe par Metal (`rendu-2d.spec.ts`).
  launchOptions: [async ({ browserName }, use) => {
    await use(browserName === 'chromium' && process.platform === 'darwin' ? { args: ['--use-angle=metal'] } : {});
  }, { scope: 'worker' }],
});

const RACINE = path.resolve(__dirname, '..');
const CHEMIN_MANIFESTE = path.join(RACINE, 'public', 'assets', 'sprites', 'manifeste.json');

// ---------------------------------------------------------------------------
// 1. Le lot sur un vrai WebGL 2
// ---------------------------------------------------------------------------

/** Le lot et ce qu'il faut pour le nourrir, en un seul script pour la page. */
function empaqueterLot(): string {
  const r = buildSync({
    stdin: {
      contents: [
        "import { LotSprites, poser, reglagesNeutres, MODE_VOILEE } from './src/render2d/lot';",
        "import { televerseurWebGl, NIVEAU_MIPMAP_MAX } from './src/render2d/atlas';",
        "import { matricePlanVersDecoupe } from './src/render2d/camera';",
        "import { voileDuLot, poidsEmission, etalonnerPose } from './src/render2d/meteo';",
        "import { couleurEquipeDe } from './src/render2d/unites';",
        "import { PIXELS_PAR_CASE, SIN_TANGAGE } from './src/render2d/contrat';",
        "import { ambiance } from './src/render/ambiance';",
        '(globalThis as Record<string, unknown>).__lot = {',
        '  LotSprites, poser, reglagesNeutres, MODE_VOILEE, televerseurWebGl, NIVEAU_MIPMAP_MAX,',
        '  matricePlanVersDecoupe, voileDuLot, poidsEmission, etalonnerPose, couleurEquipeDe,',
        '  PIXELS_PAR_CASE, SIN_TANGAGE, ambiance,',
        '};',
      ].join('\n'),
      resolveDir: RACINE,
      sourcefile: 'entree-lot.ts',
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

/** Ce que le banc du lot rend : les pixels lus, par cas. */
interface ReleveLot {
  webgl2: boolean;
  neutreGris: number[];
  neutreSansCouleur: number[];
  emissionJour: number[];
  emissionNuit: number[];
  voilee: number[];
  nonVoilee: number[];
  voileAttendu: number[];
  additif: number[];
  parDessus: number[];
  niveauMax: number;
  bavureBornee: number;
  bavureSansBorne: number;
  erreurGl: number;
}

test('le lot sur un vrai WebGL 2 : gris neutre, fenêtres pondérées, voile exact, lumière additive, niveaux bornés', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: empaqueterLot() });
  const r = await page.evaluate((): ReleveLot | { webgl2: false } => {
    type Lot = {
      LotSprites: new (gl: WebGL2RenderingContext) => {
        preparer(poses: unknown[], res: { resoudre(i: unknown): unknown }): unknown;
        dessinerCalque(c: string, m: Float32Array, r: { emission: number; voile: Float32Array }): unknown;
      };
      poser(calque: string, inst: Record<string, unknown>): Record<string, unknown>;
      reglagesNeutres(): { emission: number; voile: Float32Array };
      televerseurWebGl(gl: WebGL2RenderingContext): { creer(s: TexImageSource | null, l: number, h: number, o: { premultiplier: boolean; canal?: 'rgba' | 'rouge' }): WebGLTexture };
      NIVEAU_MIPMAP_MAX: number;
      matricePlanVersDecoupe(e: { cx: number; cy: number; zoom: number }, v: { largeur: number; hauteur: number }, m: Float32Array): Float32Array;
      voileDuLot(a: unknown, s?: Float32Array): Float32Array;
      poidsEmission(a: unknown): number;
      etalonnerPose<T>(p: T): T;
      couleurEquipeDe(camp: number | null, pays: string | null): readonly [number, number, number];
      PIXELS_PAR_CASE: number;
      SIN_TANGAGE: number;
      ambiance(s: string, p: string, m: string): unknown;
    };
    const L = (globalThis as unknown as { __lot: Lot }).__lot;
    const W = 64;
    const toile = document.createElement('canvas');
    toile.width = W;
    toile.height = W;
    const gl = toile.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: true });
    if (!gl) return { webgl2: false };
    const lot = new L.LotSprites(gl);
    const t = L.televerseurWebGl(gl);
    const peinte = (l: number, h: number, peindre: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement => {
      const c = document.createElement('canvas');
      c.width = l;
      c.height = h;
      const g = c.getContext('2d')!;
      peindre(g);
      return c;
    };
    const unie = (css: string) => peinte(32, 32, (g) => { g.fillStyle = css; g.fillRect(0, 0, 32, 32); });
    const matrice = L.matricePlanVersDecoupe({ cx: W / 2, cy: W / 2, zoom: 1 }, { largeur: W, hauteur: W }, new Float32Array(9));
    /** Une instance dont le pivot tombe au point `(X, Y)` du plan. */
    const instance = (X: number, Y: number, extra: Record<string, unknown> = {}) => ({
      entree: 'essai', animation: 0, cadre: 0, x: X / L.PIXELS_PAR_CASE, y: Y / (L.PIXELS_PAR_CASE * L.SIN_TANGAGE), ...extra,
    });
    const lire = (x: number, y: number): number[] => {
      const px = new Uint8Array(4);
      gl.readPixels(x, W - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return [px[0]!, px[1]!, px[2]!];
    };
    const dessiner = (fond: readonly number[], poses: unknown[], cadre: unknown, reglages = L.reglagesNeutres(), calque = 'unites'): void => {
      gl.viewport(0, 0, W, W);
      gl.disable(gl.SCISSOR_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(fond[0]! / 255, fond[1]! / 255, fond[2]! / 255, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      lot.preparer(poses, { resoudre: () => cadre });
      lot.dessinerCalque(calque, matrice, reglages);
    };
    const cadre32 = (couleur: WebGLTexture, masque: WebGLTexture | null, emission: WebGLTexture | null) => ({
      textures: { couleur, masque, emission }, u0: 0, v0: 0, u1: 1, v1: 1, l: 32, h: 32, px: 16, py: 16,
      echelle: 1, masque: masque !== null, emission: emission !== null, repli: false,
    });

    // --- Le gris neutre : une zone d'équipe blanche, pleine de masque — un
    //     masque déposé comme l'atlas le dépose, en rouge seul (R8).
    const blanc = t.creer(unie('#ffffff'), 32, 32, { premultiplier: true });
    const masquePlein = t.creer(unie('#ffffff'), 32, 32, { premultiplier: false, canal: 'rouge' });
    const formatMasque = gl.getError();
    const cadreEquipe = cadre32(blanc, masquePlein, null);
    dessiner([0, 0, 0], [L.poser('unites', instance(32, 32, { equipe: L.couleurEquipeDe(null, null) }))], cadreEquipe);
    const neutreGris = lire(32, 32);
    dessiner([0, 0, 0], [L.poser('unites', instance(32, 32, { equipe: null }))], cadreEquipe);
    const neutreSansCouleur = lire(32, 32);

    // --- Les fenêtres : un mur gris, une émission orangée, 0,06 le jour, 1 la nuit.
    const mur = t.creer(unie('rgb(100,100,100)'), 32, 32, { premultiplier: true });
    const lampe = t.creer(unie('rgb(200,150,50)'), 32, 32, { premultiplier: true });
    const cadreFenetre = cadre32(mur, null, lampe);
    const reglages = L.reglagesNeutres();
    reglages.emission = L.poidsEmission(L.ambiance('ete', 'jour', 'clair'));
    dessiner([0, 0, 0], [L.poser('volumes', instance(32, 32))], cadreFenetre, reglages, 'volumes');
    const emissionJour = lire(32, 32);
    reglages.emission = L.poidsEmission(L.ambiance('ete', 'nuit', 'clair'));
    dessiner([0, 0, 0], [L.poser('volumes', instance(32, 32))], cadreFenetre, reglages, 'volumes');
    const emissionNuit = lire(32, 32);

    // --- Le voile exact : une image du monde, la nuit, contre la formule du sol.
    const brique = t.creer(unie('rgb(200,120,40)'), 32, 32, { premultiplier: true });
    const cadreBrique = cadre32(brique, null, null);
    const nuit = L.ambiance('printemps', 'nuit', 'clair');
    const voile = L.reglagesNeutres();
    L.voileDuLot(nuit, voile.voile);
    dessiner([0, 0, 0], [L.etalonnerPose(L.poser('volumes', instance(32, 32, { entree: 'batiment_ville_base' })))], cadreBrique, voile, 'volumes');
    const voilee = lire(32, 32);
    dessiner([0, 0, 0], [L.etalonnerPose(L.poser('unites', instance(32, 32, { entree: 'forme_pv_3' })))], cadreBrique, voile, 'unites');
    const nonVoilee = lire(32, 32);
    const v = voile.voile;
    const voileAttendu = [200, 120, 40].map((c, i) => c * (1 - v[3]!) + v[i]! * 255 * v[3]!);

    // --- La lumière additive : un blanc à moitié, sur un fond gris.
    const pose = (additif: number) => ({ ...L.poser('effets', instance(32, 32, { opacite: 0.5 })), additif });
    dessiner([60, 60, 60], [pose(1)], cadre32(blanc, null, null), L.reglagesNeutres(), 'effets');
    const additif = lire(32, 32);
    dessiner([60, 60, 60], [pose(0)], cadre32(blanc, null, null), L.reglagesNeutres(), 'effets');
    const parDessus = lire(32, 32);

    // --- Les niveaux de détail. Une page comme la cuisson les range : l'image A
    //     (rouge) dans son rectangle [0, 256[ avec sa bordure transparente d'un
    //     pixel, quatre pixels vides, puis l'image B (verte), bordure comprise —
    //     cinq texels du bord de A au premier pixel de B.
    const planche = peinte(520, 128, (g) => {
      g.clearRect(0, 0, 520, 128);
      g.fillStyle = '#ff0000';
      g.fillRect(1, 1, 254, 126);
      g.fillStyle = '#00ff00';
      g.fillRect(261, 1, 254, 126);
    });
    const page = t.creer(planche, 520, 128, { premultiplier: true });
    const niveauMax = gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL) as number;
    // A seule, au huitième : le niveau 3, où un texel mêle huit texels — et où
    // le bord de A tombe exactement sur une frontière de texel. Le bord droit
    // du quad à 0,55 pixel d'une frontière de l'écran : un fragment lit alors
    // jusqu'à 0,4 texel du bord de A.
    const cadreA = {
      textures: { couleur: page, masque: null, emission: null }, u0: 0, v0: 0, u1: 256 / 520, v1: 1, l: 256, h: 128, px: 0, py: 0,
      echelle: 1, masque: false, emission: false, repli: false,
    };
    const vertMax = (): number => {
      const px = new Uint8Array(W * W * 4);
      gl.readPixels(0, 0, W, W, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let m = 0;
      for (let i = 0; i < px.length; i += 4) m = Math.max(m, px[i + 1]!);
      return m;
    };
    dessiner([0, 0, 0], [L.poser('unites', instance(48.55 - 32, 20.3, { echelle: 1 / 8 }))], cadreA);
    const bavureBornee = vertMax();
    gl.bindTexture(gl.TEXTURE_2D, page);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, 1000);
    gl.generateMipmap(gl.TEXTURE_2D);
    dessiner([0, 0, 0], [L.poser('unites', instance(48.55 - 32, 20.3, { echelle: 1 / 8 }))], cadreA);
    const bavureSansBorne = vertMax();

    return {
      webgl2: true, neutreGris, neutreSansCouleur, emissionJour, emissionNuit, voilee, nonVoilee, voileAttendu,
      additif, parDessus, niveauMax, bavureBornee, bavureSansBorne, erreurGl: gl.getError() || formatMasque,
    };
  });
  expect(r.webgl2, 'WebGL 2 indisponible').toBe(true);
  if (!r.webgl2) return;
  const proche = (a: number[], b: number[], tolerance = 2) => a.every((x, i) => Math.abs(x - (b[i] ?? NaN)) <= tolerance);
  // Le gris neutre, jamais le blanc des zones cuites ; sans couleur, le blanc revient — c'est le contrat.
  expect(proche(r.neutreGris, [0xb9, 0xbe, 0xc7]), `neutre ${r.neutreGris}`).toBe(true);
  expect(r.neutreSansCouleur, 'sans couleur d’équipe, la zone reste blanche').toEqual([255, 255, 255]);
  // 100 + 0,06 × (200, 150, 50) le jour ; 100 + (200, 150, 50) la nuit.
  expect(proche(r.emissionJour, [112, 109, 103]), `jour ${r.emissionJour}`).toBe(true);
  expect(proche(r.emissionNuit, [255, 250, 150]), `nuit ${r.emissionNuit}`).toBe(true);
  // Le voile de la nuit sur une image du monde : la formule du sol, au niveau près.
  expect(proche(r.voilee, r.voileAttendu.map(Math.round), 1), `voilée ${r.voilee} contre ${r.voileAttendu}`).toBe(true);
  expect(r.nonVoilee, 'une pastille ne reçoit pas la nuit').toEqual([200, 120, 40]);
  // Additive : 60 + 127,5 ; par-dessus : 60 × 0,5 + 127,5.
  expect(proche(r.additif, [188, 188, 188]), `additif ${r.additif}`).toBe(true);
  expect(proche(r.parDessus, [158, 158, 158]), `par-dessus ${r.parDessus}`).toBe(true);
  // Les niveaux : bornés à 2, et c'est ce qui garde le vert de B hors du rouge de A.
  expect(r.niveauMax).toBe(2);
  expect(r.bavureBornee, 'niveau borné : aucune trace de la voisine').toBeLessThanOrEqual(1);
  expect(r.bavureSansBorne, 'sans borne, la voisine bave — la borne sert').toBeGreaterThan(8);
  test.info().annotations.push({ type: 'bavure', description: `vert lu sur A : ${r.bavureBornee} borné au niveau 2, ${r.bavureSansBorne} sans borne` });
  expect(r.erreurGl).toBe(0);
  expect(erreurs).toEqual([]);
});

// ---------------------------------------------------------------------------
// 2. premier_contact : les images cuites de la partie
// ---------------------------------------------------------------------------

/** Le pont de développement (`render/jeu.ts`) et les mesures de la peau 2D. */
type Pont = {
  positionCase(x: number, y: number): { x: number; y: number } | null;
  capturer(): string | null;
  forcerAmbiance(saison: string | null, phase?: string, meteo?: string): void;
  mesurer(): {
    appels: number; msParImage: number; instances?: number;
    images?: {
      pages: number; enVol: number; echecs: number; cheminsPages: string[]; textures: number; octetsGpu: number;
      replis: number; pagesRepli: number; cuites: number; replisAvecEntree: number;
    } | null;
  } | null;
};

type Manifeste = {
  entrees: Record<string, {
    famille: string; cle: string;
    pages: { couleur: string; masque?: string; emission?: string; largeur: number; hauteur: number }[];
    animations: { vue: string; clip: string; cadres: { page: number; x: number; y: number; l: number; h: number; px: number; py: number }[] }[];
  }>;
};

/** Ce que la comparaison d'une image à la capture rend. */
interface Comparaison {
  entree: string;
  /** Pixels de la capture dont l'empreinte, dans l'image, est entièrement opaque. */
  interieurs: number;
  /** Écart médian et au 8e décile, en niveaux sur 255 (le pire des trois canaux). */
  mediane: number;
  decile8: number;
  cadre: number;
  /** Les zones d'équipe blanches : ce qu'elles rendent, rapporté à la couleur d'équipe attendue. */
  equipe: { n: number; ecartTeinte: number; blancPur: number; maxCanal: number };
  /** La nuit : la part des fenêtres retrouvée par-dessus le voile. */
  fenetres?: { n: number; partMediane: number };
}

/**
 * Compare, dans la page, la capture de la toile à l'image cuite qu'une entrée
 * doit y poser : chaque pixel de la capture dont l'empreinte tombe entièrement
 * dans l'opaque de l'image est ramené dans l'image (pivot, miroir, zoom), et sa
 * couleur attendue est la moyenne de l'image sur cette empreinte, masque
 * d'équipe appliqué — ce que le filtrage des niveaux de détail rend, à peu près.
 * On garde le meilleur cadre de l'animation : un repos respire.
 */
async function comparer(page: Page, o: {
  entree: string; vue: string; clip: string; x: number; y: number; miroir: boolean;
  equipe: readonly number[] | null; voile?: readonly number[] | null; emission?: number;
}): Promise<Comparaison> {
  return page.evaluate(async (o) => {
    const w = window as unknown as { __atlas: Pont };
    const m = await (await fetch('/assets/sprites/manifeste.json')).json() as Manifeste;
    const e = m.entrees[o.entree];
    if (!e) throw new Error(`entrée absente : ${o.entree}`);
    const anim = e.animations.find((a) => a.vue === o.vue && a.clip === o.clip);
    if (!anim) throw new Error(`animation absente : ${o.entree} ${o.vue}/${o.clip}`);
    const pageSprite = e.pages[anim.cadres[0]!.page]!;
    const lireImage = async (chemin: string | undefined): Promise<ImageData | null> => {
      if (!chemin) return null;
      const blob = await (await fetch(`/${chemin}`)).blob();
      const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(bmp, 0, 0);
      return g.getImageData(0, 0, c.width, c.height);
    };
    const [couleur, masque, emission] = await Promise.all([
      lireImage(pageSprite.couleur), lireImage(pageSprite.masque), lireImage(pageSprite.emission),
    ]);
    if (!couleur) throw new Error('page illisible');
    // La capture : la toile telle que la peau vient de la dessiner.
    const url = w.__atlas.capturer();
    if (!url) throw new Error('capture impossible');
    const img = new Image();
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = url; });
    const cc = document.createElement('canvas');
    cc.width = img.naturalWidth;
    cc.height = img.naturalHeight;
    const gc = cc.getContext('2d', { willReadFrequently: true })!;
    gc.drawImage(img, 0, 0);
    const capture = gc.getImageData(0, 0, cc.width, cc.height);
    const toile = document.querySelector('canvas.atlas-toile')!.getBoundingClientRect();
    const k = capture.width / toile.width;
    const p0 = w.__atlas.positionCase(o.x, o.y)!;
    const p1 = w.__atlas.positionCase(o.x + 1, o.y)!;
    const zoom = (p1.x - p0.x) / 128;
    const empreinte = 1 / (zoom * k);
    const pixel =(d: ImageData, x: number, y: number, c: number): number => d.data[(y * d.width + x) * 4 + c]!;
    const equipe = o.equipe;
    const voile = o.voile ?? null;
    const poidsEmission = o.emission ?? 0;

    let meilleur: Comparaison | null = null as Comparaison | null;
    for (let index = 0; index < anim.cadres.length; index++) {
      const cadre = anim.cadres[index]!;
      const ecarts: number[] = [];
      let nEquipe = 0; let ecartTeinte = 0; let blancPur = 0; let maxCanal = 0;
      const partsFenetres: number[] = [];
      // La boîte de l'image à l'écran, en pixels de capture.
      const gauche = o.miroir ? p0.x - (cadre.l - cadre.px) * zoom : p0.x - cadre.px * zoom;
      const haut = p0.y - cadre.py * zoom;
      const x0 = Math.max(0, Math.floor(gauche * k));
      const y0 = Math.max(0, Math.floor(haut * k));
      const x1 = Math.min(capture.width - 1, Math.ceil((gauche + cadre.l * zoom) * k));
      const y1 = Math.min(capture.height - 1, Math.ceil((haut + cadre.h * zoom) * k));
      for (let sy = y0; sy <= y1; sy++) {
        for (let sx = x0; sx <= x1; sx++) {
          // Le centre du pixel de capture, ramené dans l'image.
          const dX = ((sx + 0.5) / k - p0.x) / zoom;
          const dY = ((sy + 0.5) / k - p0.y) / zoom;
          const u = o.miroir ? cadre.px - dX : cadre.px + dX;
          const v = cadre.py + dY;
          const ua = Math.floor(u - empreinte / 2);
          const ub = Math.ceil(u + empreinte / 2);
          const va = Math.floor(v - empreinte / 2);
          const vb = Math.ceil(v + empreinte / 2);
          if (ua < 0 || va < 0 || ub > cadre.l || vb > cadre.h) continue;
          let n = 0; let opaque = true;
          const somme = [0, 0, 0]; const brut = [0, 0, 0]; const em = [0, 0, 0]; let mq = 0;
          for (let iy = va; iy < vb && opaque; iy++) {
            for (let ix = ua; ix < ub; ix++) {
              const gx = cadre.x + ix;
              const gy = cadre.y + iy;
              if (pixel(couleur, gx, gy, 3) < 255) { opaque = false; break; }
              const mv = masque ? pixel(masque, gx, gy, 0) / 255 : 0;
              for (let c = 0; c < 3; c++) {
                const t = pixel(couleur, gx, gy, c);
                brut[c]! += t;
                somme[c]! += t * (equipe ? 1 + (equipe[c]! - 1) * mv : 1);
                if (emission) em[c]! += pixel(emission, gx, gy, c);
              }
              mq += mv;
              n += 1;
            }
          }
          if (!opaque || n === 0) continue;
          const rendu = [0, 1, 2].map((c) => capture.data[(sy * capture.width + sx) * 4 + c]!);
          const base = somme.map((s) => s / n);
          const voilee = voile ? base.map((b, c) => b * (1 - voile[3]!) + voile[c]! * 255 * voile[3]!) : base;
          const lumiere = em.map((s) => s / n);
          const attendu = voilee.map((b, c) => Math.min(255, b + poidsEmission * lumiere[c]!));
          ecarts.push(Math.max(...attendu.map((a, c) => Math.abs(a - rendu[c]!))));
          // Une zone d'équipe pleine, cuite en blanc : ce qu'elle rend dit la couleur d'équipe.
          const brute = brut.map((s) => s / n);
          if (mq / n >= 0.97 && Math.min(...brute) >= 150 && Math.max(...brute) - Math.min(...brute) <= 16 && equipe) {
            nEquipe += 1;
            const lum = brute[0]! / 255;
            ecartTeinte = Math.max(ecartTeinte, ...rendu.map((r, c) => Math.abs(r - lum * equipe[c]! * 255)));
            if (Math.min(...brute) >= 240 && Math.min(...rendu) >= 250) blancPur += 1;
            maxCanal = Math.max(maxCanal, ...rendu);
          }
          if (emission && Math.max(...lumiere) >= 90) {
            const part = Math.max(...[0, 1, 2].map((c) => (rendu[c]! - voilee[c]!) / Math.max(1, lumiere[c]!)));
            partsFenetres.push(part);
          }
        }
      }
      ecarts.sort((a, b) => a - b);
      partsFenetres.sort((a, b) => a - b);
      const c: Comparaison = {
        entree: o.entree, interieurs: ecarts.length, cadre: index,
        mediane: ecarts[Math.floor(ecarts.length / 2)] ?? 999,
        decile8: ecarts[Math.floor(ecarts.length * 0.8)] ?? 999,
        equipe: { n: nEquipe, ecartTeinte, blancPur, maxCanal },
        ...(emission ? { fenetres: { n: partsFenetres.length, partMediane: partsFenetres[Math.floor(partsFenetres.length / 2)] ?? 0 } } : {}),
      };
      if (!meilleur || c.mediane < meilleur.mediane) meilleur = c;
    }
    if (!meilleur) throw new Error(`aucun cadre : ${o.entree}`);
    return meilleur;
  }, o);
}

async function positionCase(page: Page, x: number, y: number): Promise<{ x: number; y: number } | null> {
  return page.evaluate(([cx, cy]) => (window as unknown as { __atlas?: Pont }).__atlas?.positionCase(cx, cy) ?? null, [x, y] as [number, number]);
}

/** La case se projette au même point deux fois de suite : le cadrage d'ouverture s'est posé. */
async function attendreCadrage(page: Page, x: number, y: number): Promise<void> {
  let avant = await positionCase(page, x, y);
  await expect.poll(async () => {
    await page.waitForTimeout(250);
    const maintenant = await positionCase(page, x, y);
    const stable = avant !== null && maintenant !== null
      && Math.abs(avant.x - maintenant.x) < 0.01 && Math.abs(avant.y - maintenant.y) < 0.01;
    avant = maintenant;
    return stable;
  }, { timeout: 60_000 }).toBe(true);
}

const mesurer = (page: Page) => page.evaluate(() => (window as unknown as { __atlas?: Pont }).__atlas?.mesurer() ?? null);

test('premier_contact : les pages des seules entrées présentes, chaque image cuite à son pivot, teintée, et jamais un repli', async ({ page }) => {
  test.skip(!existsSync(CHEMIN_MANIFESTE), 'aucune image cuite livrée');
  const manifeste = JSON.parse(readFileSync(CHEMIN_MANIFESTE, 'utf8')) as Manifeste;
  // Chaque fichier de page, rendu à son entrée.
  const entreeDuFichier = new Map<string, string>();
  for (const [id, e] of Object.entries(manifeste.entrees)) {
    for (const p of e.pages) for (const f of [p.couleur, p.masque, p.emission]) if (f) entreeDuFichier.set(`/${f}`, id);
  }
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(`page : ${String(e)}`));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(`console : ${m.text()}`); });
  const telecharges = new Set<string>();
  page.on('response', (r) => {
    const chemin = new URL(r.url()).pathname;
    if (!chemin.startsWith('/assets/sprites/') || chemin.endsWith('manifeste.json') || !r.ok()) return;
    telecharges.add(chemin);
  });
  // Une page de jeu en développement charge des centaines de morceaux : on
  // agrandit le registre des ressources, sans quoi les images en sortiraient.
  await page.addInitScript(() => performance.setResourceTimingBufferSize(5000));

  await page.goto('/jeu/premier_contact?rendu=2d');
  const toile = page.locator('canvas.atlas-toile');
  await expect(toile).toBeVisible({ timeout: 180_000 });
  await expect(toile).toHaveAttribute('data-rendu', '2d');
  const scene = page.locator('.atlas-scene');
  if (await scene.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true, () => false)) {
    await scene.getByRole('button', { name: /Passer/ }).click();
    await expect(scene).toBeHidden();
  }
  await attendreCadrage(page, 0, 9);
  // Tout est arrivé : plus rien en route, et plus un repli d'une entrée connue.
  await expect.poll(async () => {
    const i = (await mesurer(page))?.images;
    return i ? i.pages > 0 && i.enVol === 0 && i.replisAvecEntree === 0 && i.cuites > 0 : false;
  }, { timeout: 120_000 }).toBe(true);
  const images = (await mesurer(page))!.images!;
  expect(images.echecs, 'aucune page introuvable').toBe(0);
  // Ce que la partie a coûté en images, avant qu'on force une autre saison :
  // les octets sur le disque des fichiers demandés, et ceux que le navigateur a
  // reçus (Resource Timing).
  const surDisque = [...telecharges].reduce((n, chemin) => n + statSync(path.join(RACINE, 'public', chemin)).size, 0);
  const recus = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter((e) => { const c = new URL(e.name).pathname; return c.startsWith('/assets/sprites/') && !c.endsWith('manifeste.json'); })
    .reduce((n, e) => n + ((e as PerformanceResourceTiming).encodedBodySize || 0), 0));
  const chargement = { fichiers: telecharges.size, octetsSurDisque: surDisque, octetsRecus: recus, pages: images.pages, textures: images.textures, octetsGpu: images.octetsGpu, replis: images.replis };

  // --- Le réseau : les pages des entrées présentes, et elles seules.
  const presentes = new Set(['unite_infanterie_base', 'unite_char_leger_base', 'unite_recon_base', 'batiment_qg_fr', 'batiment_qg_base', 'terrain_pont']);
  const decorDeLaPlaine = /^decor_(feuillu|conifere|buisson|touffe|roseau)_/;
  const demandees = new Set<string>();
  for (const chemin of telecharges.keys()) {
    const id = entreeDuFichier.get(chemin);
    expect(id, `${chemin} n’est la page d’aucune entrée`).toBeTruthy();
    demandees.add(id!);
  }
  for (const id of demandees) {
    expect(presentes.has(id) || decorDeLaPlaine.test(id), `${id} n’a rien à faire sur premier_contact`).toBe(true);
  }
  for (const id of presentes) expect(demandees.has(id), `${id} est sur la carte : sa page est demandée`).toBe(true);
  expect(demandees.size).toBeLessThan(Object.keys(manifeste.entrees).length);
  expect(images.pages).toBe(demandees.size);

  // --- Les images, pixel par pixel : trois unités par camp, les deux QG.
  const FR = [0x2f / 255, 0x5f / 255, 0xd0 / 255];
  const LU = [0x3a / 255, 0xa0 / 255, 0xc8 / 255];
  const NEUTRE = [0xb9 / 255, 0xbe / 255, 0xc7 / 255];
  const figurines = [
    { entree: 'unite_infanterie_base', x: 1, y: 2, equipe: FR, miroir: false },
    { entree: 'unite_infanterie_base', x: 1, y: 4, equipe: FR, miroir: false },
    { entree: 'unite_char_leger_base', x: 2, y: 3, equipe: FR, miroir: false },
    { entree: 'unite_infanterie_base', x: 8, y: 2, equipe: LU, miroir: true },
    { entree: 'unite_infanterie_base', x: 9, y: 5, equipe: LU, miroir: true },
    { entree: 'unite_recon_base', x: 10, y: 3, equipe: LU, miroir: true },
  ];
  const releves: Comparaison[] = [];
  for (const f of figurines) {
    const c = await comparer(page, { ...f, vue: 'droite', clip: 'repos' });
    releves.push(c);
    const nom = `${f.entree} en ${f.x},${f.y}`;
    expect(c.interieurs, `${nom} : l’image cuite couvre son pivot`).toBeGreaterThan(40);
    expect(c.mediane, `${nom} : les pixels sont ceux de la page (écart médian ${c.mediane})`).toBeLessThanOrEqual(12);
    expect(c.decile8, `${nom} : 8e décile ${c.decile8}`).toBeLessThanOrEqual(32);
    // La teinte d'équipe sur les zones masquées : la couleur de la nation, éclairée.
    expect(c.equipe.n, `${nom} : des zones d’équipe`).toBeGreaterThan(2);
    expect(c.equipe.ecartTeinte, `${nom} : la couleur d’équipe (écart ${c.equipe.ecartTeinte})`).toBeLessThanOrEqual(40);
  }
  // Et le contraire : la même image, retournée, ne colle pas — la comparaison discrimine.
  const retournee = await comparer(page, { ...figurines[2]!, miroir: true, vue: 'droite', clip: 'repos' });
  expect(retournee.mediane, `témoin : l’image retournée s’écarte (${retournee.mediane})`).toBeGreaterThan(20);

  const qgFr = await comparer(page, { entree: 'batiment_qg_fr', vue: 'fixe', clip: 'repos', x: 0, y: 3, miroir: false, equipe: FR, emission: 0.06 });
  const qgNeutre = await comparer(page, { entree: 'batiment_qg_base', vue: 'fixe', clip: 'repos', x: 0, y: 9, miroir: false, equipe: NEUTRE });
  releves.push(qgFr, qgNeutre);
  for (const c of [qgFr, qgNeutre]) {
    expect(c.interieurs, `${c.entree} : l’image cuite est posée`).toBeGreaterThan(100);
    // Le mât, le drapeau et un buisson voisin passent devant une part du bâtiment : la médiane le tolère.
    expect(c.mediane, `${c.entree} : écart médian ${c.mediane}`).toBeLessThanOrEqual(12);
  }
  // Le QG neutre : ses zones d'équipe pleines prennent le gris, jamais le blanc pur.
  expect(qgNeutre.equipe.n, 'le QG neutre a des zones d’équipe pleines et claires').toBeGreaterThan(2);
  expect(qgNeutre.equipe.blancPur, 'aucun blanc pur là où le masque est plein').toBe(0);
  expect(qgNeutre.equipe.maxCanal, 'au plus le gris neutre éclairé').toBeLessThanOrEqual(0xc7 + 12);
  expect(qgNeutre.equipe.ecartTeinte, 'le gris neutre, éclairé').toBeLessThanOrEqual(24);
  expect(qgFr.equipe.ecartTeinte, 'le QG français, en bleu de France').toBeLessThanOrEqual(40);

  // --- La nuit : le monde se voile, les fenêtres du QG français s'allument par-dessus.
  await page.evaluate(() => (window as unknown as { __atlas: Pont }).__atlas.forcerAmbiance('ete', 'nuit', 'clair'));
  await page.waitForTimeout(300);
  const VOILE_NUIT = [0x0d / 255, 0x1a / 255, 0x3a / 255, 0.32];
  const nuit = await comparer(page, {
    entree: 'batiment_qg_fr', vue: 'fixe', clip: 'repos', x: 0, y: 3, miroir: false, equipe: FR, voile: VOILE_NUIT, emission: 1,
  });
  expect(nuit.mediane, `la nuit, le QG voilé et éclairé comme le calcule le nuanceur (écart ${nuit.mediane})`).toBeLessThanOrEqual(14);
  expect(nuit.fenetres?.n ?? 0, 'des fenêtres').toBeGreaterThan(3);
  expect(nuit.fenetres?.partMediane ?? 0, 'les fenêtres s’ajoutent pleinement, par-dessus le voile').toBeGreaterThan(0.6);
  const figurineNuit = await comparer(page, { ...figurines[2]!, vue: 'droite', clip: 'repos', voile: VOILE_NUIT });
  expect(figurineNuit.mediane, `une figurine la nuit : le voile exact (écart ${figurineNuit.mediane})`).toBeLessThanOrEqual(12);
  expect((await mesurer(page))?.images?.replisAvecEntree).toBe(0);

  // --- Les mesures, pour le document : octets, pages, mémoire, coût d'une image.
  await page.evaluate(() => (window as unknown as { __atlas: Pont }).__atlas.forcerAmbiance(null));
  await page.waitForTimeout(3_000);
  const mesure = (await mesurer(page))!;
  const releve = {
    chargement,
    apresNuitEte: { pages: mesure.images!.pages, octetsGpu: mesure.images!.octetsGpu, textures: mesure.images!.textures },
    instances: mesure.instances,
    appels: mesure.appels,
    msParImage: Number(mesure.msParImage.toFixed(3)),
    entrees: [...demandees].sort(),
    ecarts: releves.map((c) => `${c.entree}:${c.mediane.toFixed(1)}/${c.decile8.toFixed(1)}`),
    equipe: releves.map((c) => `${c.entree}:n=${c.equipe.n},écart=${c.equipe.ecartTeinte.toFixed(1)},max=${c.equipe.maxCanal}`),
    nuit: { qgFr: { mediane: nuit.mediane, fenetres: nuit.fenetres }, figurine: figurineNuit.mediane },
    temoinRetournee: retournee.mediane,
  };
  test.info().annotations.push({ type: 'mesures', description: JSON.stringify(releve) });
  console.log(`[images-cuites] ${JSON.stringify(releve)}`);
  expect(erreurs, 'aucune erreur de console').toEqual([]);
});
