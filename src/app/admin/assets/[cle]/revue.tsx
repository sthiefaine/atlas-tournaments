'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function Revue({ id, revision, conforme, approuve, local }: { id: string; revision: string | null; conforme: boolean; approuve: boolean; local: boolean }) {
  const router = useRouter(), [note, noter] = useState(''), [message, annoncer] = useState(''), [envoi, envoyer] = useState(false);
  async function enregistrer(decision: 'approuve' | 'integre') {
    envoyer(true); annoncer('');
    try {
      const r = await fetch(`/api/admin/assets/${id}/revue`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision, decision, note }) });
      const b = await r.json() as { detail?: string };
      if (!r.ok) throw new Error(b.detail ?? 'Revue refusée');
      annoncer('Décision enregistrée pour cette révision.'); router.refresh();
    } catch (e) { annoncer(e instanceof Error ? e.message : String(e)); } finally { envoyer(false); }
  }
  return <div className="mt-4 space-y-2">
    <p className="text-xs admin-secondaire">Approbation humaine : silhouette lisible à 48 px/m, matières sans ombre peinte, zones d’équipe, raccords et poses cohérents. Une nouvelle révision annule cette approbation.</p>
    {!local ? <p className="text-xs">Revue et dépôt à enregistrer en développement, puis à versionner pour le déploiement.</p> : <>
      {!conforme ? <p>La validation artistique sera disponible après un contrôle technique réussi.</p> : !note.trim() ? <p>Ajoutez vos observations pour activer la validation.</p> : null}
      <label className="block text-sm">Observations de réception<textarea className="mt-1 block w-full rounded border border-current/20 p-2" value={note} onChange={(e) => noter(e.target.value)} maxLength={2000} placeholder="Vues et poses examinées, puis scénario testé dans l’atelier…" /></label>
      <div className="flex flex-wrap gap-3"><button className="rounded border px-3 py-2 disabled:opacity-40" disabled={!conforme || !note.trim() || envoi} onClick={() => void enregistrer('approuve')}>Approuver visuellement</button><button className="rounded border px-3 py-2 disabled:opacity-40" disabled={!approuve || !note.trim() || envoi} onClick={() => void enregistrer('integre')}>Confirmer testé en jeu</button><a className="self-center underline" href="/atelier" target="_blank" rel="noreferrer">Ouvrir l’atelier</a></div>
    </>}
    <p role="status" className="text-xs">{message}</p>
  </div>;
}
