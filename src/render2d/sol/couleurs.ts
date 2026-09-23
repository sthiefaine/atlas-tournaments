/**
 * Les couleurs du sol : une palette **par biome** — le biome se reconnaît avant
 * tout décor —, teintée par **l'ambiance** du moment (`render/ambiance.ts`).
 *
 * La teinte est un **rapport** : pour chaque matière, la couleur de la palette
 * d'ambiance du moment divisée par celle du printemps clair. L'automne qui
 * roussit l'herbe de l'ambiance roussit donc l'herbe du désert comme celle de
 * la plaine, chacune à partir de la sienne ; la pluie les assombrit toutes.
 *
 * **La nuit n'est pas ici.** Le sol lit la palette de *jour* de la même saison
 * et de la même météo : la nuit est l'affaire de l'étalonnage du moteur 2D,
 * qui la pose d'un seul geste sur le sol et sur les images cuites — cuites,
 * elles, en plein jour. Un sol qui s'assombrirait de lui-même le serait deux
 * fois, et plus que les unités posées dessus.
 *
 * Tout est pur : une clé `biome:saison:meteo` rend toujours le même tableau.
 */

import { ambiance, lireCouleur, melanger, type PaletteTerrain } from '../../render/ambiance';
import type { Biome, Meteo, Saison } from '../../schemas/types';
import { MATIERES, type MatiereSol } from './terrains';

type Hex = string;

/** Deux teintes d'une matière : l'ombre et la lumière de son grain. */
type Paire = readonly [sombre: Hex, clair: Hex];

/** Les matières d'un biome, et les teintes par défaut. */
const DEFAUT: Readonly<Record<MatiereSol | 'neige', Paire>> = {
  herbe: ['#6e934e', '#a2b879'],
  terre: ['#8a7152', '#b19c76'],
  roche: ['#747e89', '#b8bdc0'],
  sable: ['#d6c08f', '#eed9a8'],
  galets: ['#7c8086', '#c3c1ba'],
  pave: ['#8d8a84', '#c4bfb4'],
  sousbois: ['#3c4a2c', '#6e6c46'],
  herbehaute: ['#557a3f', '#93ad64'],
  neige: ['#c9d8ea', '#fbfdff'],
};

/**
 * Les palettes de biome. Herbe, terre, roche et sable sont celles du rendu 3D
 * (`render3d/textures.ts`, `PALETTES`) : les deux peaux montrent le même pays.
 */
const PALETTES: Readonly<Record<Biome, Partial<Record<MatiereSol, Paire>>>> = {
  plaine: { herbe: ['#6e934e', '#a2b879'], terre: ['#987d58', '#b19c76'] },
  foret: {
    herbe: ['#426d48', '#7d995b'], terre: ['#6d6145', '#a18b63'],
    sousbois: ['#34432a', '#5f6440'], herbehaute: ['#3f6b40', '#7d9a58'],
  },
  montagne: { herbe: ['#78835d', '#acb38b'], roche: ['#747e89', '#b8bdc0'], galets: ['#7a8088', '#bfc2c2'] },
  desert: {
    herbe: ['#bb995b', '#dcc38c'], terre: ['#ac764c', '#d5a270'], roche: ['#9b6a51', '#c29474'],
    sable: ['#d9af70', '#f1d59b'], herbehaute: ['#a88f55', '#d0bb82'], sousbois: ['#8d7446', '#b39a68'],
    galets: ['#a0836a', '#d2b596'], pave: ['#b39c7e', '#dcc8a8'],
  },
  jungle: {
    herbe: ['#32734b', '#79a56b'], terre: ['#805c42', '#ab8356'], roche: ['#6b8074', '#a3b2a1'],
    sousbois: ['#2a4a2c', '#4f6d3c'], herbehaute: ['#2d6b3f', '#6fa257'],
  },
  neige: {
    herbe: ['#bac6c7', '#e3e9e7'], terre: ['#9aabb2', '#c1cbd0'], roche: ['#8398aa', '#b7c9d5'],
    sousbois: ['#5b6b64', '#8a9994'],
  },
  volcanique: {
    herbe: ['#666c54', '#8b8964'], terre: ['#574d48', '#827064'], roche: ['#494d56', '#7b7e88'],
    sable: ['#787574', '#a49b8c'], galets: ['#3c3d42', '#6d6c70'], sousbois: ['#3f3f33', '#5f5e48'],
  },
  cotier: { herbe: ['#789563', '#afba84'], roche: ['#8e9392', '#b9b7a9'], sable: ['#d8c49c', '#f0e0b9'] },
  archipel: { herbe: ['#4e9466', '#9ab978'], sable: ['#ddd2b1', '#f4e9cb'] },
  marais: {
    herbe: ['#627a4e', '#96a16b'], terre: ['#686341', '#90865d'], roche: ['#758077', '#a1aa96'],
    sousbois: ['#3d4a30', '#5f6644'], herbehaute: ['#5a6e40', '#8e9a5e'],
  },
};

