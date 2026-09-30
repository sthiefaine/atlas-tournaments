/** Emballage technique des dessins approuvés : sources intactes, poses fixes. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { emballer } from './emballage';
import { lireManifeste } from '../../src/render2d/atlas';
import type { EntreeSprite, ManifesteSprites, PageSprite, VueSprite } from '../../src/render2d/contrat';

async function main(): Promise<void> {
  const ROOT = 'assets/direction-artistique/collection-base-v1';
  const DEST = 'public/assets/sprites/dessins';
  const MANIFESTE = 'public/assets/sprites/manifeste.json';
  const plan = JSON.parse(await readFile(`${ROOT}/plan.json`, 'utf8')) as {
    entrees: { id: string; cle: string; famille: string; domaine?: string; groupe?: string; fichier: string }[];
  };
  const manifeste = JSON.parse(await readFile(MANIFESTE, 'utf8')) as ManifesteSprites;
  const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
  const groupes = new Map<string, Image[]>();
  type Image = { id: string; entree: EntreeSprite; vue: VueSprite; pixels: Buffer; l: number; h: number; px: number; py: number; peinture?: PageSprite['peinture'] };
  const retenus = new Set(['decor_foret_base', 'decor_foret_automne', 'decor_foret_automne_2', 'decor_buisson_base', 'decor_touffe_base', 'decor_roseau_base', 'decor_rocher_cotier', 'decor_rocher_archipel', 'terrain_montagne']);
  // Le pont est tracé avec la chaussée. Les états désaffectés utilisent la
  // base frontale ternie : les anciennes vues diagonales restent des références.
  const referencesSeulement = new Set(['terrain_pont',
    ...plan.entrees.filter(e => e.id.endsWith('_desaffecte')).map(e => e.id)]);
  for (const id of referencesSeulement) delete manifeste.entrees[id];
  const sources = plan.entrees.filter(e => !referencesSeulement.has(e.id))
    .map(e => ({ ...e, vue: (e.famille === 'unite' ? 'droite' : 'fixe') as VueSprite }));

  for (const e of sources) {
    if (e.famille !== 'unite' && e.famille !== 'batiment' && e.groupe !== 'biomes' && !retenus.has(e.id)) continue;
    const original = await readFile(path.join(ROOT, e.fichier));
    const { data, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3]! <= 8) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    if (x1 < x0 || y1 < y0) throw new Error(`Dessin vide : ${e.id}`);
    x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2);
    x1 = Math.min(info.width - 1, x1 + 2); y1 = Math.min(info.height - 1, y1 + 2);
    const marcheur = ['infanterie', 'meca', 'genie', 'meridien_automate'].includes(e.cle);
    const bosquet = e.id.startsWith('decor_foret_');
    const max = e.famille === 'unite' ? [marcheur ? 60 : 104, marcheur ? 76 : 82]
      : e.famille === 'batiment' ? [126, e.cle === 'qg' ? 158 : 136]
      : bosquet ? [120, 125]
      : e.groupe === 'biomes' ? [88, 108]
      : e.id === 'terrain_montagne' ? [110, 94]
      : e.id.includes('rocher') ? [48, 40]
      : e.id.includes('roseau') ? [30, 44] : [38, 32];
    const ratio = Math.min(max[0]! / (x1 - x0 + 1), max[1]! / (y1 - y0 + 1));
    const l = Math.max(1, Math.round((x1 - x0 + 1) * ratio));
    const h = Math.max(1, Math.round((y1 - y0 + 1) * ratio));
    // Détourage et réduction seulement : les sources HD restent intactes.
    const pixels = await sharp(original).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
      .resize(l, h, { fit: 'cover' }).png().toBuffer();
    const etat = e.id.endsWith('_desaffecte') ? 'desaffecte' : e.id.endsWith('_inerte') ? 'inerte' : undefined;
    const peinture = e.famille === 'unite' || (e.famille === 'batiment' && !etat)
      ? e.id.includes('meridien') || e.id.includes('superusine') ? 'ambre' : 'cobalt' : undefined;
    const groupe = `${e.famille === 'unite' ? 'unites' : e.famille === 'batiment' ? 'batiments' : 'decor'}-${peinture ?? 'naturel'}`;
    // Le pivot garde la silhouette au centre de sa case et les aéronefs au-dessus.
    const py = e.famille === 'batiment' ? h - 24 : e.famille === 'unite'
      ? e.domaine === 'air' ? h * 0.5 + 26 : h - (marcheur ? 5 : 18)
      : h - (bosquet ? 12 : e.id === 'terrain_montagne' ? 17 : e.groupe === 'biomes' ? 6 : 5);
    const entree: EntreeSprite = {
      id: e.id, famille: e.famille === 'unite' || e.famille === 'batiment' ? e.famille : 'decor',
      cle: etat ? e.id.replace(/^batiment_/, '').replace(/_(desaffecte|inerte)$/, '') : e.cle,
      ...(etat ? { etat } : {}),
      source: { fichier: `${ROOT}/${e.fichier}`, sha256: sha(original) },
      dessinStatique: true, pages: [], animations: [],
    };
    const images = groupes.get(groupe) ?? [];
    images.push({ id: e.id, entree, vue: e.vue, pixels, l, h, px: l / 2, py, ...(peinture ? { peinture } : {}) });
    groupes.set(groupe, images);
  }

  await mkdir(DEST, { recursive: true });
  const rapport: { groupe: string; fichier: string; octets: number; largeur: number; hauteur: number; entrees: string[] }[] = [];
  for (const [groupe, images] of groupes) {
    // Huit pixels vides de part et d'autre protègent les petits mipmaps.
    const placement = emballer(images.map(i => ({ l: i.l + 16, h: i.h + 16 })), 1024, 0);
    const pages: PageSprite[] = [];
    for (let p = 0; p < placement.pages.length; p++) {
      const page = placement.pages[p]!;
      const composition = images.flatMap((im, i) => {
        const place = placement.placements[i]!;
        return place.page === p ? [{ input: im.pixels, left: place.x + 8, top: place.y + 8 }] : [];
      });
      const octets = await sharp({ create: { width: page.largeur, height: page.hauteur, channels: 4, background: '#00000000' } })
        .composite(composition).webp({ lossless: true, effort: 6 }).toBuffer();
      const fichier = `${groupe}-${p}-${sha(octets).slice(0, 12)}.webp`;
      await writeFile(path.join(DEST, fichier), octets);
      const peinture = images[0]?.peinture;
      pages.push({ couleur: `assets/sprites/dessins/${fichier}`, largeur: page.largeur, hauteur: page.hauteur, ...(peinture ? { peinture } : {}) });
      rapport.push({ groupe, fichier, octets: octets.length, ...page, entrees: images.filter((_, i) => placement.placements[i]!.page === p).map(i => i.id) });
    }
    const initialisees = new Set<string>();
    images.forEach((im, i) => {
      const p = placement.placements[i]!;
      if (!initialisees.has(im.id)) {
        manifeste.entrees[im.id] = { ...im.entree, pages, animations: [] };
        initialisees.add(im.id);
      }
      manifeste.entrees[im.id]!.animations.push({ vue: im.vue, clip: 'repos', boucle: true, ips: 1,
        cadres: [{ page: p.page, x: p.x + 8, y: p.y + 8, l: im.l, h: im.h, px: im.px, py: im.py }] });
    });
  }
  // Ces anciennes variantes cuites masqueraient le nouveau QG commun en partie.
  const aliasRetires = ['batiment_qg_fr', 'batiment_qg_lu'];
  for (const id of aliasRetires) delete manifeste.entrees[id];
  const lecture = lireManifeste(manifeste);
  if (!lecture.ok || lecture.ecartees.length) throw new Error(`Manifeste refusé : ${JSON.stringify(lecture.ok ? lecture.ecartees : lecture.motif)}`);
  await writeFile(MANIFESTE, JSON.stringify(manifeste) + '\n');
  const activation = { date: new Date().toISOString(), type: 'poses_fixes', sourcesIntactes: true, aliasRetires,
    referencesSeulement: [...referencesSeulement],
    limites: ['Vues de carte et de duel partagent la pose fixe.', 'Pas de cycle de marche ou de rotor dessiné.', 'Pont tracé par le sol avec la même chaussée que les routes ; ses dessins restent des références.', 'États désaffectés : base frontale ternie sans pavillon.', 'Les variantes hivernales historiques restent disponibles.'],
    total: new Set([...groupes.values()].flat().map(i => i.id)).size,
    octetsPages: rapport.reduce((n, p) => n + p.octets, 0), pages: rapport };
  await writeFile(`${ROOT}/activation-jeu.json`, JSON.stringify(activation, null, 2) + '\n');
  console.log(JSON.stringify(activation, null, 2));
}

void main().catch((erreur: unknown) => { console.error(erreur); process.exitCode = 1; });
