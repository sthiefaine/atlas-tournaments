/**
 * Les sources du décor photographié (`scripts/decor-sprites/`,
 * `doc/refonte/sprites-decor.md`) : ce que la cuisson recevra.
 *
 * Le test tient **sa propre** table de la commande — essences, saisons, nombre
 * de variantes, gabarits — au lieu de relire celle du générateur : c'est la
 * commande du 23 septembre 2026 qu'on vérifie, pas le générateur contre
 * lui-même. Chaque GLB est ouvert octet par octet (`scripts/decor-sprites/glb.ts`,
 * sans dépendance), chaque sommet passé par la chaîne de ses nœuds.
 */

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { lireGlb as lireGlbProjet, mesurerGltf } from '../../src/assets/valider-gltf';
import { ESSENCES_DECOR, idDecor, type EssenceDecor, type SaisonDecor } from '../../src/render2d/contrat';
import { lireAccesseur, lireGlb, mesurerGlb, silhouette, type MesureGlb } from '../../scripts/decor-sprites/glb';

const DOSSIER = path.resolve(import.meta.dirname, '..', '..', 'assets', 'sources-sprites', 'decor');

const QUATRE: readonly SaisonDecor[] = ['printemps', 'ete', 'automne', 'hiver'];

/** La commande : quelles saisons pour quelle essence. */
const SAISONS_ATTENDUES: Readonly<Record<EssenceDecor, readonly SaisonDecor[]>> = {
  feuillu: QUATRE,
  conifere: QUATRE,
  palmier: ['toutes'],
  tropical: ['toutes'],
  buisson: QUATRE,
  touffe: QUATRE,
  roseau: ['toutes', 'hiver'],
  montagne: ['toutes', 'hiver'],
  montagne_aride: ['toutes'],
  montagne_volcan: ['toutes'],
};

const ARBRES: readonly EssenceDecor[] = ['feuillu', 'conifere', 'palmier', 'tropical'];

/** Au moins trois variantes par saison pour un arbre, deux pour le reste. */
function variantesMin(essence: EssenceDecor): number {
  return ARBRES.includes(essence) ? 3 : 2;
}

type Borne = readonly [number, number];
interface Gabarit { largeur?: Borne; emprise?: Borne; hauteur: Borne }

/**
 * Les gabarits, une case valant un mètre. `largeur` borne la plus grande des
 * deux emprises au sol ; `emprise` (montagne) borne chacune des deux.
 */
function gabarit(essence: EssenceDecor): Gabarit {
  if (ARBRES.includes(essence)) return { largeur: [0.25, 0.45], hauteur: [0.5, 0.9] };
  switch (essence) {
    case 'buisson': return { largeur: [0.18, 0.3], hauteur: [0.18, 0.3] };
    case 'touffe': return { largeur: [0.12, 0.25], hauteur: [0.12, 0.25] };
    case 'roseau': return { largeur: [0.15, 0.3], hauteur: [0.15, 0.3] };
    default: return { emprise: [0.9, 1.0], hauteur: [0.5, 0.9] };
  }
}

const CLES_ENTREE = ['cle', 'famille', 'fichier', 'id', 'ombre', 'variante', 'vues'];
const MATERIAUX_CONNUS = new Set([
  'mat_ecorce', 'mat_feuillage', 'mat_fleurs', 'mat_fruits', 'mat_herbe', 'mat_neige', 'mat_roche', 'mat_coulee',
]);
const TRIANGLES_MAX = 3000;
const PIED = 0.005;
const CENTRE = 0.04;

interface Entree {
  id: string; famille: string; cle: string; variante: string; fichier: string; vues: string[]; ombre: boolean;
}

const liste = JSON.parse(readFileSync(path.join(DOSSIER, 'liste.json'), 'utf8')) as {
  version: number; entrees: Entree[];
};

/** Le numéro de variante d'un identifiant, ou `null` s'il n'est pas de la forme `idDecor`. */
function numero(e: Entree): number | null {
  const m = /_(\d+)$/.exec(e.id);
  if (!m) return null;
  const n = Number(m[1]);
  return idDecor(e.cle as EssenceDecor, e.variante as SaisonDecor, n) === e.id ? n : null;
}

const mesures = new Map<string, MesureGlb>();
function mesure(e: Entree): MesureGlb {
  const deja = mesures.get(e.id);
  if (deja) return deja;
  const m = mesurerGlb(lireGlb(new Uint8Array(readFileSync(path.join(DOSSIER, e.fichier)))));
  mesures.set(e.id, m);
  return m;
}

