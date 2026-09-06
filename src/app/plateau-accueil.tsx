import { t } from '@/i18n/index';
import { paletteDe } from '@/render/palettes';

import carteDemo from '../../content/cartes/carte_plaine_symetrique.json';
import terrainsJson from '../../content/terrains.json';

/**
 * Le **plateau de fond** de l'accueil : un vrai bout de partie, dessiné en SVG.
 *
 * Le principe est celui des écrans-titres qui tiennent : **on montre le jeu, on
 * ne le décrit pas**. Faute d'illustration et de police maison (`BRIEF.md`,
 * direction artistique ; `09-i18n.md` §7.2), l'illustration, c'est le plateau —
 * et il coûte quelques kilo-octets de balisage, là où monter le moteur sur la
 * page d'accueil coûterait le bundle de jeu entier.
 *
 * Ce n'est pas un décor inventé : c'est **la carte d'exhibition elle-même**
 * (`content/cartes/carte_plaine_symetrique.json`), la fenêtre de douze cases sur
 * huit qui entoure l'île — celle que l'attract mode cadre quand il se monte
 * par-dessus. Le fondu de l'un vers l'autre passe donc d'une vue de la carte à
 * une autre vue de la même carte, pas d'une image à un jeu qui ne lui
 * ressemble pas. Si la carte change, le plateau suit ; seule la manœuvre
 * (unités, chemin) est posée à la main, en coordonnées de fenêtre.
 *
 * Les couleurs ne sont pas décoratives, elles sont **celles du jeu**, et chacune
 * dit d'où elle vient :
 * - terrains, eau, forêt, montagne : la palette de chaque terrain dans
 *   `content/terrains.json`, lue ici directement ;
 * - unités et bâtiments : `render/palettes.ts`, importé ;
 * - chaussée, tirets et tablier de pont : l'apparence `BITUME` de la plaine dans
 *   `render3d/textures-voies.ts` (recopiée : ce module tire three.js) ;
 * - vert de déplacement, rouge de tir, flèche à liseré sombre :
 *   `render3d/surbrillances.ts` (même raison).
 * Vert émeraude pour les cases où l'on peut aller, rouge carmin pour celles que
 * l'on peut frapper : quelqu'un qui a joué reconnaît son écran ; quelqu'un qui
 * arrive apprend la grammaire avant même d'avoir cliqué.
 *
 * Le balisage est tenu court parce qu'il part dans le HTML de la première
 * image : l'herbe est un motif répété, chaque couche (eau, rides, vert, rouge)
 * un seul tracé, et ce qui se répète — arbres, montagnes, ponts, bâtiments —
 * est défini une fois et posé par `<use>`.
 *
 * Décoratif au sens strict : `aria-hidden` sur les formes, un `<title>` pour le
 * lecteur d'écran, et jamais un pixel d'interaction.
 */

/** Côté d'une case, en unités de la `viewBox`. */
const C = 40;

/**
 * La fenêtre sur la carte : douze colonnes sur huit rangées, centrées sur le
 * centre exact de la carte (entre les cases 7,5 et 8,6), donc sur l'île et ses
 * deux villes neutres. Un écran en portrait, qui recadre en `slice`, ne garde
 * que les quatre colonnes du milieu : ce sont les ponts et l'île, pas la plaine.
 */
const FENETRE = { x: 2, y: 2, largeur: 12, hauteur: 8 } as const;
const L = FENETRE.largeur;
const H = FENETRE.hauteur;

/** Les lignes de la carte, restreintes à la fenêtre. */
const GRILLE: readonly string[] = carteDemo.grille
  .slice(FENETRE.y, FENETRE.y + H)
  .map((ligne) => ligne.slice(FENETRE.x, FENETRE.x + L));

/** Le caractère de terrain d'une case, lu sur la carte entière au-delà de la fenêtre. */
function car(x: number, y: number): string {
  return carteDemo.grille[y + FENETRE.y]?.[x + FENETRE.x] ?? 'P';
}

