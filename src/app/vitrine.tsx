'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { webgl2Disponible } from '@/render/rendu';
import { lirePreferences } from './preferences';

/**
 * La **vitrine** de l'écran-titre : le plateau, en plein cadre.
 *
 * Elle tranche entre deux fonds, et n'en montre **jamais qu'un** — soit
 * l'attract mode, une vraie partie jouée par l'IA en 3D, soit le plateau SVG
 * rendu par le serveur, qui ne coûte que quelques kilo-octets de balisage. Cette
 * règle-là ne change pas : les montrer l'un après l'autre en fondu se voyait, et
 * mal, un dessin à plat qui cède la place à un plateau en relief faisant deux
 * jeux en une seconde et demie.
 *
 * **Ce qui change, le 8 septembre 2026, c'est le moment de la bascule.** Elle se
 * faisait quatre cents millisecondes après l'hydratation, c'est-à-dire quand
 * l'attract était prêt à *se monter* — pas à jouer. Mesuré sur le serveur de
 * développement, volet masqué, cache chaud : le SVG partait à 17,6 s, la
 * première image de l'attract arrivait à 25,9 s. Huit secondes de fond vide,
 * dont 1,1 s de modules, 1,9 s de construction du monde et 4,1 s
 * d'initialisation du moteur WebGPU et de sa première image. Pire : le SVG
 * n'était **jamais** rendu par le serveur, puisque le premier état était
 * « indécis » et n'affichait rien — l'écran-titre naissait sans fond du tout.
 *
 * Trois corrections, et aucune ne réintroduit le fondu :
 *
 * 1. **Le plateau SVG est le fond dès le premier pixel**, serveur compris : c'est
 *    l'état de départ, plus une indécision. Il n'apparaît donc pas, il est là.
 * 2. **Le module de l'attract part tout de suite**, et seul son *montage* attend
 *    le délai. Le délai protège l'interactivité du menu, pas la bande passante :
 *    télécharger pendant qu'on attend, c'est autant de gagné.
 * 3. **La bascule attend une vraie image.** L'attract prévient (`surPret`) quand
 *    le moteur a dessiné, pas quand il a fini de se monter. La substitution est
 *    alors **franche** — pas de transition : c'est le fondu, et lui seul, qui
 *    montrait les deux jeux à la fois. Une coupe d'une image, à l'instant où le
 *    plateau se met à bouger, se lit comme un réveil, pas comme un défaut.
 *
 * Si le moteur échoue, ou s'il n'a rien dessiné au bout du budget, l'attract est
 * démonté et le SVG reste : un fond immobile vaut mieux qu'un trou noir.
 */

const Attract = dynamic(() => import('./attract'), { ssr: false });

/**
 * Au-delà, on renonce à l'attract pour cette visite. Le budget est large — le
 * premier montage d'un moteur WebGPU sur pilote froid se compte en secondes —,
 * mais il existe : une page d'accueil ne garde pas indéfiniment en mémoire un
 * moteur qui ne dessine pas.
 */
const MS_BUDGET = 15_000;

export function Vitrine({ children }: { children: React.ReactNode }) {
  /** Le module est chargé et l'attract monté (encore invisible). */
  const [monte, setMonte] = useState(false);
  /** L'attract a dessiné : c'est lui, désormais, le fond. */
  const [pret, setPret] = useState(false);
  /** Renoncement : pas de moteur, pas d'image, ou le joueur n'en veut pas. */
  const [renonce, setRenonce] = useState(false);

  useEffect(() => {
    // Le réglage de l'appareil est maître ; celui du jeu ne peut qu'ajouter.
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduit || lirePreferences().animationsReduites || !webgl2Disponible()) {
      setRenonce(true);
      return undefined;
    }
    // Le téléchargement part maintenant ; le montage attend le délai. Sur un
    // appareil tactile il est plus long : c'est là que le processeur est le plus
    // lent, et un écran-titre doit être **appuyable avant d'être joli**.
    void import('./attract').catch(() => undefined);
    const tactile = window.matchMedia('(pointer: coarse)').matches;
    const jeton = setTimeout(() => setMonte(true), tactile ? 700 : 400);
    return () => clearTimeout(jeton);
  }, []);

  useEffect(() => {
    if (!monte || pret || renonce) return undefined;
    const jeton = setTimeout(() => setRenonce(true), MS_BUDGET);
    return () => clearTimeout(jeton);
  }, [monte, pret, renonce]);

  return <div className="accueil-vitrine" aria-hidden="true">
    {pret ? null : children}
    {monte && !renonce
      ? <Attract surPret={() => setPret(true)} surEchec={() => setRenonce(true)} />
      : null}
  </div>;
}
