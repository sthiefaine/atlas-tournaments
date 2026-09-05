import { redirect } from 'next/navigation';

import { baseConfiguree } from '@/db/client';
import { missions, runs } from '@/db/requetes/index';
import { sonder } from '@/serveur/sonde';

import { sessionCourante } from './session';
import { BaseAbsente, Bloc, Etat, Ligne, Message, Vide } from './ui';

export const dynamic = 'force-dynamic';

/** Tableau de bord : état des routines, dernières exécutions, profondeur de file. */
export default async function TableauDeBord({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  if (!await sessionCourante()) redirect('/admin/login');
  const { message } = await searchParams;

  if (!baseConfiguree()) {
    return (<main><Message texte={message} /><BaseAbsente /></main>);
  }

  let sonde;
  let derniers;
  let file;
  try {
    sonde = await sonder();
    derniers = await runs.derniersRuns(12);
    file = await missions.profondeurFile();
  } catch {
    return (<main><Message texte={message} /><BaseAbsente /></main>);
  }

  return (
    <main>
      <Message texte={message} />

      <Bloc
        titre="Sonde des routines"
        aide="Le seuil de silence est trois fois la cadence nominale. Une routine qui n’a jamais tourné n’est pas en panne : elle n’est pas encore en service."
      >
        {sonde.routines.map((r) => (
          <Ligne key={r.key}>
            <span className="w-44 font-mono text-xs">{r.key}</span>
            <Etat valeur={r.ok ? 'répond' : 'silencieuse'} ok={r.ok} />
            <span className="opacity-60">
              {r.dernier_run ? `dernier run ${new Date(r.dernier_run).toLocaleString('fr-FR')}` : 'jamais lancée'}
            </span>
            <span className="ml-auto text-xs opacity-50">silence max {r.silence_max_min} min</span>
          </Ligne>
        ))}
      </Bloc>

      <Bloc titre="Profondeur de file" aide="Missions ouvertes par routine. Au-dessus de 30, le contrôle est le goulot.">
        {file.length === 0 ? <Vide texte="Aucune mission ouverte." /> : file.map((f) => (
          <Ligne key={f.routine}>
            <span className="w-44 font-mono text-xs">{f.routine}</span>
            <span>{f.n} mission(s) ouverte(s)</span>
          </Ligne>
        ))}
      </Bloc>

      <Bloc titre="Dernières exécutions" aide="Chaque run laisse exactement une ligne, close par sa ligne de bilan.">
        {derniers.length === 0 ? <Vide texte="Aucun run enregistré." /> : derniers.map((r) => (
          <Ligne key={r.id}>
            <span className="w-44 font-mono text-xs">{r.routine}</span>
            <Etat valeur={r.statut} ok={r.statut === 'ok' ? true : r.statut === 'en_cours' ? undefined : false} />
            <span className="text-xs opacity-60">{r.demarreLe.toLocaleString('fr-FR')}</span>
            <span className="text-xs opacity-60">{r.missionsRecues} reçues · {r.missionsSoumises} soumises · {r.appels} appels</span>
            {r.bilan ? <span className="basis-full text-xs opacity-70">{r.bilan}</span> : null}
            {r.erreurs.length > 0 ? (
              <span className="basis-full font-mono text-xs opacity-60">
                {r.erreurs.map((e, i) => <span key={i} className="mr-3">{e.etape}/{e.code}</span>)}
              </span>
            ) : null}
          </Ligne>
        ))}
      </Bloc>
    </main>
  );
}
