import { readFile } from 'node:fs/promises';
import path from 'node:path';

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import {
  chargerStyleNation, chargerStyleRegion, commandeAsset, nomModele, nomTexture, validerAssetSpec,
  type AssetSpec,
} from '@/assets/index';
import { REGEX_CLE } from '@/schemas/index';
import { nomsAttendus } from '@/serveur/depot-modeles';

import { sessionCourante } from '../../session';
import { Bloc, Etat, Ligne } from '../../ui';

import { chargerCatalogueAssets, DOSSIER_SPECS } from '../donnees';
import { LIBELLES_PRIORITE, LIBELLES_TYPE, territoireDe, urlListe } from '../tri';

import { receptionAsset, LIBELLES_RECEPTION } from '@/serveur/reception-assets';
import { contratProduction } from '@/assets/production';
import { InspectionClient } from './inspection-client';
import { Revue } from './revue';

import { familleAsset, libelleAsset } from '../exploration';
import { promptProduction } from '../prompt-production';
import { PromptProduction } from './prompt';
import { Livraison } from './livraison';
import { AtelierExterne } from './atelier-externe';
import { promptsGemini } from '../prompts-gemini';
import { stockageSourcesDisponible, sourcesStockees } from '@/serveur/sources-assets-stockage';
import { jalonsProduction } from '../parcours-production';
import { candidatsExposes } from '../candidats';
import { cheminInspection } from './chemins-inspection';
import styles from './fiche.module.css';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Une paire libellé / valeur, la brique de toute la fiche. */
function Champ({ nom, children }: { nom: string; children: React.ReactNode }) {
  return (
    <Ligne>
      <span className="w-40 shrink-0 text-xs admin-secondaire">{nom}</span>
      <span className="min-w-0 flex-1 text-sm">{children}</span>
    </Ligne>
  );
}

/** Une liste fermée, affichée telle quelle : ce sont des clés, pas des phrases. */
function Cles({ valeurs }: { valeurs: readonly string[] }) {
  if (valeurs.length === 0) return <span className="admin-secondaire">aucune</span>;
  return <span className="font-mono text-xs [overflow-wrap:anywhere]">{valeurs.join(', ')}</span>;
}

/**
 * Lit le fichier versionné et dit s'il est encore celui que le canon produit,
 * avec la sérialisation exacte de `generer-specs-assets.ts` : deux espaces et un
 * saut de ligne final. Comparer autrement ferait passer pour périmé un fichier
 * que le script tient pour à jour.
 */
async function etatDuFichier(spec: AssetSpec): Promise<'conforme' | 'perime' | 'absent'> {
  try {
    const lu = await readFile(path.resolve(process.cwd(), DOSSIER_SPECS, `${spec.id}.json`), 'utf8');
    return lu === `${JSON.stringify(spec, null, 2)}\n` ? 'conforme' : 'perime';
  } catch {
    return 'absent';
  }
}

/**
 * La fiche d'une spécification : chaque champ du contrat, lisible sans ouvrir
 * le JSON, plus le verdict de `validerAssetSpec` et l'état du fichier versionné.
 * Le paramètre d'URL est l'identifiant de l'asset, celui qui nomme le fichier.
 */
