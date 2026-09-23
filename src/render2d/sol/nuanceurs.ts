/**
 * Les nuanceurs du sol, en GLSL ES 3.0 : **une seule passe** peint le terrain,
 * l'eau, les rives, les voies, les ponts, la grille, le décor de repli et le
 * brouillard, sur un quadrilatère qui couvre la carte dans le plan.
 *
 * Toutes les constantes viennent du TypeScript — codes de terrain, bits des
 * voies, couches de détail, lumière de cuisson, emplacements des arbres — et
 * sont écrites dans la source au chargement du module. Rien n'est recopié à la
 * main : une liste recopiée diverge le jour où l'autre change.
 *
 * Ce que le fragment fait, dans l'ordre :
 *
 * 1. Il lit les neuf cases autour de lui (`texelFetch`, une case par texel) et
 *    en tire des **champs** : les poids des huit matières par un noyau lisse
 *    autour des centres — des lisières rondes, pas les losanges d'un filtrage
 *    bilinéaire —, la part de mer, la distance au chenal d'une rivière, et la
 *    distance à la plus proche case cachée. Pendant une marée, il lit aussi
 *    l'état d'avant et **mêle les champs** : la rive glisse, elle ne s'efface pas.
 * 2. Il mélange les matières **par le relief** de leurs textures : là où deux
 *    matières se partagent une lisière, c'est la plus haute qui perce — l'herbe
 *    entre les galets, le sable dans les creux —, et la lisière, déjà déformée
 *    par du bruit, devient naturelle.
 * 3. Neige, humidité, eau et écume, voies, pont, grille, décor de repli.
 * 4. Le brouillard : une case cachée est noire, la transition d'une demi-case
 *    est prise du côté vu.
 * 5. Ce qui dépasse de la case d'en dessous — la frondaison d'un arbre, la
 *    pointe d'une montagne, les brins d'herbe — se peint par-dessus, avec la
 *    visibilité de **sa** case : une montagne vue qui dépasse sur le noir reste
 *    vue, une montagne cachée ne dépasse nulle part.
 *
 * Les dérivées d'écran sont prises **une fois**, en tête, hors de tout
 * branchement ; toutes les lectures de texture passent par `textureGrad` :
 * une lecture ordinaire dans une branche qui dépend du fragment n'a pas de
 * niveau de détail défini, et scintille aux lisières.
 */

import { COS_TANGAGE, PIXELS_PAR_CASE, SIN_TANGAGE } from '../contrat';
import { EMPLACEMENTS_ARBRES, REPLI, TRANSITION_BROUILLARD } from './decor';
import { COUCHES_DETAIL, REPETITIONS, rangCouche } from './details';
import { BITS } from './grille';
import { decalageOmbre, lumiereEcran } from './lumiere';
import { codeDe, MATIERES, NB_CODES } from './terrains';

/** Un flottant GLSL : toujours un point décimal. */
function f(n: number): string {
  const s = n.toFixed(6);
  return s.includes('.') ? s : `${s}.0`;
}

/** Une constante `vec2`/`vec3`. */
function v(...composantes: number[]): string {
  return `vec${composantes.length}(${composantes.map(f).join(', ')})`;
}

/** La hauteur, en cases, du centre d'une frondaison du décor de repli. */
export const HAUT_FRONDAISON = 0.3;

/** Les réglages du nuanceur qui ne sont ni des uniformes ni des tables. */
export const REGLAGES_SOL = {
  /** Demi-largeur du chenal d'une rivière, en cases. */
  demiChenal: 0.3,
  /** Demi-largeur du tablier d'un pont, en cases. */
  demiTablier: 0.32,
  /** Amplitude de la déformation des lisières, en cases. */
  deformation: 0.28,
  /** Ondulation de la rive, en cases. */
  vagueRive: 0.08,
  /** Largeur du sable mouillé au bord de l'eau, en cases. */
  bandeMouillee: 0.08,
  /** Pente du champ de mer à la rive : ce qui le rend comparable à une distance. */
  penteMer: 2.3,
  /** Ce que le relief des textures pèse dans le mélange des matières. */
  reliefMelange: 0.45,
  /** La profondeur du mélange : plus elle est faible, plus la lisière est franche. */
  profondeurMelange: 0.12,
  /** Opacité de la grille au sol. */
  grille: 0.1,
} as const;

/**
 * La force de l'accent de chaque matière : ce que ses fleurs, cailloux ou
 * joints pèsent sur sa couleur.
 */
const ACCENTS_MATIERE: Readonly<Record<(typeof MATIERES)[number], number>> = {
  herbe: 0.6, terre: 0.7, roche: 0.6, sable: 0.5, galets: 0.85, pave: 0.7, sousbois: 0.8, herbehaute: 0.5,
};

const L = lumiereEcran();
const OMBRE = decalageOmbre(HAUT_FRONDAISON);

