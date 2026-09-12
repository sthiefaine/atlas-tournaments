/**
 * `POST /api/admin/modeles` — déposer un asset livré.
 *
 * Le flux entier tient en une page : la fiche compose la commande, un
 * générateur rend un `.glb` et ses textures, on les dépose ici, le contrôle du
 * dépôt les relit, et le jeu les prend au prochain chargement — sans une ligne
 * de code (`doc/10-rendu-3d.md` §7.1, l'inventaire de `/api/modeles`).
 *
 * **Le dépôt est local, et c'est dit.** `public/` est cuit dans l'image Docker :
 * un fichier écrit ici sur le site déployé vivrait jusqu'au déploiement suivant,
 * puis disparaîtrait sans bruit. Un asset livré se dépose donc en développement,
 * puis **se commite** — c'est le dépôt git qui le garde, pas ce dossier. La
 * route refuse en production plutôt que de laisser croire le contraire.
 *
 * Rien n'est écrit avant que tout soit contrôlé, et aucun nom reçu du réseau
 * n'atteint le système de fichiers : `serveur/depot-modeles.ts` ne reconnaît que
 * les noms que la fiche impose.
 */

import path from 'node:path';

import { genererSpecs } from '@/assets/index';
import { exigerAdmin } from '@/serveur/auth';
import { controlerDepot, ecrireDepot, type FichierLivre } from '@/serveur/depot-modeles';
import { conserverPrecedente, lireBaseKit } from '@/serveur/reception-assets';
import { LIMITE_FICHIER, LIMITE_LOT } from '@/assets/production';
import { erreur, json } from '@/serveur/reponses';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Le dossier que Next sert sous `/assets/modeles`. */
function dossierModeles(): string {
  return path.resolve(process.cwd(), 'public', 'assets', 'modeles');
}

export async function POST(requete: Request): Promise<Response> {
  const refus = exigerAdmin(requete);
  if (refus) return refus;

  if (process.env.NODE_ENV === 'production') {
    return erreur('depot_local_seulement', 409,
      'public/ est cuit dans l’image : un fichier déposé ici disparaîtrait au prochain déploiement. '
      + 'Déposer en développement, puis commiter le fichier.');
  }

  if (Number(requete.headers.get('content-length')) > LIMITE_LOT + 1024 * 1024) return erreur('lot_trop_lourd', 413, '96 Mio maximum');
  let formulaire: FormData;
  try {
    formulaire = await requete.formData();
  } catch {
    return erreur('formulaire_illisible', 400, 'le corps n’est pas un formulaire multipart');
  }

  const id = String(formulaire.get('id') ?? '');
  const spec = genererSpecs().find((s) => s.id === id);
  if (!spec) return erreur('asset_inconnu', 404, `aucune fiche pour « ${id} »`);

  const presentes = formulaire.getAll('fichiers').filter((v): v is File => typeof v !== 'string');
  if (presentes.some((v) => v.size > LIMITE_FICHIER) || presentes.reduce((s, v) => s + v.size, 0) > LIMITE_LOT) return erreur('lot_trop_lourd', 413, '32 Mio par fichier, 96 Mio par lot');
  const fichiers: FichierLivre[] = [];
  for (const valeur of formulaire.getAll('fichiers')) {
    if (typeof valeur === 'string') continue;
    fichiers.push({ nom: valeur.name, octets: new Uint8Array(await valeur.arrayBuffer()) });
  }
  if (fichiers.length === 0) return erreur('aucun_fichier', 400, 'aucun fichier n’a été présenté');

  const verdict = controlerDepot(spec, fichiers, lireBaseKit(spec));
  if (!verdict.ok) return json({ ...verdict, ecrits: [] }, 422);

  conserverPrecedente(spec);
  const ecrits = ecrireDepot(dossierModeles(), fichiers, verdict.acceptes);
  return json({ ...verdict, ecrits });
}