test('la liste a le format que la cuisson lit, sans une clé de plus', () => {
  assert.equal(liste.version, 1);
  assert.ok(Array.isArray(liste.entrees) && liste.entrees.length > 0);
  const vus = new Set<string>();
  for (const e of liste.entrees) {
    assert.deepEqual(Object.keys(e).sort(), CLES_ENTREE, e.id);
    assert.equal(e.famille, 'decor', e.id);
    assert.deepEqual(e.vues, ['fixe'], e.id);
    assert.equal(e.ombre, true, e.id);
    assert.ok((ESSENCES_DECOR as readonly string[]).includes(e.cle), `${e.id} : essence ${e.cle} inconnue`);
    assert.ok([...QUATRE, 'toutes'].includes(e.variante as SaisonDecor), `${e.id} : saison ${e.variante}`);
    assert.notEqual(numero(e), null, `${e.id} n'est pas idDecor(${e.cle}, ${e.variante}, n)`);
    assert.ok(numero(e)! >= 1, e.id);
    assert.equal(e.fichier, `${e.id}.glb`, e.id);
    assert.ok(!vus.has(e.id), `${e.id} en double`);
    vus.add(e.id);
  }
});

test('chaque essence a ses saisons, numérotées de 1 sans trou, en nombre suffisant', () => {
  for (const essence of ESSENCES_DECOR) {
    const siennes = liste.entrees.filter((e) => e.cle === essence);
    const saisons = [...new Set(siennes.map((e) => e.variante))].sort();
    assert.deepEqual(saisons, [...SAISONS_ATTENDUES[essence]].sort(), `${essence} : saisons`);
    for (const saison of SAISONS_ATTENDUES[essence]) {
      const numeros = siennes.filter((e) => e.variante === saison).map((e) => numero(e)!).sort((a, b) => a - b);
      assert.ok(numeros.length >= variantesMin(essence),
        `${essence} ${saison} : ${numeros.length} variantes, il en faut ${variantesMin(essence)}`);
      assert.deepEqual(numeros, numeros.map((_, i) => i + 1), `${essence} ${saison} : numérotation`);
    }
    // Même nombre de variantes à chaque saison : la n° 2 d'hiver est la n° 2 d'été.
    const parSaison = SAISONS_ATTENDUES[essence].map((s) => siennes.filter((e) => e.variante === s).length);
    assert.equal(new Set(parSaison).size, 1, `${essence} : ${parSaison.join(', ')} variantes selon la saison`);
  }
});

test('le dossier dit exactement ce que la liste dit', () => {
  const listes = new Set(liste.entrees.map((e) => e.fichier));
  for (const f of listes) assert.ok(existsSync(path.join(DOSSIER, f)), `${f} absent`);
  const presents = readdirSync(DOSSIER).filter((f) => f.endsWith('.glb'));
  assert.deepEqual(presents.filter((f) => !listes.has(f)), [], 'GLB que la liste ne cite pas');
});

test('chaque GLB est un glTF 2.0 sain, que le lecteur du projet accepte', () => {
  for (const e of liste.entrees) {
    const octets = new Uint8Array(readFileSync(path.join(DOSSIER, e.fichier)));
    const projet = lireGlbProjet(octets);
    assert.ok(projet.ok, `${e.id} : refusé par src/assets/valider-gltf.ts`);
    const glb = lireGlb(octets);
    assert.equal(glb.document.asset?.version, '2.0', e.id);
    const m = mesure(e);
    assert.equal(m.autresPrimitives, 0, `${e.id} : primitives autres que des triangles`);
    assert.deepEqual(m.ressourcesExternes, [], `${e.id} : ressource hors du fichier`);
    assert.equal(glb.document.animations?.length ?? 0, 0, `${e.id} : un décor ne s'anime pas`);
    assert.equal(glb.document.skins?.length ?? 0, 0, e.id);
    for (const nom of m.materiaux) assert.ok(MATERIAUX_CONNUS.has(nom), `${e.id} : matériau ${nom}`);
    assert.ok(m.noeuds.includes('racine'), `${e.id} : pas de nœud racine`);
    // Même compte que le contrôleur du projet, qui lit les accesseurs déclarés.
    assert.equal(mesurerGltf(projet.ok ? projet.document : {}).triangles, m.triangles, `${e.id} : comptes`);
  }
});

test(`chaque modèle tient dans ${TRIANGLES_MAX} triangles, sans échelle négative`, () => {
  for (const e of liste.entrees) {
    const m = mesure(e);
    assert.ok(m.triangles > 0 && m.triangles <= TRIANGLES_MAX, `${e.id} : ${m.triangles} triangles`);
    assert.equal(m.echelleNegative, false, `${e.id} : échelle négative`);
  }
});

test('chaque modèle tient dans son gabarit, pied au sol et emprise centrée', () => {
  for (const e of liste.entrees) {
    const m = mesure(e);
    const g = gabarit(e.cle as EssenceDecor);
    const dx = m.max[0] - m.min[0];
    const dy = m.max[1] - m.min[1];
    const dz = m.max[2] - m.min[2];
    const dans = (v: number, b: Borne): boolean => v >= b[0] && v <= b[1];
    if (g.emprise) {
      assert.ok(dans(dx, g.emprise) && dans(dz, g.emprise),
        `${e.id} : emprise ${dx.toFixed(3)} × ${dz.toFixed(3)} hors de ${g.emprise.join('–')}`);
    } else {
      assert.ok(dans(Math.max(dx, dz), g.largeur!), `${e.id} : largeur ${Math.max(dx, dz).toFixed(3)}`);
    }
    assert.ok(dans(dy, g.hauteur), `${e.id} : hauteur ${dy.toFixed(3)} hors de ${g.hauteur.join('–')}`);
    assert.ok(Math.abs(m.min[1]) <= PIED, `${e.id} : pied à y = ${m.min[1].toFixed(4)}`);
    const cx = (m.min[0] + m.max[0]) / 2;
    const cz = (m.min[2] + m.max[2]) / 2;
    assert.ok(Math.abs(cx) <= CENTRE && Math.abs(cz) <= CENTRE,
      `${e.id} : emprise centrée en (${cx.toFixed(3)}, ${cz.toFixed(3)})`);
  }
});

