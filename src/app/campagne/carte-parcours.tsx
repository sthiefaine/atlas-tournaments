'use client';
import type { EpreuveCarnet } from './carnet';
import type { EtatStation } from './itineraire';
import styles from './carte-parcours.module.css';

/** Carte de voyage originale : les chemins suivent le véritable ordre des missions. */
export function CarteParcours({ epreuves, etats, active, choisir }: { epreuves: readonly EpreuveCarnet[]; etats: readonly EtatStation[]; active: number; choisir: (i: number) => void }): React.ReactElement {
  const colonnes = 5, rangs = Math.ceil(epreuves.length / colonnes), hauteur = Math.max(480, rangs * 150 + 130);
  const point = (i: number) => { const r = Math.floor(i / colonnes), c = i % colonnes; return { x: 90 + (r % 2 ? colonnes - 1 - c : c) * 165, y: 100 + r * 150 + (c % 2 ? 25 : 0) }; };
  const trace = epreuves.map((_, i) => { const p = point(i); return `${i ? 'L' : 'M'}${p.x},${p.y}`; }).join(' ');
  return <section className={styles.cadre} aria-label="Carte de la campagne"><div className={styles.entete}><span>✓ Terminée · ● Disponible · 🔒 Verrouillée</span></div>
    <div className={styles.defilement}><div className={styles.carte} style={{ height: hauteur }}>
      <svg viewBox={`0 0 900 ${hauteur}`} preserveAspectRatio="none" aria-hidden="true">
        <defs><pattern id="atlas-mer" width="40" height="35" patternUnits="userSpaceOnUse"><path d="M5 20q8 5 16 0" stroke="#6ca5b9" fill="none" opacity=".35" /></pattern></defs>
        <rect width="900" height={hauteur} fill="#306479" /><rect width="900" height={hauteur} fill="url(#atlas-mer)" />
        <path d={`M25 50Q150 5 290 40T590 25Q820 5 870 90L850 ${hauteur-70}Q730 ${hauteur+5} 620 ${hauteur-45}T300 ${hauteur-35}Q50 ${hauteur+10} 30 ${hauteur-120}Z`} fill="#d3c994" stroke="#94b2a1" strokeWidth="14" />
        <path d={`M55 75Q210 35 330 75T800 65L810 ${hauteur-100}Q560 ${hauteur-10} 360 ${hauteur-90}T65 ${hauteur-70}Z`} fill="#83aa72" />
        {Array.from({length:rangs * 8},(_,i)=>{const x=60+(i*113)%780,y=50+(i*79)%(hauteur-100);return <g key={i} transform={`translate(${x} ${y})`}><path d="M-15 8 0-28 15 8Z" fill="#417b58"/><path d="M-10-1 0-24 10-1Z" fill="#5d9464"/><path d="M0 8v9" stroke="#685745" strokeWidth="4"/></g>;})}
        <path d={`M420 25Q470 110 430 195T475 ${hauteur}`} stroke="#b8d5c2" strokeWidth="24" fill="none" /><path d={`M420 25Q470 110 430 195T475 ${hauteur}`} stroke="#5294b0" strokeWidth="14" fill="none" />
        <path d={trace} fill="none" stroke="#546c53" strokeWidth="14" strokeLinejoin="round"/><path d={trace} fill="none" stroke="#f0dfa6" strokeWidth="8" strokeDasharray="8 5" strokeLinejoin="round"/>
        {epreuves.map((_,i)=>{const p=point(i);return <g key={i} transform={`translate(${p.x-32} ${p.y-24})`}><rect x="-10" y="-7" width="22" height="17" fill="#f5e6ba"/><path d="M-15-7 1-18 17-7Z" fill={i<10?'#63788a':'#bd7050'}/></g>;})}
      </svg>
      {epreuves.map((m,i)=>{const p=point(i), etat=etats[i]??'verrouillee';return <button key={m.cle} className={styles.etape} style={{left:`${p.x/9}%`,top:p.y}} data-etat={etat} aria-current={i===active?'step':undefined} aria-controls="dossier-mission" aria-label={etat === 'verrouillee' ? `${m.rang}, verrouillée` : `${m.rang} : ${m.nom}, ${etat === 'gagnee' ? 'remportée' : 'disponible'}`} onClick={()=>choisir(i)}><span className={styles.numero}>{etat==='gagnee'?'✓':etat==='verrouillee'?'🔒':i+1}</span>{(etat !== 'verrouillee' && i === active) && <span className={styles.nom}>{m.nom}</span>}{i===active&&<span className={styles.position}>▼</span>}</button>;})}
    </div></div>
  </section>;
}
