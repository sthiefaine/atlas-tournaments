import { redirect } from 'next/navigation';

import { baseConfiguree } from '@/db/client';
import { depeches } from '@/db/requetes/index';
import { ETAPES, jourLocal, minutesRestantes, passee } from '@/serveur/depeche';

import { sessionCourante } from '../session';
import { Action, BaseAbsente, Bloc, Bouton, Etat, Ligne, Message, Vide } from '../ui';

export const dynamic = 'force-dynamic';

const RETOUR = '/admin/depeche';

/**
 * Missions du jour : l'état de la chaîne et le temps qui reste avant 17 h 00.
 *
 * C'est la seule file où l'on travaille contre une horloge. Une journée blanche
 * n'est pas un incident : elle est comptée, affichée avec l'étape qui a manqué, et
 * c'est tout.
 */
export default async function Depeche({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  if (!await sessionCourante()) redirect('/admin/login');
  const { message } = await searchParams;
  if (!baseConfiguree()) return (<main><Message texte={message} /><BaseAbsente /></main>);

  const jour = jourLocal();
  let dujour;
  let sept;
  try {
    dujour = await depeches.depeche(jour);
    sept = await depeches.derniers(7);
  } catch {
    return (<main><Message texte={message} /><BaseAbsente /></main>);
  }

  const restant = minutesRestantes(jour, 'validation');

  return (
    <main>
      <Message texte={message} />

      <Bloc
        titre={`Aujourd’hui — ${jour}`}
        aide="Le vide vaut mieux qu’une erreur : si une étape manque son heure, il n’y a pas de mission ce jour-là."
      >
        {!dujour ? <Vide texte="Aucune dépêche ouverte : la routine cerveau n’a rien proposé, ou l’échéance de 07 h 00 est passée." /> : (
          <>
            <Ligne>
              <Etat valeur={dujour.statut} ok={dujour.statut === 'en_ligne' || dujour.statut === 'valide'} />
              <span className="text-xs opacity-60">
                événement {dujour.eventId ? '✓' : '—'} · scénario {dujour.scenarioId ? '✓' : '—'}
              </span>
              <span className="text-xs opacity-60">expire le {dujour.expireLe}</span>
              <span className="ml-auto text-sm">
                {restant > 0
                  ? `${Math.floor(restant / 60)} h ${String(restant % 60).padStart(2, '0')} avant 17 h 00`
                  : 'échéance de validation passée'}
              </span>
            </Ligne>
            <Ligne>
              {ETAPES.map((e) => (
                <span key={e.nom} className="mr-4 text-xs">
                  <Etat valeur={e.libelle} ok={!passee(jour, e.nom)} />
                </span>
              ))}
            </Ligne>
            {dujour.statut === 'valide' && !passee(jour, 'validation') ? (
              <Ligne>
                <div className="flex flex-wrap gap-2">
                  <Action action="valider_depeche" retour={RETOUR} champs={{ jour }}>
                    <Bouton>Valider pour 18 h 00</Bouton>
                  </Action>
                  <form action="/api/admin/actions" method="post" className="inline-flex items-center gap-2">
                    <input type="hidden" name="action" value="refuser_depeche" />
                    <input type="hidden" name="retour" value={RETOUR} />
                    <input type="hidden" name="jour" value={jour} />
                    <input
                      type="text"
                      name="motif"
                      required
                      placeholder="motif du refus (obligatoire)"
                      className="w-64 rounded-md border border-current/20 bg-transparent px-2 py-1 text-xs"
                    />
                    <Bouton discret>Refuser</Bouton>
                  </form>
                </div>
              </Ligne>
            ) : null}
            {dujour.statut === 'brouillon' || dujour.statut === 'en_controle' ? (
              <Ligne>
                <div className="flex flex-wrap gap-2">
                  <Action action="valider_depeche" retour={RETOUR} champs={{ jour }}>
                    <Bouton>Armer la publication de 18 h 00</Bouton>
                  </Action>
                  <span className="text-xs opacity-60">
                    (la certification par la routine contrôle n’est pas encore arrivée)
                  </span>
                </div>
              </Ligne>
            ) : null}
          </>
        )}
      </Bloc>

      <Bloc titre="Les sept derniers jours" aide="Quels jours ont eu une mission, lesquels ont été blancs, et à quelle étape.">
        {sept.length === 0 ? <Vide texte="Aucun historique." /> : sept.map((d) => (
          <Ligne key={d.id}>
            <span className="w-28 font-mono text-xs">{d.date}</span>
            <Etat valeur={d.statut} ok={d.statut === 'en_ligne'} />
            {d.etapeManquee ? <span className="text-xs opacity-60">étape manquée : {d.etapeManquee}</span> : null}
            {d.motifRefus ? <span className="text-xs opacity-60">refus : {d.motifRefus}</span> : null}
            <span className="ml-auto text-xs opacity-50">catalogue v{d.catalogueVersion} · chaînes v{d.chainesVersion}</span>
          </Ligne>
        ))}
      </Bloc>
    </main>
  );
}
