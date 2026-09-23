'use client';

import dynamic from 'next/dynamic';

/**
 * La vitrine lit la fenêtre dès son montage — la densité de pixels, les
 * animations réduites, le manifeste par `fetch` — et peint des toiles : rien à
 * gagner à la rendre côté serveur, où elle ne montrerait que des cadres vides.
 * `next/dynamic` avec `ssr: false` n'est permis que depuis un composant client,
 * d'où ce relais.
 */
const Vitrine = dynamic(() => import('./vitrine'), { ssr: false });

export default function VitrineClient(): React.ReactElement {
  return <Vitrine />;
}
