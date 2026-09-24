// Les replis se lisent sur l'identifiant d'une entrée : ce test tient la
// correspondance avec les noms du contrat, et la peinture sur une toile factice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ECUME_NAVIRE, idBatiment, idBatimentEtat, idDecor, idUnite, OMBRE_UNITE } from '../../src/render2d/contrat';
import {
  creerPeintreRepli, DENSITE_REPLI, FORMES, identiteRepli, multiplierCouleur, paletteEquipe, sansOmbresInternes,
  TEINTE_DESAFFECTE, type FabriqueToile,
} from '../../src/render2d/replis';
import type { Pinceau } from '../../src/render/sprites/formes';
import { CAT } from '../engine/aides';

test('les identifiants du contrat se lisent par les bouts', () => {
  assert.deepEqual(identiteRepli(idUnite('char_leger')), { famille: 'unite', cle: 'char_leger' });
  assert.deepEqual(identiteRepli(idUnite('meridien_automate')), { famille: 'unite', cle: 'meridien_automate' });
  assert.deepEqual(identiteRepli(idBatiment('qg', 'fr')), { famille: 'batiment', cle: 'qg' });
  assert.deepEqual(identiteRepli(idDecor('montagne_aride', 'toutes', 2)), { famille: 'decor', essence: 'montagne_aride', saison: 'toutes' });
  assert.deepEqual(identiteRepli('decor_rocher_cotier'), { famille: 'decor', essence: 'rocher', saison: 'toutes' });
  assert.deepEqual(identiteRepli(FORMES.pv(7, true)), { famille: 'pv', pv: 7, agie: true });
  assert.deepEqual(identiteRepli(FORMES.marque('menacee')), { famille: 'marque', genre: 'menacee' });
  assert.deepEqual(identiteRepli(FORMES.ombre), { famille: 'forme', forme: 'ombre' });
  assert.deepEqual(identiteRepli(FORMES.ecume), { famille: 'forme', forme: 'ecume' });
  assert.equal(identiteRepli('decor_inconnue_ete_1'), null);
  assert.equal(identiteRepli('n_importe_quoi'), null);
});

test('la pastille de PV reste dans 0 à 9, et 0 veut dire « le cadenas seul »', () => {
  assert.equal(FORMES.pv(12, false), 'forme_pv_9');
  assert.equal(FORMES.pv(0, true), 'forme_pv_0_a');
});

test('une palette d’équipe fonce et éclaircit la couleur ; sans couleur, le gris neutre', () => {
  const p = paletteEquipe([1, 0, 0]);
  assert.equal(p.main, 'rgb(255,0,0)');
  assert.equal(p.dark, 'rgb(158,0,0)');
  assert.equal(p.light, 'rgb(255,115,115)');
  assert.notEqual(paletteEquipe(null).main, p.main);
});

/** Un pinceau qui note ce qu'on lui fait faire. */
function pinceauEspion(): { g: Pinceau; remplis: string[] } {
  const remplis: string[] = [];
  let style = '';
  const g = new Proxy({} as Record<string, unknown>, {
    get: (_c, nom) => {
      if (nom === 'fillStyle') return style;
      if (nom === 'fill') return () => { remplis.push(style); };
      if (nom === 'createLinearGradient' || nom === 'createRadialGradient') return () => ({ addColorStop: () => undefined });
      return () => undefined;
    },
    set: (_c, nom, v) => { if (nom === 'fillStyle') style = String(v); return true; },
  }) as unknown as Pinceau;
  return { g, remplis };
}

test('les silhouettes perdent leurs ombres internes, et seulement elles', () => {
  const { g, remplis } = pinceauEspion();
  const s = sansOmbresInternes(g);
  s.fillStyle = 'rgba(0,0,0,0.25)';
  s.fill();
  s.fillStyle = '#2e3238';
  s.fill();
  s.fillStyle = 'rgba(0,0,0,0.18)';
  s.fill();
  assert.deepEqual(remplis, ['#2e3238']);
});

test('le peintre mesure, peint à sa densité, et place le pivot au sol', () => {
  const toiles: { l: number; h: number }[] = [];
  const fabrique: FabriqueToile = (l, h) => {
    toiles.push({ l, h });
    return { toile: {} as never, g: pinceauEspion().g };
  };
  const peintre = creerPeintreRepli(fabrique, () => CAT);
  const u = peintre.peindre(idUnite('char_leger'), [0, 0, 1]);
  assert.ok(u);
  assert.equal(u!.echelle, 1 / DENSITE_REPLI);
  assert.ok(u!.py > u!.h / 2, 'le pivot, au sol, est dans la moitié basse');
  assert.ok(Math.abs(u!.px - u!.l / 2) < 1, 'une unité est centrée sur sa case');
  assert.equal(peintre.peindre(idUnite('unite_inconnue'), null), null, 'une clé absente du catalogue n’a pas de repli');
  for (const id of [idBatiment('ville'), idBatiment('port'), idDecor('conifere', 'hiver', 1), FORMES.ombre, FORMES.ecume, FORMES.drapeau, FORMES.pv(3, false)]) {
    assert.ok(peintre.peindre(id, [1, 0, 0]), id);
  }
});

