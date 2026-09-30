import { redirect } from 'next/navigation';

export const metadata = { title: 'Vitrine des sprites · Atlas' };

/** L’ancien aperçu GLB laisse la place aux images réellement affichées dans le jeu. */
export default function PageAssets() {
  redirect('/atelier/unites');
}
