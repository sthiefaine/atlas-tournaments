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
    <section className="mb-6 rounded-lg border border-current/20 p-4" aria-labelledby="pilotes-sprites">
      <h3 id="pilotes-sprites" className="mb-2 font-semibold">Trois pilotes en préparation</h3>
      <p>Infanterie, hélicoptère et char : une nouvelle direction artistique en sprites directs est en préparation. Les vues et animations des trois pilotes restent à finaliser avant toute généralisation ; les images actuelles restent en place.</p>
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
