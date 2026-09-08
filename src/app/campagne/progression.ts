/** Progression de la qualification locale : aucune autorité sur un classement en ligne. */
import { cleProgression, profilActif, type Profil } from '../preferences';

export interface Progression {
  version: 1;
  victoires: string[];
}
const vide = (): Progression => ({ version: 1, victoires: [] });

// La mémoire de session ne vaut que pour **un** profil : basculer de A à B
// doit rendre la progression de B, même quand le stockage refuse de répondre.
let session: Progression = vide();
let sessionProfil: Profil | null = null;

export function normaliserProgression(brut: unknown): Progression {
  if (!brut || typeof brut !== 'object') return vide();
  const p = brut as Partial<Progression>;
  if (p.version !== 1 || !Array.isArray(p.victoires)) return vide();
  return { version: 1, victoires: [...new Set(p.victoires.filter((x): x is string => typeof x === 'string' && /^[a-z][a-z0-9_]{1,47}$/.test(x)))] };
}

/** La progression du profil actif. La clé dépend du profil (`preferences.ts`). */
export function lireProgression(): Progression {
  const profil = profilActif();
  if (profil !== sessionProfil) { session = vide(); sessionProfil = profil; }
  try {
    const texte = localStorage.getItem(cleProgression(profil));
    // Une clé absente est une progression vide, pas « la dernière lue » : sinon
    // un profil neuf hériterait en mémoire des victoires de l'autre.
    session = texte ? normaliserProgression(JSON.parse(texte)) : vide();
  } catch { /* Le carnet reste utilisable en mémoire si le stockage est refusé. */ }
  return session;
}

/**
 * Les victoires d'un profil **nommé**, sans toucher au profil actif ni à la
 * mémoire de session.
 *
 * `lireProgression` ne sait lire que le profil courant, et c'est ce qu'il faut
 * partout ailleurs. L'écran-titre, lui, doit montrer les **deux** sauvegardes
 * avant que le joueur n'en choisisse une : il ne peut pas basculer le profil
 * actif pour lire l'autre, ce serait changer l'état de l'appareil pour afficher
 * une ligne.
 */
export function victoiresDe(profil: Profil): readonly string[] {
  try {
    const texte = localStorage.getItem(cleProgression(profil));
    return texte ? normaliserProgression(JSON.parse(texte)).victoires : [];
  } catch {
    // Stockage refusé : une sauvegarde illisible est une sauvegarde vide, et
    // l'écran reste utilisable.
    return [];
  }
}

export function enregistrerVictoire(code: string): boolean {
  const profil = profilActif();
  session = normaliserProgression({ version: 1, victoires: [...lireProgression().victoires, code] });
  try { localStorage.setItem(cleProgression(profil), JSON.stringify(session)); return true; }
  catch { return false; }
}

export function missionOuverte(codes: readonly string[], code: string, progression: Progression): boolean {
  const index = codes.indexOf(code);
  return index === 0 || (index > 0 && progression.victoires.includes(codes[index - 1]!));
}
