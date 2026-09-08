'use client';

import dynamic from 'next/dynamic';
import { useState, type ComponentProps } from 'react';
import { EcranChargement, type LibellesChargement } from './chargement';
import type { EtapePage } from './etapes-chargement';

/**
 * La toile importe le moteur WebGPU de three (`@/render3d/index`), qui suppose
 * un navigateur dès son chargement (`self`, `navigator`) : rendue côté serveur,
 * la page répondait 500 « self is not defined », et Next ne se rattrapait qu'en
 * développement, en la redessinant côté client. `next/dynamic` avec
 * `ssr: false` n'est permis que depuis un composant client — d'où ce relais,
 * comme `vitrine-client.tsx` pour la vitrine et `vitrine.tsx` pour l'accueil.
 *
 * Ce relais porte en plus l'**écran de chargement**, et c'est tout l'intérêt de
 * le mettre ici : lui n'est pas en `ssr: false`, il part donc dans le HTML de la
 * page. Sans lui, le corps de `/jeu/[scenario]` était littéralement vide jusqu'à
 * ce que les 330 ko de moteur soient descendus et évalués — mesuré à 4,2 s au
 * premier chargement sur le serveur de développement. C'est aussi lui qui pose
 * le fond sombre du jeu, pour que la page n'ait jamais l'air d'avoir échoué.
 *
 * La toile lui rend la main étape par étape, et il ne s'efface qu'à `pret`,
 * c'est-à-dire quand une **image a réellement été dessinée** — pas quand le jeu
 * a fini de se monter.
 */
const Toile = dynamic(() => import('./toile'), { ssr: false });

type ProprietesRelais = Omit<ComponentProps<typeof Toile>, 'surChargement'> & {
  /** Les libellés de l'écran de chargement, déjà traduits par la page. */
  libellesChargement: LibellesChargement;
};

export default function ToileClient(
  { libellesChargement, ...props }: ProprietesRelais,
): React.ReactElement {
  const [etape, setEtape] = useState<EtapePage>('modules');
  return <>
    <Toile {...props} surChargement={setEtape} />
    <EcranChargement etape={etape} libelles={libellesChargement} titre={props.scenario.nom} />
  </>;
}
