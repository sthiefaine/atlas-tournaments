import { refuserParcoursGlb } from '@/app/api/admin/assets/retrait-glb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Contexte = { params: Promise<{ id: string }> };

export function GET(requete: Request, _contexte: Contexte): Response {
  return refuserParcoursGlb(requete);
}

export function POST(requete: Request, _contexte: Contexte): Response {
  return refuserParcoursGlb(requete);
}