/** Les noms des terrains dont le nuanceur a besoin, et leur code. */
const CODES = {
  CODE_HERBE_HAUTE: codeDe('herbe_haute'),
  CODE_FORET: codeDe('foret'),
  CODE_MONTAGNE: codeDe('montagne'),
  CODE_RIVIERE: codeDe('riviere'),
  CODE_PONT: codeDe('pont'),
  CODE_MER: codeDe('mer'),
  CODE_VILLE: codeDe('ville'),
  CODE_PORT: codeDe('port'),
} as const;

const DEFINITIONS = [
  `#define PIXELS_PAR_CASE ${f(PIXELS_PAR_CASE)}`,
  `#define SIN_TANGAGE ${f(SIN_TANGAGE)}`,
  `#define COS_TANGAGE ${f(COS_TANGAGE)}`,
  `#define NB_CODES ${NB_CODES}`,
  `#define NB_MATIERES ${MATIERES.length}`,
  ...Object.entries(CODES).map(([nom, code]) => `#define ${nom} ${code}`),
  `#define BIT_VOIE ${BITS.VOIE}`,
  `#define BIT_AXE_EO ${BITS.AXE_EO}`,
  `#define COUCHE_NEIGE ${f(rangCouche('neige'))}`,
  `#define COUCHE_EAU ${f(rangCouche('eau'))}`,
  `#define COUCHE_BRUIT ${f(rangCouche('bruit'))}`,
  `#define COUCHE_ROCHE ${f(rangCouche('roche'))}`,
  `#define REP_NEIGE ${f(REPETITIONS.neige)}`,
  `#define REP_EAU ${f(REPETITIONS.eau)}`,
  `#define REP_BRUIT ${f(REPETITIONS.bruit)}`,
  `#define REPLI_FORET ${REPLI.FORET}`,
  `#define REPLI_MONTAGNE ${REPLI.MONTAGNE}`,
  `#define REPLI_HERBE_HAUTE ${REPLI.HERBE_HAUTE}`,
  `#define TRANSITION_BROUILLARD ${f(TRANSITION_BROUILLARD)}`,
  `#define DEMI_CHENAL ${f(REGLAGES_SOL.demiChenal)}`,
  `#define DEMI_TABLIER ${f(REGLAGES_SOL.demiTablier)}`,
  `#define DEFORMATION ${f(REGLAGES_SOL.deformation)}`,
  `#define VAGUE_RIVE ${f(REGLAGES_SOL.vagueRive)}`,
  `#define BANDE_MOUILLEE ${f(REGLAGES_SOL.bandeMouillee)}`,
  `#define PENTE_MER ${f(REGLAGES_SOL.penteMer)}`,
  `#define RELIEF_MELANGE ${f(REGLAGES_SOL.reliefMelange)}`,
  `#define PROFONDEUR_MELANGE ${f(REGLAGES_SOL.profondeurMelange)}`,
  `#define HAUT_FRONDAISON ${f(HAUT_FRONDAISON)}`,
  `const vec3 LUMIERE_ECRAN = ${v(L[0], L[1], L[2])};`,
  `const vec2 OMBRE_ARBRE = ${v(OMBRE.x, OMBRE.y)};`,
  `const float REPETITIONS[NB_MATIERES] = float[NB_MATIERES](${MATIERES.map((m) => f(REPETITIONS[m])).join(', ')});`,
  `const float ACCENTS[NB_MATIERES] = float[NB_MATIERES](${MATIERES.map((m) => f(ACCENTS_MATIERE[m])).join(', ')});`,
  `const vec2 ARBRES[${EMPLACEMENTS_ARBRES.length}] = vec2[${EMPLACEMENTS_ARBRES.length}](${EMPLACEMENTS_ARBRES.map(([x, y]) => v(x, y)).join(', ')});`,
].join('\n');

/** Le nombre de couches du tableau de détail : le nuanceur ne lit pas au-delà. */
export const NB_COUCHES = COUCHES_DETAIL.length;

/** Le nuanceur de sommets : un quadrilatère du plan, envoyé par la matrice de la caméra. */
export const SOURCE_SOMMET_SOL = `#version 300 es
precision highp float;

in vec2 aCoin;
uniform mat3 uPlanVersDecoupe;
uniform vec4 uRect;
out vec2 vPlan;

void main() {
  vPlan = mix(uRect.xy, uRect.zw, aCoin);
  vec3 d = uPlanVersDecoupe * vec3(vPlan, 1.0);
  gl_Position = vec4(d.xy, 0.0, d.z);
}
`;

/** Le nuanceur de fragments : tout le sol. */
export const SOURCE_FRAGMENT_SOL = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler2DArray;

${DEFINITIONS}

const vec2 BOUTS[4] = vec2[4](vec2(0.5, 0.0), vec2(1.0, 0.5), vec2(0.5, 1.0), vec2(0.0, 0.5));

in vec2 vPlan;
out vec4 sortie;

uniform sampler2D uCases;
uniform sampler2D uCasesAvant;
uniform sampler2DArray uDetails;
uniform ivec2 uTaille;
uniform float uFondu;
uniform float uTemps;
uniform int uRepli;
uniform int uPontCuit;
uniform float uSommets;
uniform vec4 uPoidsA[NB_CODES];
uniform vec4 uPoidsB[NB_CODES];
uniform vec3 uCouleurs[NB_MATIERES * 3];
uniform vec3 uNeigeCouleurs[2];
uniform vec3 uEau[4];
uniform vec3 uFeuillage[4];
uniform vec3 uVoie[5];
uniform vec4 uVoieForme;
uniform vec4 uVoieStyle;
uniform vec4 uClimat;

