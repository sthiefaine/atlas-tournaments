// Le pinceau SVG (`render/sprites/pinceau-svg.ts`) : le dessin des figurines est
// écrit pour un canvas, et doit rendre les mêmes formes en balises sans qu'on le
// redessine une seconde fois. On vérifie ici ce que le canvas garantit et que le
// SVG doit imiter — coordonnées transformées à la pose, pile de `save`/`restore`,
// dégradé devenu définition, ombre en copie floue —, et l'invariant qui ne se
// voit pas à l'œil : deux rendus du même dessin sont identiques au caractère près.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rrPlein } from '../../src/render/sprites/formes';
import { dessinerEnSvg, PinceauSvg } from '../../src/render/sprites/pinceau-svg';
import { dessinerUnite } from '../../src/render/sprites/silhouettes';
import { paletteDe } from '../../src/render/palettes';
import type { Silhouette } from '../../src/schemas/types';

/** Les balises `<path .../>` émises, dans l'ordre. */
function chemins(svg: string): string[] {
  return svg.match(/<path[^>]*\/>/g) ?? [];
}

/**
 * Contrôle de bonne formation, volontairement maison : les balises s'ouvrent et
 * se ferment en pile, et aucun `<` ni `>` ne traîne hors de l'une d'elles. Aucune
 * valeur d'attribut du pinceau ne contient de chevron, la lecture peut donc être
 * naïve — si elle cessait de l'être, c'est ce test qui rougirait le premier.
 */
function bienForme(svg: string): boolean {
  const balise = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  const pile: string[] = [];
  let vues = 0;
  for (let m = balise.exec(svg); m !== null; m = balise.exec(svg)) {
    vues += 1;
    if (m[1] === '/') {
      if (pile.pop() !== m[2]) return false;
    } else if (m[4] !== '/') {
      pile.push(m[2] ?? '');
    }
  }
  const hors = svg.replace(balise, '');
  return vues > 0 && pile.length === 0 && !hors.includes('<') && !hors.includes('>');
}

test('un rectangle arrondi rend un tracé fermé, de la couleur demandée', () => {
  const svg = dessinerEnSvg('0 0 20 20', (g) => rrPlein(g, 0, 0, 10, 10, 2, '#ff0000'));
  const trouve = /<path d="([^"]+)" fill="#ff0000"\/>/.exec(svg);
  assert.ok(trouve, `aucun chemin rouge dans ${svg}`);
  const d = trouve[1] ?? '';
  // `rr` part du haut, après le rayon, et referme la figure.
  assert.ok(d.startsWith('M 2 0'), d);
  assert.ok(d.endsWith(' Z'), d);
  // Le premier point de tangence du premier `arcTo`, puis un arc échantillonné.
  assert.ok(d.includes('L 8 0'), d);
  assert.ok(d.split('L ').length - 1 > 8, `le coin n'est pas arrondi : ${d}`);
  assert.equal(d.split('M ').length - 1, 1);
  assert.ok(!d.includes('NaN'), d);
  assert.ok(bienForme(svg), svg);
  // Un dessin sans dégradé ni ombre n'ouvre aucun `<defs>`.
  assert.ok(!svg.includes('<defs>'), svg);
});

test('translate et scale déplacent les coordonnées, ils ne posent pas de transform', () => {
  const g = new PinceauSvg();
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(1, 2);
  g.translate(10, 5);
  g.scale(2, 3);
  g.lineTo(1, 2);
  g.strokeStyle = '#123456';
  g.stroke();
  const corps = g.corps();
  assert.ok(corps.includes('d="M 0 0 L 1 2 L 12 11"'), corps);
  assert.ok(corps.includes('stroke="#123456"'), corps);
  assert.ok(corps.includes('fill="none"'), corps);
  assert.ok(!corps.includes('transform='), corps);
});

test('une rotation tourne le tracé lui-même', () => {
  const g = new PinceauSvg();
  g.rotate(Math.PI / 2);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(10, 0);
  g.fill();
  // Un quart de tour envoie l'axe des x sur celui des y.
  assert.ok(g.corps().includes('d="M 0 0 L 0 10"'), g.corps());
});

