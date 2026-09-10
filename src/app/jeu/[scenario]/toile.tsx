'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';
import { t } from '@/i18n/index';
import { chargerCatalogue, VERSION_MOTEUR, sontAllies, type EtatPartie } from '@/engine/index';
import { commandantsDuScenario, lireSauvegarde, monterJeu, type Jeu } from '@/render/index';
import { lignesPouvoir, nomTerrain, nomUnite } from '@/render/libelles';
import { textesObjectifs } from '@/render/objectifs';
import { creerRendu3d } from '@/render3d/index';
import type { MapDef, Mode, Scenario, StrategieIa } from '@/schemas/index';
import campagne from '../../../../content/campagne.json';
import { PREFERENCES_PAR_DEFAUT, cleSauvegardeDe, lireDifficulte, lirePreferences, ecrirePreferences, profilActif, type Preferences, type Profil } from '../../preferences';
import { enregistrerVictoire, enregistrerDecision, enregistrerBanc, lireProgression, type DecisionLocale, type Progression } from '../../campagne/progression';
import { appliquerConsequences, cleDecision, decisionsDeGraine, graineAube, libelleDecision, optionsDecision, ETAPES_AUBE, estMissionAube, CLES_QUETES_AUBE, queteOuverte, VERSION_CANON_AUBE } from '../../campagne/consequences';
import { PROPRES_COULEURS, bancChoisi, cleSourceBanc, optionsBanc } from '../../campagne/bancs';
import { chargerCommandantJeu, revisionCommandants } from '@/content/commandants-jeu';
import { lireProfilCommandant } from '@/content/profils-commandants';
import { bilanDeFin, type Bilan } from './bilan';
import type { EtapePage } from './etapes-chargement';
import { PortraitCommandant } from './portrait-commandant';
import { adversaireIa } from '../adversaire';
import { Gras } from '../../gras';
import { sansGras } from '@/render/gras';
import { scenarioPourMode } from '../difficulte';

export interface ProprietesToile {
  scenario: Scenario;
  carte: MapDef;
  locale: string;
  /**
   * L'avancement du chargement, rendu au relais qui porte l'écran
   * (`toile-client.tsx`). Chaque étape est un **fait**, jamais une estimation :
   * le module est là, le plateau est bâti, le moteur a démarré, une image a été
   * dessinée. C'est ce dernier point qui manquait — l'écran s'effaçait dès que
   * `monterJeu` rendait la main, soit trois secondes avant la première image.
   */
  surChargement?: (etape: EtapePage) => void;
}
type Depart = 'neuf' | 'reprise';

/**
 * Au-delà, on cesse de retenir l'écran de chargement. Une peau qui ne sait pas
 * mesurer, ou un moteur qui ne rendra jamais la main, ne doivent pas enfermer
 * le joueur derrière un voile : passé ce délai on rend la vue, quitte à ce
 * qu'elle soit noire — c'est au moins un état dont il peut sortir.
 */
const MS_BUDGET_CHARGEMENT = 20_000;

/**
 * Ce qu'une seule image peut retirer du budget. Une image de jeu dure quelques
 * millisecondes, la première en dure mille : deux cents est large pour une
 * image, et beaucoup trop court pour un onglet resté une minute en fond.
 */
const MS_PAS_MAXIMAL = 200;

/**
 * Le camp du joueur. `monterJeu` prend `options.camp ?? 0` et la page ne le
 * passe pas : le joueur est le camp 0, ici comme là-bas. La constante existe
 * pour que le bilan n'écrive pas un zéro nu qu'on ne saurait plus relire.
 */
const CAMP_JOUEUR = 0;

/** Le nombre, écrit comme la langue l'écrit. Aucun texte, seulement du format. */
function nombre(locale: string, n: number): string {
  return new Intl.NumberFormat(locale).format(n);
}

/**
 * Une part sur cent, écrite comme la langue l'écrit — « 70 % » en français,
 * « 70% » ailleurs. C'est du **format**, pas une chaîne : rien à traduire, donc
 * rien à mettre dans le canon (même raisonnement que le « − » d'un chiffre de
 * dégâts ou le « ∞ » d'une pastille de fiche).
 */
function pourcent(locale: string, n: number): string {
  return new Intl.NumberFormat(locale, { style: 'percent' }).format(n / 100);
}