// Les dérivées d'écran, prises une fois en tête de main().
vec2 dgx;
vec2 dgy;

// ------------------------------------------------------------------ outils

ivec4 lireCase(sampler2D t, ivec2 c) {
  ivec2 b = clamp(c, ivec2(0), uTaille - ivec2(1));
  return ivec4(texelFetch(t, b, 0) * 255.0 + 0.5);
}

bool dansCarte(ivec2 c) {
  return c.x >= 0 && c.y >= 0 && c.x < uTaille.x && c.y < uTaille.y;
}

vec4 detailSol(vec2 g, float repetition, float couche) {
  return textureGrad(uDetails, vec3(g * repetition, couche), dgx * repetition, dgy * repetition);
}

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float unionDouce(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

uint hacher(uvec3 w) {
  w = w * 1664525u + 1013904223u;
  w.x += w.y * w.z; w.y += w.z * w.x; w.z += w.x * w.y;
  w ^= w >> 16u;
  w.x += w.y * w.z; w.y += w.z * w.x; w.z += w.x * w.y;
  return w.x;
}

float alea(ivec2 c, int sel) {
  return float(hacher(uvec3(uvec2(c + ivec2(4096)), uint(sel))) >> 8u) / 16777216.0;
}

float noyau(float d) {
  return 1.0 - smoothstep(0.2, 0.8, d);
}

float merDe(int code, bool dansMer) {
  if (code == CODE_MER) return 1.0;
  // Un quai tient la mer à son bord : vu de l'eau il compte pour de l'eau,
  // vu du quai pour de la terre, et la rive tombe droit sur la limite.
  if (code == CODE_PORT && dansMer) return 1.0;
  return 0.0;
}

float chenal(ivec4 d, vec2 l) {
  if (d.r != CODE_RIVIERE && d.r != CODE_PONT) return 9.0;
  vec2 m = vec2(0.5);
  int bits = d.b & 15;
  float r = length(l - m) - (bits == 0 ? 0.1 : 0.0);
  for (int k = 0; k < 4; k++) {
    if ((bits & (1 << k)) != 0) r = min(r, segment(l, m, BOUTS[k]));
  }
  return r - DEMI_CHENAL;
}

// ------------------------------------------------------------------ champs

struct Champs {
  vec4 a;
  vec4 b;
  float mer;
  float chenal;
  float nuit;
};

Champs lireChamps(sampler2D t, vec2 gw, vec2 g, ivec2 c, bool brume) {
  Champs ch;
  ch.a = vec4(0.0);
  ch.b = vec4(0.0);
  ch.mer = 0.0;
  ch.nuit = 9.0;
  float somme = 0.0;
  ivec4 ici = lireCase(t, c);
  bool dansMer = ici.r == CODE_MER;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      ivec2 v = c + ivec2(dx, dy);
      ivec4 d = lireCase(t, v);
      int code = min(d.r, NB_CODES - 1);
      float k = noyau(distance(gw, vec2(v) + 0.5));
      ch.a += k * uPoidsA[code];
      ch.b += k * uPoidsB[code];
      ch.mer += k * merDe(code, dansMer);
      somme += k;
      if (brume && d.a < 128 && dansCarte(v)) {
        vec2 q = max(max(vec2(v) - g, g - vec2(v) - 1.0), vec2(0.0));
        ch.nuit = min(ch.nuit, length(q));
      }
    }
  }
  float inv = 1.0 / max(somme, 1e-4);
  ch.a *= inv;
  ch.b *= inv;
  ch.mer *= inv;
  ch.chenal = chenal(ici, g - vec2(c));
  return ch;
}

// ------------------------------------------------------------------ matières

vec3 matieres(vec2 g, vec4 pa, vec4 pb, float variation, out float relief) {
  float w[NB_MATIERES] = float[NB_MATIERES](pa.x, pa.y, pa.z, pa.w, pb.x, pb.y, pb.z, pb.w);
  vec4 d[NB_MATIERES];
  float e[NB_MATIERES];
  float emax = -1.0;
  for (int i = 0; i < NB_MATIERES; i++) {
    if (w[i] > 0.02) {
      d[i] = detailSol(g, REPETITIONS[i], float(i));
      e[i] = w[i] + d[i].g * RELIEF_MELANGE;
      emax = max(emax, e[i]);
    } else {
      d[i] = vec4(0.5);
      e[i] = -1.0;
    }
  }
  vec3 col = vec3(0.0);
  float total = 0.0;
  float h = 0.0;
  for (int i = 0; i < NB_MATIERES; i++) {
    float b = max(e[i] - emax + PROFONDEUR_MELANGE, 0.0);
    if (b > 0.0) {
      vec3 c = mix(uCouleurs[i * 3], uCouleurs[i * 3 + 1], d[i].r);
      c = mix(c, uCouleurs[i * 3 + 2], d[i].b * ACCENTS[i]);
      col += c * b;
      h += d[i].g * b;
      total += b;
    }
  }
  float inv = 1.0 / max(total, 1e-4);
  relief = h * inv;
  return col * inv * (0.93 + 0.14 * variation);
}

