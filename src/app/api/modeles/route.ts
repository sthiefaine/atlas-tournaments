/**
 * `GET /api/modeles` — l'inventaire des modèles 3D livrés dans
 * `public/assets/modeles/` (`doc/10-rendu-3d.md` §7.1).
 *
 * La peau 3D le lisait une fois par page pour ne demander que les fichiers qui
 * existaient ; elle est retirée depuis le 23 septembre 2026, et le jeu affiche
 * des images cuites depuis ces fichiers. La route reste : c'est sur elle que
 * `scripts/production/verifier-publication.ts` vérifie, après un déploiement,
 * qu'un lot est bien publié. Dynamique et sans cache ; le dossier n'existe pas
 * tant que rien n'est livré, et l'inventaire est alors vide, ce qui est une
 * réponse, pas une erreur.
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
