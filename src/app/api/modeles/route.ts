import { erreur } from '@/serveur/reponses';

export const dynamic = 'force-dynamic';

/** Inventaire 3D retiré ; le jeu lit directement le manifeste de sprites. */
export function GET(): Response {
  return erreur('parcours_glb_retire', 410,
    'Les modèles GLB sont retirés. Les images du jeu sont décrites dans /assets/sprites/manifeste.json.');
}