/**
 * Une ligne du bilan : l'axe, sa jauge en dix crans, sa part.
 *
 * La jauge est `aria-hidden` — elle redit ce que le pourcentage à côté d'elle
 * dit déjà —, et elle porte les mêmes segments biseautés que la jauge de la
 * campagne et que le bouton Campagne de l'écran-titre : deux mesures de la même
 * chose doivent se ressembler.
 */
function AxeBilan(
  { libelle, valeur, locale }: { libelle: string; valeur: number; locale: string },
): React.ReactElement {
  const crans = Math.round(valeur / 10);
  return <li>
    <span className="bilan-axe-nom">{libelle}</span>
    <span className="bilan-jauge" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < crans ? 'faite' : undefined} />)}
    </span>
    <b>{pourcent(locale, valeur)}</b>
  </li>;
}

/**
 * Le **bilan de fin de manche**, quand la manche est finie.
 *
 * L'écran de fin ne disait que « Manche gagnée » et proposait deux boutons :
 * une victoire en six journées sans perdre une unité s'y lisait exactement
 * comme une victoire au forceps en dix-huit. Le rang n'est pas un ornement,
 * c'est ce qui donne une raison de rejouer une mission déjà remportée — et il
 * n'est montré **que sur une victoire** : on ne classe pas une manche perdue.
 *
 * Sous le rang, les faits d'où il sort, pour que la note ne soit jamais un
 * verdict qu'on subit sans le comprendre.
 */
function BlocBilan(
  { bilan, gagne, locale }: { bilan: Bilan; gagne: boolean; locale: string },
): React.ReactElement {
  // Les clés sont écrites en toutes lettres, jamais composées : c'est ainsi
  // qu'on les retrouve d'un `grep` le jour où l'on en cherche une.
  return <section className="atlas-bilan" data-issue={gagne ? 'gagnee' : 'perdue'} aria-label={t(locale, 'bilan.titre')}>
    {gagne ? <div className="bilan-rang">
      <span className="campagne-kicker">{t(locale, 'bilan.rang')}</span>
      <b data-rang={bilan.rang}>{bilan.rang}</b>
    </div> : null}
    <ul className="bilan-axes">
      <AxeBilan libelle={t(locale, 'bilan.rythme')} valeur={bilan.rythme} locale={locale} />
      <AxeBilan libelle={t(locale, 'bilan.puissance')} valeur={bilan.puissance} locale={locale} />
      <AxeBilan libelle={t(locale, 'bilan.tenue')} valeur={bilan.tenue} locale={locale} />
    </ul>
    <ul className="bilan-faits">
      <li><b>{nombre(locale, bilan.journees)}</b><span>{t(locale, 'bilan.journees')}</span></li>
      <li><b>{nombre(locale, bilan.engagees)}</b><span>{t(locale, 'bilan.engagees')}</span></li>
      <li><b>{nombre(locale, bilan.perdues)}</b><span>{t(locale, 'bilan.perdues')}</span></li>
      <li><b>{nombre(locale, bilan.neutralisees)}</b><span>{t(locale, 'bilan.neutralisees')}</span></li>
      <li><b>{nombre(locale, bilan.batiments)}</b><span>{t(locale, 'bilan.batiments')}</span></li>
    </ul>
  </section>;
}

