'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { chargerCatalogue, creerPartie, sceneDepuis, type EtatPartie } from '@/engine/index';
import { resoudreCommandantsScenario } from '@/content/commandants-jeu';
import { ambiance } from '@/render/ambiance';
import { normaliserQualite, type QualiteRendu } from '@/render/qualite';
import type { MesuresRendu, Rendu, VueInteraction } from '@/render/rendu';
import {
  BIOMES, type Biome, type CodePays, type MapDef, type Meteo, type PhaseJour,
  type Saison, type Scenario,
} from '@/schemas/types';
import {
  CHEMIN_BANC, DESCRIPTIONS_GESTES, PAYS_BANC, PRESETS_AMBIANCE, carteBanc, carteGrande, catalogueSilhouettes,
  decoderVue, encoderVue, rejouer, scenarioBanc, surbrillancesBanc, visiblesBanc,
  type DescriptionGeste, type GenreBanc, type GesteBanc, type VueBanc,
} from './banc';
import styles from './atelier.module.css';

/**
 * L'**atelier des mondes** : un banc d'essai, pas une vitrine.
 *
 * Il sert à regarder **tous les rendus possibles** sans avoir à jouer une partie
 * jusqu'à ce qu'ils apparaissent. La version précédente ne montrait que trois
 * cartes de mission en 3D, sans surbrillances ni animations : les défauts qu'on
 * y cherche — un bâtiment coupé par une montagne, une pierre qui flotte, une
 * marée qui ne se voit pas, une flèche qui traverse le relief — étaient
 * précisément ceux qu'elle ne pouvait pas montrer.
 *
 * Ce qui s'y règle : le monde (les trois missions plus la carte-catalogue), le
 * biome, la saison, l'heure, la météo, le **pays de chaque camp** — donc les
 * vingt-quatre jeux de couleurs —, les cinq **surbrillances**, la flèche de
 * chemin, le brouillard, les **silhouettes jamais vues**, et les **gestes**
 * rejouables à la demande.
 *
 * Deux agencements, un seul état. Sur un écran large, la toile prend tout le
 * cadre et un **dock** descend le long du bord gauche, en sections repliables,
 * lui-même repliable en une colonne d'icônes. Sur un téléphone, le même
 * instrument devient une **feuille en bas** à trois hauteurs — poignée seule,
 * un tiers, deux tiers — avec des onglets : le pouce atteint tout, et la carte
 * reste visible au-dessus. Aucun des deux n'est en `position:fixed` : la
 * feuille se cale par `margin-top:auto` dans un conteneur de `100svh`, comme le
 * menu de l'écran-titre, parce que la rétraction de la barre d'adresse iOS fait
 * sauter un élément fixe.
 *
 * **La vue se partage.** Monde, biome, ambiance, pays, brouillard et
 * surbrillances sont reflétés dans l'URL (`?monde=1&biome=neige…`), lus au
 * montage et écrits par `history.replaceState` sans navigation : une vue qui a
 * montré un défaut se colle dans un message et se retrouve au rechargement.
 *
 * Les libellés sont écrits en clair ici, contrairement au reste du site : c'est
 * un instrument d'auteur, il n'est pas traduit et n'a pas à l'être.
 */

interface Monde { nom: string; scenario: Scenario; carte: MapDef }

/** Ce que `window.__atlasBanc` expose en développement (pilotage du banc). */
interface PontBanc {
  mondes: number;
  choisirMonde(n: number): void;
  recentrer(x: number, y: number): void;
  zoomer(sens: number): void;
  tourner(sens: number): void;
  silhouettes(v: boolean): void;
  replier(v: boolean): void;
  /** La hauteur de la feuille mobile : 0 poignée seule, 1 un tiers, 2 deux tiers. Sans effet sur PC. */
  feuille(niveau: 0 | 1 | 2): void;
  pret(): boolean;
  /** Change la qualité d'affichage sans recharger ni remonter : la chaîne bascule à l'image suivante, caméra immobile. */
  qualite(v: QualiteRendu): void;
  /** Le coût de la dernière image (`16-realisme.md` A6), ou `null` avant la première. */
  mesurer(): MesuresRendu | null;
  /**
   * Rejoue un geste du dock, comme son bouton. La promesse tient jusqu'à la
   * dernière image de l'animation — c'est ce qui permet de mesurer la cadence
   * **pendant** qu'un geste joue — et rend faux si le geste n'avait rien à montrer.
   */
  jouer(cle: GesteBanc): Promise<boolean>;
  /** Revient à l'état de départ du monde, sans animation : de quoi rejouer un geste en boucle. */
  neuf(): void;
  /** Une image PNG en `data:` de la toile seule — ni dock, ni barre — : les captures de référence. */
  capturer(): string | null;
}

/** Deux relevés identiques à l'affichage près : on ne repeint pas le dock pour rien. */
function memesMesures(a: MesuresRendu, b: MesuresRendu): boolean {
  return a.triangles === b.triangles && a.appels === b.appels && a.composeur === b.composeur
    && a.msCalibration === b.msCalibration && Math.abs(a.msParImage - b.msParImage) < 0.05
    && JSON.stringify(a.familles ?? null) === JSON.stringify(b.familles ?? null);
}

