'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const GROUPES: { nom: string; liens: [string, string][] }[] = [
  { nom: 'Pilotage', liens: [['/admin', 'Vue d’ensemble'], ['/admin/file', 'À valider'], ['/admin/depeche', 'Missions du jour']] },
  { nom: 'Création', liens: [['/admin/assets', 'Bibliothèque d’assets'], ['/admin/assets/chantier', 'Chantier de production'], ['/admin/catalogue', 'Unités et équilibrage'], ['/admin/personnages', 'Personnages et histoire']] },
  { nom: 'Routines', liens: [['/admin/prompts', 'Prompts et versions'], ['/admin/traductions', 'Traductions']] },
];
export function NavigationAdmin() {
  const chemin = usePathname();
  return <nav className="admin-navigation" aria-label="Administration">{GROUPES.map(g => <section key={g.nom}><h2>{g.nom}</h2>{g.liens.map(([href, nom]) => {
    const actif = href === '/admin' ? chemin === href : href === '/admin/assets' ? chemin.startsWith(href) && !chemin.startsWith('/admin/assets/chantier') : chemin.startsWith(href);
    return <Link key={href} href={href} aria-current={actif ? 'page' : undefined}>{nom}</Link>;
  })}</section>)}</nav>;
}