test('une variante garde sa place et sa taille d’une saison à l’autre', () => {
  // La n° 2 d'hiver est la n° 2 d'été qui a perdu ses feuilles : si elle
  // changeait de place ou de taille, un changement de saison la ferait sauter.
  const groupes = new Map<string, Entree[]>();
  for (const e of liste.entrees) {
    const cle = `${e.cle}_${numero(e)}`;
    groupes.set(cle, [...(groupes.get(cle) ?? []), e]);
  }
  for (const [cle, entrees] of groupes) {
    if (entrees.length < 2) continue;
    const ms = entrees.map(mesure);
    const hauteurs = ms.map((m) => m.max[1] - m.min[1]);
    const centres = ms.map((m) => [(m.min[0] + m.max[0]) / 2, (m.min[2] + m.max[2]) / 2] as const);
    assert.ok(Math.max(...hauteurs) / Math.min(...hauteurs) <= 1.2, `${cle} : hauteurs ${hauteurs.join(', ')}`);
    for (const c of centres) {
      assert.ok(Math.hypot(c[0] - centres[0]![0], c[1] - centres[0]![1]) <= 0.06, `${cle} : le centre bouge`);
    }
  }
});

test('chaque maille porte ses normales et ses couleurs de sommet, et la couleur varie', () => {
  // Une source sans couleur sortirait blanche de la cuisson, sans un mot.
  for (const e of liste.entrees) {
    const glb = lireGlb(new Uint8Array(readFileSync(path.join(DOSSIER, e.fichier))));
    const teintes = new Set<string>();
    for (const maille of glb.document.meshes ?? []) {
      for (const p of maille.primitives ?? []) {
        assert.ok(p.attributes?.['NORMAL'] !== undefined, `${e.id} : primitive sans normales`);
        const iCouleur = p.attributes?.['COLOR_0'];
        assert.ok(iCouleur !== undefined, `${e.id} : primitive sans couleur de sommet`);
        const { valeurs, composantes } = lireAccesseur(glb, iCouleur);
        for (let k = 0; k < valeurs.length; k += composantes) {
          for (let c = 0; c < 3; c += 1) assert.ok(valeurs[k + c]! >= 0 && valeurs[k + c]! <= 1, e.id);
          teintes.add(`${valeurs[k]!.toFixed(2)}/${valeurs[k + 1]!.toFixed(2)}/${valeurs[k + 2]!.toFixed(2)}`);
        }
      }
    }
    assert.ok(teintes.size >= 8, `${e.id} : ${teintes.size} teintes seulement`);
  }
});

test('l’hiver se voit : neige là où la commande en met, feuillus nus', () => {
  const avecNeige = new Set(['feuillu', 'conifere', 'buisson', 'roseau', 'montagne']);
  for (const e of liste.entrees) {
    const m = mesure(e);
    const neige = m.materiaux.includes('mat_neige');
    if (e.variante === 'hiver' && avecNeige.has(e.cle)) assert.ok(neige, `${e.id} : l'hiver sans neige`);
    if (e.variante !== 'hiver') assert.ok(!neige, `${e.id} : de la neige hors de l'hiver`);
    if (e.cle === 'feuillu') {
      assert.equal(m.materiaux.includes('mat_feuillage'), e.variante !== 'hiver', `${e.id} : feuillage`);
    }
  }
});

test('aucune silhouette ne se réduit à des traits : un dixième de son cadre au moins', () => {
  for (const e of liste.entrees) {
    const s = silhouette(mesure(e));
    assert.ok(s.couverture >= 0.1, `${e.id} : couverture ${(s.couverture * 100).toFixed(0)} %`);
  }
});

test('arbres et montagnes dominent les herbes : les proportions de figurine tiennent', () => {
  // Ce que la carte pose côte à côte doit garder ses proportions de figurine.
  const hauteurMoyenne = (essences: readonly string[]): number => {
    const hs = liste.entrees.filter((e) => essences.includes(e.cle)).map((e) => {
      const m = mesure(e);
      return m.max[1] - m.min[1];
    });
    return hs.reduce((a, b) => a + b, 0) / hs.length;
  };
  const montagnes = hauteurMoyenne(['montagne', 'montagne_aride', 'montagne_volcan']);
  const arbres = hauteurMoyenne(ARBRES);
  const herbes = hauteurMoyenne(['buisson', 'touffe', 'roseau']);
  assert.ok(montagnes > herbes && arbres > herbes * 2, `${montagnes} / ${arbres} / ${herbes}`);
});
