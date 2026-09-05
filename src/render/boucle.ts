/**
 * La boucle de rendu **paresseuse** (`02-architecture.md` §2, point 1).
 *
 * Un tactique au tour par tour est immobile la plupart du temps : une boucle qui
 * tourne à vide pour redessiner une image identique vide la batterie. D'où la
 * « salissure » explicite : `salir()` réveille la boucle, la boucle s'endort dès
 * que la file d'animations est vide et que rien n'est sale.
 *
 * Le planificateur est injectable, ce qui rend la boucle testable sans DOM.
 */

/** Une animation de la file : une durée, une progression, une fin. */
export interface Animation {
  /** Nom lisible, utile au journal et aux tests. */
  nom: string;
  /** Durée totale en millisecondes. */
  duree: number;
  /** Millisecondes déjà écoulées. */
  ecoule: number;
  /** Appelée à chaque image avec la progression `0 → 1`. */
  avancer(progression: number): void;
  /** Appelée une fois, à la fin, avant le retrait de la file. */
  terminer?(): void;
}

/** Crée une animation à partir d'une durée et d'une fonction de progression. */
export function animation(
  nom: string, duree: number, avancer: (p: number) => void, terminer?: () => void,
): Animation {
  return { nom, duree: Math.max(1, duree), ecoule: 0, avancer, terminer };
}

/** Ce dont la boucle a besoin pour vivre hors du navigateur (tests, Node). */
export interface Horloge {
  planifier(rappel: (temps: number) => void): number;
  annuler(jeton: number): void;
  maintenant(): number;
}

/** L'horloge du navigateur : `requestAnimationFrame` et `performance.now()`. */
export function horlogeNavigateur(): Horloge {
  const g = globalThis as unknown as {
    requestAnimationFrame?: (f: (t: number) => void) => number;
    cancelAnimationFrame?: (j: number) => void;
    performance?: { now(): number };
  };
  const raf = g.requestAnimationFrame;
  const caf = g.cancelAnimationFrame;
  if (typeof raf === 'function' && typeof caf === 'function') {
    return {
      planifier: (rappel) => raf.call(globalThis, rappel),
      annuler: (jeton) => caf.call(globalThis, jeton),
      maintenant: () => (g.performance ? g.performance.now() : 0),
    };
  }
  // Repli minimal : utile aux tests et au rendu hors écran.
  let jeton = 0;
  const jetons = new Map<number, ReturnType<typeof setTimeout>>();
  return {
    planifier: (rappel) => {
      jeton += 1;
      const id = jeton;
      jetons.set(id, setTimeout(() => rappel(Date.now()), 16));
      return id;
    },
    annuler: (id) => {
      const t = jetons.get(id);
      if (t !== undefined) clearTimeout(t);
      jetons.delete(id);
    },
    maintenant: () => Date.now(),
  };
}

/** Ce que la boucle appelle pour dessiner une image. */
export type Peintre = (ecoule: number) => void;

/**
 * Boucle paresseuse : elle ne tourne que tant qu'il y a une raison de tourner.
 *
 * ```ts
 * const boucle = new Boucle((dt) => scene.dessiner(dt));
 * boucle.salir();                 // une image
 * boucle.ajouter(deplacement);    // et tant que l'animation dure
 * ```
 */
export class Boucle {
  private readonly peintre: Peintre;

  private readonly horloge: Horloge;

  private readonly file: Animation[] = [];

  private jeton: number | null = null;

  private dernier = 0;

  private sale = false;

  private vivante = true;

  constructor(peintre: Peintre, horloge: Horloge = horlogeNavigateur()) {
    this.peintre = peintre;
    this.horloge = horloge;
  }

  /** Vrai tant qu'une image est planifiée : c'est l'état « éveillée ». */
  get eveillee(): boolean {
    return this.jeton !== null;
  }

  /** Nombre d'animations en cours. */
  get animations(): number {
    return this.file.length;
  }

  /** Réveille la boucle pour au moins une image. */
  salir(): void {
    if (!this.vivante) return;
    this.sale = true;
    this.reveiller();
  }

  /** Ajoute une animation à la file et réveille la boucle. */
  ajouter(anim: Animation): void {
    if (!this.vivante) return;
    this.file.push(anim);
    this.sale = true;
    this.reveiller();
  }

  /** Vide la file sans jouer les fins : sert à l'arrêt et au saut d'animation. */
  viderFile(terminer = true): void {
    const file = this.file.splice(0, this.file.length);
    if (terminer) for (const a of file) a.terminer?.();
  }

  /** Arrête définitivement la boucle. Idempotent. */
  arreter(): void {
    this.vivante = false;
    this.sale = false;
    this.viderFile(false);
    this.endormir();
  }

  /** Fait avancer la boucle d'une image. Public pour les tests. */
  image(temps: number): void {
    this.jeton = null;
    if (!this.vivante) return;
    const ecoule = this.dernier === 0 ? 16 : Math.min(100, temps - this.dernier);
    this.dernier = temps;
    if (this.file.length > 0) {
      const restantes: Animation[] = [];
      for (const a of this.file) {
        a.ecoule += ecoule;
        const p = Math.min(1, a.ecoule / a.duree);
        a.avancer(p);
        if (p >= 1) a.terminer?.();
        else restantes.push(a);
      }
      this.file.length = 0;
      this.file.push(...restantes);
    }
    this.sale = false;
    this.peintre(ecoule);
    if (this.file.length > 0 || this.sale) this.reveiller();
    else this.dernier = 0;
  }

  private reveiller(): void {
    if (this.jeton !== null || !this.vivante) return;
    this.jeton = this.horloge.planifier((t) => this.image(t));
  }

  private endormir(): void {
    if (this.jeton === null) return;
    this.horloge.annuler(this.jeton);
    this.jeton = null;
  }
}
