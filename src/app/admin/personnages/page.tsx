import Link from 'next/link';
import { redirect } from 'next/navigation';
import { personnagesCanon } from '@/serveur/personnages';
import { lireProfilCommandant, listerProfilsCommandants } from '@/content/profils-commandants';
import { chargerCatalogue } from '@/engine/index';
import { traducteur } from '@/i18n/index';
import { effetsDeCapacite, faiblesseDuProfil, repliquesDuProfil } from '@/render/kit-commandant';
import { libelleDuree, lignesPouvoir, nomTerrain, nomUnite } from '@/render/libelles';
import { sessionCourante } from '../session';

const locale = 'fr';
/** Les effets d'une capacité en mots, par la même `lignesPouvoir` que le HUD : ce que le joueur lira. */
function enMots(effets: Parameters<typeof lignesPouvoir>[1], duree?: Parameters<typeof libelleDuree>[1]): string[] {
  const cat = chargerCatalogue();
  return lignesPouvoir(traducteur(locale), effets, {
    noms: { unite: (c) => nomUnite(locale, cat, c), terrain: (c) => nomTerrain(locale, cat, c) },
    duree,
  });
}
export const dynamic = 'force-dynamic';

export default async function Personnages({ searchParams }: { searchParams: Promise<{ q?: string; groupe?: string }> }) {
  if (!await sessionCourante()) redirect('/admin/login');
  const params = await searchParams;
  const q = (params.q ?? '').trim().slice(0, 100);
  const groupe = ['commandants', 'civils'].includes(params.groupe ?? '') ? params.groupe : '';
  const tous = personnagesCanon();
  const profils = listerProfilsCommandants();
  const normaliser = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const personnages = tous.filter(p => {
    const profil = lireProfilCommandant(p.cle);
    return (!groupe || (groupe === 'commandants' ? !!profil : !profil))
      && normaliser(`${p.nom} ${p.fonction} ${profil?.style ?? ''} ${profil?.paysCode ?? ''}`).includes(normaliser(q));
  });
  return <main>
    <h2 className="admin-titre">Personnages, pouvoirs et histoire</h2>
    <p className="admin-intro">Registre éditorial complet : cette page réservée à l’administration contient les révélations. Les pouvoirs du catalogue tactique sont définis pour chaque commandant ; une mission les utilise lorsqu’elle déclare cette révision. Les anciens scénarios conservent leurs capacités historiques. Chaque effet est dit en mots par la même lecture que la jauge du joueur, sous sa forme brute.</p>
    <p className="mb-4 text-sm">{tous.length} personnages · {profils.length} commandants avec pouvoir et super-pouvoir · {personnages.length} fiches affichées</p>
    <form className="assets-filtres" role="search">
      <label>Rechercher un personnage<input name="q" defaultValue={q} placeholder="Nom, rôle, style ou code de nation" maxLength={100} /></label>
      <label>Rôle<select name="groupe" defaultValue={groupe}><option value="">Tous les personnages</option><option value="commandants">Commandants</option><option value="civils">Personnages civils</option></select></label>
      <button className="admin-action admin-action-primaire" type="submit">Filtrer</button>
      <Link className="admin-action" href="/admin/personnages">Réinitialiser</Link>
    </form>
    <nav className="assets-variantes mb-6" aria-label="Personnages">{personnages.map(p => <a key={p.cle} href={`#${p.cle}`}>{p.nom}</a>)}</nav>
    {personnages.length === 0 ? <p>Aucun personnage ne correspond à cette recherche.</p> : null}
    {personnages.map(p => {
      const profil = lireProfilCommandant(p.cle);
      // Révision 4 seulement ; une révision d'avant n'en a pas, et la page le dit.
      const faiblesse = faiblesseDuProfil(profil);
      const replique = repliquesDuProfil(profil);
      return <article className="asset-carte mb-4 [overflow-wrap:anywhere]" id={p.cle} key={p.cle} aria-labelledby={`titre-${p.cle}`}>
        <h3 id={`titre-${p.cle}`} className="text-xl font-semibold">{p.nom}</h3><p>{p.fonction}</p>
        {profil ? <section className="my-4" aria-label={`Capacités de ${p.nom}`}>
          <h4 className="font-semibold">{profil.style}</h4><p>{profil.description}</p><p className="my-2"><strong>Contre-jeu :</strong> {profil.contreJeu}</p>
          <div className="grid gap-3 md:grid-cols-2">{[{ titre: 'Pouvoir', capacite: profil.pouvoir }, { titre: 'Super-pouvoir', capacite: profil.superPouvoir }].map(({ titre, capacite }) => <section key={titre} className="rounded-lg border border-current/20 p-3" aria-label={`${titre} de ${p.nom}`}>
            <h5 className="font-semibold">{titre} · {capacite.nom}</h5><p className="my-1 text-sm">{capacite.barres} barres de jauge · {libelleDuree(traducteur(locale), capacite.duree)}</p><p>{capacite.description}</p>
            <ul className="my-2 list-disc pl-5 text-sm">{enMots(effetsDeCapacite(capacite)).map((ligne, i) => <li key={i}>{ligne}</li>)}</ul>
            {replique ? <p className="my-1 text-sm italic"><strong>Réplique :</strong> « {titre === 'Pouvoir' ? replique.pouvoir : replique.super} »</p> : null}
            <details className="mt-2 text-xs"><summary>Effets utilisés par le moteur</summary><pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(capacite.effets, null, 2)}</pre></details>
          </section>)}</div>
          <details className="mt-2 text-sm"><summary>Effet permanent</summary><p>{profil.descriptionPassif}</p>{profil.passif ? <><p>{enMots([profil.passif]).join(' · ')}</p><pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(profil.passif, null, 2)}</pre></> : <p>Aucun bonus permanent.</p>}</details>
          {faiblesse ? <details className="mt-2 text-sm"><summary>Faiblesse · {faiblesse.axe}</summary><p>{faiblesse.description}</p><p>{enMots([faiblesse.effet]).join(' · ')}</p><pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(faiblesse.effet, null, 2)}</pre></details> : <p className="mt-2 text-sm">Aucune faiblesse chiffrée dans cette révision du catalogue.</p>}
        </section> : <p className="my-3 text-sm">Personnage civil : aucun pouvoir de commandement.</p>}
        <details className="mt-3"><summary className="font-semibold">Histoire, motivations et révélations</summary>
          <p><strong>Motivation :</strong> {p.motivation}</p><p><strong>Croyance :</strong> {p.croyance}</p>
          {p.identiteTactique ? <p><strong>Dilemme :</strong> {p.identiteTactique.dilemme}</p> : null}
          <ol className="space-y-3 border-l border-current/20 pl-4 mt-3">{p.historique.map(f => <li key={f.cle}><span className="text-xs font-semibold">{f.repere} · {f.confidentialite === 'auteur' ? 'Note auteur confidentielle' : f.jalonRevelation ? `Révélation au jalon ${f.jalonRevelation}` : `Révélation acte ${f.acteRevelation}`}</span><p>{f.fait}</p></li>)}</ol>
          <p className="mt-3 text-sm">Liens : {p.liens.map((cle, i) => <span key={cle}>{i ? ', ' : ''}<Link className="underline" href={`/admin/personnages#${cle}`}>{tous.find(v => v.cle === cle)?.nom ?? cle}</Link></span>)}</p>
        </details>
      </article>;
    })}
  </main>;
}
