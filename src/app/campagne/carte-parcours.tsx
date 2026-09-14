'use client';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { GESTES_PRECHARGEMENT } from '../jeu/precharger';
import type { EpreuveCarnet } from './carnet';
import type { EtatStation } from './itineraire';
import { PaysageCampagne } from './paysage-campagne';
import styles from './carte-parcours.module.css';

const POSITIONS = [[205,185],[325,275],[435,225],[542,290],[478,411],[594,482],[721,431],[798,334],[903,262],[1050,340],[1054,460],[945,565],[813,636],[1000,690],[710,747],[552,671],[403,735],[251,641]] as const;
function point(i: number) { const p = POSITIONS[i]; return p ? { x:p[0], y:p[1] } : { x:200+(i%6)*150, y:800+Math.floor((i-POSITIONS.length)/6)*120 }; }
function Repere({ gagnee, verrouillee }: { gagnee: boolean; verrouillee: boolean }) {
  return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3 43 14V35L24 46 5 35V14Z" fill="currentColor"/><path d="M24 7 39 16V33L24 42 9 33V16Z" fill="none" stroke="currentColor"/>{gagnee ? <path d="m15 24 6 6 13-14" fill="none" stroke="var(--repere-encre)" strokeWidth="3"/> : verrouillee ? <><path d="M18 22v-4a6 6 0 0 1 12 0v4" fill="none" stroke="var(--repere-encre)" strokeWidth="2"/><rect x="16" y="22" width="16" height="12" rx="2" fill="var(--repere-encre)"/></> : <path d="M16 34V14h18l-4 6 4 6H18" fill="none" stroke="var(--repere-encre)" strokeWidth="2.5"/>}</svg>;
}
export function CarteParcours({ epreuves, etats, active, choisir, jouer, rejouer }: { epreuves: readonly EpreuveCarnet[]; etats: readonly EtatStation[]; active: number; choisir: (i: number) => void; jouer: string; rejouer: string }): React.ReactElement {
  const prefixe = useId().replace(/:/g, '');
  const viewport = useRef<HTMLDivElement>(null), carte = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const glissement = useRef<{ x: number; y: number; gauche: number; haut: number; actif: boolean } | null>(null);
  const mission = epreuves[active], etat = etats[active] ?? 'verrouillee';
  const hauteur = Math.max(880, ...epreuves.map((_,i)=>point(i).y+160));
  const termine = etats.filter(e=>e==='gagnee').length;
  function centrer() {
    const v = viewport.current, c = carte.current; if (!v || !c) return;
    const p = point(active);
    v.scrollTo({left:p.x/1200*c.offsetWidth-v.clientWidth/2, top:p.y/hauteur*c.offsetHeight-v.clientHeight*.38, behavior:'auto'});
  }
  useEffect(() => {
    const v = viewport.current, c = carte.current; if (!v || !c) return;
    const p = point(active);
    v.scrollTo({left:p.x/1200*c.offsetWidth-v.clientWidth/2, top:p.y/hauteur*c.offsetHeight-v.clientHeight*.38, behavior:'auto'});
  }, [active, zoom, hauteur]);
  return <section className={styles.cadre} aria-label="Carte des opérations">
    <div className={styles.barre}><div><span className={styles.surtitre}>ATLAS / OPÉRATIONS</span><strong>Votre campagne</strong></div><span className={styles.progression}>{termine}<span> / {epreuves.length} terminées</span></span></div>
    <div className={styles.theatre}>
      <div ref={viewport} className={styles.defilement} tabIndex={0} aria-label="Carte défilante. Glissez pour explorer ; sélectionnez une mission pour jouer."
        onPointerDown={e => { if (e.pointerType !== 'mouse' || e.button !== 0 || (e.target as HTMLElement).closest('button,a')) return; const el = e.currentTarget; glissement.current = { x: e.clientX, y: e.clientY, gauche: el.scrollLeft, haut: el.scrollTop, actif: false }; el.setPointerCapture(e.pointerId); }}
        onPointerMove={e => { const g = glissement.current; if (!g) return; const dx = e.clientX - g.x, dy = e.clientY - g.y; if (!g.actif && Math.hypot(dx, dy) < 5) return; g.actif = true; e.currentTarget.dataset.glisser = 'true'; e.currentTarget.scrollTo(g.gauche - dx, g.haut - dy); }}
        onPointerUp={e => { glissement.current = null; delete e.currentTarget.dataset.glisser; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
        onPointerCancel={e => { glissement.current = null; delete e.currentTarget.dataset.glisser; }}
        onLostPointerCapture={e => { glissement.current = null; delete e.currentTarget.dataset.glisser; }}>
        <div ref={carte} className={styles.carte} style={{width:`max(100%, ${1000*zoom}px)`, aspectRatio:`1200 / ${hauteur}`}}>
          <div className={styles.paysage}><PaysageCampagne prefixe={prefixe}/></div>
          <svg className={styles.routes} viewBox={`0 0 1200 ${hauteur}`} aria-hidden="true">
            {epreuves.slice(1).map((m,k)=>{const a=point(k),b=point(k+1),d=`M${a.x} ${a.y} C${a.x+(b.x-a.x)*.5} ${a.y},${a.x+(b.x-a.x)*.5} ${b.y},${b.x} ${b.y}`;return <g key={m.cle}><path d={d} fill="none" stroke="#172f2c" strokeWidth="7" opacity=".55"/><path d={d} fill="none" stroke={etats[k]==='gagnee'?'#e6ca83':'#d9dfc5'} strokeWidth="2" strokeDasharray={etats[k]==='gagnee'?undefined:'3 8'} opacity={etats[k]==='gagnee'?1:.45}/></g>;})}
          </svg>
          {epreuves.map((m,i)=>{const p=point(i),e=etats[i]??'verrouillee';return <button key={m.cle} className={styles.etape} style={{left:`${p.x/12}%`,top:`${p.y/hauteur*100}%`}} data-etat={e} aria-current={i===active?'step':undefined} aria-controls="dossier-mission" aria-label={e==='verrouillee'?`Mission ${i+1}, verrouillée`:`Mission ${i+1}, ${m.nom}, ${e==='gagnee'?'terminée':'disponible'}`} onClick={()=>choisir(i)} onKeyDown={event=>{const sens=['ArrowRight','ArrowDown'].includes(event.key)?1:['ArrowLeft','ArrowUp'].includes(event.key)?-1:0;if(sens){event.preventDefault();const suivant=Math.max(0,Math.min(epreuves.length-1,i+sens));choisir(suivant);carte.current?.querySelectorAll<HTMLButtonElement>('button')[suivant]?.focus({preventScroll:true});}}}>
            <Repere gagnee={e==='gagnee'} verrouillee={e==='verrouillee'}/><span className={styles.numero}>{String(i+1).padStart(2,'0')}</span>{i===active&&e!=='verrouillee'&&<span className={styles.nom}>{m.nom}</span>}
          </button>;})}
        </div>
      </div>
      <div className={styles.outils} role="group" aria-label="Caméra de la carte"><button type="button" disabled={zoom<=.8} onClick={()=>setZoom(z=>Math.max(.8,z-.2))} aria-label="Dézoomer">−</button><button type="button" onClick={centrer} aria-label="Recentrer sur la mission"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor"/><path d="M12 2v6m0 8v6M2 12h6m8 0h6" stroke="currentColor"/></svg></button><button type="button" disabled={zoom>=1.8} onClick={()=>setZoom(z=>Math.min(1.8,z+.2))} aria-label="Zoomer">+</button></div>
      {mission && <section id="dossier-mission" className={styles.dossier} aria-live="polite">
        <div className={styles.dossierEntete}><span>MISSION {String(active+1).padStart(2,'0')}</span><span>{etat==='gagnee'?'TERMINÉE':etat==='verrouillee'?'VERROUILLÉE':'À VOUS DE JOUER'}</span></div>
        {etat==='verrouillee'?<p>Remportez la mission précédente pour poursuivre.</p>:<><h2>{mission.nom}</h2><p>{mission.objectif}</p><Link href={`/jeu/${mission.cle}`} {...GESTES_PRECHARGEMENT}>{etat==='gagnee'?rejouer:jouer}<span aria-hidden="true">↗</span></Link></>}
      </section>}
      <div className={styles.legende} aria-label="Légende"><span><i/>Terminée</span><span><i/>Disponible</span><span><i/>À débloquer</span></div>
    </div>
  </section>;
}
