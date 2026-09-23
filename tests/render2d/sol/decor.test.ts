// Le placement du décor : quelles images, où, combien — et rien sous le noir.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  idDecor, VERSION_SPRITES, type AnimationSprite, type EntreeSprite, type EssenceDecor,
  type ManifesteSprites, type SaisonDecor, type VueSprite,
} from '../../../src/render2d/contrat';
import {
  aleaCase, animationDeVue, CHANCE_BUISSON, EMPLACEMENTS_ARBRES, essenceMontagne, ID_PONT,
  placerDecor, placesDeCase, pontCuit, REPLI, repliDecor, variantesPresentes, visibiliteEn, vuePont,
} from '../../../src/render2d/sol/decor';
import { BIOMES, type Biome } from '../../../src/schemas/types';
import { grilleDe } from './aides';

/** Une animation d'une image, dans une vue. */
function animation(vue: VueSprite, clip: AnimationSprite['clip'] = 'repos'): AnimationSprite {
  return { vue, clip, boucle: true, ips: 12, cadres: [{ page: 0, x: 0, y: 0, l: 10, h: 10, px: 5, py: 9 }] };
}

function entree(id: string, famille: EntreeSprite['famille'], vues: VueSprite[] = ['fixe']): EntreeSprite {
  return {
    id, famille, cle: id, source: { fichier: `${id}.glb`, sha256: '0' },
    pages: [{ couleur: `assets/sprites/${id}.webp`, largeur: 10, hauteur: 10 }],
    animations: vues.map((v) => animation(v)),
  };
}

/** Un manifeste qui porte les essences demandées, deux variantes chacune. */
function manifeste(essences: readonly (readonly [EssenceDecor, SaisonDecor])[], autres: EntreeSprite[] = []): ManifesteSprites {
  const entrees: Record<string, EntreeSprite> = {};
  for (const [e, s] of essences) {
    for (const n of [1, 2]) {
      const id = idDecor(e, s, n);
      entrees[id] = entree(id, 'decor');
    }
  }
  for (const a of autres) entrees[a.id] = a;
  return { version: VERSION_SPRITES, pixelsParCase: 128, tangage: 50, tangageProfil: 12, entrees };
}

const TOUT: readonly (readonly [EssenceDecor, SaisonDecor])[] = [
  ['feuillu', 'toutes'], ['conifere', 'toutes'], ['palmier', 'toutes'], ['tropical', 'toutes'],
  ['buisson', 'toutes'], ['touffe', 'toutes'], ['roseau', 'toutes'], ['montagne', 'toutes'],
  ['montagne_aride', 'toutes'], ['montagne_volcan', 'toutes'],
];

/** Une grande grille d'un seul terrain, pour mesurer des densités. */
function uniforme(car: string, taille = 40): ReturnType<typeof grilleDe> {
  return grilleDe(Array.from({ length: taille }, () => car.repeat(taille)));
}

test('l’aléa de case est déterministe, dans [0, 1), et ne se répète pas d’une case à l’autre', () => {
  assert.equal(aleaCase(3, 7, 11), aleaCase(3, 7, 11));
  const vus = new Set<number>();
  for (let x = 0; x < 20; x += 1) {
    for (let y = 0; y < 20; y += 1) {
      const a = aleaCase(x, y, 1);
      assert.ok(a >= 0 && a < 1);
      vus.add(a);
    }
  }
  assert.ok(vus.size > 390);
});

test('les identifiants : la saison d’abord, puis « toutes », les seules variantes présentes', () => {
  const m = manifeste([['feuillu', 'automne'], ['feuillu', 'toutes'], ['conifere', 'toutes']]);
  delete m.entrees[idDecor('feuillu', 'automne', 1)];
  m.entrees[idDecor('feuillu', 'automne', 5)] = entree(idDecor('feuillu', 'automne', 5), 'decor');
  assert.deepEqual(variantesPresentes(m, 'feuillu', 'automne'), ['decor_feuillu_automne_2', 'decor_feuillu_automne_5']);
  assert.deepEqual(variantesPresentes(m, 'feuillu', 'hiver'), ['decor_feuillu_toutes_1', 'decor_feuillu_toutes_2']);
  assert.deepEqual(variantesPresentes(m, 'palmier', 'hiver'), []);
  assert.deepEqual(variantesPresentes(null, 'feuillu', 'hiver'), []);
});

