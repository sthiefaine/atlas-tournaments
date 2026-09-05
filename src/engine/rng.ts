/**
 * Générateur d'aléas seedé du moteur (`doc/02-architecture.md` §7).
 *
 * Algorithme `xoshiro128**`, amorcé par `splitmix32` sur le hachage FNV-1a de la
 * graine. Quatre entiers 32 bits d'état, donc sérialisable tel quel.
 *
 * Flux dérivés : `rng.branche('combat')` rend toujours **le même** flux pour un
 * même nom, dérivé du nom et non de la position courante du parent. Ajouter un
 * tirage dans l'IA ne décale donc ni les jets de combat ni la météo.
 */

import type { EtatRng, InstantaneRng, Rng } from './types';

/** Hachage FNV-1a 32 bits d'une chaîne : amorce des graines. */
export function fnv1a(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i += 1) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Un pas de `splitmix32` : sert à étaler une graine sur quatre mots. */
function splitmix32(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x9e3779b9) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 0x85ebca6b) >>> 0;
    t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35) >>> 0;
    return (t ^ (t >>> 16)) >>> 0;
  };
}

/** Amorce les quatre mots d'état d'un flux depuis une chaîne. */
export function amorcer(graine: string): EtatRng {
  const suite = splitmix32(fnv1a(graine));
  const s: EtatRng = [suite(), suite(), suite(), suite()];
  if (s[0] === 0 && s[1] === 0 && s[2] === 0 && s[3] === 0) s[0] = 0x9e3779b9;
  return s;
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

class FluxRng implements Rng {
  readonly chemin: string;
  private readonly graine: string;
  private s: EtatRng;
  private readonly enfants = new Map<string, FluxRng>();

  constructor(graine: string, chemin: string, etat?: EtatRng) {
    this.graine = graine;
    this.chemin = chemin;
    this.s = etat ?? amorcer(graine);
  }

  get etat(): EtatRng {
    return [this.s[0], this.s[1], this.s[2], this.s[3]];
  }

  /** Un pas de xoshiro128** : entier non signé 32 bits. */
  private mot(): number {
    const s = this.s;
    const resultat = (Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0);
    const t = (s[1] << 9) >>> 0;
    s[2] = (s[2] ^ s[0]) >>> 0;
    s[3] = (s[3] ^ s[1]) >>> 0;
    s[1] = (s[1] ^ s[2]) >>> 0;
    s[0] = (s[0] ^ s[3]) >>> 0;
    s[2] = (s[2] ^ t) >>> 0;
    s[3] = rotl(s[3], 11);
    return resultat >>> 0;
  }

  suivant(): number {
    return this.mot() / 4294967296;
  }

  entier(borne: number): number {
    if (borne <= 1) return 0;
    return Math.floor(this.suivant() * borne) % borne;
  }

  branche(nom: string): Rng {
    const existant = this.enfants.get(nom);
    if (existant) return existant;
    const chemin = this.chemin === '' ? nom : `${this.chemin}/${nom}`;
    const enfant = new FluxRng(`${this.graine}|${chemin}`, chemin);
    this.enfants.set(nom, enfant);
    return enfant;
  }

  instantane(): InstantaneRng {
    const sortie: InstantaneRng = { [this.chemin]: this.etat };
    for (const nom of [...this.enfants.keys()].sort()) {
      Object.assign(sortie, this.enfants.get(nom)!.instantane());
    }
    return sortie;
  }

  restaurer(flux: InstantaneRng): void {
    const mien = flux[this.chemin];
    if (mien) this.s = [mien[0], mien[1], mien[2], mien[3]];
    // Recrée les branches connues de l'instantané, en profondeur croissante.
    const prefixe = this.chemin === '' ? '' : `${this.chemin}/`;
    for (const chemin of Object.keys(flux).sort()) {
      if (chemin === this.chemin || !chemin.startsWith(prefixe)) continue;
      const reste = chemin.slice(prefixe.length);
      if (reste === '' || reste.includes('/')) continue;
      (this.branche(reste) as FluxRng).restaurer(flux);
    }
  }
}

/** Crée le flux racine d'une graine. */
export function creerRng(graine: string): Rng {
  return new FluxRng(graine, '');
}

/** Recrée un arbre de flux depuis une graine et un instantané d'état. */
export function restaurerRng(graine: string, flux: InstantaneRng): Rng {
  const racine = creerRng(graine);
  racine.restaurer(flux);
  return racine;
}
