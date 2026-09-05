import Link from 'next/link';

/**
 * Page d'accueil provisoire. Le départ français, la carte du monde et ses relations
 * viendront avec le rendu (`src/app/jeu/`, hors de ce périmètre).
 */
export default function Accueil() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] opacity-60">Atlas</p>
        <h1 className="text-4xl font-semibold tracking-tight">Atlas Tournament</h1>
        <p className="text-lg opacity-80">Le tour du monde en une manche.</p>
      </header>

      <p className="max-w-prose text-sm leading-relaxed opacity-70">
        Un tactique au tour par tour où les guerres ont été remplacées par des Jeux Tactiques.
        Le site est en construction : le serveur, les routines de contenu et l’administration
        sont en place, le jeu arrive.
      </p>

      <nav className="flex flex-wrap gap-3">
        <Link
          href="/admin"
          className="rounded-md border border-current/20 px-4 py-2 text-sm font-medium transition hover:bg-current/5"
        >
          Administration
        </Link>
        <Link
          href="/jeu/demo"
          className="rounded-md border border-current/20 px-4 py-2 text-sm font-medium transition hover:bg-current/5"
        >
          Démonstration de rendu
        </Link>
      </nav>

      <footer className="pt-6 text-xs opacity-50">
        <a className="hover:underline" href="/api/health">état du serveur</a>
        {' · '}
        <a className="hover:underline" href="/api/health/routines">sonde des routines</a>
      </footer>
    </main>
  );
}
