'use client';

/**
 * Réchauffe le module de la toile — moteur de règles, IA, rendu 3D et
 * `three/webgpu` — **avant** que le joueur ne clique.
 *
 * Une entrée en mission est une cascade strictement sérielle : on clique, la
 * page arrive, elle s'hydrate, et **seulement alors** le navigateur découvre
 * qu'il lui faut trois cent trente kilo-octets de moteur. Mesuré le 8 septembre
 * 2026 sur le serveur de développement, cache froid : 4,2 s entre la première
 * image de la page et l'arrivée des modules. L'écran de chargement couvre
 * désormais cette attente, mais la couvrir n'est pas la supprimer.
 *
 * Le survol et le focus d'un bouton « jouer » sont le seul moment où l'on sait
 * *avant* le clic ce que le joueur va demander. On y lance donc l'import, une
 * seule fois par page. C'est la même politique que le préchargement de route de
 * `next/link`, appliquée au module que celui-ci ne connaît pas — un `import()`
 * dynamique reste invisible au marcheur d'imports statiques de
 * `tests/app/sans-moteur-au-serveur.test.ts`, et la page continue donc de se
 * rendre côté serveur sans jamais toucher `three/webgpu`.
 *
 * Deux garde-fous : on ne le fait qu'une fois, et jamais quand l'appareil a
 * demandé d'économiser les données — dépenser trois cents kilo-octets pour une
 * page qu'on survole sans la choisir serait une impolitesse.
 */

/** Une seule tentative par page : le module se met en cache tout seul ensuite. */
let lance = false;

/** Vrai si l'appareil demande d'économiser les données ou annonce un lien lent. */
function economieDeDonnees(): boolean {
  const c = (navigator as unknown as {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (!c) return false;
  return c.saveData === true || c.effectiveType === 'slow-2g' || c.effectiveType === '2g';
}

/** Lance le téléchargement du jeu. Sans effet visible, et sans effet en double. */
export function prechargerJeu(): void {
  if (lance || typeof window === 'undefined') return;
  lance = true;
  if (economieDeDonnees()) return;
  // Un échec ne regarde personne : la page de jeu le redemandera elle-même.
  void import('./[scenario]/toile').catch(() => undefined);
}

/** Les deux écoutes à poser sur un lien qui mène en mission. */
export const GESTES_PRECHARGEMENT = {
  onPointerEnter: prechargerJeu,
  onFocus: prechargerJeu,
} as const;
