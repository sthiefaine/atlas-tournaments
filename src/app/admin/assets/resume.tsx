import Link from 'next/link';
import { Bloc, Ligne } from '../ui';
import { chargerBibliothequeSprites } from './sprites';

/** Le tableau de bord compte les images du manifeste effectivement utilisé par le jeu. */
export async function ResumeAssets() {
  const { sprites, erreur } = await chargerBibliothequeSprites();
  return <Bloc titre="Sprites" aide="La collection des nouveaux dessins s’enrichit ; ses vues et animations restent à produire.">
    <Ligne>
      <Link href="/admin/assets" className="w-44 text-xs underline-offset-4 hover:underline">Bibliothèque de sprites</Link>
      <span>{erreur ?? `${sprites.length} images actuelles disponibles`}</span>
      <Link href="/atelier/unites" className="ml-auto text-xs underline-offset-4 hover:underline">Ouvrir la vitrine →</Link>
    </Ligne>
    <Ligne>
      <Link href="/admin/assets/dessins" className="text-xs underline-offset-4 hover:underline">Dessins de référence →</Link>
      <span className="admin-secondaire">Unités, bâtiments et décors · PNG individuels</span>
    </Ligne>
  </Bloc>;
}
