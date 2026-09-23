// La vignette cuite sans navigateur : la teinte (la formule du nuanceur du lot),
// le cadrage autour du pivot, le rejeu d'un clip, le choix du kit, et la
// réserve — une page lue une fois, relâchée, ses images extraites et teintes,
// le repli qui tient la place tant qu'elles ne sont pas là, et le plafond.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { ChargeurImage, PeintreRepli, SourceImage } from '../../src/render2d/atlas';
import {
  OMBRE_UNITE, PIXELS_PAR_CASE, SIN_TANGAGE, TANGAGE_CARTE, VERSION_SPRITES,
  type EntreeSprite, type ManifesteSprites,
} from '../../src/render2d/contrat';
import type { FabriqueToile } from '../../src/render2d/replis';
import { FORMES } from '../../src/render2d/replis';
import {
  animationsOrdonnees, couleurEquipe, enveloppeAnimation, enveloppeImage, idPour, imageRejouee,
  PAUSE_REJEU, peindreImage, peindreOmbre, placer, teindre, unirEnveloppes, Vignettes,
  type ImagePrete,
} from '../../src/render2d/vignette';
import { chargerStyleNation } from '../../src/assets/styles';
import { paletteDe } from '../../src/render/palettes';
import type { Pinceau } from '../../src/render/sprites/formes';

// ---------------------------------------------------------------------------
// Des toiles et des pages de papier
// ---------------------------------------------------------------------------

/** Une page factice : des pixels RGBA qu'on sait lire par rectangle. */
interface PageFactice { largeur: number; hauteur: number; pixels: Uint8ClampedArray; fermee: boolean; close(): void }

function page(largeur: number, hauteur: number, pixel: (x: number, y: number) => [number, number, number, number]): PageFactice {
  const pixels = new Uint8ClampedArray(largeur * hauteur * 4);
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) pixels.set(pixel(x, y), (y * largeur + x) * 4);
  }
  return { largeur, hauteur, pixels, fermee: false, close() { this.fermee = true; } };
}

/** Une toile factice qui copie des rectangles de page, et rend ses pixels. */
function toile(l: number, h: number) {
  const pixels = new Uint8ClampedArray(l * h * 4);
  const g = {
    clearRect: () => { pixels.fill(0); },
    drawImage: (src: PageFactice, sx: number, sy: number, sw: number, sh: number) => {
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const i = ((sy + y) * src.largeur + (sx + x)) * 4;
          pixels.set(src.pixels.subarray(i, i + 4), (y * l + x) * 4);
        }
      }
    },
    getImageData: () => ({ data: new Uint8ClampedArray(pixels), width: l, height: h }),
    createImageData: (w: number, hh: number) => ({ data: new Uint8ClampedArray(w * hh * 4), width: w, height: hh }),
    putImageData: (img: { data: Uint8ClampedArray }) => { pixels.set(img.data); },
  };
  return { toile: { l, h, pixels } as unknown as SourceImage, g: g as unknown as Pinceau, pixels };
}

/** Une réserve à doublures : on compte ce qu'elle demande au réseau et au peintre. */
function reserveEssai(pages: Record<string, PageFactice | null>, plafondPixels?: number) {
  const journal = { charges: [] as string[], peints: [] as string[], toiles: 0 };
  const enAttente: (() => void)[] = [];
  let retenir = false;
  const charger: ChargeurImage = (chemin) => {
    journal.charges.push(chemin);
    const p = pages[chemin];
    const rendre = (ok: (s: SourceImage) => void, ko: (e: unknown) => void): void => {
      if (p) ok(p as unknown as SourceImage);
      else ko(new Error('404'));
    };
    return new Promise<SourceImage>((ok, ko) => {
      if (retenir) enAttente.push(() => rendre(ok, ko));
      else rendre(ok, ko);
    });
  };
  const fabrique: FabriqueToile = (l, h) => { journal.toiles += 1; const t = toile(l, h); return { toile: t.toile, g: t.g }; };
  const peintre: PeintreRepli = {
    peindre: (id, equipe) => {
      journal.peints.push(`${id}|${equipe ? equipe.join(',') : '-'}`);
      return id.startsWith('inconnu') ? null : { source: { repli: id } as unknown as SourceImage, l: 60, h: 48, px: 30, py: 40, echelle: 2 / 3 };
    },
  };
  const reserve = new Vignettes({ charger, fabrique, peintre, ...(plafondPixels !== undefined ? { plafondPixels } : {}) });
  return {
    reserve, journal,
    retenir: () => { retenir = true; },
    relacher: () => { for (const r of enAttente.splice(0)) r(); },
  };
}

