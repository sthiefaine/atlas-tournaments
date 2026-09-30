import type { PageSprite } from './contrat';
import type { Rvb } from './equipes';

/** Même sélection de peinture que le fragment WebGL de lot.ts, pour le carnet. */
export function teindreDessin(pixels: Uint8ClampedArray, equipe: Rvb | null, peinture: PageSprite['peinture']): Uint8ClampedArray {
  const sortie = new Uint8ClampedArray(pixels);
  if (!equipe || !peinture) return sortie;
  const lisse = (a: number, b: number, x: number): number => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const diviseur = Math.max(0.65, ...equipe);
  for (let i = 0; i < pixels.length; i += 4) {
    if (!pixels[i + 3]) continue;
    const r = pixels[i]! / 255, g = pixels[i + 1]! / 255, b = pixels[i + 2]! / 255;
    const poids = peinture === 'cobalt'
      ? lisse(0.05, 0.18, b - r) * lisse(0.025, 0.13, b - g) * lisse(0.18, 0.38, b)
      : lisse(0.15, 0.35, r - b) * lisse(0.07, 0.2, g - b) * lisse(0.5, 0.75, r);
    const valeur = Math.max(r, g, b);
    for (let k = 0; k < 3; k++) sortie[i + k] = pixels[i + k]! * (1 - poids) + 255 * equipe[k]! * valeur / diviseur * poids;
  }
  return sortie;
}
