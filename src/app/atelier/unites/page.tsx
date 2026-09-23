import VitrineClient from './vitrine-client';

export const metadata = { title: 'Images cuites · Atlas' };

/**
 * La vitrine des images cuites : chaque entrée du manifeste, toutes ses vues et
 * tous ses clips, à la couleur de chaque camp — et le repli quand l'entrée
 * manque (`vitrine.tsx`). Elle remplace les six angles 3D d'un modèle : on y
 * juge désormais ce que le joueur voit, pas la source dont on le tire.
 */
export default function PageVitrine(): React.ReactElement {
  return <VitrineClient />;
}
