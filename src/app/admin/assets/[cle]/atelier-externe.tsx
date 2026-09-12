'use client';
import { useState } from 'react';
import { PromptProduction } from './prompt';
type Source = {revision:string;octets:number;date?:string};
export function AtelierExterne({id,concept,vues,stockage,sources:initiales,erreurSources=false}:{id:string;concept:string;vues:string;stockage:boolean;sources:Source[];erreurSources?:boolean}) {
  const [sources,setSources]=useState(initiales),[message,setMessage]=useState(''),[envoi,setEnvoi]=useState(false);
  async function deposer(fichier:File|undefined) {
    if(!fichier)return;
    if(!fichier.name.toLowerCase().endsWith('.glb')||fichier.size>150*1024*1024){setMessage('Choisissez un fichier GLB de 150 Mio maximum.');return;}
    setEnvoi(true);setMessage('Envoi de la source détaillée…');
    try {
      const r=await fetch(`/api/admin/assets/${id}/sources`,{method:'POST',headers:{'Content-Type':'model/gltf-binary'},body:fichier});
      const resultat=await r.json();
      if(!r.ok)throw new Error(resultat.detail??resultat.error??'Dépôt impossible');
      setSources(s=>[resultat.source,...s.filter(x=>x.revision!==resultat.source.revision)]);
      setMessage('Source conservée. Elle attend sa préparation pour le jeu ; aucun modèle actif n’a été remplacé.');
    }catch(e){setMessage(e instanceof Error?e.message:'Envoi impossible');}finally{setEnvoi(false);}
  }
  return <section id="gemini-tripo" className="mb-8 space-y-4">
    {erreurSources ? <p role="alert">Le stockage des sources ne répond pas. Les versions existantes ne peuvent pas être listées actuellement.</p> : null}
    <h3 className="text-xl font-semibold">Gemini → Tripo → jeu</h3>
    <p>Les prompts ci-dessous reprennent cette fiche et sa variante. Conservez le modèle détaillé ; son optimisation intervient après le dépôt.</p>
    <details><summary>1. Gemini — créer le concept</summary><PromptProduction texte={concept} libelle="Copier le prompt concept Gemini" /></details>
    <details><summary>2. Gemini — obtenir les vues multiples</summary><p>Joignez le concept retenu. Découpez la planche en vues séparées pour Tripo et écartez les vues incohérentes.</p><PromptProduction texte={vues} libelle="Copier le prompt multivue Gemini" /></details>
    <p><strong>3. Tripo.</strong> Importez les références, générez puis exportez un GLB avec ses textures intégrées. <a className="underline" href="https://studio.tripo3d.ai/" target="_blank" rel="noreferrer">Ouvrir Tripo ↗</a></p>
    <div className="rounded border border-current/30 p-4 space-y-3"><h4 className="font-semibold">4. Déposer le GLB source détaillé</h4>
      <p>150 Mio maximum. Le nom du fichier Tripo est libre. Ce dépôt conserve des versions privées et ne modifie pas le modèle en jeu.</p>
      {stockage ? <label className="block">Choisir le GLB source<input className="block mt-2" type="file" accept=".glb" disabled={envoi} onChange={e=>{void deposer(e.target.files?.[0]);e.target.value='';}} /></label> : <p role="note"><strong>Stockage à connecter sur ce serveur.</strong> Le dépôt sera disponible après configuration du volume persistant. En attendant, transmettez le GLB à votre agent ; ne le confondez pas avec le lot final.</p>}
      <p role="status" aria-live="polite">{message}</p>
      {sources.length ? <ul className="space-y-2">{sources.map(s=><li key={s.revision}><a className="underline" href={`/api/admin/assets/${id}/sources?revision=${s.revision}`}>Télécharger la source {s.revision.slice(0,12)}</a> · {(s.octets/1024/1024).toFixed(1)} Mio{s.date?` · ${new Date(s.date).toLocaleDateString('fr-FR')}`:''}</li>)}</ul> : <p>Aucune source déposée.</p>}
    </div>
    <p><strong>5. Préparer et intégrer.</strong> Transmettez le GLB téléchargé avec le prompt Codex ci-dessous. Les LOD, dimensions, matériaux, masque d’équipe et animations seront contrôlés avant réception du lot final. Pas de conversion ni de publication automatique.</p>
  </section>;
}
