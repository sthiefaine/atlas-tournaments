'use client';
import { useState } from 'react';
export function PromptProduction({ texte, libelle = 'Copier le prompt pour Codex' }: { texte: string; libelle?: string }) {
  const [etat, setEtat] = useState('');
  const [ouvert, ouvrir] = useState(false);
  async function copier() {
    try { await navigator.clipboard.writeText(texte); setEtat('Prompt copié.'); }
    catch { ouvrir(true); setEtat('Le presse-papiers est indisponible. Sélectionnez le texte ci-dessous.'); }
  }
  return <section className="mb-6"><button className="admin-action admin-action-primaire" type="button" onClick={() => void copier()}>{libelle}</button><span className="ml-3 text-sm" role="status">{etat}</span><details open={ouvert} onToggle={e => ouvrir(e.currentTarget.open)}><summary>Lire le prompt complet avant de le copier</summary><textarea className="w-full rounded border border-current/20 p-3 font-mono text-xs" rows={12} readOnly aria-label="Prompt de production complet" value={texte} onFocus={e => e.currentTarget.select()} /></details></section>;
}