export default function Toile({ scenario, carte, locale, surChargement }: ProprietesToile): React.ReactElement {
  const conteneurRef = useRef<HTMLDivElement>(null);
  const index = campagne.missions.findIndex(m => m.scenarioCle === scenario.code);
  const essaiAube = estMissionAube(scenario.code);
  const mission = useMemo(() => campagne.missions[index] ?? (essaiAube ? {
    entrainement: false,
    objectif: scenario.code === 'aube_releve_1v3' ? 'Survivre quarante journées complètes jusqu’à la relève.' : 'Prendre tous les QG adverses ou mettre toute l’équipe adverse hors jeu.',
    conclusion: scenario.dialogueVictoire.map((d) => d.texte).join(' '),
    tutoriel: ['Les armées alliées jouent leur propre tour. Consultez leurs unités sans leur donner d’ordres.'],
    conseil: 'Ces essais Aube sont indépendants des entraînements. Les décisions de fin de match modifient uniquement les nouvelles parties annoncées.',
  } : undefined), [index, essaiAube, scenario]);
  const codeSuivant = essaiAube ? (ETAPES_AUBE.some((cle) => cle === scenario.code) ? ETAPES_AUBE[ETAPES_AUBE.findIndex((cle) => cle === scenario.code) + 1] : undefined) : campagne.missions[index + 1]?.scenarioCle;
  const [mode, setMode] = useState<Mode>('normal');
  const [queteVerrouillee, setQueteVerrouillee] = useState(false);
  const [scenarioEffectif, setScenarioEffectif] = useState<Scenario>(scenario);
  const [progression, setProgression] = useState<Progression>({ version: 1, victoires: [] });
  const profilPartie = useRef<Profil>('a');
  const [rappels, setRappels] = useState<string[]>([]);
  const [erreurDecision, setErreurDecision] = useState(false);
  const titreEtape = essaiAube ? t(locale, 'aube.essai') : t(locale, 'campagne.mission', { n: index + 1 });
  const [depart, setDepart] = useState<Depart | null>(null);
  const [etat, setEtat] = useState<EtatPartie | null>(null);
  const [erreur, setErreur] = useState(false);
  const [stockageDisponible, setStockageDisponible] = useState(true);
  const [tentative, setTentative] = useState(0);
  const [etapeTutoriel, setEtapeTutoriel] = useState(0);
  const [ancienFormat, setAncienFormat] = useState(false);
  const [voirBriefing, setVoirBriefing] = useState(false);
  // Les bancs prêtés (`campagne/bancs.ts`) : quand le scénario en propose, une
  // partie **neuve** commence par le choix du banc, et rien ne se monte avant.
  // Le choix est gardé ici en plus de la progression : si le stockage refuse,
  // la partie se joue quand même sous les couleurs choisies.
  const bancs = useMemo(() => (scenario.bancs?.length ? optionsBanc(scenario.code) : []), [scenario.bancs, scenario.code]);
  // Le catalogue du scénario, pour nommer les unités qu'un filtre de pouvoir cite au briefing.
  const catalogueKit = useMemo(() => chargerCatalogue(scenario.catalogueVersion), [scenario.catalogueVersion]);
  const [bancEnAttente, setBancEnAttente] = useState(false);
  const [bancChoix, setBancChoix] = useState<string | null>(null);
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

  /**
   * Le rappel de chargement passe par une référence, et les effets ne dépendent
   * pas de son identité : une fonction fléchée écrite en propriété change à
   * chaque rendu du parent, et le jeu entier — moteur graphique compris — serait
   * démonté puis remonté. C'est exactement ce qui est arrivé à l'attract de
   * l'accueil le 8 septembre 2026, mesuré, avant qu'on ne le garde ainsi.
   */
  const rappelChargement = useRef(surChargement);
  rappelChargement.current = surChargement;
  const direChargement = (etape: EtapePage): void => { rappelChargement.current?.(etape); };

  // Le module de la toile vient d'être évalué : l'écran de chargement passe de
  // « le jeu descend » à « le plateau se prépare ». En effet de mise en page,
  // pour que le changement parte avec la même image que le montage.
  useLayoutEffect(() => { rappelChargement.current?.('plateau'); }, []);

  // On entre **directement** en jeu : cliquer « jouer » sur l'accueil doit ouvrir
  // un plateau, pas une seconde fiche à valider. Une partie en cours se reprend
  // d'elle-même ; l'objectif, le tutoriel et « recommencer » restent à un clic,
  // derrière le fanion de mission.
  useEffect(() => {
    profilPartie.current = profilActif();
    const progressionLue = lireProgression(profilPartie.current);
    setProgression(progressionLue);
    if (CLES_QUETES_AUBE.some((cle) => cle === scenario.code) && !queteOuverte(scenario.code, Object.values(progressionLue.decisions ?? {}))) {
      setQueteVerrouillee(true);
      setDepart(null);
      direChargement('pret');
      return;
    }
    setQueteVerrouillee(false);
    const modeLu = lireDifficulte(profilPartie.current);
    setMode(modeLu);
    const cle = cleSauvegardeDe(profilPartie.current, scenario.code, modeLu);
    const sauvegarde = lireSauvegarde(scenario.code, cle);
    const compatible = sauvegarde?.engineVersion === VERSION_MOTEUR && sauvegarde.catalogueVersion === scenario.catalogueVersion
      && (sauvegarde.scenarioVersion ?? 1) === scenario.version;
    const enCours = Boolean(compatible && sauvegarde && sauvegarde.actions.length > 0);
    setAncienFormat(Boolean(sauvegarde && sauvegarde.actions.length > 0 && !compatible));
    setPreferences(lirePreferences());
    setCleSauvegarde(cle);
    // Une partie en cours reprend le banc de sa graine ; une partie neuve le
    // demande d'abord. L'écran de chargement se retire : il n'y a rien à
    // attendre tant que le joueur n'a pas choisi.
    if (!enCours && bancs.length > 0) {
      setDepart(null);
      setBancEnAttente(true);
      direChargement('pret');
      return;
    }
    setDepart(enCours ? 'reprise' : 'neuf');
  }, [scenario.code, scenario.catalogueVersion, scenario.version, bancs]);

  useEffect(() => {
    const conteneur = conteneurRef.current;
    if (!conteneur || depart === null || cleSauvegarde === null) return undefined;
    // Le banc choisi à l'instant passe en dernier : `graineAube` lit la dernière
    // décision d'une source, et c'est lui qui doit gagner sur une entrée plus
    // ancienne du stockage.
    const decisionBanc: DecisionLocale[] = bancChoix
      ? [{ scenario: cleSourceBanc(scenario.code), scenarioVersion: scenario.version, canonVersion: VERSION_CANON_AUBE, choix: bancChoix }]
      : [];
    const decisions = [...Object.values(lireProgression(profilPartie.current).decisions ?? {}), ...decisionBanc];
    const sauvegarde = depart === 'reprise' ? lireSauvegarde(scenario.code, cleSauvegarde) : null;
    const graine = sauvegarde?.graine ?? (essaiAube || index >= 0 ? graineAube(scenario, decisions) : `${scenario.code}:1`);
    const prepare = appliquerConsequences(scenarioPourMode(scenario, mode), decisionsDeGraine(scenario, graine), (cle, params) => t(locale, cle, params));
    setScenarioEffectif(prepare.scenario);
    setRappels(prepare.rappels);
    const ia = prepare.scenario.commandants.find(c => c.ia)?.ia as StrategieIa | undefined;
    // Les commandants du scénario **effectif** : un banc prêté a pu en échanger deux.
    const commandants = commandantsDuScenario(prepare.scenario);
    let jeu: Jeu | null = null;
    let victoireEnregistree = false;
    try {
      jeu = monterJeu(conteneur, {
        scenario: prepare.scenario, carte, locale, commandants, graine,
        adversaire: adversaireIa(ia, scenario.catalogueVersion, commandants, Object.fromEntries(prepare.scenario.commandants.filter((c) => c.ia).map((c) => [c.camp, c.ia!]))),
        reprendre: depart === 'reprise',
        cleSauvegarde,
        // La qualité d'affichage et la réduction des animations sont des
        // réglages du joueur : la page les lit et les donne à la peau, qui ne
        // connaît pas `localStorage`.
        fabriqueRendu: () => creerRendu3d({
          biome: carte.biome,
          paysParCamp: { 0: prepare.scenario.incarnation?.paysCode ?? scenario.paysCode, 1: prepare.scenario.incarnation ? 'fr' : 'lu' },
          qualite: preferences.qualite,
          animationsReduites: preferences.animationsReduites,
          // Le moteur s'initialise après le montage : s'il ne démarre pas —
          // ni WebGPU ni WebGL 2 n'ont voulu du canevas —, c'est le même écran
          // que pour un montage qui lève, au lieu d'un plateau noir. L'écran de
          // chargement se retire alors : il n'y a plus rien à attendre.
          surEchec: () => { setErreur(true); direChargement('pret'); },
        }),
        finPersonnalisee: Boolean(mission),
        // Les commandants parlent sur la carte, pas dans une modale : c'est la
        // grammaire d'Advance Wars, et elle ne vaut que pour une mission — et
        // seulement si le joueur n'a pas coupé les dialogues dans ses réglages.
        dialogues: Boolean(mission) && preferences.dialogues,
        surDialogue: setEnScene,
        // L'écran de combat et la réduction des animations sont des réglages du
        // joueur : la page les lit et les donne au chef d'orchestre, comme la peau.
        ecranCombat: preferences.ecranCombat,
        animationsReduites: preferences.animationsReduites,
        vitesseAnimations: preferences.vitesseAnimations,
        modeTactique: preferences.modeTactique,
        surModeTactique: (actif) => { ecrirePreferences({ ...lirePreferences(), modeTactique: actif }); },
        surEtat: courant => {
          setEtat(courant);
          if (mission && courant.partie.terminee && sontAllies(courant, courant.partie.vainqueur, CAMP_JOUEUR) && !victoireEnregistree) {
            victoireEnregistree = true;
            setStockageDisponible(enregistrerVictoire(scenario.code, profilPartie.current, mode));
            setProgression(lireProgression(profilPartie.current));
          }
        },
      });
    } catch (cause) {
      console.error('Montage du jeu impossible', cause);
      conteneur.replaceChildren();
      setErreur(true);
      direChargement('pret');
      return undefined;
    }

    // Le plateau est bâti ; reste ce que seule la peau sait dire — le moteur
    // graphique a-t-il démarré, une image a-t-elle été dessinée. On le lui
    // demande d'image en image : la réponse ne change que deux fois, et la
    // question ne coûte qu'une lecture de compteurs. Sans cette boucle, l'écran
    // s'effaçait ici, alors que la première image était encore à venir.
    const partie = jeu;
    let image: number | null = null;
    // Le budget se dépense **image par image**, jamais en horloge murale : un
    // onglet mis en arrière-plan ne reçoit plus d'images, et une minute passée
    // ailleurs ne doit pas être comptée comme une minute d'attente. On plafonne
    // donc ce qu'une seule image peut consommer.
    let restant = MS_BUDGET_CHARGEMENT;
    let dernier = Date.now();
    const suivre = (): void => {
      image = null;
      const maintenant = Date.now();
      restant -= Math.min(MS_PAS_MAXIMAL, maintenant - dernier);
      dernier = maintenant;
      const etape = restant <= 0 ? 'pret' : partie.etatChargement();
      direChargement(etape);
      if (etape !== 'pret') image = requestAnimationFrame(suivre);
    };
    suivre();

    return () => {
      if (image !== null) cancelAnimationFrame(image);
      partie.demonter();
    };
  }, [depart, scenario, carte, locale, tentative, mission, preferences, cleSauvegarde, essaiAube, mode, index, bancChoix]);

  const reprendre = (choix: Depart) => { setErreur(false); setEtat(null); setDepart(choix); setVoirBriefing(false); setVoirAide(false); };
  // Une nouvelle partie d'une épreuve à bancs repasse par le choix : démonter
  // (`depart` à `null`), demander, puis monter au choix.
  const rejouer = () => {
    if (bancs.length > 0) { setErreur(false); setEtat(null); setVoirBriefing(false); setVoirAide(false); setDepart(null); setBancEnAttente(true); return; }
    reprendre('neuf'); setTentative(n => n + 1);
  };
  const choisirBanc = (choix: string): void => {
    setStockageDisponible(enregistrerBanc(scenario.code, scenario.version, choix, profilPartie.current));
    setBancChoix(choix);
    setBancEnAttente(false);
    setDepart('neuf');
    setTentative(n => n + 1);
  };
  // Le banc effectivement joué, pour le rappeler au briefing.
  const bancActif = bancChoisi(scenario.code, scenarioEffectif.incarnation?.commandantCle);
  const fin = Boolean(mission && etat?.partie.terminee);
  const gagne = Boolean(etat && !etat.partie.nul && sontAllies(etat, etat.partie.vainqueur, CAMP_JOUEUR));
  const choixDisponibles = optionsDecision(scenario.code);
  const decision = progression.decisions?.[cleDecision(scenario.code, scenario.version)];
  const decisionEnAttente = gagne && choixDisponibles.length > 0 && !decision;
  const decider = (choix: string): void => {
    const ok = enregistrerDecision(scenario.code, scenario.version, choix, profilPartie.current);
    setErreurDecision(!ok);
    if (ok) setProgression(lireProgression(profilPartie.current));
  };
  const objectifMission = essaiAube && etat ? textesObjectifs(etat, chargerCatalogue(scenario.catalogueVersion), (cle, params) => t(locale, cle, params)).join(' · ') : mission?.objectif ?? '';
  const modal = Boolean(mission && !enScene && (fin || voirBriefing || voirAide));
  const commandantContact = scenarioEffectif.commandants.find((c) => c.camp === CAMP_JOUEUR)?.commandantCle ?? scenarioEffectif.commandants[0]?.commandantCle;
  const commandantDefaut = scenario.commandants.find((c) => c.camp === CAMP_JOUEUR)?.commandantCle ?? '';
  // Le bilan ne se calcule qu'une fois la manche finie, et il ne lit que l'état
  // final et la carte : rien à mémoriser en cours de partie.
  const bilan = fin && etat ? bilanDeFin(etat, carte, CAMP_JOUEUR) : null;

  const plateauPret = Boolean(etat);
  useEffect(() => {
    if (modal || bancEnAttente) dialogueRef.current?.focus();
    else if (plateauPret) conteneurRef.current?.querySelector('canvas')?.focus();
  }, [modal, plateauPret, bancEnAttente]);

  if (queteVerrouillee) return <main className="atlas-jeu fixed inset-0 bg-[#10131a]"><div className="atlas-voile"><section className="atlas-briefing" role="status">
    <h1>{t(locale, 'aube.quete_verrouillee')}</h1><p>{t(locale, 'aube.quete_condition')}</p><Link className="atlas-bouton" href="/campagne">{t(locale, 'campagne.retour')}</Link>
  </section></div></main>;

  return <main className="atlas-jeu fixed inset-0 overflow-hidden bg-[#10131a]">
    <div ref={conteneurRef} aria-label={scenario.nom} className="relative h-full w-full touch-none outline-none" data-scenario={scenario.code} data-pret={etat ? '1' : '0'} inert={modal || erreur || bancEnAttente || undefined} />
    {/* Le choix du banc, avant tout montage : « Jouer sous les couleurs de… ».
        Chaque option dit le général, son kit tel qu'il sera joué, et la suite
        qu'elle annonce dans l'épreuve suivante. Le premier bouton est le banc du
        scénario : décliner reste une option de la liste, jamais un autre écran. */}
    {bancEnAttente && !erreur ? <div className="atlas-voile atlas-transmission">
      <section ref={dialogueRef} tabIndex={-1} className="atlas-briefing" role="dialog" aria-modal="true" aria-labelledby="titre-banc">
        <div className="atlas-fiche-entete">
          <div className="atlas-fiche-portrait"><PortraitCommandant /><span>{t(locale, `commandant.${commandantDefaut}.nom`)}</span></div>
          <div className="atlas-fiche-titre">
            <p className="campagne-kicker"><span className="atlas-balise" aria-hidden="true"><i /><i /><i /></span>{mission ? titreEtape : t(locale, 'campagne.demo')} · {t(locale, 'banc.choisir')}</p>
            <h1 id="titre-banc">{scenario.nom}</h1>
          </div>
        </div>
        <p className="atlas-aide">{t(locale, 'banc.note')}</p>
        <ul className="atlas-bancs">
          {bancs.map((option) => {
            const general = option.cle === PROPRES_COULEURS ? commandantDefaut : option.cle;
            const kit = chargerCommandantJeu(general, revisionCommandants(scenario));
            const profil = lireProfilCommandant(general);
            // Le kit **tel qu'il sera joué**, lu sur ses effets par la même
            // `lignesPouvoir` que le HUD : un briefing qui recopierait une
            // phrase dériverait de la jauge au premier chiffre changé.
            const tr = (cle: string, params?: Record<string, string | number>) => t(locale, cle, params);
            const noms = { unite: (c: Parameters<typeof nomUnite>[2]) => nomUnite(locale, catalogueKit, c), terrain: (c: Parameters<typeof nomTerrain>[2]) => nomTerrain(locale, catalogueKit, c) };
            const lignes = [
              ...(kit.passif ? lignesPouvoir(tr, [kit.passif], { noms }) : []),
              ...lignesPouvoir(tr, kit.pouvoir.effets, { noms, duree: kit.pouvoir.duree }),
              ...lignesPouvoir(tr, kit.superPouvoir.effets, { noms, duree: kit.superPouvoir.duree }),
            ];
            return <li key={option.cle}>
              <button type="button" className="atlas-banc" data-banc={option.cle} onClick={() => choisirBanc(option.cle)}>
                <strong>{t(locale, 'banc.jouer', { banc: t(locale, option.titre) })}</strong>
                <span>{t(locale, `commandant.${general}.nom`)} · {t(locale, 'banc.kit', { style: profil?.style ?? '', pouvoir: t(locale, kit.pouvoir.nom), super: t(locale, kit.superPouvoir.nom) })}</span>
                {lignes.length > 0 ? <span className="atlas-banc-kit">{lignes.join(' · ')}</span> : null}
                <small>{t(locale, option.effet)}</small>
              </button>
            </li>;
          })}
        </ul>
        {!stockageDisponible ? <p role="status">{t(locale, 'campagne.sauvegarde_indisponible')}</p> : null}
        <div className="campagne-actions"><Link href="/campagne">{t(locale, 'campagne.retour')}</Link></div>
      </section>
    </div> : null}
    {erreur ? <div className="atlas-voile"><section className="atlas-briefing" role="alert"><h1>{t(locale, 'campagne.sans_webgl')}</h1><p>{t(locale, 'campagne.sans_webgl_aide')}</p><div className="campagne-actions"><button className="atlas-bouton" onClick={rejouer}>{t(locale, 'campagne.rejouer')}</button><Link href="/campagne">{t(locale, 'campagne.retour')}</Link></div></section></div> : null}
    {/* L'objectif ne s'écrit plus sur la carte : un fanion, et la modale le dit.
        Deux lignes de texte posées en permanence sur le plateau prenaient la
        place du jeu — sur un téléphone c'était le quart de la largeur, sur PC
        une bande de 380 px — pour une phrase qu'on lit une fois par manche. */}
    {mission && etat && !fin && !modal && !enScene ? <aside className="atlas-mission-bar">
      <button type="button" className="atlas-mission-fanion" onClick={() => setVoirAide(true)}
        aria-label={`${titreEtape} · ${t(locale, 'campagne.objectif')}`}
        title={sansGras(objectifMission)}>
        <span aria-hidden="true">⚑</span><span className="atlas-mission-numero">{essaiAube ? 'A' : index + 1}</span><span className="atlas-mission-libelle">{t(locale, 'campagne.ouvrir_aide')}</span>
      </button>
    </aside> : null}
    {modal && !erreur ? <div className={`atlas-voile ${mission ? 'atlas-transmission' : ''}`}>
      <section ref={dialogueRef} tabIndex={-1} className="atlas-briefing" role="dialog" aria-modal="true" aria-labelledby="titre-mission">
        <div className="atlas-fiche-entete">
          {/* Le portrait reste sur l'écran de fin : c'est le même commandant qui
              a ouvert la mission et qui la débriefe, et une fin sans visage
              retombait dans la fiche de site que le reste de l'écran a quittée. */}
          {mission ? <div className="atlas-fiche-portrait"><PortraitCommandant allie={Boolean(scenarioEffectif.incarnation)} /><span>{t(locale, `commandant.${commandantContact}.nom`)}</span></div> : null}
          <div className="atlas-fiche-titre">
            <p className="campagne-kicker">{/* La balise de liaison, reprise de l'écran de chargement : le briefing
                  est la suite de ce qu'il annonçait. */}
              <span className="atlas-balise" aria-hidden="true"><i /><i /><i /></span>
              {mission ? titreEtape : t(locale, 'campagne.demo')}{mission ? ` · ${t(locale, mission.entrainement ? 'campagne.entrainement' : 'campagne.officiel')}` : ''}</p>
            <h1 id="titre-mission">{voirAide ? t(locale, 'campagne.ouvrir_aide') : fin ? t(locale, gagne ? 'combat.manche_gagnee' : 'combat.manche_perdue') : scenario.nom}</h1>
            {scenario.incarnation ? <p className="campagne-progression">{t(locale, 'campagne.incarnation')}</p> : null}
            {bancActif ? <p className="campagne-progression">{t(locale, 'banc.en_cours', { banc: t(locale, bancActif.libelle) })}</p> : null}
          </div>
        </div>
        {fin && mission && bilan ? <>
          <BlocBilan bilan={bilan} gagne={gagne} locale={locale} />
          <p className="atlas-conclusion">{gagne ? <Gras texte={mission.conclusion} /> : t(locale, 'campagne.defaite')}</p>
        </> : null}
        {mission && !fin ? <>
          <div className="atlas-but"><h2>{t(locale, 'campagne.objectif')}</h2><p><Gras texte={objectifMission} /></p>{voirAide && etat ? textesObjectifs(etat, chargerCatalogue(scenario.catalogueVersion), (cle, params) => t(locale, cle, params)).map((ligne, i) => <p className="atlas-progres-but" key={i}>{ligne}</p>) : null}</div>
          {voirAide ? <div className="atlas-lecon">
            <div className="atlas-lecon-entete"><h2>{t(locale, 'campagne.tutoriel')}</h2><span>{etapeTutoriel + 1} / {mission.tutoriel.length}</span></div>
            <p aria-live="polite"><Gras texte={mission.tutoriel[etapeTutoriel] ?? ''} /></p>
            <div className="atlas-tuto-actions"><button disabled={etapeTutoriel === 0} onClick={() => setEtapeTutoriel(n => n - 1)}>{t(locale, 'campagne.etape_precedente')}</button><button disabled={etapeTutoriel >= mission.tutoriel.length - 1} onClick={() => setEtapeTutoriel(n => n + 1)}>{t(locale, 'campagne.etape_suivante')}</button></div>
          </div> : null}
          <details className="atlas-conseils"><summary>{t(locale, 'campagne.conseil')}</summary><p><Gras texte={mission.conseil} /></p></details>
          <p className="atlas-aide">{t(locale, 'campagne.gestes_tactiles')}</p>
        </> : null}
        {fin && gagne && choixDisponibles.length > 0 ? <section className="atlas-conseils" aria-labelledby="titre-decision">
          <h2 id="titre-decision">{t(locale, 'aube.decider')}</h2>
          {decision ? <p role="status">{t(locale, 'aube.decision_enregistree', { titre: libelleDecision(decision)?.titre ?? '', effet: libelleDecision(decision)?.effet ?? '' })}</p> : <>
            <p>{t(locale, 'aube.decision_note')}</p>
            {choixDisponibles.map((choix) => <div key={choix.cle}><p>{choix.effet}</p><button className="atlas-bouton secondaire" type="button" onClick={() => decider(choix.cle)}>{choix.titre}</button></div>)}
          </>}
          {erreurDecision ? <p role="alert">{t(locale, 'aube.decision_erreur')}</p> : null}
        </section> : null}
        <section className="atlas-conseils" aria-labelledby="mode-partie"><h2 id="mode-partie">{t(locale, mode === 'normal' ? 'mode.normal' : 'mode.difficile')}</h2>
          <p>{t(locale, 'mode.partie_note')}</p>
          <ul>{scenarioEffectif.commandants.map((c) => <li key={c.camp}>{t(locale, 'mode.camp', { camp: c.camp + 1, fonds: scenarioEffectif.fondsDepartParCamp?.[c.camp] ?? scenarioEffectif.fondsDepart, revenu: scenarioEffectif.revenusParBatimentParCamp?.[c.camp] ?? scenarioEffectif.revenusParBatiment, ia: c.ia ?? t(locale, 'mode.joueur') })}</li>)}</ul>
          <p>{t(locale, 'mode.regles', { brouillard: scenarioEffectif.brouillard ? t(locale, 'reglages.actif') : t(locale, 'reglages.inactif'), bulletin: scenarioEffectif.previsionJournees ?? 2, jauge: scenarioEffectif.vitesseJaugeJoueur ?? 1 })}</p>
          {mode === 'difficile' && scenario.code === 'aube_releve_1v3' ? <p>{t(locale, 'mode.siege')}</p> : null}
          <Link href="/reglages">{t(locale, 'mode.changer')}</Link>
        </section>
        {rappels.length > 0 ? <section className="atlas-conseils"><h2>{t(locale, 'aube.consequences')}</h2>{rappels.map((r) => <p key={r}>{r}</p>)}</section> : null}
        {ancienFormat ? <p role="status">{t(locale, 'campagne.ancien_format')}</p> : null}
        {!stockageDisponible ? <p role="status">{t(locale, 'campagne.sauvegarde_indisponible')}</p> : null}
        <div className="campagne-actions">
          {fin ? <>
            {gagne && codeSuivant && !decisionEnAttente ? <Link className="atlas-bouton" href={`/jeu/${codeSuivant}`}>{t(locale, 'campagne.suivante')}</Link> : null}
            {/* Rejouer était **toujours** le bouton secondaire, y compris sur une
                manche perdue où c'est la seule chose à faire : l'écran de défaite
                n'avait donc aucune action principale. Il n'est en retrait que
                lorsqu'une mission suivante lui dispute la place. */}
            <button className={`atlas-bouton${gagne && codeSuivant ? ' secondaire' : ''}`} onClick={rejouer}>{t(locale, 'campagne.rejouer')}</button>
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
