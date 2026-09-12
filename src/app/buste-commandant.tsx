import { buste } from '@/render/buste';
import type { CampId } from '@/schemas/index';

/**
 * Les deux visages du vestiaire : celui d'un commandant, et l'ombre d'un secret.
 *
 * Ils vivent ici, à la racine de `app/`, parce que deux écrans les posent — la
 * grille du briefing (`jeu/[scenario]/choix-commandant.tsx`) et la collection du
 * carnet (`campagne/carnet.tsx`) —, et qu'une route ne doit pas importer un
 * composant d'une autre route pour un dessin.
 */

/** Le buste vectoriel d'un commandant, aux couleurs d'un camp. */
export function Buste({ camp, teinte = false }: { camp: CampId | null; teinte?: boolean }): React.ReactElement {
  return <span
    className="vestiaire-buste"
    data-teinte={teinte ? 'oui' : undefined}
    aria-hidden="true"
    // Le buste est composé par `render/buste.ts` : du SVG que nous
    // écrivons, sans une donnée venue d'ailleurs. C'est le même visage qu'à la
    // scène de dialogue et au splash de pouvoir — trois endroits, un dessin.
    dangerouslySetInnerHTML={{ __html: buste(camp, 'neutre') }}
  />;
}

/**
 * La case d'un secret encore fermé : une ombre, et rien qui se devine.
 *
 * Ce n'est pas un buste terni — c'est un autre dessin, sans visage et sans
 * couleur de camp. Un secret rendu par le buste ordinaire, seulement plus
 * sombre, laisserait lire la carrure, la coiffe et le liseré de sa délégation.
 */
export function Silhouette(): React.ReactElement {
  return <span className="vestiaire-buste" data-silhouette="oui" aria-hidden="true">
    <svg viewBox="0 0 160 190">
      <path fill="#16242c" d="M0 0h160v190H0z" />
      <path stroke="#ffffff" opacity=".07" strokeWidth="1" d="M0 32h160M0 64h160M0 96h160M0 128h160M0 160h160M32 0v190M64 0v190M96 0v190M128 0v190" />
      <path fill="#223945" d="M14 190v-26q4-28 45-33h42q41 5 46 33v26" />
      <path fill="#223945" d="M46 92V58q0-28 34-28 35 0 35 31v31z" />
      <path fill="#223945" d="M54 62h52v40q-3 26-26 27-23-4-26-27z" />
      <text x="80" y="128" textAnchor="middle" fontSize="72" fontWeight="900" fill="#3d5f70">?</text>
    </svg>
  </span>;
}
