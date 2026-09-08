import Link from 'next/link';
import { redirect } from 'next/navigation';

import { bilanPriorites, bilanSpecs, PRIORITES, TYPES_ASSET } from '@/assets/index';

import { sessionCourante } from '../session';
import { Bloc, Etat, Ligne, Vide } from '../ui';

import { chargerCatalogueAssets, DOSSIER_SPECS, lireDossierSpecs } from './donnees';
import {
  compterParPays, comparerAuDossier, filtrerSpecs, LIBELLES_PRIORITE, LIBELLES_TYPE, lireFiltres,
  STATUT_LIVRAISON, territoireDe, urlListe, type ParametresBruts,
} from './tri';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Tous les assets commandés, lus depuis le canon et jamais depuis la base.
 *
 * La liste est celle que `scripts/generer-specs-assets.ts` écrit dans
 * `assets/specs/` ; la page la compare au dossier quand il est là, et le dit
 * quand il ne l'est pas. Aucun statut « livré » n'est affiché parce qu'aucun
 * asset ne l'est : la colonne existe pour qu'on voie le jour où ça change.
 */
export default async function Assets({ searchParams }: { searchParams: Promise<ParametresBruts> }) {
  if (!await sessionCourante()) redirect('/admin/login');
  const params = await searchParams;

  const { specs, paysParCode, regionsParPays, codesPays } = chargerCatalogueAssets();
  const filtres = lireFiltres(params, codesPays);
  const visibles = filtrerSpecs(specs, filtres, codesPays);
  const parType = bilanSpecs(specs);
  const parPriorite = bilanPriorites(specs);
  const parPays = compterParPays(specs, codesPays);
  const dossier = lireDossierSpecs();
  const ecart = dossier ? comparerAuDossier(specs.map((s) => s.id), dossier) : null;
  const filtreActif = filtres.type !== null || filtres.priorite !== null || filtres.pays !== null || filtres.recherche !== '';

  return (
    <main>
      <p className="mb-4 text-sm">
        <Link href="/admin/assets/chantier" className="underline underline-offset-4">
          Le chantier — quoi produire maintenant, en quatre étapes
        </Link>
        <span className="ml-2 text-xs opacity-60">
          Cette page dit ce qui existe ; celle-là dit quoi faire, et ne propose jamais un kit dont la géométrie de base manque.
        </span>
      </p>

      <p className="mb-6 text-sm opacity-70">
        <strong>{specs.length} spécifications</strong> composées depuis le canon ·
        {' '}{parPriorite[1]} en priorité 1, {parPriorite[2]} en priorité 2, {parPriorite[3]} en priorité 3 ·
        {' '}<strong>aucune livrée</strong> : tout ce que le jeu affiche est un placeholder.
      </p>

      <p className="mb-6 text-xs opacity-60">
        {dossier === null ? (
          <>Le dossier <code>{DOSSIER_SPECS}/</code> n’est pas sur ce disque : seul le canon fait foi ici.</>
        ) : ecart && ecart.manquants.length === 0 && ecart.enTrop.length === 0 ? (
          <><code>{DOSSIER_SPECS}/</code> compte {dossier.filter((f) => f.endsWith('.json')).length} fichiers : le dossier et le canon se correspondent un pour un.</>
        ) : (
          <>
            <code>{DOSSIER_SPECS}/</code> a dérivé du canon : {ecart?.manquants.length ?? 0} fichier(s) manquant(s),
            {' '}{ecart?.enTrop.length ?? 0} en trop. Relancer <code>npx tsx scripts/generer-specs-assets.ts</code>.
            {ecart && [...ecart.manquants, ...ecart.enTrop].slice(0, 8).map((f) => (
              <span key={f} className="ml-2 font-mono">{f}</span>
            ))}
          </>
        )}
      </p>

      <Bloc titre="Par famille" aide="Les sept familles de doc/11 §3.1. « Effet » est réservé : rien n’est encore commandé.">
        {TYPES_ASSET.map((t) => (
          <Ligne key={t}>
            <Link href={urlListe({ type: t })} className="w-44 font-mono text-xs underline-offset-4 hover:underline">{t}</Link>
            <span className="w-48">{LIBELLES_TYPE[t]}</span>
            <span className="ml-auto text-sm">{parType[t]}</span>
          </Ligne>
        ))}
      </Bloc>

      <Bloc titre="Par priorité de production" aide="Le compte que tests/assets/specs.test.ts vérifie : la somme fait le total.">
        {PRIORITES.map((p) => (
          <Ligne key={p}>
            <Link href={urlListe({ priorite: p })} className="w-44 font-mono text-xs underline-offset-4 hover:underline">priorité {p}</Link>
            <span>{LIBELLES_PRIORITE[p]}</span>
            <span className="ml-auto text-sm">{parPriorite[p]}</span>
          </Ligne>
        ))}
      </Bloc>

      <Bloc titre="Par nation" aide="Ce qui n’appartient à aucune nation — géométries de base, terrains, rochers, bustes — est « partagé ».">
        <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 py-3 text-xs">
          <Link href={urlListe({ pays: 'partage' })} className="underline-offset-4 hover:underline">
            partagé <span className="opacity-60">{parPays.get('partage') ?? 0}</span>
          </Link>
          {[...paysParCode.values()].map((p) => (
            <Link key={p.code} href={urlListe({ pays: p.code })} className="underline-offset-4 hover:underline">
              <span className="font-mono">{p.code}</span> {p.nomCourt} <span className="opacity-60">{parPays.get(p.code) ?? 0}</span>
            </Link>
          ))}
        </div>
      </Bloc>

      <form method="get" action="/admin/assets" className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <select name="type" defaultValue={filtres.type ?? ''} className="rounded border border-current/20 bg-transparent px-2 py-1">
          <option value="">toutes les familles</option>
          {TYPES_ASSET.map((t) => <option key={t} value={t}>{LIBELLES_TYPE[t]}</option>)}
        </select>
        <select name="priorite" defaultValue={filtres.priorite ?? ''} className="rounded border border-current/20 bg-transparent px-2 py-1">
          <option value="">toutes les priorités</option>
          {PRIORITES.map((p) => <option key={p} value={p}>priorité {p}</option>)}
        </select>
        <select name="pays" defaultValue={filtres.pays ?? ''} className="rounded border border-current/20 bg-transparent px-2 py-1">
          <option value="">toutes les nations</option>
          <option value="partage">partagé</option>
          {[...paysParCode.values()].map((p) => <option key={p.code} value={p.code}>{p.nomCourt}</option>)}
        </select>
        <input
          type="search"
          name="q"
          defaultValue={filtres.recherche}
          placeholder="identifiant contient…"
          className="rounded border border-current/20 bg-transparent px-2 py-1 font-mono"
        />
        <button type="submit" className="rounded-md border border-current/30 px-3 py-1 font-medium hover:bg-current/5">Filtrer</button>
        {filtreActif ? <Link href="/admin/assets" className="underline underline-offset-4 opacity-70">tout afficher</Link> : null}
      </form>

      <Bloc
        titre={filtreActif ? `${visibles.length} spécification(s) sur ${specs.length}` : `Les ${specs.length} spécifications`}
        aide="Un identifiant est toujours <type>_<clé> ; il nomme le fichier de spécification et tous les fichiers livrés."
      >
        {visibles.length === 0 ? <Vide texte="Aucune spécification ne répond à ces filtres." /> : visibles.map((s) => {
          const territoire = territoireDe(s, codesPays);
          const pays = territoire.pays ? paysParCode.get(territoire.pays) : undefined;
          const region = territoire.pays && territoire.region
            ? regionsParPays.get(territoire.pays)?.get(territoire.region)
            : undefined;
          return (
            <Ligne key={s.id}>
              <Link href={`/admin/assets/${s.id}`} className="w-72 font-mono text-xs underline-offset-4 hover:underline">{s.id}</Link>
              <span className="w-36 text-xs opacity-70">{LIBELLES_TYPE[s.type]}</span>
              <Etat valeur={`priorité ${s.priorite}`} />
              <span className="w-52 text-xs">
                {pays ? pays.nomCourt : <span className="opacity-50">partagé</span>}
                {region ? ` · ${region.nom}` : territoire.region ? ` · ${territoire.region}` : ''}
              </span>
              <span className="text-xs opacity-50">{s.textures.length} textures · {s.animations.length} clips</span>
              <span className="ml-auto"><Etat valeur={STATUT_LIVRAISON} /></span>
            </Ligne>
          );
        })}
      </Bloc>
    </main>
  );
}
