/**
 * La cuisson des sprites : chaque modèle GLB photographié sous la caméra du
 * contrat (`src/render2d/contrat.ts`), réduit, rogné, emballé en pages, et le
 * manifeste que le rendu 2D lit (`doc/18-rendu-sprites.md`,
 * `doc/refonte/sprites-cuisson.md`).
 *
 *   npm run cuire:sprites -- --tout
 *   npm run cuire:sprites -- --famille unite
 *   npm run cuire:sprites -- --id unite_char_leger_base [--id …]
 *   npm run cuire:sprites -- --liste assets/sources-sprites/decor/liste.json
 *
 * Options : `--force` recuit même une entrée dont rien n'a changé ;
 * `--sortie <dossier>` écrit ailleurs que `public/assets/sprites` (la
 * calibration) ; `--garder-brut` garde les rendus à l'échelle 4 dans
 * `tmp/sprites/brut/` ; `--echantillons <n>` change les échantillons Cycles ;
 * `--paralleles <n>` le nombre de cuissons menées de front ;
 * `--temporaire <dossier>` range les brouillons ailleurs que `tmp/sprites` (une
 * cuisson d'essai ne doit pas partager les siens avec une cuisson du
 * catalogue qui tournerait en même temps) ; `--couverture` écrit en plus, à
 * côté de chaque page, une page `…_couverture.png` — la couverture du modèle,
 * hors du manifeste, que les mesures des figurines lisent.
 *
 * Blender rend (`blender/cuire_entree.py`) ; tout le reste — contour,
 * réduction, rognage, pivots, pages, manifeste — se fait ici.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, readSync, closeSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import sharp from 'sharp';

import {
  FAMILLES_SPRITE, PIXELS_PAR_CASE, SURECHANTILLONNAGE,
  type AnimationSprite, type CadreSprite, type EntreeSprite, type FamilleSprite, type PageSprite,
} from '../../src/render2d/contrat';

import { planVues, sourcesCatalogue, sourcesListe, type SourceSprite } from './catalogue';
import { emballer } from './emballage';
import { empreinte, preparerGlb } from './glb';
import {
  contourner, decouper, emprise, etendreCouleur, memesDecoupes, reduire, signature, versCalques, type Decoupe,
} from './image';
import {
  cheminCouverture, cheminEntree, cheminPage, ecrireManifeste, lireEntrees, problemesManifeste, type FichierEntree, type MetaCuisson,
} from './manifeste';
import {
  BLENDER, BORDURE, CONTOUR_PAR_FAMILLE, CUISSONS_PARALLELES, DEBRUITAGE, DOSSIER_FAMILLE, ECHANTILLONS, ECLAIRAGE, ESPACEMENT, FLOU_DE_BOUGE, FONDU_OMBRE,
  MARGE_OCCLUSION, PAGE_MAX, PREFILTRE_DEBRUITAGE, PREFIXE_PAGES, QUALITE_WEBP, RACINE_SORTIE, SEUIL_ADAPTATIF, SEUIL_OMBRE, TEMPORAIRE,
  VERSION_CUISSON, margeCanevas,
} from './reglages';

const SCRIPT_BLENDER = resolve(__dirname, 'blender', 'cuire_entree.py');

interface Options {
  ids: string[];
  familles: FamilleSprite[];
  tout: boolean;
  listes: string[];
  force: boolean;
  sortie: string;
  garderBrut: boolean;
  echantillons: number;
  paralleles: number;
  temporaire: string;
  couverture: boolean;
}

function lireOptions(argv: readonly string[]): Options {
  const o: Options = {
    ids: [], familles: [], tout: false, listes: [], force: false, sortie: RACINE_SORTIE, garderBrut: false, echantillons: ECHANTILLONS,
    paralleles: CUISSONS_PARALLELES, temporaire: TEMPORAIRE, couverture: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const valeur = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} attend une valeur`);
      return v;
    };
    if (a === '--tout') o.tout = true;
    else if (a === '--force') o.force = true;
    else if (a === '--garder-brut') o.garderBrut = true;
    else if (a === '--id') o.ids.push(valeur());
    else if (a === '--liste') o.listes.push(valeur());
    else if (a === '--sortie') o.sortie = valeur();
    else if (a === '--temporaire') o.temporaire = valeur();
    else if (a === '--couverture') o.couverture = true;
    else if (a === '--echantillons') o.echantillons = Number(valeur());
    else if (a === '--paralleles') o.paralleles = Number(valeur());
    else if (a === '--famille') {
      const f = valeur();
      if (!(FAMILLES_SPRITE as readonly string[]).includes(f)) throw new Error(`famille inconnue : ${f}`);
      o.familles.push(f as FamilleSprite);
    } else throw new Error(`option inconnue : ${a}`);
  }
  if (!(o.echantillons >= 1)) throw new Error('--echantillons attend un entier positif');
  if (!(Number.isInteger(o.paralleles) && o.paralleles >= 1)) throw new Error('--paralleles attend un entier positif');
  return o;
}

/** Les sources retenues par les options, dans l'ordre des identifiants, sans doublon. */
function choisirSources(o: Options): SourceSprite[] {
  const { sources: catalogue } = sourcesCatalogue();
  const deListes = o.listes.flatMap((l) => sourcesListe(l));
  const retenues = new Map<string, SourceSprite>();
  const ajouter = (s: SourceSprite): void => {
    const deja = retenues.get(s.id);
    if (deja && deja.fichier !== s.fichier) throw new Error(`${s.id} vient de deux sources : ${deja.fichier} et ${s.fichier}`);
    retenues.set(s.id, s);
  };
  for (const s of catalogue) {
    if (o.tout || o.familles.includes(s.famille) || o.ids.includes(s.id)) ajouter(s);
  }
  for (const s of deListes) if (o.ids.length === 0 || o.ids.includes(s.id)) ajouter(s);
  for (const id of o.ids) if (!retenues.has(id)) throw new Error(`identifiant inconnu : ${id}`);
  return [...retenues.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Lance Blender sur un travail ; relaie ses lignes `[cuisson]`, garde la fin du reste pour l'erreur. */
function lancerBlender(travail: string, id: string): Promise<void> {
  return new Promise((resoudre, rejeter) => {
    const p = spawn(BLENDER, ['-b', '--factory-startup', '--python-exit-code', '1', '-P', SCRIPT_BLENDER, '--', travail], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const fin: string[] = [];
    const lire = (morceau: Buffer): void => {
      for (const ligne of morceau.toString('utf8').split('\n')) {
        if (ligne.trim() === '') continue;
        if (ligne.startsWith('[cuisson]')) console.log(`  ${id} ${ligne.slice(10)}`);
        fin.push(ligne);
        if (fin.length > 40) fin.shift();
      }
    };
    p.stdout.on('data', lire);
    p.stderr.on('data', lire);
    p.on('error', rejeter);
    p.on('close', (code) => {
      if (code === 0) resoudre();
      else rejeter(new Error(`Blender a échoué (${code}) sur ${id} :\n${fin.join('\n')}`));
    });
  });
}

/** Ce que le script Blender écrit dans `resultat.json`. */
interface ResultatBlender {
  canaux: string[];
  emission: boolean;
  teintes: string[];
  vues: {
    vue: string;
    lacet: number;
    tangage: number;
    canevas: { x0: number; y0: number; largeur: number; hauteur: number };
    animations: { clip: string; fichier: string; images: number }[];
  }[];
  durees: { total: number; rendu: number; images: number };
}

/** Lit l'image `k` d'un fichier brut. */
function lireImage(fd: number, octetsParImage: number, k: number): Uint16Array {
  const donnees = new Uint16Array(octetsParImage / 2);
  const lus = readSync(fd, new Uint8Array(donnees.buffer), 0, octetsParImage, k * octetsParImage);
  if (lus !== octetsParImage) throw new Error(`image ${k} tronquée (${lus} octets sur ${octetsParImage})`);
  return donnees;
}

/** Les fichiers de page d'une entrée : ceux qu'on remplace à chaque cuisson. */
function pagesExistantes(dossier: string, id: string): string[] {
  if (!existsSync(dossier)) return [];
  const motif = new RegExp(`^${id}_\\d+(_masque|_emission|_couverture)?\\.(webp|png)$`);
  return readdirSync(dossier).filter((n) => motif.test(n)).map((n) => join(dossier, n));
}

/** Vrai si une cuisson précédente est encore bonne : même empreinte, toutes ses pages présentes. */
function dejaCuite(o: Options, source: SourceSprite, empreinteCuisson: string): boolean {
  const chemin = cheminEntree(o.sortie, source.famille, source.id);
  if (!existsSync(chemin)) return false;
  const f = JSON.parse(readFileSync(chemin, 'utf8')) as FichierEntree;
  if (f.cuisson?.empreinte !== empreinteCuisson) return false;
  const couvertures = o.couverture ? f.entree.pages.map((p) => cheminCouverture(p.couleur)) : [];
  return f.entree.pages.every((p) => [p.couleur, p.masque, p.emission].every((c) => c === undefined || existsSync(cheminPage(o.sortie, c))))
    && couvertures.every((c) => existsSync(cheminPage(o.sortie, c)));
}

interface Bilan { id: string; famille: FamilleSprite; statut: 'cuite' | 'inchangee' | 'echec'; octets: number; secondes: number; message?: string }

async function cuireSource(source: SourceSprite, o: Options, rang: string): Promise<Bilan> {
  const debut = Date.now();
  const id = source.id;
  const prep = resolve(o.temporaire, 'prep', `${id}.glb`);
  const infos = preparerGlb(source.fichier, prep);
  const plan = planVues(source, infos.clips);
  // Le contour de la famille, sauf pour une source qui le refuse (la calibration de la caméra).
  const contour = source.contour === false ? null : CONTOUR_PAR_FAMILLE[source.famille];
  const reglagesTravail = {
    regleMasque: source.regleMasque,
    emissionSeparee: source.emissionSeparee,
    ombre: source.ombre,
    echantillons: o.echantillons,
    seuilAdaptatif: SEUIL_ADAPTATIF,
    debruitage: DEBRUITAGE,
    prefiltre: PREFILTRE_DEBRUITAGE,
    flou: FLOU_DE_BOUGE,
    eclairage: ECLAIRAGE,
    pixelsParCase: PIXELS_PAR_CASE,
    surechantillonnage: SURECHANTILLONNAGE,
    marge: margeCanevas(contour, SURECHANTILLONNAGE),
    margeOcclusion: MARGE_OCCLUSION,
    vues: plan,
    // Les pièces qui tournent sans fin, photographiées nettes : la clé
    // n'apparaît que si le GLB en déclare, et l'empreinte des autres ne bouge pas.
    ...(infos.sansFlou.length ? { sansFlou: infos.sansFlou } : {}),
  };
  const empreinteCuisson = empreinte(JSON.stringify({
    version: VERSION_CUISSON,
    // L'état n'entre que s'il y en a un : l'empreinte des entrées d'avant ne bouge pas.
    source: {
      famille: source.famille, cle: source.cle, variante: source.variante ?? null,
      ...(source.etat ? { etat: source.etat } : {}), sha256: infos.sha256,
    },
    images: infos.images.map((i) => empreinte(readFileSync(i))),
    masque: infos.masque ? empreinte(readFileSync(infos.masque)) : null,
    reglages: { ...reglagesTravail, bordure: BORDURE, espacement: ESPACEMENT, page: PAGE_MAX, webp: QUALITE_WEBP, ombre: SEUIL_OMBRE, fondu: FONDU_OMBRE, contour },
  }));
  if (!o.force && dejaCuite(o, source, empreinteCuisson)) {
    rmSync(prep, { force: true });
    console.log(`${rang} ${id} : inchangée, pas recuite`);
    return { id, famille: source.famille, statut: 'inchangee', octets: 0, secondes: 0 };
  }

  const brut = resolve(o.temporaire, 'brut', id);
  rmSync(brut, { recursive: true, force: true });
  mkdirSync(brut, { recursive: true });
  const cheminTravail = resolve(o.temporaire, 'travaux', `${id}.json`);
  mkdirSync(resolve(o.temporaire, 'travaux'), { recursive: true });
  writeFileSync(cheminTravail, JSON.stringify({ ...reglagesTravail, glb: prep, masque: infos.masque, sortie: brut }, null, 1));
  console.log(`${rang} ${id} : ${plan.reduce((n, v) => n + v.animations.reduce((m, a) => m + a.temps.length, 0), 0)} images à rendre${infos.compresse ? ' (source décompressée)' : ''}`);
  await lancerBlender(cheminTravail, id);
  const resultat = JSON.parse(readFileSync(join(brut, 'resultat.json'), 'utf8')) as ResultatBlender;

  // Réduction, calques, rognage, dédoublonnage.
  const avertissements: string[] = [];
  const avecMasque = infos.masque !== null && resultat.teintes.length > 0;
  const uniques: Decoupe[] = [];
  const parSignature = new Map<string, number[]>();
  const animations: { plan: (typeof plan)[number]['animations'][number]; vue: string; cadres: { decoupe: number; px: number; py: number }[] }[] = [];
  const canevas: MetaCuisson['canevas'] = {};
  let images = 0;
  for (const vue of resultat.vues) {
    const { x0, y0, largeur, hauteur } = vue.canevas;
    canevas[vue.vue] = vue.canevas;
    const vuePlan = plan.find((v) => v.vue === vue.vue)!;
    const octetsParImage = largeur * SURECHANTILLONNAGE * hauteur * SURECHANTILLONNAGE * resultat.canaux.length * 2;
    for (const anim of vue.animations) {
      const animPlan = vuePlan.animations.find((a) => a.clip === anim.clip)!;
      const cadres: { decoupe: number; px: number; py: number }[] = [];
      const fd = openSync(join(brut, anim.fichier), 'r');
      try {
        for (let k = 0; k < anim.images; k++) {
          const rendue = { largeur: largeur * SURECHANTILLONNAGE, hauteur: hauteur * SURECHANTILLONNAGE, canaux: resultat.canaux, donnees: lireImage(fd, octetsParImage, k) };
          // Le contour se pose à l'échelle du rendu, sous le modèle : la réduction l'adoucit.
          const brute = contour ? contourner(rendue, contour) : rendue;
          const calques = versCalques(reduire(brute, SURECHANTILLONNAGE), { masque: avecMasque, emission: resultat.emission, seuilOmbre: SEUIL_OMBRE, fonduOmbre: FONDU_OMBRE });
          let e = emprise(calques, BORDURE);
          if (!e) {
            avertissements.push(`${vue.vue}/${anim.clip}[${k}] vide`);
            // Une image vide garde un pixel transparent sur le pivot : le cadre existe, rien ne se dessine.
            e = { rect: { x: Math.min(largeur - 1, Math.max(0, -x0)), y: Math.min(hauteur - 1, Math.max(0, -y0)), l: 1, h: 1 }, touche: false };
          }
          if (e.touche) avertissements.push(`${vue.vue}/${anim.clip}[${k}] touche le bord du canevas`);
          const d = decouper(calques, e.rect, o.couverture);
          etendreCouleur(d, 2);
          const sig = signature(d);
          const candidats = parSignature.get(sig) ?? [];
          let indice = candidats.find((i) => memesDecoupes(uniques[i]!, d));
          if (indice === undefined) {
            indice = uniques.length;
            uniques.push(d);
            candidats.push(indice);
            parSignature.set(sig, candidats);
          }
          // Le pivot est l'origine du modèle : le point (0, 0) du plan, qui
          // tombe au pixel (−x0, −y0) du canevas, en coordonnées continues.
          cadres.push({ decoupe: indice, px: -x0 - e.rect.x, py: -y0 - e.rect.y });
          images++;
        }
      } finally {
        closeSync(fd);
      }
      animations.push({ plan: animPlan, vue: vue.vue, cadres });
    }
  }
  if (avecMasque && !uniques.some((d) => d.masque?.some((v) => v > 0))) avertissements.push('masque entièrement vide');

  // Les pages.
  const emb = emballer(uniques.map((d) => ({ l: d.l, h: d.h })), PAGE_MAX, ESPACEMENT);
  const dossierRel = DOSSIER_FAMILLE[source.famille];
  const dossier = join(o.sortie, dossierRel);
  mkdirSync(dossier, { recursive: true });
  for (const ancien of pagesExistantes(dossier, id)) rmSync(ancien);
  const pages: PageSprite[] = [];
  let octets = 0;
  for (let n = 0; n < emb.pages.length; n++) {
    const { largeur, hauteur } = emb.pages[n]!;
    const couleur = new Uint8Array(largeur * hauteur * 4);
    const masque = avecMasque ? new Uint8Array(largeur * hauteur) : null;
    const emission = resultat.emission ? new Uint8Array(largeur * hauteur * 3) : null;
    const couverture = o.couverture ? new Uint8Array(largeur * hauteur) : null;
    uniques.forEach((d, i) => {
      const pl = emb.placements[i]!;
      if (pl.page !== n) return;
      for (let y = 0; y < d.h; y++) {
        const cible = (pl.y + y) * largeur + pl.x;
        couleur.set(d.couleur.subarray(y * d.l * 4, (y + 1) * d.l * 4), cible * 4);
        if (masque && d.masque) masque.set(d.masque.subarray(y * d.l, (y + 1) * d.l), cible);
        if (emission && d.emission) emission.set(d.emission.subarray(y * d.l * 3, (y + 1) * d.l * 3), cible * 3);
        if (couverture && d.couverture) couverture.set(d.couverture.subarray(y * d.l, (y + 1) * d.l), cible);
      }
    });
    const nomCouleur = `${id}_${n}.webp`;
    const page: PageSprite = { couleur: `${PREFIXE_PAGES}/${dossierRel}/${nomCouleur}`, largeur, hauteur };
    await sharp(couleur, { raw: { width: largeur, height: hauteur, channels: 4 } })
      .webp({ quality: QUALITE_WEBP, alphaQuality: 100, effort: 6, smartSubsample: true, exact: true })
      .toFile(join(dossier, nomCouleur));
    octets += statSync(join(dossier, nomCouleur)).size;
    if (masque) {
      const nom = `${id}_${n}_masque.png`;
      await sharp(masque, { raw: { width: largeur, height: hauteur, channels: 1 } }).png({ compressionLevel: 9 }).toFile(join(dossier, nom));
      page.masque = `${PREFIXE_PAGES}/${dossierRel}/${nom}`;
      octets += statSync(join(dossier, nom)).size;
    }
    if (emission) {
      const nom = `${id}_${n}_emission.webp`;
      await sharp(emission, { raw: { width: largeur, height: hauteur, channels: 3 } }).webp({ quality: QUALITE_WEBP, effort: 6 }).toFile(join(dossier, nom));
      page.emission = `${PREFIXE_PAGES}/${dossierRel}/${nom}`;
      octets += statSync(join(dossier, nom)).size;
    }
    if (couverture) {
      // Un diagnostic, pas une page du contrat : ni dans le manifeste, ni dans le poids.
      await sharp(couverture, { raw: { width: largeur, height: hauteur, channels: 1 } }).png({ compressionLevel: 9 })
        .toFile(cheminPage(o.sortie, cheminCouverture(page.couleur)));
    }
    pages.push(page);
  }

  const entree: EntreeSprite = {
    id,
    famille: source.famille,
    cle: source.cle,
    ...(source.variante ? { variante: source.variante } : {}),
    ...(source.etat ? { etat: source.etat } : {}),
    source: { fichier: source.fichier, sha256: infos.sha256 },
    pages,
    animations: animations.map((a): AnimationSprite => ({
      vue: a.vue as AnimationSprite['vue'],
      clip: a.plan.clip,
      boucle: a.plan.boucle,
      ips: a.plan.ips,
      cadres: a.cadres.map((c): CadreSprite => {
        const pl = emb.placements[c.decoupe]!;
        const d = uniques[c.decoupe]!;
        return { page: pl.page, x: pl.x, y: pl.y, l: d.l, h: d.h, px: c.px, py: c.py };
      }),
    })),
  };
  const secondes = (Date.now() - debut) / 1000;
  const cuisson: MetaCuisson = {
    version: VERSION_CUISSON,
    empreinte: empreinteCuisson,
    date: new Date().toISOString(),
    secondes: Math.round(secondes * 10) / 10,
    secondesRendu: Math.round(resultat.durees.rendu * 10) / 10,
    images,
    imagesUniques: uniques.length,
    octets,
    canevas,
    materiauxTeints: resultat.teintes,
    avertissements,
  };
  writeFileSync(cheminEntree(o.sortie, source.famille, id), `${JSON.stringify({ entree, cuisson }, null, 1)}\n`);
  if (!o.garderBrut) rmSync(brut, { recursive: true, force: true });
  rmSync(prep, { force: true });
  console.log(`${rang} ${id} : ${images} images (${uniques.length} uniques), ${pages.length} page(s), ${Math.round(octets / 1024)} Ko, ${secondes.toFixed(0)} s${avertissements.length ? ` — ${avertissements.length} avertissement(s) : ${avertissements.slice(0, 3).join(' ; ')}` : ''}`);
  return { id, famille: source.famille, statut: 'cuite', octets, secondes };
}

/** Les dimensions réelles de chaque page du manifeste, lues sur le disque. */
async function tailles(racine: string, chemins: readonly string[]): Promise<Map<string, { largeur: number; hauteur: number }>> {
  const t = new Map<string, { largeur: number; hauteur: number }>();
  for (const c of chemins) {
    const disque = cheminPage(racine, c);
    if (!existsSync(disque)) continue;
    const m = await sharp(disque).metadata();
    t.set(c, { largeur: m.width ?? 0, hauteur: m.height ?? 0 });
  }
  return t;
}

async function main(): Promise<void> {
  const o = lireOptions(process.argv.slice(2));
  if (!o.tout && o.ids.length === 0 && o.familles.length === 0 && o.listes.length === 0) {
    console.error('rien à cuire : --tout, --famille <f>, --id <id> ou --liste <liste.json>');
    process.exitCode = 1;
    return;
  }
  if (!existsSync(BLENDER)) throw new Error(`Blender introuvable : ${BLENDER} (variable BLENDER)`);
  const sources = choisirSources(o);
  console.log(`${sources.length} entrée(s) à examiner, sortie ${o.sortie}`);
  mkdirSync(o.sortie, { recursive: true });
  const debut = Date.now();
  const bilans: Bilan[] = [];
  // Une file, et `paralleles` ouvriers qui s'y servent.
  let suivante = 0;
  const ouvrier = async (): Promise<void> => {
    while (suivante < sources.length) {
      const i = suivante++;
      const s = sources[i]!;
      const rang = `[${i + 1}/${sources.length}]`;
      try {
        bilans.push(await cuireSource(s, o, rang));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`${rang} ${s.id} : ÉCHEC — ${message}`);
        bilans.push({ id: s.id, famille: s.famille, statut: 'echec', octets: 0, secondes: 0, message });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(o.paralleles, sources.length) }, ouvrier));
  const manifeste = ecrireManifeste(o.sortie);
  const chemins = Object.values(manifeste.entrees).flatMap((e) => e.pages.flatMap((p) => [p.couleur, p.masque, p.emission].filter((c): c is string => c !== undefined)));
  const t = await tailles(o.sortie, chemins);
  const problemes = problemesManifeste(manifeste, (c) => t.get(c) ?? null);

  // Le poids, par famille, de tout ce qui est sur le disque.
  const poids = new Map<string, number>();
  let total = 0;
  for (const f of lireEntrees(o.sortie)) {
    const dossier = join(o.sortie, DOSSIER_FAMILLE[f.entree.famille]);
    const octets = pagesExistantes(dossier, f.entree.id).reduce((s, c) => s + statSync(c).size, 0) + statSync(cheminEntree(o.sortie, f.entree.famille, f.entree.id)).size;
    poids.set(f.entree.famille, (poids.get(f.entree.famille) ?? 0) + octets);
    total += octets;
  }
  total += statSync(join(o.sortie, 'manifeste.json')).size;
  const mo = (n: number): string => `${(n / 1024 / 1024).toFixed(2)} Mo`;
  console.log(`\n${bilans.filter((b) => b.statut === 'cuite').length} cuite(s), ${bilans.filter((b) => b.statut === 'inchangee').length} inchangée(s), ${bilans.filter((b) => b.statut === 'echec').length} échec(s) en ${((Date.now() - debut) / 60000).toFixed(1)} min`);
  console.log(`manifeste : ${Object.keys(manifeste.entrees).length} entrées ; poids ${mo(total)} (${[...poids].map(([f, n]) => `${f} ${mo(n)}`).join(', ')})`);
  for (const p of problemes) console.error(`problème : ${p}`);
  for (const b of bilans.filter((x) => x.statut === 'echec')) console.error(`échec : ${b.id}`);
  if (problemes.length > 0 || bilans.some((b) => b.statut === 'echec')) process.exitCode = 1;
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
