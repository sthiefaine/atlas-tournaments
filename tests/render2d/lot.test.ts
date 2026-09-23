// Le lot de sprites, sans WebGL : l'ordre de peinture, le rangement des
// instances dans le tampon, et le découpage en appels de dessin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CadreResolu, TexturesPage } from '../../src/render2d/atlas';
import { versPlan, type InstanceSprite } from '../../src/render2d/contrat';
import {
  empaqueter, FLOTTANTS_INSTANCE, ordonner, poser, TamponInstances, type Pose, type ResolveurImages,
} from '../../src/render2d/lot';

const PAGE_A: TexturesPage = { couleur: {} as WebGLTexture, masque: {} as WebGLTexture, emission: null };
const PAGE_B: TexturesPage = { couleur: {} as WebGLTexture, masque: null, emission: {} as WebGLTexture };

/** Un cadre de 100 × 80 pixels, pivot en (40, 70), dans une page de 400 × 400. */
function cadre(textures: TexturesPage, echelle = 1): CadreResolu {
  return {
    textures, u0: 0.1, v0: 0.2, u1: 0.35, v1: 0.4, l: 100, h: 80, px: 40, py: 70, echelle,
    masque: textures.masque !== null, emission: textures.emission !== null, repli: false,
  };
}

function inst(entree: string, x: number, y: number, extra: Partial<InstanceSprite> = {}): InstanceSprite {
  return { entree, animation: 0, cadre: 0, x, y, ...extra };
}

const resolveur = (table: Record<string, CadreResolu | null>): ResolveurImages => ({
  resoudre: (i) => table[i.entree] ?? null,
});

test('on peint par calque, puis par ligne, puis par colonne — et l’ordre donné départage', () => {
  const poses: Pose[] = [
    poser('unites', inst('u', 0.5, 0.5)),
    poser('volumes', inst('b', 2.5, 3.5)),
    poser('volumes', inst('a', 5.5, 1.5)),
    poser('volumes', inst('c', 1.5, 3.5)),
    poser('ombres_unites', inst('o', 0.5, 9.5)),
    { calque: 'volumes', ligne: 3.5, colonne: 2.5, instance: inst('mat', 2.9, 3.3) },
  ];
  const ordre = ordonner(poses).map((p) => p.instance.entree);
  // La ligne du bas de l'écran se peint après ; le mât suit son bâtiment, pas sa propre case.
  assert.deepEqual(ordre, ['a', 'c', 'b', 'mat', 'o', 'u']);
});

test('le pivot de l’image tombe sur le point du plan de l’instance, à l’échelle de l’image', () => {
  const t = new TamponInstances();
  const e = empaqueter([poser('unites', inst('x', 3.5, 2.5, { h: 0.5, echelle: 2 }))], resolveur({ x: cadre(PAGE_A, 0.5) }), t);
  assert.equal(e.instances, 1);
  const p = versPlan(3.5, 2.5, 0.5);
  const d = t.donnees;
  // échelle de l'image 0,5 × agrandissement 2 = 1 pixel de plan par pixel
  // d'image. Le tampon est en flottants 32 bits : on compare à un millième.
  const proche = (a: number | undefined, b: number): void => assert.ok(Math.abs((a ?? NaN) - b) < 1e-3, `${a} ≠ ${b}`);
  proche(d[0], p.X - 40);
  proche(d[1], p.Y - 70);
  proche(d[2], p.X - 40 + 100);
  proche(d[3], p.Y - 70 + 80);
  assert.deepEqual([d[4], d[5], d[6], d[7]].map((v) => Math.round(v! * 100) / 100), [0.1, 0.2, 0.35, 0.4]);
});

test('le miroir retourne l’image autour de son pivot, et inverse ses U', () => {
  const t = new TamponInstances();
  empaqueter([poser('unites', inst('x', 1.5, 1.5, { miroir: true }))], resolveur({ x: cadre(PAGE_A) }), t);
  const p = versPlan(1.5, 1.5, 0);
  const d = t.donnees;
  // À droite du pivot il y a maintenant ce qui était à sa gauche : 40 pixels.
  assert.ok(Math.abs(d[0]! - (p.X - (100 - 40))) < 1e-3);
  assert.ok(Math.abs(d[2]! - (p.X + 40)) < 1e-3);
  assert.ok(Math.abs(d[4]! - 0.35) < 1e-6 && Math.abs(d[6]! - 0.1) < 1e-6);
});

test('le masque d’équipe ne s’applique qu’à une image qui en a un, et qu’on teinte', () => {
  const t = new TamponInstances();
  empaqueter([
    poser('unites', inst('masque', 0.5, 0.5, { equipe: [1, 0, 0] })),
    poser('unites', inst('sans', 1.5, 0.5, { equipe: [1, 0, 0] })),
    poser('unites', inst('masque', 2.5, 0.5)),
  ], resolveur({ masque: cadre(PAGE_A), sans: cadre(PAGE_B) }), t);
  const d = t.donnees;
  const masque = (i: number) => d[i * FLOTTANTS_INSTANCE + 11];
  assert.deepEqual([masque(0), masque(1), masque(2)], [1, 0, 0]);
  // L'émission suit la page ; l'opacité, l'éclat et le brouillard ont leur défaut.
  assert.equal(d[1 * FLOTTANTS_INSTANCE + 18], 1);
  assert.equal(d[0 * FLOTTANTS_INSTANCE + 15], 1);
  assert.equal(d[0 * FLOTTANTS_INSTANCE + 16], 0);
  assert.equal(d[0 * FLOTTANTS_INSTANCE + 17], 1);
});

test('un appel de dessin par suite d’instances qui partagent page et calque', () => {
  const t = new TamponInstances();
  const e = empaqueter(ordonner([
    poser('volumes', inst('a', 0.5, 0.5)),
    poser('volumes', inst('a', 1.5, 0.5)),
    poser('volumes', inst('b', 2.5, 0.5)),
    poser('volumes', inst('a', 3.5, 0.5)),
    poser('unites', inst('a', 0.5, 0.5)),
    poser('unites', inst('rien', 1.5, 0.5)),
  ]), resolveur({ a: cadre(PAGE_A), b: cadre(PAGE_B), rien: null }), t);
  assert.equal(e.instances, 5, 'une instance sans image ne se range pas');
  assert.deepEqual(e.groupes.map((g) => [g.calque, g.debut, g.nombre]), [
    ['volumes', 0, 2], ['volumes', 2, 1], ['volumes', 3, 1], ['unites', 4, 1],
  ]);
});

test('le tampon grandit sans perdre ce qu’il porte, et ne rétrécit pas', () => {
  const t = new TamponInstances();
  const avant = t.donnees.length;
  const poses = Array.from({ length: 1000 }, (_, i) => poser('volumes', inst('a', i % 30, Math.floor(i / 30))));
  empaqueter(poses, resolveur({ a: cadre(PAGE_A) }), t);
  assert.ok(t.donnees.length >= 1000 * FLOTTANTS_INSTANCE);
  assert.ok(t.donnees.length > avant);
  const taille = t.donnees.length;
  empaqueter(poses.slice(0, 3), resolveur({ a: cadre(PAGE_A) }), t);
  assert.equal(t.donnees.length, taille);
});

test('opacité, éclat et brouillard sont bornés entre 0 et 1', () => {
  const t = new TamponInstances();
  empaqueter([poser('unites', inst('a', 0.5, 0.5, { opacite: 3, eclat: -2, vue: 7 }))], resolveur({ a: cadre(PAGE_A) }), t);
  const d = t.donnees;
  assert.deepEqual([d[15], d[16], d[17]], [1, 0, 1]);
});
