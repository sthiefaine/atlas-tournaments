/**
 * Les **préférences locales** du joueur : ce qu'il a choisi dans `/reglages`,
 * et les **profils** de cet appareil.
 *
 * Elles vivent dans `localStorage`, comme la progression, et n'ont **aucune
 * autorité sur les règles** — elles ne décident que de la façon dont la partie
 * s'affiche et se raconte. Le serveur ne les lit jamais.
 *
 * Le même sens unique que partout ailleurs : un rendu serveur part des valeurs
 * par défaut, le client les remplace après montage. Une préférence illisible ou
 * corrompue n'est pas une erreur — on retombe sur la valeur par défaut, ce qui
 * est toujours un état jouable.
 *
 * ## Les profils
 *
 * Deux joueurs se partagent souvent un même téléphone ; chacun veut sa
 * campagne. Il y a donc **deux profils par appareil**, `a` et `b`, nommables,
 * dont un seul est actif. Chaque profil possède sa progression et ses parties en
 * cours ; les réglages (dialogues, animations) restent communs à l'appareil.
 *
 * Le schéma des clés est fait pour qu'**aucune migration** ne soit nécessaire :
 *
 *     profil A   atlas:qualification:v1      atlas:partie:<scenario>
 *     profil B   atlas:p2:qualification:v1   atlas:p2:partie:<scenario>
 *     actif      atlas:profil:v1             { actif, noms }
 *
 * Le profil A garde les clés historiques, sans segment : la progression déjà
 * enregistrée sur l'appareil devient le profil A le jour où la notion apparaît,
 * sans qu'on ait rien à recopier. Le profil B insère `p2:` après `atlas:`, ce
 * qui évite qu'un préfixe soit le début de l'autre — `atlas:partie:` ne couvre
 * pas `atlas:p2:partie:`, et l'effacement d'un profil ne peut pas mordre sur
 * l'autre par simple `startsWith`.
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

/** Les deux profils d'un appareil. La liste est fermée : deux, pas « n ». */
export type Profil = 'a' | 'b';
export const PROFILS: readonly Profil[] = Object.freeze(['a', 'b'] as const);

/** Longueur maximale d'un nom de profil, en caractères (pas en octets). */
export const NOM_PROFIL_MAX = 16;

/** L'état des profils : lequel est actif, et comment le joueur les a nommés. */
export interface EtatProfils {
  version: 1;
  actif: Profil;
  /** Un nom vide signifie « pas nommé » : l'interface affiche le libellé par défaut. */
  noms: Record<Profil, string>;
}

const CLE = 'atlas:reglages:v1';
const CLE_PROFILS = 'atlas:profil:v1';

/**
 * Le préfixe des parties en cours, **recopié** de `render/jeu.ts`.
 *
 * L'importer ferait entrer le moteur, l'IA et le rendu dans le bundle de la
 * page des réglages, pour une seule chaîne de caractères.
 * `tests/campagne/preferences.test.ts` échoue si les deux divergent : c'est ce
 * qui rend la copie acceptable.
 */
export const PREFIXE_PARTIE = 'atlas:partie:';

/** La clé de la progression de qualification du profil A (`campagne/progression.ts`). */
export const CLE_PROGRESSION = 'atlas:qualification:v1';

/**
 * Le segment inséré après `atlas:` pour chaque profil. Vide pour A, et c'est
 * tout l'intérêt : ses clés sont celles d'avant les profils.
 */
const SEGMENT_PROFIL: Readonly<Record<Profil, string>> = Object.freeze({ a: '', b: 'p2:' });

/** Ramène n'importe quoi à un identifiant de profil. */
export function normaliserProfil(brut: unknown): Profil {
  return brut === 'b' ? 'b' : 'a';
}

/** La clé de progression d'un profil. */
export function cleProgression(profil: Profil): string {
  return `atlas:${SEGMENT_PROFIL[profil]}qualification:v1`;
}

/** Le préfixe des parties en cours d'un profil. */
export function prefixePartie(profil: Profil): string {
  return `atlas:${SEGMENT_PROFIL[profil]}partie:`;
}

/**
 * La clé de sauvegarde d'un scénario pour un profil. C'est **la page** qui la
 * compose et la donne au rendu, comme elle lui donne des libellés déjà traduits :
 * le rendu ne connaît pas les profils.
 */
export function cleSauvegardeDe(profil: Profil, scenarioCle: string): string {
  return `${prefixePartie(profil)}${scenarioCle}`;
}

/**
 * Ramène un nom de profil à sa forme enregistrable : espaces rognés, blancs
 * intérieurs réduits à un seul, au plus `NOM_PROFIL_MAX` caractères. Un nom
 * qui n'a rien de visible devient vide, c'est-à-dire « pas nommé ».
 */
