'use client';
import Link from 'next/link';
import { useState } from 'react';
interface Modele { id: string; nom: string; type: string }
export function Modeles({ modeles }: { modeles: Modele[] }): React.ReactElement {
  const [recherche, setRecherche] = useState('');
  const [type, setType] = useState('');
  const normaliser = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const visibles = modeles.filter(m => (!type || m.type === type) && normaliser(`${m.nom} ${m.id}`).includes(normaliser(recherche)));
  return <section aria-label="Choisir un modèle à modifier">
    <p className="admin-intro">Choisissez un modèle, puis envoyez son nouveau fichier GLB.</p>
    <div className="admin-actions"><Link className="admin-action admin-action-primaire" href="/admin/assets/unite_infanterie_base">Modifier l’infanterie →</Link></div>
    <div className="assets-filtres">
      <label>Rechercher un modèle<input type="search" value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Infanterie, char, QG…" /></label>
      <label>Catégorie<select value={type} onChange={e => setType(e.target.value)}><option value="">Toutes</option>{[...new Set(modeles.map(m => m.type))].map(t => <option key={t}>{t}</option>)}</select></label>
    </div>
    <div className="assets-grille">{visibles.map(m => <Link key={m.id} className="asset-carte" href={`/admin/assets/${m.id}`}><small>{m.type}</small><h3>{m.nom}</h3><span className="asset-etat">Modifier le GLB →</span></Link>)}</div>
    {!visibles.length && <p>Aucun modèle trouvé.</p>}
  </section>;
}
