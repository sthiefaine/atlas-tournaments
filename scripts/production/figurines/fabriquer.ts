/**
 * La fabrication d'une figurine, de bout en bout, en une commande :
 *
 *   npm run fabriquer:figurine -- --cle char_leger
 *
 * 1. Blender (`fabriquer.py`) construit `unites/<cle>.py` avec la
 *    bibliothèque, exporte le GLB brut et rend les images d'identifiants ;
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
 * (essayer une variante sans toucher `unites/<cle>.py`) et `--sortie <dossier>`
 * (ailleurs que `tmp/figurines/<cle>/`, pour ne pas écraser l'essai d'un autre).
 *
 * Sorties dans `tmp/figurines/<cle>/` : `lot/`, `fiche.json`, `sprites/`,
 * `planche.png`, `planche-clips.png`, `rapport.json`. Code de sortie : 0 si
 * le contrôle passe et qu'aucune règle n'échoue, 1 sinon, 2 si la fabrication
 * elle-même a échoué.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { validerAssetSpec, type AssetSpec } from '../../../src/assets/index';
import { PIXELS_PAR_CASE, type VueSprite } from '../../../src/render2d/contrat';
import { controlerDepot } from '../../../src/serveur/depot-modeles';
import { decouperGlb } from '../../infanterie/gltf';
import { BLENDER } from '../../sprites/reglages';

import { CHARTE } from './charte';
import { lireCuisson, lireIds } from './lecture';
import { assemblerLot, ficheMesuree, type RapportBlender } from './lot';
import {
  agitation, clarteHorsEquipe, classeDe, emprise, empriseIds, equipeConnexe, genreDe, partEquipe, partEquipeEclairee, partsTeintes, pixelsTournants, regles, rvb01,
  type Cadre, type Mesures, type Regle,
} from './mesures';
import { ecrirePlanche, ecrirePlancheClips } from './planche';

const ICI = __dirname;
const DEPOT = resolve(ICI, '..', '..', '..');

interface Options { cle: string; fiche: string; cuisson: boolean; echantillons: number | null; module: string | null; sortie: string | null }

function lireOptions(argv: readonly string[]): Options {
  const o: Options = { cle: '', fiche: 'mesuree', cuisson: true, echantillons: null, module: null, sortie: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const valeur = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} attend une valeur`);
      return v;
    };
    if (a === '--cle') o.cle = valeur();
    else if (a === '--fiche') o.fiche = valeur();
    else if (a === '--sans-cuisson') o.cuisson = false;
    else if (a === '--echantillons') o.echantillons = Number(valeur());
    else if (a === '--module') o.module = valeur();
    else if (a === '--sortie') o.sortie = valeur();
    else throw new Error(`option inconnue : ${a}`);
  }
  if (!/^[a-z0-9_]+$/.test(o.cle)) throw new Error('usage : npm run fabriquer:figurine -- --cle <cle> [--fiche mesuree|officielle|<chemin>] [--sans-cuisson] [--echantillons <n>]');
  return o;
}

function lireSpec(chemin: string): AssetSpec {
  const r = validerAssetSpec(JSON.parse(readFileSync(chemin, 'utf8')));
  if (!r.ok) throw new Error(`fiche invalide : ${chemin}\n${r.erreurs.map((e) => `  · ${e.chemin} : ${e.message}`).join('\n')}`);
  return r.valeur;
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

async function main(): Promise<void> {
  const o = lireOptions(process.argv.slice(2));
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

  // 1. Blender.
  console.log(`[1/6] Blender : ${moduleUnite}`);
  const blender = join(dossier, 'blender');
  rmSync(blender, { recursive: true, force: true });
  mkdirSync(blender, { recursive: true });
  const travail = join(dossier, 'travail.json');
  writeFileSync(travail, JSON.stringify({
    cle: o.cle, fiche: resolve(cheminOfficielle), charte: resolve(ICI, 'charte.json'), module: resolve(moduleUnite),
    sortie: resolve(blender), unite, ids: true,
  }, null, 1));
  await lancer(BLENDER, ['-b', '--factory-startup', '--python-exit-code', '1', '-P', join(ICI, 'fabriquer.py'), '--', resolve(travail)], '[figurine]');
  const rapportBlender = JSON.parse(readFileSync(join(blender, 'figurine.json'), 'utf8')) as RapportBlender & {
    pieces: { nom: string; epaisseurMin: number; fin: boolean }[]; triangles: number; rotationRepos: Record<string, number>;
    emprise: { min: number[]; max: number[] }; declarations?: { largeurVisee?: [number, number] | null; genre?: string | null };
    ids: { canevas: { x0: number; y0: number }; vues: { vue: string; clip: string; images: { fichier: string }[] }[]; tournants?: string };
    avertissements: string[];
  };

  // 2. Le lot.
  console.log('[2/6] le lot');
  const lot = join(dossier, 'lot');
  rmSync(lot, { recursive: true, force: true });
  mkdirSync(lot, { recursive: true });
  const fichiers = assemblerLot(new Uint8Array(readFileSync(join(blender, 'modele.glb'))), rapportBlender, officielle, CHARTE);
  for (const [nom, octets] of fichiers) writeFileSync(join(lot, nom), octets);
  const glb = fichiers.get(`${id}_lod0.glb`)!;
  const { document } = decouperGlb(glb);
  console.log(`  ${fichiers.size} fichiers, ${Math.round([...fichiers.values()].reduce((s, b) => s + b.length, 0) / 1024)} Ko`);

  // 3. La fiche de contrôle.
  let fiche = officielle;
  let cheminFiche = cheminOfficielle;
  if (o.fiche === 'mesuree') {
    fiche = ficheMesuree(officielle, document, CHARTE.budget.triangles);
    cheminFiche = join(dossier, 'fiche.json');
    writeFileSync(cheminFiche, `${JSON.stringify(fiche, null, 2)}\n`);
    console.log(`[3/6] fiche mesurée : ${cheminFiche} (x ${fiche.echelle.x.cible}, y ${fiche.echelle.y.cible}, z ${fiche.echelle.z.cible} m ; budget ${fiche.budget.lod0})`);
  } else if (o.fiche !== 'officielle') {
    fiche = lireSpec(o.fiche);
    cheminFiche = o.fiche;
    console.log(`[3/6] fiche : ${cheminFiche}`);
  } else console.log(`[3/6] fiche officielle : ${cheminFiche}`);

  // 4. Le contrôle du dépôt.
  const livres = [...fichiers].map(([nom, octets]) => ({ nom, octets }));
  const verdict = controlerDepot(fiche, livres);
  const verdictOfficiel = controlerDepot(officielle, livres);
  console.log(`[4/6] contrôle : ${verdict.ok ? 'ACCEPTÉ' : 'REFUSÉ'}${verdict.motifs.length ? ` — ${verdict.motifs.map((m) => `${m.code} ${m.detail ?? ''}`).join(' ; ')}` : ''}`);
  if (o.fiche === 'mesuree') console.log(`  contre la fiche officielle : ${verdictOfficiel.ok ? 'accepté' : `refusé (${verdictOfficiel.motifs.map((m) => m.detail ?? m.code).join(' ; ')})`}`);

  const rapport: Record<string, unknown> = {
    cle: o.cle, id, date: new Date().toISOString(), fiche: cheminFiche,
    controle: verdict, controleOfficiel: verdictOfficiel, blender: { triangles: rapportBlender.triangles, teintes: rapportBlender.teintes, avertissements: rapportBlender.avertissements },
  };
  let echecs = verdict.ok ? 0 : 1;

  // L'aperçu de la palette et de la silhouette, sur les identifiants seuls :
  // quelques secondes, avant toute cuisson. La silhouette y est sans contour :
  // on lui ajoute l'anneau de la cuisson, trois pixels de chaque côté.
  const apercu: Record<string, Record<string, number>> = {};
  const anneau = CHARTE.contour.epaisseurEchelle4 / 4;
  for (const v of rapportBlender.ids.vues) {
    const ids = await lireIds(blender, v.images[0]!.fichier, rapportBlender.ids.canevas);
    apercu[v.vue] = partsTeintes(ids, CHARTE).parts;
    const e = empriseIds(ids);
    if (e && v.vue === 'droite') {
      console.log(`  silhouette droite (identifiants + contour) : ${((e.largeur + 2 * anneau) / PIXELS_PAR_CASE).toFixed(3)} case de large, `
        + `${((e.hauteur + 2 * anneau) / PIXELS_PAR_CASE).toFixed(3)} de haut, ${((e.dessus + anneau) / PIXELS_PAR_CASE).toFixed(3)} au-dessus du pivot, `
        + `débord ${((Math.max(e.gauche, e.droite) + anneau) / PIXELS_PAR_CASE).toFixed(3)}`);
    }
  }
  const sombresApercu = CHARTE.teintes.filter((t) => t.sombre).map((t) => t.nom);
  for (const [vue, parts] of Object.entries(apercu)) {
    const sombre = sombresApercu.reduce((s, n) => s + (parts[n] ?? 0), 0);
    const detail = Object.entries(parts).sort((a, b) => b[1] - a[1]).map(([n, p]) => `${n} ${(p * 100).toFixed(1)}`).join(', ');
    console.log(`  palette ${vue.padEnd(6)} (identifiants) : équipe ${((parts['equipe'] ?? 0) * 100).toFixed(1)} %, sombre ${(sombre * 100).toFixed(1)} % — ${detail}`);
  }
  rapport.apercuPalette = apercu;

  if (o.cuisson) {
    // 5. La cuisson d'essai.
    console.log('[5/6] cuisson d’essai');
    writeFileSync(join(lot, 'liste.json'), `${JSON.stringify({ version: 1, entrees: [{ id, famille: 'unite', cle: o.cle, fichier: `${id}_lod0.glb` }] }, null, 1)}\n`);
    const sprites = join(dossier, 'sprites');
    await lancer(process.execPath, ['--import', 'tsx', join('scripts', 'sprites', 'cuire.ts'), '--liste', join(lot, 'liste.json'), '--sortie', sprites,
      '--temporaire', join(dossier, 'cuisson'), '--couverture', ...(o.echantillons ? ['--echantillons', String(o.echantillons)] : [])], '');

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
    const imagesIds = await Promise.all(idsDroite.images.map((i) => lireIds(blender, i.fichier, rapportBlender.ids.canevas)));
    // Ce que balaient les pièces tournantes : le masque dense de `fabriquer.py` s'il existe.
    const tournants = pixelsTournants(rapportBlender.ids.tournants
      ? [await lireIds(blender, rapportBlender.ids.tournants, rapportBlender.ids.canevas)]
      : imagesIds);
    const reposCadres = cuisson.cadres('droite', 'repos');
    const palette = imagesIds.length ? partsTeintes(imagesIds[0]!, CHARTE) : null;
    const sombres = CHARTE.teintes.filter((t) => t.sombre).map((t) => t.nom);
    let sombreEnBas = false;
    if (palette) {
      const poids = sombres.reduce((s, n) => s + (palette.parts[n] ?? 0), 0);
      const y = poids ? sombres.reduce((s, n) => s + (palette.parts[n] ?? 0) * (palette.centreY[n] ?? 0), 0) / poids : 0;
      sombreEnBas = poids > 0 && y > palette.centreYTotal;
    }
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
      materiaux: { trouves: materiaux, attendus: fiche.format.materiauxAttendus, max: fiche.budget.materiauxMax },
      teintes: rapportBlender.teintes,
      piecesFines: rapportBlender.pieces.map((p) => ({ nom: p.nom, epaisseur: p.epaisseurMin, fin: p.fin })),
      rotationRepos: rapportBlender.rotationRepos,
      tournants: rapportBlender.noeuds.filter((n) => n.tournant).map((n) => n.nom),
      basAuRepos: rapportBlender.emprise.min[1]!,
      controle: { ok: verdict.ok, motifs: verdict.motifs.length },
    };
    const liste: Regle[] = regles(mesures, CHARTE);
    echecs += liste.filter((r) => r.verdict === 'echec').length;
    rapport.mesures = mesures;
    rapport.regles = liste;
    rapport.cuisson = { images: cuisson.meta.images, secondes: cuisson.meta.secondes, avertissements: cuisson.meta.avertissements, canevas: cuisson.meta.canevas };
    const sujet = { id, nom: unite.nom, classe: mesures.classe, taille: unite.silhouette.taille, vol: unite.domaine === 'air', cuisson, charte: CHARTE };
    await ecrirePlanche(sujet, join(dossier, 'planche.png'));
    await ecrirePlancheClips(sujet, join(dossier, 'planche-clips.png'));
    console.log('');
    const largeurLibelle = Math.max(...liste.map((r) => r.id.length));
    for (const r of liste) {
      const marque = r.verdict === 'ok' ? 'ok   ' : r.verdict === 'echec' ? 'ÉCHEC' : 'info ';
      console.log(`  ${marque} ${r.id.padEnd(largeurLibelle)}  ${String(r.valeur).padEnd(12)}  attendu ${r.attendu}`);
    }
    console.log(`\n  planches : ${join(dossier, 'planche.png')}, ${join(dossier, 'planche-clips.png')}`);
  }
  rapport.secondes = Math.round((Date.now() - debut) / 100) / 10;
  writeFileSync(join(dossier, 'rapport.json'), `${JSON.stringify(rapport, null, 1)}\n`);
  console.log(`  rapport : ${join(dossier, 'rapport.json')} — ${echecs === 0 ? 'tout passe' : `${echecs} échec(s)`} (${rapport.secondes} s)`);
  process.exitCode = echecs === 0 ? 0 : 1;
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 2;
});