export function normaliserNomProfil(brut: unknown): string {
  if (typeof brut !== 'string') return '';
  const propre = brut.replace(/\s+/g, ' ').trim();
  // `Array.from` compte en points de code : seize caractères, pas seize unités
  // UTF-16, sinon un nom en émojis se coupe au milieu d'un caractère.
  return Array.from(propre).slice(0, NOM_PROFIL_MAX).join('');
}

/** L'état des profils par défaut : A actif, aucun nom. C'est ce que rend le serveur. */
export const PROFILS_PAR_DEFAUT: Readonly<EtatProfils> = Object.freeze({
  version: 1,
  actif: 'a',
  noms: Object.freeze({ a: '', b: '' }),
});

/** Ramène n'importe quoi à un état de profils valide. */
export function normaliserProfils(brut: unknown): EtatProfils {
  if (!brut || typeof brut !== 'object') return { version: 1, actif: 'a', noms: { a: '', b: '' } };
  const p = brut as Partial<EtatProfils>;
  const noms = (p.noms && typeof p.noms === 'object' ? p.noms : {}) as Partial<Record<Profil, unknown>>;
  return {
    version: 1,
    actif: normaliserProfil(p.actif),
    noms: { a: normaliserNomProfil(noms.a), b: normaliserNomProfil(noms.b) },
  };
}

/** Lit l'état des profils. Un stockage refusé ou vide rend le profil A, sans nom. */
export function lireProfils(): EtatProfils {
  try {
    const texte = localStorage.getItem(CLE_PROFILS);
    return texte ? normaliserProfils(JSON.parse(texte)) : normaliserProfils(null);
  } catch {
    return normaliserProfils(null);
  }
}

/** Écrit l'état des profils. Rend `false` si le navigateur a refusé. */
export function ecrireProfils(etat: EtatProfils): boolean {
  try {
    localStorage.setItem(CLE_PROFILS, JSON.stringify(normaliserProfils(etat)));
    return true;
  } catch {
    return false;
  }
}

/** Le profil actif. Sans stockage, c'est toujours A : le jeu reste jouable. */
export function profilActif(): Profil {
  return lireProfils().actif;
}

/** Rend un autre profil actif. Les noms sont conservés. */
export function changerProfilActif(profil: Profil): boolean {
  return ecrireProfils({ ...lireProfils(), actif: normaliserProfil(profil) });
}

/** Renomme un profil. Un nom vide le ramène à « pas nommé ». */
export function renommerProfil(profil: Profil, nom: string): boolean {
  const etat = lireProfils();
  return ecrireProfils({ ...etat, noms: { ...etat.noms, [profil]: normaliserNomProfil(nom) } });
}

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

/** Ce qu'un profil a en stock : de quoi dire au joueur ce qu'il s'apprête à effacer. */
export interface BilanProgression {
  victoires: number;
  parties: number;
}

/** Les clés des parties en cours d'un profil, telles qu'elles sont en stock. */
function clesParties(profil: Profil): string[] {
  const prefixe = prefixePartie(profil);
  const cles: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefixe)) cles.push(k);
  }
  return cles;
}

/**
 * Compte les victoires et les parties en cours d'un profil, **sans rien
 * modifier**. Les réglages appellent ceci avant d'effacer, pour annoncer des
 * chiffres vrais : compter après coup ne donnerait que des zéros.
 */
export function compterProgression(profil: Profil = profilActif()): BilanProgression {
  try {
    const texte = localStorage.getItem(cleProgression(profil));
    const brut = texte ? (JSON.parse(texte) as { victoires?: unknown }) : null;
    const victoires = Array.isArray(brut?.victoires)
      ? new Set(brut.victoires.filter((v): v is string => typeof v === 'string')).size
      : 0;
    return { victoires, parties: clesParties(profil).length };
  } catch {
    return { victoires: 0, parties: 0 };
  }
}

/**
 * Efface la progression **et** les parties en cours d'un profil — le profil
 * actif par défaut —, et rien de l'autre profil.
 *
 * Les deux, toujours : n'effacer que la liste des victoires laisserait des
 * parties fantômes qui reprendraient au milieu d'une épreuve que le joueur
 * croit n'avoir jamais commencée. Les préférences et les noms de profils, eux,
 * survivent — personne ne demande à réactiver les dialogues en effaçant sa
 * campagne.
 */
export function effacerProgression(profil: Profil = profilActif()): boolean {
  try {
    const aJeter = [cleProgression(profil), ...clesParties(profil)];
    for (const k of aJeter) localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}
