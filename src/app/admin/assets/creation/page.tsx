import { redirect } from 'next/navigation';
import { sessionCourante } from '../../session';

export const dynamic = 'force-dynamic';

/** L’ancien parcours de production 3D est remplacé par la bibliothèque de sprites. */
export default async function AncienParcoursAssets() {
  if (!await sessionCourante()) redirect('/admin/login');
  redirect('/admin/assets');
}