// ------------------------------------------------------------------ voies

float motifVoie(int motif, float le_long, float travers, bool carrefour, float grain, vec2 g) {
  if (motif == 1) {
    if (carrefour) return 0.0;
    float ligne = 1.0 - smoothstep(0.012, 0.022, abs(travers));
    float f = fract(le_long * 4.0);
    return ligne * smoothstep(0.0, 0.04, f) * (1.0 - smoothstep(0.51, 0.55, f)) * 0.85;
  }
  if (motif == 2) {
    float r = (abs(travers) - uVoieForme.x * 0.55) / 0.035;
    return exp(-r * r) * (0.45 + grain * 0.4);
  }
  if (motif == 3) {
    float pas = 1.0 / 14.0;
    float rang = floor(g.y / pas);
    float u = fract((g.x + mod(rang, 2.0) * pas * 0.5) / pas);
    float w = fract(g.y / pas);
    float joint = min(min(u, 1.0 - u), min(w, 1.0 - w));
    return (1.0 - smoothstep(0.06, 0.17, joint)) * 0.8;
  }
  if (motif == 4) {
    float w = fract(le_long * 12.0);
    float bord = (1.0 - smoothstep(0.04, 0.14, min(w, 1.0 - w))) * 0.7;
    float veine = abs(sin(travers * 90.0 + le_long * 7.0)) > 0.93 ? 0.25 : 0.0;
    return max(bord, veine) - (grain > 0.82 ? 0.5 : 0.0);
  }
  if (motif == 5) {
    return abs(grain - 0.5) < 0.018 ? 0.7 : 0.0;
  }
  return 0.0;
}

vec3 couleurChaussee(vec2 g, float le_long, float travers, bool carrefour) {
  // Le grain du revêtement : la fréquence haute de la couche de bruit, à cinq
  // pixels environ par motif — plus fin, le filtrage l'aplatirait.
  float grain = detailSol(g, 0.4, COUCHE_BRUIT).a;
  vec3 cv = mix(uVoie[0], uVoie[1], clamp(0.5 + (grain - 0.5) * uVoieStyle.y * 1.6, 0.0, 1.0));
  float motif = motifVoie(int(uVoieStyle.x + 0.5), le_long, travers, carrefour, grain, g);
  cv = mix(cv, uVoie[3], clamp(motif, 0.0, 1.0));
  cv = mix(cv, uNeigeCouleurs[1], uClimat.x * 0.5);
  return cv * (1.0 - uClimat.y * 0.22);
}

vec3 chaussee(vec3 col, int bits, vec2 l, vec2 g, float aa, float frange) {
  float w = uVoieForme.x;
  vec2 m = vec2(0.5);
  int n = 0;
  int dir = 0;
  float proche = 9.0;
  for (int k = 0; k < 4; k++) {
    if ((bits & (1 << k)) != 0) {
      n++;
      float s = segment(l, m, BOUTS[k]);
      if (s < proche) {
        proche = s;
        dir = k;
      }
    }
  }
  float centre = length(l - m);
  float d = min(proche, centre - (n == 0 ? w * 0.25 : 0.0)) - w;
  d += (frange - 0.5) * uVoieForme.w * 2.0;
  float plein = 1.0 - smoothstep(-aa, aa, d);
  float acc = (1.0 - smoothstep(0.0, uVoieForme.y, d)) * (1.0 - plein);
  float opac = uVoieStyle.z > 0.5 ? uVoieForme.z * smoothstep(0.0, 0.35, acc) : uVoieForme.z * pow(acc, 1.4);
  col = mix(col, mix(uVoie[2], uNeigeCouleurs[1], uClimat.x * 0.4), opac);
  if (plein > 0.0) {
    bool vertical = dir == 0 || dir == 2;
    vec3 cv = couleurChaussee(g, vertical ? g.y : g.x, vertical ? l.x - 0.5 : l.y - 0.5, centre < w && n > 2);
    col = mix(col, cv, plein);
  }
  return col;
}

