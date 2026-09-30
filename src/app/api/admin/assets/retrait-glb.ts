import { exigerAdmin } from '@/serveur/auth';
import { erreur } from '@/serveur/reponses';

/** Les anciennes routes restent authentifiées et ne lisent ni n’écrivent de GLB. */
export function refuserParcoursGlb(requete: Request): Response {
  const refus = exigerAdmin(requete);
  if (refus) return refus;
  return erreur('parcours_glb_retire', 410,
    'Le parcours GLB est retiré : Atlas passe aux sprites directs. Consultez /admin/assets pour les images actuelles. Les trois pilotes sont en préparation ; aucun dépôt n’est ouvert.');
}
