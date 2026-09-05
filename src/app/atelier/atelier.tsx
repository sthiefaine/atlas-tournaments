'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chargerCatalogue, creerPartie, sceneDepuis, type EtatPartie } from '@/engine/index';
import { resoudreCommandantsScenario } from '@/content/commandants-jeu';
import { ambiance } from '@/render/ambiance';
import type { Rendu, VueInteraction } from '@/render/rendu';
import {
  BIOMES, type Biome, type CodePays, type MapDef, type Meteo, type PhaseJour,
  type Saison, type Scenario,
} from '@/schemas/types';
import {
  CHEMIN_BANC, GESTES_BANC, carteBanc, catalogueSilhouettes, rejouer, scenarioBanc,
  surbrillancesBanc, visiblesBanc, type GenreBanc, type GesteBanc,
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
 * biome, la saison, l'heure, la météo, le **pays de chaque camp** — donc les vingt-quatre
 * jeux de couleurs —, les cinq **surbrillances**, la flèche de chemin, le
 * brouillard, les **silhouettes jamais vues**, et six **gestes** rejouables à la
 * demande.
 *
 * Les libellés sont écrits en clair ici, contrairement au reste du site : c'est
 * un instrument d'auteur, il n'est pas traduit et n'a pas à l'être.
 */

interface Monde { nom: string; scenario: Scenario; carte: MapDef }

const NOMS_BIOMES: Record<Biome, string> = { plaine: 'Bocage', foret: 'Forêt', montagne: 'Montagne', desert: 'Désert', jungle: 'Jungle', neige: 'Terres gelées', volcanique: 'Volcanique', cotier: 'Littoral', archipel: 'Archipel', marais: 'Marais' };
const SAISONS: [Saison, string][] = [['printemps', 'Printemps'], ['ete', 'Été'], ['automne', 'Automne'], ['hiver', 'Hiver']];
const METEOS: [Meteo, string][] = [['clair', 'Ciel clair'], ['pluie', 'Pluie'], ['neige', 'Neige'], ['brouillard', 'Brouillard'], ['tempete', 'Tempête'], ['canicule', 'Canicule']];
const GENRES: [GenreBanc, string][] = [['deplacement', 'Déplacement'], ['attaque', 'Tir'], ['capture', 'Objectif'], ['production', 'Chantier'], ['danger', 'Danger']];
const GESTES: Record<GesteBanc, string> = {
  deplacement: 'Déplacer', attaque: 'Tirer', capture: 'Capturer',
  hors_jeu: 'Mettre hors jeu', maree_haute: 'Marée haute', maree_basse: 'Marée basse',
};

/** Les vingt-quatre nations de la Ronde : chacune a ses couleurs. */
const PAYS: readonly CodePays[] = [
  'ar', 'au', 'br', 'ca', 'ch', 'fj', 'fr', 'gr', 'id', 'in', 'is', 'jp',
  'ke', 'lu', 'ma', 'mg', 'mn', 'mx', 'na', 'nl', 'np', 'nz', 'pe', 'sn',
];

export default function Atelier({ mondes }: { mondes: Monde[] }): React.ReactElement {
  const [index, setIndex] = useState(0);
  const [biome, setBiome] = useState<Biome>('plaine');
  const [saison, setSaison] = useState<Saison>('printemps');
  const [phase, setPhase] = useState<PhaseJour>('jour');
  const [meteo, setMeteo] = useState<Meteo>('clair');
  const [paysAllie, setPaysAllie] = useState<CodePays>('fr');
  const [paysAdverse, setPaysAdverse] = useState<CodePays>('lu');
  const [genres, setGenres] = useState<GenreBanc[]>([]);
  const [flecheVisible, setFleche] = useState(false);
  const [brouillard, setBrouillard] = useState(false);
  const [silhouettes, setSilhouettes] = useState(false);
  const [statut, setStatut] = useState('Préparation du monde…');
  // Le panneau se replie : sur un banc, ce qu'on regarde est la carte, et un
  // panneau qui la recouvre aux deux tiers rend l'instrument inutilisable.
  const [replie, setReplie] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);
  const rendu = useRef<Rendu | null>(null);

  // Le banc est un monde comme les autres, ajouté après les trois missions.
  const catalogue0 = useMemo(() => mondes.map((m) => m), [mondes]);
  // Le scénario est forcé sur le catalogue 2 : celui des missions de démonstration
  // est en catalogue 1, qui n'a pas le génie, et le banc l'aurait perdu en silence.
  const banc = useMemo<Monde>(() => ({
    nom: 'Banc d’essai (catalogue)',
    scenario: scenarioBanc(catalogue0[0]!.scenario),
    carte: carteBanc(),
  }), [catalogue0]);
  const tous = useMemo(() => [...catalogue0, banc], [catalogue0, banc]);
  const monde = tous[index] ?? tous[0]!;

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

  /** L'état, recouvert du climat choisi : les réglages doivent se voir. */
  const habille = useCallback((e: EtatPartie, v: VueInteraction): EtatPartie => ({
    ...e, climat: { ...e.climat, saison: v.ambiance.saison, phase: v.ambiance.phase, meteo: v.ambiance.meteo },
  }), []);

  useEffect(() => {
    let annule = false;
    let courant: Rendu | null = null;
    let debrancher: (() => void) | undefined;
    setStatut('Préparation du monde…');

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
      setStatut('');
    };

    void import('@/render3d/index').then(({ creerRendu3d }) => {
      poser(() => creerRendu3d({ biome, paysParCamp: { 0: paysAllie, 1: paysAdverse } }));
    }).catch(() => {
      if (annule) return;
      courant?.demonter();
      setStatut('La 3D n’a pas pu démarrer : cet appareil n’a pas de WebGL 2.');
    });
    return () => { annule = true; debrancher?.(); courant?.demonter(); rendu.current = null; };
    // `etat` n'est pas une dépendance, et c'est voulu : la peau lit le dernier
    // état par `etatCourant`. Le mettre ici rebâtirait la scène à chaque geste,
    // donc rejouerait le cadrage de caméra et effacerait l'animation qu'on vient
    // tout juste de déclencher.
  }, [biome, paysAllie, paysAdverse, monde, habille]);

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

  /** Rejoue un geste : l'état d'abord, l'animation ensuite — comme le jeu. */
  const jouer = (geste: GesteBanc): void => {
    const r = rejouer(etat, geste);
    if (!r) { setStatut(`Rien à montrer pour « ${GESTES[geste]} » dans cet état.`); return; }
    setStatut('');
    const avant = etat;
    setEtat(r.apres);
    const v = vueCourante.current;
    rendu.current?.afficher(habille(r.apres, v), v);
    void rendu.current?.animer(r.evenements, habille(avant, v)).catch(() => undefined);
  };

  const basculer = (g: GenreBanc): void => setGenres(
    (liste) => (liste.includes(g) ? liste.filter((x) => x !== g) : [...liste, g]),
  );

  return <main className={styles.atelier}>
    <header className={styles.entete}>
      <div><span>ATLAS / BANC D’ESSAI</span><h1>Atelier des mondes</h1></div>
      <Link href="/">Accueil ↗</Link>
    </header>

    <div ref={conteneur} className={styles.monde} aria-label="Aperçu interactif : glissez pour déplacer la carte, pincez pour zoomer" />
    {statut ? <p className={styles.statut} role="status">{statut}</p> : null}

    <button type="button" className={styles.replier} aria-expanded={!replie}
      onClick={() => setReplie((v) => !v)}>{replie ? 'Réglages ▲' : 'Masquer ▼'}</button>

    <aside className={styles.panneau} data-replie={replie ? 'oui' : 'non'} aria-label="Réglages du banc" hidden={replie}>
      <div className={styles.reglages}>
        <label>Monde<select value={index} onChange={(e) => {
          const n = Number(e.target.value);
          setIndex(n);
          setBiome(tous[n]!.carte.biome);
        }}>{tous.map((m, i) => <option key={m.nom} value={i}>{m.nom}</option>)}</select></label>
        <label>Biome<select value={biome} onChange={(e) => setBiome(e.target.value as Biome)}>{BIOMES.map((b) => <option key={b} value={b}>{NOMS_BIOMES[b]}</option>)}</select></label>
        <label>Saison<select value={saison} onChange={(e) => setSaison(e.target.value as Saison)}>{SAISONS.map(([cle, nom]) => <option key={cle} value={cle}>{nom}</option>)}</select></label>
        <label>Heure<select value={phase} onChange={(e) => setPhase(e.target.value as PhaseJour)}><option value="jour">Jour</option><option value="nuit">Nuit</option></select></label>
        <label>Météo<select value={meteo} onChange={(e) => setMeteo(e.target.value as Meteo)}>{METEOS.map(([cle, nom]) => <option key={cle} value={cle}>{nom}</option>)}</select></label>
        <label>Camp bleu<select value={paysAllie} onChange={(e) => setPaysAllie(e.target.value as CodePays)}>{PAYS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}</select></label>
        <label>Camp rouge<select value={paysAdverse} onChange={(e) => setPaysAdverse(e.target.value as CodePays)}>{PAYS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}</select></label>
      </div>

      <fieldset className={styles.groupe}>
        <legend>Surbrillances</legend>
        {GENRES.map(([cle, nom]) => (
          <button key={cle} type="button" aria-pressed={genres.includes(cle)}
            className={genres.includes(cle) ? styles.actif : ''} onClick={() => basculer(cle)}>{nom}</button>
        ))}
        <button type="button" aria-pressed={flecheVisible} className={flecheVisible ? styles.actif : ''}
          onClick={() => setFleche((v) => !v)}>Flèche</button>
      </fieldset>

      <fieldset className={styles.groupe}>
        <legend>Gestes</legend>
        {GESTES_BANC.map((g) => (
          <button key={g} type="button" onClick={() => jouer(g)}>{GESTES[g]}</button>
        ))}
        <button type="button" onClick={() => { setEtat(etatNeuf); setStatut(''); }}>Remettre à neuf</button>
      </fieldset>

      <fieldset className={styles.groupe}>
        <legend>Cas limites</legend>
        <button type="button" aria-pressed={brouillard} className={brouillard ? styles.actif : ''}
          onClick={() => setBrouillard((v) => !v)}>Brouillard</button>
        {/* `rail`, `ailes` et `coque` sont écrites dans `pieces.ts` et aucune
            unité du canon ne les porte : ce bouton est le seul endroit d'où on
            peut les voir. */}
        <button type="button" aria-pressed={silhouettes} className={silhouettes ? styles.actif : ''}
          onClick={() => setSilhouettes((v) => !v)}>Silhouettes inédites</button>
      </fieldset>

      <div className={styles.actions}>
        <div>
          <button aria-label="Éloigner la caméra" onClick={() => rendu.current?.zoomer?.(-1)}>−</button>
          <button aria-label="Rapprocher la caméra" onClick={() => rendu.current?.zoomer?.(1)}>+</button>
          <button onClick={() => rendu.current?.recentrer?.({ x: Math.floor(etat.largeur / 2), y: Math.floor(etat.hauteur / 2) })}>Recentrer</button>
        </div>
        <Link href={`/jeu/${monde.scenario.code}`}>Jouer cette mission →</Link>
      </div>

      <p>
        Glissez la carte · Pincez pour zoomer. Le banc rejoue des <strong>événements</strong>,
        pas des règles : rien ici n’est une partie légale, et rien n’est enregistré.
      </p>
    </aside>
  </main>;
}
