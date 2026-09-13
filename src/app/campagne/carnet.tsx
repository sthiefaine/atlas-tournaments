'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Vignette } from '../jeu/parties-libres';
import { lireDifficulte, lireProfils } from '../preferences';
import { lireProgression } from './progression';
import { etatsItineraire, stationParDefaut } from './itineraire';
import { CarteParcours } from './carte-parcours';
import { GESTES_PRECHARGEMENT } from '../jeu/precharger';

export interface EpreuveCarnet {
  cle: string;
  /** « Mission 3 ». */
  rang: string;
  /**
   * Le nom de l'épreuve, débarrassé de son rang : « Le chantier des usines » et
   * non « Entraînement 3 · Le chantier des usines ». Le rang et le genre sont
   * déjà deux plaques au-dessus du titre ; les répéter dedans faisait dire trois
   * fois la même chose à trois hauteurs de caractères différentes.
   */
  nom: string;
  /** « Entraînement guidé » ou « Qualification de la Ronde ». */
  genre: string;
  biome: string;
  objectif: string;
  recit: string;
  /** Les pastilles du briefing : taille, adversaire, brouillard, journées. */
  details: readonly string[];
  /** La carte de l'épreuve, prête à peindre ; `null` si elle a échappé au canon. */
  vignette: Vignette | null;
}

/** Tous les textes de l'écran, déjà traduits par la page. */
export interface LibellesCarnet {
  journalTitre: string;
  journalNote: string;
  revoirDecision: string;
  surtitre: string;
  titre: string;
  introduction: string;
  retour: string;
  itineraire: string;
  objectif: string;
  /** Une entrée par nombre de victoires possible, de zéro à toutes. */
  progression: readonly string[];
  gagnee: string;
  disponible: string;
  /** L'état court d'une épreuve fermée, pour la plaque : « Verrouillée ». */
  fermee: string;
  /** Ce qu'il faut faire pour l'ouvrir : « Remportez la mission précédente ». */
  verrou: string;
  jouer: string;
  rejouer: string;
  fin: string;
  sauvegarde: string;
  demo: string;
  profilA: string;
  profilB: string;
  /** Contient `{nom}` : l'intitulé accessible de la pastille de profil. */
  profilActif: string;
  /**
   * Les lignes de journal des **bancs prêtés**, déjà traduites, par clé de
   * libellé (`bancs.ts`) : un banc s'enregistre sous des clés i18n, et ce
   * composant n'appelle pas `t()`.
   */
  bancs: Readonly<Record<string, { titre: string; effet: string }>>;
}


/** La carte choisit une mission. Le récit et les aides appartiennent au briefing en jeu. */
export default function Carnet({ epreuves, libelles }: { epreuves: readonly EpreuveCarnet[]; libelles: LibellesCarnet }): React.ReactElement {
  const [victoires, setVictoires] = useState<readonly string[]>([]);
  const [nom, setNom] = useState('');
  const [mode, setMode] = useState('Normal');
  const [pret, setPret] = useState(false);
  const [choisie, setChoisie] = useState<number | null>(null);
  useEffect(() => {
    const lire = () => {
      const p = lireProfils(), progression = lireProgression(), m = lireDifficulte();
      setNom(p.noms[p.actif] || `Profil ${p.actif.toUpperCase()}`); setMode(m === 'normal' ? 'Normal' : 'Difficile');
      setVictoires(progression.victoiresParMode?.[m] ?? (m === 'normal' && !progression.victoiresParMode ? progression.victoires : [])); setPret(true);
    };
    lire(); window.addEventListener('pageshow', lire); window.addEventListener('storage', lire);
    return () => { window.removeEventListener('pageshow', lire); window.removeEventListener('storage', lire); };
  }, []);
  const codes = epreuves.map(m => m.cle), etats = etatsItineraire(codes, victoires, pret);
  const active = choisie ?? stationParDefaut(codes, victoires), mission = epreuves[active];
  const etat = etats[active] ?? 'verrouillee';
  return <main className="atlas-carnet campagne-epuree">
    <header className="carnet-entete"><div className="carnet-titre"><h1>Campagne</h1><p className="campagne-identite">{nom}{nom ? ' · ' : ''}{mode}</p></div><Link className="atlas-retour" href="/campagne/salon">← Retour au camp</Link></header>
    <CarteParcours epreuves={epreuves} etats={etats} active={active} choisir={setChoisie} />
    {mission && <section id="dossier-mission" className="campagne-mission" aria-live="polite">
      {etat === 'verrouillee' ? <p>Remportez l’étape précédente pour ouvrir cette mission.</p> : <><div><small>{mission.rang}</small><h2>{mission.nom}</h2><p>{mission.objectif}</p></div><Link className="atlas-bouton" href={`/jeu/${mission.cle}`} {...GESTES_PRECHARGEMENT}>{etat === 'gagnee' ? libelles.rejouer : libelles.jouer} →</Link></>}
    </section>}
  </main>;
}
