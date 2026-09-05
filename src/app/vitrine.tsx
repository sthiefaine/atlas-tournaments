'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { lirePreferences } from './preferences';

/**
 * La **vitrine** de l'écran-titre : le plateau, en plein cadre, en deux temps.
 *
 * Le serveur rend le plateau SVG (`plateau-accueil.tsx`), qui est à l'écran dès
 * la première image et ne coûte que quelques kilo-octets de balisage. Après
 * l'hydratation, ce composant charge l'attract mode — le moteur, l'IA et le
 * rendu vectoriel — et fait jouer une vraie partie par-dessus. Le SVG s'efface
 * en fondu quand la première image du canvas est prête.
 *
 * C'est ce découpage qui rend le coût acceptable : le bundle de jeu n'entre
 * jamais dans le rendu initial, il arrive quand la page est déjà lisible et
 * utilisable. Si le visiteur demande à ne pas voir d'animation — par son
 * appareil ou par les réglages du jeu —, il n'arrive pas du tout, et le plateau
 * SVG reste seul, ce qui est très bien.
 *
 * Le délai est plus long sur un appareil tactile : c'est là que le processeur
 * est le plus lent, et un écran-titre doit être **appuyable avant d'être joli**.
 */

const Attract = dynamic(() => import('./attract'), { ssr: false });

export function Vitrine({ children }: { children: React.ReactNode }) {
  const [anime, setAnime] = useState(false);

  useEffect(() => {
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Le réglage de l'appareil est maître ; celui du jeu ne peut qu'ajouter.
    if (reduit.matches || lirePreferences().animationsReduites) return undefined;
    const tactile = window.matchMedia('(pointer: coarse)').matches;
    const jeton = setTimeout(() => setAnime(true), tactile ? 700 : 400);
    return () => clearTimeout(jeton);
  }, []);

  return <div className="accueil-vitrine" aria-hidden="true">
    {children}
    {anime ? <Attract /> : null}
  </div>;
}