test('l’écume d’un navire est une ellipse claire, plus claire au bord qu’au cœur ; l’ombre, elle, est noire', () => {
  /** Les arrêts de dégradé de ce qu'on peint, dans l'ordre. */
  const arrets = (id: string): { l: number; h: number; stops: [number, string][] } => {
    const stops: [number, string][] = [];
    const g = new Proxy({} as Record<string, unknown>, {
      get: (_c, nom) => {
        if (nom === 'createRadialGradient') return () => ({ addColorStop: (t: number, c: string) => { stops.push([t, c]); } });
        return () => undefined;
      },
      set: () => true,
    }) as unknown as Pinceau;
    const peintre = creerPeintreRepli(() => ({ toile: {} as never, g }), () => CAT);
    const p = peintre.peindre(id, null);
    assert.ok(p, id);
    return { l: p.l, h: p.h, stops };
  };
  const alpha = (c: string): number => Number(/,([\d.]+)\)$/.exec(c)?.[1] ?? Number.NaN);
  const ecume = arrets(FORMES.ecume);
  const n = Number.parseInt(ECUME_NAVIRE.couleur.slice(1), 16);
  const teinte = `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},`;
  assert.ok(ecume.stops.length >= 3);
  assert.ok(ecume.stops.every(([, c]) => c.startsWith(teinte)), 'la couleur de l’écume, jamais du noir');
  const [coeur, , , bord] = ecume.stops.map(([, c]) => alpha(c));
  assert.ok(ecume.stops.some(([t, c]) => t > 0 && t < 1 && alpha(c) > (coeur ?? 1)), 'le bord est plus clair que le cœur, caché sous la coque');
  assert.equal(bord, 0, 'et il s’efface dans l’eau');
  // Plus large que l'ombre : elle déborde de la coque à l'étrave et à la poupe.
  assert.ok(ECUME_NAVIRE.largeur > OMBRE_UNITE.largeur);
  assert.ok(ecume.l > arrets(FORMES.ombre).l);
  assert.ok(arrets(FORMES.ombre).stops.every(([, c]) => c.startsWith('rgba(0,0,0,')), 'l’ombre reste noire');
});

// ---------------------------------------------------------------------------
// Les images d'état des bâtiments : désaffecté et superusine
// ---------------------------------------------------------------------------

/** Ce qu'une peinture pose, couleur par couleur, dans l'ordre : remplissages et traits. */
function peinture(id: string, equipe: readonly [number, number, number] | null): string[] {
  const posees: string[] = [];
  let remplissage = '';
  let trait = '';
  const g = new Proxy({} as Record<string, unknown>, {
    get: (_c, nom) => {
      if (nom === 'fill' || nom === 'fillRect') return () => { posees.push(`f:${remplissage}`); };
      if (nom === 'stroke' || nom === 'strokeRect') return () => { posees.push(`t:${trait}`); };
      return () => undefined;
    },
    set: (_c, nom, v) => {
      if (nom === 'fillStyle') remplissage = String(v);
      if (nom === 'strokeStyle') trait = String(v);
      return true;
    },
  }) as unknown as Pinceau;
  const p = creerPeintreRepli(() => ({ toile: {} as never, g }), () => CAT).peindre(id, equipe);
  assert.ok(p, id);
  return posees;
}

test('une image d’état se lit par son identifiant : le bâtiment, et l’état à part', () => {
  assert.deepEqual(identiteRepli(idBatimentEtat('ville', 'desaffecte')), { famille: 'batiment', cle: 'ville', etat: 'desaffecte' });
  assert.deepEqual(identiteRepli(idBatimentEtat('superusine', 'inerte')), { famille: 'batiment', cle: 'superusine', etat: 'inerte' });
  assert.deepEqual(identiteRepli(idBatiment('superusine')), { famille: 'batiment', cle: 'superusine' });
  assert.deepEqual(identiteRepli(idBatiment('qg', 'lu')), { famille: 'batiment', cle: 'qg' }, 'une nation n’est pas un état');
});

test('une couleur se ternit canal par canal, son opacité intacte ; ce qui ne se lit pas passe', () => {
  assert.equal(multiplierCouleur('#ff8000', [0.5, 0.5, 0.5]), 'rgb(128,64,0)');
  assert.equal(multiplierCouleur('rgb(200, 100, 50)', [0.6, 0.6, 0.58]), 'rgb(120,60,29)');
  assert.equal(multiplierCouleur('rgba(20,24,30,0.55)', [0.5, 1, 1]), 'rgba(10,24,30,0.55)');
  assert.equal(multiplierCouleur('transparent', [0.5, 0.5, 0.5]), 'transparent');
});

test('le repli d’un désaffecté est son bâtiment terni, exactement ce que la carte montre sans son image', () => {
  for (const cle of ['ville', 'usine', 'aeroport', 'port', 'radar']) {
    const enService = peinture(idBatiment(cle), null);
    const endormi = peinture(idBatimentEtat(cle, 'desaffecte'), null);
    assert.equal(endormi.length, enService.length, cle);
    assert.deepEqual(endormi, enService.map((c) => `${c.slice(0, 2)}${multiplierCouleur(c.slice(2), TEINTE_DESAFFECTE)}`), cle);
    assert.notDeepEqual(endormi, enService, `${cle} : terni pour de bon`);
  }
});

test('la superusine a un repli, l’usine, en service comme prise : sa case n’est jamais vide', () => {
  const usine = peinture(idBatiment('usine'), [1, 0, 0]);
  assert.deepEqual(peinture(idBatiment('superusine'), [1, 0, 0]), usine);
  assert.deepEqual(peinture(idBatimentEtat('superusine', 'inerte'), [1, 0, 0]), usine);
});