/** Les fiches de terrain du canon, par caractère de grille. */
const TERRAINS = new Map(terrainsJson.terrains.map((f) => [f.car, f] as const));

function palette(c: string): { main: string; dark: string; light: string } {
  return (TERRAINS.get(c) ?? TERRAINS.get('P'))?.palette ?? { main: '#7cc36a', dark: '#4e8f43', light: '#b5e3a4' };
}

/** Le coût d'entrée à pied sur un terrain : la colonne `pied` du canon. */
function coutPied(c: string): number {
  const couts = TERRAINS.get(c)?.couts as Partial<Record<string, number>> | undefined;
  return couts?.['pied'] ?? Number.POSITIVE_INFINITY;
}

const PROPRIETAIRES: Readonly<Record<string, number>> = carteDemo.proprietaires;

/** Le camp qui tient un bâtiment de la fenêtre, `null` s'il est neutre. */
function campDe(x: number, y: number): 0 | 1 | null {
  const camp = PROPRIETAIRES[`${x + FENETRE.x},${y + FENETRE.y}`];
  return camp === 0 || camp === 1 ? camp : null;
}

/** Les terrains qui prolongent une voie : voies et bâtiments (`geometrie.ts`, `relieVoie`). */
const RELIE_VOIE = new Set(['R', 'N', 'C', 'U', 'A', 'H', 'T']);
const VOIES = new Set(['R', 'N']);
const BATIS = new Set(['C', 'U', 'A', 'H', 'T']);
const EAU = new Set(['V', 'W']);

/** L'apparence des voies en plaine : `textures-voies.ts`, `BITUME`. */
const CHAUSSEE = 'rgb(104,110,114)';
const TIRETS = 'rgb(214,208,178)';
const TABLIER = '#8f8d86';
/** L'encre des ombres et du liseré de flèche : `surbrillances.ts`. */
const ENCRE = '#0d2419';

/** Cases d'herbe plus claire : la trame irrégulière évite l'effet damier. */
const CLAIRES = [2, 6, 9, 14, 19, 23, 27, 34, 38, 43, 49, 55, 60, 64, 70, 74, 81, 87, 93];

/**
 * L'unité sélectionnée : une infanterie au pied du pont. Pas le char — sa
 * portée de six cases sur route recouvrirait toute la rive, et c'est justement
 * la rive, ses routes et ses ponts, que ce plateau doit montrer.
 */
const ORIGINE = { x: 3, y: 3 };
/** Sa mobilité : celle de l'`infanterie` au catalogue. */
const MOBILITE = 3;
/** Le char du joueur, sur la route derrière elle : traversable, pas une arrivée. */
const ALLIES: readonly [number, number][] = [[2, 3]];
/** Les adversaires : une infanterie qui capture la ville de l'île, un char sur l'autre pont. */
const ADVERSAIRES = [[6, 4], [7, 3]] as const;

const VOISINS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

/**
 * Les cases où l'infanterie peut se poser, **calculées** avec les coûts du canon,
 * comme le fait le moteur : à pied, la rivière et la montagne coûtent double, un
 * adversaire barre le passage, un allié se traverse. Une portée écrite à la main
 * pouvait mentir sur le terrain qu'elle recouvre ; celle-ci ne le peut pas.
 */
function porteeDeplacement(): [number, number][] {
  const bloquees = new Set(ADVERSAIRES.map(([x, y]) => `${x},${y}`));
  const occupees = new Set(ALLIES.map(([x, y]) => `${x},${y}`));
  const meilleur = new Map<string, number>([[`${ORIGINE.x},${ORIGINE.y}`, 0]]);
  const file: [number, number, number][] = [[ORIGINE.x, ORIGINE.y, 0]];
  while (file.length > 0) {
    file.sort((a, b) => b[2] - a[2]);
    const [x, y, cout] = file.pop()!;
    for (const [dx, dy] of VOISINS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= L || ny >= H) continue;
      const k = `${nx},${ny}`;
      const total = cout + coutPied(car(nx, ny));
      if (total > MOBILITE || bloquees.has(k) || (meilleur.get(k) ?? Number.POSITIVE_INFINITY) <= total) continue;
      meilleur.set(k, total);
      file.push([nx, ny, total]);
    }
  }
  return [...meilleur.keys()]
    .filter((k) => !occupees.has(k))
    .map((k) => k.split(',').map(Number) as [number, number]);
}

