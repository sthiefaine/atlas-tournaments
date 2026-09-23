// Le réglage de la peau 2D sur les **vraies** images cuites (23 septembre 2026,
// `doc/refonte/sprites-reglages.md`) : ce que la cuisson a livré et que le
// moteur, écrit avant elle, ne savait pas — un appareil déjà en vol dans son
// image, des zones d'équipe cuites en blanc, des vues de face et de dos qui
// n'ont que la marche. Et ce que le lot pose désormais par appel de calque :
// le voile de la nuit, exact, et la lumière des effets, additive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { EtatPartie } from '../../src/engine/index';
import {
  Atlas, choisirAnimation, type ChargeurImage, type PeintreRepli, type SourceImage, type Televerseur,
} from '../../src/render2d/atlas';
import {
  PIXELS_PAR_CASE, TANGAGE_CARTE, VERSION_SPRITES, type EntreeSprite, type ManifesteSprites,
} from '../../src/render2d/contrat';
import { ADDITIF, PoolEffets } from '../../src/render2d/effets';
import { empaqueter, FLOTTANTS_INSTANCE, MODE_VOILEE, poser, TamponInstances, type Pose } from '../../src/render2d/lot';
import { etalonnerPose } from '../../src/render2d/meteo';
import { posesBatiments } from '../../src/render2d/batiments';
import {
  couleurEquipeDe, HAUTEUR_VOL, miroirTrouve, posesUnites, Visuels, type AnimationChoisie, type OptionsPosesUnites,
} from '../../src/render2d/unites';
import { seuilCapture, terrainLogique } from '../../src/engine/index';
import { CAT, partiePersonnalisee } from '../engine/aides';

// ---------------------------------------------------------------------------
// Une entrée comme la cuisson les livre : la marche seule de face et de dos
// ---------------------------------------------------------------------------

/** Une unité cuite comme les 30 du manifeste : tous ses clips à droite, la marche seule en `bas` et `haut`. */
function uniteCuite(id: string): EntreeSprite {
  const c = (x: number) => ({ page: 0, x, y: 0, l: 60, h: 60, px: 30, py: 50 });
  const anim = (vue: EntreeSprite['animations'][number]['vue'], clip: EntreeSprite['animations'][number]['clip'], x: number) => ({
    vue, clip, boucle: clip === 'repos' || clip === 'deplacement', ips: 12, cadres: [c(x), c(x + 64)],
  });
  return {
    id, famille: 'unite', cle: id.replace(/^unite_/, '').replace(/_base$/, ''),
    source: { fichier: `${id}.glb`, sha256: 'x' },
    pages: [{ couleur: `assets/sprites/unites/${id}_0.webp`, masque: `assets/sprites/unites/${id}_0_masque.png`, largeur: 2048, hauteur: 64 }],
    animations: [
      anim('droite', 'repos', 0), anim('droite', 'deplacement', 128), anim('droite', 'tir', 256),
      anim('droite', 'touche', 384), anim('droite', 'hors_jeu', 512),
      anim('bas', 'deplacement', 640), anim('haut', 'deplacement', 768),
      anim('profil', 'repos', 896), anim('profil', 'tir', 1024),
    ],
  };
}

function manifeste(...entrees: EntreeSprite[]): ManifesteSprites {
  return {
    version: VERSION_SPRITES, pixelsParCase: PIXELS_PAR_CASE, tangage: TANGAGE_CARTE, tangageProfil: 12,
    entrees: Object.fromEntries(entrees.map((e) => [e.id, e])),
  };
}

/** Un atlas à doublures, dont on relâche les pages à la main. */
function atlasEssai() {
  const enAttente: (() => void)[] = [];
  const televerseur: Televerseur = { creer: () => ({}) as WebGLTexture, poser: () => undefined, supprimer: () => undefined };
  const peintre: PeintreRepli = { peindre: () => ({ source: {} as SourceImage, l: 40, h: 40, px: 20, py: 30, echelle: 1 }) };
  const charger: ChargeurImage = () => new Promise<SourceImage>((ok) => { enAttente.push(() => ok({} as SourceImage)); });
  const atlas = new Atlas({ televerseur, charger, peintre });
  return { atlas, relacher: async () => { for (const r of enAttente.splice(0)) r(); await new Promise((r) => setTimeout(r, 0)); } };
}

// ---------------------------------------------------------------------------
// 1. La hauteur de vol : une seule levée
// ---------------------------------------------------------------------------

function etatAerien(): EtatPartie {
  return partiePersonnalisee(['PPPP', 'PPPP'], {}, [
    { camp: 0, type: 'helico', x: 1, y: 0 },
    { camp: 1, type: 'infanterie', x: 3, y: 1 },
  ]);
}

