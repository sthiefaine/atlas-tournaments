/** Briques d'interface de l'administration. Aucune bibliothèque : du Tailwind et rien d'autre. */

/** Un bloc titré. */
export function Bloc({ titre, aide, children }: { titre: string; aide?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-1 text-base font-semibold">{titre}</h2>
      {aide ? <p className="mb-3 text-xs opacity-60">{aide}</p> : null}
      <div className="rounded-lg border border-current/10">{children}</div>
    </section>
  );
}

/** Une ligne de tableau générique. */
export function Ligne({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 border-b border-current/10 px-4 py-3 text-sm last:border-b-0">{children}</div>;
}

/** Message plat quand une liste est vide. */
export function Vide({ texte }: { texte: string }) {
  return <p className="px-4 py-6 text-sm opacity-50">{texte}</p>;
}

/** Pastille de statut, sans couleur criarde : c'est un outil de travail, pas un tableau de bord d'aéroport. */
export function Etat({ valeur, ok }: { valeur: string; ok?: boolean }) {
  const teinte = ok === undefined
    ? 'border-current/20'
    : ok
      ? 'border-emerald-600/50 text-emerald-700 dark:text-emerald-300'
      : 'border-red-600/50 text-red-700 dark:text-red-300';
  return <span className={`rounded border px-2 py-0.5 text-xs ${teinte}`}>{valeur}</span>;
}

/** Bouton d'action, à l'intérieur d'un formulaire qui poste vers /api/admin/actions. */
export function Bouton({ children, discret }: { children: React.ReactNode; discret?: boolean }) {
  return (
    <button
      type="submit"
      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition hover:bg-current/5 ${
        discret ? 'border-current/15 opacity-70' : 'border-current/30'
      }`}
    >
      {children}
    </button>
  );
}

/** Formulaire d'action : une action, une cible, un retour. */
export function Action({
  action, retour, champs, children,
}: {
  action: string;
  retour: string;
  champs: Record<string, string>;
  children: React.ReactNode;
}) {
  return (
    <form action="/api/admin/actions" method="post" className="inline-flex items-center gap-2">
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="retour" value={retour} />
      {Object.entries(champs).map(([nom, valeur]) => (
        <input key={nom} type="hidden" name={nom} value={valeur} />
      ))}
      {children}
    </form>
  );
}

/** Bandeau de retour d'action, lu depuis `?message=`. */
export function Message({ texte }: { texte?: string }) {
  if (!texte) return null;
  return (
    <p className="mb-6 rounded-md border border-current/20 bg-current/5 px-3 py-2 text-sm">{texte}</p>
  );
}

/** Bandeau d'avertissement quand la base manque : l'administration reste lisible. */
export function BaseAbsente() {
  return (
    <p className="rounded-md border border-amber-600/40 bg-amber-500/5 px-3 py-2 text-sm">
      Base de données injoignable : <code>DATABASE_URL</code> n’est pas configurée, ou le serveur
      Postgres ne répond pas. Les pages restent accessibles, mais elles n’ont rien à afficher.
    </p>
  );
}
