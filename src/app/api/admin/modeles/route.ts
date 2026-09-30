import { refuserParcoursGlb } from '@/app/api/admin/assets/retrait-glb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Le dépôt de modèles 3D est fermé ; aucun corps de requête n’est lu. */
export function POST(requete: Request): Response {
  return refuserParcoursGlb(requete);
}
