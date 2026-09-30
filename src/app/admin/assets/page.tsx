import Link from 'next/link';
import { redirect } from 'next/navigation';

import { sessionCourante } from '../session';
import { Modeles } from './modeles';
import { chargerBibliothequeSprites, type CategorieSprite } from './sprites';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Bibliothèque de sprites · Atlas' };

export default async function Assets({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!await sessionCourante()) redirect('/admin/login');
  const [params, bibliotheque] = await Promise.all([searchParams, chargerBibliothequeSprites()]);
  const categorie: CategorieSprite = typeof params.categorie === 'string'
    && ['unites', 'batiments', 'decors', 'terrains'].includes(params.categorie)
    ? params.categorie as CategorieSprite : 'unites';
  return <main>
    <h2 className="admin-titre">Bibliothèque de sprites</h2>
    <p className="admin-intro">Les images actuellement disponibles dans le jeu. Ouvrez un sprite pour regarder ses vues, ses animations et ses couleurs.</p>
    <section className="mb-6 rounded-lg bg-current/5 p-4" aria-labelledby="dessins-sprites">
      <h3 id="dessins-sprites" className="mb-2 font-semibold">La nouvelle collection se dessine</h3>
      <p className="mb-3">Unités, bâtiments et décors : consultez les dessins de référence au fil de leur production. Ces images statiques préparent les prochaines vues et animations du jeu.</p>
      <Link className="admin-action admin-action-primaire" href="/admin/assets/dessins">Voir les dessins de référence →</Link>
    </section>
    <div className="admin-actions"><Link className="admin-action" href="/atelier/unites">Ouvrir la vitrine</Link><Link className="admin-action" href="/atelier">Voir le plateau</Link></div>
    {bibliotheque.erreur ? <p role="alert" className="admin-intro">{bibliotheque.erreur}</p> : <>
      {bibliotheque.ecartees > 0 ? <p role="status" className="admin-intro">{bibliotheque.ecartees} entrée(s) illisible(s) écartée(s) de la bibliothèque.</p> : null}
      <Modeles sprites={bibliotheque.sprites} initial={{
        categorie,
        groupe: typeof params.groupe === 'string' && ['infanterie', 'mobiles', 'aeriennes', 'navales'].includes(params.groupe) ? params.groupe : '',
        recherche: typeof params.rechercheModele === 'string' ? params.rechercheModele : '',
      }} />
    </>}
  </main>;
}