/** Une unité cuite : deux images de repos à droite, une marche de face, sur une page de 8 × 4. */
function entreeUnite(id = 'unite_char_leger_base'): EntreeSprite {
  return {
    id, famille: 'unite', cle: 'char_leger',
    source: { fichier: 'public/assets/modeles/unite_char_leger_base_lod0.glb', sha256: 'abc' },
    pages: [{ couleur: 'assets/sprites/unites/char.webp', masque: 'assets/sprites/unites/char_masque.png', largeur: 8, hauteur: 4 }],
    animations: [
      { vue: 'bas', clip: 'deplacement', boucle: true, ips: 12, cadres: [{ page: 0, x: 4, y: 0, l: 2, h: 2, px: 1, py: 2 }] },
      {
        vue: 'droite', clip: 'repos', boucle: true, ips: 5,
        cadres: [{ page: 0, x: 0, y: 0, l: 2, h: 2, px: 1, py: 2 }, { page: 0, x: 2, y: 0, l: 2, h: 2, px: 1, py: 2 }],
      },
      { vue: 'droite', clip: 'tir', boucle: false, ips: 12, cadres: [{ page: 0, x: 0, y: 2, l: 4, h: 2, px: 1, py: 2 }] },
    ],
  };
}

function manifeste(...entrees: EntreeSprite[]): ManifesteSprites {
  return {
    version: VERSION_SPRITES, pixelsParCase: PIXELS_PAR_CASE, tangage: TANGAGE_CARTE, tangageProfil: 12,
    entrees: Object.fromEntries(entrees.map((e) => [e.id, e])),
  };
}

/** Les pages de l'unité : une couleur grise opaque, un masque plein sur la moitié gauche. */
function pagesUnite(): Record<string, PageFactice> {
  return {
    '/assets/sprites/unites/char.webp': page(8, 4, () => [200, 100, 50, 255]),
    '/assets/sprites/unites/char_masque.png': page(8, 4, (x) => (x % 2 === 0 ? [255, 255, 255, 255] : [0, 0, 0, 255])),
  };
}

const attendre = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

// ---------------------------------------------------------------------------
// La couleur et la teinte
// ---------------------------------------------------------------------------

test('la teinte suit la formule du nuanceur : couleur × mix(1, équipe, masque), alpha intact', () => {
  const pixels = new Uint8ClampedArray([200, 100, 50, 255, 200, 100, 50, 128, 200, 100, 50, 255]);
  const masque = [255, 0, 128];
  const sortie = teindre(pixels, masque, [0.5, 1, 0]);
  assert.deepEqual([...sortie.slice(0, 4)], [100, 100, 0, 255], 'masque plein : la couleur d’équipe');
  assert.deepEqual([...sortie.slice(4, 8)], [200, 100, 50, 128], 'masque nul : rien ne change, l’alpha non plus');
  // À mi-masque, mi-chemin : 200 × (1 + 0,502 × (0,5 − 1)) ≈ 150.
  assert.ok(Math.abs((sortie[8] ?? 0) - 150) <= 1);
  assert.ok(Math.abs((sortie[10] ?? 0) - 25) <= 1);
  assert.notEqual(sortie, pixels, 'une copie : l’original sert à la couleur suivante');
  assert.deepEqual([...pixels.slice(0, 4)], [200, 100, 50, 255]);
});

test('un masque lu sur les pixels bruts d’une toile se lit un octet sur quatre', () => {
  const pixels = new Uint8ClampedArray([200, 200, 200, 255, 200, 200, 200, 255]);
  const brut = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
  assert.deepEqual([...teindre(pixels, brut, [0, 0, 0], 4)], [0, 0, 0, 255, 200, 200, 200, 255]);
});

test('sans masque ou sans couleur, les pixels passent tels quels', () => {
  const pixels = new Uint8ClampedArray([10, 20, 30, 40]);
  assert.deepEqual([...teindre(pixels, null, [0, 0, 0])], [10, 20, 30, 40]);
  assert.deepEqual([...teindre(pixels, [255], null)], [10, 20, 30, 40]);
});

