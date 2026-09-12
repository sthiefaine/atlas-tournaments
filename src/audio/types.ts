export type Son = 'pas' | 'chenilles' | 'rotor' | 'sillage' | 'moteur' | 'parole' | 'vent' | 'pluie' | 'insectes' | 'vagues' | 'rafale' | 'canon' | 'missile' | 'impact' | 'hors_jeu' | 'capture' | 'production' | 'pouvoir';
export interface SortieAudio { jouer(son: Son): void; annuler(): void; environnement?(son: Son): void }
export function volumeNormalise(v: unknown): number { return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : .45; }
