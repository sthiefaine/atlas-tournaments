'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { webgl2Disponible } from '@/render/rendu';
import { lirePreferences } from './preferences';

/**
 * La **vitrine** de l'écran-titre : le plateau, en plein cadre.
 *
 * Elle tranche entre deux fonds, et n'en montre **jamais qu'un**. Soit
 * l'attract mode — une vraie partie jouée par l'IA, en 3D, chargée après
 * l'hydratation —, soit le plateau SVG rendu par le serveur, qui ne coûte que
 * quelques kilo-octets de balisage.
 *
 * Elle les montrait autrefois **l'un après l'autre** : le SVG d'abord, puis la
 * 3D par-dessus en fondu. Cela se voyait, et mal — un dessin à plat qui
 * apparaît puis cède la place à un plateau en relief, ce sont deux jeux
 * différents en une seconde et demie. Le choix se fait donc **avant** le premier
 * pixel de fond : les trois questions qui le décident — l'appareil demande-t-il
 * moins d'animation, le joueur l'a-t-il demandé dans ses réglages, WebGL 2
 * répond-il — se posent au montage, et rien ne s'affiche tant qu'elles n'ont pas
 * de réponse. L'écran-titre reste lisible pendant ce temps : le titre et le menu
 * sont rendus par le serveur, ils ne dépendent pas du fond.
 *
 * Le coût de la 3D est assumé mais cantonné : `next/dynamic` avec `ssr: false`,
 * jamais dans le rendu initial, et un délai plus long sur un appareil tactile —
 * c'est là que le processeur est le plus lent, et un écran-titre doit être
 * **appuyable avant d'être joli**.
 */

const Attract = dynamic(() => import('./attract'), { ssr: false });

/** Ce qu'on décide de montrer derrière le titre. */
type Fond = 'indecis' | 'attract' | 'plateau';

export function Vitrine({ children }: { children: React.ReactNode }) {
  const [fond, setFond] = useState<Fond>('indecis');

  useEffect(() => {
    // Le réglage de l'appareil est maître ; celui du jeu ne peut qu'ajouter.
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduit || lirePreferences().animationsReduites || !webgl2Disponible()) {
      setFond('plateau');
      return undefined;
    }
    const tactile = window.matchMedia('(pointer: coarse)').matches;
    const jeton = setTimeout(() => setFond('attract'), tactile ? 700 : 400);
    return () => clearTimeout(jeton);
  }, []);

  return <div className="accueil-vitrine" aria-hidden="true">
    {fond === 'plateau' ? children : null}
    {fond === 'attract' ? <Attract /> : null}
  </div>;
}
