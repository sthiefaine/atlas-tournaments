/**
 * Passe 1 à 3 du pipeline (`02-architecture.md` §3.3) : relief, reliefs et forêts,
 * hydrographie, puis remise en ordre de la topologie (côtes lissées, terres reliées).
 *
 * Tout est tiré d'un bruit de valeur seedé, **symétrisé avant seuillage** : chaque
 * case lit l'altitude de son représentant d'orbite, donc mer, montagnes et forêts
 * tombent aux mêmes endroits pour tous les camps, sans passe de miroir.
 */

import {
  abscisse, composantes, franchissable, lire, ordonnee, poser, poserBrut, voisins4,
  type Toile,
} from './grille';
import type { ParametresNormalises } from './parametres';
import { reglagesDe } from './parametres';
import type { Rng } from './rng';

/** Interpolation douce, dérivée nulle aux extrémités. */
function adoucir(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Bruit de valeur symétrique dans [0, 1] : une grille de nœuds aléatoires
 * interpolés, sommée sur deux octaves, puis rabattue sur les représentants
 * d'orbite du cadre de symétrie.
 */
export function bruitValeur(t: Toile, rng: Rng, echelle: number): Float64Array {
  const total = t.largeur * t.hauteur;
  const brut = new Float64Array(total);
  let poids = 0;
  for (let octave = 0; octave < 2; octave += 1) {
    const pas = Math.max(2, Math.round(echelle / (octave + 1)));
    const poidsOctave = 1 / (octave + 1);
    poids += poidsOctave;
    const colonnes = Math.ceil(t.largeur / pas) + 2;
    const lignes = Math.ceil(t.hauteur / pas) + 2;
    const noeuds = new Float64Array(colonnes * lignes);
    for (let i = 0; i < noeuds.length; i += 1) noeuds[i] = rng.suivant();
    for (let y = 0; y < t.hauteur; y += 1) {
      for (let x = 0; x < t.largeur; x += 1) {
        const gx = x / pas;
        const gy = y / pas;
        const x0 = Math.floor(gx);
        const y0 = Math.floor(gy);
        const fx = adoucir(gx - x0);
        const fy = adoucir(gy - y0);
        const n00 = noeuds[y0 * colonnes + x0] ?? 0;
        const n10 = noeuds[y0 * colonnes + x0 + 1] ?? 0;
        const n01 = noeuds[(y0 + 1) * colonnes + x0] ?? 0;
        const n11 = noeuds[(y0 + 1) * colonnes + x0 + 1] ?? 0;
        const haut = n00 + (n10 - n00) * fx;
        const bas = n01 + (n11 - n01) * fx;
        brut[y * t.largeur + x] = (brut[y * t.largeur + x] ?? 0) + (haut + (bas - haut) * fy) * poidsOctave;
      }
    }
  }
  const valeurs = new Float64Array(total);
  for (let c = 0; c < total; c += 1) valeurs[c] = (brut[t.cadre.representant(c)] ?? 0) / poids;
  return valeurs;
}

/** Altitude finale : bruit atténué sur les bords, pour que la mer cerne la carte. */
function altitudes(t: Toile, rng: Rng, echelle: number): Float64Array {
  const bruit = bruitValeur(t, rng, echelle);
  const rayon = Math.max(2, Math.min(t.largeur, t.hauteur) / 2);
  const sortie = new Float64Array(bruit.length);
  for (let c = 0; c < bruit.length; c += 1) {
    const x = abscisse(t, c);
    const y = ordonnee(t, c);
    const bord = Math.min(x, t.largeur - 1 - x, y, t.hauteur - 1 - y);
    const facteur = adoucir(Math.min(1, bord / rayon));
    sortie[c] = 0.70 * (bruit[c] ?? 0) + 0.30 * facteur;
  }
  return sortie;
}

/**
 * Attribue un terrain aux `combien` cases extrêmes d'un classement, **orbite par
 * orbite** : on ne coupe jamais une orbite en deux, sinon la symétrie tombe.
 */
function poserParOrbites(
  t: Toile,
  candidats: readonly number[],
  score: (c: number) => number,
  combien: number,
  terrain: 'mer' | 'montagne' | 'foret',
): void {
  const reps = candidats
    .filter((c) => t.cadre.representant(c) === c)
    .sort((a, b) => score(a) - score(b) || a - b);
  let poses = 0;
  for (const rep of reps) {
    if (poses >= combien) break;
    const orbite = t.cadre.orbite(rep);
    poser(t, rep, terrain);
    poses += orbite.length;
  }
}

/** Passes 1 et 2 : mer, plages, montagnes, forêts. Renvoie l'altitude utilisée. */
export function poserRelief(t: Toile, rng: Rng, p: ParametresNormalises): Float64Array {
  const reglages = reglagesDe(p.biome);
  const altitude = altitudes(t, rng.branche('altitude'), reglages.echelle);
  const total = t.largeur * t.hauteur;
  const toutes: number[] = [];
  for (let c = 0; c < total; c += 1) toutes.push(c);

  // Mer : les altitudes les plus basses.
  poserParOrbites(t, toutes, (c) => altitude[c] ?? 0,
    Math.round(p.ratioMerEffectif * total), 'mer');

  const terres = toutes.filter((c) => lire(t, c) !== 'mer');
  const relief = bruitValeur(t, rng.branche('relief'), Math.max(2, reglages.echelle - 1));
  const casesRelief = Math.round(p.ratioRelief * total);
  const casesMontagne = Math.min(
    Math.round(casesRelief * reglages.partMontagne),
    Math.max(0, terres.length - 12),
  );
  const casesForet = Math.min(
    casesRelief - casesMontagne,
    Math.max(0, terres.length - casesMontagne - 12),
  );

  // Montagnes : les plus hautes (score inversé, le tri est croissant).
  poserParOrbites(t, terres, (c) => -(0.6 * (altitude[c] ?? 0) + 0.4 * (relief[c] ?? 0)),
    casesMontagne, 'montagne');
  const restantes = terres.filter((c) => lire(t, c) === 'plaine');
  poserParOrbites(t, restantes, (c) => -(relief[c] ?? 0), casesForet, 'foret');

  return altitude;
}

/** Plages : toute plaine bordée de mer devient une grève. */
export function poserPlages(t: Toile): void {
  const total = t.largeur * t.hauteur;
  const aPoser: number[] = [];
  for (let c = 0; c < total; c += 1) {
    if (lire(t, c) !== 'plaine') continue;
    if (voisins4(t, c).some((v) => lire(t, v) === 'mer')) aPoser.push(c);
  }
  for (const c of aPoser) poserBrut(t, c, 'plage');
}

/**
 * Passe 3 : rivières descendant du relief vers la mer. Une rivière se franchit
 * à pied et en bottes, jamais en roues ni en chenilles (`04-gameplay.md` §4) :
 * elle coupe donc les blindés, et la passe de réparation posera les ponts.
 */
export function tracerRivieres(t: Toile, rng: Rng, altitude: Float64Array, combien: number): void {
  if (combien <= 0) return;
  const longueurMax = Math.round((t.largeur + t.hauteur) * 0.75);
  const sources = t.cadre.base
    .filter((c) => lire(t, c) !== 'mer')
    .sort((a, b) => (altitude[b] ?? 0) - (altitude[a] ?? 0) || a - b);

  let tracees = 0;
  for (const source of sources) {
    if (tracees >= combien) break;
    if (lire(t, source) === 'riviere') continue;
    if (voisins4(t, source).some((v) => lire(t, v) === 'riviere')) continue;

    let courante = source;
    let pas = 0;
    let atteinteMer = false;
    const vues: number[] = [];
    while (pas < longueurMax) {
      if (lire(t, courante) === 'mer') { atteinteMer = true; break; }
      vues.push(courante);
      const voisins = voisins4(t, courante)
        .filter((v) => !vues.includes(v))
        .sort((a, b) => (altitude[a] ?? 0) - (altitude[b] ?? 0) || a - b);
      const suivante = voisins[0];
      if (suivante === undefined) break;
      if ((altitude[suivante] ?? 0) > (altitude[courante] ?? 0) && rng.chance(0.5)) break;
      courante = suivante;
      pas += 1;
    }
    if (vues.length < 3) continue;
    for (const c of vues) {
      if (lire(t, c) === 'mer') continue;
      poser(t, c, 'riviere');
    }
    if (atteinteMer || vues.length >= 4) tracees += 1;
  }
}

/** Comble les cases de terre isolées et les trous d'eau d'une case. */
export function lisserCotes(t: Toile): void {
  for (let passe = 0; passe < 2; passe += 1) {
    for (const c of t.cadre.base) {
      const terrain = lire(t, c);
      const voisins = voisins4(t, c);
      if (voisins.length < 2) continue;
      if (terrain !== 'mer' && voisins.every((v) => lire(t, v) === 'mer')) {
        poser(t, c, 'mer');
      } else if (terrain === 'mer' && voisins.every((v) => lire(t, v) !== 'mer')) {
        poser(t, c, 'plaine');
      }
    }
  }
}

/**
 * Creuse à travers la mer jusqu'à ce que toutes les terres soient d'un seul tenant.
 * C'est la garantie « aucune zone morte » prise à la racine : une carte dont la
 * terre est connexe n'a pas d'île inatteignable à réparer plus tard.
 */
export function relierTerres(t: Toile): void {
  const total = t.largeur * t.hauteur;
  for (let essai = 0; essai < 6; essai += 1) {
    const { etiquettes, tailles } = composantes(t, 'pied');
    if (tailles.length <= 1) return;
    let principale = 0;
    for (let i = 1; i < tailles.length; i += 1) {
      if ((tailles[i] as number) > (tailles[principale] as number)) principale = i;
    }
    const cible = new Uint8Array(total);
    for (let c = 0; c < total; c += 1) if (etiquettes[c] === principale) cible[c] = 1;

    for (let numero = 0; numero < tailles.length; numero += 1) {
      if (numero === principale) continue;
      const departs: number[] = [];
      for (let c = 0; c < total; c += 1) if (etiquettes[c] === numero) departs.push(c);
      creuserVers(t, departs, cible);
    }
  }
}

/** Trace une langue de plage à travers la mer, du groupe de départ vers la cible. */
function creuserVers(t: Toile, departs: readonly number[], cible: Uint8Array): void {
  const total = t.largeur * t.hauteur;
  const parent = new Int32Array(total).fill(-2);
  const file: number[] = [];
  for (const d of departs) { parent[d] = -1; file.push(d); }
  let arrivee = -1;
  for (let tete = 0; tete < file.length && arrivee === -1; tete += 1) {
    const c = file[tete] as number;
    for (const v of voisins4(t, c)) {
      if (parent[v] !== -2) continue;
      parent[v] = c;
      if (cible[v] === 1) { arrivee = v; break; }
      file.push(v);
    }
  }
  if (arrivee === -1) return;
  let c = arrivee;
  while (c >= 0) {
    if (lire(t, c) === 'mer') poser(t, c, 'plage');
    c = parent[c] as number;
  }
}

/** Vrai si la case est une terre, au sens « pas de la mer ». */
export function estTerre(t: Toile, c: number): boolean {
  return franchissable(lire(t, c), 'pied');
}
