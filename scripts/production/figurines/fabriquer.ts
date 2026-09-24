/**
 * La fabrication d'une figurine, de bout en bout, en une commande :
 *
 *   npm run fabriquer:figurine -- --cle char_leger
 *   npm run fabriquer:figurine -- --batiment ville [--etat desaffecte] [--variante fr]
 *
 * 1. Blender (`fabriquer.py`) construit `unites/<cle>.py` (ou
 *    `batiments/<cle>.py`) avec la bibliothèque, exporte le GLB brut et rend
 *    les images d'identifiants ;
 * 2. le lot (`lot.ts`) : le GLB de la fiche, cartes et clips posés, et les PNG
 *    de l'atlas, dans `tmp/figurines/<cle>/lot/` ;
 * 3. la fiche de contrôle : par défaut une copie de la fiche du canon aux
 *    dimensions **mesurées** du modèle et au budget de la charte
 *    (`tmp/figurines/<cle>/fiche.json`) — le coordinateur reporte ces
 *    dimensions au catalogue à l'installation ; `--fiche officielle` contrôle
 *    contre `assets/specs/`, `--fiche <chemin>` contre un autre fichier ;
 * 4. le contrôle du dépôt (`controlerDepot`, le verdict de
 *    `npm run controler:asset -- --lot`) ;
 * 5. la cuisson d'essai (`scripts/sprites/cuire.ts --liste … --sortie …`),
 *    avec ses pages de couverture ; rien n'est écrit sous `public/` ;
 * 6. les mesures, jugées contre la charte, et les planches.
 *
 * Options : `--fiche mesuree|officielle|<chemin>`, `--sans-cuisson` (Blender,
 * lot, contrôle et aperçu de la palette et de la silhouette sur les
 * identifiants : quelques secondes, pas de planche), `--echantillons <n>`
 * (Cycles ; 24 par défaut, 8 pour un essai rapide), `--module <fichier.py>`
 * (essayer une variante sans toucher `unites/<cle>.py`), `--sortie <dossier>`
 * (ailleurs que `tmp/figurines/<cle>/`, pour ne pas écraser l'essai d'un autre)
 * et `--determinisme` / `--sans-determinisme` : Blender construit le module une
 * seconde fois et les deux GLB — le brut, puis celui du lot — doivent être
 * identiques à l'octet, sans quoi c'est un échec (la cuisson recuirait pour
 * rien une figurine qui n'a pas changé). Fait par défaut avec la cuisson, pas
 * avec `--sans-cuisson`.
 *
 * **Un bâtiment** (`--batiment <cle>`, `doc/refonte/plan-batiments.md` §5) :
 * la même chaîne, une entrée par état et par variante que le module déclare
 * (`ETATS`, `VARIANTES` ; `--etat`, `--variante` en retiennent une), chacune
 * dans `tmp/figurines/batiments/<cle>/<id>/`, cuite en vue `fixe` avec son
 * ombre au sol et ses fenêtres dans leur page, mesurée par les règles des
 * bâtiments (`mesures-batiments.ts`) ; puis une planche pour le bâtiment
 * entier, `tmp/figurines/batiments/<cle>/planche.png` — les camps, le neutre,
 * le désaffecté, la nuit, à 128 et à 48 px, et un plateau avec les unités
 * installées. Une fiche que le catalogue n'a pas encore (un désaffecté, la
 * superusine) se dérive de celle de son type de base (`batiments.ts`).
 * `--sortie` y remplace `tmp/figurines/batiments/<cle>/`.
 *
 * Sorties dans `tmp/figurines/<cle>/` : `lot/`, `fiche.json`, `sprites/`,
 * `planche.png`, `planche-clips.png`, `rapport.json`. Code de sortie : 0 si
 * le contrôle passe et qu'aucune règle n'échoue, 1 sinon, 2 si la fabrication
 * elle-même a échoué.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { validerAssetSpec, type AssetSpec } from '../../../src/assets/index';
import { contratProduction } from '../../../src/assets/production';
import { mesurerGltf, type DocumentGltf as DocumentLu } from '../../../src/assets/valider-gltf';
import { IMAGES_PAR_SECONDE, PIXELS_PAR_CASE, type ManifesteSprites, type VueSprite } from '../../../src/render2d/contrat';
import { controlerDepot, type VerdictDepot } from '../../../src/serveur/depot-modeles';
import { decouperGlb, type DocumentGltf } from '../../infanterie/gltf';
import { anomaliesEntree, decrireAnomalie } from '../../sprites/anomalies';
import { documentGlb } from '../../sprites/glb';
import { BLENDER, FLOU_DE_BOUGE, IMAGES_MAX_PAR_CLIP } from '../../sprites/reglages';

import {
  declarationsModule, dossierBatiment, entreesBatiment, ficheDerivee, fichesCandidates, TERRAINS_FIGURINES, type EntreeBatiment, type FamilleFigurine,
} from './batiments';
import { CHARTE } from './charte';
import { lireCuisson, lireIds, type Cuisson } from './lecture';
import { assemblerLot, ecartsGlb, ficheMesuree, type RapportBlender } from './lot';
import {
  agitation, clarteHorsEquipe, classeDe, emprise, empriseIds, equipeConnexe, genreDe, iou, masseSombreEnBas, partEquipe, partEquipeEclairee, partsTeintes, pixelsTournants, regles, rvb01, silhouette,
  type Cadre, type Mesures, type Regle,
} from './mesures';
import {
  ecartsRepos, empriseModele, partEmission, reglesBatiment, verdictHauteurQg, type BatimentInstalle, type MesuresBatiment,
} from './mesures-batiments';
import { ecrirePlanche, ecrirePlancheClips } from './planche';
import { ecrirePlancheBatiment, ecrirePlancheClipsBatiment, type EtatPlanche } from './planche-batiment';

const ICI = __dirname;
const DEPOT = resolve(ICI, '..', '..', '..');

interface Options {
  /** L'unité (`--cle`), ou vide pour un bâtiment. */
  cle: string;
  /** Le bâtiment (`--batiment`), ou null pour une unité. */
  batiment: string | null;
  etat: string | null;
  variante: string | null;
  fiche: string; cuisson: boolean; echantillons: number | null; module: string | null; sortie: string | null;
  /** Null : par défaut, avec la cuisson seulement. */
  determinisme: boolean | null;
}

