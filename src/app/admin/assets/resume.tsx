import Link from 'next/link';
import { Bloc, Ligne } from '../ui';
import { chargerBibliothequeSprites } from './sprites';

/** Le tableau de bord compte les images du manifeste effectivement utilisé par le jeu. */
export async function ResumeAssets() {
  const { sprites, erreur } = await chargerBibliothequeSprites();
  return <Bloc titre="Sprites" aide="Infanterie, hélicoptère et char : les dessins de référence sont prêts, les vues et animations restent à finaliser.">
    <Ligne>
      <Link href="/admin/assets" className="w-44 text-xs underline-offset-4 hover:underline">Bibliothèque de sprites</Link>
      <span>{erreur ?? `${sprites.length} images actuelles disponibles`}</span>
      <Link href="/atelier/unites" className="ml-auto text-xs underline-offset-4 hover:underline">Ouvrir la vitrine →</Link>
    </Ligne>
  </Bloc>;
}