test("l'épaisseur d'un trait suit la mise à l'échelle", () => {
  const g = new PinceauSvg();
  g.lineWidth = 3;
  g.lineCap = 'round';
  g.scale(2, 2);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(5, 0);
  g.stroke();
  assert.ok(g.corps().includes('stroke-width="6"'), g.corps());
  assert.ok(g.corps().includes('stroke-linecap="round"'), g.corps());
});

test('restore rend la matrice et les styles que save avait mis de côté', () => {
  const g = new PinceauSvg();
  g.fillStyle = '#111111';
  g.save();
  g.translate(10, 10);
  g.fillStyle = '#222222';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(1, 1);
  g.fill();
  g.restore();
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(1, 1);
  g.fill();
  const emis = chemins(g.corps());
  assert.equal(emis.length, 2);
  assert.ok((emis[0] ?? '').includes('d="M 10 10 L 11 11"'), emis[0]);
  assert.ok((emis[0] ?? '').includes('fill="#222222"'), emis[0]);
  assert.ok((emis[1] ?? '').includes('d="M 0 0 L 1 1"'), emis[1]);
  assert.ok((emis[1] ?? '').includes('fill="#111111"'), emis[1]);
});

test('un fill ne vide pas le tracé, un beginPath oui', () => {
  const g = new PinceauSvg();
  g.fillStyle = '#abcdef';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(2, 0);
  g.fill();
  g.fill();
  const emis = chemins(g.corps());
  assert.equal(emis.length, 2);
  assert.equal(emis[0], emis[1]);
  g.beginPath();
  g.fill();
  assert.equal(chemins(g.corps()).length, 2, 'un tracé vide ne doit rien émettre');
});

test('un dégradé devient une définition, référencée par url(#…)', () => {
  const g = new PinceauSvg({ prefixeId: 'test' });
  const degrade = g.createLinearGradient(0, -10, 0, 10);
  degrade.addColorStop(0, '#aaaaaa');
  degrade.addColorStop(1, '#bbbbbb');
  g.fillStyle = degrade;
  g.beginPath();
  g.moveTo(-5, -5);
  g.lineTo(5, -5);
  g.lineTo(0, 5);
  g.closePath();
  g.fill();
  const defs = g.defs();
  assert.ok(defs.includes('<linearGradient id="test-1"'), defs);
  assert.ok(defs.includes('gradientUnits="userSpaceOnUse" x1="0" y1="-10" x2="0" y2="10"'), defs);
  assert.ok(defs.includes('<stop offset="0" stop-color="#aaaaaa"/>'), defs);
  assert.ok(defs.includes('<stop offset="1" stop-color="#bbbbbb"/>'), defs);
  assert.ok(g.corps().includes('fill="url(#test-1)"'), g.corps());
  const svg = g.svg('0 0 10 10', 'width="10"');
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10">'), svg);
  assert.ok(svg.includes('<defs><linearGradient'), svg);
  assert.ok(bienForme(svg), svg);
});

test("une ombre allumée fait précéder la forme d'une copie floue et décalée", () => {
  const g = new PinceauSvg({ prefixeId: 'o' });
  g.shadowColor = 'rgba(0,0,0,0.28)';
  g.shadowBlur = 8;
  g.shadowOffsetY = 4;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(4, 0);
  g.lineTo(4, 4);
  g.closePath();
  g.fill();
  const emis = chemins(g.corps());
  assert.equal(emis.length, 2);
  assert.ok((emis[0] ?? '').includes('fill="rgba(0,0,0,0.28)"'), emis[0]);
  assert.ok((emis[0] ?? '').includes('filter="url(#o-1)"'), emis[0]);
  assert.ok((emis[0] ?? '').includes('transform="translate(0,4)"'), emis[0]);
  assert.ok((emis[1] ?? '').includes('fill="#ffffff"'), emis[1]);
  assert.ok(!(emis[1] ?? '').includes('filter='), emis[1]);
  // Le flou du canvas est un diamètre, l'écart-type d'une gaussienne en est la moitié.
  assert.ok(g.defs().includes('<feGaussianBlur stdDeviation="4"/>'), g.defs());
  // Ombre éteinte : plus de copie, et le filtre déjà défini n'est pas redéfini.
  g.shadowColor = 'transparent';
  g.shadowBlur = 0;
  g.fill();
  assert.equal(chemins(g.corps()).length, 3);
  assert.equal(g.defs().split('<filter').length - 1, 1);
});

