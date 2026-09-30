import { redirect } from 'next/navigation';
import { sessionCourante } from '../../session';
import { chargerBibliothequeSprites } from '../sprites';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Les liens vers les anciennes fiches ouvrent maintenant l’image, lorsqu’elle existe. */
export default async function FicheAsset({ params }: { params: Promise<{ cle: string }> }) {
  if (!await sessionCourante()) redirect('/admin/login');
  const [{ cle }, { sprites }] = await Promise.all([params, chargerBibliothequeSprites()]);
  const sprite = sprites.find(s => s.id === cle);
  redirect(sprite ? `/atelier/unites?id=${encodeURIComponent(sprite.id)}` : '/admin/assets');
}
