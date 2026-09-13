import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sessionCourante } from '../../session';
import { chargerCatalogueAssets } from '../donnees';
import { LIBELLES_TYPE } from '../tri';
import { TYPES_ASSET } from '@/assets/spec';
export const dynamic = 'force-dynamic';
export default async function CreationAssets() {
  if (!await sessionCourante()) redirect('/admin/login');
  const { specs } = chargerCatalogueAssets();
  return <main><h2 className="admin-titre">Créer avec Gemini et Tripo</h2>
    <p className="admin-intro">Choisissez une catégorie, puis le modèle et sa variante nationale. Chaque fiche prépare les prompts avec le style et les proportions du catalogue.</p>
    <ol className="list-decimal pl-6 space-y-3 mb-6"><li><strong>Gemini — dessiner.</strong> Copiez le prompt concept de la fiche. Retenez une image, puis utilisez le prompt multivue si nécessaire.</li><li><strong>Tripo — modeler.</strong> Importez votre référence, générez le modèle détaillé et exportez un GLB avec ses textures intégrées.</li><li><strong>Déposer la source.</strong> Envoyez le GLB brut sur la fiche, même s’il dépasse le budget du jeu. Il reste une source de travail privée.</li><li><strong>Préparer pour le jeu.</strong> Téléchargez la source et transmettez-la avec le prompt Codex : préparation du LOD0 unique, textures, masque d’équipe, puis contrôle du lot final. Cette étape n’est pas automatique.</li></ol>
    <p className="admin-intro">Les variantes régionales sont suspendues. <Link href="/admin/assets/batiment_ville_fr">Commencer la ville française avec Gemini →</Link></p>
    <div className="assets-grille">{TYPES_ASSET.map(type => { const n = specs.filter(s => s.type === type).length; return n ? <Link className="asset-carte" href={`/admin/assets?type=${type}`} key={type}><h3>{LIBELLES_TYPE[type]}</h3><p>{n} fiches et variantes</p><span className="asset-etat">Choisir un modèle →</span></Link> : null; })}</div>
    <p className="admin-intro">Les kits nationaux réutilisent leur géométrie de base. Pour les terrains, Gemini prépare une matière ; Tripo n’est pas nécessaire pour une simple texture de sol. Les comptes Gemini et Tripo sont utilisés manuellement, sans clé API ni achat déclenché par cet atelier.</p>
  </main>;
}
