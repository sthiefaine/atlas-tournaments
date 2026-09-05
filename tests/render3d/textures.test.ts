import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BIOMES } from '../../src/schemas/types';
import { albedoMatiere, normalesDepuis } from '../../src/render3d/textures';
import { creerPlateau } from '../../src/render3d/terrain';
import { parametresAmbiance } from '../../src/render3d/eclairage';

/** Toile mémoire : les recettes restent vérifiables sans navigateur/WebGL. */
function documentMemoire(): Document {
  return {
    createElement: () => {
      const canvas = {
        width: 0, height: 0, pixels: new Uint8ClampedArray() as Uint8ClampedArray,
        getContext: () => ({
          createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          putImageData: (image: { data: Uint8ClampedArray }) => { canvas.pixels = image.data; },
        }),
      };
      return canvas;
    },
  } as unknown as Document;
}

function pixels(canvas: HTMLCanvasElement): Uint8ClampedArray {
  return (canvas as unknown as { pixels: Uint8ClampedArray }).pixels;
}

test('chaque biome possède une palette végétale distincte et reproductible', () => {
  const doc = documentMemoire();
  const palettes = BIOMES.map((biome) => {
    const a = albedoMatiere(doc, 'herbe', 32, biome);
    const b = albedoMatiere(doc, 'herbe', 32, biome);
    assert.deepEqual(pixels(a.canvas), pixels(b.canvas));
    assert.deepEqual(a.hauteur, b.hauteur);
    assert.ok(a.hauteur.every(Number.isFinite));
    return pixels(a.canvas).join(',');
  });
  assert.equal(new Set(palettes).size, BIOMES.length);
});

test('les normales produites restent valides, y compris sur les frontières répétées', () => {
  const doc = documentMemoire();
  for (const matiere of ['herbe', 'terre', 'roche', 'sable', 'neige'] as const) {
    const a = albedoMatiere(doc, matiere, 32);
    const normal = pixels(normalesDepuis(doc, a.hauteur, 32));
    for (let i = 0; i < normal.length; i += 4) {
      assert.equal(normal[i + 3], 255);
      assert.ok(normal[i + 2]! >= 128, 'la normale pointe au-dessus du terrain');
    }
  }
});

test('le plateau de chaque biome accepte les saisons et libère ses ressources', () => {
  const doc = documentMemoire();
  for (const biome of BIOMES) {
    const plateau = creerPlateau({ largeur: 2, hauteur: 2, terrainDe: (x) => x === 0 ? 'plage' : 'mer' }, doc, biome);
    plateau.appliquerAmbiance(parametresAmbiance('hiver', 'nuit', 'neige'));
    assert.equal(plateau.avancer(16), false);
    let texturesLiberees = 0;
    const material = plateau.sol.material as THREE.MeshStandardMaterial;
    material.map?.addEventListener('dispose', () => { texturesLiberees += 1; });
    plateau.dispose();
    assert.equal(texturesLiberees, 1);
  }
});