const DEPLACEMENT = porteeDeplacement();

/**
 * L'enveloppe de tir, calculée exactement comme le fait le contrôleur
 * (`render/controleur.ts`, `porteeAttaque`) : les cases à portée d'une arrivée
 * possible, privées de celles où l'on peut aller. Une case n'est donc jamais des
 * deux couleurs, et le dessin ne peut pas mentir sur la règle qu'il illustre.
 */
function enveloppeDeTir(): [number, number][] {
  const vertes = new Set(DEPLACEMENT.map(([x, y]) => `${x},${y}`));
  const rouges = new Map<string, [number, number]>();
  for (const [x, y] of DEPLACEMENT) {
    for (const [dx, dy] of VOISINS) {
      const c: [number, number] = [x + dx, y + dy];
      const k = `${c[0]},${c[1]}`;
      if (c[0] < 0 || c[1] < 0 || c[0] >= L || c[1] >= H || vertes.has(k)) continue;
      rouges.set(k, c);
    }
  }
  return [...rouges.values()];
}

const ATTAQUE = enveloppeDeTir();

/**
 * Le chemin prévisualisé : l'infanterie franchit le pont, traverse la ville de
 * l'île et vient au contact de celle qui capture l'autre. Un coude, parce que
 * c'est là que la flèche dit quelque chose — un trait droit ne montre pas
 * qu'un déplacement se négocie.
 */
const CHEMIN: readonly [number, number][] = [[3, 3], [4, 3], [5, 3], [5, 4]];

/** Un tracé fait de carrés, un par case, rentrés de `marge` : une couche entière en un élément. */
function carres(cases: readonly (readonly [number, number])[], marge: number): string {
  const cote = C - 2 * marge;
  return cases.map(([x, y]) => `M${x * C + marge} ${y * C + marge}h${cote}v${cote}h${-cote}z`).join('');
}

/** Les cases de la fenêtre dont le terrain passe le filtre. */
function casesOu(filtre: (c: string) => boolean): [number, number][] {
  const r: [number, number][] = [];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < L; x += 1) if (filtre(GRILLE[y]?.[x] ?? 'P')) r.push([x, y]);
  }
  return r;
}

/**
 * Le tracé des voies : un segment du centre de chaque case de voie vers chaque
 * voisine qui la prolonge — voie ou bâtiment, comme `relieVoie`. C'est ce qui
 * donne des routes **continues** qui entrent dans les villes au lieu de
 * rectangles bout à bout. Vers une voisine de voie, un seul des deux segments
 * est tracé (est ou sud) ; vers un bâtiment ou hors de la fenêtre, toujours.
 */
function voiesEnD(): string {
  const parts: string[] = [];
  for (const [x, y] of casesOu((c) => VOIES.has(c))) {
    for (const [dx, dy] of VOISINS) {
      const nx = x + dx;
      const ny = y + dy;
      const voisine = car(nx, ny);
      if (!RELIE_VOIE.has(voisine)) continue;
      const dedans = nx >= 0 && ny >= 0 && nx < L && ny < H;
      if (dedans && VOIES.has(voisine) && (dx < 0 || dy < 0)) continue;
      parts.push(`M${x * C + C / 2} ${y * C + C / 2}l${dx * C} ${dy * C}`);
    }
  }
  return parts.join('');
}

/**
 * Une ride d'eau par case, décalée par la position : c'est déterministe et ça
 * suffit à ce que la rivière ne se lise pas comme un aplat.
 */
function ridesEnD(): string {
  return casesOu((c) => EAU.has(c))
    .map(([x, y]) => `M${x * C + 6 + ((x * 7 + y * 13) % 5) * 3} ${y * C + 13 + ((x + y) % 3) * 8}h14`)
    .join('');
}

