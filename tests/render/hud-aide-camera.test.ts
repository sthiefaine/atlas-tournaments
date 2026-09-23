// L'aide du panneau caméra ne promet que les gestes que la carte comprend. La
// peau 2D est à vue fixe — ni rotation ni inclinaison — : elle n'offre pas
// `tourner`, et l'aide ne parle alors ni d'Alt ni de Maj. Même document
// factice que `hud-html.test.ts` : pas de jsdom, des éléments qui retiennent
// leur HTML.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { chargerCatalogue, creerPartie, reglagesParDefaut, sceneDeCarte } from '../../src/engine/index';
import { t } from '../../src/i18n/index';
import { ambiance } from '../../src/render/ambiance';
import { monterHudHtml, type ApiHud, type VueJeu } from '../../src/render/hud-html';
import { validerMapDef } from '../../src/schemas/index';

class Element {
  children: Element[] = [];
  className = '';
  id = '';
  clientWidth = 0;
  clientHeight = 0;
  textContent = '';
  dataset: Record<string, string> = {};
  attributs = new Map<string, string>();
  style: Record<string, unknown> = { setProperty(this: Record<string, unknown>, k: string, v: string): void { this[k] = v; } };
  ownerDocument: unknown;
  parent: Element | null = null;
  innerHTML = '';
  setAttribute(k: string, v: string): void { this.attributs.set(k, v); }
  appendChild(e: Element): Element { e.parent = this; this.children.push(e); return e; }
  remove(): void { if (this.parent) this.parent.children = this.parent.children.filter((e) => e !== this); this.parent = null; }
  contains(): boolean { return false; }
  querySelector(): null { return null; }
  hasAttribute(k: string): boolean { return this.attributs.has(k); }
  classList = { contains: (c: string): boolean => this.className.split(' ').includes(c) };
  closest(): null { return null; }
  addEventListener(): void { /* rien à écouter ici */ }
  removeEventListener(): void { /* idem */ }
  focus(): void { /* idem */ }
}
const g = globalThis as Record<string, unknown>;
g['Element'] ??= Element;
g['HTMLElement'] ??= Element;
g['HTMLCanvasElement'] ??= class {};

const CAT = chargerCatalogue();

function vue(): VueJeu {
  const chemin = path.resolve(import.meta.dirname, '..', 'engine', 'cartes', 'plaine.json');
  const r = validerMapDef(JSON.parse(readFileSync(chemin, 'utf8')) as unknown);
  if (!r.ok) throw new Error('carte de test invalide');
  const etat = creerPartie(sceneDeCarte(r.valeur, reglagesParDefaut({ meteoForcee: 'clair' })), CAT, 'hud');
  return {
    etat, catalogue: CAT, ambiance: ambiance('ete', 'jour', 'clair'), locale: 'fr', camp: 0,
    phase: 'inactif', curseur: { x: 0, y: 0 }, selection: null, menu: null, production: null, visee: null,
    attenteIa: false, annonce: null,
  };
}

/** Le HTML du panneau caméra d'un HUD monté sur `largeur` pixels, avec ou sans rotation. */
function panneau(largeur: number, tourner: boolean): string {
  const doc = {
    createElement: (): Element => Object.assign(new Element(), { ownerDocument: doc }),
    getElementById: (): null => null,
    head: new Element(),
    activeElement: null,
    defaultView: undefined,
  };
  const conteneur = Object.assign(new Element(), { ownerDocument: doc, clientWidth: largeur, clientHeight: 800 });
  const api: ApiHud = {
    vue, t: (cle, params) => t('fr', cle, params),
    finTour: () => undefined, choisirSuite: () => undefined, choisirProduction: () => undefined,
    jouerPouvoir: () => undefined, annuler: () => undefined, recommencer: () => undefined,
    versEcran: () => null, zoomer: () => undefined, recentrer: () => undefined,
    ...(tourner ? { tourner: () => undefined } : {}),
  };
  const hud = monterHudHtml(conteneur as unknown as HTMLElement, api);
  const trouver = (e: Element): string | null => {
    if (e.attributs.get('data-emplacement') === 'camera') return e.innerHTML;
    for (const enfant of e.children) {
      const html = trouver(enfant);
      if (html !== null) return html;
    }
    return null;
  };
  const html = trouver(conteneur) ?? '';
  hud.demonter();
  return html;
}

const AIDE_3D = t('fr', 'hud.aide_camera');
const AIDE_2D = t('fr', 'hud.aide_camera_2d');

test('l’aide 2D existe, et ne parle ni d’Alt ni de Maj', () => {
  assert.notEqual(AIDE_2D, 'hud.aide_camera_2d', 'la clé a son texte');
  assert.doesNotMatch(AIDE_2D, /Alt|Maj|tourner|incliner/);
  assert.match(AIDE_2D, /pincement/);
});

test('sans rotation, le panneau caméra donne l’aide de la vue fixe — au doigt comme à la souris', () => {
  for (const largeur of [1400, 390]) {
    const html = panneau(largeur, false);
    assert.ok(html.includes(AIDE_2D), `${largeur} px : l’aide 2D est posée`);
    assert.ok(!html.includes('Alt + glisser'), `${largeur} px : aucun geste de rotation promis`);
  }
});

test('une peau qui tourne garde l’aide de la rotation', () => {
  for (const largeur of [1400, 390]) {
    const html = panneau(largeur, true);
    assert.ok(html.includes('Alt + glisser'), `${largeur} px : l’aide 3D reste`);
    assert.ok(!html.includes(AIDE_2D), `${largeur} px : pas l’aide 2D`);
  }
  assert.ok(AIDE_3D.includes('Alt'));
});
