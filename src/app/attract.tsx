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
  ambianceDe, casesObjectifs, commandantsDuScenario, webgl2Disponible,
  type Surbrillance, type VueInteraction,
} from '@/render/index';
import { creerRendu3d } from '@/render3d/index';
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
 * Trois économies, parce qu'une page d'accueil n'a pas le droit de chauffer un
 * appareil : la boucle s'arrête quand l'onglet passe en arrière-plan, aucune IA
 * ne tourne tant qu'on ne la regarde pas, et rien ne se monte sans WebGL 2 ni
 * sous `prefers-reduced-motion`.
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
 * Crans de dézoom au cadrage. Trois sur un grand écran, quatre sur un écran
 * étroit — jamais six : la carte entière tenue dans la largeur d'un téléphone
 * donne des cases de vingt pixels, où l'on ne distingue ni une unité, ni le
 * vert, ni le rouge. À l'autre bout, un cadrage trop serré en portrait remplit
 * l'écran d'une seule portée. On montre une **manœuvre**, pas un plan.
 */
function cransDezoom(): number {
  return window.innerWidth < 720 ? 4 : 3;
}
/** Pause sur l'écran de fin avant de relancer la partie. */
const MS_AVANT_REPRISE = 2600;
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

export default function Attract() {
  const hote = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const conteneur: HTMLDivElement | null = hote.current;
    const exhibition = chargerExhibition();
    // Un canon illisible n'est pas une raison de casser l'accueil : le plateau
    // SVG reste à l'écran et personne ne voit la différence.
    if (!conteneur || !exhibition) return undefined;
    const { catalogue: cat, commandants, etatNeuf } = exhibition;

    // Le rendu vectoriel n'existe plus : l'attract se joue en 3D comme le jeu,
    // et ne se monte pas du tout sans WebGL 2 — le plateau SVG du serveur reste
    // alors seul à l'écran, ce qui est très bien.
    if (!webgl2Disponible()) return undefined;
    const rendu = creerRendu3d({
      biome: exhibition.biome,
      paysParCamp: { 0: 'fr', 1: 'lu' },
    });
    let vivant = true;
    let etat = etatNeuf();
    let minuterie: ReturnType<typeof setTimeout> | null = null;

    try {
      rendu.monter(conteneur);
    } catch {
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

    function cadrerCarte(): void {
      rendu.recentrer?.({ x: Math.floor(etat.largeur / 2), y: Math.floor(etat.hauteur / 2) });
      // `limiter()` borne le zoom au minimum qui fait tenir la carte : quelques
      // crans en arrière suffisent à la cadrer entière, quelle que soit sa taille.
      const crans = cransDezoom();
      for (let i = 0; i < crans; i += 1) rendu.zoomer?.(-1);
    }

    async function boucler(hoteRendu: HTMLDivElement): Promise<void> {
      cadrerCarte();
      afficher();
      hoteRendu.dataset['attract'] = 'pret';
      let jouees = 0;

      while (vivant) {
        await attendreVisible();
        if (!vivant) return;

        if (etat.partie.terminee || jouees > ACTIONS_MAX) {
          await pause(MS_AVANT_REPRISE);
          if (!vivant) return;
          etat = etatNeuf();
          jouees = 0;
          cadrerCarte();
          afficher();
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