/** L'accent d'une matière : cailloux, fissures, coquillages, mousse des joints. */
const ACCENTS: Readonly<Record<MatiereSol, Hex>> = {
  herbe: '#efe6a0',
  terre: '#c9bda6',
  roche: '#4b5058',
  sable: '#fbf3e2',
  galets: '#4a4e54',
  pave: '#5f6b4c',
  sousbois: '#7f8f4a',
  herbehaute: '#d9d58c',
};

/**
 * L'accent de ce qui pousse change avec la saison : des fleurs pâles au
 * printemps, l'herbe sèche l'été, les feuilles tombées l'automne, le givre
 * l'hiver. C'est lui, plus que la teinte, qui dit la saison au premier coup d'œil.
 */
const ACCENTS_SAISON: Readonly<Record<Saison, Partial<Record<MatiereSol, Hex>>>> = {
  printemps: { herbe: '#efe6a0', sousbois: '#7f8f4a', herbehaute: '#d9d58c' },
  ete: { herbe: '#c9b86a', sousbois: '#6b5a36', herbehaute: '#cdbf7a' },
  automne: { herbe: '#c4782e', sousbois: '#b8642a', herbehaute: '#c99a4a' },
  hiver: { herbe: '#e6edf3', sousbois: '#9aa3a0', herbehaute: '#d8dccf' },
};

/** La clé de palette d'ambiance qui teinte chaque matière. */
const TEINTE_DE: Readonly<Record<MatiereSol | 'neige', keyof PaletteTerrain>> = {
  herbe: 'herbe',
  terre: 'route',
  roche: 'roche',
  sable: 'sable',
  galets: 'roche',
  pave: 'route',
  sousbois: 'herbeSombre',
  herbehaute: 'herbeSombre',
  neige: 'neige',
};

/** L'eau d'un biome : le large, et les hauts-fonds (les teintes de rive de la 3D). */
const EAUX: Readonly<Record<Biome, readonly [profonde: Hex, claire: Hex]>> = {
  plaine: ['#2a6ea8', '#91b9ad'],
  foret: ['#285f86', '#86ae9e'],
  montagne: ['#2d6a94', '#9cc3c4'],
  desert: ['#2a7ab0', '#8fd0c8'],
  jungle: ['#2f6a6a', '#7fb7a0'],
  neige: ['#3a6f8f', '#b7d6da'],
  volcanique: ['#2c4a5a', '#7d979a'],
  cotier: ['#2b6f96', '#80b9b0'],
  archipel: ['#1f7a9c', '#66c9b3'],
  marais: ['#4a5a3c', '#929b68'],
};

/** Les motifs de chaussée, dans l'ordre des codes que le nuanceur lit. */
export const MOTIFS_VOIE = ['aucun', 'tirets', 'ornieres', 'paves', 'planches', 'fissures'] as const;
export type MotifVoie = typeof MOTIFS_VOIE[number];

/**
 * L'apparence d'une voie dans un biome — reprise de `render3d/textures-voies.ts`
 * (`APPARENCES`) : bitume marqué en plaine, sentier en forêt, pavés en montagne,
 * sable tassé au désert, chaussée déneigée entre deux congères, basalte au
 * volcan, planches en archipel.
 */
