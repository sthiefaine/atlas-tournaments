'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { chargerCatalogue, creerPartie, sceneDepuis } from '@/engine/index';
import { resoudreCommandantsScenario } from '@/content/commandants-jeu';
import { ambiance } from '@/render/ambiance';
import type { Rendu, VueInteraction } from '@/render/rendu';
import { BIOMES, type Biome, type MapDef, type Meteo, type PhaseJour, type Saison, type Scenario } from '@/schemas/types';
import styles from './atelier.module.css';

interface Monde { nom: string; scenario: Scenario; carte: MapDef }
const NOMS_BIOMES: Record<Biome, string> = { plaine: 'Bocage', foret: 'Forêt', montagne: 'Montagne', desert: 'Désert', jungle: 'Jungle', neige: 'Terres gelées', volcanique: 'Volcanique', cotier: 'Littoral', archipel: 'Archipel', marais: 'Marais' };
const SAISONS: [Saison, string][] = [['printemps', 'Printemps'], ['ete', 'Été'], ['automne', 'Automne'], ['hiver', 'Hiver']];
const METEOS: [Meteo, string][] = [['clair', 'Ciel clair'], ['pluie', 'Pluie'], ['neige', 'Neige'], ['brouillard', 'Brouillard'], ['tempete', 'Tempête'], ['canicule', 'Canicule']];

export default function Atelier({ mondes }: { mondes: Monde[] }): React.ReactElement {
  const [index, setIndex] = useState(0);
  const [biome, setBiome] = useState<Biome>('plaine');
  const [saison, setSaison] = useState<Saison>('printemps');
  const [phase, setPhase] = useState<PhaseJour>('jour');
  const [meteo, setMeteo] = useState<Meteo>('clair');
  const [statut, setStatut] = useState('Préparation du monde…');
  const conteneur = useRef<HTMLDivElement>(null);
  const rendu = useRef<Rendu | null>(null);
  const monde = mondes[index]!;
  const catalogue = useMemo(() => chargerCatalogue(monde.scenario.catalogueVersion), [monde.scenario.catalogueVersion]);
  const etat = useMemo(() => creerPartie(sceneDepuis(monde.scenario, monde.carte, resoudreCommandantsScenario(monde.scenario)), catalogue, 'atelier:1'), [monde, catalogue]);
  const vue = useMemo<VueInteraction>(() => ({ catalogue, ambiance: ambiance(saison, phase, meteo), surbrillances: [], chemin: [], curseur: null, selection: null, visibles: null, attenteIa: false, etiquetteQg: 'QG' }), [catalogue, saison, phase, meteo]);
  const vueCourante = useRef(vue);
  useEffect(() => { vueCourante.current = vue; rendu.current?.afficher(etat, vue); }, [etat, vue]);

  useEffect(() => {
    let annule = false;
    let peau: Rendu | null = null;
    let debrancher: (() => void) | undefined;
    setStatut('Préparation du monde…');
    void import('@/render3d/index').then(({ creerRendu3d }) => {
      if (annule || !conteneur.current) return;
      peau = creerRendu3d({ biome, paysParCamp: { 0: monde.scenario.incarnation?.paysCode ?? monde.scenario.paysCode, 1: 'lu' } });
      peau.monter(conteneur.current);
      const v = vueCourante.current;
      peau.afficher({ ...etat, climat: { ...etat.climat, saison: v.ambiance.saison, phase: v.ambiance.phase, meteo: v.ambiance.meteo } }, v);
      debrancher = peau.brancher({});
      rendu.current = peau;
      setStatut('');
    }).catch(() => {
      if (annule) return;
      peau?.demonter();
      setStatut('La 3D n’a pas pu démarrer sur cet appareil. La campagne reste disponible en 2D.');
    });
    return () => { annule = true; debrancher?.(); peau?.demonter(); rendu.current = null; };
  }, [etat, biome, monde.scenario]);

  return <main className={styles.atelier}>
    <header className={styles.entete}><div><span>ATLAS / EXPLORATION</span><h1>Atelier des mondes</h1></div><Link href="/campagne">Campagne ↗</Link></header>
    <div ref={conteneur} className={styles.monde} aria-label="Aperçu 3D interactif : glissez pour déplacer la carte, pincez pour zoomer" />
    {statut ? <p className={styles.statut} role="status">{statut}</p> : null}
    <aside className={styles.panneau} aria-label="Réglages du monde">
      <div className={styles.reglages}>
        <label>Carte<select value={index} onChange={e => { const n = Number(e.target.value); setIndex(n); setBiome(mondes[n]!.carte.biome); }}>{mondes.map((m, i) => <option key={m.nom} value={i}>{m.nom}</option>)}</select></label>
        <label>Biome<select value={biome} onChange={e => setBiome(e.target.value as Biome)}>{BIOMES.map(b => <option key={b} value={b}>{NOMS_BIOMES[b]}</option>)}</select></label>
        <label>Saison<select value={saison} onChange={e => setSaison(e.target.value as Saison)}>{SAISONS.map(([cle, nom]) => <option key={cle} value={cle}>{nom}</option>)}</select></label>
        <label>Heure<select value={phase} onChange={e => setPhase(e.target.value as PhaseJour)}><option value="jour">Jour</option><option value="nuit">Nuit</option></select></label>
        <label>Météo<select value={meteo} onChange={e => setMeteo(e.target.value as Meteo)}>{METEOS.map(([cle, nom]) => <option key={cle} value={cle}>{nom}</option>)}</select></label>
      </div>
      <div className={styles.actions}><div><button aria-label="Éloigner la caméra" onClick={() => rendu.current?.zoomer?.(-1)}>−</button><button aria-label="Rapprocher la caméra" onClick={() => rendu.current?.zoomer?.(1)}>+</button><button onClick={() => rendu.current?.recentrer?.({ x: Math.floor(etat.largeur / 2), y: Math.floor(etat.hauteur / 2) })}>Recentrer</button></div><Link href={`/jeu/${monde.scenario.code}`}>Jouer cette mission →</Link></div>
      <p>Glissez la carte · Pincez pour zoomer. Aperçu visuel : ces réglages ne changent pas votre partie.</p>
    </aside>
  </main>;
}