test('la couleur d’équipe est celle de la peau : la nation, sinon le camp, sinon le gris neutre', () => {
  const hex = (c: readonly number[]): string => `#${c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
  assert.equal(hex(couleurEquipe(0, 'fr')), chargerStyleNation('fr')!.palette.main.toLowerCase());
  assert.equal(hex(couleurEquipe(1, null)), paletteDe(1).main.toLowerCase());
  assert.equal(hex(couleurEquipe(null, 'fr')), paletteDe(null).main.toLowerCase(), 'un bâtiment neutre n’a pas de nation');
});

// ---------------------------------------------------------------------------
// Le cadrage
// ---------------------------------------------------------------------------

test('l’enveloppe d’une image se lit autour du pivot, et la gauche est la droite retournée', () => {
  const img = { l: 100, h: 60, px: 30, py: 50 };
  assert.deepEqual(enveloppeImage(img, 1), { gauche: -30, droite: 70, haut: -50, bas: 10 });
  assert.deepEqual(enveloppeImage(img, 1, true), { gauche: -70, droite: 30, haut: -50, bas: 10 });
  assert.deepEqual(enveloppeImage(img, 2), { gauche: -60, droite: 140, haut: -100, bas: 20 });
  assert.deepEqual(unirEnveloppes([enveloppeImage(img, 1), { gauche: -40, droite: 10, haut: -10, bas: 30 }]),
    { gauche: -40, droite: 70, haut: -50, bas: 30 });
  assert.equal(unirEnveloppes([]), null);
});

test('une animation se cadre sur l’union de ses images : le pivot ne danse pas', () => {
  const e = entreeUnite();
  const env = enveloppeAnimation(e.animations[1]!, 1);
  assert.deepEqual(env, { gauche: -1, droite: 1, haut: -2, bas: 0 });
});

test('placer remplit le cadre moins sa marge, centre, et respecte un zoom imposé', () => {
  const env = { gauche: -30, droite: 70, haut: -50, bas: 10 };
  const p = placer(env, 220, 140, { marge: 10 });
  // 200 / 100 = 2 en largeur, 120 / 60 = 2 en hauteur.
  assert.equal(p.k, 2);
  assert.equal(p.x, 10 + 30 * 2, 'le pivot est à sa place dans l’enveloppe centrée');
  assert.equal(p.y, 10 + 50 * 2);
  const fixe = placer(env, 220, 140, { zoom: 0.5 });
  assert.equal(fixe.k, 0.5);
  assert.equal(fixe.x, (220 - 50) / 2 + 15);
  assert.equal(placer(env, 220, 140, { marge: 10, zoomMax: 1 }).k, 1, 'une petite pièce ne s’agrandit pas au-delà du plafond');
});

// ---------------------------------------------------------------------------
// La lecture du manifeste
// ---------------------------------------------------------------------------

test('les animations se montrent vue par vue, clip par clip, quel que soit leur rang', () => {
  const ordre = animationsOrdonnees(entreeUnite()).map((a) => `${a.animation.vue}/${a.animation.clip}#${a.index}`);
  assert.deepEqual(ordre, ['droite/repos#1', 'droite/tir#2', 'bas/deplacement#0']);
});

test('un clip qui ne boucle pas se rejoue après une pause ; une boucle tourne', () => {
  const pas = 1000 / 12;
  assert.equal(imageRejouee(3, 12, false, 0), 0);
  assert.equal(imageRejouee(3, 12, false, pas * 2 + 1), 2);
  assert.equal(imageRejouee(3, 12, false, pas * 3 + PAUSE_REJEU - 1), 2, 'la pause tient la dernière image');
  assert.equal(imageRejouee(3, 12, false, pas * 3 + PAUSE_REJEU + 1), 0, 'puis le clip repart');
  assert.equal(imageRejouee(3, 12, true, pas * 4 + 1), 1, 'une boucle tourne sans pause');
  assert.equal(imageRejouee(1, 12, false, 99999), 0);
});

test('le kit national l’emporte sur la base, qui l’emporte sur le nom attendu', () => {
  const kit: EntreeSprite = { ...entreeUnite('unite_char_leger_fr'), variante: 'fr' };
  const m = manifeste(entreeUnite(), kit);
  assert.equal(idPour(m, 'unite', 'char_leger', 'fr', 'unite_char_leger_base'), 'unite_char_leger_fr');
  assert.equal(idPour(m, 'unite', 'char_leger', 'lu', 'x'), 'unite_char_leger_base');
  assert.equal(idPour(m, 'unite', 'recon', 'fr', 'unite_recon_base'), 'unite_recon_base');
  assert.equal(idPour(null, 'unite', 'char_leger', 'fr', 'unite_char_leger_base'), 'unite_char_leger_base');
});

// ---------------------------------------------------------------------------
// La réserve
// ---------------------------------------------------------------------------

