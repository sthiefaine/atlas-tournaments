'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { PropsInspection } from './types-inspection';
const Inspection = dynamic(() => import('./inspection'), { ssr: false, loading: () => <p>Chargement du banc 3D…</p> });
export function InspectionClient(props: PropsInspection) {
  const libelle = props.libelleBanc ?? 'banc de réception 3D';
  const [ouvert, ouvrir] = useState(false);
  return <section className="mb-8 rounded border border-current/20 p-4">
    <button type="button" className="underline" aria-expanded={ouvert} onClick={() => ouvrir(!ouvert)}>{ouvert ? 'Fermer' : 'Ouvrir'} le {libelle}</button>
    {ouvert ? <Inspection {...props} /> : <p className="mt-2 text-xs opacity-70">Dessus, trois-quarts, caméra de jeu, textures, LOD et animations. Le moteur 3D est chargé à l’ouverture.</p>}
  </section>;
}
