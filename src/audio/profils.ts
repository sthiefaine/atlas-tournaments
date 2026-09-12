import type { TypeMouvement } from '../schemas/types';
import type { Son } from './types';
export function sonDeplacement(type?: TypeMouvement): Son {
  switch (type) {
    case 'pied': case 'bottes': return 'pas';
    case 'chenilles': return 'chenilles';
    case 'air': return 'rotor';
    case 'mer': case 'amphibie': return 'sillage';
    default: return 'moteur';
  }
}
export function sonEnvironnement(meteo: string, phase: string, biome: string): Son {
  if (meteo === 'pluie' || meteo === 'tempete') return 'pluie';
  if (phase === 'nuit') return 'insectes';
  if (/cotier|archipel|littoral|ile|ocean/.test(biome)) return 'vagues';
  return 'vent';
}