function optionsUnites(extra: Partial<OptionsPosesUnites> = {}): OptionsPosesUnites {
  return {
    camp: 0, visibles: null, unitesVues: null, marques: null, selection: null,
    equipe: (camp) => (camp === 0 ? [0, 0, 1] : [1, 0, 0]),
    entree: (type) => `unite_${type}_base`,
    animation: () => ({ index: 0, cadres: 2, ips: 12, boucle: true, vue: 'droite' }),
    tempsMs: 0, reduit: true,
    ...extra,
  };
}

test('un appareil cuit ne se soulève pas : son image porte déjà sa hauteur de vol', () => {
  const e = etatAerien();
  const helico = e.unites[0]!;
  helico.pv = 55;
  const r = posesUnites(e, CAT, new Visuels(), optionsUnites({ cuite: () => true }));
  const figurine = r.poses.find((p) => p.calque === 'unites' && p.instance.entree === 'unite_helico_base')!;
  assert.equal(figurine.instance.h, 0, 'une levée de plus le mettrait deux fois en l’air');
  assert.equal(r.positions.get(helico.id)?.h, 0);
  // L'ombre reste sur la case, sous lui ; la pastille suit le pivot de la figurine.
  const ombre = r.poses.find((p) => p.calque === 'ombres_unites' && p.colonne === helico.x + 0.5)!;
  assert.equal(ombre.instance.h ?? 0, 0);
  const pastille = r.poses.find((p) => p.instance.entree.startsWith('forme_pv_'))!;
  assert.equal(pastille.instance.h, 0);
});

test('un appareil en repli, lui, garde sa levée — et son ombre reste au sol', () => {
  const e = etatAerien();
  const helico = e.unites[0]!;
  for (const o of [optionsUnites({ cuite: () => false }), optionsUnites({ animation: () => null })]) {
    const r = posesUnites(e, CAT, new Visuels(), o);
    const figurine = r.poses.find((p) => p.calque === 'unites' && p.instance.entree === 'unite_helico_base')!;
    assert.equal(figurine.instance.h, HAUTEUR_VOL);
    const ombre = r.poses.find((p) => p.calque === 'ombres_unites' && p.colonne === helico.x + 0.5)!;
    assert.equal(ombre.instance.h ?? 0, 0);
  }
  // Un fantassin ne vole jamais, cuit ou non.
  const r = posesUnites(e, CAT, new Visuels(), optionsUnites({ cuite: () => false }));
  assert.equal(r.poses.find((p) => p.instance.entree === 'unite_infanterie_base')!.instance.h, 0);
});

test('la levée se décide sur la page arrivée, pas sur l’entrée connue : le repli d’attente vole, l’image cuite non', async () => {
  const { atlas, relacher } = atlasEssai();
  atlas.poserManifeste(manifeste(uniteCuite('unite_helico_base')));
  const e = etatAerien();
  const o = optionsUnites({
    animation: (id, vue, clip) => {
      const en = atlas.entree(id);
      if (!en) return null;
      const i = choisirAnimation(en, vue, clip);
      const a = en.animations[i]!;
      return { index: i, cadres: a.cadres.length, ips: a.ips, boucle: a.boucle, vue: a.vue };
    },
    cuite: (id, a, c) => atlas.estCuite(id, a, c),
  });
  const hauteur = () => posesUnites(e, CAT, new Visuels(), o).positions.get(e.unites[0]!.id)?.h;
  assert.equal(hauteur(), HAUTEUR_VOL, 'la page n’est pas là : on dessine le repli, levé');
  const cadre = atlas.resoudre({ entree: 'unite_helico_base', animation: 0, cadre: 0, x: 0, y: 0 });
  assert.equal(cadre?.repli, true);
  await relacher();
  assert.equal(atlas.estCuite('unite_helico_base', 0, 0), true);
  assert.equal(hauteur(), 0, 'la page est là : l’image cuite vole déjà');
});

// ---------------------------------------------------------------------------
// 2. Le bâtiment neutre : gris, jamais blanc
// ---------------------------------------------------------------------------

const GRIS_NEUTRE = [0xb9 / 255, 0xbe / 255, 0xc7 / 255];

