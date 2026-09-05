import { t } from '@/i18n/index';

/**
 * Le **plateau de fond** de l'accueil : un vrai bout de partie, dessiné à la
 * main en SVG.
 *
 * Le principe est celui des écrans-titres qui tiennent : **on montre le jeu, on
 * ne le décrit pas**. Faute d'illustration et de police maison (`BRIEF.md`,
 * direction artistique ; `09-i18n.md` §7.2), l'illustration, c'est le plateau —
 * et il coûte quelques kilo-octets de balisage, là où monter le moteur sur la
 * page d'accueil coûterait les 230 ko du bundle de jeu.
 *
 * Les couleurs ne sont pas décoratives : ce sont **exactement** celles du rendu
 * (`render/scene.ts`, `render/palettes.ts`). Vert émeraude pour les cases où
 * l'on peut aller, rouge carmin pour celles que l'on peut frapper, flèche
 * blanche à liseré sombre vers la case d'arrivée. Quelqu'un qui a joué
 * reconnaît son écran ; quelqu'un qui arrive apprend la grammaire avant même
 * d'avoir cliqué.
 *
 * Décoratif au sens strict : `aria-hidden` sur les formes, un `<title>` pour le
 * lecteur d'écran, et jamais un pixel d'interaction.
 */

/** Côté d'une case, en unités de la `viewBox`. */
const C = 40;

/** Colonnes et rangées du plateau. Sept rangées : de quoi lire une manœuvre
 * complète sans pousser le pied de page sous la ligne de flottaison. */
const L = 11;
const H = 7;

/** Cases d'herbe claire : la trame irrégulière évite l'effet damier. */
const CLAIRES = new Set([2, 6, 9, 14, 19, 23, 27, 34, 38, 43, 49, 55, 60, 64, 70, 74]);

/** L'unité sélectionnée : c'est d'elle que partent les deux portées. */
const ORIGINE = { x: 3, y: 3 };

/**
 * Les cases où le char peut se poser. Elles sont **écrites à la main** et non
 * calculées en losange : une portée de déplacement réelle n'est jamais un
 * losange parfait — les forêts coûtent cher, les routes ne coûtent rien —, et
 * un losange se lit comme une figure de géométrie, pas comme un tour de jeu.
 */