test('l’animation d’une vue : le repos d’abord, sinon le premier clip, sinon rien', () => {
  const e = entree('x', 'decor', ['fixe']);
  e.animations = [animation('travers', 'repos'), animation('fixe', 'deplacement'), animation('fixe', 'repos')];
  assert.equal(animationDeVue(e, 'fixe'), 2);
  assert.equal(animationDeVue(e, 'travers'), 0);
  assert.equal(animationDeVue(e, 'bas'), -1);
  e.animations = [animation('fixe', 'tir')];
  assert.equal(animationDeVue(e, 'fixe'), 0);
});

test('la forêt porte trois à cinq arbres par case, sans toucher au devant du centre', () => {
  const g = uniforme('F', 30);
  const comptes = new Map<number, number>();
  for (let y = 0; y < g.hauteur; y += 1) {
    for (let x = 0; x < g.largeur; x += 1) {
      const arbres = placesDeCase(g, 'plaine', x, y, false).filter((p) => p.genre === 'arbre');
      comptes.set(arbres.length, (comptes.get(arbres.length) ?? 0) + 1);
      for (const a of arbres) {
        assert.ok(a.x > x && a.x < x + 1 && a.y > y && a.y < y + 1, 'l’arbre reste dans sa case');
        // Le devant du centre — là où se tient une unité — reste dégagé.
        const dx = a.x - (x + 0.5);
        const dy = a.y - (y + 0.5);
        assert.ok(!(Math.abs(dx) < 0.25 && dy > -0.1 && dy < 0.35), `un arbre devant le centre en ${x},${y}`);
      }
    }
  }
  assert.deepEqual([...comptes.keys()].sort(), [3, 4, 5], `nombres d’arbres : ${[...comptes]}`);
  assert.equal(EMPLACEMENTS_ARBRES.length, 5);
});

test('les hautes herbes : deux à quatre touffes ; la montagne : une seule ; le pont : un, dans son axe', () => {
  const herbes = uniforme('G', 20);
  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      const n = placesDeCase(herbes, 'plaine', x, y, false).filter((p) => p.genre === 'touffe').length;
      assert.ok(n >= 2 && n <= 4, `${n} touffes`);
    }
  }
  const monts = uniforme('M', 10);
  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 10; x += 1) {
      const p = placesDeCase(monts, 'plaine', x, y, false);
      assert.equal(p.filter((q) => q.genre === 'montagne').length, 1);
      assert.equal(p.length, 1, 'rien d’autre sur une montagne');
    }
  }
  const pont = grilleDe(['PVP', 'RNR', 'PVP']);
  const places = placesDeCase(pont, 'plaine', 1, 1, false);
  assert.deepEqual(places.map((p) => [p.genre, p.axe]), [['pont', 'eo']]);
  assert.equal(vuePont('eo'), 'travers');
  assert.equal(vuePont('ns'), 'fixe');
});

test('les buissons sont épars, et plus ou moins selon le biome', () => {
  const g = uniforme('P', 60);
  const part = (biome: Biome): number => {
    let avec = 0;
    for (let y = 0; y < g.hauteur; y += 1) {
      for (let x = 0; x < g.largeur; x += 1) {
        if (placesDeCase(g, biome, x, y, false).some((p) => p.genre === 'buisson')) avec += 1;
      }
    }
    return avec / (g.largeur * g.hauteur);
  };
  for (const biome of ['plaine', 'jungle', 'desert', 'neige'] as const) {
    const mesure = part(biome);
    assert.ok(Math.abs(mesure - CHANCE_BUISSON[biome]) < 0.04, `${biome} : ${mesure} contre ${CHANCE_BUISSON[biome]}`);
  }
  assert.ok(part('jungle') > part('desert'));
});

