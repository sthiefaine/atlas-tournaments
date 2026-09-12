import { readFileSync } from 'node:fs';
import path from 'node:path';
/** Instantané de présence locale ; jamais une preuve de conformité ou de revue. */
export function candidatsLocaux(): Set<string> {
  try {
    const donnees = JSON.parse(readFileSync(path.resolve('assets/production/candidats.json'), 'utf8')) as { assets: { id: string }[] };
    return new Set(donnees.assets.map(a => a.id));
  } catch { return new Set(); }
}

export const PREFIXE_CANDIDATS = '/assets/candidats' as const;
export interface CandidatExpose { id: string; fichiers: string[]; revision: string; prefixe: typeof PREFIXE_CANDIDATS }
/** Le manifeste ne peut introduire ni chemin relatif ni URL externe dans l’inspecteur. */
export function lireExposition(valeur: unknown): Map<string, CandidatExpose> {
  const resultat = new Map<string, CandidatExpose>();
  if (!valeur || typeof valeur !== 'object') return resultat;
  const source = valeur as { version?: unknown; prefixe?: unknown; assets?: unknown };
  if (source.version !== 1 || source.prefixe !== PREFIXE_CANDIDATS || !Array.isArray(source.assets)) return resultat;
  for (const element of source.assets) {
    if (!element || typeof element !== 'object') continue;
    const a = element as {id?:unknown;fichiers?:unknown;revision?:unknown};
    if (typeof a.id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(a.id) || typeof a.revision !== 'string' || !/^[a-f0-9]{64}$/.test(a.revision) || !Array.isArray(a.fichiers)) continue;
    const motif = new RegExp(`^${a.id}_(?:lod0\\.glb|[a-z0-9_]+\\.png)$`);
    if (!a.fichiers.every((n): n is string => typeof n === 'string' && motif.test(n)) || !a.fichiers.includes(`${a.id}_lod0.glb`)) continue;
    resultat.set(a.id, {id:a.id, fichiers:[...new Set(a.fichiers)], revision:a.revision, prefixe:PREFIXE_CANDIDATS});
  }
  return resultat;
}
export function candidatsExposes(): Map<string, CandidatExpose> {
  try { return lireExposition(JSON.parse(readFileSync(path.resolve('assets/production/exposition.json'), 'utf8'))); }
  catch { return new Map(); }
}
export function lireCandidatExpose(id: string): CandidatExpose | null {
  return candidatsExposes().get(id) ?? null;
}
