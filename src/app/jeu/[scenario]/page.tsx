import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Viewport } from 'next';
import { notFound } from 'next/navigation';

import { t } from '@/i18n/index';
import { validerMapDef, validerScenario, type MapDef, type Scenario } from '@/schemas/index';

import Toile from './toile-client';
import { CLE_ETAPE, CLE_LISTE_ETAPES, ETAPES_CHARGEMENT } from './etapes-chargement';

import carteDemo from '../../../../content/cartes/carte_plaine_symetrique.json';
import scenarioDemo from '../../../../content/scenarios/demo.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Le plateau est un **jeu au doigt**, pas un document : le zoom de la page n'y
 * a rien à faire, et il y prend la place du zoom de la carte. Deux doigts sur
 * la carte doivent zoomer *la carte*, ce que le zoom de page vole ; et une page
 * agrandie par erreur déplace tout ce que le lancer de rayon calcule.
 *
 * Cette déclaration ne vaut que pour cette route : ailleurs — l'écran-titre, la
 * campagne, les réglages —, ce sont des textes, et on doit pouvoir les
 * agrandir. C'est aussi pourquoi elle ne suffit pas à elle seule : iOS ignore
 * `user-scalable` depuis longtemps, et c'est `touch-action` sur la toile plus
 * les événements `gesture*` de Safari qui font le travail (`render3d/gestes.ts`).
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#132329',
};

/** Forme d'un code de scénario acceptable dans une URL. */
const CODE_VALIDE = /^[a-z][a-z0-9_]{1,47}$/;

/** Lit un JSON du canon sur le disque, ou `null` s'il n'existe pas. */
async function lireCanon(...segments: string[]): Promise<unknown> {
  try {
    const chemin = path.resolve(process.cwd(), 'content', ...segments);
    return JSON.parse(await readFile(chemin, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

/**
 * Charge un scénario et sa carte. `demo` est **importé statiquement** : une
 * partie de démonstration doit pouvoir se jouer sans réseau ni disque
 * (`02-architecture.md` §3.5). Les autres scénarios canon sont lus dans
 * `content/`, et un code inconnu rend 404.
 */
async function charger(code: string): Promise<{ scenario: Scenario; carte: MapDef } | null> {
  if (!CODE_VALIDE.test(code)) return null;
  const brutScenario = code === 'demo' ? scenarioDemo : await lireCanon('scenarios', `${code}.json`);
  if (brutScenario === null) return null;
  const s = validerScenario(brutScenario);
  if (!s.ok) return null;
  const brutCarte = code === 'demo'
    ? carteDemo
    : await lireCanon('cartes', `${s.valeur.carteCle}.json`);
  if (brutCarte === null) return null;
  const c = validerMapDef(brutCarte);
  if (!c.ok) return null;
  return { scenario: s.valeur, carte: c.valeur };
}

/**
 * La page d'une mission. Il n'y a plus qu'une peau — le rendu vectoriel a été
 * retiré —, donc plus de `?rendu=` : un appareil sans WebGL 2 voit un écran qui
 * le lui dit, ce qui vaut mieux qu'une version dégradée du jeu.
 */
export default async function PageJeu(
  { params }: { params: Promise<{ scenario: string }> },
): Promise<React.ReactElement> {
  const { scenario: code } = await params;
  const charge = await charger(code);
  if (!charge) notFound();
  const locale = 'fr';
  return <Toile
    key={charge.scenario.code}
    scenario={charge.scenario}
    carte={charge.carte}
    locale={locale}
    // L'écran de chargement reçoit ses cinq mots **déjà traduits**, comme le
    // bouton Campagne et la liste des parties libres : il est rendu par le
    // serveur et vit dans le premier chargement de la page, où les trois cent
    // soixante-dix-neuf chaînes d'interface n'ont rien à faire.
    libellesChargement={{
      etapes: ETAPES_CHARGEMENT.map((e) => t(locale, CLE_ETAPE[e])),
      liste: t(locale, CLE_LISTE_ETAPES),
    }}
  />;
}
