import { redirect } from 'next/navigation';

import { sessionCourante } from '../session';

export const dynamic = 'force-dynamic';

/** Connexion : un mot de passe, comparé en temps constant côté serveur. */
export default async function Connexion({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  if (await sessionCourante()) redirect('/admin');
  const { erreur } = await searchParams;

  return (
    <main className="max-w-sm space-y-5">
      <h2 className="text-lg font-semibold">Connexion</h2>
      {erreur ? (
        <p className="rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {erreur === 'mot_de_passe' ? 'Mot de passe refusé.' : 'Connexion impossible : la configuration du serveur est incomplète.'}
        </p>
      ) : null}
      <form action="/api/admin/session" method="post" className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block opacity-70">Mot de passe</span>
          <input
            type="password"
            name="motDePasse"
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-current/20 bg-transparent px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-current/20 px-4 py-2 text-sm font-medium transition hover:bg-current/5"
        >
          Entrer
        </button>
      </form>
      <p className="text-xs opacity-50">
        La session dure douze heures. Elle n’ouvre aucune route de routine, et le
        <code className="mx-1">CRON_SECRET</code>
        n’ouvre aucune page d’administration.
      </p>
    </main>
  );
}
