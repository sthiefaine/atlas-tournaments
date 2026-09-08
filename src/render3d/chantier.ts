/**
 * Le **chantier** : jouer la construction du monde une tranche à la fois.
 *
 * Bâtir le monde d'un bloc gelait la page une centaine de millisecondes
 * (`10-rendu-3d.md` §9.6) — synthèse de textures en boucles de pixels, fusion
 * de géométries, semis du décor, du JavaScript pur qui n'a besoin d'aucune
 * carte graphique. On le découpe donc en tranches, et le navigateur peint son
 * écran de chargement et répond aux clics entre deux, exactement comme entre
 * deux lots de préchauffage (`prechauffage.ts`).
 *
 * Ce module ne sait **rien** de ce qu'une tranche fabrique : il ne fait que les
 * jouer dans l'ordre, une par tâche, et rendre la main entre chacune. C'est
 * pour cela qu'il est ici et non dans `index.ts` — il se teste sans document,
 * sans moteur et sans carte graphique, avec un ordonnanceur de papier.
 *
 * **Une tranche qui rend une promesse retient la suivante.** C'est ce qui
 * permet au préchauffage de s'intercaler entre deux temps de construction : le
 * sol est bâti, on le chauffe, on le montre, et alors seulement on bâtit le
 * décor et les figurines (`index.ts`, `PhaseChantier`). Une promesse rompue
 * n'arrête pas le chantier — la tranche suivante a rarement à voir avec celle
 * qui a échoué, et un monde à moitié bâti vaut mieux qu'un écran vide.
 */

/**
 * Une tranche de construction : un morceau de monde, joué dans sa propre tâche.
 */
export type Tranche = () => void | Promise<void>;

export interface OptionsChantier {
  /**
   * Planifie la reprise. Par défaut un tour de macrotâche, qui laisse le
   * navigateur peindre ; un test y met sa propre file pour dérouler le chantier
   * sans horloge.
   */
  planifier?(reprendre: () => void): void;
  /**
   * Vrai tant que le chantier a encore un sens. Relu **avant** chaque tranche :
   * une scène démontée en cours de construction n'en joue pas une de plus.
   */
  vivant?(): boolean;
  /**
   * Appelée une fois, quand il n'y a plus rien à jouer — parce que tout est
   * bâti, ou parce que le chantier s'est arrêté. C'est ce qui permet d'attendre
   * un chantier : `jouerTranches`.
   */
  surFin?(): void;
}

/** Un chantier en cours : de quoi le lancer, le suivre et l'arrêter. */
export interface Chantier {
  /** Joue la première tranche ; les suivantes s'enchaînent d'elles-mêmes. */
  demarrer(): void;
  /** Combien de tranches restent à jouer. Zéro quand tout est bâti, ou arrêté. */
  readonly restantes: number;
  /** Vrai quand toutes les tranches ont été jouées. */
  readonly fini: boolean;
  /** Arrête le chantier : plus aucune tranche ne sera jouée. */
  arreter(): void;
}

/** Un tour de macrotâche : le navigateur peint, puis on reprend. */
function tourDeBoucle(reprendre: () => void): void {
  setTimeout(reprendre, 0);
}

/** Ouvre un chantier sur une liste de tranches. Rien n'est joué avant `demarrer`. */
export function ouvrirChantier(tranches: readonly Tranche[], options: OptionsChantier = {}): Chantier {
  const planifier = options.planifier ?? tourDeBoucle;
  let rang = 0;
  let arrete = false;
  const vivant = (): boolean => !arrete && (options.vivant?.() ?? true);

  let annonce = false;
  const fin = (): void => {
    if (annonce) return;
    annonce = true;
    options.surFin?.();
  };

  const avancer = (): void => {
    const suivante = vivant() ? tranches[rang] : undefined;
    if (!suivante) { fin(); return; }
    rang += 1;
    // On planifie la reprise même si le chantier vient de mourir : c'est
    // `avancer` qui s'en aperçoit, et c'est ainsi que `surFin` finit toujours
    // par tomber — sans quoi une attente sur un chantier arrêté ne tiendrait
    // jamais.
    const suite = (): void => planifier(avancer);
    // Une tranche qui ne promet rien laisse la suivante partir tout de suite ;
    // une tranche qui promet la retient, qu'elle tienne ou qu'elle rompe.
    const enCours = suivante();
    if (enCours) void enCours.then(suite, suite);
    else suite();
  };

  return {
    demarrer: avancer,
    get restantes(): number { return arrete ? 0 : tranches.length - rang; },
    get fini(): boolean { return !arrete && rang >= tranches.length; },
    arreter(): void { arrete = true; },
  };
}

/**
 * Joue une liste de tranches et rend une promesse qui tient quand il n'y a plus
 * rien à jouer — tout bâti, ou chantier arrêté.
 *
 * C'est ce qui permet d'**emboîter** un chantier dans un autre : le décor a ses
 * propres tranches, dont le nombre dépend de la carte (`decor.ts`), et une
 * tranche du chantier principal les joue toutes sans qu'il ait à les connaître
 * ni à en réserver d'avance.
 */
export function jouerTranches(tranches: readonly Tranche[], options: OptionsChantier = {}): Promise<void> {
  return new Promise((resoudre) => {
    ouvrirChantier(tranches, { ...options, surFin: () => { resoudre(); } }).demarrer();
  });
}
