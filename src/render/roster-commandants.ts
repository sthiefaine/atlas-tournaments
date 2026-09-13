/**
 * Le **vestiaire** : les seize commandants jouables d'une campagne, ce qu'on en
 * a gagné, ce qu'il reste à gagner, et les quatre secrets dont on ne montre
 * qu'un indice (`content/commandants-jouables.json`, `13-campagne.md` §8).
 *
 * C'est la grammaire d'Advance Wars : on gagne des commandants, on choisit le
 * sien avant l'épreuve, et la case grise de celui qu'on n'a pas encore fait
 * autant pour l'envie de rejouer que la case pleine de celui qu'on a. Trois
 * états, et ils ne se ressemblent pas :
 *
 * - **jouable** — buste, nom, style, et ce qu'il fait jouer différemment ;
 * - **verrouillé** — le même, éteint, plus **sa porte** : montrer ce qui se gagne
 *   est la moitié du plaisir, une case grise muette n'annonce rien à gagner ;
 * - **secret** — ni nom, ni buste, ni clé : une silhouette et un indice. Un
 *   secret dont le nom traîne dans le balisage n'est plus un secret, d'où
 *   `FicheRoster.id`, qui vaut `secret_<n>` tant que la porte tient.
 *
 * Ce module est **pur** : aucun DOM, aucun `t()`, aucune lecture de `content/`
 * ni du profil. L'écran lui passe le roster du canon, l'ensemble des clés
 * **acquises** — calculé par la couche qui possède la règle de déblocage, jamais
 * ici — et deux fonctions qui savent nommer. Le rendu n'a aucune autorité sur un
 * déblocage (`engine/deblocages.ts`, règle 1) : il se borne à le montrer.
 */

import type { RosterJouables } from '../schemas/index';

/** L'état d'une case de la grille. */
export type EtatFiche = 'jouable' | 'verrouille' | 'secret';

/** Une case de la grille, prête à peindre : tout y est déjà dit en français. */
export interface FicheRoster {
  /**
   * Ce que l'écran manipule — clé React, `data-` du bouton, index du clavier.
   * C'est la clé du commandant, **sauf** pour un secret encore fermé, où c'est
   * `secret_<n>` : le balisage d'une case ne doit rien laisser deviner.
   */
  id: string;
  /** La clé à envoyer au jeu quand on prend ce banc. Vide tant que la case n'est pas jouable. */
  cle: string;
  etat: EtatFiche;
  /** Le nom. Vide pour un secret fermé. */
  nom: string;
  /** Le style en deux ou trois mots, lu au catalogue tactique. Vide pour un secret fermé. */
  style: string;
  /** La ligne de goût du roster : ce qu'on gagne à le prendre. Vide pour un secret fermé. */
  gout: string;
  /** Passif, pouvoir, super et faiblesse, une ligne chacun. Vide pour un secret fermé. */
  lignes: readonly string[];
  /** Ce qui l'ouvre, dit au joueur. Vide hors d'un verrouillé. */
  porte: string;
  /** L'indice. Vide hors d'un secret fermé. */
  indice: string;
  /** Le commandant du scénario : proposé en premier, et retenu d'entrée. */
  defaut: boolean;
}

/** Ce qu'il faut pour composer les cases : le roster, l'acquis, et de quoi nommer. */
export interface OptionsFiches {
  roster: RosterJouables;
  /**
   * Les clés déjà gagnées. **Donné**, jamais recalculé ici : la règle d'ouverture
   * appartient au moteur et à la progression, pas à l'écran.
   */
  acquis: ReadonlySet<string> | readonly string[];
  /** Le commandant du scénario. Toujours jouable, toujours en tête. */
  defaut?: string;
  /** Nom, style et lignes de kit, composés par l'appelant depuis le canon et `t()`. */
  decrire: (cle: string) => { nom: string; style: string; lignes: readonly string[] };
  /**
   * Ce qui ouvre un jouable encore fermé, dit au joueur : `ouvertPar` vaut
   * `debut`, le code d'une épreuve, ou `a_venir` (place réservée).
   */
  direPorte: (ouvertPar: string) => string;
}

function ensemble(v: ReadonlySet<string> | readonly string[]): ReadonlySet<string> {
  return v instanceof Set ? v : new Set(v);
}

/**
 * Les cases de la grille, dans l'ordre où l'écran les pose : le commandant du
 * scénario d'abord, puis les jouables dans l'ordre du roster, puis les secrets.
 *
 * Les verrouillés **gardent leur place** au lieu d'être repoussés à la fin :
 * une collection dont les cases sautent à chaque déblocage ne se retient pas, et
 * c'est de se retenir qu'on tire l'envie de la remplir. Les secrets ferment la
 * marche parce qu'un secret acquis reste un aboutissement, pas un rang.
 *
 * Le commandant du scénario est ajouté d'office s'il manque au roster : une
 * épreuve propose toujours son propre banc, même si personne ne l'a inscrit.
 */
