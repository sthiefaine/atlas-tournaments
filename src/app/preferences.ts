/**
 * Les **préférences locales** du joueur : ce qu'il a choisi dans `/reglages`.
 *
 * Elles vivent dans `localStorage`, comme la progression, et n'ont **aucune
 * autorité sur les règles** — elles ne décident que de la façon dont la partie
 * s'affiche et se raconte. Le serveur ne les lit jamais.
 *
 * Le même sens unique que partout ailleurs : un rendu serveur part des valeurs
 * par défaut, le client les remplace après montage. Une préférence illisible ou
 * corrompue n'est pas une erreur — on retombe sur la valeur par défaut, ce qui
 * est toujours un état jouable.
 */

/** Ce que le joueur peut régler aujourd'hui. */
export interface Preferences {
  version: 1;
  /** Jouer les scènes de commandement pendant les missions. */
  dialogues: boolean;
  /**
   * Force la réduction des animations. Le réglage système reste **maître** :
   * cet interrupteur ne peut qu'ajouter la réduction, jamais la retirer à
   * quelqu'un qui l'a demandée à son appareil.
   */
  animationsReduites: boolean;
}

const CLE = 'atlas:reglages:v1';

/**
 * Le préfixe des parties en cours, **recopié** de `render/jeu.ts`.
 *
 * L'importer ferait entrer le moteur, l'IA et le rendu dans le bundle de la
 * page des réglages, pour une seule chaîne de caractères.
 * `tests/campagne/preferences.test.ts` échoue si les deux divergent : c'est ce
 * qui rend la copie acceptable.
 */
export const PREFIXE_PARTIE = 'atlas:partie:';

/** La clé de la progression de qualification (`campagne/progression.ts`). */
export const CLE_PROGRESSION = 'atlas:qualification:v1';

/** Les valeurs par défaut : celles que rend le serveur. */
export const PREFERENCES_PAR_DEFAUT: Readonly<Preferences> = Object.freeze({
  version: 1,
  dialogues: true,
  animationsReduites: false,
});

/** Ramène n'importe quoi à des préférences valides. */
export function normaliserPreferences(brut: unknown): Preferences {
  if (!brut || typeof brut !== 'object') return { ...PREFERENCES_PAR_DEFAUT };
  const p = brut as Partial<Preferences>;
  return {
    version: 1,
    dialogues: typeof p.dialogues === 'boolean' ? p.dialogues : PREFERENCES_PAR_DEFAUT.dialogues,
    animationsReduites: p.animationsReduites === true,
  };
}

/** Lit les préférences. Un stockage refusé rend les valeurs par défaut. */
export function lirePreferences(): Preferences {
  try {
    const texte = localStorage.getItem(CLE);
    return texte ? normaliserPreferences(JSON.parse(texte)) : { ...PREFERENCES_PAR_DEFAUT };
  } catch {
    return { ...PREFERENCES_PAR_DEFAUT };
  }
}

/** Écrit les préférences. Rend `false` si le navigateur a refusé. */
export function ecrirePreferences(p: Preferences): boolean {
  try {
    localStorage.setItem(CLE, JSON.stringify(normaliserPreferences(p)));
    return true;
  } catch {
    return false;
  }
}

/** Le navigateur accepte-t-il d'enregistrer quoi que ce soit ? */
export function stockageDisponible(): boolean {
  try {
    const sonde = `${CLE}:sonde`;
    localStorage.setItem(sonde, '1');
    localStorage.removeItem(sonde);
    return true;
  } catch {
    return false;
  }
}

/**
 * Efface la progression **et** les parties en cours.
 *
 * Les deux, toujours : n'effacer que la liste des victoires laisserait des
 * parties fantômes qui reprendraient au milieu d'une épreuve que le joueur
 * croit n'avoir jamais commencée. Les préférences, elles, survivent — personne
 * ne demande à réactiver les dialogues en effaçant sa campagne.
 */
export function effacerProgression(): boolean {
  try {
    const aJeter: string[] = [CLE_PROGRESSION];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIXE_PARTIE)) aJeter.push(k);
    }
    for (const k of aJeter) localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}
