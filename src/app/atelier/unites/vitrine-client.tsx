'use client';

import dynamic from 'next/dynamic';

/**
 * La vitrine importe le moteur WebGPU de three, qui suppose un navigateur dès
 * son chargement (`self`, `navigator`) : elle ne doit jamais s'évaluer côté
 * serveur, ni au prérendu. `next/dynamic` avec `ssr: false` n'est permis que
 * depuis un composant client — d'où ce relais, comme `vitrine.tsx` le fait
 * pour l'attract de l'accueil.
 */
const Vitrine = dynamic(() => import('./vitrine'), { ssr: false });

export default function VitrineClient(): React.ReactElement {
  return <Vitrine />;
}