export interface ApparenceVoie {
  sombre: Hex;
  clair: Hex;
  accotement: Hex;
  largeurAccotement: number;
  opaciteAccotement: number;
  accotementPlein: boolean;
  demiLargeur: number;
  frange: number;
  motif: MotifVoie;
  couleurMotif: Hex;
  grain: number;
  pont: Hex;
}

const BITUME: ApparenceVoie = {
  sombre: '#4a5056', clair: '#686e72', accotement: '#968d76',
  largeurAccotement: 0.07, opaciteAccotement: 0.55, accotementPlein: false,
  demiLargeur: 0.2, frange: 0.012, motif: 'tirets', couleurMotif: '#d6d0b2',
  grain: 0.55, pont: '#8f8d86',
};

const SENTIER: ApparenceVoie = {
  sombre: '#746046', clair: '#a08a68', accotement: '#60683e',
  largeurAccotement: 0.1, opaciteAccotement: 0.5, accotementPlein: false,
  demiLargeur: 0.17, frange: 0.05, motif: 'ornieres', couleurMotif: '#5c4a34',
  grain: 1, pont: '#7a5a3c',
};

export const APPARENCES_VOIE: Readonly<Record<Biome, ApparenceVoie>> = {
  plaine: BITUME,
  cotier: { ...BITUME, sombre: '#52565a', clair: '#707476', accotement: '#bcac8a' },
  foret: SENTIER,
  jungle: { ...SENTIER, sombre: '#684e38', clair: '#967652', accotement: '#466234' },
  marais: { ...SENTIER, sombre: '#5c543a', clair: '#8c805a', accotement: '#58603c', frange: 0.07 },
  montagne: {
    sombre: '#70747a', clair: '#a0a2a4', accotement: '#767a6e',
    largeurAccotement: 0.06, opaciteAccotement: 0.6, accotementPlein: false,
    demiLargeur: 0.19, frange: 0.02, motif: 'paves', couleurMotif: '#484a50',
    grain: 0.6, pont: '#8a8f94',
  },
  desert: {
    sombre: '#ba9c6c', clair: '#d6bc8a', accotement: '#c8b07e',
    largeurAccotement: 0.12, opaciteAccotement: 0.4, accotementPlein: false,
    demiLargeur: 0.19, frange: 0.06, motif: 'ornieres', couleurMotif: '#a08258',
    grain: 0.7, pont: '#b08e66',
  },
  neige: {
    sombre: '#3a3e46', clair: '#5c6068', accotement: '#ecf2f8',
    largeurAccotement: 0.12, opaciteAccotement: 0.96, accotementPlein: true,
    demiLargeur: 0.18, frange: 0.035, motif: 'tirets', couleurMotif: '#c4bea6',
    grain: 0.45, pont: '#7c8a96',
  },
  volcanique: {
    sombre: '#28282e', clair: '#4c4a50', accotement: '#5a5452',
    largeurAccotement: 0.08, opaciteAccotement: 0.5, accotementPlein: false,
    demiLargeur: 0.2, frange: 0.03, motif: 'fissures', couleurMotif: '#766054',
    grain: 0.8, pont: '#4a4a52',
  },
  archipel: {
    sombre: '#cec0a0', clair: '#f0e6cc', accotement: '#e2d6b6',
    largeurAccotement: 0.08, opaciteAccotement: 0.45, accotementPlein: false,
    demiLargeur: 0.17, frange: 0.04, motif: 'planches', couleurMotif: '#967854',
    grain: 0.9, pont: '#9a7452',
  },
};

/** Ce que la météo fait au sol — les chiffres de la 3D (`render3d/eclairage.ts`, `METEO`). */
const MOUILLE: Readonly<Record<Meteo, number>> = {
  clair: 0, pluie: 0.75, neige: 0.18, brouillard: 0.35, tempete: 0.92, canicule: 0,
};
const OSCILLATION: Readonly<Record<Meteo, number>> = {
  clair: 0.12, pluie: 0.35, neige: 0.2, brouillard: 0.08, tempete: 1, canicule: 0.05,
};