/**
 * L'axe d'un pont, lu sur ses voisines comme `axePont` : les voies qu'il relie
 * comptent double, l'eau qu'il franchit compte simple, puisqu'elle est à ses
 * côtés et non dans son axe.
 */
function pontEstOuest(x: number, y: number): boolean {
  const v = (dx: number, dy: number): string => car(x + dx, y + dy);
  const versNs = (RELIE_VOIE.has(v(0, -1)) ? 2 : 0) + (RELIE_VOIE.has(v(0, 1)) ? 2 : 0)
    + (EAU.has(v(1, 0)) ? 1 : 0) + (EAU.has(v(-1, 0)) ? 1 : 0);
  const versEo = (RELIE_VOIE.has(v(1, 0)) ? 2 : 0) + (RELIE_VOIE.has(v(-1, 0)) ? 2 : 0)
    + (EAU.has(v(0, 1)) ? 1 : 0) + (EAU.has(v(0, -1)) ? 1 : 0);
  return versEo > versNs;
}

/**
 * Les formes réutilisées, définies une fois, centrées sur l'origine de leur
 * case : un `<use x y>` les pose. Tablier de pont et parapets ; bouquet
 * d'arbres ; montagne à deux versants et crête claire ; bâtiment aux couleurs
 * d'un camp (un par camp et un neutre : les teintes restent exactement celles
 * de la palette, pas des dérivées par transparence).
 */
function Definitions() {
  const f = palette('F');
  const m = palette('M');
  const large = C * 0.64;
  return <defs>
    <pattern id="h" width={C} height={C} patternUnits="userSpaceOnUse">
      <rect x={2} y={2} width={C - 4} height={C - 4} rx={5} fill={palette('P').main} />
    </pattern>
    <g id="n">
      <rect x={-large / 2} y={-C / 2} width={large} height={C} fill={TABLIER} />
      <path d={`M${-large / 2 + 1.5} ${-C / 2}v${C}M${large / 2 - 1.5} ${-C / 2}v${C}`} stroke={ENCRE} strokeOpacity=".45" strokeWidth={3} />
    </g>
    <g id="f">
      <ellipse cy={13} rx={13} ry={4} fill={ENCRE} opacity=".28" />
      <circle cx={-7} cy={2} r={7} fill={f.main} />
      <circle cx={6} cy={4} r={6} fill={f.dark} />
      <circle cy={-6} r={8} fill={f.light} />
    </g>
    <g id="m">
      <ellipse cy={14} rx={15} ry={4} fill={ENCRE} opacity=".28" />
      <path d="M-16 14L-2-14L4 14z" fill={m.main} />
      <path d="M-2-14L16 14L4 14z" fill={m.dark} />
      <path d="M-6-5L-2-14L3-5L0-3L-3-6z" fill={m.light} />
    </g>
    {([0, 1, null] as const).map((camp) => {
      const p = paletteDe(camp);
      return <g id={`b${camp ?? 'n'}`} key={String(camp)}>
        <ellipse cy={14} rx={14} ry={4} fill={ENCRE} opacity=".3" />
        <rect x={-12} y={-8} width={24} height={22} rx={2} fill={p.main} />
        <rect x={-12} y={-8} width={24} height={5} fill={p.dark} />
        <path d="M-8 0h5v5h-5zM1 0h5v5h-5zM-8 8h5v4h-5zM1 8h5v4h-5z" fill="#f4edda" opacity=".85" />
      </g>;
    })}
  </defs>;
}

/** Un char, silhouette trapue : coque, chenilles, tourelle, canon. */
function Char({ x, y, camp, sens = 1 }: { x: number; y: number; camp: 0 | 1; sens?: 1 | -1 }) {
  const p = paletteDe(camp);
  return <g transform={`translate(${x * C + C / 2} ${y * C + C / 2})`}>
    <ellipse cy={11} rx={15} ry={4.5} fill={ENCRE} opacity=".32" />
    <rect x={-15} y={-2} width={30} height={11} rx={3} fill={p.dark} />
    <rect x={-14} y={-9} width={28} height={11} rx={3} fill={p.main} />
    <rect x={-14} y={-9} width={28} height={3.5} rx={1.5} fill={p.light} opacity=".7" />
    <rect x={-7} y={-15} width={14} height={9} rx={3} fill={p.main} />
    <rect x={sens > 0 ? 6 : -18} y={-12} width={12} height={3} rx={1.5} fill={p.dark} />
  </g>;
}