vec3 tablier(vec3 col, int bits, vec2 l, vec2 g, float aa, float grain) {
  bool eo = (bits & BIT_AXE_EO) != 0;
  float travers = eo ? l.y - 0.5 : l.x - 0.5;
  float le_long = eo ? g.x : g.y;
  // L'ombre du tablier sur l'eau : la lumière vient de l'avant-gauche, elle
  // tombe à droite d'un pont nord-sud, au nord d'un pont est-ouest.
  float cote = eo ? -travers : travers;
  float ombre = step(DEMI_TABLIER, cote) * (1.0 - smoothstep(DEMI_TABLIER, DEMI_TABLIER + 0.1, cote));
  col *= 1.0 - 0.38 * ombre;
  float dans = 1.0 - smoothstep(DEMI_TABLIER - aa, DEMI_TABLIER + aa, abs(travers));
  if (dans <= 0.0) return col;
  float w = fract(le_long * 10.0);
  float joint = 1.0 - smoothstep(0.0, 0.08, min(w, 1.0 - w));
  vec3 cp = uVoie[4] * (0.92 + 0.12 * grain - 0.18 * joint);
  float chaus = 1.0 - smoothstep(uVoieForme.x - aa, uVoieForme.x + aa, abs(travers));
  cp = mix(cp, couleurChaussee(g, le_long, travers, false), chaus * 0.9);
  float bord = DEMI_TABLIER - abs(travers);
  cp = mix(cp, min(uVoie[4] * 1.25, vec3(1.0)), (1.0 - smoothstep(0.03, 0.045, bord)) * 0.8);
  cp *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.012, bord));
  cp = mix(cp, uNeigeCouleurs[1], uClimat.x * 0.35);
  return mix(col, cp, dans);
}

// ------------------------------------------------------------------ décor de repli

// Un arbre : son ombre au sol (canal a : l'obscurcissement) ou sa frondaison
// et son tronc (couleur non prémultipliée, canal a : couverture).
vec2 pieArbre(ivec2 c, int k, out float taille) {
  vec2 j = vec2(alea(c, 10 + k) - 0.5, alea(c, 20 + k) - 0.5) * vec2(0.07, 0.06);
  taille = 0.9 + 0.2 * alea(c, 30 + k);
  return vec2(c) + ARBRES[k] + j;
}

bool arbrePresent(ivec2 c, int k) {
  int nombre = 3 + int(alea(c, 1) * 3.0);
  // Les trois emplacements tenus, puis le fond au milieu, puis le flanc gauche.
  if (k == 1 || k == 2 || k == 4) return true;
  if (k == 0) return nombre >= 4;
  return nombre >= 5;
}

float ombresArbres(ivec2 c, vec2 g) {
  float o = 0.0;
  for (int k = 0; k < 5; k++) {
    if (!arbrePresent(c, k)) continue;
    float taille;
    vec2 pied = pieArbre(c, k, taille);
    vec2 q = (g - pied - OMBRE_ARBRE * taille) / (vec2(0.17, 0.12) * taille);
    o = max(o, (1.0 - smoothstep(0.55, 1.0, length(q))) * 0.36);
  }
  return o;
}

vec4 arbres(ivec2 c, vec2 P, float aaP, float grain) {
  vec4 res = vec4(0.0);
  for (int k = 0; k < 5; k++) {
    if (!arbrePresent(c, k)) continue;
    float taille;
    vec2 pied = pieArbre(c, k, taille);
    vec2 F = vec2(pied.x, pied.y * SIN_TANGAGE);
    vec2 C = F - vec2(0.0, HAUT_FRONDAISON * COS_TANGAGE * taille);
    float R = 0.19 * taille;
    // Le tronc, sous la frondaison.
    float tronc = (1.0 - smoothstep(0.016 * taille - aaP, 0.016 * taille + aaP, abs(P.x - F.x)))
      * step(C.y, P.y) * (1.0 - smoothstep(F.y - aaP, F.y + aaP, P.y));
    // La frondaison : une boule bosselée, éclairée comme les images cuites.
    vec2 q = (P - C) / R;
    float r = length(q);
    // atan(0, 0) n'est pas défini : le centre exact d'une boule rendrait NaN.
    float bosse = 1.0 + 0.1 * sin(atan(q.y, q.x + 1e-6) * 5.0 + alea(c, 40 + k) * 6.28) + (grain - 0.5) * 0.14;
    float couvre = 1.0 - smoothstep(bosse - aaP / R, bosse + aaP / R, r);
    vec3 n = vec3(q, sqrt(max(0.0, 1.0 - min(r * r, 1.0))));
    float lum = clamp(dot(normalize(n), LUMIERE_ECRAN), 0.0, 1.0);
    vec3 feuilles = mix(uFeuillage[0], uFeuillage[1], clamp(lum * 0.85 + (grain - 0.5) * 0.3, 0.0, 1.0));
    feuilles = mix(feuilles, uFeuillage[2], smoothstep(0.62, 0.95, lum) * 0.35);
    feuilles = mix(feuilles, uNeigeCouleurs[1], smoothstep(0.35, 0.9, lum) * uClimat.x * 0.6);
    vec3 couleur = mix(uFeuillage[3], feuilles, couvre);
    float a = max(tronc, couvre);
    res.rgb = mix(res.rgb, couleur, a);
    res.a = max(res.a, a);
  }
  return res;
}

