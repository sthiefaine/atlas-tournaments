import { chargerUnites } from '@/content/index';
import { listerProfilsCommandants } from '@/content/profils-commandants';
import campagne from '../../../../content/campagne.json';
import Journal from './journal';
export const metadata = { title: 'Journal de bord · Atlas' };
export default function PageJournal(): React.ReactElement {
  // Seulement des descriptions de jeu publiques, jamais les biographies auteur.
  const fiches = [
    ...chargerUnites().map(u => ({ cle: u.cle, genre: 'unite' as const, nom: u.nom, texte: `${u.cout} fonds · déplacement ${u.mouvement} · portée ${u.portee.join('–')} · vision ${u.vision}`, pouvoir: '', superPouvoir: '' })),
    ...listerProfilsCommandants().map(c => ({ cle: c.cle, genre: 'commandant' as const, nom: c.nom, texte: c.style, pouvoir: `${c.pouvoir.nom} — ${c.pouvoir.description}`, superPouvoir: `${c.superPouvoir.nom} — ${c.superPouvoir.description}` })),
  ];
  return <Journal fiches={fiches} missions={Object.fromEntries(campagne.missions.map(m => [m.scenarioCle, m.titre]))} />;
}
