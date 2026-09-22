/**
 * Relève les gabarits réels des sources du décor, pour `doc/refonte/sprites-decor.md` :
 *
 *     npx tsx scripts/decor-sprites/mesurer.ts [--json]
 *
 * Une ligne par modèle : triangles, largeur, profondeur, hauteur (mètres, une
 * case = un mètre), puis la silhouette de l'image cuite en pixels de plan à
 * 128 pixels par case, et sa couverture. Rien n'est rendu : les sommets du GLB
 * sont projetés par `versPlan`, la caméra de cuisson elle-même.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { lireGlb, mesurerGlb, silhouette } from './glb';

const DOSSIER = path.resolve(import.meta.dirname, '..', '..', 'assets', 'sources-sprites', 'decor');

interface Entree { id: string; cle: string; variante: string; fichier: string }

const liste = JSON.parse(readFileSync(path.join(DOSSIER, 'liste.json'), 'utf8')) as { entrees: Entree[] };
const lignes = liste.entrees.map((e) => {
  const m = mesurerGlb(lireGlb(new Uint8Array(readFileSync(path.join(DOSSIER, e.fichier)))));
  const s = silhouette(m);
  return {
    id: e.id,
    triangles: m.triangles,
    largeur: m.max[0] - m.min[0],
    profondeur: m.max[2] - m.min[2],
    hauteur: m.max[1] - m.min[1],
    imageLargeur: s.largeur,
    imageHauteur: s.hauteur,
    couverture: s.couverture,
  };
});

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(lignes, null, 2));
} else {
  console.log('| modèle | triangles | l × p × h (m) | image (px de plan) | couverture |');
  console.log('|---|---:|---|---|---:|');
  for (const l of lignes) {
    console.log(`| \`${l.id}\` | ${l.triangles} | ${l.largeur.toFixed(2)} × ${l.profondeur.toFixed(2)} × ${l.hauteur.toFixed(2)}`
      + ` | ${Math.round(l.imageLargeur)} × ${Math.round(l.imageHauteur)} | ${Math.round(l.couverture * 100)} % |`);
  }
}