test('la couleur d’équipe : la nation d’un camp, le gris neutre sans propriétaire — jamais le blanc', () => {
  assert.deepEqual([...couleurEquipeDe(null, null)], GRIS_NEUTRE);
  assert.deepEqual([...couleurEquipeDe(null, 'fr')], GRIS_NEUTRE, 'un pays ne colore pas un bâtiment sans propriétaire');
  assert.deepEqual([...couleurEquipeDe(0, 'fr')], [0x2f / 255, 0x5f / 255, 0xd0 / 255], 'palette.main du style français');
  assert.deepEqual([...couleurEquipeDe(1, 'lu')], [0x3a / 255, 0xa0 / 255, 0xc8 / 255]);
  // Sans nation, la palette du camp.
  assert.deepEqual([...couleurEquipeDe(1, null)], [0xe0 / 255, 0x4b / 255, 0x45 / 255]);
});

test('un bâtiment neutre cuit reçoit le gris neutre sur son masque : le lot le teint, jamais en blanc', () => {
  const e = partiePersonnalisee(['HPC', 'PPP'], { '0,0': 0 }, [{ camp: 0, type: 'infanterie', x: 1, y: 1 }]);
  const { poses } = posesBatiments(e, (c) => terrainLogique(e, CAT, c), {
    visibles: null, brouillard: null,
    equipe: (camp) => couleurEquipeDe(camp, camp === 0 ? 'fr' : null),
    entree: (t, p) => (p === 0 ? `batiment_${t}_fr` : `batiment_${t}_base`),
    animation: () => ({ index: 0, cadres: 1, ips: 3.75, boucle: true }),
    seuil: (c) => seuilCapture(e, CAT, c), tempsMs: 0, reduit: true,
  });
  const ville = poses.find((p) => p.instance.entree === 'batiment_ville_base')!;
  assert.deepEqual([...(ville.instance.equipe ?? [])], GRIS_NEUTRE);
  // Le lot applique le masque dès qu'une couleur est donnée : l'équipe grise est écrite, le masque actif.
  const t = new TamponInstances();
  const textures = { couleur: {} as WebGLTexture, masque: {} as WebGLTexture, emission: {} as WebGLTexture };
  empaqueter([ville], {
    resoudre: () => ({ textures, u0: 0, v0: 0, u1: 1, v1: 1, l: 10, h: 10, px: 5, py: 9, echelle: 1, masque: true, emission: true, repli: false }),
  }, t);
  const d = t.donnees;
  assert.deepEqual([d[8], d[9], d[10]].map((x) => Math.round(x! * 255)), [0xb9, 0xbe, 0xc7]);
  assert.equal(d[11], 1, 'le masque s’applique');
});

// ---------------------------------------------------------------------------
// 5. Les vues : de face et de dos, la marche seule
// ---------------------------------------------------------------------------

test('de face ou de dos, tout clip autre que la marche retombe sur la droite — jamais sur une image absente', () => {
  const e = uniteCuite('unite_char_leger_base');
  const vueDe = (vue: 'bas' | 'haut', clip: 'repos' | 'deplacement' | 'tir' | 'touche' | 'hors_jeu' | 'capture') => {
    const a = e.animations[choisirAnimation(e, vue, clip)]!;
    return `${a.vue}/${a.clip}`;
  };
  for (const vue of ['bas', 'haut'] as const) {
    assert.equal(vueDe(vue, 'deplacement'), `${vue}/deplacement`);
    assert.equal(vueDe(vue, 'repos'), 'droite/repos');
    assert.equal(vueDe(vue, 'tir'), 'droite/tir');
    assert.equal(vueDe(vue, 'touche'), 'droite/touche');
    assert.equal(vueDe(vue, 'hors_jeu'), 'droite/hors_jeu');
    assert.equal(vueDe(vue, 'capture'), 'droite/repos', 'un clip que le GLB n’a pas : le repos de la droite');
  }
  // Une entrée qui aurait un repos de face le garderait : le clip d'abord, dans la vue demandée.
  const avecReposDeFace: EntreeSprite = { ...e, animations: [...e.animations, { vue: 'bas', clip: 'repos', boucle: true, ips: 12, cadres: [{ page: 0, x: 0, y: 0, l: 1, h: 1, px: 0, py: 0 }] }] };
  const i = choisirAnimation(avecReposDeFace, 'bas', 'repos');
  assert.equal(`${avecReposDeFace.animations[i]!.vue}/${avecReposDeFace.animations[i]!.clip}`, 'bas/repos');
  assert.equal(avecReposDeFace.animations[choisirAnimation(avecReposDeFace, 'bas', 'tir')]!.clip, 'tir', 'le tir de la droite avant le repos de face');
});