vec4 montagne(ivec2 c, vec2 P, float aaP, vec2 dPx, vec2 dPy) {
  float h = 0.62 + 0.12 * alea(c, 3);
  vec2 pic = vec2(float(c.x) + 0.5 + (alea(c, 4) - 0.5) * 0.08, (float(c.y) + 0.52) * SIN_TANGAGE - h * COS_TANGAGE);
  float pied = (float(c.y) + 0.52) * SIN_TANGAGE;
  float s = (P.x - pic.x) / 0.43;
  if (abs(s) >= 1.0) return vec4(0.0);
  float as = abs(s);
  float avant = pied + 0.3 * sqrt(1.0 - s * s) * SIN_TANGAGE;
  float haut = pic.y + (pied - pic.y) * pow(as, 0.9)
    + 0.035 * sin(s * 7.0 + alea(c, 5) * 6.28) * (1.0 - as) * as;
  float couvre = smoothstep(haut - aaP, haut + aaP, P.y) * (1.0 - smoothstep(avant - aaP, avant + aaP, P.y));
  if (couvre <= 0.0) return vec4(0.0);
  vec4 roc = textureGrad(uDetails, vec3(P * 2.5, COUCHE_ROCHE), dPx * 2.5, dPy * 2.5);
  // Le versant de gauche prend la lumière, celui de droite est dans l'ombre ;
  // l'arête descend du sommet vers l'avant.
  float arete = pic.x + (P.y - pic.y) * 0.22;
  float eclaire = 1.0 - smoothstep(arete - aaP * 2.0, arete + aaP * 2.0, P.x);
  vec3 roche = mix(uCouleurs[6], uCouleurs[7], roc.r);
  roche = mix(roche, uCouleurs[8], roc.b * 0.4);
  roche *= mix(0.62, 1.05, eclaire);
  float bas = smoothstep(haut, avant, P.y);
  roche *= 1.0 - 0.18 * bas;
  float calotte = max(uSommets, uClimat.x * 0.45);
  float neige = 1.0 - smoothstep(calotte - 0.04, calotte + 0.04, (P.y - pic.y) / max(pied - pic.y, 1e-3) + (roc.g - 0.5) * 0.25);
  vec3 blanc = mix(uNeigeCouleurs[0], uNeigeCouleurs[1], eclaire);
  roche = mix(roche, blanc, neige * step(0.001, calotte));
  // Un liseré sombre sur la crête : la silhouette se détache du sol.
  roche *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.012, P.y - haut));
  return vec4(roche, couvre);
}

// Une touffe d'herbe haute, par sous-case globale : trois brins qui montent.
vec4 touffe(ivec2 s, vec2 P, float aaP) {
  vec2 base = (vec2(s) + 0.5 + (vec2(alea(s, 60), alea(s, 61)) - 0.5) * 0.6) / vec2(5.0, 4.0);
  vec2 Pb = vec2(base.x, base.y * SIN_TANGAGE);
  float haut = 0.1 * (0.8 + 0.4 * alea(s, 62)) * COS_TANGAGE;
  float penche = (alea(s, 63) - 0.5) * 0.02;
  vec4 res = vec4(0.0);
  for (int k = -1; k <= 1; k++) {
    vec2 a = Pb + vec2(float(k) * 0.014, 0.0);
    vec2 b = a + vec2(float(k) * 0.016 + penche, -haut * (k == 0 ? 1.0 : 0.82));
    vec2 ba = b - a;
    float t = clamp(dot(P - a, ba) / dot(ba, ba), 0.0, 1.0);
    float d = length(P - a - ba * t);
    float demi = 0.011 * (1.0 - t) + 0.0015;
    float couvre = 1.0 - smoothstep(demi - aaP * 0.5, demi + aaP * 0.5, d);
    vec3 c = mix(uCouleurs[21], uCouleurs[22], smoothstep(0.0, 0.7, t));
    c = mix(c, uCouleurs[23], smoothstep(0.6, 1.0, t) * 0.6);
    c = mix(c, uNeigeCouleurs[1], uClimat.x * 0.35 * t);
    res.rgb = mix(res.rgb, c, couvre);
    res.a = max(res.a, couvre);
  }
  return res;
}

// ------------------------------------------------------------------ le sol

