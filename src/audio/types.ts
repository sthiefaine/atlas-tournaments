export type Son = 'rafale' | 'canon' | 'missile' | 'impact' | 'hors_jeu' | 'capture' | 'production' | 'pouvoir';
export interface SortieAudio { jouer(son: Son): void; annuler(): void }
export function volumeNormalise(v: unknown): number { return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : .45; }