test('retombée sur la droite, l’unité regarde de son côté de repos : le miroir compris', () => {
  // Le camp 0 regarde à droite, les autres à gauche ; une vue trouvée telle quelle garde son miroir.
  assert.equal(miroirTrouve('bas', 0, 'droite'), false);
  assert.equal(miroirTrouve('bas', 1, 'droite'), true);
  assert.equal(miroirTrouve('haut', 1, 'droite'), true);
  assert.equal(miroirTrouve('bas', 1, 'bas'), false);
  assert.equal(miroirTrouve('gauche', 0, 'droite'), true, 'la gauche est la droite retournée, quel que soit le camp');
  assert.equal(miroirTrouve('droite', 1, 'droite'), false);
  // Dans les poses : une unité du camp 1 qui encaisse face au joueur ne se retourne pas vers la droite.
  const e = etatAerien();
  const inf = e.unites[1]!;
  const visuels = new Visuels();
  const v = visuels.visuel(inf.id);
  v.orientation = 'bas';
  v.clip = 'touche';
  const entree = uniteCuite('unite_infanterie_base');
  const r = posesUnites(e, CAT, visuels, optionsUnites({
    animation: (id, vue, clip): AnimationChoisie | null => {
      if (id !== entree.id) return null;
      const i = choisirAnimation(entree, vue, clip);
      const a = entree.animations[i]!;
      return { index: i, cadres: a.cadres.length, ips: a.ips, boucle: a.boucle, vue: a.vue };
    },
  }));
  const figurine = r.poses.find((p) => p.instance.entree === entree.id)!;
  assert.equal(entree.animations[figurine.instance.animation]!.clip, 'touche');
  assert.equal(entree.animations[figurine.instance.animation]!.vue, 'droite');
  assert.equal(figurine.instance.miroir, true, 'de face, sans image de face : la droite, retournée vers sa gauche de repos');
  // Et en marche vers le bas, la vue de face existe : aucun miroir.
  v.clip = 'deplacement';
  const r2 = posesUnites(e, CAT, visuels, optionsUnites({
    animation: (id, vue, clip): AnimationChoisie | null => {
      const i = choisirAnimation(entree, vue, clip);
      const a = entree.animations[i]!;
      return id === entree.id ? { index: i, cadres: a.cadres.length, ips: a.ips, boucle: a.boucle, vue: a.vue } : null;
    },
  }));
  const f2 = r2.poses.find((p) => p.instance.entree === entree.id)!;
  assert.equal(entree.animations[f2.instance.animation]!.vue, 'bas');
  assert.equal(f2.instance.miroir, false);
});

// ---------------------------------------------------------------------------
// 6. Le lot : le voile par drapeau, la lumière additive
// ---------------------------------------------------------------------------

test('le lot écrit le mode de chaque image : voilée (du monde), ou sa part additive (de la lumière)', () => {
  const cadre = {
    textures: { couleur: {} as WebGLTexture, masque: null, emission: null },
    u0: 0, v0: 0, u1: 1, v1: 1, l: 10, h: 10, px: 5, py: 9, echelle: 1, masque: false, emission: false, repli: false,
  };
  const inst = (entree: string) => ({ entree, animation: 0, cadre: 0, x: 0.5, y: 0.5 });
  const monde = etalonnerPose(poser('volumes', inst('batiment_ville_base')));
  const pastille = etalonnerPose(poser('unites', inst('forme_pv_3')));
  const eclair: Pose = { ...poser('effets', inst('effet_eclair')), additif: 1 };
  const halo: Pose = { ...poser('effets', inst('effet_halo')), additif: 0.5 };
  const t = new TamponInstances();
  empaqueter([monde, pastille, eclair, halo], { resoudre: () => cadre }, t);
  const mode = (i: number) => t.donnees[i * FLOTTANTS_INSTANCE + 19];
  assert.deepEqual([mode(0), mode(1), mode(2), mode(3)], [MODE_VOILEE, 0, 1, 0.5]);
  // Une image voilée n'est jamais additive, même si on le lui demande.
  const t2 = new TamponInstances();
  empaqueter([{ ...monde, additif: 1 }], { resoudre: () => cadre }, t2);
  assert.equal(t2.donnees[19], MODE_VOILEE);
});