export function fichesRoster(o: OptionsFiches): FicheRoster[] {
  const acquis = ensemble(o.acquis);
  const defaut = o.defaut ?? '';
  const ouvert = (cle: string, dEntree: boolean): boolean => cle === defaut || dEntree || acquis.has(cle);

  const jouables = o.roster.jouables.map((j): FicheRoster => {
    const etat: EtatFiche = ouvert(j.cle, j.ouvertPar === 'debut') ? 'jouable' : 'verrouille';
    const decrit = o.decrire(j.cle);
    return {
      id: j.cle,
      cle: etat === 'jouable' ? j.cle : '',
      etat,
      nom: decrit.nom,
      style: decrit.style,
      gout: j.gout,
      lignes: decrit.lignes,
      porte: etat === 'verrouille' ? o.direPorte(j.ouvertPar) : '',
      indice: '',
      defaut: j.cle === defaut,
    };
  });

  // Le commandant du scénario absent du roster : une épreuve reste jouable sous
  // son propre banc, quoi que le registre en dise.
  if (defaut !== '' && !jouables.some((f) => f.id === defaut) && !o.roster.secrets.some((s) => s.cle === defaut)) {
    const decrit = o.decrire(defaut);
    jouables.unshift({
      id: defaut, cle: defaut, etat: 'jouable', nom: decrit.nom, style: decrit.style,
      gout: '', lignes: decrit.lignes, porte: '', indice: '', defaut: true,
    });
  }

  const secrets = o.roster.secrets.map((s, rang): FicheRoster => {
    if (!ouvert(s.cle, false)) {
      return {
        id: `secret_${rang + 1}`, cle: '', etat: 'secret', nom: '', style: '', gout: '',
        lignes: [], porte: '', indice: '', defaut: false,
      };
    }
    const decrit = o.decrire(s.cle);
    return {
      id: s.cle, cle: s.cle, etat: 'jouable', nom: decrit.nom, style: decrit.style,
      gout: s.libelle, lignes: decrit.lignes, porte: '', indice: '', defaut: s.cle === defaut,
    };
  });

  const toutes = [...jouables, ...secrets];
  // Le défaut passe en tête sans que le reste bouge : c'est le banc du scénario,
  // et le premier bouton d'un choix est celui qu'on décline.
  const tete = toutes.filter((f) => f.defaut);
  return tete.length > 0 ? [...tete, ...toutes.filter((f) => !f.defaut)] : toutes;
}

/** Ce que le carnet compte : la collection, et ce qui reste à trouver. */
export interface CompteRoster {
  acquis: number;
  total: number;
  /** Les secrets encore fermés — ceux dont on ne montre qu'un indice. */
  secrets: number;
}

/** Le compte d'une grille : « 7 sur 16 », et trois silhouettes encore fermées. */
export function compteRoster(fiches: readonly FicheRoster[]): CompteRoster {
  return {
    acquis: fiches.filter((f) => f.etat === 'jouable').length,
    total: fiches.length,
    secrets: fiches.filter((f) => f.etat === 'secret').length,
  };
}

/**
 * Les cases de quelques clés nommées, dans l'ordre de la grille.
 *
 * C'est ce que l'écran de fin annonce, et **la liste lui est donnée** :
 * `debloquerCommandants` (progression) dit ce qu'une victoire vient d'ouvrir,
 * cette fonction se borne à retrouver les fiches correspondantes. Refaire la
 * différence ici serait recalculer une règle de déblocage dans une couche
 * d'affichage, ce que `engine/deblocages.ts` interdit en toutes lettres.
 */
export function ouvertures(
  fiches: readonly FicheRoster[],
  cles: ReadonlySet<string> | readonly string[],
): FicheRoster[] {
  const ouverts = ensemble(cles);
  return fiches.filter((f) => f.etat === 'jouable' && f.cle !== '' && ouverts.has(f.cle));
}

/** Ce qu'un clic sur une case veut dire, selon qu'elle est déjà retenue ou non. */
export type ActionClic = 'rien' | 'selectionner' | 'prendre';

/**
 * Un clic sélectionne, un second confirme — la grammaire d'un menu de jeu, où
 * l'on doit pouvoir lire un kit avant de s'engager. Une case qui n'est pas
 * jouable ne répond pas : elle n'a rien à confirmer.
 */
export function actionClic(fiche: FicheRoster, selection: string): ActionClic {
  if (fiche.etat !== 'jouable') return 'rien';
  return fiche.id === selection ? 'prendre' : 'selectionner';
}

/** Ce qu'une touche demande à la grille. `null` : la touche n'est pas pour nous. */
export type GesteGrille = { type: 'aller'; index: number } | { type: 'prendre' };

/**
 * Le clavier de la grille : les flèches déplacent d'une case, Entrée prend le
 * banc retenu.
 *
 * Les flèches déplacent **d'une** case dans les quatre sens, et non d'une
 * colonne en haut et en bas : la grille se replie de quatre colonnes à une entre
 * un écran et un téléphone, si bien qu'un pas vertical de largeur fixe serait
 * faux sur toutes les largeurs sauf une. C'est l'arithmétique
 * d'`app/navigation-choix.ts`, qu'un test tient au même verdict — ce module ne
 * peut pas l'importer (`render` ne connaît pas `app`, `02-architecture.md` §5),
 * et deux copies qui ne se surveillent pas finissent par diverger.
 */
export function gesteClavier(touche: string, index: number, total: number): GesteGrille | null {
  if (total < 1) return null;
  switch (touche) {
    case 'ArrowRight':
    case 'ArrowDown': return { type: 'aller', index: (index + 1) % total };
    case 'ArrowLeft':
    case 'ArrowUp': return { type: 'aller', index: (index + total - 1) % total };
    case 'Home': return { type: 'aller', index: 0 };
    case 'End': return { type: 'aller', index: total - 1 };
    case 'Enter':
    case ' ': return { type: 'prendre' };
    default: return null;
  }
}
