import { redirect } from 'next/navigation';

import { chargerCatalogueUnites } from '@/content/index';
import { baseConfiguree } from '@/db/client';
import { unites } from '@/db/requetes/index';
import { catalogueVersion, PLAFOND_CATALOGUE } from '@/serveur/cycle';

import { sessionCourante } from '../session';
import { Action, BaseAbsente, Bloc, Bouton, Etat, Ligne, Message, Vide } from '../ui';

export const dynamic = 'force-dynamic';

const RETOUR = '/admin/catalogue';

/**
 * Catalogue d'unités : statuts et changement de statut à la main.
 *
 * Chaque action incrémente `catalogueVersion`. Les dix unités `canon` sont
 * affichées mais sans bouton : elles ne se retirent jamais.
 */
export default async function Catalogue({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  if (!await sessionCourante()) redirect('/admin/login');
  const { message } = await searchParams;
  const canon = chargerCatalogueUnites();

  if (!baseConfiguree()) {
    return (
      <main>
        <Message texte={message} />
        <BaseAbsente />
        <Bloc titre="Canon embarqué" aide="Les dix unités de base, lues dans content/unites.json.">
          {canon.unites.map((u) => (
            <Ligne key={u.cle}><Etat valeur="canon" /><span className="font-mono text-xs">{u.cle}</span><span>{u.nom}</span></Ligne>
          ))}
        </Bloc>
      </main>
    );
  }

  let enBase;
  let version;
  let actives;
  try {
    enBase = await unites.catalogue();
    version = await catalogueVersion();
    actives = await unites.actives();
  } catch {
    return (<main><Message texte={message} /><BaseAbsente /></main>);
  }

  const total = Math.max(actives, canon.unites.length);

  return (
    <main>
      <Message texte={message} />

      <p className="mb-6 text-sm opacity-70">
        <strong>catalogueVersion {version}</strong> · {total} / {PLAFOND_CATALOGUE} unités actives ·
        {' '}{canon.unites.length} canon intouchables. Chaque changement de statut incrémente la version.
      </p>

      <Bloc titre="Canon" aide="Les dix unités de base. Une ligne canon ne change jamais de statut.">
        {canon.unites.map((u) => (
          <Ligne key={u.cle}>
            <Etat valeur="canon" />
            <span className="w-40 font-mono text-xs">{u.cle}</span>
            <span>{u.nom}</span>
            <span className="ml-auto text-xs opacity-50">{u.cout} · {u.traits.join(', ') || 'aucun trait'}</span>
          </Ligne>
        ))}
      </Bloc>

      <Bloc
        titre="Candidates et unités homologuées"
        aide="Mise en essai après certification, 30 jours en missions du jour, puis homologation ou retrait."
      >
        {enBase.length === 0 ? <Vide texte="Aucune unité en base." /> : enBase.map((u) => (
          <Ligne key={u.cle}>
            <Etat valeur={u.statut} ok={u.statut === 'homologuee' ? true : u.statut === 'retiree' ? false : undefined} />
            <span className="w-40 font-mono text-xs">{u.cle}</span>
            <span>{u.donnees.nom}</span>
            <span className="text-xs opacity-60">cycle {u.statutCycle}</span>
            {u.essaiJusquAu ? <span className="text-xs opacity-60">essai jusqu’au {u.essaiJusquAu}</span> : null}
            <div className="ml-auto flex gap-2">
              {u.statut === 'essai' && u.statutCycle === 'valide' && u.essaiJusquAu === null ? (
                <Action action="statut_unite" retour={RETOUR} champs={{ cle: u.cle, statut: 'essai' }}>
                  <Bouton>Mettre en essai</Bouton>
                </Action>
              ) : null}
              {u.statut === 'essai' && u.essaiJusquAu !== null ? (
                <Action action="statut_unite" retour={RETOUR} champs={{ cle: u.cle, statut: 'homologuee' }}>
                  <Bouton>Homologuer</Bouton>
                </Action>
              ) : null}
              {u.statut === 'essai' || u.statut === 'homologuee' ? (
                <Action action="statut_unite" retour={RETOUR} champs={{ cle: u.cle, statut: 'retiree' }}>
                  <Bouton discret>Retirer</Bouton>
                </Action>
              ) : null}
            </div>
          </Ligne>
        ))}
      </Bloc>
    </main>
  );
}
