import { redirect } from 'next/navigation';
import { personnagesCanon } from '@/serveur/personnages';
import { sessionCourante } from '../session';
export const dynamic = 'force-dynamic';
export default async function Personnages() {
  if (!await sessionCourante()) redirect('/admin/login');
  const personnages = personnagesCanon();
  return <main><h2 className="admin-titre">Personnages et histoire</h2><p className="admin-intro">Canon Aube · révision 3. Cette vue éditoriale contient les révélations des trois actes. Les faits du passé sont séparés des croyances des personnages ; les routines reçoivent l’historique filtré par acte.</p>
    <nav className="assets-variantes" aria-label="Personnages">{personnages.map(p => <a key={p.cle} href={`#${p.cle}`}>{p.nom}</a>)}</nav>
    {personnages.map(p => <article className="asset-carte mb-4" id={p.cle} key={p.cle}><h3>{p.nom}</h3><p>{p.fonction}</p>{p.identiteTactique ? <div className="my-3"><strong>{p.identiteTactique.style}</strong><p>Faiblesse : {p.identiteTactique.faiblesse}</p><p>Dilemme : {p.identiteTactique.dilemme}</p><a className="underline" href={`/jeu/${p.identiteTactique.mission}`}>Épreuve liée</a></div> : null}<div className="text-sm"><strong>Motivation</strong> · {p.motivation}</div><div className="text-sm"><strong>Ce que ce personnage croit</strong> · {p.croyance}</div><ol className="space-y-3 border-l border-current/20 pl-4">{p.historique.map(f => <li key={f.cle}><span className="text-xs font-semibold">{f.repere} · révélation acte {f.acteRevelation}</span><p>{f.fait}</p></li>)}</ol><div className="text-xs">Liens : {p.liens.map((cle, i) => <span key={cle}>{i ? ', ' : ''}<a className="underline" href={`#${cle}`}>{personnages.find(v => v.cle === cle)?.nom ?? cle}</a></span>)}</div></article>)}
  </main>;
}