/** Une infanterie : casque, buste, deux jambes. Assez pour la lire à 40 px. */
function Infanterie({ x, y, camp }: { x: number; y: number; camp: 0 | 1 }) {
  const p = paletteDe(camp);
  return <g transform={`translate(${x * C + C / 2} ${y * C + C / 2})`}>
    <ellipse cy={12} rx={11} ry={4} fill={ENCRE} opacity=".32" />
    <path d="M-7 2h5v9h-5zM2 2h5v9h-5z" fill={p.dark} />
    <rect x={-9} y={-7} width={18} height={11} rx={4} fill={p.main} />
    <rect x={-9} y={-7} width={18} height={3.5} rx={1.75} fill={p.light} opacity=".6" />
    <circle cy={-12} r={6.5} fill={p.main} />
    <path d="M-7-13a7 7 0 0 1 14 0z" fill={p.dark} />
  </g>;
}

/** Le tracé de la flèche de déplacement, corps coudé et pointe. */
function cheminEnD(): string {
  const pts = CHEMIN.map(([x, y]) => [x * C + C / 2, y * C + C / 2] as const);
  const fin = pts[pts.length - 1]!;
  const avant = pts[pts.length - 2]!;
  const dx = Math.sign(fin[0] - avant[0]);
  const dy = Math.sign(fin[1] - avant[1]);
  const tete = 13;
  const corps = [...pts.slice(0, -1), [fin[0] - dx * tete, fin[1] - dy * tete] as const];
  return corps.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join('');
}

/** La pointe de la flèche, un triangle perpendiculaire au dernier pas. */
function pointeEnD(): string {
  const pts = CHEMIN.map(([x, y]) => [x * C + C / 2, y * C + C / 2] as const);
  const fin = pts[pts.length - 1]!;
  const avant = pts[pts.length - 2]!;
  const dx = Math.sign(fin[0] - avant[0]);
  const dy = Math.sign(fin[1] - avant[1]);
  const tete = 13;
  const aile = 11;
  const bx = fin[0] - dx * tete;
  const by = fin[1] - dy * tete;
  return `M${fin[0] + dx * 3} ${fin[1] + dy * 3}`
    + `L${bx - dy * aile} ${by + dx * aile}`
    + `L${bx + dy * aile} ${by - dx * aile}Z`;
}

/** Le centre d'une case, pour poser une forme définie à l'origine. */
function centre([x, y]: readonly [number, number]): { x: number; y: number } {
  return { x: x * C + C / 2, y: y * C + C / 2 };
}