test('les effets de lumière s’ajoutent, la matière et les signes se posent par-dessus', () => {
  const pool = new PoolEffets(16);
  const poses: Pose[] = [];
  pool.emettre({ genre: 'etincelle', x: 1, y: 1, duree: 500 });
  pool.emettre({ genre: 'fumee', x: 1, y: 1, duree: 500 });
  pool.emettre({ genre: 'anneau', x: 1, y: 1, duree: 500 });
  // La fumée et l'anneau montent depuis l'opacité nulle : on les laisse paraître.
  pool.avancer(150);
  pool.poses(poses);
  const par = (prefixe: string) => poses.find((p) => p.instance.entree.startsWith(prefixe))!;
  assert.equal(par('effet_etincelle').additif, 1);
  assert.equal(par('effet_fumee').additif, 0);
  assert.equal(par('effet_anneau').additif, 0);
  // Un recyclage change de genre : la part suit le genre, sans rien allouer.
  for (const genre of Object.keys(ADDITIF) as (keyof typeof ADDITIF)[]) {
    assert.ok(ADDITIF[genre] >= 0 && ADDITIF[genre] <= 1, genre);
  }
  assert.equal(ADDITIF.fumee, 0, 'la fumée est de la matière');
  assert.equal(ADDITIF.eclair, 1, 'un éclair de bouche est de la lumière');
});

// ---------------------------------------------------------------------------
// La preuve par l'atlas : ce qui est cuit, ce qui est en repli, et pourquoi
// ---------------------------------------------------------------------------

test('un masque d’équipe se dépose en rouge seul : un octet par texel, et la mémoire le compte', async () => {
  const deposes: { chemin: string; canal: string | undefined; premultiplier: boolean }[] = [];
  const noms = new Map<object, string>();
  const televerseur: Televerseur = {
    creer: (source, _l, _h, o) => {
      deposes.push({ chemin: noms.get(source as object) ?? '?', canal: o.canal, premultiplier: o.premultiplier });
      return {} as WebGLTexture;
    },
    poser: () => undefined,
    supprimer: () => undefined,
  };
  const charger: ChargeurImage = async (chemin) => {
    const s = {} as SourceImage;
    noms.set(s as object, chemin);
    return s;
  };
  const atlas = new Atlas({ televerseur, charger, peintre: { peindre: () => null } });
  const entree = uniteCuite('unite_char_leger_base');
  entree.pages[0]!.emission = 'assets/sprites/unites/unite_char_leger_base_0_emission.webp';
  atlas.poserManifeste(manifeste(entree));
  atlas.resoudre({ entree: entree.id, animation: 0, cadre: 0, x: 0, y: 0 });
  await new Promise((r) => setTimeout(r, 0));
  const par = (fin: string) => deposes.find((d) => d.chemin.endsWith(fin))!;
  assert.deepEqual(par('_0.webp'), { chemin: '/assets/sprites/unites/unite_char_leger_base_0.webp', canal: 'rgba', premultiplier: true });
  assert.equal(par('_masque.png').canal, 'rouge');
  assert.equal(par('_masque.png').premultiplier, false, 'un niveau de gris ne se prémultiplie pas');
  assert.equal(par('_emission.webp').canal, 'rgba');
  // 2048 × 64 : deux pages RGBA et un masque d'un octet, niveaux 0 à 2 compris.
  const texels = 2048 * 64 + 1024 * 32 + 512 * 16;
  assert.equal(atlas.statistiques().octetsGpu, texels * (4 + 4 + 1));
});

test('l’atlas compte ce qu’il résout : cuites, replis, et replis d’une entrée pourtant connue', async () => {
  const { atlas, relacher } = atlasEssai();
  atlas.poserManifeste(manifeste(uniteCuite('unite_char_leger_base')));
  const cuite = { entree: 'unite_char_leger_base', animation: 0, cadre: 0, x: 0.5, y: 0.5 };
  const forme = { entree: 'forme_ombre', animation: -1, cadre: 0, x: 0.5, y: 0.5 };
  atlas.remettreCompteurs();
  atlas.resoudre(cuite);
  atlas.resoudre(forme);
  assert.deepEqual({ ...atlas.compteurs }, { cuites: 0, replis: 2, replisAvecEntree: 1 }, 'la page est en route : repli d’attente');
  assert.equal(atlas.statistiques().enVol, 1);
  await relacher();
  atlas.remettreCompteurs();
  atlas.resoudre(cuite);
  atlas.resoudre(forme);
  assert.deepEqual({ ...atlas.compteurs }, { cuites: 1, replis: 1, replisAvecEntree: 0 }, 'la page est là : plus aucun repli d’une entrée connue');
  const s = atlas.statistiques();
  assert.equal(s.pages, 1);
  assert.deepEqual(s.cheminsPages, ['assets/sprites/unites/unite_char_leger_base_0.webp']);
  assert.equal(s.textures, 3, 'la couleur et le masque de la page, plus la page de replis');
  assert.ok(s.octetsGpu > 2048 * 64 * 4 * 2, 'la mémoire graphique compte les niveaux de détail');
});