test('sans manifeste, la réserve rend le repli de l’identifiant, peint une fois par couleur', () => {
  const { reserve, journal } = reserveEssai({});
  const a = reserve.image('unite_char_leger_base', 0, 0, [1, 0, 0]);
  const b = reserve.image('unite_char_leger_base', 0, 1, [1, 0, 0]);
  const c = reserve.image('unite_char_leger_base', 0, 0, [0, 0, 1]);
  assert.equal(a?.repli, true);
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.deepEqual(journal.peints, ['unite_char_leger_base|1,0,0', 'unite_char_leger_base|0,0,1']);
  assert.equal(journal.charges.length, 0, 'rien à télécharger');
  assert.equal(reserve.image('inconnu_x', -1, 0, null), null, 'ni image ni repli : rien');
});

test('une image cuite pas encore lue cède la place au repli, sa page est lue une fois, relâchée, puis l’image teinte la remplace', async () => {
  const pages = pagesUnite();
  const { reserve, journal, retenir, relacher } = reserveEssai(pages);
  reserve.poserManifeste(manifeste(entreeUnite()));
  let signaux = 0;
  reserve.ecouter(() => { signaux += 1; });
  retenir();
  const avant = reserve.image('unite_char_leger_base', 1, 0, [0.5, 1, 0]);
  reserve.image('unite_char_leger_base', 1, 1, [0.5, 1, 0]);
  assert.equal(avant?.repli, true, 'le repli tient la place');
  // Les pages sont demandées, pas encore revenues : l'image reste en repli.
  await attendre();
  assert.equal(journal.charges.length, 2);
  assert.equal(reserve.image('unite_char_leger_base', 1, 0, [0.5, 1, 0])?.repli, true);
  relacher();
  await attendre();
  await attendre();
  assert.deepEqual(journal.charges, ['/assets/sprites/unites/char.webp', '/assets/sprites/unites/char_masque.png'],
    'la couleur et le masque, une seule fois pour deux images');
  assert.ok(pages['/assets/sprites/unites/char.webp']!.fermee, 'la page est relâchée une fois ses images lues');
  assert.ok(signaux >= 1, 'l’arrivée réveille ce qui la montre');
  const apres = reserve.image('unite_char_leger_base', 1, 0, [0.5, 1, 0]) as ImagePrete & { source: { pixels: Uint8ClampedArray } };
  assert.equal(apres.repli, false);
  assert.equal(apres.echelle, 1);
  assert.deepEqual([apres.l, apres.h, apres.px, apres.py], [2, 2, 1, 2]);
  // Colonne paire : masque plein, la couleur d'équipe ; colonne impaire : la couleur cuite.
  assert.deepEqual([...apres.source.pixels.slice(0, 4)], [100, 100, 0, 255]);
  assert.deepEqual([...apres.source.pixels.slice(4, 8)], [200, 100, 50, 255]);
  // Une seconde demande à la même couleur rend la même image, sans rien recalculer.
  const toiles = journal.toiles;
  assert.equal(reserve.image('unite_char_leger_base', 1, 0, [0.5, 1, 0]), apres);
  assert.equal(journal.toiles, toiles);
  // Une autre couleur se teint à partir des mêmes pixels, sans relire la page.
  const bleu = reserve.image('unite_char_leger_base', 1, 0, [0, 0, 1]) as ImagePrete & { source: { pixels: Uint8ClampedArray } };
  assert.deepEqual([...bleu.source.pixels.slice(0, 4)], [0, 0, 50, 255]);
  assert.equal(journal.charges.length, 2);
});

test('préparer une entrée lit toutes ses animations d’une traite ; une entrée absente rend faux', async () => {
  const { reserve, journal } = reserveEssai(pagesUnite());
  reserve.poserManifeste(manifeste(entreeUnite()));
  assert.equal(await reserve.preparer('unite_char_leger_base'), true);
  assert.equal(journal.charges.length, 2);
  for (const [a, c] of [[0, 0], [1, 0], [1, 1], [2, 0]] as const) {
    assert.equal(reserve.image('unite_char_leger_base', a, c, null)?.repli, false, `animation ${a}, image ${c}`);
  }
  assert.equal(await reserve.preparer('unite_char_leger_base'), true, 'déjà là : rien à relire');
  assert.equal(journal.charges.length, 2);
  assert.equal(await reserve.preparer('unite_absente_base'), false);
});

test('une page introuvable reste en repli, sans être redemandée', async () => {
  const { reserve, journal } = reserveEssai({});
  reserve.poserManifeste(manifeste(entreeUnite()));
  assert.equal(await reserve.preparer('unite_char_leger_base', [1]), false);
  for (let i = 0; i < 4; i++) assert.equal(reserve.image('unite_char_leger_base', 1, 0, null)?.repli, true);
  await attendre();
  assert.equal(journal.charges.filter((c) => c.endsWith('char.webp')).length, 1);
});