const QUALITES: readonly (readonly [QualiteRendu, string])[] = [['auto', 'Auto'], ['basse', 'Basse']];

const NOMS_BIOMES: Record<Biome, string> = { plaine: 'Bocage', foret: 'Forêt', montagne: 'Montagne', desert: 'Désert', jungle: 'Jungle', neige: 'Terres gelées', volcanique: 'Volcanique', cotier: 'Littoral', archipel: 'Archipel', marais: 'Marais' };
const SAISONS: readonly (readonly [Saison, string])[] = [['printemps', 'Printemps'], ['ete', 'Été'], ['automne', 'Automne'], ['hiver', 'Hiver']];
const PHASES: readonly (readonly [PhaseJour, string])[] = [['jour', 'Jour'], ['nuit', 'Nuit']];
const METEOS: readonly (readonly [Meteo, string])[] = [['clair', 'Ciel clair'], ['pluie', 'Pluie'], ['neige', 'Neige'], ['brouillard', 'Brouillard'], ['tempete', 'Tempête'], ['canicule', 'Canicule']];
const GENRES: readonly (readonly [GenreBanc, string])[] = [['deplacement', 'Déplacement'], ['attaque', 'Tir'], ['capture', 'Objectif'], ['production', 'Chantier'], ['danger', 'Danger']];
const NOMS_GROUPES: Record<DescriptionGeste['groupe'], string> = { unites: 'Unités', batiments: 'Bâtiments', terrain: 'Terrain', tour: 'Tour' };
const ORDRE_GROUPES: readonly DescriptionGeste['groupe'][] = ['unites', 'batiments', 'terrain', 'tour'];

/** La vue d'ouverture, celle que l'URL complète ou corrige. */
const VUE_DEFAUT: VueBanc = {
  monde: 0, biome: 'plaine', saison: 'printemps', phase: 'jour', meteo: 'clair',
  paysAllie: 'fr', paysAdverse: 'lu', brouillard: false, genres: [],
};

/** Les sept sections du dock, et les cinq onglets de la feuille (le sixième est « Plus »). */
type CleSection = 'monde' | 'ambiance' | 'surbrillances' | 'gestes' | 'limites' | 'camera' | 'rendu';
type CleOnglet = 'monde' | 'ambiance' | 'surbrillances' | 'gestes' | 'plus';
const SECTIONS: readonly { cle: CleSection; nom: string }[] = [
  { cle: 'monde', nom: 'Monde' }, { cle: 'ambiance', nom: 'Ambiance' }, { cle: 'surbrillances', nom: 'Surbrillances' },
  { cle: 'gestes', nom: 'Gestes' }, { cle: 'limites', nom: 'Cas limites' }, { cle: 'camera', nom: 'Caméra' },
  { cle: 'rendu', nom: 'Rendu' },
];
const ONGLETS: readonly { cle: CleOnglet; nom: string }[] = [
  { cle: 'monde', nom: 'Monde' }, { cle: 'ambiance', nom: 'Ambiance' }, { cle: 'surbrillances', nom: 'Surbrillances' },
  { cle: 'gestes', nom: 'Gestes' }, { cle: 'plus', nom: 'Plus' },
];

/** Les glyphes du dock replié et des onglets : un trait par section, sans texte. */
const GLYPHES: Record<CleSection | 'plus' | 'accueil' | 'jouer', string> = {
  monde: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zm0 0c-2.5 2.5-3.5 5.5-3.5 9s1 6.5 3.5 9c2.5-2.5 3.5-5.5 3.5-9s-1-6.5-3.5-9zM3.5 12h17',
  ambiance: 'M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9zM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8',
  surbrillances: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  gestes: 'M7 4.5v15l12-7.5z',
  limites: 'M12 3.5L2.5 20h19zM12 10v4.5M12 17.2v.6',
  camera: 'M10 4h4l1.5 2.5H20a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1h4.5zM12 9.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7z',
  rendu: 'M3 4h18v12H3zM8 20h8M12 16v4M6 13l3-4 3 3 3-5 3 6',
  plus: 'M12 5v14M5 12h14',
  accueil: 'M3.5 11.5L12 4l8.5 7.5M6 10v10h12V10',
  jouer: 'M6 4.5v15l13-7.5z',
};

function Glyphe({ cle }: { cle: keyof typeof GLYPHES }): React.ReactElement {
  return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round"><path d={GLYPHES[cle]} /></svg>;
}

/**
 * Un contrôle segmenté : un groupe de boutons radio pour une liste courte, à la
 * place d'un `<select>` où il fallait deux clics pour voir ce qu'on choisissait.
 */