test('arcTo se rabat sur un segment quand le coin est plat ou le rayon nul', () => {
  const plat = new PinceauSvg();
  plat.beginPath();
  plat.moveTo(0, 0);
  plat.arcTo(5, 0, 10, 0, 3);
  plat.fill();
  assert.ok(plat.corps().includes('d="M 0 0 L 5 0"'), plat.corps());

  const sansRayon = new PinceauSvg();
  sansRayon.beginPath();
  sansRayon.moveTo(0, 0);
  sansRayon.arcTo(5, 0, 5, 5, 0);
  sansRayon.fill();
  assert.ok(sansRayon.corps().includes('d="M 0 0 L 5 0"'), sansRayon.corps());
});

test('un cercle entier est bien un tour complet, une demi-lune une moitié', () => {
  const entier = new PinceauSvg();
  entier.beginPath();
  entier.arc(0, 0, 10, 0, Math.PI * 2);
  entier.fill();
  const dEntier = /d="([^"]+)"/.exec(entier.corps())?.[1] ?? '';
  assert.ok(dEntier.startsWith('M 10 0'), dEntier);
  assert.ok(dEntier.endsWith('L 10 0'), `un tour complet doit revenir à son départ : ${dEntier}`);
  assert.ok(dEntier.includes('L -10 0'), dEntier);

  const moitie = new PinceauSvg();
  moitie.beginPath();
  moitie.arc(0, 0, 10, Math.PI, 0);
  moitie.fill();
  const dMoitie = /d="([^"]+)"/.exec(moitie.corps())?.[1] ?? '';
  // Le sens horaire du canvas mène de la gauche au sommet (y vers le bas), puis à droite.
  assert.ok(dMoitie.startsWith('M -10 0'), dMoitie);
  assert.ok(dMoitie.includes('L 0 -10'), dMoitie);
  assert.ok(dMoitie.endsWith('L 10 0'), dMoitie);
  assert.ok(dMoitie.split('L ').length < dEntier.split('L ').length, 'la moitié doit tenir en moins de points');
});

/** Les six silhouettes du canon, telles que le catalogue les déclare. */
const SILHOUETTES: readonly Silhouette[] = [
  { base: 'pattes', corps: 'capsule', modules: [], taille: 1 },
  { base: 'pattes', corps: 'capsule', modules: ['lance_roquettes'], taille: 1 },
  { base: 'pattes', corps: 'capsule', modules: ['radar'], taille: 1 },
  { base: 'chenilles', corps: 'bloc', modules: ['tourelle'], taille: 2 },
  { base: 'chenilles', corps: 'plateau', modules: ['canon_long'], taille: 2 },
  { base: 'chenilles', corps: 'plateau', modules: ['grue'], taille: 2 },
];

test('les six silhouettes du canon se rendent en SVG bien formé', () => {
  for (const silhouette of SILHOUETTES) {
    const nom = `${silhouette.base}/${silhouette.corps}/${silhouette.modules.join('+') || 'nu'}`;
    const svg = dessinerEnSvg(
      '-48 -48 96 96',
      (g) => dessinerUnite(g, silhouette, paletteDe(0)),
    );
    assert.ok(svg.startsWith('<svg'), nom);
    assert.ok(svg.endsWith('</svg>'), nom);
    assert.ok(chemins(svg).length >= 12, `${nom} : ${chemins(svg).length} tracés seulement`);
    assert.ok(!svg.includes('NaN'), `${nom} porte un NaN`);
    assert.ok(!svg.includes('undefined'), `${nom} porte un undefined`);
    assert.ok(bienForme(svg), `${nom} n'est pas bien formé`);
  }
});

test('deux rendus du même dessin sont identiques au caractère près', () => {
  for (const silhouette of SILHOUETTES) {
    const rendre = (): string => dessinerEnSvg(
      '-48 -48 96 96',
      (g) => dessinerUnite(g, silhouette, paletteDe(0)),
    );
    assert.equal(rendre(), rendre());
  }
  // Y compris les identifiants de `<defs>`, qui sont numérotés et non tirés au sort.
  const avec = dessinerEnSvg(
    '-48 -48 96 96',
    (g) => dessinerUnite(g, { base: 'chenilles', corps: 'bloc', modules: ['tourelle'], taille: 2 }, paletteDe(0)),
    { prefixeId: 'u' },
  );
  assert.ok(avec.includes('id="u-1"'), avec.slice(0, 400));
});