export default async function FicheAsset({ params }: { params: Promise<{ cle: string }> }) {
  if (!await sessionCourante()) redirect('/admin/login');
  const { cle } = await params;
  if (!REGEX_CLE.test(cle)) notFound();

  const { specs, paysParCode, regionsParPays, codesPays } = chargerCatalogueAssets();
  const spec = specs.find((s) => s.id === cle);
  if (!spec) notFound();

  const reception = receptionAsset(spec), production = contratProduction(spec);
  const referenceSpec = specs.find((s) => s.id === production.reference);
  const referenceEtat = referenceSpec ? receptionAsset(referenceSpec) : null;
  const reference = referenceSpec && referenceEtat?.revision && referenceEtat.fichiers.includes(`${referenceSpec.id}_lod0.glb`)
    ? { id: referenceSpec.id, revision: referenceEtat.revision, approuvee: ['approuve', 'integre'].includes(referenceEtat.etat) } : null;
  const exposition = candidatsExposes();
  const candidat = exposition.get(spec.id);
  const baseCandidate = production.reference ? exposition.get(production.reference) : undefined;
  const referenceCandidate = baseCandidate ? { id: baseCandidate.id, revision: baseCandidate.revision, prefixe: baseCandidate.prefixe, approuvee: false } : null;
  const jalons = jalonsProduction(reception);
  const verdict = validerAssetSpec(spec);
  const fichier = await etatDuFichier(spec);
  const territoire = territoireDe(spec, codesPays);
  const pays = territoire.pays ? paysParCode.get(territoire.pays) : undefined;
  const region = territoire.pays && territoire.region
    ? regionsParPays.get(territoire.pays)?.get(territoire.region)
    : undefined;
  const styleNation = territoire.pays ? chargerStyleNation(territoire.pays) : null;
  const styleRegion = territoire.pays && region ? chargerStyleRegion(territoire.pays, region.code) : null;

  const stockageSources = stockageSourcesDisponible();
  let erreurSources = false;
  const sources = stockageSources ? await sourcesStockees(spec.id).catch(() => { erreurSources = true; return []; }) : [];
  const prompts = promptsGemini(spec);
  const famille = familleAsset(spec);
  const variantes = specs.filter(s => familleAsset(s) === famille);
  const requis = [...spec.verification.lodRequis.map(l => nomModele(spec, l)), ...spec.textures.filter(t => t.obligatoire).map(t => nomTexture(spec, t.canal))];
  return (
    <main className={styles.fiche}>
      <p className="mb-2 text-xs">
        <Link href="/admin/assets" className="underline underline-offset-4 admin-secondaire">← tous les assets</Link>
      </p>
      <h2 className={styles.titre}>{libelleAsset(famille)}</h2>
      <p className={styles.identifiant}><code>{spec.id}</code></p>
      <p className="mb-6 flex flex-wrap items-center gap-2 text-sm admin-secondaire">
        <Link href={urlListe({ type: spec.type })} className="underline-offset-4 hover:underline">{LIBELLES_TYPE[spec.type]}</Link>
        <Etat valeur={`priorité ${spec.priorite}`} />
        <span className="text-xs admin-secondaire">{LIBELLES_PRIORITE[spec.priorite]}</span>
        <Etat valeur={LIBELLES_RECEPTION[reception.etat]} />
      </p>

      <section className={styles.resume} aria-label="Situation et prochaine action">
        <h3>Votre prochaine étape</h3>
        <p>{jalons.enJeu ? 'Cette révision est validée et son essai en jeu est confirmé.' : jalons.artistique ? 'Essayez cette révision dans l’atelier, puis confirmez son intégration.' : jalons.technique ? 'Le contrôle technique est réussi. Inspectez le modèle et enregistrez votre revue.' : jalons.candidat ? 'Complétez ou corrigez les fichiers réceptionnés, puis contrôlez le nouveau lot.' : candidat ? 'Un candidat est disponible. Inspectez-le, puis réceptionnez son lot pour le contrôler.' : 'Copiez le prompt pour créer cet asset, puis rapportez les fichiers demandés.'}</p>
        <a className="admin-action admin-action-primaire" href={jalons.technique ? '#inspection' : jalons.candidat ? '#depot' : candidat ? '#candidat-expose' : '#production'}>{jalons.technique ? 'Inspecter et valider' : jalons.candidat ? 'Corriger le lot' : candidat ? 'Voir le candidat disponible' : 'Obtenir le prompt'}</a>
      </section>
      <nav className={styles.raccourcis} aria-label="Parcours de production">
        <a href="#production">1. Prompt</a><a href="#fichiers">2. Fichiers attendus</a><a href="#depot">3. Dépôt et contrôle</a><a href="#inspection">4. Inspection et revue</a><a href="#specifications">Spécifications détaillées</a>
      </nav>
      <ol className={styles.jalons} aria-label="État des étapes">
        <li><strong>Fichiers réceptionnés</strong><span>{jalons.candidat ? `${reception.fichiers.length} fichiers présents` : 'Aucun lot présent'}</span></li>
        <li><strong>Contrôle technique</strong><span>{jalons.technique ? 'Réussi' : jalons.candidat ? 'À corriger ou compléter' : 'En attente'}</span></li>
        <li><strong>Validation artistique</strong><span>{jalons.artistique ? 'Décision enregistrée' : 'À faire après le contrôle'}</span></li>
        <li><strong>Essai en jeu</strong><span>{jalons.enJeu ? 'Confirmé' : 'Non confirmé'}</span></li>
      </ol>
      {candidat ? <section id="candidat-expose" className="mb-8 rounded border border-current/20 p-4" aria-labelledby="titre-candidat-expose">
        <h3 id="titre-candidat-expose" className="text-lg font-semibold">Candidat disponible à inspecter</h3>
        <p className="my-2 text-sm">Cette version de production est consultable ici. Elle est distincte du lot réceptionné ci-dessous : aucune validation artistique, aucune intégration en jeu n’est déduite de sa présence.</p>
        <p className="mb-3 text-xs admin-secondaire">Révision candidate {candidat.revision.slice(0, 12)} · {candidat.fichiers.length} fichiers. Pour l’approuver, télécharger le lot puis le déposer dans « Déposer et contrôler » afin d’établir sa révision de réception.</p>
        <InspectionClient spec={spec} fichiers={candidat.fichiers} revision={candidat.revision} precedente={null} reference={referenceCandidate} prefixe={candidat.prefixe} libelleBanc="banc du candidat 3D" />
        <details><summary className="cursor-pointer font-semibold">Télécharger les GLB et les textures du candidat</summary><ul className="assets-fichiers mt-2">{candidat.fichiers.map(nom => <li key={nom}><a className="underline" href={cheminInspection(candidat.prefixe, nom, candidat.revision)} download={nom}>{nom}</a></li>)}</ul></details>
      </section> : null}
      <section id="production" className="scroll-mt-6">
        <h3 className="text-lg font-semibold mb-2">Préparer la production</h3>
        <div className="admin-actions">
          <a className="admin-action" href={`/admin/assets/export?cle=${spec.id}`}>Télécharger le manifeste JSON</a>
          <a className="admin-action" href={`/admin/assets/export?cle=${spec.id}&format=prompt`}>Télécharger le prompt texte</a>
        </div>
        <AtelierExterne id={spec.id} concept={prompts.concept} vues={prompts.vues} stockage={!!stockageSources} sources={sources} erreurSources={erreurSources} />
        <PromptProduction texte={promptProduction(spec, reception.fichiers)} />
      </section>
      {variantes.length > 1 ? <Bloc titre={`${libelleAsset(famille)} — base et déclinaisons`} aide="Une géométrie commune, des peintures distinctes. Chaque version conserve son propre état de réception."><div className="assets-variantes">{variantes.map(v => <Link key={v.id} href={`/admin/assets/${v.id}`} aria-current={v.id === spec.id ? 'page' : undefined}>{v.type === 'unite' ? 'Base partagée' : territoireDe(v, codesPays).pays ? paysParCode.get(territoireDe(v, codesPays).pays!)?.nomCourt ?? v.cle : v.cle}</Link>)}</div></Bloc> : null}
      <section id="fichiers"><Bloc titre={`Fichiers obligatoires — ${requis.filter(n => reception.fichiers.includes(n)).length} / ${requis.length} réceptionnés`} aide="Présent ne signifie pas conforme : le verdict technique est indiqué plus bas. Les variantes saisonnières restent facultatives."><ul className="assets-fichiers">{requis.map(n => <li key={n}><span className={reception.fichiers.includes(n) ? styles.present : styles.manquant}>{reception.fichiers.includes(n) ? 'Présent' : 'Manquant'}</span> <code>{n}</code></li>)}</ul></Bloc></section>
      <Bloc titre="Verdict et fichier" aide="Le validateur est celui du dépôt ; le fichier est celui de assets/specs/, s’il est sur ce disque.">
        <Champ nom="validerAssetSpec">
          <Etat valeur={verdict.ok ? 'valide' : `${verdict.erreurs.length} erreur(s)`} ok={verdict.ok} />
          {!verdict.ok ? (
            <ul className="mt-2 font-mono text-xs">
              {verdict.erreurs.map((e, i) => <li key={i}>{e.chemin || '(racine)'} — {e.message}</li>)}
            </ul>
          ) : null}
        </Champ>
        <Champ nom={`${DOSSIER_SPECS}/${spec.id}.json`}>
          {fichier === 'conforme' ? <Etat valeur="conforme au canon" ok /> : null}
          {fichier === 'perime' ? <Etat valeur="a dérivé du canon" ok={false} /> : null}
          {fichier === 'absent' ? <Etat valeur="absent de ce disque" /> : null}
        </Champ>
        <Champ nom="livraison">
          <Etat valeur={LIBELLES_RECEPTION[reception.etat]} />
          <span className="ml-2 text-xs admin-secondaire">{reception.fichiers.length} fichier(s) présent(s), {(reception.octets / 1048576).toFixed(2)} Mio. {reception.revision ? `Révision ${reception.revision.slice(0, 12)}.` : "Aucun lot à contrôler."}</span>
        </Champ>
      </Bloc>

      <section id="depot" className="scroll-mt-6"><Bloc titre="Commande et dépôt" aide="La fiche traduite en commande pour un générateur, et le dépôt du fichier qu’il rend. Même contrôle complet que « npm run controler:asset -- --spec assets/specs/<id>.json --lot <dossier> ».">
        <Livraison id={spec.id} commande={commandeAsset(spec)} attendus={nomsAttendus(spec)} local={process.env.NODE_ENV !== 'production'} />
      </Bloc></section>
      <section id="inspection" className="mb-8 scroll-mt-6">
        <h3 className="text-lg font-semibold mb-2">Inspection et revue de la révision réceptionnée</h3>
        {reception.motifs.length ? <ul className="mb-3 max-h-56 overflow-auto text-xs">{reception.motifs.map((m, i) => <li key={i}>{m}</li>)}</ul> : null}
        {reception.revue ? <p className="text-xs">Revue du {reception.revue.date} : {reception.revue.note}</p> : null}
        <InspectionClient spec={spec} fichiers={reception.fichiers} revision={reception.revision} precedente={reception.precedente} reference={reference} />
        <Revue id={spec.id} revision={reception.revision} conforme={['conforme', 'approuve', 'integre'].includes(reception.etat)} approuve={!!reception.revue} local={process.env.NODE_ENV !== 'production'} />
      </section>
      <details id="specifications" className={styles.specifications}><summary>Spécifications détaillées — géométrie, textures et nommage</summary>
      <Bloc titre="Contrat de production" aide="Consignes communes à la commande et aux contrôles. Une référence candidate attend encore un jugement humain.">
        {reference ? <Champ nom="repère visuel"><Link className="underline" href={`/admin/assets/${reference.id}`}>{reference.id}</Link> — {reference.approuvee ? 'approuvé visuellement' : 'candidat non approuvé'}</Champ> : <Champ nom="repère visuel">Aucune référence livrée pour cette famille.</Champ>}
        <Champ nom="raccords">{production.raccord}</Champ>
        {production.assemblage.map((n) => <Champ key={n.nom} nom={n.nom}>Parent : {n.parent ?? 'scène'} ; pivot local : {n.pivot?.join(', ') ?? 'selon la géométrie'} — {n.role}</Champ>)}
        <details className="p-3 text-xs"><summary>Consignes UV, matières et gestes</summary><ul>{production.consignes.map((c) => <li key={c} className="mt-2">{c}</li>)}</ul>{spec.animations.map((a) => <p key={a.nom} className="mt-2">{a.nom} — {production.gestes[a.nom]}</p>)}</details>
      </Bloc>


      <Bloc titre="Identité">
        <Champ nom="type"><span className="font-mono text-xs [overflow-wrap:anywhere]">{spec.type}</span> · {LIBELLES_TYPE[spec.type]}</Champ>
        <Champ nom="clé canon"><span className="font-mono text-xs [overflow-wrap:anywhere]">{spec.cle}</span></Champ>
        <Champ nom="territoire">
          {pays ? `${pays.nom} (${pays.code})` : <span className="admin-secondaire">partagé — aucune nation</span>}
          {region ? ` · ${region.nom}` : territoire.region ? ` · ${territoire.region}` : ''}
        </Champ>
        <Champ nom="priorité">{spec.priorite} — {LIBELLES_PRIORITE[spec.priorite]}</Champ>
      </Bloc>

      <Bloc titre="Description" aide="L’anglais est ce que le générateur lit ; le français fait foi en cas de désaccord.">
        <Champ nom="français"><span className="whitespace-pre-wrap">{spec.description.fr}</span></Champ>
        <Champ nom="anglais"><span className="whitespace-pre-wrap admin-secondaire">{spec.description.en}</span></Champ>
      </Bloc>

      <Bloc titre="Style">
        <Champ nom="référence">{spec.style.reference}</Champ>
        <Champ nom="devise">{spec.style.devise}</Champ>
        <Champ nom="matières">{spec.style.matieres}</Champ>
        <Champ nom="mots-clés (en)"><Cles valeurs={spec.style.motsCles} /></Champ>
        <Champ nom="à éviter (en)"><Cles valeurs={spec.style.aEviter} /></Champ>
      </Bloc>

      {styleNation ? (
        <Bloc titre={`Style national — ${styleNation.nom}`} aide="content/styles/<code>.json : d’où viennent les matières, les ornements et le gabarit du kit.">
          <Champ nom="ligne directrice">{styleNation.ligneDirectrice.fr}</Champ>
          <Champ nom="palette">
            <Cles valeurs={[styleNation.palette.main, styleNation.palette.dark, styleNation.palette.light, ...styleNation.palette.accents]} />
          </Champ>
          <Champ nom="matières"><Cles valeurs={styleNation.matieres} /></Champ>
          <Champ nom="finitions"><Cles valeurs={styleNation.finitions} /></Champ>
          <Champ nom="ornements"><Cles valeurs={styleNation.ornements} /></Champ>
          <Champ nom="motif daltonien"><span className="font-mono text-xs [overflow-wrap:anywhere]">{styleNation.motifDaltonien}</span></Champ>
          <Champ nom="décalcomanies">
            {styleNation.decalcomanies.length === 0 ? <span className="admin-secondaire">aucune</span> : (
              <ul className="text-xs">
                {styleNation.decalcomanies.map((d, i) => (
                  <li key={i}><span className="font-mono">{d.motif}</span> · {d.placement} · {d.couleur} — {d.note}</li>
                ))}
              </ul>
            )}
          </Champ>
        </Bloc>
      ) : null}

      {styleRegion ? (
        <Bloc titre={`Style régional — ${styleRegion.nom}`} aide="content/styles/regions/<pays>/<region>.json : toits, murs et végétation du bâti et du décor.">
          <Champ nom="ligne directrice">{styleRegion.ligneDirectrice.fr}</Champ>
          <Champ nom="toits"><Cles valeurs={[styleRegion.toits.forme, styleRegion.toits.matiere, styleRegion.toits.couleur]} /></Champ>
          <Champ nom="murs"><Cles valeurs={[styleRegion.murs.matiere, styleRegion.murs.finition, styleRegion.murs.couleur]} /></Champ>
          <Champ nom="végétation">{styleRegion.vegetation.dominante}, {styleRegion.vegetation.secondaire} · <span className="font-mono text-xs [overflow-wrap:anywhere]">{styleRegion.vegetation.couleur}</span></Champ>
          <Champ nom="éléments de décor"><Cles valeurs={styleRegion.elementsDecor} /></Champ>
        </Bloc>
      ) : null}

      <Bloc titre="Échelle et pivot" aide="Une case vaut un mètre de scène. Les axes sont ceux de glTF : x latéral, y vertical, z vers l’avant.">
        <Champ nom="case en mètres">{spec.echelle.caseEnMetres}</Champ>
        {(['x', 'y', 'z'] as const).map((axe) => (
          <Champ key={axe} nom={`dimension ${axe}`}>
            {spec.echelle[axe].cible} m ± {spec.echelle[axe].tolerance}
          </Champ>
        ))}
        <Champ nom="pivot"><Cles valeurs={[spec.pivot.origine, `avant ${spec.pivot.avant}`, `haut ${spec.pivot.haut}`]} /></Champ>
        <Champ nom="posé au sol">{spec.pivot.poseAuSol ? 'oui' : 'non — modélisé à sa hauteur de vol'}</Champ>
      </Bloc>

      <Bloc titre="Budget" aide="Triangles par niveau de détail, et nombre de matériaux admis.">
        <Champ nom="Modèle LOD0">{spec.budget.lod0} triangles maximum</Champ>
        <Champ nom="matériaux max">{spec.budget.materiauxMax}</Champ>
        <Champ nom="lod requis"><Cles valeurs={spec.verification.lodRequis.map(String)} /></Champ>
        <Champ nom="modèles attendus"><Cles valeurs={spec.verification.lodRequis.map((lod) => nomModele(spec, lod))} /></Champ>
      </Bloc>

      <Bloc titre={`Textures — ${spec.textures.length} carte(s)`} aide="Le masque binaire suit les zones de la description : peinture d’équipe en gris neutre dans l’albédo. PNG externes référencés par le LOD0 ; rugosité dans G, métal dans B.">
        {spec.textures.map((t) => (
          <Ligne key={t.canal}>
            <span className="w-40 font-mono text-xs">{t.canal}</span>
            <span className="w-24 text-xs">{t.resolution} px</span>
            <span className="w-12 font-mono text-xs">{t.format}</span>
            <Etat valeur={t.obligatoire ? 'obligatoire' : 'facultative'} ok={t.obligatoire ? true : undefined} />
            <span className="basis-full text-xs admin-secondaire">{t.note}</span>
            <span className="basis-full font-mono text-xs admin-secondaire">{nomTexture(spec, t.canal)}</span>
          </Ligne>
        ))}
      </Bloc>

      <Bloc titre="Variantes">
        <Champ nom="saisons"><Cles valeurs={spec.variantes.saisons} /></Champ>
        <Champ nom="biomes"><Cles valeurs={spec.variantes.biomes} /></Champ>
        <Champ nom="nations"><Cles valeurs={spec.variantes.nations} /></Champ>
      </Bloc>

      <Bloc titre={`Animations — ${spec.animations.length} clip(s)`}>
        {spec.animations.length === 0 ? <Champ nom="clips"><span className="admin-secondaire">aucun : l’asset est immobile</span></Champ> : spec.animations.map((a) => (
          <Ligne key={a.nom}>
            <span className="w-40 font-mono text-xs">{a.nom}</span>
            <span className="w-24 text-xs">{a.dureeMs} ms</span>
            <span className="w-24 text-xs">{a.boucle ? 'en boucle' : 'une fois'}</span>
            <Etat valeur={a.obligatoire ? 'obligatoire' : 'souhaitable'} ok={a.obligatoire ? true : undefined} />
          </Ligne>
        ))}
      </Bloc>

      <Bloc titre="Format et nommage" aide="Le rendu cherche les nœuds et les matériaux par leur nom, jamais par leur index.">
        <Champ nom="conteneur"><Cles valeurs={[spec.format.conteneur, `glTF ${spec.format.versionGltf}`, `haut ${spec.format.axeHaut}`, spec.format.unite, spec.format.materiaux]} /></Champ>
        <Champ nom="nœud racine"><span className="font-mono text-xs [overflow-wrap:anywhere]">{spec.format.noeudRacine}</span></Champ>
        <Champ nom="nœuds imposés"><Cles valeurs={spec.format.noeuds} /></Champ>
        <Champ nom="matériaux imposés"><Cles valeurs={spec.format.materiauxAttendus} /></Champ>
        <Champ nom="gabarit modèle"><span className="font-mono text-xs [overflow-wrap:anywhere]">{spec.nommage.modele}</span></Champ>
        <Champ nom="gabarit texture"><span className="font-mono text-xs [overflow-wrap:anywhere]">{spec.nommage.texture}</span></Champ>
        <Champ nom="exemples"><Cles valeurs={spec.nommage.exemples} /></Champ>
      </Bloc>

      <Bloc titre="Interdits et vérification" aide="Les quatre premiers interdits sont obligatoires sur toute spécification.">
        <Champ nom="interdits"><Cles valeurs={spec.interdits} /></Champ>
        <Champ nom="contrôles"><Cles valeurs={spec.verification.controles} /></Champ>
        <Champ nom="tolérance AABB">{spec.verification.toleranceAabb}</Champ>
      </Bloc>

      <details className="mb-8 text-xs">
        <summary className="cursor-pointer admin-secondaire">Le JSON tel qu’il part au générateur</summary>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-current/10 p-4 font-mono">{JSON.stringify(spec, null, 2)}</pre>
      </details>
      </details>
    </main>
  );
}