function Segmente<T extends string>({ nom, valeur, options, surChoix, colonnes }: {
  nom: string; valeur: T; options: readonly (readonly [T, string])[]; surChoix: (v: T) => void; colonnes?: number;
}): React.ReactElement {
  return <div className={styles.champ}>
    <span className={styles.etiquette}>{nom}</span>
    <div className={styles.segmente} role="radiogroup" aria-label={nom} style={colonnes ? { gridTemplateColumns: `repeat(${colonnes}, minmax(0, 1fr))`, gridAutoFlow: 'row' } : undefined}>
      {options.map(([cle, libelle]) => (
        <button key={cle} type="button" role="radio" aria-checked={cle === valeur} onClick={() => surChoix(cle)}>{libelle}</button>
      ))}
    </div>
  </div>;
}

/** Un `<select>`, réservé aux listes trop longues pour un contrôle segmenté. */
function Choix<T extends string | number>({ nom, valeur, options, surChoix }: {
  nom: string; valeur: T; options: readonly (readonly [T, string])[]; surChoix: (v: string) => void;
}): React.ReactElement {
  return <label className={styles.champ}>
    <span className={styles.etiquette}>{nom}</span>
    <select value={valeur} onChange={(e) => surChoix(e.target.value)}>
      {options.map(([cle, libelle]) => <option key={cle} value={cle}>{libelle}</option>)}
    </select>
  </label>;
}

/** L'agencement suit la largeur : `pc` dès 900 px, `mobile` en dessous. Le serveur rend `pc`. */
const REQUETE_PC = '(min-width: 900px)';
function souscrireAgencement(rappel: () => void): () => void {
  const media = window.matchMedia(REQUETE_PC);
  media.addEventListener('change', rappel);
  return () => media.removeEventListener('change', rappel);
}
function useAgencement(): 'pc' | 'mobile' {
  return useSyncExternalStore(souscrireAgencement, () => (window.matchMedia(REQUETE_PC).matches ? 'pc' : 'mobile'), () => 'pc');
}

interface Toast { texte: string; fixe: boolean }

