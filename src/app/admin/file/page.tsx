import { redirect } from 'next/navigation';

import { baseConfiguree } from '@/db/client';
import { cartes, commandants, evenements, pays, reviews, scenarios, unites } from '@/db/requetes/index';
import { porteUneAlerte } from '@/serveur/cycle';
import type { Statut } from '@/schemas/index';

import { sessionCourante } from '../session';
import { Action, BaseAbsente, Bloc, Bouton, Etat, Ligne, Message, Vide } from '../ui';

export const dynamic = 'force-dynamic';

const RETOUR = '/admin/file';

/** Un objet en attente, quel que soit son type. */
interface Objet {
  type: string;
  cle: string;
  titre: string;
  statut: Statut;
  apercu: string;
}

async function collecter(): Promise<Objet[]> {
  const statuts: Statut[] = ['valide', 'brouillon', 'rejete', 'quarantaine'];
  const objets: Objet[] = [];
  for (const c of await cartes.parStatut(statuts, 40)) {
    objets.push({
      type: 'carte', cle: c.code, titre: c.code, statut: c.statut,
      apercu: c.apercu?.ascii?.slice(0, 400) ?? `graine ${c.graine}`,
    });
  }
  for (const s of await scenarios.parStatut(statuts, 40)) {
    objets.push({ type: 'scenario', cle: s.code, titre: s.donnees.nom, statut: s.statut, apercu: `${s.paysCode} · acte ${s.acte} · ${s.date}` });
  }
  for (const c of await commandants.parStatut(statuts)) {
    objets.push({ type: 'commandant', cle: c.code, titre: c.donnees.nom, statut: c.statut, apercu: `${c.paysCode} · ${c.donnees.archetype}` });
  }
  for (const p of await pays.parStatut(statuts)) {
    objets.push({ type: 'pays', cle: p.code, titre: p.donnees.nom, statut: p.statut, apercu: p.donnees.accroche });
  }
  for (const e of await evenements.parStatut(statuts, 40)) {
    objets.push({ type: 'evenement', cle: e.code, titre: e.donnees.titre, statut: e.statut, apercu: e.donnees.resume });
  }
  for (const u of await unites.catalogue()) {
    if ((statuts as string[]).includes(u.statutCycle)) {
      objets.push({ type: 'unite', cle: u.cle, titre: u.donnees.nom, statut: u.statutCycle, apercu: `${u.donnees.cout} · ${u.traits.join(', ') || 'aucun trait'}` });
    }
  }
  return objets;
}

