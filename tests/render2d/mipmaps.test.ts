// Les niveaux de détail des pages d'atlas : jusqu'où descendre sans qu'une
// silhouette bave sur sa voisine. La réponse n'est pas supposée, elle est
// **mesurée** deux fois : texel par texel, à tout alignement, par une
// simulation du filtrage (boîte pour les niveaux, bilinéaire à la lecture) ;
// puis sur les 101 pages livrées, dont on lit l'écart entre images et la
// transparence de leurs bordures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import {
  ECART_PAGES, ecartSansBavure, Etageres, NIVEAU_MIPMAP_MAX, niveauSansBavure, televerseurWebGl,
} from '../../src/render2d/atlas';
import { COTE_PLANCHE, rangerPlanche } from '../../src/render2d/effets';
import type { ManifesteSprites } from '../../src/render2d/contrat';

/**
 * La plus forte part d'une voisine lue en dessinant une image, au niveau
 * `niveau`, quand `ecart` texels vides séparent le bord de son rectangle du
 * premier pixel de la voisine. Une page d'un seul canal : 1 sur la voisine, 0
 * ailleurs ; les niveaux sont des moyennes de blocs (la page est un multiple
 * de `2^niveau`, comme une page cuite, dont les côtés sont des multiples de
 * quatre) ; la lecture est bilinéaire, bords collés, à tout point strictement
 * dans le rectangle — là où tombent les centres des pixels dessinés.
 */
function bavure(ecart: number, niveau: number): number {
  const bloc = 2 ** niveau;
  const N = 512;
  let pire = 0;
  // Tous les alignements du rectangle sur la grille du niveau, de chaque côté.
  for (let decalage = 0; decalage < 2 * bloc; decalage++) {
    const debut = 100 + decalage;
    const fin = debut + 40; // exclu
    const page = new Float64Array(N);
    for (let i = fin + ecart; i < fin + ecart + 40; i++) page[i] = 1;
    for (let i = debut - ecart - 40; i < debut - ecart; i++) page[i] = 1;
    const n = N / bloc;
    const niv = new Float64Array(n);
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let q = 0; q < bloc; q++) s += page[j * bloc + q]!;
      niv[j] = s / bloc;
    }
    for (let u = debut + 1e-4; u < fin; u += 1 / 64) {
      const s = u / bloc - 0.5;
      const j = Math.floor(s);
      const f = s - j;
      const a = niv[Math.max(0, Math.min(n - 1, j))]!;
      const b = niv[Math.max(0, Math.min(n - 1, j + 1))]!;
      pire = Math.max(pire, (1 - f) * a + f * b);
    }
  }
  return pire;
}

test('la simulation retrouve la formule : l’écart qu’il faut pour protéger chaque niveau', () => {
  for (let k = 0; k <= 5; k++) {
    const e = ecartSansBavure(k);
    assert.equal(bavure(e, k), 0, `niveau ${k} : ${e} texels suffisent`);
    assert.ok(bavure(e - 1, k) > 0, `niveau ${k} : ${e - 1} ne suffisent pas`);
  }
  assert.deepEqual([0, 1, 2, 3, 4].map(ecartSansBavure), [1, 2, 5, 11, 23]);
  assert.equal(niveauSansBavure(5), 2);
  assert.equal(niveauSansBavure(10), 2);
  assert.equal(niveauSansBavure(11), 3);
});

const RACINE = path.resolve(import.meta.dirname, '..', '..');
const CHEMIN_MANIFESTE = path.join(RACINE, 'public', 'assets', 'sprites', 'manifeste.json');

