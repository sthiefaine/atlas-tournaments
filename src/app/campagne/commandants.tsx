import Link from 'next/link';
import { IDENTITES_COMMANDANTS } from '@/content/identites-commandants';

export function GuideCommandants() {
  return <section className="aube-parcours" aria-label="Styles des commandants"><h2>Connaître les commandants</h2><p>Dans les nouvelles épreuves Aube, leurs pouvoirs favorisent des décisions différentes. Les entraînements et anciens scénarios conservent leurs règles. Les dilemmes se règlent après les épreuves concernées ; consulter ce carnet ne choisit rien à votre place.</p>{IDENTITES_COMMANDANTS.map(p => <details className="asset-carte mb-3" key={p.cle}><summary><strong>{p.nom}</strong> · {p.style}</summary><p>{p.capacites}</p><p><strong>Vigilance :</strong> {p.faiblesse}</p><p><strong>Dilemme :</strong> {p.dilemme}</p><Link href={`/jeu/${p.mission}`}>Voir l’épreuve liée</Link></details>)}</section>;
}
