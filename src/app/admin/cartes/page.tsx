import { redirect } from 'next/navigation';
import { sessionCourante } from '../session';
import { intentionCanon, scenariosConception } from '@/serveur/conception-canon';
import Laboratoire from './laboratoire';
import { avecConsequences } from './consequences';
export const dynamic='force-dynamic';
export default async function Page(){
  if(!await sessionCourante())redirect('/admin/login');
  const [demande,scenarios]=await Promise.all([intentionCanon(),scenariosConception()]);
  if(!demande)return <main><h2>Pilote indisponible</h2></main>;
  return <main><h2 className="admin-titre">Laboratoire de missions</h2>
    <p className="admin-intro">Composez plusieurs cartes autour d’un scénario, comparez leurs essais en normal et difficile, puis exportez le brouillon à retenir. Les calculs utilisent le moteur du jeu. Aucun modèle externe n’est appelé et aucune mission n’est publiée ici.</p>
    <Laboratoire initiale={avecConsequences(demande)} scenarios={scenarios}/></main>;
}
