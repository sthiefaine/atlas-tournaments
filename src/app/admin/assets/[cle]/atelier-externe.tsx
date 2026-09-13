'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PromptProduction } from './prompt';
type Source = {revision:string;octets:number;date?:string};
export function AtelierExterne({id,concept,stockage,sources:initiales,erreurSources=false}:{id:string;concept:string;vues:string;stockage:boolean;sources:Source[];erreurSources?:boolean}) {
  const router = useRouter();
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
      router.refresh();
      setMessage('GLB reçu. Copiez maintenant la demande d’intégration ci-dessous et envoyez-la à votre agent. Le modèle en jeu sera remplacé après préparation.');
    }catch(e){setMessage(e instanceof Error?e.message:'Envoi impossible');}finally{setEnvoi(false);}
  }
  return <section id="gemini-tripo" className="mb-8 space-y-4">
    {erreurSources ? <p role="alert">Le stockage des sources ne répond pas. Les versions existantes ne peuvent pas être listées actuellement.</p> : null}
    <div className="rounded border border-current/30 p-4 space-y-3"><h4 className="font-semibold">Choisir le nouveau modèle 3D</h4>
      <p>Sélectionnez votre fichier Tripo (.glb, 150 Mio maximum). Il sera conservé pour préparer le remplacement en jeu.</p>
      {stockage ? <label className="block">Nouveau fichier GLB<input className="block mt-2" type="file" accept=".glb" disabled={envoi} onChange={e=>{void deposer(e.target.files?.[0]);e.target.value='';}} /></label> : <p role="note"><strong>Stockage à connecter sur ce serveur.</strong> Le dépôt sera disponible après configuration du volume persistant. En attendant, transmettez le GLB à votre agent ; ne le confondez pas avec le lot final.</p>}
      <p role="status" aria-live="polite">{message}</p>
      {sources.length ? <details><summary>Fichiers déjà envoyés ({sources.length})</summary><ul className="space-y-2">{sources.map(s=><li key={s.revision}><a className="underline" href={`/api/admin/assets/${id}/sources?revision=${s.revision}`}>Télécharger la source {s.revision.slice(0,12)}</a> · {(s.octets/1024/1024).toFixed(1)} Mio{s.date?` · ${new Date(s.date).toLocaleDateString('fr-FR')}`:''}</li>)}</ul></details> : null}
    </div>
    <section aria-label="Créer avec Gemini et Tripo">
      <PromptProduction texte={concept} libelle="Copier le prompt Gemini" />
      <a className="underline" href="https://studio.tripo3d.ai/" target="_blank" rel="noreferrer">Ouvrir Tripo ↗</a>
    </section>
  </section>;
}
