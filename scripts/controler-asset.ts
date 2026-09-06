/**
 * Le contrôle d'un asset livré en ligne de commande : ce que fait la routine
 * `atlas_controle` sur une livraison du générateur externe, sans passer par
 * l'API (`doc/11-assets-spec.md` §7, `doc/16-realisme.md` §3.1).
 *
 * ```
 * npx tsx scripts/controler-asset.ts --spec assets/specs/unite_char_leger_base.json --glb livraison/unite_char_leger_base_lod0.glb
 * npx tsx scripts/controler-asset.ts --spec … --glb … --fichiers livraison/     # les textures livrées à côté
 * npx tsx scripts/controler-asset.ts --spec … --glb … --lod 1                   # sinon déduit du suffixe _lodN
 * npx tsx scripts/controler-asset.ts --spec … --glb … --json                    # le verdict brut
 * ```
 *
 * Le verdict imprimé est **exactement** celui que le serveur rendrait : c'est le
 * même `validerGlb`, et c'est ce qu'on renvoie au générateur, tel quel. Code de
 * sortie 1 si le fichier est refusé ou illisible, 2 si la commande est mal
 * appelée.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  nomModele, validerAssetSpec, validerGlb,
  type AssetSpec, type NiveauLod, type VerdictAsset,
} from '../src/assets/index';

/** Lit les options de la ligne de commande. */
function options(argv: string[]): Record<string, string | boolean> {
  const sortie: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === undefined || !a.startsWith('--')) continue;
    const cle = a.slice(2);
    const suivant = argv[i + 1];
    if (suivant === undefined || suivant.startsWith('--')) sortie[cle] = true;
    else {
      sortie[cle] = suivant;
      i += 1;
    }
  }
  return sortie;
}

/** Le niveau de détail que dit le nom du fichier (`…_lod1.glb`), ou `null`. */
export function lodDuNom(nom: string): NiveauLod | null {
  const m = /_lod([012])\.glb$/i.exec(path.basename(nom));
  return m ? (Number(m[1]) as NiveauLod) : null;
}

/** Ce que rend un contrôle : un code de sortie, un texte à imprimer, le verdict s'il y en a un. */
export interface ResultatControle {
  code: number;
  texte: string;
  verdict: VerdictAsset | null;
}

/** Lit et valide une spécification ; une spécification invalide est une erreur lisible, pas un verdict. */
export function lireSpec(chemin: string): AssetSpec {
  let brut: unknown;
  try {
    brut = JSON.parse(readFileSync(chemin, 'utf8'));
  } catch (e) {
    throw new Error(`spécification illisible : ${chemin} (${e instanceof Error ? e.message : String(e)})`);
  }
  const resultat = validerAssetSpec(brut);
  if (!resultat.ok) {
    throw new Error(`spécification invalide : ${chemin}\n${resultat.erreurs.map((er) => `  · ${er.chemin} : ${er.message}`).join('\n')}`);
  }
  return resultat.valeur;
}

/** Les noms des fichiers d'un dossier de livraison, tels qu'on les passe au validateur. */
export function fichiersLivres(dossier: string): string[] {
  return readdirSync(dossier).filter((f) => statSync(path.join(dossier, f)).isFile());
}

/** Rend le verdict en texte lisible : la ligne de bilan d'un contrôle. */
export function afficherVerdict(spec: AssetSpec, fichier: string, lod: NiveauLod, octets: number, v: VerdictAsset): string {
  const lignes: string[] = [];
  lignes.push(`Asset   : ${spec.id} (${spec.type}, priorité ${spec.priorite})`);
  lignes.push(`Fichier : ${fichier} (lod${lod}, ${octets} octets)`);
  const attendu = nomModele(spec, lod);
  if (path.basename(fichier) !== attendu) {
    // Le validateur ne juge pas le nom du fichier ; le rendu, lui, ne saura
    // charger que le nom du gabarit. On le dit sans en faire un refus.
    lignes.push(`Nom     : attendu ${attendu} — le rendu ne trouvera pas ce fichier sous son nom actuel`);
  }
  lignes.push(`Verdict : ${v.ok ? 'ACCEPTÉ' : 'REFUSÉ'}`);
  if (v.motifs.length === 0) lignes.push('Motifs  : aucun.');
  else {
    lignes.push('Motifs  :');
    for (const m of v.motifs) {
      const mesures = Object.entries(m.mesure ?? {}).map(([k, n]) => `${k}=${n}`).join(' ');
      lignes.push(`  · ${m.code}`);
      if (m.detail) lignes.push(`      ${m.detail}`);
      if (mesures) lignes.push(`      mesure : ${mesures}`);
    }
  }
  return lignes.join('\n');
}

const USAGE = [
  'usage : npx tsx scripts/controler-asset.ts --spec assets/specs/<id>.json --glb <fichier.glb> [--lod 0|1|2] [--fichiers <dossier>] [--json]',
].join('\n');

/**
 * Exécute la commande sans toucher au processus : c'est ce que les tests
 * appellent. Le point d'entrée en bas du fichier imprime et pose le code.
 */
export function executer(argv: string[]): ResultatControle {
  const o = options(argv);
  const cheminSpec = o['spec'];
  const cheminGlb = o['glb'];
  if (typeof cheminSpec !== 'string' || typeof cheminGlb !== 'string') {
    return { code: 2, texte: USAGE, verdict: null };
  }

  let spec: AssetSpec;
  try {
    spec = lireSpec(cheminSpec);
  } catch (e) {
    return { code: 1, texte: e instanceof Error ? e.message : String(e), verdict: null };
  }

  let octets: Uint8Array;
  try {
    octets = new Uint8Array(readFileSync(cheminGlb));
  } catch (e) {
    return { code: 1, texte: `fichier illisible : ${cheminGlb} (${e instanceof Error ? e.message : String(e)})`, verdict: null };
  }

  const lodDemande = typeof o['lod'] === 'string' ? Number(o['lod']) : null;
  const lod: NiveauLod = lodDemande !== null && [0, 1, 2].includes(lodDemande)
    ? (lodDemande as NiveauLod)
    : lodDuNom(cheminGlb) ?? 0;

  let livres: string[] = [];
  if (typeof o['fichiers'] === 'string') {
    try {
      livres = fichiersLivres(o['fichiers']);
    } catch (e) {
      return { code: 1, texte: `dossier de livraison illisible : ${o['fichiers']} (${e instanceof Error ? e.message : String(e)})`, verdict: null };
    }
  }

  const verdict = validerGlb(octets, spec, { lod, fichiersLivres: livres });
  const texte = o['json'] === true
    ? JSON.stringify(verdict, null, 2)
    : afficherVerdict(spec, cheminGlb, lod, octets.byteLength, verdict);
  return { code: verdict.ok ? 0 : 1, texte, verdict };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const resultat = executer(process.argv.slice(2));
  process.stdout.write(`${resultat.texte}\n`);
  process.exitCode = resultat.code;
}
