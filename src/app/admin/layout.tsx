import Link from 'next/link';

import { sessionCourante } from './session';

export const dynamic = 'force-dynamic';

const ONGLETS: { href: string; libelle: string }[] = [
  { href: '/admin', libelle: 'Tableau de bord' },
  { href: '/admin/file', libelle: 'File de validation' },
  { href: '/admin/prompts', libelle: 'Prompts' },
  { href: '/admin/catalogue', libelle: 'Catalogue d’unités' },
  { href: '/admin/assets', libelle: 'Assets' },
  { href: '/admin/depeche', libelle: 'Missions du jour' },
  { href: '/admin/traductions', libelle: 'Traductions' },
];

/** Cadre commun de l'administration : sobre, en français, sans bibliothèque d'UI. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await sessionCourante();
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3 border-b border-current/10 pb-4">
        <div>
          <Link href="/" className="text-xs uppercase tracking-[0.2em] opacity-50 hover:underline">
            Atlas Tournament
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
        </div>
        {session ? (
          <form action="/api/admin/session?methode=fermer" method="post">
            <button type="submit" className="text-sm underline underline-offset-4 opacity-70 hover:opacity-100">
              Déconnexion
            </button>
          </form>
        ) : null}
      </header>

      {session ? (
        <nav className="mb-8 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {ONGLETS.map((o) => (
            <Link key={o.href} href={o.href} className="opacity-70 underline-offset-4 hover:underline hover:opacity-100">
              {o.libelle}
            </Link>
          ))}
        </nav>
      ) : null}

      {children}
    </div>
  );
}
