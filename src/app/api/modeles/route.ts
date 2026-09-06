/**
 * `GET /api/modeles` — l'inventaire des modèles 3D livrés dans
 * `public/assets/modeles/` (`doc/10-rendu-3d.md` §7.1).
 *
 * Le rendu le lit une fois par page et ne demande ensuite que les fichiers qui
 * existent, au lieu de sonder chaque candidat en 404. Dynamique et sans cache :
 * en développement, un `.glb` déposé est vu au prochain chargement de page,
 * sans redémarrage — le remplacement d'un placeholder reste un changement de
 * fichier. Le dossier n'existe pas tant que rien n'est livré : l'inventaire
 * est alors vide, ce qui est une réponse, pas une erreur.
 */

import path from 'node:path';

import { lireInventaireModeles } from '@/serveur/modeles';
import { json } from '@/serveur/reponses';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Le dossier des modèles livrés, résolu depuis la racine du dépôt : celui que Next sert sous `/assets/modeles`. */
function dossierModeles(): string {
  return path.resolve(process.cwd(), 'public', 'assets', 'modeles');
}

export function GET(): Response {
  return json(lireInventaireModeles(dossierModeles()));
}
