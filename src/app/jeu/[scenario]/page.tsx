import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { notFound } from 'next/navigation';

import { validerMapDef, validerScenario, type MapDef, type Scenario } from '@/schemas/index';

import Toile from './toile';

import carteDemo from '../../../../content/cartes/carte_plaine_symetrique.json';
import scenarioDemo from '../../../../content/scenarios/demo.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
  return <Toile key={charge.scenario.code} scenario={charge.scenario} carte={charge.carte} locale="fr" />;
}
