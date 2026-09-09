import Link from 'next/link';
import { redirect } from 'next/navigation';
import { personnagesCanon } from '@/serveur/personnages';
import { lireProfilCommandant, listerProfilsCommandants } from '@/content/profils-commandants';
import { sessionCourante } from '../session';
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
    <p className="admin-intro">Registre éditorial complet : cette page réservée à l’administration contient les révélations. Les pouvoirs de révision 3 sont définis pour chaque commandant ; une mission les utilise lorsqu’elle déclare cette révision. Les anciens scénarios conservent leurs capacités historiques.</p>
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
      return <article className="asset-carte mb-4 [overflow-wrap:anywhere]" id={p.cle} key={p.cle} aria-labelledby={`titre-${p.cle}`}>
        <h3 id={`titre-${p.cle}`} className="text-xl font-semibold">{p.nom}</h3><p>{p.fonction}</p>
        {profil ? <section className="my-4" aria-label={`Capacités de ${p.nom}`}>
          <h4 className="font-semibold">{profil.style}</h4><p>{profil.description}</p><p className="my-2"><strong>Contre-jeu :</strong> {profil.contreJeu}</p>
          <div className="grid gap-3 md:grid-cols-2">{[{ titre: 'Pouvoir', capacite: profil.pouvoir }, { titre: 'Super-pouvoir', capacite: profil.superPouvoir }].map(({ titre, capacite }) => <section key={titre} className="rounded-lg border border-current/20 p-3" aria-label={`${titre} de ${p.nom}`}>
            <h5 className="font-semibold">{titre} · {capacite.nom}</h5><p className="my-1 text-sm">{capacite.barres} barres de jauge · {capacite.duree === 'tour_complet' ? 'Un tour complet' : JSON.stringify(capacite.duree)}</p><p>{capacite.description}</p>
            <details className="mt-2 text-xs"><summary>Effets utilisés par le moteur</summary><pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(capacite.effets, null, 2)}</pre></details>
          </section>)}</div>
          <details className="mt-2 text-sm"><summary>Effet permanent</summary><p>{profil.descriptionPassif}</p>{profil.passif ? <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(profil.passif, null, 2)}</pre> : <p>Aucun bonus permanent.</p>}</details>
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