/** File de validation : brouillons par type, aperçu, accepter ou rejeter avec motif. */
export default async function File({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  if (!await sessionCourante()) redirect('/admin/login');
  const { message } = await searchParams;
  if (!baseConfiguree()) return (<main><Message texte={message} /><BaseAbsente /></main>);

  let objets: Objet[];
  let derniersVerdicts;
  try {
    objets = await collecter();
    derniersVerdicts = await reviews.derniers(30);
  } catch {
    return (<main><Message texte={message} /><BaseAbsente /></main>);
  }

  const parStatut = (s: Statut) => objets.filter((o) => o.statut === s);
  const alertes = derniersVerdicts.filter((v) => porteUneAlerte(v.codesMotifs));

  return (
    <main>
      <Message texte={message} />

      {alertes.length > 0 ? (
        <p className="mb-6 rounded-md border border-red-600/50 bg-red-500/5 px-3 py-2 text-sm">
          {alertes.length} alerte(s) de sensibilité non revue(s). Aucune promotion de prompt n’est
          possible sur les clés concernées tant qu’elles ne sont pas traitées.
        </p>
      ) : null}

      <Bloc titre="À mettre en ligne" aide="Objets certifiés par le contrôle. La mise en ligne est le seul geste qui change le jeu pour les joueurs.">
        {parStatut('valide').length === 0 ? <Vide texte="Rien en attente." /> : parStatut('valide').map((o) => (
          <Ligne key={`${o.type}:${o.cle}`}>
            <span className="w-24 text-xs uppercase tracking-wide opacity-50">{o.type}</span>
            <span className="font-medium">{o.titre}</span>
            <span className="basis-full whitespace-pre-wrap font-mono text-xs opacity-60">{o.apercu}</span>
            <div className="ml-auto flex gap-2">
              <Action action="mettre_en_ligne" retour={RETOUR} champs={{ type: o.type, cle: o.cle }}>
                <Bouton>Mettre en ligne</Bouton>
              </Action>
              <Action action="renvoyer" retour={RETOUR} champs={{ type: o.type, cle: o.cle }}>
                <Bouton discret>Renvoyer en brouillon</Bouton>
              </Action>
              <Action action="ecarter" retour={RETOUR} champs={{ type: o.type, cle: o.cle }}>
                <Bouton discret>Écarter</Bouton>
              </Action>
            </div>
          </Ligne>
        ))}
      </Bloc>

      <Bloc titre="Brouillons" aide="En attente du passage de la routine contrôle. Rien n’atteint « validé » sans elle.">
        {parStatut('brouillon').length === 0 ? <Vide texte="Aucun brouillon." /> : parStatut('brouillon').map((o) => (
          <Ligne key={`${o.type}:${o.cle}`}>
            <span className="w-24 text-xs uppercase tracking-wide opacity-50">{o.type}</span>
            <span>{o.titre}</span>
            <span className="ml-auto text-xs opacity-50">{o.cle}</span>
          </Ligne>
        ))}
      </Bloc>

      <Bloc titre="Rejets" aide="Groupés par motif ci-dessous. Annuler un rejet compte comme un faux positif de contrôle.">
        {parStatut('rejete').length === 0 ? <Vide texte="Aucun rejet." /> : parStatut('rejete').map((o) => (
          <Ligne key={`${o.type}:${o.cle}`}>
            <span className="w-24 text-xs uppercase tracking-wide opacity-50">{o.type}</span>
            <span>{o.titre}</span>
            <div className="ml-auto flex gap-2">
              <Action action="annuler_rejet" retour={RETOUR} champs={{ type: o.type, cle: o.cle }}>
                <Bouton discret>Annuler le rejet</Bouton>
              </Action>
              <Action action="ecarter" retour={RETOUR} champs={{ type: o.type, cle: o.cle }}>
                <Bouton discret>Écarter</Bouton>
              </Action>
            </div>
          </Ligne>
        ))}
      </Bloc>

      <Bloc titre="Quarantaine" aide="Ce que les routines n’ont pas su interpréter. On rend, ou on écarte.">
        {parStatut('quarantaine').length === 0 ? <Vide texte="Aucun objet en quarantaine." /> : parStatut('quarantaine').map((o) => (
          <Ligne key={`${o.type}:${o.cle}`}>
            <span className="w-24 text-xs uppercase tracking-wide opacity-50">{o.type}</span>
            <span>{o.titre}</span>
            <div className="ml-auto flex gap-2">
              <Action action="renvoyer" retour={RETOUR} champs={{ type: o.type, cle: o.cle }}>
                <Bouton>Rendre</Bouton>
              </Action>
              <Action action="ecarter" retour={RETOUR} champs={{ type: o.type, cle: o.cle }}>
                <Bouton discret>Écarter</Bouton>
              </Action>
            </div>
          </Ligne>
        ))}
      </Bloc>

      <Bloc titre="Derniers verdicts" aide="Chaque motif porte le chiffre qui l’a déclenché.">
        {derniersVerdicts.length === 0 ? <Vide texte="Aucun verdict rendu." /> : derniersVerdicts.map((v) => (
          <Ligne key={v.id}>
            <Etat valeur={v.verdict} ok={v.verdict === 'valide'} />
            <span className="w-24 text-xs uppercase tracking-wide opacity-50">{v.cibleType}</span>
            <span className="font-mono text-xs">{v.cibleCle}</span>
            <span className="ml-auto text-xs opacity-60">{v.createdAt.toLocaleString('fr-FR')}</span>
            {v.motifs.length > 0 ? (
              <span className="basis-full text-xs opacity-70">
                {v.motifs.map((m) => `${m.code}${m.mesure ? ` (${Object.entries(m.mesure).map(([k, n]) => `${k} ${n}`).join(', ')})` : ''}`).join(' · ')}
              </span>
            ) : null}
          </Ligne>
        ))}
      </Bloc>
    </main>
  );
}
