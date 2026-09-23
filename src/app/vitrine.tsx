'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
// La sonde seule, pas la peau : `render2d/gl` n'importe rien, et c'est tout ce
// que l'écran-titre charge avant de savoir s'il montera l'attract.
import { moteur2dDisponible } from '@/render2d/gl';
import { lirePreferences } from './preferences';

/**
 * La **vitrine** de l'écran-titre : le plateau, en plein cadre.
 *
 * Elle tranche entre deux fonds, et n'en montre **jamais qu'un** — soit
 * l'attract mode, une vraie partie jouée par l'IA, soit le plateau SVG rendu par
 * le serveur. Les montrer l'un après l'autre en fondu se voyait, et mal : un
 * dessin à plat qui cède la place au vrai plateau, ce sont deux jeux en une
 * seconde et demie.
 *
 * **Le plateau SVG n'est qu'un repli** (8 septembre 2026, au vu de l'écran, et
 * le propriétaire l'a redit : il est laid, il ne doit jamais paraître en
 * attente). Il paraît quand l'attract est refusé — animations réduites par
 * l'appareil ou par le joueur, WebGL 2 absent — ou quand il a renoncé. Pendant
 * qu'on l'attend, le fond est la nappe sombre de l'écran-titre, dont le titre et
 * le menu viennent du serveur : rien à lire, rien à regretter.
 *
 * **Depuis le 23 septembre 2026, l'attract joue sur la peau 2D**, les images
 * cuites du jeu (`attract.tsx`). Deux conséquences :
 *
 * 1. **Le téléphone a son attract.** Il était refusé à tout appareil tactile
 *    pour épargner le moteur WebGPU, ses modèles et sa première image d'une
 *    seconde ; la 2D ouvre un contexte WebGL 2 en quelques millisecondes, sans
 *    three. Seuls les réglages d'animation — de l'appareil, maître, ou du
 *    joueur, qui ne peut qu'ajouter — le refusent encore, et l'économiseur de
 *    données de l'appareil : l'attract télécharge le moteur et des images.
 * 2. **La porte est WebGL 2**, sondé par `moteur2dDisponible` — ni WebGPU ni
 *    le moteur 3D ne sont plus demandés.
 *
 * Deux règles du 8 septembre tiennent toujours :
 *
 * - **le module de l'attract part tout de suite**, et seul son *montage* attend
 *   le délai : le délai protège l'interactivité du menu, pas la bande passante ;
 * - **la bascule attend une vraie image** (`surPret`), et elle est franche — pas
 *   de fondu, qui montrerait deux jeux à la fois.
 *
 * Si la peau échoue, ou n'a rien dessiné au bout du budget, l'attract est
 * démonté et le SVG paraît : un fond immobile vaut mieux qu'un trou noir.
 */

const Attract = dynamic(() => import('./attract'), { ssr: false });

/**
 * Au-delà, on renonce à l'attract pour cette visite. La 2D dessine en une
 * image : le budget couvre surtout le téléchargement de son module sur un
 * réseau lent. Mais il existe : une page d'accueil ne garde pas indéfiniment en
 * mémoire une peau qui ne dessine pas.
 */
const MS_BUDGET = 15_000;

/**
 * Vrai si l'appareil demande d'économiser les données ou annonce un lien lent.
 * L'attract ne coûte presque rien au processeur, mais il télécharge le moteur de
 * jeu et les pages d'images des pièces qu'il montre — un à deux mégaoctets
 * quand elles sont cuites : un écran-titre ne les dépense pas pour qui a
 * demandé qu'on les lui épargne. Même règle que le préchargement du jeu
 * (`jeu/precharger.ts`).
 */
function economieDeDonnees(): boolean {
  const c = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!c) return false;
  return c.saveData === true || c.effectiveType === 'slow-2g' || c.effectiveType === '2g';
}

export function Vitrine({ children }: { children: React.ReactNode }) {
  /** Le module est chargé et l'attract monté (encore invisible). */
  const [monte, setMonte] = useState(false);
  /** L'attract a dessiné : c'est lui, désormais, le fond. */
  const [pret, setPret] = useState(false);
  /** Renoncement : pas de WebGL 2, pas d'image, ou le joueur n'en veut pas. */
  const [renonce, setRenonce] = useState(false);

  useEffect(() => {
    // Le réglage de l'appareil est maître ; celui du jeu ne peut qu'ajouter.
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduit || lirePreferences().animationsReduites || economieDeDonnees() || !moteur2dDisponible()) {
      setRenonce(true);
      return undefined;
    }
    // Télécharger maintenant, mais laisser le menu répondre avant de monter la
    // démonstration.
    void import('./attract').catch(() => undefined);
    const jeton = setTimeout(() => setMonte(true), 400);
    return () => clearTimeout(jeton);
  }, []);

  useEffect(() => {
    if (!monte || pret || renonce) return undefined;
    const jeton = setTimeout(() => setRenonce(true), MS_BUDGET);
    return () => clearTimeout(jeton);
  }, [monte, pret, renonce]);

  // Le plateau à plat ne sert **que** de repli, jamais d'attente : tant qu'on
  // n'a pas renoncé, le fond reste la nappe sombre de l'écran-titre.
  return <div className="accueil-vitrine" aria-hidden="true" data-fond={renonce ? 'repli' : pret ? 'attract' : 'attente'}>
    {renonce ? children : null}
    {monte && !renonce
      ? <Attract surPret={() => setPret(true)} surEchec={() => setRenonce(true)} />
      : null}
  </div>;
}