export default function Atelier({ mondes }: { mondes: Monde[] }): React.ReactElement {
  const [index, setIndex] = useState(VUE_DEFAUT.monde);
  const [biome, setBiome] = useState<Biome>(VUE_DEFAUT.biome);
  const [saison, setSaison] = useState<Saison>(VUE_DEFAUT.saison);
  const [phase, setPhase] = useState<PhaseJour>(VUE_DEFAUT.phase);
  const [meteo, setMeteo] = useState<Meteo>(VUE_DEFAUT.meteo);
  const [paysAllie, setPaysAllie] = useState<CodePays>(VUE_DEFAUT.paysAllie);
  const [paysAdverse, setPaysAdverse] = useState<CodePays>(VUE_DEFAUT.paysAdverse);
  const [genres, setGenres] = useState<GenreBanc[]>(VUE_DEFAUT.genres);
  const [flecheVisible, setFleche] = useState(false);
  const [brouillard, setBrouillard] = useState(VUE_DEFAUT.brouillard);
  const [silhouettes, setSilhouettes] = useState(false);
  // La qualité d'affichage du banc, `auto` par défaut comme en jeu. En changer
  // ne remonte pas la peau : `Rendu.qualite()` monte ou démonte la chaîne à
  // l'image suivante, caméra immobile — c'est ce qui rend la comparaison
  // « avec et sans occlusion » équitable. La référence sert au montage, qui
  // ne doit pas dépendre de la qualité.
  const [qualite, setQualite] = useState<QualiteRendu>('auto');
  const qualiteCourante = useRef(qualite);
  qualiteCourante.current = qualite;
  // Le coût de la dernière image, relevé une fois par seconde pour A6.
  const [mesures, setMesures] = useState<MesuresRendu | null>(null);
  // Le statut est un toast en haut de la toile. Il est **fixe** tant que la peau
  // se prépare ou qu'elle a échoué ; un geste sans effet, lui, s'efface seul.
  const [toast, setToast] = useState<Toast | null>({ texte: 'Préparation du monde…', fixe: true });
  const agencement = useAgencement();
  // Le dock se replie : sur un banc, ce qu'on regarde est la carte, et un
  // panneau qui la recouvre rend l'instrument inutilisable.
  const [dockReplie, setDockReplie] = useState(false);
  const [ouvertes, setOuvertes] = useState<readonly CleSection[]>(['monde', 'ambiance', 'surbrillances', 'gestes']);
  // La feuille mobile : 0 poignée seule, 1 un tiers, 2 deux tiers.
  const [niveau, setNiveau] = useState<0 | 1 | 2>(1);
  const [onglet, setOnglet] = useState<CleOnglet>('monde');
  const conteneur = useRef<HTMLDivElement>(null);
  const rendu = useRef<Rendu | null>(null);
  const sections = useRef<Partial<Record<CleSection, HTMLElement | null>>>({});

  const annoncer = useCallback((texte: string, fixe = false): void => {
    setToast(texte ? { texte, fixe } : null);
  }, []);
  useEffect(() => {
    if (!toast || toast.fixe) return;
    const minuterie = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(minuterie);
  }, [toast]);

  // Le banc est un monde comme les autres, ajouté après les trois missions ;
  // la grande carte, celle du budget de `doc/10` §9.2, vient en dernier.
  const catalogue0 = useMemo(() => mondes.map((m) => m), [mondes]);
  // Le scénario est forcé sur le dernier catalogue (`VERSION_CATALOGUE_BANC`) :
  // celui des missions de démonstration est en catalogue 1, qui n'a pas le
  // génie, et le banc l'aurait perdu en silence.
  const banc = useMemo<Monde>(() => ({
    nom: 'Banc d’essai (catalogue)',
    scenario: scenarioBanc(catalogue0[0]!.scenario),
    carte: carteBanc(),
  }), [catalogue0]);
  const grande = useMemo<Monde>(() => ({
    nom: 'Grande carte 24 × 16 (mesure)',
    scenario: scenarioBanc(catalogue0[0]!.scenario),
    carte: carteGrande(),
  }), [catalogue0]);
  const tous = useMemo(() => [...catalogue0, banc, grande], [catalogue0, banc, grande]);
  // L'URL peut porter un index au-delà de la liste : on le borne à l'usage plutôt
  // qu'à la lecture, pour que le `<select>` montre toujours un monde réel.
  const indexSur = Math.min(index, tous.length - 1);
  const monde = tous[indexSur] ?? tous[0]!;

  const catalogueCanon = useMemo(
    () => chargerCatalogue(monde.scenario.catalogueVersion), [monde.scenario.catalogueVersion],
  );
  const catalogue = useMemo(
    () => (silhouettes ? catalogueSilhouettes(catalogueCanon) : catalogueCanon),
    [catalogueCanon, silhouettes],
  );

  const etatNeuf = useMemo(() => creerPartie(
    sceneDepuis(monde.scenario, monde.carte, resoudreCommandantsScenario(monde.scenario)),
    catalogueCanon, 'atelier:1',
  ), [monde, catalogueCanon]);
  // L'état courant peut s'écarter du départ : un geste rejoué déplace une unité,
  // fait monter la marée, prend une ville. On repart du neuf à chaque changement
  // de monde, sans quoi une marée resterait haute d'une carte à l'autre.
  const [etat, setEtat] = useState<EtatPartie>(etatNeuf);
  useEffect(() => { setEtat(etatNeuf); }, [etatNeuf]);

  const vue = useMemo<VueInteraction>(() => ({
    catalogue,
    ambiance: ambiance(saison, phase, meteo),
    surbrillances: surbrillancesBanc(genres),
    chemin: flecheVisible ? CHEMIN_BANC : [],
    curseur: null,
    selection: null,
    visibles: brouillard ? visiblesBanc() : null,
    attenteIa: false,
    etiquetteQg: 'QG',
  }), [catalogue, saison, phase, meteo, genres, flecheVisible, brouillard]);
  const vueCourante = useRef(vue);
  const etatCourant = useRef(etat);
  // Tenus à jour **au rendu**, pas dans un effet : l'effet de montage s'exécute
  // avant celui de l'affichage, et il posait la scène avec l'état du monde
  // précédent — une carte 16 × 12 pour un banc de 20 × 12.
  vueCourante.current = vue;
  etatCourant.current = etat;

  /** L'état, recouvert du climat choisi : les réglages doivent se voir. */
  const habille = useCallback((e: EtatPartie, v: VueInteraction): EtatPartie => ({
    ...e, climat: { ...e.climat, saison: v.ambiance.saison, phase: v.ambiance.phase, meteo: v.ambiance.meteo },
  }), []);

  useEffect(() => {
    let annule = false;
    let courant: Rendu | null = null;
    let debrancher: (() => void) | undefined;
    annoncer('Préparation du monde…', true);

    const poser = (fabrique: () => Rendu): void => {
      if (annule || !conteneur.current) return;
      courant = fabrique();
      courant.monter(conteneur.current);
      const v = vueCourante.current;
      courant.afficher(habille(etatCourant.current, v), v);
      debrancher = courant.brancher({});
      rendu.current = courant;
      // On cadre la carte entière : un banc s'ouvre sur tout ce qu'il montre,
      // pas sur le coin où la caméra s'était arrêtée.
      const e = etatCourant.current;
      courant.recentrer?.({ x: Math.floor(e.largeur / 2), y: Math.floor(e.hauteur / 2) });
      for (let i = 0; i < 4; i += 1) courant.zoomer?.(-1);
      annoncer('');
    };

    void import('@/render3d/index').then(({ creerRendu3d }) => {
      poser(() => creerRendu3d({ biome, paysParCamp: { 0: paysAllie, 1: paysAdverse }, qualite: qualiteCourante.current }));
    }).catch(() => {
      if (annule) return;
      courant?.demonter();
      annoncer('La 3D n’a pas pu démarrer : cet appareil n’a pas de WebGL 2.', true);
    });
    return () => { annule = true; debrancher?.(); courant?.demonter(); rendu.current = null; };
    // `etat` n'est pas une dépendance, et c'est voulu : la peau lit le dernier
    // état par `etatCourant`. Le mettre ici rebâtirait la scène à chaque geste,
    // donc rejouerait le cadrage de caméra et effacerait l'animation qu'on vient
    // tout juste de déclencher.
  }, [biome, paysAllie, paysAdverse, monde, habille, annoncer]);

  // La qualité change sans remonter : la peau monte ou démonte sa chaîne à
  // l'image suivante. Avant que la peau soit là, c'est le montage qui la lit.
  useEffect(() => {
    rendu.current?.qualite?.(qualite);
  }, [qualite]);

  // Le relevé de performance : une lecture par seconde, et seulement si elle
  // a changé, pour ne pas faire repeindre le dock à chaque image immobile.
  useEffect(() => {
    const minuterie = setInterval(() => {
      const m = rendu.current?.mesurer?.() ?? null;
      setMesures((avant) => (avant && m && memesMesures(avant, m) ? avant : m));
    }, 1000);
    return () => clearInterval(minuterie);
  }, []);

  // Cet effet vient **après** celui qui monte la peau, et ce n'est pas un
  // hasard : React les exécute dans l'ordre de déclaration. Sur un changement
  // de monde, la peau est d'abord démontée — `rendu.current` repasse à `null` —
  // de sorte qu'on n'envoie jamais l'état d'une carte à un plateau bâti pour
  // une autre. Le plateau sait désormais encaisser ce cas, mais le lui infliger
  // ferait repeindre les cinq jeux de matières pour rien.
  useEffect(() => {
    vueCourante.current = vue;
    etatCourant.current = etat;
    rendu.current?.afficher(habille(etat, vue), vue);
  }, [etat, vue, habille]);

  // ---- La vue dans l'URL -------------------------------------------------
  const vueBanc = useMemo<VueBanc>(() => ({
    monde: indexSur, biome, saison, phase, meteo, paysAllie, paysAdverse, brouillard, genres,
  }), [indexSur, biome, saison, phase, meteo, paysAllie, paysAdverse, brouillard, genres]);
  const urlLue = useRef(false);
  // L'écriture est déclarée **avant** la lecture : au montage, elle s'exécute
  // d'abord, trouve `urlLue` faux et ne fait rien — sans quoi elle écraserait
  // l'URL partagée avec la vue par défaut avant même de l'avoir lue.
  useEffect(() => {
    if (!urlLue.current) return;
    const requete = encoderVue(vueBanc);
    window.history.replaceState(null, '', `${window.location.pathname}${requete ? `?${requete}` : ''}`);
  }, [vueBanc]);
  useEffect(() => {
    const v = decoderVue(window.location.search.replace(/^\?/, ''), VUE_DEFAUT);
    setIndex(v.monde); setBiome(v.biome); setSaison(v.saison); setPhase(v.phase); setMeteo(v.meteo);
    setPaysAllie(v.paysAllie); setPaysAdverse(v.paysAdverse); setBrouillard(v.brouillard); setGenres([...v.genres]);
    urlLue.current = true;
  }, []);

  // Les gestes lisent l'état du rendu courant ; le pont, posé une fois par
  // liste de mondes, passe par ces références pour ne jamais rejouer un état
  // périmé.
  const jouerRef = useRef<(geste: GesteBanc) => Promise<boolean>>(() => Promise.resolve(false));
  const neufRef = useRef<() => void>(() => undefined);

  // Le pont de mise au point du banc, hors production : c'est par lui qu'un
  // pilotage Playwright choisit un monde, cadre une case et rapproche la caméra
  // pour photographier une figurine de près, ou rejoue un geste en boucle pour
  // mesurer la cadence. Le HUD et le panneau remplacent leur DOM à chaque
  // rendu, ce qui rend le pilotage « au bouton » fragile.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return undefined;
    const g = globalThis as unknown as { __atlasBanc?: PontBanc };
    g.__atlasBanc = {
      mondes: tous.length,
      choisirMonde: (n) => setIndex(Math.max(0, Math.min(tous.length - 1, n))),
      recentrer: (x, y) => rendu.current?.recentrer?.({ x, y }),
      zoomer: (sens) => rendu.current?.zoomer?.(sens),
      tourner: (sens) => rendu.current?.tourner?.(sens),
      silhouettes: (v) => setSilhouettes(v),
      replier: (v) => setDockReplie(v),
      feuille: (n) => setNiveau(n),
      pret: () => rendu.current !== null,
      qualite: (v) => setQualite(normaliserQualite(v)),
      mesurer: () => rendu.current?.mesurer?.() ?? null,
      jouer: (cle) => jouerRef.current(cle),
      neuf: () => neufRef.current(),
      capturer: () => rendu.current?.capturer() ?? null,
    };
    return () => { delete g.__atlasBanc; };
  }, [tous]);

  /**
   * Rejoue un geste : l'état d'abord, l'animation ensuite — comme le jeu. La
   * promesse tient jusqu'à la dernière image, et rend faux si l'état ne
   * permettait rien.
   */
  const jouer = (geste: GesteBanc): Promise<boolean> => {
    const r = rejouer(etat, geste);
    if (!r) {
      const nom = DESCRIPTIONS_GESTES.find((d) => d.cle === geste)?.nom ?? geste;
      annoncer(`Rien à montrer pour « ${nom} » dans cet état.`);
      return Promise.resolve(false);
    }
    annoncer('');
    const avant = etat;
    setEtat(r.apres);
    const v = vueCourante.current;
    rendu.current?.afficher(habille(r.apres, v), v);
    const animation = rendu.current?.animer(r.evenements, habille(avant, v)) ?? Promise.resolve();
    return animation.then(() => true, () => true);
  };
  jouerRef.current = jouer;

  const basculer = (g: GenreBanc): void => setGenres(
    (liste) => (liste.includes(g) ? liste.filter((x) => x !== g) : [...liste, g]),
  );
  const choisirMonde = (valeur: string): void => {
    const n = Number(valeur);
    setIndex(n);
    setBiome(tous[n]!.carte.biome);
  };
  const presetCourant = PRESETS_AMBIANCE.find((p) => p.biome === biome && p.saison === saison && p.phase === phase && p.meteo === meteo)?.cle ?? null;
  const appliquerPreset = (cle: string): void => {
    const p = PRESETS_AMBIANCE.find((x) => x.cle === cle);
    if (!p) return;
    setBiome(p.biome); setSaison(p.saison); setPhase(p.phase); setMeteo(p.meteo);
  };
  const recentrer = (): void => rendu.current?.recentrer?.({ x: Math.floor(etat.largeur / 2), y: Math.floor(etat.hauteur / 2) });
  const remettreANeuf = (): void => { setEtat(etatNeuf); annoncer(''); };
  neufRef.current = remettreANeuf;

  const sectionOuverte = (cle: CleSection): boolean => ouvertes.includes(cle);
  const basculerSection = (cle: CleSection): void => setOuvertes(
    (liste) => (liste.includes(cle) ? liste.filter((x) => x !== cle) : [...liste, cle]),
  );
  /** Depuis le dock replié : on le déplie sur la section demandée, ouverte et amenée à la vue. */
  const deplierSur = (cle: CleSection): void => {
    setDockReplie(false);
    setOuvertes((liste) => (liste.includes(cle) ? liste : [...liste, cle]));
    requestAnimationFrame(() => sections.current[cle]?.scrollIntoView({ block: 'start' }));
  };

  // La poignée de la feuille se glisse : vers le haut, un cran de plus ; vers le
  // bas, un cran de moins. Un simple appui bascule entre replié et un tiers.
  const departGlisse = useRef<number | null>(null);
  const surPoignee = {
    onPointerDown: (e: React.PointerEvent): void => {
      departGlisse.current = e.clientY;
      // Sans capture, le relâchement tombe sur l'élément sous le doigt — les
      // onglets, le panneau — et la poignée ne le voit jamais.
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerUp: (e: React.PointerEvent): void => {
      const depart = departGlisse.current;
      departGlisse.current = null;
      if (depart === null) return;
      const delta = e.clientY - depart;
      if (delta < -40) setNiveau((n) => (n < 2 ? (n + 1) as 1 | 2 : n));
      else if (delta > 40) setNiveau((n) => (n > 0 ? (n - 1) as 0 | 1 : n));
      else setNiveau((n) => (n === 0 ? 1 : 0));
    },
    onPointerCancel: (): void => { departGlisse.current = null; },
  };
  const choisirOnglet = (cle: CleOnglet): void => { setOnglet(cle); setNiveau((n) => (n === 0 ? 1 : n)); };

  // ---- Les blocs de réglages, partagés par le dock et la feuille ---------
  const blocMonde = <div className={styles.grille2}>
    <Choix nom="Monde" valeur={indexSur} options={tous.map((m, i) => [i, m.nom] as const)} surChoix={choisirMonde} />
    <Choix nom="Biome" valeur={biome} options={BIOMES.map((b) => [b, NOMS_BIOMES[b]] as const)} surChoix={(v) => setBiome(v as Biome)} />
    <Choix nom="Camp bleu" valeur={paysAllie} options={PAYS_BANC.map((p) => [p, p.toUpperCase()] as const)} surChoix={setPaysAllie} />
    <Choix nom="Camp rouge" valeur={paysAdverse} options={PAYS_BANC.map((p) => [p, p.toUpperCase()] as const)} surChoix={setPaysAdverse} />
  </div>;

  const blocAmbiance = <>
    <div className={styles.champ}>
      <span className={styles.etiquette}>Scènes prêtes</span>
      <div className={styles.rangPuces} role="group" aria-label="Scènes prêtes">
        {PRESETS_AMBIANCE.map((p) => (
          <button key={p.cle} type="button" className={styles.puce} aria-pressed={presetCourant === p.cle}
            title={`${NOMS_BIOMES[p.biome]} · ${SAISONS.find(([c]) => c === p.saison)?.[1]} · ${p.phase === 'nuit' ? 'Nuit' : 'Jour'} · ${METEOS.find(([c]) => c === p.meteo)?.[1]}`}
            onClick={() => appliquerPreset(p.cle)}>{p.nom}</button>
        ))}
      </div>
    </div>
    <Segmente nom="Saison" valeur={saison} options={SAISONS} surChoix={setSaison} colonnes={agencement === 'pc' ? 2 : 4} />
    <Segmente nom="Heure" valeur={phase} options={PHASES} surChoix={setPhase} />
    <Segmente nom="Météo" valeur={meteo} options={METEOS} surChoix={setMeteo} colonnes={3} />
  </>;

  const blocSurbrillances = <div className={styles.bascules} role="group" aria-label="Surbrillances">
    {GENRES.map(([cle, nom]) => (
      <button key={cle} type="button" className={styles.bascule} data-genre={cle} aria-pressed={genres.includes(cle)}
        onClick={() => basculer(cle)}>{nom}</button>
    ))}
    <button type="button" className={styles.bascule} data-genre="chemin" aria-pressed={flecheVisible}
      onClick={() => setFleche((v) => !v)}>Flèche de chemin</button>
  </div>;

  const boutonGeste = (d: DescriptionGeste): React.ReactElement => (
    <button key={d.cle} type="button" className={styles.geste} title={d.aide} onClick={() => { void jouer(d.cle); }}>
      <strong>{d.nom}</strong><small>{d.aide}</small>
    </button>
  );
  const boutonNeuf = <button type="button" className={styles.geste} data-neuf="oui" title="Revenir à l’état de départ du monde"
    onClick={remettreANeuf}><strong>Remettre à neuf</strong><small>Revenir à l’état de départ du monde</small></button>;
  const blocGestesGroupes = <>
    {ORDRE_GROUPES.map((groupe) => {
      const liste = DESCRIPTIONS_GESTES.filter((d) => d.groupe === groupe);
      if (liste.length === 0) return null;
      return <div key={groupe} className={styles.champ}>
        <span className={styles.etiquette}>{NOMS_GROUPES[groupe]}</span>
        <div className={styles.listeGestes}>{liste.map(boutonGeste)}</div>
      </div>;
    })}
    <div className={styles.listeGestes}>{boutonNeuf}</div>
  </>;
  const blocGestesPuces = <div className={styles.rangPuces} data-gestes="oui" role="group" aria-label="Gestes">
    {DESCRIPTIONS_GESTES.map(boutonGeste)}{boutonNeuf}
  </div>;

  const blocLimites = <div className={styles.bascules} role="group" aria-label="Cas limites">
    <button type="button" className={styles.bascule} aria-pressed={brouillard} onClick={() => setBrouillard((v) => !v)}>Brouillard</button>
    {/* `rail`, `ailes` et `coque` sont écrites dans `pieces.ts` et aucune
        unité du canon ne les porte : ce bouton est le seul endroit d'où on
        peut les voir. */}
    <button type="button" className={styles.bascule} aria-pressed={silhouettes} onClick={() => setSilhouettes((v) => !v)}>Silhouettes inédites</button>
  </div>;

  const blocCamera = <div className={styles.camera}>
    <button type="button" aria-label="Tourner la caméra vers la gauche" onClick={() => rendu.current?.tourner?.(-1)}>↺</button>
    <button type="button" aria-label="Éloigner la caméra" onClick={() => rendu.current?.zoomer?.(-1)}>−</button>
    <button type="button" aria-label="Rapprocher la caméra" onClick={() => rendu.current?.zoomer?.(1)}>+</button>
    <button type="button" aria-label="Tourner la caméra vers la droite" onClick={() => rendu.current?.tourner?.(1)}>↻</button>
    <button type="button" onClick={recentrer}>Recentrer</button>
  </div>;

  const note = <p className={styles.note}>
    Glissez la carte · Pincez pour zoomer · Q et E pour tourner. Le banc rejoue des <strong>événements</strong>,
    pas des règles : rien ici n’est une partie légale, et rien n’est enregistré.
  </p>;

  // La qualité et le relevé de la dernière image : c'est ici qu'on compare
  // « avec » et « sans » post-traitement (`16-realisme.md` A6). Les compteurs
  // couvrent l'image entière, ombres comprises ; avec le post-traitement, la
  // scène y est dessinée deux fois (couleur, puis normales et profondeur).
  const blocRendu = <>
    <Segmente nom="Qualité" valeur={qualite} options={QUALITES} surChoix={setQualite} colonnes={3} />
    <div className={styles.champ}>
      <span className={styles.etiquette}>Dernière image</span>
      <p className={styles.note} data-mesures="oui">
        {mesures
          ? `${mesures.triangles.toLocaleString('fr-FR')} triangles · ${mesures.appels} appels · ${mesures.msParImage.toFixed(1)} ms · ${mesures.composeur ? 'avec' : 'sans'} post-traitement`
          : 'Pas encore d’image.'}
      </p>
      {/* Par famille, sur la scène entière : les appels sont approchés par les
          mailles, la passe d'ombres n'y est pas. */}
      {mesures?.familles
        ? <p className={styles.note} data-familles="oui">
          {Object.entries(mesures.familles)
            .map(([nom, f]) => `${nom} ${f.triangles.toLocaleString('fr-FR')} tri / ${f.mailles} mailles`)
            .join(' · ')}
        </p>
        : null}
    </div>
  </>;

  const contenuSection: Record<CleSection, React.ReactElement> = {
    monde: blocMonde, ambiance: blocAmbiance, surbrillances: blocSurbrillances,
    gestes: blocGestesGroupes, limites: blocLimites, camera: blocCamera, rendu: blocRendu,
  };

  return <main className={styles.atelier} data-agencement={agencement} data-dock={dockReplie ? 'replie' : 'ouvert'} data-niveau={niveau}>
    <div ref={conteneur} className={styles.monde} aria-label="Aperçu interactif : glissez pour déplacer la carte, pincez pour zoomer" />
    <div className={styles.toast} role="status" aria-live="polite">{toast ? <span>{toast.texte}</span> : null}</div>

    <header className={styles.barre}>
      <div className={styles.titre}>
        <nav aria-label="Fil d’Ariane" className={styles.ariane}><Link href="/">Atlas</Link><span aria-hidden="true">/</span><span>Banc d’essai</span></nav>
        <h1>Atelier des mondes</h1>
      </div>
      <Link href="/" className={styles.accueil}><Glyphe cle="accueil" /><span>Accueil</span></Link>
      <Link href="/atelier/unites" className={styles.accueil}><span>Vitrine des unités</span></Link>
      <Link href={`/jeu/${monde.scenario.code}`} className={styles.jouerLien}><Glyphe cle="jouer" /><span>Jouer cette mission</span></Link>
    </header>

    {agencement === 'pc'
      ? <aside className={styles.dock} aria-label="Réglages du banc">
        <button type="button" className={styles.replier} aria-expanded={!dockReplie}
          aria-label={dockReplie ? 'Déplier les réglages' : 'Replier les réglages'}
          onClick={() => setDockReplie((v) => !v)}>
          <span aria-hidden="true">{dockReplie ? '»' : '«'}</span>{dockReplie ? null : <span>Replier</span>}
        </button>
        {dockReplie
          ? <div className={styles.icones}>
            {SECTIONS.map((s) => <button key={s.cle} type="button" title={s.nom} aria-label={s.nom} onClick={() => deplierSur(s.cle)}><Glyphe cle={s.cle} /></button>)}
          </div>
          : <div className={styles.sections}>
            {SECTIONS.map((s) => (
              <section key={s.cle} className={styles.section} ref={(el) => { sections.current[s.cle] = el; }}>
                <h2><button type="button" aria-expanded={sectionOuverte(s.cle)} onClick={() => basculerSection(s.cle)}>
                  <Glyphe cle={s.cle} /><span>{s.nom}</span><i aria-hidden="true" />
                </button></h2>
                {sectionOuverte(s.cle) ? <div className={styles.corps}>{contenuSection[s.cle]}</div> : null}
              </section>
            ))}
            {note}
          </div>}
      </aside>
      : <section className={styles.feuille} data-niveau={niveau} aria-label="Réglages du banc">
        <button type="button" className={styles.poignee} aria-expanded={niveau > 0}
          aria-label={niveau === 0 ? 'Ouvrir les réglages' : 'Replier les réglages'} {...surPoignee}>
          <i aria-hidden="true" /><span>{niveau === 0 ? 'Réglages' : ONGLETS.find((o) => o.cle === onglet)?.nom}</span>
          <span className={styles.niveauBouton} aria-hidden="true">{niveau === 2 ? '▾' : '▴'}</span>
        </button>
        <div className={styles.onglets} role="tablist" aria-label="Réglages">
          {ONGLETS.map((o) => (
            <button key={o.cle} type="button" role="tab" id={`onglet-${o.cle}`} aria-selected={onglet === o.cle}
              aria-controls="panneau-banc" onClick={() => choisirOnglet(o.cle)}><Glyphe cle={o.cle} /><span>{o.nom}</span></button>
          ))}
        </div>
        <div id="panneau-banc" role="tabpanel" aria-labelledby={`onglet-${onglet}`} className={styles.panneau}>
          {onglet === 'monde' ? blocMonde : null}
          {onglet === 'ambiance' ? blocAmbiance : null}
          {onglet === 'surbrillances' ? blocSurbrillances : null}
          {onglet === 'gestes' ? blocGestesPuces : null}
          {onglet === 'plus' ? <>
            <div className={styles.champ}><span className={styles.etiquette}>Cas limites</span>{blocLimites}</div>
            <div className={styles.champ}><span className={styles.etiquette}>Caméra</span>{blocCamera}</div>
            {blocRendu}
            {note}
          </> : null}
        </div>
      </section>}
  </main>;
}
