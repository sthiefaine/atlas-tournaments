import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PRIORITES, TYPES_ASSET } from '@/assets/index';
import { receptionsAssets, LIBELLES_RECEPTION } from '@/serveur/reception-assets';
import { sessionCourante } from '../session';
import { chargerCatalogueAssets } from './donnees';
import { filtrerSpecs, LIBELLES_TYPE, lireFiltres, territoireDe, type ParametresBruts } from './tri';
import { correspondRecherche, familleAsset, libelleAsset, paginer, regrouperAssets } from './exploration';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function Assets({ searchParams }: { searchParams: Promise<ParametresBruts> }) {
  if (!await sessionCourante()) redirect('/admin/login');
  const params = await searchParams;
  const { specs, paysParCode, regionsParPays, codesPays } = chargerCatalogueAssets();
  const filtres = lireFiltres(params, codesPays);
  const receptions = receptionsAssets(specs);
  const etat = typeof params.etat === 'string' && (params.etat === 'manquants' || params.etat in LIBELLES_RECEPTION) ? params.etat : '';
  const groupes = regrouperAssets(specs);
  const famille = typeof params.famille === 'string' && groupes.some(g => g.cle === params.famille) ? params.famille : '';
  const liste = params.vue === 'liste' || famille !== '';
  const territoire = (s: (typeof specs)[number]) => {
    const t = territoireDe(s, codesPays);
    return [s.description.fr.includes('Unité exclusive') ? 'Faction inconnue' : t.pays ? paysParCode.get(t.pays)?.nomCourt : 'Partagé', t.pays && t.region ? regionsParPays.get(t.pays)?.get(t.region)?.nom ?? t.region : ''].filter(Boolean).join(' · ');
  };
  const visibles = filtrerSpecs(specs, { ...filtres, recherche: '' }, codesPays).filter(s => {
    const reception = receptions.get(s.id)!;
    return (!famille || familleAsset(s) === famille) && correspondRecherche(s, filtres.recherche, territoire(s)) && (!etat || (etat === 'manquants' ? ['a_produire', 'incomplet'].includes(reception.etat) : reception.etat === etat));
  });
  const url = (modifications: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [cle, valeur] of Object.entries({ type: filtres.type ?? '', priorite: filtres.priorite ? String(filtres.priorite) : '', pays: filtres.pays ?? '', q: filtres.recherche, etat, famille, vue: liste ? 'liste' : '', ...modifications })) if (valeur) p.set(cle, valeur);
    return `/admin/assets?${p}`;
  };
  const groupesVisibles = regrouperAssets(visibles);
  const pagination = paginer(liste ? visibles.map(s => ({ cle: s.id, specs: [s], libelle: libelleAsset(s.id) })) : groupesVisibles, params.page);
  const manquants = [...receptions.values()].filter(r => ['a_produire', 'incomplet'].includes(r.etat)).length;
  return <main>
    <h2 className="admin-titre">Bibliothèque d’assets</h2>
    <p className="admin-intro">{specs.length} assets, regroupés par modèle et déclinaisons. Ouvrez une famille, choisissez sa version, puis copiez son prompt de production.</p>
    <div className="admin-actions"><Link className="admin-action" href="/admin/assets?q=meridien">Arsenal de la faction inconnue</Link><Link className="admin-action admin-action-primaire" href="/admin/assets/chantier">Quoi produire maintenant</Link><Link className="admin-action" href={url({ etat: 'manquants', page: '' })}>À compléter · {manquants}</Link></div>
    <form method="get" action="/admin/assets" className="assets-filtres">
      <label>Rechercher<input type="search" name="q" defaultValue={filtres.recherche} placeholder="Artillerie, montagne, France…" /></label>
      <label>Catégorie<select name="type" defaultValue={filtres.type ?? ''}><option value="">Toutes</option>{TYPES_ASSET.map(t => <option key={t} value={t}>{LIBELLES_TYPE[t]}</option>)}</select></label>
      <label>Territoire<select name="pays" defaultValue={filtres.pays ?? ''}><option value="">Tous</option><option value="partage">Partagé</option>{[...paysParCode.values()].map(p => <option key={p.code} value={p.code}>{p.nomCourt}</option>)}</select></label>
      <label>Priorité<select name="priorite" defaultValue={filtres.priorite ?? ''}><option value="">Toutes</option>{PRIORITES.map(p => <option key={p} value={p}>Priorité {p}</option>)}</select></label>
      <label>État de réception<select name="etat" defaultValue={etat}><option value="">Tous</option><option value="manquants">À compléter</option>{Object.entries(LIBELLES_RECEPTION).map(([cle, nom]) => <option key={cle} value={cle}>{nom}</option>)}</select></label>
      {famille ? <input type="hidden" name="famille" value={famille} /> : null}<input type="hidden" name="vue" value={liste ? 'liste' : ''} />
      <button type="submit" className="admin-action admin-action-primaire self-end">Rechercher</button><Link className="admin-action self-end" href="/admin/assets">Réinitialiser</Link>
    </form>
    <div className="assets-etats" aria-label="Affichage"><Link href={url({ vue: '', famille: '' })} aria-current={!liste ? 'page' : undefined}>Familles</Link><Link href={url({ vue: 'liste' })} aria-current={liste ? 'page' : undefined}>Tous les fichiers d’asset</Link></div>
    <h3 className="text-lg font-semibold">{famille ? `${libelleAsset(famille)} — ` : ''}{visibles.length} résultat(s){!liste ? ` dans ${groupesVisibles.length} familles` : ''}</h3>
    {visibles.length === 0 ? <p className="admin-intro">Aucun asset ne correspond. Retirez un filtre ou essayez un autre terme.</p> : null}
    <div className="assets-grille">{pagination.elements.map(g => {
      const presents = g.specs.filter(s => receptions.get(s.id)!.etat !== 'a_produire').length;
      const approuves = g.specs.filter(s => ['approuve', 'integre'].includes(receptions.get(s.id)!.etat)).length;
      const unique = liste || g.specs.length === 1;
      const s = g.specs[0]!;
      return <Link key={g.cle} className="asset-carte" href={unique ? `/admin/assets/${s.id}` : url({ famille: g.cle, vue: 'liste', page: '' })}>
        <p>{LIBELLES_TYPE[s.type]}{!unique ? ' et déclinaisons' : ''}</p><h3 className="capitalize">{g.libelle}</h3>
        {unique ? <><code>{s.id}</code><p>{territoire(s)} · priorité {s.priorite}</p><span className="asset-etat">{LIBELLES_RECEPTION[receptions.get(s.id)!.etat]} →</span></> : <><p>{g.specs.length} versions · {presents} présentes · {approuves} approuvées</p><progress value={presents} max={g.specs.length} aria-label={`${presents} versions présentes sur ${g.specs.length}`} /><span className="asset-etat">Voir les déclinaisons →</span></>}
      </Link>;
    })}</div>
    <nav className="assets-pagination" aria-label="Pages d’assets">{pagination.page > 1 ? <Link className="admin-action" href={url({ page: String(pagination.page - 1) })}>← Précédente</Link> : <span />}<span>Page {pagination.page} sur {pagination.total}</span>{pagination.page < pagination.total ? <Link className="admin-action" href={url({ page: String(pagination.page + 1) })}>Suivante →</Link> : <span />}</nav>
  </main>;
}