test('les roseaux au bord de l’eau, nombreux au marais, absents du désert', () => {
  const g = grilleDe(Array.from({ length: 30 }, () => 'PPPPVPPPP'));
  const roseaux = (biome: Biome): number => {
    let n = 0;
    for (let y = 0; y < g.hauteur; y += 1) {
      for (let x = 0; x < g.largeur; x += 1) {
        const ici = placesDeCase(g, biome, x, y, false).filter((p) => p.genre === 'roseau');
        if (ici.length > 0) assert.ok(x === 3 || x === 5, 'un roseau loin de l’eau');
        n += ici.length;
      }
    }
    return n;
  };
  assert.ok(roseaux('marais') > roseaux('plaine') * 2, 'le marais en porte bien plus');
  assert.equal(roseaux('desert'), 0);
});

test('l’essence suit le biome : palmiers au désert, tropical en jungle, montagnes propres', () => {
  const g = grilleDe(['FFFFFF', 'FFFFFF', 'MMMMMM']);
  const essences = (biome: Biome): Set<string> => new Set(
    placerDecor({ grille: g, biome, saison: 'ete', manifeste: manifeste(TOUT), brouillard: null })
      .map((i) => i.entree.replace(/_toutes_\d+$/, '')),
  );
  assert.deepEqual(essences('desert'), new Set(['decor_palmier', 'decor_montagne_aride']));
  assert.ok(essences('jungle').has('decor_tropical'));
  assert.ok(essences('neige').has('decor_conifere') && !essences('neige').has('decor_feuillu'));
  assert.ok(essences('volcanique').has('decor_montagne_volcan'));
  assert.equal(essenceMontagne('plaine'), 'montagne');
});

test('sans image, pas d’instance — et le nuanceur dessine le repli', () => {
  const g = grilleDe(['FGM', 'PPP']);
  assert.deepEqual(placerDecor({ grille: g, biome: 'plaine', saison: 'ete', manifeste: null, brouillard: null }), []);
  assert.equal(repliDecor(null, 'plaine', 'ete'), REPLI.FORET | REPLI.MONTAGNE | REPLI.HERBE_HAUTE);
  // Les arbres seuls : la montagne et les herbes restent au nuanceur.
  const arbres = manifeste([['feuillu', 'toutes'], ['conifere', 'toutes']]);
  assert.equal(repliDecor(arbres, 'plaine', 'ete'), REPLI.MONTAGNE | REPLI.HERBE_HAUTE);
  // Au désert, la montagne commune remplace l'aride absente.
  const commune = manifeste([['montagne', 'hiver']]);
  assert.equal(repliDecor(commune, 'desert', 'hiver') & REPLI.MONTAGNE, 0);
  assert.equal(repliDecor(commune, 'desert', 'ete') & REPLI.MONTAGNE, REPLI.MONTAGNE, 'la saison compte');
  // Un manifeste d'une autre version est refusé, pas deviné.
  const vieux = { ...manifeste(TOUT), version: 999 } as unknown as ManifesteSprites;
  assert.deepEqual(placerDecor({ grille: g, biome: 'plaine', saison: 'ete', manifeste: vieux, brouillard: null }), []);
});

test('une essence présente en partie : on plante celles qui existent', () => {
  const g = uniforme('F', 8);
  const seulement = placerDecor({
    grille: g, biome: 'plaine', saison: 'ete', manifeste: manifeste([['conifere', 'ete']]), brouillard: null,
  });
  assert.ok(seulement.length >= 8 * 8 * 3);
  assert.ok(seulement.every((i) => i.entree.startsWith('decor_conifere_ete_')));
});

test('rien sous le noir, et un décor qui s’assombrit comme le sol près du brouillard', () => {
  const g = uniforme('F', 4);
  const brouillard = new Uint8Array(16).fill(255);
  brouillard[1 * 4 + 2] = 0;
  const instances = placerDecor({ grille: g, biome: 'plaine', saison: 'ete', manifeste: manifeste(TOUT), brouillard });
  assert.ok(instances.length > 0);
  for (const i of instances) {
    assert.ok(!(Math.floor(i.x) === 2 && Math.floor(i.y) === 1), 'une image dans la case cachée');
    const v = i.vue ?? 1;
    assert.equal(v, visibiliteEn(brouillard, 4, 4, i.x, i.y));
  }
  assert.ok(instances.some((i) => (i.vue ?? 1) < 1), 'aucune image ne s’assombrit au bord du noir');
  // La visibilité : noire dans la case cachée, entière à une demi-case.
  assert.equal(visibiliteEn(brouillard, 4, 4, 2.5, 1.5), 0);
  assert.equal(visibiliteEn(brouillard, 4, 4, 0.5, 1.5), 1);
  assert.ok(visibiliteEn(brouillard, 4, 4, 1.95, 1.5) < 0.1);
  assert.equal(visibiliteEn(null, 4, 4, 2.5, 1.5), 1);
});