/**
 * La couverture de neige : la météo la pose, l'hiver en laisse, et le biome
 * `neige` en garde toute l'année. Mêmes chiffres que la 3D.
 */
export function neigeAuSol(biome: Biome, saison: Saison, meteo: Meteo): number {
  return Math.min(1, Math.max(meteo === 'neige' ? 1 : 0, saison === 'hiver' ? 0.55 : 0, biome === 'neige' ? 0.78 : 0));
}

/**
 * La disposition du tableau de couleurs : tout ce qui **glisse** d'une ambiance
 * à l'autre tient dans un seul `Float32Array`, que le sol mêle sans allouer
 * pendant une transition, puis envoie par tranches aux uniformes.
 */
export const DISPOSITION = {
  /** `uCouleurs` : huit matières × (sombre, clair, accent). */
  matieres: 0,
  /** `uNeigeCouleurs` : ombre, lumière. */
  neige: 72,
  /** `uEau` : profonde, claire, rivière, écume. */
  eau: 78,
  /** `uFeuillage` : sombre, clair, sommet, tronc — le décor de repli. */
  feuillage: 90,
  /** `uVoie` : sombre, clair, accotement, motif, pont. */
  voie: 102,
  /** `uClimat` : neige, mouillé, agitation, écume. */
  climat: 117,
  total: 121,
} as const;

/** Rapport d'une couleur d'ambiance à sa référence, borné : c'est une teinte, pas un fard. */
function rapport(courante: PaletteTerrain, reference: PaletteTerrain, cle: keyof PaletteTerrain): [number, number, number] {
  const a = lireCouleur(courante[cle]);
  const b = lireCouleur(reference[cle]);
  const borne = (x: number): number => Math.max(0.45, Math.min(1.7, x));
  return [borne((a.r + 8) / (b.r + 8)), borne((a.v + 8) / (b.v + 8)), borne((a.b + 8) / (b.b + 8))];
}

/** Écrit une couleur `#rrggbb` multipliée par un rapport, en flottants de 0 à 1. */
function ecrire(sortie: Float32Array, i: number, hex: Hex, r: readonly [number, number, number] = [1, 1, 1]): void {
  const c = lireCouleur(hex);
  sortie[i] = Math.min(1, (c.r / 255) * r[0]);
  sortie[i + 1] = Math.min(1, (c.v / 255) * r[1]);
  sortie[i + 2] = Math.min(1, (c.b / 255) * r[2]);
}

/** Un rapport adouci : `force` 0 le neutralise, 1 le garde entier. */
function adoucir(r: readonly [number, number, number], force: number): [number, number, number] {
  return [1 + (r[0] - 1) * force, 1 + (r[1] - 1) * force, 1 + (r[2] - 1) * force];
}

const MEMOIRE = new Map<string, Float32Array>();

/**
 * Les couleurs du sol pour un biome sous une ambiance. Mémorisées : la même
 * clé rend le **même** tableau, qu'on ne modifie jamais — le sol en garde une
 * copie de travail pour ses transitions.
 */
