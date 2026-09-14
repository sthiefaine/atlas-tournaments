import Link from 'next/link';
import { Signe, type NomSigne } from '../composants/signe';
import { redirect } from 'next/navigation';

import { baseConfiguree } from '@/db/client';
import { missions, runs } from '@/db/requetes/index';
import { sonder } from '@/serveur/sonde';

import { ResumeAssets } from './assets/resume';
import { sessionCourante } from './session';
import { BaseAbsente, Bloc, Etat, Ligne, Message, Vide } from './ui';

export const dynamic = 'force-dynamic';
function AccesCreation() {
  const acces: { href: string; nom: string; aide: string; signe: NomSigne }[] = [
    { href: '/admin/assets', nom: 'Modèles 3D', aide: 'Choisir un asset, copier son prompt ou remplacer son GLB.', signe: 'cube' },
    { href: '/admin/cartes', nom: 'Missions', aide: 'Ouvrir une carte et travailler ses objectifs.', signe: 'carte' },
    { href: '/admin/personnages', nom: 'Personnages', aide: 'Histoires, pouvoirs et scènes de campagne.', signe: 'commandants' },
  ];
  return <><h2 className="admin-titre">Reprendre un chantier</h2><div className="admin-chantiers">{acces.map(a =>
    <Link key={a.href} href={a.href}><Signe nom={a.signe} /><span><strong>{a.nom}</strong><small>{a.aide}</small></span><b aria-hidden="true">→</b></Link>
  )}</div><div className="admin-actions"><Link className="admin-action" href="/admin/file">Propositions en attente</Link><Link className="admin-action" href="/admin/prompts">Routines</Link></div></>;
}

/** Tableau de bord : état des routines, dernières exécutions, profondeur de file. */
export default async function TableauDeBord({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  if (!await sessionCourante()) redirect('/admin/login');
  const { message } = await searchParams;

  if (!baseConfiguree()) {
    // Les assets viennent du canon : ils se comptent même sans base.
    return (<main><AccesCreation /><Message texte={message} /><BaseAbsente /><ResumeAssets /></main>);
  }

  let sonde;
  let derniers;
  let file;
  try {
    [sonde, derniers, file] = await Promise.all([sonder(), runs.derniersRuns(12), missions.profondeurFile()]);
  } catch {
    // Les assets viennent du canon : ils se comptent même sans base.
    return (<main><AccesCreation /><Message texte={message} /><BaseAbsente /><ResumeAssets /></main>);
  }

  return (
    <main>
      <AccesCreation />
      <Message texte={message} />

      <ResumeAssets />

      <details className="admin-diagnostic"><summary>Activité des routines</summary>
      <Bloc
        titre="Sonde des routines"
        aide="Le seuil de silence est trois fois la cadence nominale. Une routine qui n’a jamais tourné n’est pas en panne : elle n’est pas encore en service."
      >
        {sonde.routines.map((r) => (
          <Ligne key={r.key}>
            <span className="w-44 font-mono text-xs">{r.key}</span>
            <Etat valeur={r.ok ? 'répond' : 'silencieuse'} ok={r.ok} />
            <span className="admin-secondaire">
              {r.dernier_run ? `dernier run ${new Date(r.dernier_run).toLocaleString('fr-FR')}` : 'jamais lancée'}
            </span>
            <span className="ml-auto text-xs admin-secondaire">silence max {r.silence_max_min} min</span>
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
            <span className="text-xs admin-secondaire">{r.demarreLe.toLocaleString('fr-FR')}</span>
            <span className="text-xs admin-secondaire">{r.missionsRecues} reçues · {r.missionsSoumises} soumises · {r.appels} appels</span>
            {r.bilan ? <span className="basis-full text-xs admin-secondaire">{r.bilan}</span> : null}
            {r.erreurs.length > 0 ? (
              <span className="basis-full font-mono text-xs admin-secondaire">
                {r.erreurs.map((e, i) => <span key={i} className="mr-3">{e.etape}/{e.code}</span>)}
              </span>
            ) : null}
          </Ligne>
        ))}
      </Bloc>
      </details>
    </main>
  );
}
