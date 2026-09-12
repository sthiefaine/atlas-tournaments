import { GuideCatalogue } from './guide';
import Link from 'next/link';
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
        <BaseAbsente /><GuideCatalogue />
        <Bloc titre="Canon embarqué" aide="Catalogue local : rôles, coûts et exclusivités. Les nouveaux modèles restent à produire séparément.">
          {canon.unites.map((u) => (
            <Ligne key={u.cle}><Etat valeur={u.factionExclusive ? 'Faction inconnue uniquement' : 'Catalogue commun'} /><Link className="font-semibold underline" href={`/admin/assets/unite_${u.cle}_base`}>{u.nom}</Link><span className="text-xs">{u.cout} fonds · mouvement {u.mouvement} · portée {u.portee[0]}–{u.portee[1]} · vision {u.vision}</span><span className="text-xs admin-secondaire">{u.traits.join(', ')}</span></Ligne>
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
    return (<main><Message texte={message} /><BaseAbsente /><GuideCatalogue /></main>);
  }

  const total = Math.max(actives, canon.unites.length);

  return (
    <main>
      <Message texte={message} /><GuideCatalogue />

      <p className="mb-6 text-sm admin-secondaire">
        <strong>catalogueVersion {version}</strong> · {total} / {PLAFOND_CATALOGUE} unités actives ·
        {' '}{canon.unites.length} canon intouchables. Chaque changement de statut incrémente la version.
      </p>

      <Bloc titre="Canon" aide="Unités versionnées du dépôt ; les exclusivités sont contrôlées par le moteur.">
        {canon.unites.map((u) => (
          <Ligne key={u.cle}>
            <Etat valeur={u.factionExclusive ? 'Faction inconnue uniquement' : u.statut} />
            <span className="w-40 font-mono text-xs">{u.cle}</span>
            <Link className="underline" href={`/admin/assets/unite_${u.cle}_base`}>{u.nom}</Link>
            <span className="ml-auto text-xs admin-secondaire">{u.cout} · {u.traits.join(', ') || 'aucun trait'}</span>
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
            <span className="text-xs admin-secondaire">cycle {u.statutCycle}</span>
            {u.essaiJusquAu ? <span className="text-xs admin-secondaire">essai jusqu’au {u.essaiJusquAu}</span> : null}
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