const DEPLACEMENT: readonly [number, number][] = [
  [2, 1], [3, 1], [4, 1], [5, 1],
  [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
  [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
  [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4],
  [2, 5], [3, 5], [4, 5], [5, 5],
];

/**
 * L'enveloppe de tir, **calculée** exactement comme le fait le contrôleur
 * (`render/controleur.ts`, `porteeAttaque`) : les cases à portée d'une arrivée
 * possible, privées de celles où l'on peut aller. Une case n'est donc jamais des
 * deux couleurs, et le dessin ne peut pas mentir sur la règle qu'il illustre.
 */
function enveloppeDeTir(): [number, number][] {
  const vertes = new Set(DEPLACEMENT.map(([x, y]) => `${x},${y}`));
  const rouges = new Map<string, [number, number]>();
  for (const [x, y] of DEPLACEMENT) {
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
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
 * Le chemin prévisualisé : le char contourne par le nord pour arriver au contact
 * du char adverse. Deux coudes, parce que c'est là que la flèche dit quelque
 * chose — un trait droit ne montre pas qu'un déplacement se négocie.
 */
const CHEMIN: readonly [number, number][] = [[3, 3], [3, 2], [4, 2], [5, 2], [6, 2], [6, 3]];

/** Une case pleine, arrondie comme dans le rendu 2D. */
function Case({ x, y, fill, opacity }: { x: number; y: number; fill: string; opacity?: number }) {
  return <rect x={x * C + 2} y={y * C + 2} width={C - 4} height={C - 4} rx={5} fill={fill} opacity={opacity} />;
}

/** Un bouquet d'arbres : trois disques et un tronc, comme la forêt du rendu. */
function Foret({ x, y }: { x: number; y: number }) {
  const cx = x * C + C / 2;
  const cy = y * C + C / 2;
  return <g>
    <ellipse cx={cx} cy={cy + 13} rx={13} ry={4} fill="#0d2a18" opacity=".28" />
    <circle cx={cx - 7} cy={cy + 2} r={7} fill="#e07a2f" />
    <circle cx={cx + 6} cy={cy + 4} r={6} fill="#c9631f" />
    <circle cx={cx} cy={cy - 6} r={8} fill="#f08c3a" />
  </g>;
}

/** Un bâtiment capturable, aux couleurs d'un camp. */
function Batiment({ x, y, main, dark }: { x: number; y: number; main: string; dark: string }) {
  const px = x * C + 8;
  const py = y * C + 6;
  return <g>
    <ellipse cx={px + 12} cy={py + 28} rx={14} ry={4} fill="#0d2a18" opacity=".3" />
    <rect x={px} y={py + 6} width={24} height={22} rx={2} fill={main} />
    <rect x={px} y={py + 6} width={24} height={5} fill={dark} />
    <g fill="#f4edda" opacity=".85">
      <rect x={px + 4} y={py + 14} width={5} height={5} />
      <rect x={px + 13} y={py + 14} width={5} height={5} />
      <rect x={px + 4} y={py + 22} width={5} height={4} />
      <rect x={px + 13} y={py + 22} width={5} height={4} />
    </g>
  </g>;
}

/** Un char, silhouette trapue : coque, chenilles, tourelle, canon. */
function Char({ x, y, main, dark, light, sens = 1 }: {
  x: number; y: number; main: string; dark: string; light: string; sens?: 1 | -1;
}) {
  const cx = x * C + C / 2;
  const cy = y * C + C / 2;
  return <g transform={`translate(${cx} ${cy})`}>
    <ellipse cy={11} rx={15} ry={4.5} fill="#0d2a18" opacity=".32" />
    <rect x={-15} y={-2} width={30} height={11} rx={3} fill={dark} />
    <rect x={-14} y={-9} width={28} height={11} rx={3} fill={main} />
    <rect x={-14} y={-9} width={28} height={3.5} rx={1.5} fill={light} opacity=".7" />
    <rect x={-7} y={-15} width={14} height={9} rx={3} fill={main} />
    <rect x={sens > 0 ? 6 : -18} y={-12} width={12} height={3} rx={1.5} fill={dark} />
  </g>;
}

/** Une infanterie : casque, buste, deux jambes. Assez pour la lire à 40 px. */
function Infanterie({ x, y, main, dark, light }: {
  x: number; y: number; main: string; dark: string; light: string;
}) {
  const cx = x * C + C / 2;
  const cy = y * C + C / 2;
  return <g transform={`translate(${cx} ${cy})`}>
    <ellipse cy={12} rx={11} ry={4} fill="#0d2a18" opacity=".32" />
    <rect x={-7} y={2} width={5} height={9} rx={2} fill={dark} />
    <rect x={2} y={2} width={5} height={9} rx={2} fill={dark} />
    <rect x={-9} y={-7} width={18} height={11} rx={4} fill={main} />
    <rect x={-9} y={-7} width={18} height={3.5} rx={1.75} fill={light} opacity=".6" />
    <circle cy={-12} r={6.5} fill={main} />
    <path d="M-7-13a7 7 0 0 1 14 0z" fill={dark} />
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

/** Le plateau complet. Aucune interaction : c'est un décor, pas une carte. */
export function PlateauAccueil({ locale }: { locale: string }) {
  const cases: React.ReactElement[] = [];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < L; x += 1) {
      const i = y * L + x;
      cases.push(<Case key={`h${i}`} x={x} y={y} fill={CLAIRES.has(i) ? '#8fce5c' : '#7ec04e'} />);
    }
  }

  return <svg className="atlas-plateau" viewBox={`0 0 ${L * C} ${H * C}`} role="img" aria-labelledby="plateau-titre">
    <title id="plateau-titre">{t(locale, 'accueil.plateau_titre')}</title>
    <g aria-hidden="true">
      {cases}

      <Foret x={10} y={0} />
      <Foret x={9} y={1} />
      <Foret x={0} y={0} />
      <Foret x={10} y={5} />
      <Foret x={9} y={6} />
      <Batiment x={8} y={5} main="#b9bec7" dark="#7c828c" />
      <Batiment x={10} y={3} main="#e04b45" dark="#96292a" />
      <Batiment x={0} y={5} main="#3f86e0" dark="#255a9e" />

      {/* Les surbrillances : le vocabulaire exact du rendu (`scene.ts`). */}
      <g>
        {DEPLACEMENT.map(([x, y]) => <Case key={`d${x}-${y}`} x={x} y={y} fill="#08161d" opacity={0.42} />)}
        {DEPLACEMENT.map(([x, y]) => <Case key={`v${x}-${y}`} x={x} y={y} fill="#28ec96" opacity={0.64} />)}
        {ATTAQUE.map(([x, y]) => <Case key={`o${x}-${y}`} x={x} y={y} fill="#08161d" opacity={0.42} />)}
        {ATTAQUE.map(([x, y]) => <Case key={`r${x}-${y}`} x={x} y={y} fill="#ff2640" opacity={0.76} />)}
      </g>

      {/* La flèche, liseré sombre puis cœur clair : elle doit tenir sur le vert. */}
      <path d={cheminEnD()} fill="none" stroke="#102a1c" strokeOpacity=".72" strokeWidth={17} strokeLinecap="round" strokeLinejoin="round" />
      <path d={pointeEnD()} fill="#102a1c" fillOpacity=".72" stroke="#102a1c" strokeOpacity=".72" strokeWidth={6} strokeLinejoin="round" />
      <path d={cheminEnD()} fill="none" stroke="#f4fff6" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
      <path d={pointeEnD()} fill="#f4fff6" />

      <Char x={ORIGINE.x} y={ORIGINE.y} main="#3f86e0" dark="#255a9e" light="#8dbdf5" />
      <Infanterie x={2} y={4} main="#3f86e0" dark="#255a9e" light="#8dbdf5" />
      {/* Les adversaires se tiennent **sur** l'anneau rouge : c'est ce qui donne
          sa raison d'être à la couleur, au lieu d'un halo décoratif. */}
      <Infanterie x={7} y={2} main="#e04b45" dark="#96292a" light="#f59a95" />
      <Char x={7} y={3} main="#e04b45" dark="#96292a" light="#f59a95" sens={-1} />

      {/* Le curseur : le liseré blanc, comme dans les deux rendus. */}
      <rect className="atlas-plateau-curseur" x={7 * C + 3} y={3 * C + 3} width={C - 6} height={C - 6} rx={5} fill="none" stroke="#ffffff" strokeWidth={3} />
    </g>
  </svg>;
}