test('les instances sont triées par ligne, et deux placements sont identiques', () => {
  const g = grilleDe(['FFGMP', 'PGFFM', 'MMPPG']);
  const ctx = { grille: g, biome: 'foret' as Biome, saison: 'automne' as const, manifeste: manifeste(TOUT), brouillard: null };
  const a = placerDecor(ctx);
  assert.deepEqual(placerDecor(ctx), a);
  for (let i = 1; i < a.length; i += 1) assert.ok(a[i - 1]!.y <= a[i]!.y);
});

test('les rochers de côte, rares, sur la grève ou dans l’eau du bord, et seulement s’ils sont cuits', () => {
  const g = grilleDe(Array.from({ length: 40 }, () => 'WWWSSPPP'));
  const rocher = entree('decor_rocher_cotier', 'decor');
  const avec = placerDecor({ grille: g, biome: 'cotier', saison: 'ete', manifeste: manifeste([], [rocher]), brouillard: null });
  const rochers = avec.filter((i) => i.entree === 'decor_rocher_cotier');
  assert.ok(rochers.length > 0 && rochers.length < 20, `${rochers.length} rochers pour 40 lignes de côte`);
  for (const r of rochers) assert.ok(r.x > 2 && r.x < 4.2, `un rocher loin de la côte : ${r.x}`);
  const sans = placerDecor({ grille: g, biome: 'cotier', saison: 'ete', manifeste: manifeste([]), brouillard: null });
  assert.equal(sans.filter((i) => i.entree.startsWith('decor_rocher')).length, 0);
  const ailleurs = placerDecor({ grille: g, biome: 'plaine', saison: 'ete', manifeste: manifeste([], [rocher]), brouillard: null });
  assert.equal(ailleurs.length, 0, 'la plaine n’a pas de rochers de côte');
});

test('le pont cuit : sa vue selon son axe, et le tablier du nuanceur s’efface', () => {
  const g = grilleDe(['PVP', 'RNR', 'PVP', 'PPP', 'VNV', 'PRP']);
  const lesDeux = entree(ID_PONT, 'terrain', ['fixe', 'travers']);
  const instances = placerDecor({ grille: g, biome: 'plaine', saison: 'ete', manifeste: manifeste([], [lesDeux]), brouillard: null });
  const ponts = instances.filter((i) => i.entree === ID_PONT);
  assert.equal(ponts.length, 2);
  assert.equal(ponts[0]!.animation, 1, 'le pont est-ouest en vue travers');
  assert.equal(ponts[1]!.animation, 0, 'le pont nord-sud en vue fixe');
  assert.equal(pontCuit(manifeste([], [lesDeux])), true);
  const unSeul = entree(ID_PONT, 'terrain', ['fixe']);
  assert.equal(pontCuit(manifeste([], [unSeul])), false, 'il faut les deux vues pour effacer le tablier');
  const partiel = placerDecor({ grille: g, biome: 'plaine', saison: 'ete', manifeste: manifeste([], [unSeul]), brouillard: null });
  assert.equal(partiel.filter((i) => i.entree === ID_PONT).length, 1, 'jamais un pont dans la mauvaise vue');
});

test('chaque biome sème quelque chose en forêt quand ses arbres sont cuits', () => {
  const g = uniforme('F', 3);
  for (const biome of BIOMES) {
    const n = placerDecor({ grille: g, biome, saison: 'printemps', manifeste: manifeste(TOUT), brouillard: null }).length;
    assert.ok(n >= 27, `${biome} : ${n}`);
  }
});
