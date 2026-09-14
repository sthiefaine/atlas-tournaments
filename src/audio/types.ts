export type Son = 'pas' | 'chenilles' | 'rotor' | 'sillage' | 'moteur' | 'parole' | 'vent' | 'pluie' | 'insectes' | 'vagues' | 'rafale' | 'canon' | 'missile' | 'impact' | 'hors_jeu' | 'capture' | 'production' | 'pouvoir';
export interface SortieAudio { jouer(son: Son): void; annuler(): void; environnement?(son: Son): void }
export function volumeNormalise(v: unknown): number { return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : .45; }

export interface MixageAudio { ambiance: number; effets: number; dialogues: number }
export const MIXAGE_PAR_DEFAUT: Readonly<MixageAudio> = { ambiance: .5, effets: 1, dialogues: .65 };
export function normaliserMixage(m: Partial<MixageAudio> = {}): MixageAudio {
  const lire = (cle: keyof MixageAudio) => typeof m[cle] === 'number' && Number.isFinite(m[cle]) ? volumeNormalise(m[cle]) : MIXAGE_PAR_DEFAUT[cle];
  return { ambiance: lire('ambiance'), effets: lire('effets'), dialogues: lire('dialogues') };
}
