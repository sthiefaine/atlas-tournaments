import Link from 'next/link';
import { redirect } from 'next/navigation';

import { sessionCourante } from '../../session';
import { chargerCollectionDessins } from './donnees';
import { GalerieDessins } from './galerie';
import styles from './dessins.module.css';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Dessins de référence · Atlas' };

export default async function Dessins() {
  if (!await sessionCourante()) redirect('/admin/login');
  const collection = await chargerCollectionDessins();
  return <main className={styles.page}>
    <Link className={styles.retour} href="/admin/assets">← Bibliothèque de sprites</Link>
    <header className={styles.entete}>
      <p className={styles.surtitre}>Direction artistique · Collection de base</p>
      <h2 className="admin-titre">Dessins de référence</h2>
      <p className={styles.introduction}>Les nouveaux dessins des unités, bâtiments et décors, au fil de leur production. Comparez leur silhouette sur fond clair ou sombre et ouvrez chaque PNG pour l’examiner.</p>
      <p className={styles.precision}>Dessins statiques de référence. Vues directionnelles et animations non livrées ; les sprites actuellement en jeu restent accessibles dans la bibliothèque.</p>
    </header>
    {collection.erreur ? <p role="alert" className={styles.message}>{collection.erreur}</p> : <>
      {collection.ecartees > 0 ? <p role="status" className={styles.message}>Certaines références du plan sont illisibles et ne peuvent pas être affichées.</p> : null}
      <GalerieDessins dessins={collection.dessins} />
    </>}
  </main>;
}