test('sur les pages livrées : cinq texels du bord d’un rectangle à la voisine — le niveau 2, pas le 3', { skip: !existsSync(CHEMIN_MANIFESTE) }, async () => {
  const exiger = createRequire(path.join(RACINE, 'package.json'));
  const sharp = exiger('sharp') as (f: string) => {
    ensureAlpha(): { raw(): { toBuffer(o: { resolveWithObject: true }): Promise<{ data: Buffer; info: { width: number } }> } };
  };
  const m = JSON.parse(readFileSync(CHEMIN_MANIFESTE, 'utf8')) as ManifesteSprites;
  let ecartRectangles = Infinity;
  let alphaBordure = 0;
  let pages = 0;
  for (const e of Object.values(m.entrees)) {
    for (let i = 0; i < e.pages.length; i++) {
      // Des images identiques partagent leur rectangle : on compte les rectangles, pas les cadres.
      const rects = new Map<string, { x: number; y: number; l: number; h: number }>();
      for (const a of e.animations) for (const c of a.cadres) if (c.page === i) rects.set(`${c.x},${c.y},${c.l},${c.h}`, c);
      const liste = [...rects.values()];
      for (let p = 0; p < liste.length; p++) {
        for (let q = p + 1; q < liste.length; q++) {
          const a = liste[p]!;
          const b = liste[q]!;
          const gx = Math.max(b.x - (a.x + a.l), a.x - (b.x + b.l));
          const gy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
          ecartRectangles = Math.min(ecartRectangles, Math.max(gx, gy));
        }
      }
      const { data, info } = await sharp(path.join(RACINE, 'public', e.pages[i]!.couleur)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const alpha = (x: number, y: number) => data[(y * info.width + x) * 4 + 3] ?? 0;
      for (const c of liste) {
        for (let x = c.x; x < c.x + c.l; x++) alphaBordure = Math.max(alphaBordure, alpha(x, c.y), alpha(x, c.y + c.h - 1));
        for (let y = c.y; y < c.y + c.h; y++) alphaBordure = Math.max(alphaBordure, alpha(c.x, y), alpha(c.x + c.l - 1, y));
      }
      pages += 1;
    }
  }
  assert.ok(pages >= 101, `${pages} pages lues`);
  assert.equal(alphaBordure, 0, 'la bordure d’un pixel de chaque image est transparente');
  // Depuis le bord d'un rectangle : l'espacement, plus la bordure transparente de la voisine.
  const ecart = ecartRectangles + 1;
  assert.equal(ecartRectangles, 4);
  assert.equal(niveauSansBavure(ecart), NIVEAU_MIPMAP_MAX, 'le dernier niveau gardé est le plus bas que l’écart protège');
  assert.ok(bavure(ecart, NIVEAU_MIPMAP_MAX + 1) > 0.1, 'un niveau de plus tacherait l’image de sa voisine');
});

test('les pages qu’on range soi-même gardent l’écart du dernier niveau : replis et planche d’effets', () => {
  assert.equal(ECART_PAGES, ecartSansBavure(NIVEAU_MIPMAP_MAX));
  assert.equal(new Etageres(64, 64).marge, ECART_PAGES);
  const places = rangerPlanche();
  assert.ok(places.length > 0);
  for (let i = 0; i < places.length; i++) {
    for (let j = i + 1; j < places.length; j++) {
      const a = places[i]!;
      const b = places[j]!;
      const gx = Math.max(b.x - (a.x + a.dessin.l), a.x - (b.x + b.dessin.l));
      const gy = Math.max(b.y - (a.y + a.dessin.h), a.y - (b.y + b.dessin.h));
      assert.ok(Math.max(gx, gy) >= ECART_PAGES, `${a.dessin.id} et ${b.dessin.id} : ${Math.max(gx, gy)}`);
    }
    assert.ok(places[i]!.x + places[i]!.dessin.l <= COTE_PLANCHE && places[i]!.y + places[i]!.dessin.h <= COTE_PLANCHE);
  }
});

test('le téléverseur borne les niveaux avant de les fabriquer', () => {
  const journal: string[] = [];
  const gl = new Proxy({}, {
    get(_c, nom) {
      if (typeof nom !== 'string') return undefined;
      if (/^[A-Z_0-9]+$/.test(nom)) return nom;
      if (nom === 'createTexture') return () => ({});
      if (nom === 'texParameteri') return (_cible: unknown, p: string, v: unknown) => { journal.push(`${p}=${String(v)}`); };
      if (nom === 'generateMipmap') return () => { journal.push('generateMipmap'); };
      return () => undefined;
    },
  }) as unknown as WebGL2RenderingContext;
  const t = televerseurWebGl(gl);
  t.creer(null, 256, 256, { premultiplier: true });
  const max = journal.indexOf(`TEXTURE_MAX_LEVEL=${NIVEAU_MIPMAP_MAX}`);
  const fabrique = journal.indexOf('generateMipmap');
  assert.ok(max >= 0, journal.join(' '));
  assert.ok(journal.includes('TEXTURE_BASE_LEVEL=0'));
  assert.ok(fabrique > max, 'posé avant generateMipmap, qui s’arrête alors à ce niveau');
});
