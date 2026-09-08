'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

/**
 * La toile importe le moteur WebGPU de three (`@/render3d/index`), qui suppose
 * un navigateur dès son chargement (`self`, `navigator`) : rendue côté serveur,
 * la page répondait 500 « self is not defined », et Next ne se rattrapait qu'en
 * développement, en la redessinant côté client. `next/dynamic` avec
 * `ssr: false` n'est permis que depuis un composant client — d'où ce relais,
 * comme `vitrine-client.tsx` pour la vitrine et `vitrine.tsx` pour l'accueil.
 */
const Toile = dynamic(() => import('./toile'), { ssr: false });

export default function ToileClient(props: ComponentProps<typeof Toile>): React.ReactElement {
  return <Toile {...props} />;
}
