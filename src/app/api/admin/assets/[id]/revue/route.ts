import { refuserParcoursGlb } from '@/app/api/admin/assets/retrait-glb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(requete: Request, _contexte: { params: Promise<{ id: string }> }): Response {
  return refuserParcoursGlb(requete);
}
