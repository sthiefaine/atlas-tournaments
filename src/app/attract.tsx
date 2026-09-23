'use client';

import { useEffect, useRef } from 'react';

import { jouerTour, strategie } from '@/ai/index';
import {
  appliquer, arriveeLibre, casesAtteignables, chargerCatalogue, cleCase, creerPartie,
  depuisCle, portee, restaurerRng, sceneDepuis, uniteParId,
  type Catalogue, type CommandantMoteur, type EtatPartie,
} from '@/engine/index';
import { t } from '@/i18n/index';
import {
  ambianceDe, casesObjectifs, commandantsDuScenario,
  type Surbrillance, type VueInteraction,
} from '@/render/index';
import { creerRendu2d } from '@/render2d/index';
import { moteur2dDisponible } from '@/render2d/gl';
import { validerMapDef, validerScenario, type Biome } from '@/schemas/index';

import carteDemo from '../../content/cartes/carte_plaine_symetrique.json';
import scenarioDemo from '../../content/scenarios/demo.json';

/**
 * L'**attract mode** de l'accueil : une vraie partie, jouée par l'IA des deux
 * côtés, en boucle, derrière le titre.
 *
 * C'est ce qu'un écran-titre doit faire — montrer le jeu plutôt que le décrire —
 * et c'est ici possible sans un octet d'illustration : le moteur, l'IA et le
 * rendu existent déjà, et chaque partie est **déterministe** — c'est le moteur,
 * on n'y touche pas ; seule la graine change d'une visite à l'autre.
 *
 * Ce que ça coûte est assumé : ce module tire le moteur, l'IA et la peau, soit
 * une bonne part du bundle de jeu. Il est donc **chargé après l'hydratation**
 * (`vitrine.tsx`, `next/dynamic` avec `ssr: false`), jamais dans le rendu
 * initial ; le fond de l'attente est la nappe sombre de l'écran-titre, et le
 * plateau SVG du serveur ne paraît qu'en repli.
 *
 * **Depuis le 23 septembre 2026, il joue sur la peau 2D** (`creerRendu2d`, les
 * images cuites) comme le jeu. Elle ouvre un contexte WebGL 2 en quelques
 * millisecondes et ne tire ni three ni le moteur WebGPU : c'est ce qui lui
 * rend le **téléphone**, où l'accueil était resté immobile pour épargner la 3D.
 *
 * Il ne se déclare `pret` qu'une fois une image réellement dessinée, pas une
 * fois monté (8 septembre 2026) : la vitrine attend ce signal pour le montrer,
 * et un canevas vide annoncé comme prêt, c'est un trou noir derrière le titre.
 * `surPret` et `surEchec` sont ce contrat.
 *
 * Trois économies, parce qu'une page d'accueil n'a pas le droit de chauffer un
 * appareil : la boucle de la peau dort quand rien ne bouge, aucune IA ne tourne
 * tant que l'onglet est en arrière-plan, et rien ne se monte sans WebGL 2 ni
 * sous animations réduites — celles de l'appareil ou celles du joueur.
 *
 * On montre en plus la **grammaire du jeu** : avant chaque déplacement, la
 * portée de l'unité s'allume en vert et la flèche trace son chemin. C'est
 * exactement ce que verra le joueur une minute plus tard, et cela s'apprend en
 * regardant.
 */

/**
 * Les graines d'exhibition. Chaque partie reste **déterministe** — c'est le
 * moteur, on ne touche pas à ça —, mais on ne rejoue pas la même à chaque
 * visite : un écran-titre qui repasse le même match coup pour coup se remarque
 * dès la deuxième ouverture.
 */
const GRAINES = ['accueil:1', 'accueil:2', 'accueil:3', 'accueil:4', 'accueil:5'] as const;

/** Pause entre deux actions de l'IA, en millisecondes. */
const MS_ENTRE_ACTIONS = 190;
/** Durée d'affichage de la portée avant qu'une unité ne s'élance. */
const MS_INTENTION = 330;
/** Pause sur l'écran de fin avant de relancer la partie. */
const MS_AVANT_REPRISE = 2600;
/**
 * Au-delà, on renonce : la peau n'a pas dessiné. La vitrine montre alors son
 * plateau SVG et démonte l'attract. La 2D dessine en une image ; le budget ne
 * sert qu'à un onglet qui ne reçoit plus d'images, ou à un contexte perdu.
 */
const MS_BUDGET_PREMIERE_IMAGE = 12_000;
/** Ce qu'une seule image peut retirer de ce budget (voir `toile.tsx`). */
const MS_PAS_MAXIMAL = 200;
/** Garde-fou : au-delà, on repart d'une partie neuve plutôt que de boucler. */
const ACTIONS_MAX = 900;

