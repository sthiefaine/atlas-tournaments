'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { lireDifficulte, profilActif } from '../preferences';
import { lireProgression, type Progression } from './progression';
import { queteOuverte } from './consequences';
const MISSIONS = [
  ['aube_batteries_2v1', 'Le détour des batteries', '2 contre 1 · droits de transport'],
  ['aube_reserves_1v2', 'La finale des réserves', '1 contre 2 · deux fronts'],
  ['aube_nuit_2v2', 'La ligne de nuit', '2 contre 2 · protection des relevés'],
  ['aube_routes_3v1', 'Les routes d’Aube', '3 contre 1 · coalition'],
] as const;
const QUETES = [
  ['aube_convoi_secondaire', 'Le convoi de Solveig', 'Choisir après Le détour des batteries', 'Renforts au siège ou fonds pour les routes.'],
  ['aube_archives_secondaire', 'Les archives de Wren', 'Choisir après La ligne de nuit', 'Reconnaissance ou soutien public pour les routes.'],
] as const;
export function ParcoursAube() {
  const [mode, setMode] = useState('normal');
  const [progression, setProgression] = useState<Progression>({ version: 1, victoires: [] });
  useEffect(() => {
    const lire = () => { setProgression(lireProgression()); setMode(lireDifficulte(profilActif())); }; lire();
    window.addEventListener('pageshow', lire); window.addEventListener('storage', lire);
    return () => { window.removeEventListener('pageshow', lire); window.removeEventListener('storage', lire); };
  }, []);
  const decisions = Object.values(progression.decisions ?? {});
  return <section className="aube-parcours" aria-labelledby="parcours-aube"><h2 id="parcours-aube">Aube · le conflit des réserves</h2><p>Un arc jouable en cours d’équilibrage. Les missions principales restent accessibles pour les essais ; vos décisions ouvrent des quêtes secondaires et changent vos prochaines parties.</p>
    <p>Mode {mode} · <Link href="/reglages">Changer la difficulté</Link></p><div className="aube-cartes">{MISSIONS.map(([cle, titre, detail]) => <Link key={cle} href={`/jeu/${cle}`}><strong>{titre}</strong><span>{detail}</span><small>{progression.victoires.includes(cle) ? 'Remportée · rejouer' : 'Jouer'}</small></Link>)}</div>
    <h3>Quêtes secondaires</h3><div className="aube-cartes">{QUETES.map(([cle, titre, condition, effet]) => {
      const ouverte = queteOuverte(cle, decisions);
      return <article key={cle}><strong>{titre}</strong><p>{effet}</p>{ouverte ? <Link href={`/jeu/${cle}`}>{progression.victoires.includes(cle) ? 'Rejouer la quête' : 'Jouer la quête'} →</Link> : <small>{condition} pour ouvrir cette quête.</small>}</article>;
    })}</div>
    <h3>Défi facultatif · la quarantième relève</h3><p>1 contre 3. Survivez quarante journées jusqu’à l’arrivée du convoi à J41. Vos quêtes peuvent préparer des réserves supplémentaires.</p><Link className="atlas-bouton secondaire" href="/jeu/aube_releve_1v3">Jouer le siège</Link>
  </section>;
}
