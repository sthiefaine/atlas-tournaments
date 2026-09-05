/** Progression de la qualification locale : aucune autorité sur un classement en ligne. */
export interface Progression {
  version: 1;
  victoires: string[];
}
const CLE = 'atlas:qualification:v1';
let session: Progression = { version: 1, victoires: [] };

export function normaliserProgression(brut: unknown): Progression {
  if (!brut || typeof brut !== 'object') return { version: 1, victoires: [] };
  const p = brut as Partial<Progression>;
  if (p.version !== 1 || !Array.isArray(p.victoires)) return { version: 1, victoires: [] };
  return { version: 1, victoires: [...new Set(p.victoires.filter((x): x is string => typeof x === 'string' && /^[a-z][a-z0-9_]{1,47}$/.test(x)))] };
}

export function lireProgression(): Progression {
  try {
    const texte = localStorage.getItem(CLE);
    if (texte) session = normaliserProgression(JSON.parse(texte));
  } catch { /* Le carnet reste utilisable en mémoire si le stockage est refusé. */ }
  return session;
}

export function enregistrerVictoire(code: string): boolean {
  session = normaliserProgression({ version: 1, victoires: [...lireProgression().victoires, code] });
  try { localStorage.setItem(CLE, JSON.stringify(session)); return true; }
  catch { return false; }
}

export function missionOuverte(codes: readonly string[], code: string, progression: Progression): boolean {
  const index = codes.indexOf(code);
  return index === 0 || (index > 0 && progression.victoires.includes(codes[index - 1]!));
}
