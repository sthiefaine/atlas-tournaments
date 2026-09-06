'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n/index';
import { chargerCatalogue, VERSION_MOTEUR, type EtatPartie } from '@/engine/index';
import { commandantsDuScenario, lireSauvegarde, monterJeu, type Jeu } from '@/render/index';
import { textesObjectifs } from '@/render/objectifs';
import { creerRendu3d } from '@/render3d/index';
import type { MapDef, Scenario, StrategieIa } from '@/schemas/index';
import campagne from '../../../../content/campagne.json';
import { PREFERENCES_PAR_DEFAUT, cleSauvegardeDe, lirePreferences, profilActif, type Preferences } from '../../preferences';
import { enregistrerVictoire } from '../../campagne/progression';
import { PortraitCommandant } from './portrait-commandant';
import { adversaireIa } from '../adversaire';

export interface ProprietesToile {
  scenario: Scenario;
  carte: MapDef;
  locale: string;
}
type Depart = 'neuf' | 'reprise';

export default function Toile({ scenario, carte, locale }: ProprietesToile): React.ReactElement {
  const conteneurRef = useRef<HTMLDivElement>(null);
  const index = campagne.missions.findIndex(m => m.scenarioCle === scenario.code);
  const mission = campagne.missions[index];
  const suivante = campagne.missions[index + 1];
  const [depart, setDepart] = useState<Depart | null>(null);
  const [initialise, setInitialise] = useState(false);
  const [etat, setEtat] = useState<EtatPartie | null>(null);
  const [erreur, setErreur] = useState(false);
  const [stockageDisponible, setStockageDisponible] = useState(true);
  const [tentative, setTentative] = useState(0);
  const [etapeTutoriel, setEtapeTutoriel] = useState(0);
  const [ancienFormat, setAncienFormat] = useState(false);
  const [voirBriefing, setVoirBriefing] = useState(false);
  // Les réglages du joueur, lus une fois avant le montage du plateau.
  const [preferences, setPreferences] = useState<Preferences>({ ...PREFERENCES_PAR_DEFAUT });
  // La clé de sauvegarde dépend du profil actif de l'appareil ; c'est la page
  // qui la compose et la donne au rendu, qui ne connaît pas les profils.
  const [cleSauvegarde, setCleSauvegarde] = useState<string | null>(null);
  const [voirAide, setVoirAide] = useState(false);
  // Une scène de dialogue est ouverte sur la carte : aucune modale ne doit
  // passer devant, pas même l'écran de fin.
  const [enScene, setEnScene] = useState(false);
  const dialogueRef = useRef<HTMLElement>(null);

  // On entre **directement** en jeu : cliquer « jouer » sur l'accueil doit ouvrir
  // un plateau, pas une seconde fiche à valider. Une partie en cours se reprend
  // d'elle-même ; l'objectif, le tutoriel et « recommencer » restent à un clic,
  // derrière le fanion de mission.
  useEffect(() => {
    const cle = cleSauvegardeDe(profilActif(), scenario.code);
    const sauvegarde = lireSauvegarde(scenario.code, cle);
    const compatible = sauvegarde?.engineVersion === VERSION_MOTEUR && sauvegarde.catalogueVersion === scenario.catalogueVersion;
    const enCours = Boolean(compatible && sauvegarde && sauvegarde.actions.length > 0);
    setAncienFormat(Boolean(sauvegarde && sauvegarde.actions.length > 0 && !compatible));
    setPreferences(lirePreferences());
    setCleSauvegarde(cle);
    setInitialise(true);
    setDepart(enCours ? 'reprise' : 'neuf');
  }, [scenario.code, scenario.catalogueVersion]);

  useEffect(() => {
    const conteneur = conteneurRef.current;
    if (!conteneur || depart === null || cleSauvegarde === null) return undefined;
    const ia = scenario.commandants.find(c => c.ia)?.ia as StrategieIa | undefined;
    const commandants = commandantsDuScenario(scenario);
    let jeu: Jeu | null = null;
    let victoireEnregistree = false;
    try {
      jeu = monterJeu(conteneur, {
        scenario, carte, locale, commandants,
        adversaire: adversaireIa(ia, scenario.catalogueVersion, commandants),
        reprendre: depart === 'reprise',
        cleSauvegarde,
        // La qualité d'affichage et la réduction des animations sont des
        // réglages du joueur : la page les lit et les donne à la peau, qui ne
        // connaît pas `localStorage`.
        fabriqueRendu: () => creerRendu3d({
          biome: carte.biome,
          paysParCamp: { 0: scenario.incarnation?.paysCode ?? scenario.paysCode, 1: scenario.incarnation ? 'fr' : 'lu' },
          qualite: preferences.qualite,
          animationsReduites: preferences.animationsReduites,
        }),
        finPersonnalisee: Boolean(mission),
        // Les commandants parlent sur la carte, pas dans une modale : c'est la
        // grammaire d'Advance Wars, et elle ne vaut que pour une mission — et
        // seulement si le joueur n'a pas coupé les dialogues dans ses réglages.
        dialogues: Boolean(mission) && preferences.dialogues,
        surDialogue: setEnScene,
        surEtat: courant => {
          setEtat(courant);
          if (mission && courant.partie.terminee && courant.partie.vainqueur === 0 && !victoireEnregistree) {
            victoireEnregistree = true;
            setStockageDisponible(enregistrerVictoire(scenario.code));
          }
        },
      });
    } catch (cause) {
      console.error('Montage du jeu impossible', cause);
      conteneur.replaceChildren();
      setErreur(true);
    }
    return () => jeu?.demonter();
  }, [depart, scenario, carte, locale, tentative, mission, preferences, cleSauvegarde]);

  const reprendre = (choix: Depart) => { setErreur(false); setEtat(null); setDepart(choix); setVoirBriefing(false); setVoirAide(false); };
  const rejouer = () => { reprendre('neuf'); setTentative(n => n + 1); };
  const fin = Boolean(mission && etat?.partie.terminee);
  const gagne = etat?.partie.vainqueur === 0;
  const modal = Boolean(mission && !enScene && (fin || voirBriefing || voirAide));
  const commandantContact = scenario.commandants[0]?.commandantCle;

  const plateauPret = Boolean(etat);
  useEffect(() => {
    if (modal) dialogueRef.current?.focus();
    else if (plateauPret) conteneurRef.current?.querySelector('canvas')?.focus();
  }, [modal, plateauPret]);

  return <main className="atlas-jeu fixed inset-0 overflow-hidden bg-[#10131a]">
    <div ref={conteneurRef} aria-label={scenario.nom} className="relative h-full w-full touch-none outline-none" data-scenario={scenario.code} data-pret={etat ? '1' : '0'} inert={modal || erreur || undefined} />
    {!initialise || (depart !== null && !etat && !erreur) ? <div className="atlas-chargement" role="status">{t(locale, 'campagne.chargement')}</div> : null}
    {erreur ? <div className="atlas-voile"><section className="atlas-briefing" role="alert"><h1>{t(locale, 'campagne.sans_webgl')}</h1><p>{t(locale, 'campagne.sans_webgl_aide')}</p><div className="campagne-actions"><button className="atlas-bouton" onClick={rejouer}>{t(locale, 'campagne.rejouer')}</button><Link href="/campagne">{t(locale, 'campagne.retour')}</Link></div></section></div> : null}
    {mission && etat && !fin && !modal && !enScene ? <aside className="atlas-mission-bar">
      <button type="button" className="atlas-mission-objectif" onClick={() => setVoirAide(true)}>
        <span className="atlas-mission-label"><span>⚑ {t(locale, 'campagne.mission', { n: index + 1 })}</span><span>{t(locale, 'campagne.objectif')}</span></span>
        <span className="atlas-mission-resume">{mission.objectif}</span>
      </button>
      <button type="button" className="atlas-aide-bouton" onClick={() => setVoirAide(true)} aria-label={t(locale, 'campagne.ouvrir_aide')}><span aria-hidden="true">?</span></button>
    </aside> : null}
    {modal && !erreur ? <div className={`atlas-voile ${mission ? 'atlas-transmission' : ''}`}>
      <section ref={dialogueRef} tabIndex={-1} className="atlas-briefing" role="dialog" aria-modal="true" aria-labelledby="titre-mission">
        <div className="atlas-fiche-entete">
          {mission && !fin ? <div className="atlas-fiche-portrait"><PortraitCommandant allie={Boolean(scenario.incarnation)} /><span>{t(locale, `commandant.${commandantContact}.nom`)}</span></div> : null}
          <div className="atlas-fiche-titre">
            <p className="campagne-kicker">{mission ? t(locale, 'campagne.mission', { n: index + 1 }) : t(locale, 'campagne.demo')}{mission ? ` · ${t(locale, mission.entrainement ? 'campagne.entrainement' : 'campagne.officiel')}` : ''}</p>
            <h1 id="titre-mission">{voirAide ? t(locale, 'campagne.ouvrir_aide') : fin ? t(locale, gagne ? 'combat.manche_gagnee' : 'combat.manche_perdue') : scenario.nom}</h1>
            {scenario.incarnation ? <p className="campagne-progression">{t(locale, 'campagne.incarnation')}</p> : null}
          </div>
        </div>
        {fin && mission ? <p>{gagne ? mission.conclusion : t(locale, 'campagne.defaite')}</p> : null}
        {mission && !fin ? <>
          <div className="atlas-but"><h2>{t(locale, 'campagne.objectif')}</h2><p>{mission.objectif}</p>{voirAide && etat ? textesObjectifs(etat, chargerCatalogue(scenario.catalogueVersion), (cle, params) => t(locale, cle, params)).map((ligne, i) => <p className="atlas-progres-but" key={i}>{ligne}</p>) : null}</div>
          {voirAide ? <div className="atlas-lecon">
            <div className="atlas-lecon-entete"><h2>{t(locale, 'campagne.tutoriel')}</h2><span>{etapeTutoriel + 1} / {mission.tutoriel.length}</span></div>
            <p aria-live="polite">{mission.tutoriel[etapeTutoriel]}</p>
            <div className="atlas-tuto-actions"><button disabled={etapeTutoriel === 0} onClick={() => setEtapeTutoriel(n => n - 1)}>{t(locale, 'campagne.etape_precedente')}</button><button disabled={etapeTutoriel >= mission.tutoriel.length - 1} onClick={() => setEtapeTutoriel(n => n + 1)}>{t(locale, 'campagne.etape_suivante')}</button></div>
          </div> : null}
          <details className="atlas-conseils"><summary>{t(locale, 'campagne.conseil')}</summary><p>{mission.conseil}</p></details>
          <p className="atlas-aide">{t(locale, 'campagne.gestes_tactiles')}</p>
        </> : null}
        {ancienFormat ? <p role="status">{t(locale, 'campagne.ancien_format')}</p> : null}
        {!stockageDisponible ? <p role="status">{t(locale, 'campagne.sauvegarde_indisponible')}</p> : null}
        <div className="campagne-actions">
          {fin ? <>
            {gagne && suivante ? <Link className="atlas-bouton" href={`/jeu/${suivante.scenarioCle}`}>{t(locale, 'campagne.suivante')}</Link> : null}
            <button className="atlas-bouton secondaire" onClick={rejouer}>{t(locale, 'campagne.rejouer')}</button>
          </> : <>
            <button className="atlas-bouton" onClick={() => { setVoirBriefing(false); setVoirAide(false); }}>{t(locale, 'hud.reprendre')}</button>
            <button className="atlas-bouton secondaire" onClick={rejouer}>{t(locale, 'hud.nouvelle_partie')}</button>
          </>}
          <Link href="/campagne">{t(locale, 'campagne.retour')}</Link>
        </div>
      </section>
    </div> : null}
  </main>;
}