/** Le scénario d'exhibition et sa carte, validés comme tout contenu du canon. */
function chargerExhibition(): {
  catalogue: Catalogue; etatNeuf: () => EtatPartie;
  commandants: (CommandantMoteur | null)[]; biome: Biome;
} | null {
  const s = validerScenario(scenarioDemo);
  const c = validerMapDef(carteDemo);
  if (!s.ok || !c.ok) return null;
  const catalogue = chargerCatalogue(s.valeur.catalogueVersion);
  const commandants = commandantsDuScenario(s.valeur);
  const scene = sceneDepuis(s.valeur, c.valeur, commandants);
  return {
    catalogue, commandants, biome: c.valeur.biome,
    etatNeuf: (): EtatPartie => creerPartie(
      scene, catalogue, GRAINES[Math.floor(Math.random() * GRAINES.length)] ?? GRAINES[0],
    ),
  };
}

/** Les cases où l'unité peut se poser : le vert que le joueur verra en jouant. */
function porteeVerte(etat: EtatPartie, cat: Catalogue, uniteId: string): Surbrillance[] {
  const u = uniteParId(etat, uniteId);
  if (!u) return [];
  const cles = new Set<string>([cleCase({ x: u.x, y: u.y })]);
  for (const c of casesAtteignables(portee(etat, cat, u))) {
    if (arriveeLibre(etat, c, u.id)) cles.add(cleCase(c));
  }
  return [...cles].map((k) => ({ case: depuisCle(k), genre: 'deplacement' as const }));
}

/**
 * Ce que l'attract doit à la vitrine : dire quand il **dessine réellement**, et
 * dire quand il renonce. Tant qu'il n'a pas dessiné, c'est le plateau SVG qui
 * tient le fond ; c'est ce qui a supprimé les huit secondes de vide mesurées le
 * 8 septembre 2026 (`vitrine.tsx`).
 */
export interface ProprietesAttract {
  /** Une image est passée : la vitrine peut retirer le plateau SVG. */
  surPret?: () => void;
  /** Ni moteur, ni image : la vitrine garde le SVG et nous démonte. */
  surEchec?: () => void;
}

