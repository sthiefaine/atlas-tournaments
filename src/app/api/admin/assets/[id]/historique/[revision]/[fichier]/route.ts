import { refuserParcoursGlb } from '@/app/api/admin/assets/retrait-glb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(requete: Request, _contexte: { params: Promise<{ id: string; revision: string; fichier: string }> }): Response {
  return refuserParcoursGlb(requete);
}
