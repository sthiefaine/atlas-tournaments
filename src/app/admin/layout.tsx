import Link from 'next/link';
import { sessionCourante } from './session';
import { NavigationAdmin } from './navigation';
import './admin.css';
export const dynamic = 'force-dynamic';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await sessionCourante();
  return <div className="admin-shell">
    <a className="admin-evitement" href="#admin-contenu">Aller au contenu</a>
    <header className="admin-entete"><div><Link href="/" className="admin-marque">Atlas Tournament</Link><h1>Atelier de création</h1><p className="admin-secondaire">Missions, modèles et récit</p></div>{session ? <form action="/api/admin/session?methode=fermer" method="post"><button type="submit">Déconnexion</button></form> : null}</header>
    <div className={session ? 'admin-cadre' : ''}>{session ? <NavigationAdmin /> : null}<div id="admin-contenu" tabIndex={-1} className="admin-contenu">{children}</div></div>
  </div>;
}
