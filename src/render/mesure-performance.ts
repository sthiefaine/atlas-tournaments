/** Cadence effectivement dessinée, distincte des pauses volontaires de la carte. */
export type PhaseMesure = 'repos' | 'action' | 'combat';
export interface ImageMesuree {
  instant: number;
  cpuMs: number;
  phase: PhaseMesure;
  triangles: number;
  appels: number;
}
interface Echantillons { images: number; intervalles: number[]; cpu: number[]; trianglesMax: number; appelsMax: number }
export interface BilanPhase {
  images: number; intervalles: number; secondesObservees: number;
  fpsMoyens: number | null; intervalleP50Ms: number | null; intervalleP95Ms: number | null;
  pausesPlus50Ms: number; pausesPlus100Ms: number; pauseMaxMs: number | null;
  cpuP95Ms: number | null; cpuMaxMs: number | null; trianglesMax: number; appelsMax: number;
}
const arrondi = (n: number) => Math.round(n * 100) / 100;
function percentile(nombres: number[], proportion: number): number | null {
  if (!nombres.length) return null;
  const tries = [...nombres].sort((a, b) => a - b);
  return arrondi(tries[Math.max(0, Math.ceil(tries.length * proportion) - 1)]!);
}
export function creerRelevePerformance() {
  const neuf = (): Echantillons => ({ images: 0, intervalles: [], cpu: [], trianglesMax: 0, appelsMax: 0 });
  const phases: Record<PhaseMesure, Echantillons> = { repos: neuf(), action: neuf(), combat: neuf() };
  let precedente: ImageMesuree | null = null;
  let limiteAtteinte = false;
  return {
    interrompre() { precedente = null; },
    image(image: ImageMesuree) {
      const e = phases[image.phase];
      // Trois minutes à 120 Hz : mémoire bornée même si l'hôte oublie d'arrêter.
      if (e.images >= 21600) { limiteAtteinte = true; precedente = null; return; }
      if (precedente?.phase === image.phase) {
        const ms = image.instant - precedente.instant;
        if (ms > 0) e.intervalles.push(ms);
      }
      precedente = image; e.images++; e.cpu.push(image.cpuMs);
      e.trianglesMax = Math.max(e.trianglesMax, image.triangles);
      e.appelsMax = Math.max(e.appelsMax, image.appels);
    },
    bilan(): { phases: Record<PhaseMesure, BilanPhase>; limiteAtteinte: boolean } {
      const bilan = {} as Record<PhaseMesure, BilanPhase>;
      for (const p of ['repos', 'action', 'combat'] as const) {
        const e = phases[p], total = e.intervalles.reduce((s, n) => s + n, 0);
        bilan[p] = {
          images: e.images, intervalles: e.intervalles.length, secondesObservees: arrondi(total / 1000),
          fpsMoyens: total ? arrondi(e.intervalles.length * 1000 / total) : null,
          intervalleP50Ms: percentile(e.intervalles, .5), intervalleP95Ms: percentile(e.intervalles, .95),
          pausesPlus50Ms: e.intervalles.filter(n => n > 50).length, pausesPlus100Ms: e.intervalles.filter(n => n > 100).length,
          pauseMaxMs: percentile(e.intervalles, 1), cpuP95Ms: percentile(e.cpu, .95), cpuMaxMs: percentile(e.cpu, 1),
          trianglesMax: e.trianglesMax, appelsMax: e.appelsMax,
        };
      }
      return { phases: bilan, limiteAtteinte };
    },
  };
}
