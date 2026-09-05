'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

/**
 * La **vitrine** de l'accueil : le plateau, en deux temps.
 *
 * Le serveur rend le plateau SVG (`plateau-accueil.tsx`), qui est à l'écran dès
 * la première image et ne coûte que quelques kilo-octets de balisage. Après
 * l'hydratation, ce composant charge l'attract mode — le moteur, l'IA et le
 * rendu vectoriel — et fait jouer une vraie partie par-dessus. Le SVG s'efface
 * en fondu quand la première image du canvas est prête.
 *
 * C'est ce découpage qui rend le coût acceptable : le bundle de jeu n'entre
 * jamais dans le rendu initial, il arrive quand la page est déjà lisible et
 * utilisable. Si le visiteur demande à ne pas voir d'animation, il n'arrive
 * pas du tout, et le plateau SVG reste seul — ce qui est très bien.
 */

const Attract = dynamic(() => import('./attract'), { ssr: false });

export function Vitrine({ children }: { children: React.ReactNode }) {
  const [anime, setAnime] = useState(false);

  useEffect(() => {
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduit.matches) return undefined;
    // On laisse la page finir de s'installer avant d'aller chercher le moteur :
    // l'accueil doit être cliquable avant d'être joli.
    const jeton = setTimeout(() => setAnime(true), 400);
    return () => clearTimeout(jeton);
  }, []);

  return <div className="accueil-vitrine">
    {children}
    {anime ? <Attract /> : null}
  </div>;
}