vec3 sol(ivec2 c, vec2 g, vec2 P, vec4 b0, float aaG, float aaP, vec2 dPx, vec2 dPy, out float vis) {
  vec2 gw = g + (vec2(b0.g, b0.b) - 0.5) * DEFORMATION;
  Champs ch = lireChamps(uCases, gw, g, c, true);
  vis = smoothstep(0.0, TRANSITION_BROUILLARD, ch.nuit);
  if (vis <= 0.0) return vec3(0.0);
  if (uFondu < 0.999) {
    Champs av = lireChamps(uCasesAvant, gw, g, c, false);
    ch.a = mix(av.a, ch.a, uFondu);
    ch.b = mix(av.b, ch.b, uFondu);
    ch.mer = mix(av.mer, ch.mer, uFondu);
    ch.chenal = mix(av.chenal, ch.chenal, uFondu);
  }
  ivec4 ici = lireCase(uCases, c);
  vec2 l = g - vec2(c);
  // Une case bâtie est une cour propre d'un bord à l'autre ; ses voisines
  // gardent leur lisière douce.
  if (ici.r >= CODE_VILLE) {
    float bord = min(min(l.x, 1.0 - l.x), min(l.y, 1.0 - l.y));
    float f = smoothstep(0.0, 0.08, bord);
    ch.a = mix(ch.a, uPoidsA[ici.r], f);
    ch.b = mix(ch.b, uPoidsB[ici.r], f);
  }
  float relief;
  vec3 col = matieres(g, ch.a, ch.b, b0.r, relief);

  // La neige couvre d'abord les creux : c'est le relief qui la découpe.
  if (uClimat.x > 0.001) {
    vec4 dn = detailSol(g, REP_NEIGE, COUCHE_NEIGE);
    float depot = smoothstep(0.04, 0.55, uClimat.x - relief * 0.32 + (b0.a - 0.5) * 0.18);
    vec3 cn = mix(uNeigeCouleurs[0], uNeigeCouleurs[1], dn.r);
    col = mix(col, mix(cn, uNeigeCouleurs[1], dn.b * 0.5), depot);
  }
  // La pluie assombrit, d'abord les creux où l'eau stagne.
  col *= 1.0 - uClimat.y * 0.17 * (0.5 + 0.5 * smoothstep(0.6, 0.2, relief));

  // Le quai : un mur sombre là où le port touche la mer.
  if (ici.r == CODE_PORT) {
    float quai = 9.0;
    for (int k = 0; k < 4; k++) {
      ivec2 o = ivec2(BOUTS[k] * 2.0 - 1.0);
      if (lireCase(uCases, c + o).r == CODE_MER) quai = min(quai, abs(dot(l - BOUTS[k], vec2(o))));
    }
    col *= 1.0 - 0.4 * (1.0 - smoothstep(0.02, 0.05, quai));
  }

  // L'eau : la mer par son étendue, la rivière par son chenal, fondues.
  float sdfMer = (0.5 - ch.mer) / PENTE_MER;
  float sdf = unionDouce(sdfMer, ch.chenal, 0.08) + (b0.b - 0.5) * VAGUE_RIVE;
  // Une grève de sable le long de la mer, même au pied d'un pré : la rive se
  // lit comme une rive. Pas sur un quai, ni au bord d'une rivière, qui a son lit.
  if (ici.r < CODE_VILLE && sdfMer < ch.chenal) {
    float greve = (1.0 - smoothstep(0.02, BANDE_MOUILLEE + 0.04, sdf)) * step(0.0, sdf);
    col = mix(col, mix(uCouleurs[9], uCouleurs[10], 0.6), greve * 0.55);
  }
  if (sdf < BANDE_MOUILLEE + aaG) {
    col *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, BANDE_MOUILLEE, sdf));
    float eau = 1.0 - smoothstep(-aaG, aaG, sdf);
    if (eau > 0.0) {
      float prof = smoothstep(0.0, 0.26, -sdf);
      vec3 large = ch.chenal < sdfMer ? uEau[2] : uEau[0];
      vec3 ce = mix(mix(col, uEau[1], 0.55), large, prof);
      float t = uTemps * (0.018 + 0.03 * uClimat.z);
      vec2 ue = g * REP_EAU;
      vec4 r1 = textureGrad(uDetails, vec3(ue + vec2(t, t * 0.6), COUCHE_EAU), dgx * REP_EAU, dgy * REP_EAU);
      vec4 r2 = textureGrad(uDetails, vec3(ue * 1.7 + vec2(-t * 0.8, t * 0.9), COUCHE_EAU), dgx * REP_EAU * 1.7, dgy * REP_EAU * 1.7);
      ce *= 0.9 + 0.2 * (r1.r + r2.r) * 0.5;
      ce += vec3(0.06) * smoothstep(0.55, 0.95, r1.g * r2.g) * prof;
      ce += vec3(0.1) * smoothstep(0.7, 1.0, r1.b * r2.b * 1.6) * (0.4 + 0.6 * prof);
      float bord = 1.0 - smoothstep(0.0, 0.03, -sdf);
      float vague = sin(-sdf * 38.0 - uTemps * 1.6 + b0.b * 6.0);
      float bande = 1.0 - smoothstep(0.02, 0.14, -sdf);
      float ecume = clamp(max(bord * 0.85, smoothstep(0.55, 0.95, vague) * bande * 0.7) * uClimat.w, 0.0, 1.0);
      col = mix(col, mix(ce, uEau[3], ecume), eau);
    }
  }

  // Les voies : la chaussée d'une route, le tablier d'un pont.
  if ((ici.g & BIT_VOIE) != 0) {
    if (ici.r == CODE_PONT) {
      if (uPontCuit == 0) col = tablier(col, ici.g, l, g, aaG, b0.a);
    } else {
      col = chaussee(col, ici.g, l, g, aaG, b0.a);
    }
  }

  // La grille, un trait d'un pixel : on compte les cases sans les voir.
  vec2 fw = max(abs(dgx) + abs(dgy), vec2(1e-6));
  vec2 dl = abs(fract(g + 0.5) - 0.5) / fw;
  col = mix(col, vec3(0.04, 0.07, 0.12), (1.0 - clamp(min(dl.x, dl.y) - 0.25, 0.0, 1.0)) * ${f(REGLAGES_SOL.grille)});

  // Le décor de repli de la case elle-même, faute d'images cuites.
  if ((uRepli & REPLI_FORET) != 0) {
    // Les ombres portées tombent vers le haut et vers la droite : celles de la
    // case d'en dessous et de celle de gauche débordent sur celle-ci.
    float o = ici.r == CODE_FORET ? ombresArbres(c, g) : 0.0;
    for (int k = 0; k < 2; k++) {
      ivec2 v = c + (k == 0 ? ivec2(0, 1) : ivec2(-1, 0));
      ivec4 voisine = lireCase(uCases, v);
      if (voisine.r == CODE_FORET && voisine.a >= 128 && dansCarte(v)) o = max(o, ombresArbres(v, g));
    }
    col *= 1.0 - o;
    if (ici.r == CODE_FORET) {
      vec4 a = arbres(c, P, aaP, b0.a);
      col = mix(col, a.rgb, a.a);
    }
  }
  if ((uRepli & REPLI_MONTAGNE) != 0 && ici.r == CODE_MONTAGNE) {
    vec4 m = montagne(c, P, aaP, dPx, dPy);
    col = mix(col, m.rgb, m.a);
  }
  if ((uRepli & REPLI_HERBE_HAUTE) != 0 && ici.r == CODE_HERBE_HAUTE) {
    ivec2 s = ivec2(floor(g * vec2(5.0, 4.0)));
    vec4 t = touffe(s, P, aaP);
    // La touffe de la sous-case du dessous monte dans celle-ci, si elle est de la même case.
    ivec2 sd = s + ivec2(0, 1);
    if (sd.y / 4 == c.y) {
      vec4 u = touffe(sd, P, aaP);
      t = vec4(mix(t.rgb, u.rgb, u.a), max(t.a, u.a));
    }
    col = mix(col, t.rgb, t.a);
  }
  return col;
}