const USAGE = 'usage : npm run fabriquer:figurine -- (--cle <cle> | --batiment <cle> [--etat <état>] [--variante <v>]) [--fiche mesuree|officielle|<chemin>] '
  + '[--sans-cuisson] [--echantillons <n>] [--module <fichier.py>] [--sortie <dossier>] [--determinisme|--sans-determinisme]';

function lireOptions(argv: readonly string[]): Options {
  const o: Options = { cle: '', batiment: null, etat: null, variante: null, fiche: 'mesuree', cuisson: true, echantillons: null, module: null, sortie: null, determinisme: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const valeur = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} attend une valeur`);
      return v;
    };
    if (a === '--cle') o.cle = valeur();
    else if (a === '--batiment') o.batiment = valeur();
    else if (a === '--etat') o.etat = valeur();
    else if (a === '--variante') o.variante = valeur();
    else if (a === '--fiche') o.fiche = valeur();
    else if (a === '--sans-cuisson') o.cuisson = false;
    else if (a === '--echantillons') o.echantillons = Number(valeur());
    else if (a === '--module') o.module = valeur();
    else if (a === '--sortie') o.sortie = valeur();
    else if (a === '--determinisme') o.determinisme = true;
    else if (a === '--sans-determinisme') o.determinisme = false;
    else throw new Error(`option inconnue : ${a}`);
  }
  if (o.batiment !== null) {
    if (o.cle) throw new Error(`--cle ou --batiment, pas les deux\n${USAGE}`);
    if (!/^[a-z][a-z0-9]*$/.test(o.batiment)) throw new Error(`clé de bâtiment invalide : ${o.batiment}\n${USAGE}`);
  } else {
    if (o.etat || o.variante) throw new Error(`--etat et --variante sont pour un bâtiment\n${USAGE}`);
    if (!/^[a-z0-9_]+$/.test(o.cle)) throw new Error(USAGE);
  }
  return o;
}

function lireSpec(chemin: string): AssetSpec {
  const r = validerAssetSpec(JSON.parse(readFileSync(chemin, 'utf8')));
  if (!r.ok) throw new Error(`fiche invalide : ${chemin}\n${r.erreurs.map((e) => `  · ${e.chemin} : ${e.message}`).join('\n')}`);
  return r.valeur;
}

/** Le premier cadre d'une vue, dans le premier des clips qui en a. */
function premierCadre(cuisson: Cuisson, vue: VueSprite, clips: readonly string[]): Cadre | null {
  for (const c of clips) {
    const cadres = cuisson.cadres(vue, c);
    if (cadres.length) return cadres[0]!;
  }
  return null;
}

/**
 * L'ombre chinoise de la figurine contre les unités du même milieu déjà dans
 * les images du jeu (`public/assets/sprites/`, manifeste courant), l'unité
 * elle-même exceptée : la plus proche, vues « droite » et « bas » (charte,
 * `recouvrement`).
 */
async function recouvrementInstallees(cle: string, domaine: string, droite: Cadre, bas: Cadre,
  unites: readonly { cle: string; domaine: string }[]): Promise<NonNullable<Mesures['recouvrement']> | null> {
  const racine = join('public', 'assets', 'sprites');
  const manifeste = join(racine, 'manifeste.json');
  if (!existsSync(manifeste)) return null;
  const { pixelsParCase } = CHARTE.recouvrement;
  const nous = { droite: silhouette(droite, pixelsParCase, PIXELS_PAR_CASE), bas: silhouette(bas, pixelsParCase, PIXELS_PAR_CASE) };
  let plusProche: NonNullable<Mesures['recouvrement']> | null = null;
  for (const e of Object.values((JSON.parse(readFileSync(manifeste, 'utf8')) as ManifesteSprites).entrees)) {
    if (e.famille !== 'unite' || e.cle === cle || unites.find((u) => u.cle === e.cle)?.domaine !== domaine) continue;
    // Une unité qu'on réinstalle pendant la mesure a ses pages un instant
    // absentes : elle est sautée, pas la mesure entière (vu le 24 septembre,
    // le cuirassé mesuré pendant la réinstallation du drone marin).
    let autre: Awaited<ReturnType<typeof lireCuisson>>;
    try {
      autre = await lireCuisson(racine, e.id);
    } catch (erreur) {
      console.warn(`  recouvrement : ${e.id} illisible, sautée (${erreur instanceof Error ? erreur.message : String(erreur)})`);
      continue;
    }
    const d = premierCadre(autre, 'droite', ['repos', 'deplacement']);
    const b = premierCadre(autre, 'bas', ['deplacement', 'repos']);
    if (!d || !b) continue;
    const vd = iou(nous.droite, silhouette(d, pixelsParCase, PIXELS_PAR_CASE));
    const vb = iou(nous.bas, silhouette(b, pixelsParCase, PIXELS_PAR_CASE));
    const valeur = Math.max(vd, vb);
    if (!plusProche || valeur > plusProche.valeur) plusProche = { unite: e.cle, vue: vd >= vb ? 'droite' : 'bas', valeur, droite: vd, bas: vb };
  }
  return plusProche;
}

/**
 * L'ombre chinoise d'un bâtiment, vue fixe, contre les bâtiments d'une autre
 * clé déjà dans les images du jeu : la plus proche. L'alpha au-dessus de
 * `batiments.silhouetteAlphaMin` : l'ombre cuite au sol n'en est pas.
 */
async function recouvrementBatiments(cle: string, fixe: Cadre): Promise<NonNullable<MesuresBatiment['recouvrement']> | null> {
  const racine = join('public', 'assets', 'sprites');
  const manifeste = join(racine, 'manifeste.json');
  if (!existsSync(manifeste)) return null;
  const { pixelsParCase } = CHARTE.recouvrement;
  const seuil = CHARTE.batiments.silhouetteAlphaMin;
  const nous = silhouette(fixe, pixelsParCase, PIXELS_PAR_CASE, seuil);
  let plusProche: NonNullable<MesuresBatiment['recouvrement']> | null = null;
  for (const e of Object.values((JSON.parse(readFileSync(manifeste, 'utf8')) as ManifesteSprites).entrees)) {
    if (e.famille !== 'batiment' || e.cle === cle) continue;
    let autre: Cuisson;
    try {
      autre = await lireCuisson(racine, e.id, 'batiment');
    } catch (erreur) {
      console.warn(`  recouvrement : ${e.id} illisible, sauté (${erreur instanceof Error ? erreur.message : String(erreur)})`);
      continue;
    }
    const f = premierCadre(autre, 'fixe', ['repos']);
    if (!f) continue;
    const valeur = iou(nous, silhouette(f, pixelsParCase, PIXELS_PAR_CASE, seuil));
    if (!plusProche || valeur > plusProche.valeur) plusProche = { batiment: e.id, valeur };
  }
  return plusProche;
}

/**
 * Les bâtiments **figurines** déjà installés (`assets/production/activation-jeu.json`,
 * provenance `figurine`), et la hauteur de leur modèle : de quoi dire si le QG
 * reste le plus haut. Ceux d'avant la charte ne comptent pas.
 */
function batimentsFigurinesInstalles(): BatimentInstalle[] {
  const chemin = join('assets', 'production', 'activation-jeu.json');
  if (!existsSync(chemin)) return [];
  const activation = JSON.parse(readFileSync(chemin, 'utf8')) as { assets: { id: string; fichierActif?: string; provenance?: string }[] };
  const sortie: BatimentInstalle[] = [];
  for (const a of activation.assets) {
    const m = /^batiment_([a-z][a-z0-9]*)_/.exec(a.id);
    if (!m || a.provenance !== 'figurine' || !a.fichierActif || !existsSync(a.fichierActif)) continue;
    const { boite } = mesurerGltf(documentGlb(new Uint8Array(readFileSync(a.fichierActif))) as unknown as DocumentLu);
    if (boite) sortie.push({ id: a.id, cle: m[1]!, hauteur: boite.max[1] });
  }
  return sortie;
}

/** Lance un processus ; relaie les lignes qui commencent par `prefixe` (toutes si vide), garde la fin pour l'erreur. */
function lancer(commande: string, args: readonly string[], prefixe: string): Promise<void> {
  return new Promise((resoudre, rejeter) => {
    const p = spawn(commande, args, { cwd: DEPOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const fin: string[] = [];
    const lire = (morceau: Buffer): void => {
      for (const ligne of morceau.toString('utf8').split('\n')) {
        if (ligne.trim() === '') continue;
        if (prefixe === '' || ligne.startsWith(prefixe)) console.log(`  ${ligne}`);
        fin.push(ligne);
        if (fin.length > 60) fin.shift();
      }
    };
    p.stdout.on('data', lire);
    p.stderr.on('data', lire);
    p.on('error', rejeter);
    p.on('close', (code) => (code === 0 ? resoudre() : rejeter(new Error(`${commande} a échoué (${code}) :\n${fin.join('\n')}`))));
  });
}

// ---------------------------------------------------------------------------
// Les étapes communes : Blender, le lot, la fiche, le contrôle, le déterminisme
// ---------------------------------------------------------------------------

/** Ce qu'une figurine est pour la chaîne : une unité, un état de bâtiment, le pont. */
interface Sujet {
  id: string;
  /** La clé du module : `char_leger`, `ville`, `pont`. */
  cle: string;
  famille: FamilleFigurine;
  etat: string;
  variante: string;
  module: string;
  dossier: string;
  officielle: AssetSpec;
  /** Le fichier de la fiche officielle — celui du catalogue, ou sa dérivation écrite dans le dossier. */
  cheminOfficielle: string;
  /** L'identifiant dont la fiche est dérivée, quand le catalogue ne l'a pas encore. */
  derivee: string | null;
  /** L'unité du canon (`content/unites.json`), pour une unité. */
  unite: unknown;
  vuesIds: [VueSprite, string][];
  vuePrincipale: VueSprite;
}

type RapportFigurine = RapportBlender & {
  pieces: { nom: string; epaisseurMin: number; fin: boolean }[]; triangles: number; rotationRepos: Record<string, number>;
  emprise: { min: number[]; max: number[] };
  declarations?: { largeurVisee?: [number, number] | null; genre?: string | null; etats?: string[]; variantes?: string[] };
  ids: { canevas: { x0: number; y0: number }; vues: { vue: string; clip: string; images: { fichier: string }[] }[]; tournants?: string };
  avertissements: string[];
  coinMat?: { libre: boolean; hauteur: number | null; noeuds: string[] };
};

/** Ce que les étapes communes rendent. */
interface Fabrication {
  blender: string;
  rapportBlender: RapportFigurine;
  lot: string;
  fichiers: Map<string, Uint8Array>;
  glb: Uint8Array;
  document: DocumentGltf;
  fiche: AssetSpec;
  cheminFiche: string;
  verdict: VerdictDepot;
  rapport: Record<string, unknown>;
  echecs: number;
}

/** Imprime le contrat d'assemblage d'une fiche, s'il y en a un, déjà traduit en appels. */
function imprimerContrat(officielle: AssetSpec): void {
  // Le contrôle refuse un nœud dont le parent ou le pivot local diffère.
  // `f.noeud(pivot=…)` prend un pivot absolu : on l'imprime tel qu'il faut l'écrire.
  const contrat = contratProduction(officielle).assemblage;
  if (!contrat.some((a) => a.pivot)) return;
  const absolu = (nom: string | null): number[] => {
    const a = contrat.find((x) => x.nom === nom);
    if (!a) return [0, 0, 0];
    const p = absolu(a.parent);
    return (a.pivot ?? [0, 0, 0]).map((v, k) => Math.round((v + p[k]!) * 1000) / 1000);
  };
  console.log('  contrat d’assemblage de la fiche (src/assets/production.ts) : parent et pivot imposés, au millimètre');
  for (const a of contrat.filter((x) => x.pivot && x.parent)) console.log(`    f.noeud('${a.nom}', parent='${a.parent}', pivot=(${absolu(a.nom).join(', ')}))`);
}

/**
 * Les étapes 1 à 4, et le déterminisme : Blender, le lot, la fiche de
 * contrôle, le contrôle du dépôt ; puis l'aperçu de la palette et de la
 * silhouette sur les identifiants.
 */
async function construireEtControler(s: Sujet, o: Options): Promise<Fabrication> {
  imprimerContrat(s.officielle);

  // 1. Blender. La cadence et l'obturateur de la cuisson sont lus ici, à leur
  // source, et passés à la bibliothèque : elle n'en garde qu'un repli.
  console.log(`[1/6] Blender : ${s.module}`);
  const blender = join(s.dossier, 'blender');
  const construire = async (sortie: string, ids: boolean, prefixe: string): Promise<void> => {
    rmSync(sortie, { recursive: true, force: true });
    mkdirSync(sortie, { recursive: true });
    const travail = join(s.dossier, ids ? 'travail.json' : `travail-${prefixe}.json`);
    writeFileSync(travail, JSON.stringify({
      cle: s.cle, fiche: resolve(s.cheminOfficielle), charte: resolve(ICI, 'charte.json'), module: resolve(s.module),
      sortie: resolve(sortie), unite: s.unite, ids,
      cuisson: { imagesParSeconde: IMAGES_PAR_SECONDE, imagesMaxParClip: IMAGES_MAX_PAR_CLIP, flouDeBouge: FLOU_DE_BOUGE },
      // Une unité garde le travail d'avant, clé pour clé : rien de neuf n'y entre.
      ...(s.famille === 'unite' ? {} : { famille: s.famille, etat: s.etat, variante: s.variante, vuesIds: s.vuesIds, vuePrincipale: s.vuePrincipale }),
    }, null, 1));
    await lancer(BLENDER, ['-b', '--factory-startup', '--python-exit-code', '1', '-P', join(ICI, 'fabriquer.py'), '--', resolve(travail)], ids ? '[figurine]' : `[${prefixe}]`);
  };
  await construire(blender, true, 'figurine');
  const rapportBlender = JSON.parse(readFileSync(join(blender, 'figurine.json'), 'utf8')) as RapportFigurine;

  // 2. Le lot.
  console.log('[2/6] le lot');
  const lot = join(s.dossier, 'lot');
  rmSync(lot, { recursive: true, force: true });
  mkdirSync(lot, { recursive: true });
  const fichiers = assemblerLot(new Uint8Array(readFileSync(join(blender, 'modele.glb'))), rapportBlender, s.officielle, CHARTE);
  for (const [nom, octets] of fichiers) writeFileSync(join(lot, nom), octets);
  const glb = fichiers.get(`${s.id}_lod0.glb`)!;
  const { document } = decouperGlb(glb);
  console.log(`  ${fichiers.size} fichiers, ${Math.round([...fichiers.values()].reduce((t, b) => t + b.length, 0) / 1024)} Ko`);

  // 3. La fiche de contrôle.
  let fiche = s.officielle;
  let cheminFiche = s.cheminOfficielle;
  if (o.fiche === 'mesuree') {
    fiche = ficheMesuree(s.officielle, document, CHARTE.budget.triangles);
    cheminFiche = join(s.dossier, 'fiche.json');
    writeFileSync(cheminFiche, `${JSON.stringify(fiche, null, 2)}\n`);
    console.log(`[3/6] fiche mesurée : ${cheminFiche} (x ${fiche.echelle.x.cible}, y ${fiche.echelle.y.cible}, z ${fiche.echelle.z.cible} m ; budget ${fiche.budget.lod0})`);
  } else if (o.fiche !== 'officielle') {
    fiche = lireSpec(o.fiche);
    cheminFiche = o.fiche;
    console.log(`[3/6] fiche : ${cheminFiche}`);
  } else console.log(`[3/6] fiche officielle : ${cheminFiche}${s.derivee ? ` (dérivée de ${s.derivee})` : ''}`);

  // 4. Le contrôle du dépôt.
  const livres = [...fichiers].map(([nom, octets]) => ({ nom, octets }));
  const verdict = controlerDepot(fiche, livres);
  const verdictOfficiel = controlerDepot(s.officielle, livres);
  console.log(`[4/6] contrôle : ${verdict.ok ? 'ACCEPTÉ' : 'REFUSÉ'}${verdict.motifs.length ? ` — ${verdict.motifs.map((m) => `${m.code} ${m.detail ?? ''}`).join(' ; ')}` : ''}`);
  if (o.fiche === 'mesuree') {
    console.log(`  contre la fiche officielle${s.derivee ? ` (dérivée de ${s.derivee})` : ''} : ${verdictOfficiel.ok ? 'accepté' : `refusé (${verdictOfficiel.motifs.map((m) => m.detail ?? m.code).join(' ; ')})`}`);
  }

  const rapport: Record<string, unknown> = {
    cle: s.cle, id: s.id, date: new Date().toISOString(), fiche: cheminFiche,
    ...(s.famille === 'unite' ? {} : { famille: s.famille, etat: s.etat, variante: s.variante, ficheOfficielle: s.cheminOfficielle, ficheDeriveeDe: s.derivee }),
    controle: verdict, controleOfficiel: verdictOfficiel, blender: { triangles: rapportBlender.triangles, teintes: rapportBlender.teintes, avertissements: rapportBlender.avertissements },
  };
  let echecs = verdict.ok ? 0 : 1;

  // Le déterminisme : le même module, construit une seconde fois (sans les
  // identifiants), doit rendre le même GLB, à l'octet — le brut, et le lot.
  if (o.determinisme ?? o.cuisson) {
    const second = join(s.dossier, 'blender-2');
    await construire(second, false, 'determinisme');
    const brut2 = new Uint8Array(readFileSync(join(second, 'modele.glb')));
    const rapport2 = JSON.parse(readFileSync(join(second, 'figurine.json'), 'utf8')) as RapportBlender;
    const lot2 = assemblerLot(brut2, rapport2, s.officielle, CHARTE).get(`${s.id}_lod0.glb`)!;
    const ecartsBrut = ecartsGlb(new Uint8Array(readFileSync(join(blender, 'modele.glb'))), brut2);
    const ecartsLot = ecartsGlb(glb, lot2);
    const identique = ecartsBrut.length === 0 && ecartsLot.length === 0;
    console.log(`  déterminisme : ${identique ? `deux constructions, le même GLB à l'octet (${glb.length} octets)` : 'DEUX GLB DIFFÉRENTS'}`);
    for (const e of [...ecartsBrut.map((x) => `brut — ${x}`), ...ecartsLot.map((x) => `lot — ${x}`)]) console.log(`    ${e}`);
    rapport.determinisme = { identique, octets: glb.length, ecartsBrut, ecartsLot };
    if (!identique) echecs++;
    rmSync(second, { recursive: true, force: true });
  }

  // L'aperçu de la palette et de la silhouette, sur les identifiants seuls :
  // quelques secondes, avant toute cuisson. La silhouette y est sans contour :
  // on lui ajoute l'anneau de la cuisson, trois pixels de chaque côté.
  const apercu: Record<string, Record<string, number>> = {};
  const anneau = CHARTE.contour.epaisseurEchelle4 / 4;
  for (const v of rapportBlender.ids.vues) {
    const ids = await lireIds(blender, v.images[0]!.fichier, rapportBlender.ids.canevas);
    apercu[v.vue] = partsTeintes(ids, CHARTE).parts;
    const e = empriseIds(ids);
    if (e && v.vue === s.vuePrincipale) {
      console.log(`  silhouette ${s.vuePrincipale} (identifiants + contour) : ${((e.largeur + 2 * anneau) / PIXELS_PAR_CASE).toFixed(3)} case de large, `
        + `${((e.hauteur + 2 * anneau) / PIXELS_PAR_CASE).toFixed(3)} de haut, ${((e.dessus + anneau) / PIXELS_PAR_CASE).toFixed(3)} au-dessus du pivot, `
        + `débord ${((Math.max(e.gauche, e.droite) + anneau) / PIXELS_PAR_CASE).toFixed(3)}`);
    }
  }
  const sombresApercu = CHARTE.teintes.filter((t) => t.sombre).map((t) => t.nom);
  for (const [vue, parts] of Object.entries(apercu)) {
    const sombre = sombresApercu.reduce((t, n) => t + (parts[n] ?? 0), 0);
    const detail = Object.entries(parts).sort((a, b) => b[1] - a[1]).map(([n, p]) => `${n} ${(p * 100).toFixed(1)}`).join(', ');
    console.log(`  palette ${vue.padEnd(6)} (identifiants) : équipe ${((parts['equipe'] ?? 0) * 100).toFixed(1)} %, sombre ${(sombre * 100).toFixed(1)} % — ${detail}`);
  }
  if (rapportBlender.coinMat) {
    const c = rapportBlender.coinMat;
    console.log(`  coin du mât : ${c.libre ? 'libre' : `OCCUPÉ jusqu’à ${c.hauteur} m (${c.noeuds.join(', ')})`}`);
  }
  rapport.apercuPalette = apercu;
  return { blender, rapportBlender, lot, fichiers, glb, document, fiche, cheminFiche, verdict, rapport, echecs };
}

/** La cuisson d'essai d'une entrée : la vraie chaîne, dans ses propres brouillons, pages de couverture comprises. */
async function cuireEssai(s: Sujet, f: Fabrication, o: Options, entree: Record<string, unknown>): Promise<string> {
  console.log('[5/6] cuisson d’essai');
  writeFileSync(join(f.lot, 'liste.json'), `${JSON.stringify({ version: 1, entrees: [{ id: s.id, ...entree, fichier: `${s.id}_lod0.glb` }] }, null, 1)}\n`);
  const sprites = join(s.dossier, 'sprites');
  await lancer(process.execPath, ['--import', 'tsx', join('scripts', 'sprites', 'cuire.ts'), '--liste', join(f.lot, 'liste.json'), '--sortie', sprites,
    '--temporaire', join(s.dossier, 'cuisson'), '--couverture', ...(o.echantillons ? ['--echantillons', String(o.echantillons)] : [])], '');
  return sprites;
}

/** Le tableau des règles, à la console. */
function imprimerRegles(liste: readonly Regle[]): void {
  console.log('');
  const largeurLibelle = Math.max(...liste.map((r) => r.id.length));
  for (const r of liste) {
    const marque = r.verdict === 'ok' ? 'ok   ' : r.verdict === 'echec' ? 'ÉCHEC' : 'info ';
    console.log(`  ${marque} ${r.id.padEnd(largeurLibelle)}  ${String(r.valeur).padEnd(12)}  attendu ${r.attendu}`);
  }
}

/** Le bilan d'une entrée : le rapport écrit, et une ligne. */
function conclure(dossier: string, rapport: Record<string, unknown>, echecs: number, cuisson: boolean, debut: number): void {
  rapport.secondes = Math.round((Date.now() - debut) / 100) / 10;
  writeFileSync(join(dossier, 'rapport.json'), `${JSON.stringify(rapport, null, 1)}\n`);
  // Sans cuisson, aucune règle de la charte n'est jugée : « tout passe »
  // aurait fait croire qu'une palette hors charte y tenait (l'agent du
  // furtif y a vu 38,7 % de graphite, 24 septembre 2026).
  const bilan = echecs > 0 ? `${echecs} échec(s)`
    : cuisson ? 'tout passe'
    : 'contrôle accepté ; la charte ne se juge qu’à la cuisson — l’aperçu de la palette n’est pas un verdict';
  console.log(`  rapport : ${join(dossier, 'rapport.json')} — ${bilan} (${rapport.secondes} s)`);
}

// ---------------------------------------------------------------------------
// Une unité
// ---------------------------------------------------------------------------

async function fabriquerUnite(o: Options): Promise<number> {
  const debut = Date.now();
  const id = `unite_${o.cle}_base`;
  const dossier = o.sortie ?? join('tmp', 'figurines', o.cle);
  const moduleUnite = o.module ?? join('scripts', 'production', 'figurines', 'unites', `${o.cle}.py`);
  const cheminOfficielle = join('assets', 'specs', `${id}.json`);
  if (!existsSync(moduleUnite)) throw new Error(`module absent : ${moduleUnite} (c'est le seul fichier qu'un agent d'unité écrit)`);
  const officielle = lireSpec(cheminOfficielle);
  const unites = (JSON.parse(readFileSync('content/unites.json', 'utf8')) as { unites: { cle: string; nom: string; domaine: string; silhouette: { base: string; taille: number } }[] }).unites;
  const unite = unites.find((u) => u.cle === o.cle);
  if (!unite) throw new Error(`unité inconnue du canon : ${o.cle}`);
  mkdirSync(dossier, { recursive: true });
  const s: Sujet = {
    id, cle: o.cle, famille: 'unite', etat: 'base', variante: 'base', module: moduleUnite, dossier, officielle, cheminOfficielle, derivee: null, unite,
    vuesIds: [['droite', 'repos'], ['bas', 'deplacement'], ['haut', 'deplacement']], vuePrincipale: 'droite',
  };
  const f = await construireEtControler(s, o);
  const { rapportBlender, rapport, document } = f;
  let echecs = f.echecs;

  if (o.cuisson) {
    // 5. La cuisson d'essai.
    const sprites = await cuireEssai(s, f, o, { famille: 'unite', cle: o.cle });

    // 6. Mesures et planches.
    console.log('[6/6] mesures et planches');
    const cuisson = await lireCuisson(sprites, id);
    const premier = (vue: VueSprite, clips: string[]): Cadre => {
      for (const c of clips) {
        const cadres = cuisson.cadres(vue, c);
        if (cadres.length) return cadres[0]!;
      }
      throw new Error(`aucune image cuite en vue ${vue}`);
    };
    const droite = premier('droite', ['repos', 'deplacement']);
    const bas = premier('bas', ['deplacement', 'repos']);
    const haut = premier('haut', ['deplacement', 'repos']);
    const profil = cuisson.cadres('profil', 'repos')[0] ?? null;
    const carte = cuisson.entree.animations.filter((a) => a.vue !== 'profil').flatMap((a) => cuisson.cadres(a.vue, a.clip));
    const empriseDroite = emprise(droite)!;
    const emprises = carte.map((c) => emprise(c)).filter((e): e is NonNullable<typeof e> => e !== null);
    const idsDroite = rapportBlender.ids.vues.find((v) => v.vue === 'droite')!;
    const imagesIds = await Promise.all(idsDroite.images.map((i) => lireIds(f.blender, i.fichier, rapportBlender.ids.canevas)));
    // Ce que balaient les pièces tournantes : le masque dense de `fabriquer.py` s'il existe.
    const tournants = pixelsTournants(rapportBlender.ids.tournants
      ? [await lireIds(f.blender, rapportBlender.ids.tournants, rapportBlender.ids.canevas)]
      : imagesIds);
    const reposCadres = cuisson.cadres('droite', 'repos');
    const palette = imagesIds.length ? partsTeintes(imagesIds[0]!, CHARTE) : null;
    const sombres = CHARTE.teintes.filter((t) => t.sombre).map((t) => t.nom);
    // Sans les pièces tournantes : un rotor n'assoit pas l'unité.
    const sombreEnBas = palette ? masseSombreEnBas(palette, sombres) : false;
    const materiaux = ((document['materials'] ?? []) as { name?: string }[]).map((m) => m.name ?? '');
    const genre = (rapportBlender.declarations?.genre as Mesures['genre'] | undefined) ?? genreDe(unite);
    const visee = rapportBlender.declarations?.largeurVisee;
    const mesures: Mesures = {
      cle: o.cle, genre, classe: classeDe(unite.silhouette.taille), gris: o.cle.startsWith('meridien_'),
      ...(visee ? { largeurVisee: { min: visee[0], max: visee[1] } } : {}),
      equipe: { droite: partEquipe(droite).part, bas: partEquipe(bas).part, haut: partEquipe(haut).part, profil: profil ? partEquipe(profil).part : null },
      equipeEclairee: partEquipeEclairee(droite, CHARTE.equipe.eclairee.lumiereMin),
      equipeConnexe: equipeConnexe(droite, CHARTE.equipe.pixelsParCaseConnexe / PIXELS_PAR_CASE),
      largeurDroite: empriseDroite.largeur / PIXELS_PAR_CASE,
      hauteurDroite: empriseDroite.hauteur / PIXELS_PAR_CASE,
      debordLateral: Math.max(...emprises.map((e) => Math.max(e.gauche, e.droite))) / PIXELS_PAR_CASE,
      hauteurAuDessusPivot: Math.max(...emprises.map((e) => e.dessus)) / PIXELS_PAR_CASE,
      agitation: agitation(reposCadres, rvb01(CHARTE.planche.camps[0]!.hex), rvb01(CHARTE.planche.herbe), CHARTE.repos.seuilNiveaux, true,
        tournants.size ? (dx, dy) => tournants.has(`${dx},${dy}`) : undefined),
      clarteHorsEquipe: clarteHorsEquipe(droite),
      palette: palette ? { parts: palette.parts, sombreEnBas } : null,
      equipeIds: palette ? palette.parts['equipe'] ?? 0 : null,
      triangles: rapportBlender.triangles,
      materiaux: { trouves: materiaux, attendus: f.fiche.format.materiauxAttendus, max: f.fiche.budget.materiauxMax },
      teintes: rapportBlender.teintes,
      piecesFines: rapportBlender.pieces.map((p) => ({ nom: p.nom, epaisseur: p.epaisseurMin, fin: p.fin })),
      rotationRepos: rapportBlender.rotationRepos,
      // Ce qui a le droit de bouger au repos : les tournants et les mobiles.
      tournants: rapportBlender.noeuds.filter((n) => n.tournant || n.mobile).map((n) => n.nom),
      basAuRepos: rapportBlender.emprise.min[1]!,
      controle: { ok: f.verdict.ok, motifs: f.verdict.motifs.length },
      recouvrement: await recouvrementInstallees(o.cle, unite.domaine, droite, bas, unites),
      // Une cuisson qui a perdu des faces (un état de Cycles gardé d'une image à l'autre) échoue ici, avant la planche.
      anomaliesCuisson: (await anomaliesEntree(sprites, 'unite', id)).map(decrireAnomalie),
    };
    const liste: Regle[] = regles(mesures, CHARTE);
    echecs += liste.filter((r) => r.verdict === 'echec').length;
    rapport.mesures = mesures;
    rapport.regles = liste;
    rapport.cuisson = { images: cuisson.meta.images, secondes: cuisson.meta.secondes, avertissements: cuisson.meta.avertissements, canevas: cuisson.meta.canevas };
    const sujet = { id, nom: unite.nom, classe: mesures.classe, taille: unite.silhouette.taille, vol: unite.domaine === 'air', cuisson, charte: CHARTE };
    await ecrirePlanche(sujet, join(dossier, 'planche.png'));
    await ecrirePlancheClips(sujet, join(dossier, 'planche-clips.png'));
    imprimerRegles(liste);
    console.log(`\n  planches : ${join(dossier, 'planche.png')}, ${join(dossier, 'planche-clips.png')}`);
  }
  conclure(dossier, rapport, echecs, o.cuisson, debut);
  return echecs;
}

// ---------------------------------------------------------------------------
// Un bâtiment (ou le pont) : une entrée par état et par variante, une planche
// ---------------------------------------------------------------------------

/** La fiche officielle d'une entrée : celle du catalogue, ou dérivée de son type de base (écrite dans son dossier). */
function ficheOfficielleBatiment(e: EntreeBatiment, dossier: string): { spec: AssetSpec; chemin: string; derivee: string | null } {
  for (const id of fichesCandidates(e)) {
    const chemin = join('assets', 'specs', `${id}.json`);
    if (!existsSync(chemin)) continue;
    const spec = lireSpec(chemin);
    if (id === e.id) return { spec, chemin, derivee: null };
    const derivee = ficheDerivee(spec, e.id);
    const r = validerAssetSpec(derivee);
    if (!r.ok) throw new Error(`fiche dérivée invalide : ${e.id}\n${r.erreurs.map((x) => `  · ${x.chemin} : ${x.message}`).join('\n')}`);
    const ecrite = join(dossier, 'fiche-officielle.json');
    writeFileSync(ecrite, `${JSON.stringify(derivee, null, 2)}\n`);
    return { spec: derivee, chemin: ecrite, derivee: id };
  }
  throw new Error(`${e.id} : aucune fiche, ni la sienne ni celle de son type de base (${fichesCandidates(e).join(', ')})`);
}

/** Une entrée d'un bâtiment, fabriquée, cuite et mesurée ; rend ses échecs et, cuite, ce que la planche en montre. */
async function fabriquerEntree(e: EntreeBatiment, racine: string, o: Options, installes: readonly BatimentInstalle[]): Promise<{ echecs: number; planche: EtatPlanche | null }> {
  const debut = Date.now();
  const dossier = join(racine, e.id);
  mkdirSync(dossier, { recursive: true });
  console.log(`\n=== ${e.id} (état ${e.etat}, variante ${e.variante}) ===`);
  const { spec, chemin, derivee } = ficheOfficielleBatiment(e, dossier);
  const moduleBatiment = o.module ?? join('scripts', 'production', 'figurines', 'batiments', `${e.cle}.py`);
  const s: Sujet = {
    id: e.id, cle: e.cle, famille: e.famille, etat: e.etat, variante: e.variante, module: moduleBatiment, dossier, officielle: spec, cheminOfficielle: chemin, derivee,
    unite: null, vuesIds: e.vues.map((v) => [v, 'repos'] as [VueSprite, string]), vuePrincipale: 'fixe',
  };
  const f = await construireEtControler(s, o);
  const { rapportBlender, rapport, document } = f;
  let echecs = f.echecs;
  let planche: EtatPlanche | null = null;

  if (o.cuisson) {
    const famille = e.famille === 'terrain' ? 'terrain' : 'batiment';
    const sprites = await cuireEssai(s, f, o, {
      famille, cle: e.cle, ...(e.etat !== 'base' ? { variante: e.etat } : e.variante !== 'base' ? { variante: e.variante } : {}),
      ...(e.famille === 'terrain' ? { vues: e.vues } : {}),
    });
    console.log('[6/6] mesures');
    const cuisson = await lireCuisson(sprites, e.id, famille);
    const fixe = premierCadre(cuisson, 'fixe', ['repos']);
    if (!fixe) throw new Error(`${e.id} : aucune image cuite en vue fixe`);
    const anneau = CHARTE.contour.epaisseurEchelle4 / 4;
    const carte = cuisson.entree.animations.filter((a) => a.vue === 'fixe').flatMap((a) => cuisson.cadres(a.vue, a.clip));
    const emprises = carte.map((c) => empriseModele(c, anneau)).filter((x): x is NonNullable<typeof x> => x !== null);
    const empriseFixe = empriseModele(fixe, anneau)!;
    const idsFixe = rapportBlender.ids.vues.find((v) => v.vue === 'fixe');
    const imagesIds = idsFixe ? await Promise.all(idsFixe.images.map((i) => lireIds(f.blender, i.fichier, rapportBlender.ids.canevas))) : [];
    const mobilesIds = pixelsTournants(rapportBlender.ids.tournants ? [await lireIds(f.blender, rapportBlender.ids.tournants, rapportBlender.ids.canevas)] : imagesIds);
    const palette = imagesIds.length ? partsTeintes(imagesIds[0]!, CHARTE) : null;
    const materiaux = ((document['materials'] ?? []) as { name?: string }[]).map((m) => m.name ?? '');
    const B = CHARTE.batiments;
    const mesures: MesuresBatiment = {
      id: e.id, cle: e.cle, etat: e.etat, variante: e.variante, genre: e.famille === 'terrain' ? 'pont' : 'batiment', superusine: e.cle === B.orange.seulementPour,
      equipe: partEquipe(fixe).part,
      equipeEclairee: partEquipeEclairee(fixe, B.eclairee.lumiereMin),
      equipeConnexe: equipeConnexe(fixe, CHARTE.equipe.pixelsParCaseConnexe / PIXELS_PAR_CASE),
      equipeIds: palette ? palette.parts['equipe'] ?? 0 : null,
      debordLateral: Math.max(...emprises.map((x) => Math.max(x.gauche, x.droite))) / PIXELS_PAR_CASE,
      hauteurAuDessusPivot: Math.max(...emprises.map((x) => x.dessus)) / PIXELS_PAR_CASE,
      largeur: empriseFixe.largeur / PIXELS_PAR_CASE,
      emprise: {
        x: Math.max(Math.abs(rapportBlender.emprise.min[0]!), Math.abs(rapportBlender.emprise.max[0]!)),
        z: Math.max(Math.abs(rapportBlender.emprise.min[2]!), Math.abs(rapportBlender.emprise.max[2]!)),
      },
      hauteurModele: rapportBlender.emprise.max[1]!,
      basAuRepos: rapportBlender.emprise.min[1]!,
      coinMat: rapportBlender.coinMat ?? null,
      emission: { allumee: partEmission(fixe, B.emission.seuilAllume), residuelle: partEmission(fixe, B.emission.seuilEteint) },
      palette: palette ? palette.parts : null,
      teintes: rapportBlender.teintes,
      triangles: rapportBlender.triangles,
      materiaux: { trouves: materiaux, attendus: f.fiche.format.materiauxAttendus, max: f.fiche.budget.materiauxMax },
      piecesFines: rapportBlender.pieces.map((p) => ({ nom: p.nom, epaisseur: p.epaisseurMin, fin: p.fin })),
      repos: ecartsRepos(rapportBlender.clips, rapportBlender.noeuds),
      mobiles: rapportBlender.noeuds.filter((n) => n.tournant || n.mobile).map((n) => n.nom),
      agitation: agitation(cuisson.cadres('fixe', 'repos'), rvb01(CHARTE.planche.camps[0]!.hex), rvb01(CHARTE.planche.herbe), CHARTE.repos.seuilNiveaux, true,
        mobilesIds.size ? (dx, dy) => mobilesIds.has(`${dx},${dy}`) : undefined),
      clarteHorsEquipe: clarteHorsEquipe(fixe),
      controle: { ok: f.verdict.ok, motifs: f.verdict.motifs.length },
      ...(e.famille === 'batiment' ? { hauteurQg: verdictHauteurQg(e.cle, rapportBlender.emprise.max[1]!, installes), recouvrement: await recouvrementBatiments(e.cle, fixe) } : {}),
      anomaliesCuisson: (await anomaliesEntree(sprites, famille, e.id)).map(decrireAnomalie),
    };
    const liste = reglesBatiment(mesures, CHARTE);
    echecs += liste.filter((r) => r.verdict === 'echec').length;
    rapport.mesures = mesures;
    rapport.regles = liste;
    rapport.cuisson = { images: cuisson.meta.images, secondes: cuisson.meta.secondes, avertissements: cuisson.meta.avertissements, canevas: cuisson.meta.canevas };
    planche = { id: e.id, etat: e.etat, variante: e.variante, cuisson, regles: liste };
    await ecrirePlancheClipsBatiment({ id: e.id, cuisson, charte: CHARTE }, join(dossier, 'planche-clips.png'));
    imprimerRegles(liste);
  }
  conclure(dossier, rapport, echecs, o.cuisson, debut);
  return { echecs, planche };
}

async function fabriquerBatiment(o: Options): Promise<number> {
  const cle = o.batiment!;
  const moduleBatiment = o.module ?? join('scripts', 'production', 'figurines', 'batiments', `${cle}.py`);
  if (!existsSync(moduleBatiment)) throw new Error(`module absent : ${moduleBatiment} (c'est le fichier qu'un agent de bâtiment écrit)`);
  const racine = o.sortie ?? dossierBatiment(cle);
  mkdirSync(racine, { recursive: true });
  const entrees = entreesBatiment(cle, declarationsModule(readFileSync(moduleBatiment, 'utf8')), { etat: o.etat, variante: o.variante });
  console.log(`${cle} : ${entrees.map((e) => e.id).join(', ')}${TERRAINS_FIGURINES[cle] ? ' (un terrain)' : ''}`);
  const installes = batimentsFigurinesInstalles();
  let echecs = 0;
  for (const e of entrees) echecs += (await fabriquerEntree(e, racine, o, installes)).echecs;

  if (o.cuisson) {
    // La planche du bâtiment entier : chaque entrée cuite qu'on trouve dans son
    // dossier, celles de cette commande comme celles d'une commande d'avant
    // (`--etat desaffecte` seul garde la base cuite la fois précédente).
    const etats: EtatPlanche[] = [];
    for (const nom of readdirSync(racine).sort()) {
      const r = join(racine, nom, 'rapport.json');
      const sprites = join(racine, nom, 'sprites');
      if (!existsSync(r) || !existsSync(sprites)) continue;
      const rapport = JSON.parse(readFileSync(r, 'utf8')) as { id?: string; etat?: string; variante?: string; famille?: string; regles?: Regle[] };
      if (!rapport.id || !rapport.regles) continue;
      try {
        const cuisson = await lireCuisson(sprites, rapport.id, rapport.famille === 'terrain' ? 'terrain' : 'batiment');
        etats.push({ id: rapport.id, etat: rapport.etat ?? 'base', variante: rapport.variante ?? 'base', cuisson, regles: rapport.regles });
      } catch (erreur) {
        console.warn(`  planche : ${nom} illisible, sauté (${erreur instanceof Error ? erreur.message : String(erreur)})`);
      }
    }
    const chemin = join(racine, 'planche.png');
    await ecrirePlancheBatiment({ cle, etats, charte: CHARTE }, chemin);
    console.log(`\n  planche : ${chemin}${entrees.length > 1 ? '' : ` ; planche des clips : ${join(racine, entrees[0]!.id, 'planche-clips.png')}`}`);
  }
  console.log(`\n${cle} : ${echecs === 0 ? 'tout passe' : `${echecs} échec(s)`}`);
  return echecs;
}

async function main(): Promise<void> {
  const o = lireOptions(process.argv.slice(2));
  const echecs = o.batiment !== null ? await fabriquerBatiment(o) : await fabriquerUnite(o);
  process.exitCode = echecs === 0 ? 0 : 1;
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 2;
});
