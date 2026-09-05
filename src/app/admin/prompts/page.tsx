import { redirect } from 'next/navigation';

import { baseConfiguree } from '@/db/client';
import { prompts as requetesPrompts } from '@/db/requetes/index';
import { diffLignes, promptDeRun } from '@/serveur/prompts';
import { CLES_PROMPT, type ClePrompt } from '@/schemas/index';

import { sessionCourante } from '../session';
import { Action, BaseAbsente, Bloc, Bouton, Etat, Ligne, Message, Vide } from '../ui';

export const dynamic = 'force-dynamic';

const RETOUR = '/admin/prompts';

/**
 * Prompts : historique par clé, diff texte simple, promotion et retour arrière.
 *
 * Les sections verrouillées sont **affichées, jamais éditables depuis cette vue** :
 * elles ne se modifient qu'en base ou par migration.
 */
export default async function Prompts({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; cle?: string; version?: string }>;
}) {
  if (!await sessionCourante()) redirect('/admin/login');
  const { message, cle: cleBrute, version: versionBrute } = await searchParams;
  if (!baseConfiguree()) return (<main><Message texte={message} /><BaseAbsente /></main>);

  const cle: ClePrompt = (CLES_PROMPT as readonly string[]).includes(cleBrute ?? '')
    ? (cleBrute as ClePrompt)
    : 'atlas_lore';

  let courant;
  let historique;
  try {
    await promptDeRun(cle); // met la base à niveau si le code est en avance
    courant = await requetesPrompts.prompteCourant(cle);
    historique = await requetesPrompts.historique(cle, 30);
  } catch {
    return (<main><Message texte={message} /><BaseAbsente /></main>);
  }

  const versionComparee = Number(versionBrute);
  const comparee = Number.isInteger(versionComparee)
    ? historique.find((h) => h.version === versionComparee) ?? null
    : null;

  return (
    <main>
      <Message texte={message} />

      <nav className="mb-6 flex flex-wrap gap-3 text-sm">
        {CLES_PROMPT.map((k) => (
          <a
            key={k}
            href={`/admin/prompts?cle=${k}`}
            className={`font-mono text-xs underline-offset-4 hover:underline ${k === cle ? 'font-semibold' : 'opacity-60'}`}
          >
            {k}
          </a>
        ))}
      </nav>

      <Bloc titre={`Version courante — ${cle}`} aide="Une seule ligne « courant » par clé. Le retour arrière est la promotion d’une version antérieure.">
        {!courant ? <Vide texte="Aucune version courante." /> : (
          <>
            <Ligne>
              <Etat valeur={`v${courant.version}`} ok />
              <span className="opacity-70">auteur {courant.auteur}</span>
              <span className="text-xs opacity-60">{courant.createdAt.toLocaleString('fr-FR')}</span>
              <span className="ml-auto text-xs opacity-60">
                verrous : {Object.keys(courant.sections).join(', ') || 'aucun'}
              </span>
            </Ligne>
            <div className="max-h-96 overflow-auto px-4 py-3">
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed opacity-80">{courant.corps}</pre>
            </div>
          </>
        )}
      </Bloc>

      <Bloc titre="Historique" aide="Rien n’est effacé. Promouvoir une version antérieure, c’est le retour arrière.">
        {historique.length === 0 ? <Vide texte="Aucune version." /> : historique.map((h) => (
          <Ligne key={h.id}>
            <Etat valeur={`v${h.version}`} ok={h.statut === 'courant' ? true : undefined} />
            <span className="w-24 text-xs opacity-60">{h.statut}</span>
            <span className="text-xs opacity-60">{h.auteur}</span>
            <span className="basis-full text-xs opacity-70">{h.justification || '—'}</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <a
                href={`/admin/prompts?cle=${cle}&version=${h.version}`}
                className="rounded-md border border-current/15 px-3 py-1.5 text-xs opacity-70 hover:bg-current/5"
              >
                Comparer
              </a>
              {h.statut !== 'courant' ? (
                <Action action="promouvoir_prompt" retour={`${RETOUR}?cle=${cle}`} champs={{ cle, version: String(h.version) }}>
                  <Bouton>{h.statut === 'propose' ? 'Promouvoir' : 'Revenir à cette version'}</Bouton>
                </Action>
              ) : null}
              {h.statut === 'propose' ? (
                <form action="/api/admin/actions" method="post" className="inline-flex items-center gap-2">
                  <input type="hidden" name="action" value="rejeter_prompt" />
                  <input type="hidden" name="retour" value={`${RETOUR}?cle=${cle}`} />
                  <input type="hidden" name="cle" value={cle} />
                  <input type="hidden" name="version" value={String(h.version)} />
                  <input
                    type="text"
                    name="motif"
                    required
                    placeholder="motif du refus"
                    className="w-40 rounded-md border border-current/20 bg-transparent px-2 py-1 text-xs"
                  />
                  <Bouton discret>Rejeter</Bouton>
                </form>
              ) : null}
            </div>
          </Ligne>
        ))}
      </Bloc>

      {comparee && courant ? (
        <Bloc titre={`Diff v${comparee.version} → v${courant.version}`} aide="Diff texte simple, ligne à ligne. Les sections verrouillées sont affichées, jamais éditables ici.">
          <div className="max-h-[32rem] overflow-auto px-4 py-3">
            <pre className="font-mono text-xs leading-relaxed">
              {diffLignes(comparee.corps, courant.corps).map((l, i) => (
                <div
                  key={i}
                  className={
                    l.signe === '+' ? 'text-emerald-700 dark:text-emerald-300'
                      : l.signe === '-' ? 'text-red-700 dark:text-red-300'
                        : 'opacity-50'
                  }
                >
                  {l.signe} {l.texte}
                </div>
              ))}
            </pre>
          </div>
        </Bloc>
      ) : null}
    </main>
  );
}