// Ce qui dépasse de la case d'en dessous : frondaisons, sommets, brins.
vec4 saillie(ivec2 d, int code, vec2 g, vec2 P, vec4 b0, float aaP, vec2 dPx, vec2 dPy) {
  vec4 res = vec4(0.0);
  if ((uRepli & REPLI_FORET) != 0 && code == CODE_FORET) {
    res = arbres(d, P, aaP, b0.a);
  } else if ((uRepli & REPLI_MONTAGNE) != 0 && code == CODE_MONTAGNE) {
    res = montagne(d, P, aaP, dPx, dPy);
  } else if ((uRepli & REPLI_HERBE_HAUTE) != 0 && code == CODE_HERBE_HAUTE) {
    ivec2 s = ivec2(floor(g * vec2(5.0, 4.0))) + ivec2(0, 1);
    // La division entière tronque vers zéro : une sous-case de la marge du haut
    // passerait pour la première rangée sans ce garde-fou.
    if (s.y >= 0 && s.y / 4 == d.y) res = touffe(s, P, aaP);
  }
  return res;
}

void main() {
  vec2 g = vec2(vPlan.x / PIXELS_PAR_CASE, vPlan.y / (PIXELS_PAR_CASE * SIN_TANGAGE));
  vec2 P = vPlan / PIXELS_PAR_CASE;
  dgx = dFdx(g);
  dgy = dFdy(g);
  vec2 dPx = dFdx(P);
  vec2 dPy = dFdy(P);
  float aaG = max(length(dgx), length(dgy)) * 0.75 + 1e-5;
  float aaP = max(length(dPx), length(dPy)) * 0.75 + 1e-5;
  vec4 b0 = detailSol(g, REP_BRUIT, COUCHE_BRUIT);
  ivec2 c = ivec2(floor(g));

  vec4 couleur = vec4(0.0);
  if (c.y >= 0 && c.x >= 0 && c.x < uTaille.x && c.y < uTaille.y) {
    float vis;
    vec3 col = sol(c, g, P, b0, aaG, aaP, dPx, dPy, vis);
    couleur = vec4(col * vis, 1.0);
  }
  ivec2 d = c + ivec2(0, 1);
  if (uRepli != 0 && dansCarte(d)) {
    ivec4 dessous = lireCase(uCases, d);
    if (dessous.a >= 128) {
      vec4 s = saillie(d, dessous.r, g, P, b0, aaP, dPx, dPy);
      couleur = vec4(s.rgb * s.a, s.a) + couleur * (1.0 - s.a);
    }
  }
  if (couleur.a <= 0.0) discard;
  sortie = couleur;
}
`;

/** Les uniformes que le sol pose : le nuanceur doit tous les déclarer. */
export const UNIFORMES_SOL = [
  'uPlanVersDecoupe', 'uRect', 'uCases', 'uCasesAvant', 'uDetails', 'uTaille', 'uFondu', 'uTemps',
  'uRepli', 'uPontCuit', 'uSommets', 'uPoidsA', 'uPoidsB', 'uCouleurs', 'uNeigeCouleurs', 'uEau',
  'uFeuillage', 'uVoie', 'uVoieForme', 'uVoieStyle', 'uClimat',
] as const;
export type UniformeSol = typeof UNIFORMES_SOL[number];