test('une image sans masque ne change pas de couleur, et ne se teint qu’une fois', async () => {
  const e = entreeUnite();
  const nu: EntreeSprite = { ...e, pages: [{ couleur: 'assets/sprites/unites/char.webp', largeur: 8, hauteur: 4 }] };
  const { reserve, journal } = reserveEssai(pagesUnite());
  reserve.poserManifeste(manifeste(nu));
  await reserve.preparer(nu.id);
  const rouge = reserve.image(nu.id, 1, 0, [1, 0, 0]) as ImagePrete & { source: { pixels: Uint8ClampedArray } };
  const toiles = journal.toiles;
  const bleu = reserve.image(nu.id, 1, 0, [0, 0, 1]);
  assert.equal(rouge, bleu);
  assert.equal(journal.toiles, toiles);
  assert.deepEqual([...rouge.source.pixels.slice(0, 4)], [200, 100, 50, 255]);
});

test('le plafond de pixels renvoie les plus anciennes images, jamais celle qu’on vient de lire', async () => {
  // Quatre pixels par image ; un plafond de dix en garde deux.
  const { reserve } = reserveEssai(pagesUnite(), 10);
  reserve.poserManifeste(manifeste(entreeUnite()));
  await reserve.preparer('unite_char_leger_base', [1]);
  await reserve.preparer('unite_char_leger_base', [0]);
  // L'image de marche (la plus récente) reste ; la première image du repos est partie.
  assert.equal(reserve.image('unite_char_leger_base', 0, 0, null)?.repli, false);
  assert.equal(reserve.image('unite_char_leger_base', 1, 0, null)?.repli, true, 'renvoyée : le repli tient la place, et elle est redemandée');
});

test('l’ombre d’une unité est une forme du rendu, jamais une image cuite', () => {
  const { reserve, journal } = reserveEssai({});
  reserve.ombre();
  assert.deepEqual(journal.peints, [`${FORMES.ombre}|-`]);
});

// ---------------------------------------------------------------------------
// Peindre
// ---------------------------------------------------------------------------

/** Un pinceau qui note les transformations et le rectangle de chaque `drawImage`. */
function pinceauNotant() {
  const notes: string[] = [];
  const g = {
    globalAlpha: 1,
    save: () => { notes.push('save'); },
    restore: () => { notes.push('restore'); },
    translate: (x: number, y: number) => { notes.push(`translate ${x} ${y}`); },
    scale: (x: number, y: number) => { notes.push(`scale ${x} ${y}`); },
    drawImage: (_s: unknown, x: number, y: number, l: number, h: number) => { notes.push(`draw ${x} ${y} ${l} ${h} alpha ${g.globalAlpha}`); },
  };
  return { g: g as unknown as Pinceau, notes };
}

test('une image se pose par son pivot, et se retourne autour de lui', () => {
  const img: ImagePrete = { source: {} as CanvasImageSource, l: 100, h: 60, px: 30, py: 50, echelle: 1, repli: false };
  const droit = pinceauNotant();
  peindreImage(droit.g, img, 200, 150, 2);
  assert.deepEqual(droit.notes, ['save', 'translate 200 150', 'draw -60 -100 200 120 alpha 1', 'restore']);
  const retourne = pinceauNotant();
  peindreImage(retourne.g, img, 200, 150, 2, true, 0.5);
  assert.deepEqual(retourne.notes, ['save', 'translate 200 150', 'scale -1 1', 'draw -60 -100 200 120 alpha 0.5', 'restore']);
});

test('l’ombre d’une unité se pose décalée comme celle de la lumière principale, plus claire sous un appareil', () => {
  const ombre: ImagePrete = { source: {} as CanvasImageSource, l: 10, h: 10, px: 5, py: 5, echelle: 1, repli: true };
  const sol = pinceauNotant();
  peindreOmbre(sol.g, ombre, 100, 100, 1);
  const dx = OMBRE_UNITE.decalageX * PIXELS_PAR_CASE;
  const dy = OMBRE_UNITE.decalageY * PIXELS_PAR_CASE * SIN_TANGAGE;
  assert.equal(sol.notes[1], `translate ${100 + dx} ${100 + dy}`);
  assert.match(sol.notes[2]!, new RegExp(`alpha ${OMBRE_UNITE.opacite}$`));
  const air = pinceauNotant();
  peindreOmbre(air.g, ombre, 100, 100, 1, 1, true);
  assert.match(air.notes[2]!, /^draw -4 -4 8 8 /, 'plus petite sous un appareil');
});
