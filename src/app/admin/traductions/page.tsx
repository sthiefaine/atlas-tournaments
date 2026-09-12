import { redirect } from 'next/navigation';

import { baseConfiguree } from '@/db/client';
import { glossaires, localesReq, traductions } from '@/db/requetes/index';

import { sessionCourante } from '../session';
import { Action, BaseAbsente, Bloc, Bouton, Etat, Ligne, Message, Vide } from '../ui';

export const dynamic = 'force-dynamic';

const RETOUR = '/admin/traductions';

/**
 * Traductions : couverture par langue, échantillon humain, activation d'une langue.
 *
 * Une langue passe `active` quand sa couverture atteint son seuil et que
 * l'échantillon est clos. Elle ne redevient jamais `en_preparation` : on ne retire
 * pas une langue à un joueur qui l'a choisie.
 */
export default async function Traductions({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; locale?: string }>;
}) {
  if (!await sessionCourante()) redirect('/admin/login');
  const { message, locale: choisie } = await searchParams;
  if (!baseConfiguree()) return (<main><Message texte={message} /><BaseAbsente /></main>);

  let langues;
  let penuries;
  let glossairesConnus;
  try {
    langues = await localesReq.toutes();
    penuries = await traductions.penuries();
    glossairesConnus = new Set((await glossaires.tous()).map((g) => g.locale));
  } catch {
    return (<main><Message texte={message} /><BaseAbsente /></main>);
  }

  const echantillon = choisie ? await traductions.enAttenteDeRelecture(choisie, 20) : [];

  return (
    <main>
      <Message texte={message} />

      <Bloc titre="Couverture par langue" aide="Le français est la source : il n’a ni couverture ni traduction.">
        {langues.map((l) => {
          const p = penuries.find((x) => x.locale === l.code);
          const couverture = p ? Math.round(p.couverture * 1000) / 10 : l.code === 'fr' ? 100 : 0;
          const seuil = Number(l.seuilCouverture) * 100;
          return (
            <Ligne key={l.code}>
              <span className="w-24 font-mono text-xs">{l.code}</span>
              <span className="w-40">{l.nom}</span>
              <Etat valeur={l.statut} ok={l.statut === 'active'} />
              {l.code === 'fr' ? (
                <span className="text-xs admin-secondaire">langue source</span>
              ) : (
                <>
                  <span className="text-sm">{couverture} %</span>
                  <span className="text-xs admin-secondaire">
                    {p ? `${p.manquantes} manquantes · ${p.perimees} périmées` : 'aucune chaîne'}
                  </span>
                  {!glossairesConnus.has(l.code) ? (
                    <span className="text-xs text-amber-700">glossaire absent : aucun lot servi</span>
                  ) : null}
                  <div className="ml-auto flex gap-2">
                    <a
                      href={`/admin/traductions?locale=${l.code}`}
                      className="rounded-md border border-current/15 px-3 py-1.5 text-xs admin-secondaire hover:bg-current/5"
                    >
                      Échantillon
                    </a>
                    {l.statut === 'en_preparation' && couverture >= seuil ? (
                      <Action action="activer_langue" retour={RETOUR} champs={{ code: l.code }}>
                        <Bouton>Activer</Bouton>
                      </Action>
                    ) : null}
                  </div>
                </>
              )}
            </Ligne>
          );
        })}
      </Bloc>

      {choisie ? (
        <Bloc
          titre={`Échantillon humain — ${choisie}`}
          aide="Une chaîne sur vingt tant que la langue est en préparation. Conforme, ou corrigée : dans les deux cas, la ligne passe validée."
        >
          {echantillon.length === 0 ? <Vide texte="Aucune ligne en attente de relecture." /> : echantillon.map((e) => (
            <Ligne key={e.cle}>
              <span className="basis-full font-mono text-xs admin-secondaire">{e.cle}</span>
              <span className="basis-full text-sm">« {e.source} »</span>
              <span className="basis-full text-sm admin-secondaire">→ {e.texte ?? '(vide)'}</span>
              <form action="/api/admin/actions" method="post" className="mt-2 flex w-full flex-wrap items-center gap-2">
                <input type="hidden" name="action" value="relire_traduction" />
                <input type="hidden" name="retour" value={`${RETOUR}?locale=${choisie}`} />
                <input type="hidden" name="cle" value={e.cle} />
                <input type="hidden" name="locale" value={choisie} />
                <input
                  type="text"
                  name="texte"
                  aria-label={`Correction de ${e.cle}`}
                  placeholder="laisser vide si conforme, sinon écrire la version correcte"
                  className="min-w-64 flex-1 rounded-md border border-current/20 bg-transparent px-2 py-1 text-xs"
                />
                <Bouton>Enregistrer la relecture</Bouton>
              </form>
            </Ligne>
          ))}
        </Bloc>
      ) : null}
    </main>
  );
}
