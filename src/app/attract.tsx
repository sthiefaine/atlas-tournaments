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
import { creerRendu3d, rendu3dDisponible } from '@/render3d/index';
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
 * Ce que ça coûte est assumé : ce module tire le moteur, l'IA et le rendu, soit
 * une bonne part du bundle de jeu. Il est donc **chargé après l'hydratation**
 * (`vitrine.tsx`, `next/dynamic` avec `ssr: false`), jamais dans le rendu
 * initial — le plateau SVG du serveur tient la place en attendant, et reste seul
 * si le visiteur demande à ne pas voir d'animation.
 *
 * Et il tient la place **jusqu'au bout** : depuis le 8 septembre 2026, cet
 * attract ne se déclare `pret` qu'une fois une image réellement dessinée, pas
 * une fois monté. Le drapeau `data-attract='pret'` mentait de plusieurs secondes
 * — sur le serveur de développement, cinq —, et la vitrine retirait le SVG à ce
 * signal : le visiteur regardait un fond vide pendant que le moteur WebGPU
 * traduisait ses nuanceurs. `surPret` et `surEchec` sont ce contrat.
 *
 * Trois économies, parce qu'une page d'accueil n'a pas le droit de chauffer un
 * appareil : la boucle s'arrête quand l'onglet passe en arrière-plan, aucune IA
 * ne tourne tant qu'on ne la regarde pas, et rien ne se monte sans moteur —
 * WebGPU ou WebGL 2 — ni sous `prefers-reduced-motion`.
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
/**
 * Crans de dézoom au cadrage, depuis le cadrage de la carte entière que le rendu
 * fait à son montage — qui borne déjà les cases à 64 px, donc ne montre qu'un
 * tiers de la carte sur un téléphone. Quatre crans sur un écran étroit ramènent
 * la case à 48 px, la limite de lisibilité du rendu, et l'écran voit huit
 * colonnes : l'île, ses deux ponts et une rive. Jamais six : la carte entière
 * tenue dans la largeur d'un téléphone donne des cases de vingt pixels, où l'on
 * ne distingue ni une unité, ni le vert, ni le rouge. Sur un grand écran, la
 * carte entière tient à 80 px la case : dézoomer ne ferait que la rétrécir dans
 * le vide. On montre une **manœuvre**, pas un plan.
 */
function cransDezoom(): number {
  return window.innerWidth < 720 ? 4 : 0;
}
/** Pause sur l'écran de fin avant de relancer la partie. */
const MS_AVANT_REPRISE = 2600;
/**
 * Au-delà, on renonce : le moteur n'a pas dessiné. La vitrine garde son plateau
 * SVG et démonte l'attract. Large exprès — un moteur WebGPU sur pilote froid met
 * plus d'une seconde à sortir sa première image (`doc/10` §9.4) —, mais fini.
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

    // Le rendu vectoriel n'existe plus : l'attract se joue en 3D comme le jeu,
    // et ne se monte pas du tout sans moteur — WebGPU, ou son repli WebGL 2 :
    // le plateau SVG du serveur reste alors seul à l'écran, ce qui est très bien.
    if (!rendu3dDisponible()) {
      rappels.current.surEchec?.();
      return undefined;
    }
    const rendu = creerRendu3d({
      biome: exhibition.biome,
      paysParCamp: { 0: 'fr', 1: 'lu' },
      // Un écran-titre n'a pas besoin d'occlusion ni de grain, et `basse` lui
      // épargne le téléchargement des modules de post-traitement.
      qualite: 'basse',
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
     * neutres et ses ponts : là où les deux camps vont se rencontrer. Le monde 3D
     * n'existe qu'après le premier `afficher()` : appelé avant, ce cadrage ne
     * faisait rien, et la caméra restait sur la carte entière jusqu'à la
     * première reprise. On passe par `cadrer` et non `recentrer`, parce que le
     * rendu réserve son premier `cadrer` à un centrage franc : le consommer ici
     * garantit que l'action suivante ne recadre que si elle sort du champ.
     */
    function cadrerCarte(): void {
      rendu.cadrer?.({ x: Math.floor(etat.largeur / 2), y: Math.floor(etat.hauteur / 2) });
      // `limiter()` borne le dézoom à la distance qui garde une case lisible :
      // on ne peut pas reculer trop loin, quelle que soit la taille de l'écran.
      const crans = cransDezoom();
      for (let i = 0; i < crans; i += 1) rendu.zoomer?.(-1);
    }

    /**
     * Attend qu'une image ait **réellement** été dessinée. Le seul témoin est
     * celui du moteur lui-même : `mesurer()` rend un dos nul tant qu'il n'a pas
     * démarré, et zéro appel de dessin tant qu'aucune image n'est passée. On le
     * regarde d'image en image, ce qui ne coûte qu'une lecture de compteurs, et
     * on abandonne au budget plutôt que d'attendre pour toujours.
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
      rendu.demonter();
    };
  }, []);

  return <div ref={hote} className="accueil-attract" aria-hidden="true" />;
}