export default function Attract({ surPret, surEchec }: ProprietesAttract = {}) {
  const hote = useRef<HTMLDivElement>(null);
  /**
   * Les rappels passent par une référence, et l'effet ne dépend de rien.
   *
   * C'est une garde, pas une élégance : mesuré le 8 septembre 2026, une simple
   * fonction fléchée passée en propriété — ce que toute page écrit
   * naturellement — changeait d'identité à chaque rendu du parent, l'effet se
   * rejouait, et **tout le moteur 3D était démonté puis reconstruit** juste
   * après la première image, soit sept cents millisecondes de fond noir de
   * plus. Un montage de moteur graphique ne doit pas dépendre de l'identité
   * d'une fonction.
   */
  const rappels = useRef({ surPret, surEchec });
  rappels.current = { surPret, surEchec };

  useEffect(() => {
    const conteneur: HTMLDivElement | null = hote.current;
    const exhibition = chargerExhibition();
    // Un canon illisible n'est pas une raison de casser l'accueil : le plateau
    // SVG reste à l'écran et personne ne voit la différence.
    if (!conteneur || !exhibition) return undefined;
    const { catalogue: cat, commandants, etatNeuf } = exhibition;

    // L'attract se joue sur la peau du jeu, la 2D, et ne se monte pas sans
    // WebGL 2 : le plateau SVG du serveur paraît alors, ce qui est très bien.
    // La vitrine a déjà posé la question ; la reposer ici ne coûte rien — la
    // sonde est mémorisée — et garde ce module sûr s'il est monté seul.
    if (!moteur2dDisponible()) {
      rappels.current.surEchec?.();
      return undefined;
    }
    const rendu = creerRendu2d({
      biome: exhibition.biome,
      paysParCamp: { 0: 'fr', 1: 'lu' },
      surEchec: () => rappels.current.surEchec?.(),
    });
    let vivant = true;
    let etat = etatNeuf();
    let minuterie: ReturnType<typeof setTimeout> | null = null;

    try {
      rendu.monter(conteneur);
    } catch {
      rappels.current.surEchec?.();
      return () => undefined;
    }
    // Le plateau est un fond : il ne prend pas le focus du clavier, qui doit
    // aller droit au menu. La toile de la peau se déclare focalisable pour le
    // jeu, où c'est elle qu'on commande.
    rendu.canvas?.setAttribute('tabindex', '-1');
    conteneur.dataset['rendu'] = rendu.cle;

    function afficher(surbrillances: Surbrillance[] = [], chemin: readonly { x: number; y: number }[] = [], selection: string | null = null): void {
      const vue: VueInteraction = {
        catalogue: cat,
        ambiance: ambianceDe(etat.climat),
        surbrillances: [...casesObjectifs(etat), ...surbrillances],
        chemin,
        curseur: null,
        selection,
        visibles: null,
        attenteIa: false,
        etiquetteQg: t('fr', 'hud.qg'),
      };
      rendu.afficher(etat, vue);
    }

    function pause(ms: number): Promise<void> {
      return new Promise((resoudre) => {
        minuterie = setTimeout(resoudre, ms);
      });
    }

    /** Attend que l'onglet redevienne visible : rien ne tourne dans le vide. */
    function attendreVisible(): Promise<void> {
      if (document.visibilityState === 'visible') return Promise.resolve();
      return new Promise((resoudre) => {
        const surChangement = (): void => {
          if (document.visibilityState !== 'visible') return;
          document.removeEventListener('visibilitychange', surChangement);
          resoudre();
        };
        document.addEventListener('visibilitychange', surChangement);
      });
    }

    /**
     * Cadre le centre de la carte — sur la carte d'exhibition, l'île, ses villes
     * neutres et ses ponts : là où les deux camps vont se rencontrer. On passe
     * par `cadrer` et non `recentrer`, parce que la peau réserve son premier
     * `cadrer` à un cadrage d'ouverture : le consommer ici garantit que l'action
     * suivante ne recadre que si elle sort du champ.
     *
     * Aucun cran de dézoom, contrairement à la 3D : la caméra 2D cadre déjà la
     * carte entière quand elle tient, et sinon s'arrête à 48 pixels par case en
     * portrait (`PIXELS_LISIBLES`) — sur un téléphone, huit colonnes : l'île,
     * ses deux ponts et une rive. On montre une **manœuvre**, pas un plan.
     */
    function cadrerCarte(): void {
      rendu.cadrer({ x: Math.floor(etat.largeur / 2), y: Math.floor(etat.hauteur / 2) });
    }

    /**
     * Attend qu'une image ait **réellement** été dessinée. Le seul témoin est
     * celui de la peau elle-même : `mesurer()` rend zéro appel de dessin tant
     * qu'aucune image n'est passée. On le regarde d'image en image, ce qui ne
     * coûte qu'une lecture de compteurs, et on abandonne au budget plutôt que
     * d'attendre pour toujours.
     */
    function attendrePremiereImage(): Promise<boolean> {
      return new Promise((resoudre) => {
        // Le budget se dépense image par image et non en horloge murale : un
        // onglet en arrière-plan ne reçoit plus d'images, et le temps passé
        // ailleurs n'est pas du temps d'attente.
        let restant = MS_BUDGET_PREMIERE_IMAGE;
        let dernier = Date.now();
        const regarder = (): void => {
          if (!vivant) { resoudre(false); return; }
          const maintenant = Date.now();
          restant -= Math.min(MS_PAS_MAXIMAL, maintenant - dernier);
          dernier = maintenant;
          const m = rendu.mesurer?.();
          if (!m || m.appels > 0) { resoudre(true); return; }
          if (restant <= 0) { resoudre(false); return; }
          requestAnimationFrame(regarder);
        };
        regarder();
      });
    }

    async function boucler(hoteRendu: HTMLDivElement): Promise<void> {
      afficher();
      cadrerCarte();
      // `pret` ne se dit qu'une image dessinée : c'est le drapeau que lit la
      // vitrine pour retirer le plateau SVG, et il annonçait jusqu'ici un
      // canevas vide.
      const dessine = await attendrePremiereImage();
      if (!vivant) return;
      if (!dessine) { rappels.current.surEchec?.(); return; }
      hoteRendu.dataset['attract'] = 'pret';
      rappels.current.surPret?.();
      let jouees = 0;

      while (vivant) {
        await attendreVisible();
        if (!vivant) return;

        if (etat.partie.terminee || jouees > ACTIONS_MAX) {
          await pause(MS_AVANT_REPRISE);
          if (!vivant) return;
          etat = etatNeuf();
          jouees = 0;
          afficher();
          cadrerCarte();
          continue;
        }

        const suite = jouerTour(
          etat, strategie(etat.campCourant === 0 ? 'ponderee' : 'agressive'),
          restaurerRng(etat.graine, etat.flux), cat, commandants,
        ).actions;
        if (suite.length === 0) {
          const r = appliquer(etat, { type: 'finTour' }, cat, commandants);
          if (!r.ok) return;
          etat = r.etat;
          afficher();
          continue;
        }

        for (const action of suite) {
          if (!vivant) return;
          await attendreVisible();
          if (!vivant) return;

          // L'intention avant le geste : la portée s'allume, la flèche se pose,
          // puis l'unité part. C'est la lecture que le joueur devra faire.
          if (action.type === 'ordre' && action.chemin.length > 1) {
            // `cadrer` ne recentre que si la case sort du champ : la caméra
            // suit l'action sans sauter à chaque coup.
            const depart = action.chemin[0];
            if (depart) rendu.cadrer?.(depart);
            afficher(porteeVerte(etat, cat, action.uniteId), action.chemin, action.uniteId);
            await pause(MS_INTENTION);
            if (!vivant) return;
          }

          const avant = etat;
          const r = appliquer(etat, action, cat, commandants);
          if (!r.ok) continue;
          etat = r.etat;
          jouees += 1;
          afficher();
          await rendu.animer(r.evenements, avant).catch(() => undefined);
          if (!vivant) return;
          afficher();
          await pause(MS_ENTRE_ACTIONS);
        }
      }
    }

    void boucler(conteneur).catch(() => undefined);

    return () => {
      vivant = false;
      if (minuterie !== null) clearTimeout(minuterie);
      delete conteneur.dataset['attract'];
      delete conteneur.dataset['rendu'];
      rendu.demonter();
    };
  }, []);

  return <div ref={hote} className="accueil-attract" aria-hidden="true" />;
}
