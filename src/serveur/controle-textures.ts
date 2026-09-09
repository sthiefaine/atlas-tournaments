import { createHash } from 'node:crypto';
import { lirePng, type PixelsPng } from '../assets/png';
import { contratProduction } from '../assets/production';
import { nomTexture, type AssetSpec, type MotifAsset } from '../assets/spec';

/** Cache privé et borné de décodage, jamais de verdict : les contraintes sont revérifiées à chaque lot. */
const LIMITE_PIXELS_MEMO = 64 * 1024 * 1024;
const pixelsMemo = new Map<string, PixelsPng>();
let taillePixelsMemo = 0;
function lirePixelsControles(octets: Uint8Array): PixelsPng {
  const cle = createHash('sha256').update(octets).digest('hex');
  const connu = pixelsMemo.get(cle);
  if (connu) { pixelsMemo.delete(cle); pixelsMemo.set(cle, connu); return connu; }
  const pixels = lirePng(octets);
  while (taillePixelsMemo + pixels.rgba.byteLength > LIMITE_PIXELS_MEMO && pixelsMemo.size) {
    const ancien = pixelsMemo.keys().next().value!;
    taillePixelsMemo -= pixelsMemo.get(ancien)!.rgba.byteLength;
    pixelsMemo.delete(ancien);
  }
  if (pixels.rgba.byteLength <= LIMITE_PIXELS_MEMO) {
    pixelsMemo.set(cle, pixels); taillePixelsMemo += pixels.rgba.byteLength;
  }
  return pixels;
}

/** Le masque se contrôle dans l'espace image : aucun rendu ou éclairage implicite. */
export function controlerTextures(spec: AssetSpec, fichiers: ReadonlyMap<string, Uint8Array>): MotifAsset[] {
  const motifs: MotifAsset[] = [], cartes = new Map<string, PixelsPng>();
  for (const t of spec.textures) for (const saison of [undefined, ...spec.variantes.saisons]) {
    const nom = nomTexture(spec, t.canal, saison), b = fichiers.get(nom);
    // Les variantes se livrent progressivement ; le jeu de base obligatoire reste complet.
    if (!b) { if (t.obligatoire && saison === undefined) motifs.push({ code: 'asset_texture_absente', detail: `${nom} : carte obligatoire absente` }); continue; }
    try {
      const p = lirePixelsControles(b); cartes.set(nom, p);
      if (p.largeur !== t.resolution || p.hauteur !== t.resolution) throw new Error(`résolution ${p.largeur}×${p.hauteur}, attendue ${t.resolution}×${t.resolution}`);
      if (t.canal === 'masque_equipe') {
        let blanc = 0;
        for (let i = 0; i < p.rgba.length; i += 4) {
          const v = p.rgba[i];
          if ((v !== 0 && v !== 255) || p.rgba[i + 1] !== v || p.rgba[i + 2] !== v || p.rgba[i + 3] !== 255) throw new Error('masque non binaire ou transparent');
          if (v === 255) blanc++;
        }
        if (!blanc || blanc === p.largeur * p.hauteur) throw new Error('masque entièrement noir ou blanc');
      }
      if (contratProduction(spec).raccord === 'quart_tour') {
        const n = p.largeur;
        const pixel = (x: number, y: number, k: number): number[] => {
          for (let r = 0; r < k; r++) [x, y] = [n - 1 - y, x];
          const i = (y * n + x) * 4;
          if (t.canal !== 'normale') return [...p.rgba.subarray(i, i + 4)];
          let nx = p.rgba[i]! - 128, ny = p.rgba[i + 1]! - 128;
          for (let r = 0; r < k; r++) [nx, ny] = [-ny, nx];
          return [nx, ny, p.rgba[i + 2]!, p.rgba[i + 3]!];
        };
        for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let j = 0; j < n; j++) {
          for (const [c, d] of [[pixel(n - 1, j, a), pixel(0, j, b)], [pixel(j, n - 1, a), pixel(j, 0, b)]])
            if (c!.some((v, i) => Math.abs(v - d![i]!) > (t.canal === 'normale' ? 1 : 0))) throw new Error('raccord de bord discontinu sous un quart de tour');
        }
      }
    } catch (e) { motifs.push({ code: 'asset_format', detail: `${nom} : ${e instanceof Error ? e.message : String(e)}` }); }
  }
  for (const saison of [undefined, ...spec.variantes.saisons]) {
    const nom = nomTexture(spec, 'masque_equipe', saison), masque = cartes.get(nom), albedo = cartes.get(nomTexture(spec, 'albedo', saison));
    if (!masque || !albedo) continue;
    let mauvais = false;
    for (let y = 0; y < albedo.hauteur && !mauvais; y++) for (let x = 0; x < albedo.largeur; x++) {
      const m = (Math.floor(y * masque.hauteur / albedo.hauteur) * masque.largeur + Math.floor(x * masque.largeur / albedo.largeur)) * 4;
      if (masque.rgba[m] !== 255) continue;
      const i = (y * albedo.largeur + x) * 4, rgb = [...albedo.rgba.subarray(i, i + 3)];
      // Quatre niveaux couvrent les arrondis d'encodage des anciens gris neutres.
      if (Math.max(...rgb) - Math.min(...rgb) > 4) { mauvais = true; break; }
    }
    if (mauvais) motifs.push({ code: 'asset_format', detail: `${nom} : albédo coloré dans une zone blanche (écart RGB > 4/255)` });
  }
  return motifs;
}