/** Le plateau complet. Aucune interaction : c'est un décor, pas une carte. */
export function PlateauAccueil({ locale }: { locale: string }) {
  const herbe = palette('P');
  const eau = palette('V');
  const claires = CLAIRES.map((i) => [i % L, Math.floor(i / L)] as const).filter(([x, y]) => !EAU.has(car(x, y)) && car(x, y) !== 'N');
  const ponts = casesOu((c) => c === 'N');
  const batis = casesOu((c) => BATIS.has(c));
  const [inf, char] = ADVERSAIRES;
  const curseur = centre(inf);

  // `slice` cadre le plateau comme l'attract mode, qui remplit lui aussi tout
  // l'écran : sans lui, le fondu entre les deux ferait sauter l'échelle.
  return <svg
    className="atlas-plateau" viewBox={`0 0 ${L * C} ${H * C}`}
    preserveAspectRatio="xMidYMid slice" role="img" aria-labelledby="plateau-titre"
  >
    <title id="plateau-titre">{t(locale, 'accueil.plateau_titre')}</title>
    <Definitions />
    <g aria-hidden="true">
      <rect width={L * C} height={H * C} fill="url(#h)" />
      <path d={carres(claires, 4)} fill={herbe.light} opacity=".26" />
      {/* L'eau est pleine jusqu'aux bords : la rivière coule d'une case à l'autre. */}
      <path d={carres(casesOu((c) => EAU.has(c) || c === 'N'), 0)} fill={eau.main} />
      <path d={ridesEnD()} stroke={eau.light} strokeOpacity=".7" strokeWidth={2} strokeLinecap="round" />

      {/* Les ponts passent sous la chaussée, qui les traverse sans rupture. */}
      {ponts.map((c) => {
        const p = centre(c);
        return <use key={`n${c[0]}-${c[1]}`} href="#n" transform={`translate(${p.x} ${p.y})${pontEstOuest(c[0], c[1]) ? ' rotate(90)' : ''}`} />;
      })}
      <path id="v" d={voiesEnD()} fill="none" stroke={CHAUSSEE} strokeWidth={C * 0.4} />
      <use href="#v" stroke={TIRETS} strokeWidth={2} strokeDasharray="6 7" />

      {/* Les surbrillances sont des décalques au sol, comme dans le rendu : le
          vocabulaire exact de `surbrillances.ts`, une assise sombre puis la
          couleur, en un tracé par couche — et ce qui se dresse sur le sol,
          arbres, montagnes, bâtiments, vient par-dessus. */}
      <path d={carres([...DEPLACEMENT, ...ATTAQUE], 2)} fill="#08161d" opacity=".42" />
      <path d={carres(DEPLACEMENT, 2)} fill="#28ec96" opacity=".64" />
      <path d={carres(ATTAQUE, 2)} fill="#ff2e48" opacity=".76" />

      {casesOu((c) => c === 'F').map((c) => <use key={`f${c[0]}-${c[1]}`} href="#f" {...centre(c)} />)}
      {casesOu((c) => c === 'M').map((c) => <use key={`m${c[0]}-${c[1]}`} href="#m" {...centre(c)} />)}
      {batis.map((c) => {
        const p = centre(c);
        const camp = campDe(c[0], c[1]);
        return <g key={`b${c[0]}-${c[1]}`}>
          {/* L'usine se reconnaît à sa cheminée, plantée derrière le toit. */}
          {car(c[0], c[1]) === 'U' ? <rect x={p.x + 5} y={p.y - 16} width={5} height={12} fill={paletteDe(camp).dark} /> : null}
          <use href={`#b${camp ?? 'n'}`} x={p.x} y={p.y} />
        </g>;
      })}

      {/* La flèche, liseré sombre puis cœur clair : elle doit tenir sur le vert. */}
      <path d={cheminEnD()} fill="none" stroke={ENCRE} strokeOpacity=".72" strokeWidth={17} strokeLinecap="round" strokeLinejoin="round" />
      <path d={pointeEnD()} fill={ENCRE} fillOpacity=".72" stroke={ENCRE} strokeOpacity=".72" strokeWidth={6} strokeLinejoin="round" />
      <path d={cheminEnD()} fill="none" stroke="#f4fff6" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
      <path d={pointeEnD()} fill="#f4fff6" />

      <Infanterie x={ORIGINE.x} y={ORIGINE.y} camp={0} />
      {ALLIES.map(([x, y]) => <Char key={`a${x}-${y}`} x={x} y={y} camp={0} />)}
      {/* Les adversaires se tiennent **sur** l'anneau rouge : c'est ce qui donne
          sa raison d'être à la couleur, au lieu d'un halo décoratif. */}
      <Infanterie x={inf[0]} y={inf[1]} camp={1} />
      <Char x={char[0]} y={char[1]} camp={1} sens={-1} />

      {/* Le curseur : le liseré blanc, comme dans le rendu. */}
      <rect className="atlas-plateau-curseur" x={curseur.x - C / 2 + 3} y={curseur.y - C / 2 + 3} width={C - 6} height={C - 6} rx={5} fill="none" stroke="#ffffff" strokeWidth={3} />
    </g>
  </svg>;
}
