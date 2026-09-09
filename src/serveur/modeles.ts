/**
 * L'inventaire des modèles livrés : ce que `public/assets/modeles/` contient,
 * dressé d'après les **noms** de fichiers et servi par `GET /api/modeles`.
 *
 * Pourquoi un inventaire, et pas des sondes : le rendu essaie, pour chaque
 * couple (unité, nation), un kit puis une géométrie de base, en trois niveaux
 * de détail — une quarantaine de requêtes par page, toutes en 404 tant que
 * rien n'est livré, et chaque 404 coûte jusqu'à deux secondes au serveur de
 * développement. Une liste, lue une fois, dit d'avance ce qui existe. La
 * règle du brief ne bouge pas : **le remplacement d'un placeholder reste un
 * changement de fichier** — on dépose le `.glb`, l'inventaire le voit au
 * prochain chargement de page, et pas une ligne de code ne change.
 *
 * La fonction qui dresse l'inventaire est pure et testée ; la lecture du
 * disque est une ligne, et un dossier absent est l'état normal du projet.
 */

import { readdirSync, statSync } from 'node:fs';

import path from 'node:path';

import { decomposerNomModele, type InventaireModeles, type NiveauLod } from '../assets/spec';

export type { InventaireModeles } from '../assets/spec';

/**
 * Dresse l'inventaire d'une liste de noms de fichiers : l'identifiant sans
 * suffixe vers ses niveaux présents, triés. Ce qui n'est pas un `.glb` au
 * gabarit `{id}_lod{lod}.glb` de `nomModele()` est ignoré — un fichier
 * étranger dans le dossier ne doit ni casser ni compter. Les identifiants sont
 * triés pour que deux lectures du même dossier rendent le même JSON.
 */
export function inventaireModeles(noms: readonly string[]): InventaireModeles {
  const niveaux = new Map<string, Set<NiveauLod>>();
  for (const nom of noms) {
    const d = decomposerNomModele(nom);
    if (!d) continue;
    const presents = niveaux.get(d.id) ?? new Set<NiveauLod>();
    presents.add(d.lod);
    niveaux.set(d.id, presents);
  }
  const modeles: Record<string, NiveauLod[]> = {};
  for (const id of [...niveaux.keys()].sort()) {
    modeles[id] = [...niveaux.get(id)!].sort((a, b) => a - b);
  }
  return { modeles };
}

/**
 * Lit un dossier de livraison et en dresse l'inventaire. Un dossier absent —
 * ou illisible — rend l'inventaire vide : tant que le générateur n'a rien
 * livré, `public/assets/modeles/` n'existe pas, et ce n'est pas une erreur.
 */
export function lireInventaireModeles(dossier: string): InventaireModeles {
  let noms: string[];
  try {
    noms = readdirSync(dossier, { withFileTypes: true }).filter((e) => {
      if (e.isFile()) return true;
      if (!e.isSymbolicLink()) return false;
      try { return statSync(path.join(dossier, e.name)).isFile(); } catch { return false; }
    }).map((e) => e.name);
  } catch {
    return { modeles: {} };
  }
  return inventaireModeles(noms);
}