export function couleursSol(biome: Biome, saison: Saison, meteo: Meteo): Float32Array {
  const cle = `${biome}:${saison}:${meteo}`;
  const memo = MEMOIRE.get(cle);
  if (memo) return memo;
  const reference = ambiance('printemps', 'jour', 'clair').palette;
  const palette = ambiance(saison, 'jour', meteo).palette;
  const s = new Float32Array(DISPOSITION.total);

  MATIERES.forEach((m, i) => {
    const [sombre, clair] = PALETTES[biome][m] ?? DEFAUT[m];
    const r = rapport(palette, reference, TEINTE_DE[m]);
    const base = DISPOSITION.matieres + i * 9;
    ecrire(s, base, sombre, r);
    ecrire(s, base + 3, clair, r);
    ecrire(s, base + 6, ACCENTS_SAISON[saison][m] ?? ACCENTS[m], r);
  });

  const rNeige = rapport(palette, reference, 'neige');
  ecrire(s, DISPOSITION.neige, DEFAUT.neige[0], rNeige);
  ecrire(s, DISPOSITION.neige + 3, DEFAUT.neige[1], rNeige);

  const [profonde, claire] = EAUX[biome];
  const rEau = rapport(palette, reference, 'eauBas');
  const rRive = rapport(palette, reference, 'eauHaut');
  ecrire(s, DISPOSITION.eau, profonde, rEau);
  ecrire(s, DISPOSITION.eau + 3, claire, rRive);
  // La rivière est un peu plus claire que le large, et suit la teinte de l'ambiance.
  ecrire(s, DISPOSITION.eau + 6, melanger(profonde, claire, 0.28), rapport(palette, reference, 'riviere'));
  ecrire(s, DISPOSITION.eau + 9, melanger(palette.ecume, '#dfeeea', 0.35));

  // Le décor de repli : les couleurs de feuillage de l'ambiance, assourdies
  // vers le sous-bois du biome pour ne pas crier sur un sol réaliste.
  const sousBois = PALETTES[biome].sousbois ?? DEFAUT.sousbois;
  ecrire(s, DISPOSITION.feuillage, melanger(palette.feuillage, sousBois[0], 0.45));
  ecrire(s, DISPOSITION.feuillage + 3, melanger(palette.feuillageClair, sousBois[1], 0.3));
  ecrire(s, DISPOSITION.feuillage + 6, melanger(palette.feuillageSommet, palette.feuillageClair, 0.35));
  ecrire(s, DISPOSITION.feuillage + 9, palette.tronc);

  // Le revêtement ne prend qu'un soupçon de la teinte de saison : une route qui
  // vire au sable en automne se lit comme un chemin de terre (3D, `terrain.ts`).
  const ap = APPARENCES_VOIE[biome];
  const rVoie = adoucir(rapport(palette, reference, 'route'), 0.25);
  ecrire(s, DISPOSITION.voie, ap.sombre, rVoie);
  ecrire(s, DISPOSITION.voie + 3, ap.clair, rVoie);
  ecrire(s, DISPOSITION.voie + 6, ap.accotement, rVoie);
  ecrire(s, DISPOSITION.voie + 9, ap.couleurMotif, rVoie);
  ecrire(s, DISPOSITION.voie + 12, ap.pont, adoucir(rapport(palette, reference, 'pont'), 0.5));

  const agitation = 0.3 + OSCILLATION[meteo] * 0.7;
  s[DISPOSITION.climat] = neigeAuSol(biome, saison, meteo);
  s[DISPOSITION.climat + 1] = MOUILLE[meteo];
  s[DISPOSITION.climat + 2] = agitation;
  s[DISPOSITION.climat + 3] = 0.32 + agitation * 0.36;

  MEMOIRE.set(cle, s);
  return s;
}

/**
 * La forme d'une voie, qui ne glisse pas : `uVoieForme` (demi-largeur, largeur
 * d'accotement, opacité d'accotement, frange) et `uVoieStyle` (motif, grain,
 * accotement plein, réservé).
 */
export function formeVoie(biome: Biome): { forme: Float32Array; style: Float32Array } {
  const ap = APPARENCES_VOIE[biome];
  return {
    forme: Float32Array.of(ap.demiLargeur, ap.largeurAccotement, ap.opaciteAccotement, ap.frange),
    style: Float32Array.of(MOTIFS_VOIE.indexOf(ap.motif), ap.grain, ap.accotementPlein ? 1 : 0, 0),
  };
}

/**
 * Le mélange de deux jeux de couleurs, écrit dans `sortie` : c'est tout ce
 * qu'une transition d'ambiance fait à chaque image, sans rien allouer.
 */
export function melangerCouleurs(depart: Float32Array, arrivee: Float32Array, t: number, sortie: Float32Array): void {
  const k = Math.max(0, Math.min(1, t));
  for (let i = 0; i < sortie.length; i += 1) {
    const a = depart[i] ?? 0;
    sortie[i] = a + ((arrivee[i] ?? 0) - a) * k;
  }
}
