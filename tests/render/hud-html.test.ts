// Le HUD n'écrit dans le DOM que les emplacements dont le HTML a changé. Il
// n'y a pas de jsdom ici : un document factice compte les écritures
// d'`innerHTML`, ce qui est exactement ce qu'on veut mesurer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  appliquer, chargerCatalogue, creerPartie, facteurTerrain, prevoirDuel, pvAffiches, reglagesParDefaut,
  sceneDeCarte, type Catalogue, type EtatPartie, type Unite,
} from '../../src/engine/index';
import { nombre } from '../../src/i18n/index';
import { ambiance } from '../../src/render/ambiance';
import { PALETTES } from '../../src/render/palettes';
import {
  HAUTEUR_MINIMALE_RAIL, LARGEUR_MINIMALE_RAIL, monterHudHtml, poserEmplacements, railTient,
  type VueJeu,
} from '../../src/render/hud-html';
import { nomTerrain } from '../../src/render/libelles';
import type { HorlogeScenes } from '../../src/render/scenes-html';
import { DUREES, ecrirePartition, type Partition } from '../../src/render/partition';
import { chiffreSigne, MS_FIXE, rolesDesChiffres } from '../../src/render/scenes-html';
import { validerMapDef, type CleUnite } from '../../src/schemas/index';
import { scenePersonnalisee } from '../engine/aides';

class FauxElement {
  children: FauxElement[] = [];
  className = '';
  id = '';
  /** La colonne de droite se décide sur la taille mesurée du conteneur. */
  clientWidth = 0;
  clientHeight = 0;
  textContent = '';
  dataset: Record<string, string> = {};
  attributs = new Map<string, string>();
  /**
   * Le style d'un élément. `setProperty` **retient** ce qu'on lui donne : le HUD
   * pose la couleur de l'armée en main sur sa racine par cette voie, et sans
   * mémoire on ne pourrait pas la relire.
   */
  style: Record<string, unknown> = {
    setProperty(this: Record<string, unknown>, cle: string, valeur: string): void { this[cle] = valeur; },
  };
  ecritures = 0;
  private html = '';
  ownerDocument: unknown;
  get innerHTML(): string { return this.html; }
  set innerHTML(v: string) { this.html = v; this.ecritures += 1; }
  setAttribute(k: string, v: string): void { this.attributs.set(k, v); }
  parent: FauxElement | null = null;
  appendChild(e: FauxElement): FauxElement { e.parent = this; this.children.push(e); return e; }
  // Un nœud retiré quitte son parent : c'est ce que les scènes transitoires
  // promettent, et ce que leurs tests regardent.
  remove(): void {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((e) => e !== this);
    this.parent = null;
  }
  contains(): boolean { return false; }
  querySelector(): null { return null; }
  hasAttribute(k: string): boolean { return this.attributs.has(k); }
  classList = { contains: (c: string): boolean => this.className.split(' ').includes(c) };
  /**
   * Le premier ancêtre — soi compris — qui porte l'attribut demandé. Le HUD ne
   * demande que « [data-action] » et « [data-arret] » : inutile d'écrire un
   * moteur de sélecteurs pour deux motifs.
   */
  closest(selecteur: string): FauxElement | null {
    const attribut = selecteur.replace(/[[\]]/g, '').replace(/^data-/, '')
      .replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- on remonte la chaîne des parents, en partant de soi.
    let noeud: FauxElement | null = this;
    while (noeud) {
      if (noeud.dataset[attribut] !== undefined) return noeud;
      noeud = noeud.parent;
    }
    return null;
  }
  ecouteurs = new Map<string, (e: Event) => void>();
  addEventListener(type: string, fn: (e: Event) => void): void { this.ecouteurs.set(type, fn); }
  removeEventListener(type: string): void { this.ecouteurs.delete(type); }
  focus(): void { /* idem */ }
}
// `instanceof Element`, `HTMLElement` et `HTMLCanvasElement` sont évalués par le HUD.
const g = globalThis as Record<string, unknown>;
g['Element'] ??= FauxElement;
g['HTMLElement'] ??= FauxElement;
g['HTMLCanvasElement'] ??= class {};

function document(): { doc: unknown; conteneur: FauxElement } {
  const doc = {
    createElement: (): FauxElement => Object.assign(new FauxElement(), { ownerDocument: doc }),
    getElementById: (): null => null,
    head: new FauxElement(),
    activeElement: null,
    defaultView: undefined,
  };
  const conteneur = new FauxElement();
  conteneur.ownerDocument = doc;
  return { doc, conteneur };
}

const CAT = chargerCatalogue();
function partie(): EtatPartie {
  const chemin = path.resolve(import.meta.dirname, '..', 'engine', 'cartes', 'plaine.json');
  const r = validerMapDef(JSON.parse(readFileSync(chemin, 'utf8')) as unknown);
  if (!r.ok) throw new Error('carte de test invalide');
  return creerPartie(sceneDeCarte(r.valeur, reglagesParDefaut({ meteoForcee: 'clair' })), CAT, 'hud');
}

function vueDe(etat: EtatPartie, curseur: { x: number; y: number }): VueJeu {
  return {
    etat, catalogue: CAT, ambiance: ambiance('ete', 'jour', 'clair'), locale: 'fr', camp: 0,
    phase: 'inactif', curseur, selection: null, menu: null, production: null, visee: null,
    attenteIa: false, annonce: null,
  };
}

/**
 * Les emplacements du HUD, par nom, avec leurs écritures.
 *
 * Ils ne sont plus tous enfants directs de la racine : chacun vit dans sa zone
 * — `hud-carte` pour ce qui commente une case, `hud-rail` pour la colonne de
 * droite —, et les modales restent sous la racine parce que leur voile couvre
 * les deux. On descend donc jusqu'au premier nœud qui se nomme.
 */
function emplacements(conteneur: FauxElement): Map<string, FauxElement> {
  const racine = conteneur.children.find((e) => e.className === 'atlas-hud');
  assert.ok(racine);
  const trouves = new Map<string, FauxElement>();
  const parcourir = (noeud: FauxElement): void => {
    for (const enfant of noeud.children) {
      const nom = enfant.attributs.get('data-emplacement');
      if (nom !== undefined) trouves.set(nom, enfant);
      else parcourir(enfant);
    }
  };
  parcourir(racine);
  return trouves;
}

test('poserEmplacements n’écrit que ce qui a changé et rend leurs noms', () => {
  const a = { innerHTML: '', n: 0 };
  const b = { innerHTML: '', n: 0 };
  const cibles = new Map([['a', a], ['b', b]]);
  const precedent = new Map<string, string>();
  assert.deepEqual(poserEmplacements(cibles, precedent, new Map([['a', 'x'], ['b', '']])), ['a', 'b']);
  assert.deepEqual(poserEmplacements(cibles, precedent, new Map([['a', 'x'], ['b', '']])), []);
  assert.deepEqual(poserEmplacements(cibles, precedent, new Map([['a', 'x'], ['b', 'y']])), ['b']);
  assert.equal(b.innerHTML, 'y');
  assert.equal(precedent.get('b'), 'y');
});

test('rafraîchir sans changement n’écrit rien, et survoler une unité ne réécrit que l’inspection', () => {
  const etat = partie();
  const { conteneur } = document();
  const unite = etat.unites.find((u) => u.camp === 0);
  assert.ok(unite);
  // Une case vide, sans unité, à côté d'une case avec l'unité.
  let curseur = { x: 0, y: 0 };
  while (etat.unites.some((u) => u.x === curseur.x && u.y === curseur.y)) curseur = { x: curseur.x + 1, y: curseur.y };
  const hud = monterHudHtml(conteneur as unknown as HTMLElement, {
    vue: () => vueDe(etat, curseur),
    t: (cle, params) => (params ? `${cle} ${JSON.stringify(params)}` : cle),
    finTour: () => undefined, choisirSuite: () => undefined, choisirProduction: () => undefined,
    jouerPouvoir: () => undefined, annuler: () => undefined, recommencer: () => undefined,
    versEcran: () => null,
  });
  const slots = emplacements(conteneur);
  assert.equal(slots.size, 11, 'onze emplacements');
  const releve = (): Map<string, number> => new Map([...slots].map(([n, e]) => [n, e.ecritures]));
  const apresMontage = releve();
  for (const [, n] of apresMontage) assert.equal(n, 1, 'le montage pose chaque emplacement une fois');

  hud.rafraichir();
  assert.deepEqual(releve(), apresMontage, 'une vue identique n’écrit rien');

  curseur = { x: unite.x, y: unite.y };
  hud.rafraichir();
  const apresSurvol = releve();
  for (const [nom, n] of apresSurvol) {
    assert.equal(n, nom === 'inspection' ? 2 : 1, `emplacement ${nom}`);
  }
  assert.match(slots.get('inspection')!.innerHTML, /data-vignette="vg_inspection_0"/);
  hud.demonter();
});

/** Monte un HUD sur cet état avec le curseur sur cette case, et rend l'emplacement d'inspection. */
function inspection(etat: EtatPartie, curseur: { x: number; y: number }): { html: string; demonter(): void } {
  const { conteneur } = document();
  const hud = monterHudHtml(conteneur as unknown as HTMLElement, {
    vue: () => vueDe(etat, curseur),
    t: (cle, params) => (params ? `${cle} ${JSON.stringify(params)}` : cle),
    finTour: () => undefined, choisirSuite: () => undefined, choisirProduction: () => undefined,
    jouerPouvoir: () => undefined, annuler: () => undefined, recommencer: () => undefined,
    versEcran: () => null,
  });
  return { html: emplacements(conteneur).get('inspection')!.innerHTML, demonter: () => hud.demonter() };
}

test('le panneau d’unité colore munitions et carburant en alerte, avec un libellé pour l’accessibilité', () => {
  const etat = partie();
  const unite = etat.unites.find((u) => u.camp === 0 && u.munitions !== null && CAT.unites[u.type]!.munitions !== null);
  assert.ok(unite, 'il faut une unité à munitions comptées');

  // Au plein : aucune alerte, le chiffre nu.
  let r = inspection(etat, { x: unite.x, y: unite.y });
  assert.doesNotMatch(r.html, /data-alerte=/);
  assert.match(r.html, /hud\.munitions /);
  r.demonter();

  // Dernière munition : orange. Plus de munitions : rouge, avec le libellé du rouge.
  unite.munitions = 1;
  r = inspection(etat, { x: unite.x, y: unite.y });
  assert.match(r.html, /data-alerte="orange"[^>]*title="hud\.munitions_faible"/);
  r.demonter();
  unite.munitions = 0;
  r = inspection(etat, { x: unite.x, y: unite.y });
  assert.match(r.html, /data-alerte="rouge"[^>]*title="hud\.munitions_vides"/);
  assert.match(r.html, /aria-label="hud\.munitions [^"]*hud\.munitions_vides"/);
  r.demonter();

  // Le carburant d'une unité aérienne : orange sous deux tours, rouge au dernier.
  const helico = etat.unites.find((u) => u.camp === 0 && u.type === 'helico')
    ?? Object.assign(etat.unites.find((u) => u.camp === 0 && u.type !== unite.type)!, {
      type: 'helico', munitions: CAT.unites['helico']!.munitions, carburant: CAT.unites['helico']!.carburant!.max,
    });
  const parTour = CAT.unites['helico']!.carburant!.parTour;
  helico.carburant = 2 * parTour - 1;
  r = inspection(etat, { x: helico.x, y: helico.y });
  assert.match(r.html, /data-alerte="orange"[^>]*title="hud\.carburant_faible"/);
  r.demonter();
  helico.carburant = parTour;
  r = inspection(etat, { x: helico.x, y: helico.y });
  assert.match(r.html, /data-alerte="rouge"[^>]*title="hud\.carburant_critique"/);
  r.demonter();
});

test('le panneau d’un transport nomme ce qu’il a à bord', () => {
  const etat = partie();
  const [porteur, passager] = etat.unites.filter((u) => u.camp === 0);
  assert.ok(porteur && passager);
  let r = inspection(etat, { x: porteur.x, y: porteur.y });
  assert.doesNotMatch(r.html, /hud\.embarquees/, 'à vide, pas de ligne');
  r.demonter();

  porteur.cargo = [passager.id];
  passager.dansTransport = porteur.id;
  passager.x = porteur.x;
  passager.y = porteur.y;
  r = inspection(etat, { x: porteur.x, y: porteur.y });
  assert.match(r.html, /class="embarquees">hud\.embarquees \{&quot;liste&quot;:&quot;[^&]+&quot;\}/);
  // Le passager, lui, n'est pas ce que le panneau montre : c'est le porteur.
  assert.match(r.html, new RegExp(`unite\\.${porteur.type}\\.nom|${CAT.unites[porteur.type]!.nom}`));
  r.demonter();
});

test('le panneau d’unité dit « a bougé, suite à donner », et le compte des unités à jouer l’inclut', () => {
  const etat = partie();
  const miennes = etat.unites.filter((u) => u.camp === 0 && !u.dansTransport);
  assert.ok(miennes.length >= 4, 'la carte de plaine donne au moins quatre unités au joueur');
  const [prete, deplacee, agie, produite] = miennes as [Unite, Unite, Unite, Unite];
  deplacee.etat = 'deplacee';
  agie.etat = 'agi';
  produite.etat = 'produite';

  // Le compte : les prêtes et la déplacée — sa suite reste à donner —, jamais
  // celle qui a agi ni celle produite ce tour, qui ne peut rien faire.
  const h = hudSur(() => vueDe(etat, { x: prete.x, y: prete.y }));
  const dock = h.slots.get('dock')!.innerHTML;
  assert.match(dock, new RegExp(`hud\\.unites_pretes \\{&quot;n&quot;:${miennes.length - 2}\\}`));
  assert.match(dock, /data-reste="oui"/);
  assert.doesNotMatch(h.slots.get('inspection')!.innerHTML, /hud\.deplacee/, 'une prête n’a pas l’état');
  h.demonter();

  // L'état, dit en clair sur la déplacée.
  const r = inspection(etat, { x: deplacee.x, y: deplacee.y });
  assert.match(r.html, /class="deplacee">hud\.deplacee</);
  r.demonter();

  // Tout joué : la déplacée qui donne sa suite passe `agi`, et le compte tombe.
  for (const u of miennes) u.etat = 'agi';
  const fini = hudSur(() => vueDe(etat, { x: 0, y: 0 }));
  assert.match(fini.slots.get('dock')!.innerHTML, /hud\.tout_joue/);
  assert.match(fini.slots.get('dock')!.innerHTML, /data-reste="non"/);
  fini.demonter();
});

test('le panneau d’unité prévient quand le chemin pointé sort de la vue', () => {
  const etat = partie();
  const unite = etat.unites.find((u) => u.camp === 0);
  assert.ok(unite);
  let aveugle = true;
  const h = hudSur(() => ({ ...vueDe(etat, { x: unite.x, y: unite.y }), phase: 'selection', selection: unite.id, cheminAveugle: aveugle }));
  assert.match(h.slots.get('inspection')!.innerHTML, /class="aveugle" role="status">.*hud\.chemin_aveugle</);
  h.demonter();
  aveugle = false;
  const sans = hudSur(() => ({ ...vueDe(etat, { x: unite.x, y: unite.y }), phase: 'selection', selection: unite.id, cheminAveugle: aveugle }));
  assert.doesNotMatch(sans.slots.get('inspection')!.innerHTML, /hud\.chemin_aveugle/);
  sans.demonter();
});

test('l’écran de fin ne se rend ni pendant une scène ni quand la fin attend son dialogue, puis une fois', () => {
  const etat = partie();
  etat.partie = { ...etat.partie, terminee: true, vainqueur: 0, nul: false };
  const { conteneur } = document();
  const vue: VueJeu = { ...vueDe(etat, { x: 0, y: 0 }), phase: 'fin', sceneOuverte: false, finEnAttente: true };
  const hud = monterHudHtml(conteneur as unknown as HTMLElement, {
    vue: () => vue,
    t: (cle) => cle,
    finTour: () => undefined, choisirSuite: () => undefined, choisirProduction: () => undefined,
    jouerPouvoir: () => undefined, annuler: () => undefined, recommencer: () => undefined,
    versEcran: () => null,
  });
  const fin = emplacements(conteneur).get('fin')!;
  // La fin est connue de l'état, mais le commandant n'a pas encore parlé.
  assert.equal(fin.innerHTML, '', 'fin en attente : rien');
  vue.finEnAttente = false;
  vue.sceneOuverte = true;
  hud.rafraichir();
  assert.equal(fin.innerHTML, '', 'scène ouverte : rien');
  vue.sceneOuverte = false;
  hud.rafraichir();
  assert.match(fin.innerHTML, /combat\.manche_gagnee/);
  assert.match(fin.innerHTML, /data-action="rejouer"/);
  const ecritures = fin.ecritures;
  hud.rafraichir();
  assert.equal(fin.ecritures, ecritures, 'la fin ne se réécrit pas tant que rien ne change');
  hud.demonter();
});

// ---------------------------------------------------------------------------
// Les scènes transitoires : chiffres, écran de combat, splash
// ---------------------------------------------------------------------------

/** Le conteneur frère des scènes, à côté de la racine du HUD. */
function scenes(conteneur: FauxElement): FauxElement {
  const racine = conteneur.children.find((e) => e.className === 'atlas-scenes');
  assert.ok(racine, 'les scènes vivent dans un conteneur frère du HUD');
  return racine;
}

/**
 * Une horloge que le test avance lui-même. Les scènes se cadençaient sur
 * `Date.now()` et `requestAnimationFrame` : le test passait seul et tombait
 * quand toute la suite tournait, la charge suffisant à sauter une étape.
 */
function horlogeFactice(): HorlogeScenes & { avancer(ms: number): void } {
  let t = 0;
  let prochaine: (() => void) | null = null;
  return {
    maintenant: () => t,
    planifier: (image) => {
      prochaine = image;
      return () => { prochaine = null; };
    },
    avancer(ms: number) {
      t += ms;
      const image = prochaine;
      prochaine = null;
      image?.();
    },
  };
}

/** De quoi mener n'importe quelle scène à son terme en une image. */
const FIN_DES_SCENES = 10_000;

function hudAvecScenes(etat: EtatPartie, versEcran: () => { x: number; y: number } | null, couper?: () => void) {
  const { conteneur } = document();
  const horloge = horlogeFactice();
  const hud = monterHudHtml(conteneur as unknown as HTMLElement, {
    vue: () => vueDe(etat, { x: 0, y: 0 }),
    t: (cle) => cle,
    finTour: () => undefined, choisirSuite: () => undefined, choisirProduction: () => undefined,
    jouerPouvoir: () => undefined, annuler: () => undefined, recommencer: () => undefined,
    versEcran, couper,
  }, horloge);
  return { hud, conteneur, horloge };
}

test('un chiffre de la partition crée un nœud frère ancré sur la case, retiré à la fin', async () => {
  const etat = partie();
  const { hud, conteneur, horloge } = hudAvecScenes(etat, () => ({ x: 120, y: 80 }));
  const partition: Partition = {
    gestes: [{ genre: 'chiffre', case: { x: 2, y: 3 }, valeur: 3, teinte: 'perte', debut: 0, duree: 60 }],
    duree: 60,
  };
  const fin = hud.jouer(partition);
  horloge.avancer(20);
  const racine = scenes(conteneur);
  const chiffre = racine.children.find((e) => e.className === 'atlas-chiffre');
  assert.ok(chiffre, 'le chiffre est créé dès le début du geste');
  assert.equal(chiffre.dataset['teinte'], 'perte');
  assert.equal(chiffre.textContent, chiffreSigne(3, 'perte'));
  assert.equal(chiffre.textContent, '−3', 'un vrai signe moins');
  assert.equal(chiffre.style['left'], '120px', 'ancré sur la position d’écran de la case');
  assert.equal(chiffre.dataset['fixe'], undefined, 'il bouge : la durée n’est pas nulle');
  horloge.avancer(FIN_DES_SCENES);
  await fin;
  assert.equal(racine.children.length, 0, 'retiré à la fin de la partition');
  hud.demonter();
});

test('le « ! » d’embuscade : ancré au-dessus de la case, retiré à la fin, jamais posé sur une unité que le joueur ne voit pas', async () => {
  const etat = partie();
  const [a] = etat.unites;
  assert.ok(a);
  const { hud, conteneur, horloge } = hudAvecScenes(etat, () => ({ x: 40, y: 60 }));
  const partition: Partition = {
    gestes: [{ genre: 'surprise', unite: a.id, case: { x: a.x, y: a.y }, debut: 0, duree: 70 }],
    duree: 70,
  };
  const fin = hud.jouer(partition);
  horloge.avancer(10);
  const racine = scenes(conteneur);
  const signe = racine.children.find((e) => e.className === 'atlas-surprise');
  assert.ok(signe, 'le signe est créé dès le début du geste');
  assert.equal(signe.textContent, '!');
  assert.equal(signe.attributs.get('aria-hidden'), 'true', 'un signe, pas un texte : l’annonce porte les mots');
  assert.equal(signe.style['left'], '40px');
  assert.equal(signe.style['top'], '38px', 'plus haut qu’un chiffre : au-dessus de la tête');
  assert.equal(signe.dataset['fixe'], undefined);
  horloge.avancer(FIN_DES_SCENES);
  await fin;
  assert.equal(racine.children.length, 0, 'retiré à la fin');
  hud.demonter();

  // Sans durée : fixe, à l'état final, le temps de le lire.
  const reduit = hudAvecScenes(etat, () => ({ x: 40, y: 60 }));
  const finReduite = reduit.hud.jouer({ gestes: [{ ...partition.gestes[0]!, duree: 0 }], duree: 0 });
  reduit.horloge.avancer(10);
  const fixe = scenes(reduit.conteneur).children.find((e) => e.className === 'atlas-surprise');
  assert.equal(fixe?.dataset['fixe'], 'oui');
  reduit.horloge.avancer(FIN_DES_SCENES);
  await finReduite;
  reduit.hud.demonter();

  // Une unité que la carte cache ne reçoit pas de « ! » : il dirait où elle s'est arrêtée.
  const { conteneur: cache } = document();
  const horlogeCachee = horlogeFactice();
  const hudCache = monterHudHtml(cache as unknown as HTMLElement, {
    vue: () => ({ ...vueDe(etat, { x: 0, y: 0 }), unitesVues: new Set<string>() }),
    t: (cle) => cle,
    finTour: () => undefined, choisirSuite: () => undefined, choisirProduction: () => undefined,
    jouerPouvoir: () => undefined, annuler: () => undefined, recommencer: () => undefined,
    versEcran: () => ({ x: 40, y: 60 }),
  }, horlogeCachee);
  const finCachee = hudCache.jouer(partition);
  horlogeCachee.avancer(10);
  assert.equal(scenes(cache).children.length, 0, 'rien à l’écran');
  horlogeCachee.avancer(FIN_DES_SCENES);
  await finCachee;
  hudCache.demonter();
});

test('sans position d’écran (case hors champ), aucun chiffre n’est créé et la promesse se résout', async () => {
  const etat = partie();
  const { hud, conteneur } = hudAvecScenes(etat, () => null);
  const partition: Partition = {
    gestes: [{ genre: 'chiffre', case: { x: 2, y: 3 }, valeur: 3, teinte: 'gain', debut: 0, duree: 40 }],
    duree: 40,
  };
  await hud.jouer(partition);
  assert.equal(scenes(conteneur).children.length, 0);
  hud.demonter();
});

test('un duel crée l’écran de combat, qui passe par ses étapes puis se retire', async () => {
  const etat = partie();
  const [a, c] = etat.unites;
  assert.ok(a && c);
  const { hud, conteneur, horloge } = hudAvecScenes(etat, () => ({ x: 0, y: 0 }));
  const duree = 120;
  const partition: Partition = {
    gestes: [{
      genre: 'duel',
      attaquant: { unite: a.id, type: a.type, camp: a.camp, case: { x: a.x, y: a.y }, pvAvant: 10, pvApres: 8 },
      cible: { unite: c.id, type: c.type, camp: c.camp, case: { x: c.x, y: c.y }, pvAvant: 10, pvApres: 6 },
      riposte: true, debut: 0, duree,
    }],
    duree,
  };
  const fin = hud.jouer(partition);
  horloge.avancer(10);
  const racine = scenes(conteneur);
  const ecran = racine.children.find((e) => e.className === 'atlas-combat');
  assert.ok(ecran, 'l’écran de combat est créé');
  assert.equal(ecran.dataset['etape'], 'avant');
  assert.equal(ecran.dataset['riposte'], 'oui');
  assert.equal(ecran.attributs.get('aria-label'), 'hud.ecran_combat');
  // Deux camps, chacun avec sa vignette, son nom, sa jauge et son coup.
  const cadre = ecran.children.find((e) => e.className === 'cadre')!;
  const camps = cadre.children.find((e) => e.className === 'camps')!;
  const [attaquant, , cible] = camps.children;
  assert.ok(attaquant && cible);
  assert.equal(attaquant.className, 'camp attaquant');
  assert.equal(cible.className, 'camp cible');
  const jaugeCible = cible.children.find((e) => e.className === 'jauge')!;
  assert.equal((jaugeCible.innerHTML.match(/class="plein"/g) ?? []).length, 10, 'la jauge est pleine avant le coup');
  assert.equal(cible.children.find((e) => e.className === 'coup')!.textContent, '−4');
  assert.equal(attaquant.children.find((e) => e.className === 'coup')!.textContent, '−2');
  // Le coup tombe à 35 %, la riposte à 70 % ; les jauges suivent.
  horloge.avancer(duree * 0.5);
  assert.equal(ecran.dataset['etape'], 'coup');
  assert.equal((jaugeCible.innerHTML.match(/class="perdu"/g) ?? []).length, 4);
  horloge.avancer(FIN_DES_SCENES);
  await fin;
  assert.equal(racine.children.length, 0, 'l’écran est retiré à la fin');
  hud.demonter();
});

test('couper() retire tout et résout la promesse ; le clic sur l’écran demande la coupure au jeu', async () => {
  const etat = partie();
  const [a, c] = etat.unites;
  assert.ok(a && c);
  let coupures = 0;
  const { hud, conteneur, horloge } = hudAvecScenes(etat, () => ({ x: 5, y: 5 }), () => { coupures += 1; hud.couper(); });
  const partition: Partition = {
    gestes: [
      { genre: 'pouvoir', camp: 0, niveau: 'normal', nom: 'commandant.cmd_test.pouvoir', debut: 0, duree: DUREES.pouvoir },
      { genre: 'chiffre', case: { x: 1, y: 1 }, valeur: 2, teinte: 'gain', debut: 0, duree: DUREES.chiffre },
      {
        genre: 'duel',
        attaquant: { unite: a.id, type: a.type, camp: a.camp, case: { x: a.x, y: a.y }, pvAvant: 10, pvApres: 10 },
        cible: { unite: c.id, type: c.type, camp: c.camp, case: { x: c.x, y: c.y }, pvAvant: 10, pvApres: 7 },
        riposte: false, debut: 0, duree: DUREES.duel,
      },
    ],
    duree: DUREES.pouvoir,
  };
  let resolue = false;
  const fin = hud.jouer(partition).then(() => { resolue = true; });
  horloge.avancer(10);
  const racine = scenes(conteneur);
  assert.deepEqual(racine.children.map((e) => e.className).sort(), ['atlas-chiffre', 'atlas-combat', 'atlas-splash']);
  const splash = racine.children.find((e) => e.className === 'atlas-splash')!;
  assert.equal(splash.dataset['cote'], 'gauche', 'le pouvoir du joueur entre par la gauche');
  assert.match(splash.innerHTML, /class="nom">commandant\.cmd_test\.pouvoir</, 'le nom est traduit par t(), ici la clé elle-même');
  assert.match(splash.innerHTML, /class="kicker">hud\.jauge_pouvoir</);
  assert.equal(resolue, false, 'deux secondes de splash : rien n’est fini');
  // Le clic sur l'écran passe par le jeu, qui coupe tout — ici, en retour, le HUD.
  const ecran = racine.children.find((e) => e.className === 'atlas-combat')!;
  ecran.ecouteurs.get('click')?.({ preventDefault: () => undefined, stopPropagation: () => undefined } as unknown as Event);
  assert.equal(coupures, 1);
  horloge.avancer(FIN_DES_SCENES);
  await fin;
  assert.equal(resolue, true);
  assert.equal(racine.children.length, 0, 'plus rien à l’écran');
  hud.demonter();
});

test('sans durée (animations réduites), le chiffre et l’écran s’affichent fixes, à l’état final, MS_FIXE millisecondes', async () => {
  const etat = partie();
  const [a, c] = etat.unites;
  assert.ok(a && c);
  const { hud, conteneur, horloge } = hudAvecScenes(etat, () => ({ x: 5, y: 5 }));
  const partition: Partition = {
    gestes: [
      { genre: 'chiffre', case: { x: 1, y: 1 }, valeur: 2, teinte: 'gain', debut: 0, duree: 0 },
      {
        genre: 'duel',
        attaquant: { unite: a.id, type: a.type, camp: a.camp, case: { x: a.x, y: a.y }, pvAvant: 10, pvApres: 9 },
        cible: { unite: c.id, type: c.type, camp: c.camp, case: { x: c.x, y: c.y }, pvAvant: 10, pvApres: 7 },
        riposte: true, debut: 0, duree: 0,
      },
    ],
    duree: 0,
  };
  const fin = hud.jouer(partition);
  horloge.avancer(10);
  const racine = scenes(conteneur);
  const chiffre = racine.children.find((e) => e.className === 'atlas-chiffre')!;
  assert.equal(chiffre.dataset['fixe'], 'oui');
  assert.equal(chiffre.textContent, '+2');
  const ecran = racine.children.find((e) => e.className === 'atlas-combat')!;
  assert.equal(ecran.dataset['fixe'], 'oui');
  assert.equal(ecran.dataset['etape'], 'fin', 'l’issue, tout de suite');
  // L'information reste lisible le temps fixe : encore là juste avant, partie après.
  horloge.avancer(MS_FIXE - 20);
  assert.equal(racine.children.length, 2, 'toujours à l’écran à vingt millisecondes de la fin');
  horloge.avancer(FIN_DES_SCENES);
  await fin;
  assert.equal(racine.children.length, 0);
  hud.demonter();
});

test('une partition sans geste pour le HUD se résout aussitôt, sans rien créer', async () => {
  const etat = partie();
  const { hud, conteneur } = hudAvecScenes(etat, () => ({ x: 5, y: 5 }));
  await hud.jouer({
    gestes: [{ genre: 'glisser', unite: 'u', chemin: [{ x: 0, y: 0 }, { x: 1, y: 0 }], debut: 0, duree: 120 }],
    duree: 120,
  });
  assert.equal(scenes(conteneur).children.length, 0);
  hud.demonter();
});

// ---------------------------------------------------------------------------
// Catalogue 6 : la furtivité, la cale, le passager nommé
// ---------------------------------------------------------------------------

/** Monte un HUD sur cette vue et rend ses emplacements, avec de quoi démonter. */
function hudSur(vue: () => VueJeu, taille?: { largeur: number; hauteur: number }): {
  slots: Map<string, FauxElement>;
  /** La classe de la zone qui porte cet emplacement : hud-carte, hud-rail, ou la racine. */
  zone(nom: string): string;
  /** Les emplacements de la colonne, dans l'ordre du DOM. */
  ordreRail(): string[];
  conteneur: FauxElement;
  /** Rejoue un rendu : la vue est une fonction, le test la fait varier entre deux appels. */
  rafraichir(): void;
  demonter(): void;
} {
  const { conteneur } = document();
  if (taille) { conteneur.clientWidth = taille.largeur; conteneur.clientHeight = taille.hauteur; }
  const hud = monterHudHtml(conteneur as unknown as HTMLElement, {
    vue,
    t: (cle, params) => (params ? `${cle} ${JSON.stringify(params)}` : cle),
    finTour: () => undefined, choisirSuite: () => undefined, choisirProduction: () => undefined,
    jouerPouvoir: () => undefined, annuler: () => undefined, recommencer: () => undefined,
    versEcran: () => null,
  });
  const slots = emplacements(conteneur);
  return {
    slots,
    zone: (nom) => slots.get(nom)?.parent?.className ?? '',
    /** Les emplacements de la colonne, dans l'ordre du DOM : c'est l'ordre lu. */
    ordreRail: (): string[] => {
      const rail = slots.get('partie')?.parent;
      return rail ? rail.children.map((e) => e.attributs.get('data-emplacement') ?? '') : [];
    },
    conteneur,
    rafraichir: () => hud.rafraichir(),
    demonter: () => hud.demonter(),
  };
}

/** Une partie en catalogue 6 : un chasseur furtif du joueur, un fantassin adverse. */
function partieCatalogue6(): { etat: EtatPartie; cat: Catalogue } {
  const cat = chargerCatalogue(6);
  const etat = creerPartie(scenePersonnalisee(['PPPPP', 'PPPPP'], {}, [
    { camp: 0, type: 'furtif', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 4, y: 1 },
  ]), cat, 'hud');
  return { etat, cat };
}

test('le panneau d’unité dit « furtive », juge le carburant à la consommation effective, et tait ce que la carte cache', () => {
  const { etat, cat } = partieCatalogue6();
  const furtif = etat.unites.find((u) => u.type === 'furtif');
  assert.ok(furtif);
  const type = cat.unites['furtif']!;
  const parTour = type.carburant!.parTour;
  const vueSur = (curseur: { x: number; y: number }, unitesVues?: ReadonlySet<string> | null) => (): VueJeu => ({
    ...vueDe(etat, curseur), catalogue: cat, ...(unitesVues === undefined ? {} : { unitesVues }),
  });

  // Visible, deux tours pleins au chiffre du type : rien à signaler, pas d'état.
  furtif.carburant = 2 * parTour;
  let h = hudSur(vueSur({ x: 0, y: 0 }));
  let html = h.slots.get('inspection')!.innerHTML;
  assert.doesNotMatch(html, /class="furtive"/);
  assert.doesNotMatch(html, /data-alerte=/);
  h.demonter();

  // Furtive : l'état est dit, et le même carburant ne couvre plus deux tours
  // de ce qu'elle brûle vraiment.
  furtif.furtive = true;
  h = hudSur(vueSur({ x: 0, y: 0 }));
  html = h.slots.get('inspection')!.innerHTML;
  assert.match(html, /class="furtive">hud\.furtive</);
  assert.match(html, /data-alerte="orange"[^>]*title="hud\.carburant_faible"/);
  h.demonter();

  // Une unité que le joueur ne voit pas n'est pas sous le curseur : le panneau
  // montre le terrain de la case, pas l'unité que l'état porte.
  const adverse = etat.unites.find((u) => u.camp === 1);
  assert.ok(adverse);
  h = hudSur(vueSur({ x: adverse.x, y: adverse.y }, new Set([furtif.id])));
  html = h.slots.get('inspection')!.innerHTML;
  assert.doesNotMatch(html, /Infanterie|unite\.infanterie\.nom/);
  assert.match(html, /Plaine|terrain\.plaine\.nom/, 'le terrain, lui, se voit');
  h.demonter();
  // Vue au contact, elle se montre.
  h = hudSur(vueSur({ x: adverse.x, y: adverse.y }, new Set([furtif.id, adverse.id])));
  assert.match(h.slots.get('inspection')!.innerHTML, /Infanterie|unite\.infanterie\.nom/);
  h.demonter();
});

test('la fiche du menu de production dit la cale d’un transport et ce qu’une unité brûle par tour', () => {
  const { etat, cat } = partieCatalogue6();
  const production = (unites: readonly CleUnite[]) => (): VueJeu => ({
    ...vueDe(etat, { x: 0, y: 0 }), catalogue: cat, phase: 'production',
    production: { batiment: { x: 0, y: 0 }, unites },
  });
  const camion = cat.unites['transport']!;
  assert.ok(camion.transport && camion.transport.ravitaille === true);
  let h = hudSur(production(['transport']));
  let html = h.slots.get('production')!.innerHTML;
  assert.match(html, /class="bloc cale"/);
  assert.match(html, new RegExp(`class="puce places" data-places="${camion.transport.places}">fiche\\.places \\{&quot;n&quot;:${camion.transport.places}\\}`));
  assert.match(html, /fiche\.ravitaille_cale/);
  for (const c of camion.transport.accepte) {
    assert.match(html, new RegExp(`unite\\.${c}\\.nom|${cat.unites[c]!.nom}`), `${c} est nommée`);
  }
  assert.doesNotMatch(html, /class="conso"/, 'un camion ne brûle rien immobile');
  h.demonter();

  // La barge porte sans ravitailler ; le chasseur furtif brûle cinq, huit caché.
  h = hudSur(production(['barge']));
  html = h.slots.get('production')!.innerHTML;
  assert.match(html, /class="bloc cale"/);
  assert.doesNotMatch(html, /fiche\.ravitaille_cale/);
  h.demonter();
  const furtif = cat.unites['furtif']!;
  h = hudSur(production(['furtif']));
  html = h.slots.get('production')!.innerHTML;
  assert.doesNotMatch(html, /class="bloc cale"/);
  assert.match(html, new RegExp(`data-conso="${furtif.carburant!.parTour}">[^<]*<svg[^>]*>.*?</svg><span>fiche\\.par_tour `));
  assert.match(html, /fiche\.par_tour_furtif \{&quot;n&quot;:&quot;8&quot;\}/);
  h.demonter();
});

test('le menu d’ordres nomme et dessine le passager d’un débarquement, et garde le passager dans le bouton', () => {
  const etat = partie();
  const [porteur, passager] = etat.unites.filter((u) => u.camp === 0);
  assert.ok(porteur && passager);
  porteur.cargo = [passager.id];
  passager.dansTransport = porteur.id;
  passager.x = porteur.x;
  passager.y = porteur.y;
  const h = hudSur(() => ({
    ...vueDe(etat, { x: porteur.x, y: porteur.y }), phase: 'action', selection: porteur.id,
    menu: {
      ancre: { x: porteur.x, y: porteur.y },
      options: [
        { id: 'debarquer', cle: 'hud.debarquer_unite', disponible: true, passager: passager.id },
        { id: 'attendre', cle: 'hud.attendre', disponible: true },
      ],
    },
  }));
  const html = h.slots.get('ordres')!.innerHTML;
  assert.match(html, new RegExp(`data-valeur="debarquer" data-passager="${passager.id}"`));
  assert.match(html, new RegExp(`hud\\.debarquer_unite \\{&quot;unite&quot;:&quot;(unite\\.${passager.type}\\.nom|${CAT.unites[passager.type]!.nom})&quot;\\}`));
  assert.match(html, /data-vignette="vg_ordres_0"/, 'la figurine du passager');
  assert.match(html, /data-valeur="attendre"(?! data-passager)/);
  h.demonter();
});

// ---------------------------------------------------------------------------
// Le combat lisible : avant (la prévision), après (le coup et la riposte)
// ---------------------------------------------------------------------------

/**
 * Un clic sur un bouton du HUD : le gestionnaire est posé sur la racine et
 * remonte jusqu'au premier « [data-action] ». On lui donne donc un vrai nœud
 * factice, pas un objet nu.
 */
function cliquer(conteneur: FauxElement, action: string): void {
  const racine = conteneur.children.find((e) => e.className === 'atlas-hud');
  assert.ok(racine);
  const bouton = new FauxElement();
  bouton.dataset['action'] = action;
  racine.ecouteurs.get('click')?.({
    target: bouton, preventDefault: () => undefined, stopPropagation: () => undefined,
  } as unknown as Event);
}

/** Une partie sur une grille écrite à la main, avec le catalogue du HUD. */
function surGrille(
  grille: string[], unites: { camp: 0 | 1; type: CleUnite; x: number; y: number; pv?: number }[],
): EtatPartie {
  return creerPartie(scenePersonnalisee(grille, {}, unites), CAT, 'duel');
}

/**
 * Le HUD monté sur une visée : la prévision est celle du moteur, et `t` rend la
 * clé avec ses paramètres en clair, sans guillemets — le HUD échappe son HTML,
 * et un JSON dans une assertion deviendrait illisible.
 */
function hudEnVisee(etat: EtatPartie, visee: NonNullable<VueJeu['visee']>): {
  conteneur: FauxElement; hud: ReturnType<typeof monterHudHtml>;
} {
  const { conteneur } = document();
  const hud = monterHudHtml(conteneur as unknown as HTMLElement, {
    vue: (): VueJeu => ({ ...vueDe(etat, visee.cible ?? { x: 0, y: 0 }), phase: 'cible', visee }),
    t: (cle, params) => (params
      ? `${cle}(${Object.entries(params).map(([k, x]) => `${k}=${String(x)}`).join(',')})`
      : cle),
    finTour: () => undefined, choisirSuite: () => undefined, choisirProduction: () => undefined,
    jouerPouvoir: () => undefined, annuler: () => undefined, recommencer: () => undefined,
    versEcran: () => null,
  });
  return { conteneur, hud };
}

test('la prévision de duel ne dit plus que les deux chiffres, et ils sont ceux du moteur', () => {
  // Le panneau portait, pour chaque camp, le terrain, ses étoiles, la part
  // retirée, et un mot disant lequel des deux coups la ligne encaissait, plus
  // une note d'une phrase. Le propriétaire l'a jugé illisible le 8 septembre
  // 2026 — « trop d'informations à l'écran ». Une prévision se lit entre viser
  // et cliquer : il y reste deux figurines, deux jauges, deux nombres.
  const etat = surGrille(['RFP', 'PPP', 'PPP'], [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 1, y: 0 },
  ]);
  const attaquant = etat.unites.find((u) => u.camp === 0)!;
  const defenseur = etat.unites.find((u) => u.camp === 1)!;
  const { conteneur, hud } = hudEnVisee(etat, {
    attaquantId: attaquant.id, depuis: { x: 0, y: 0 }, cibles: [{ x: 1, y: 0 }], cible: { x: 1, y: 0 },
  });
  const html = emplacements(conteneur).get('duel')!.innerHTML;

  // Ce qui est parti, et qui se lit désormais dans le panneau d'unité — lequel,
  // dans la colonne de droite, ne s'efface plus pendant la visée.
  assert.ok(!html.includes(nomTerrain('fr', CAT, 'foret')), 'plus de terrain dans la prévision');
  assert.doesNotMatch(html, /★/, 'plus d’étoiles de défense');
  assert.doesNotMatch(html, /data-defense=/);
  assert.ok(!html.includes('hud.defense_part'), 'plus de pourcentage de terrain');
  assert.ok(!html.includes('hud.coup'), 'plus de mot sur les lignes');
  assert.ok(!html.includes('hud.riposte'));
  assert.ok(!html.includes('hud.duel_riposte_a'), 'plus de note explicative');
  assert.ok(!html.includes('hud.duel_riposte('), 'plus de « Riposte −2 PV » en bandeau');

  // Ce qui reste : deux lignes, et les chiffres que le moteur prévoit.
  const p = prevoirDuel(etat, CAT, attaquant, defenseur, { x: 0, y: 0 });
  assert.ok(p.riposte > 0, 'à ce contact, la cible rend le coup');
  assert.equal((html.match(/class="duel-camp"/g) ?? []).length, 2);
  assert.ok(html.includes(`<b>${p.pvCible}</b>`), 'les PV de la cible après le coup');
  assert.ok(html.includes(`<b>${p.pvAttaquant}</b>`), 'ceux de l’attaquant après la riposte');
  hud.demonter();
});

test('sans riposte, la prévision le dit : c’est la seule chose que le bandeau annonce encore', () => {
  // Une pièce indirecte à deux cases : la cible ne rend pas le coup.
  const etat = surGrille(['PPP', 'PPP', 'PPP'], [
    { camp: 0, type: 'artillerie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 2, y: 0 },
  ]);
  const attaquant = etat.unites.find((u) => u.camp === 0)!;
  const cible = etat.unites.find((u) => u.camp === 1)!;
  const p = prevoirDuel(etat, CAT, attaquant, cible, { x: 0, y: 0 });
  assert.equal(p.riposte, 0, 'à deux cases, aucune riposte');
  assert.equal(p.cibleHorsJeu, false);
  const { conteneur, hud } = hudEnVisee(etat, {
    attaquantId: attaquant.id, depuis: { x: 0, y: 0 }, cibles: [{ x: 2, y: 0 }], cible: { x: 2, y: 0 },
  });
  const html = emplacements(conteneur).get('duel')!.innerHTML;
  // Le bandeau ne dit plus que le notable : un tir gratuit en est.
  assert.ok(html.includes('hud.duel_sans_riposte'), 'l’issue dit l’absence de riposte');
  assert.ok(!html.includes('hud.duel_sans_riposte_note'), 'la note d’explication est partie');
  assert.ok(!html.includes('hud.duel_riposte('), 'plus de « Riposte −0 PV »');
  hud.demonter();
});

test('rolesDesChiffres lit le coup et la riposte dans la vraie partition d’un échange, réduite ou non', () => {
  const avant = surGrille(['PPP', 'PPP', 'PPP'], [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 1, y: 0 },
  ]);
  const attaquant = avant.unites.find((u) => u.camp === 0)!;
  const r = appliquer(avant, {
    type: 'ordre', uniteId: attaquant.id, chemin: [{ x: 0, y: 0 }],
    suite: { type: 'attaquer', cible: { x: 1, y: 0 } },
  }, CAT);
  assert.equal(r.ok, true);
  if (!r.ok) return;

  for (const reduit of [false, true]) {
    const p = ecrirePartition(r.evenements, avant, r.etat, {
      camp: 0, reduit, cadrer: false, ecranCombat: true,
    });
    const chiffres = p.gestes.filter((g) => g.genre === 'chiffre');
    assert.equal(chiffres.length, 2, `réduit=${reduit} : un coup et une riposte`);
    const roles = rolesDesChiffres(p.gestes);
    // Le coup tombe sur la cible, la riposte sur l'attaquant, et c'est la case
    // qui le dit : sous animations réduites tous les gestes partent à zéro,
    // et une règle fondée sur l'horloge y perdrait la distinction.
    const surCible = chiffres.find((g) => g.genre === 'chiffre' && g.case.x === 1 && g.case.y === 0)!;
    const surAttaquant = chiffres.find((g) => g.genre === 'chiffre' && g.case.x === 0 && g.case.y === 0)!;
    assert.equal(roles.get(surCible), 'coup', `réduit=${reduit}`);
    assert.equal(roles.get(surAttaquant), 'riposte', `réduit=${reduit}`);
  }
});

test('un chiffre de riposte porte son mot ; un coup, une réparation et une avarie n’en portent pas', async () => {
  const etat = partie();
  const { hud, conteneur, horloge } = hudAvecScenes(etat, () => ({ x: 90, y: 70 }));
  // Une salve écrite à la main dans la grammaire du réalisateur : le tir de
  // l'attaquant, le coup encaissé, puis le coup rendu — et un « + » de
  // réparation, qui n'est ni l'un ni l'autre.
  const att = { x: 1, y: 1 };
  const def = { x: 1, y: 2 };
  const partition: Partition = {
    gestes: [
      { genre: 'tirer', unite: 'a', depuis: att, vers: def, debut: 0, duree: 10 },
      { genre: 'encaisser', unite: 'b', case: def, degats: 40, depuis: att, debut: 10, duree: 10 },
      { genre: 'chiffre', case: def, valeur: 4, teinte: 'gain', debut: 10, duree: 60 },
      { genre: 'tirer', unite: 'b', depuis: def, vers: att, debut: 20, duree: 10 },
      { genre: 'encaisser', unite: 'a', case: att, degats: 20, depuis: def, debut: 30, duree: 10 },
      { genre: 'chiffre', case: att, valeur: 2, teinte: 'perte', debut: 30, duree: 60 },
      { genre: 'reparer', unite: 'c', case: { x: 4, y: 4 }, pv: 20, debut: 0, duree: 10 },
      { genre: 'chiffre', case: { x: 4, y: 4 }, valeur: 2, teinte: 'gain', debut: 0, duree: 60 },
      // Une avarie de mécanique : un coup sans tireur, il part de la case même.
      { genre: 'encaisser', unite: 'd', case: { x: 6, y: 6 }, degats: 10, depuis: { x: 6, y: 6 }, debut: 0, duree: 10 },
      { genre: 'chiffre', case: { x: 6, y: 6 }, valeur: 1, teinte: 'perte', debut: 0, duree: 60 },
    ],
    duree: 90,
  };
  const fin = hud.jouer(partition);
  horloge.avancer(35);
  const racine = scenes(conteneur);
  const chiffres = racine.children.filter((e) => e.className === 'atlas-chiffre');
  assert.equal(chiffres.length, 4);
  const roles = chiffres.map((e) => e.dataset['role']);
  assert.deepEqual(roles.filter((x) => x !== undefined).sort(), ['coup', 'riposte']);
  const riposte = chiffres.find((e) => e.dataset['role'] === 'riposte')!;
  assert.equal(riposte.textContent, '−2', 'le chiffre reste le chiffre');
  assert.equal(riposte.children.find((e) => e.className === 'etiquette')?.textContent, 'hud.riposte');
  const coup = chiffres.find((e) => e.dataset['role'] === 'coup')!;
  assert.equal(coup.children.length, 0, 'un coup seul se lit sans être nommé');
  const sansRole = chiffres.filter((e) => e.dataset['role'] === undefined);
  assert.equal(sansRole.length, 2, 'ni la réparation ni l’avarie ne sont des coups');
  for (const e of sansRole) assert.equal(e.children.length, 0);
  horloge.avancer(FIN_DES_SCENES);
  await fin;
  hud.demonter();
});

test('l’écran de combat nomme le coup et la riposte, et se tait quand un camp n’encaisse rien', async () => {
  const etat = partie();
  const [a, c] = etat.unites;
  assert.ok(a && c);
  const { hud, conteneur, horloge } = hudAvecScenes(etat, () => ({ x: 0, y: 0 }));
  const duel = (pvAttaquant: number, riposte: boolean): Partition => ({
    gestes: [{
      genre: 'duel',
      attaquant: { unite: a.id, type: a.type, camp: a.camp, case: { x: a.x, y: a.y }, pvAvant: 10, pvApres: pvAttaquant },
      cible: { unite: c.id, type: c.type, camp: c.camp, case: { x: c.x, y: c.y }, pvAvant: 10, pvApres: 6 },
      riposte, debut: 0, duree: 120,
    }],
    duree: 120,
  });

  const fin = hud.jouer(duel(8, true));
  horloge.avancer(10);
  const camps = (): FauxElement[] => {
    const ecran = scenes(conteneur).children.find((e) => e.className === 'atlas-combat')!;
    const cadre = ecran.children.find((e) => e.className === 'cadre')!;
    return cadre.children.find((e) => e.className === 'camps')!.children;
  };
  const [attaquant, , cible] = camps();
  assert.equal(cible!.children.find((e) => e.className === 'role')?.textContent, 'hud.coup');
  assert.equal(attaquant!.children.find((e) => e.className === 'role')?.textContent, 'hud.riposte');
  horloge.avancer(FIN_DES_SCENES);
  await fin;

  // Sans riposte, l'attaquant n'a rien encaissé : pas de chiffre, pas de mot.
  const fin2 = hud.jouer(duel(10, false));
  horloge.avancer(10);
  const [sansRiposte, , frappee] = camps();
  assert.equal(sansRiposte!.children.find((e) => e.className === 'role'), undefined);
  assert.equal(frappee!.children.find((e) => e.className === 'role')?.textContent, 'hud.coup');
  horloge.avancer(FIN_DES_SCENES);
  await fin2;
  hud.demonter();
});

test('la fiche dit ce que le terrain fait à la défense, et qu’une unité blessée frappe moins fort', () => {
  const etat = surGrille(['PPP', 'PPP', 'PPP'], [{ camp: 0, type: 'infanterie', x: 0, y: 0 }]);
  const blessee = etat.unites[0]!;
  blessee.pv = 47;
  const { conteneur } = document();
  const hud = monterHudHtml(conteneur as unknown as HTMLElement, {
    vue: (): VueJeu => ({ ...vueDe(etat, { x: 0, y: 0 }), selection: blessee.id }),
    t: (cle, params) => (params
      ? `${cle}(${Object.entries(params).map(([k, x]) => `${k}=${String(x)}`).join(',')})`
      : cle),
    finTour: () => undefined, choisirSuite: () => undefined, choisirProduction: () => undefined,
    jouerPouvoir: () => undefined, annuler: () => undefined, recommencer: () => undefined,
    versEcran: () => null,
  });
  // La fiche est repliée par défaut : c'est le bouton du panneau qui l'ouvre.
  const panneau = emplacements(conteneur).get('inspection')!;
  assert.ok(!panneau.innerHTML.includes('fiche.abris'), 'repliée, la fiche ne dit rien');
  cliquer(conteneur, 'fiche');
  const html = emplacements(conteneur).get('inspection')!.innerHTML;
  assert.ok(html.includes('fiche.abris'), 'le bloc des abris est là');
  assert.ok(html.includes('fiche.degats_reference'), 'et la note qui dit dans quelles conditions valent les dégâts');
  assert.ok(html.includes(`fiche.blessee(n=${pvAffiches(blessee.pv)})`), 'blessée, elle frappe moins fort');
  assert.match(html, /class="abri" data-defense="0"/, 'le découvert est un palier comme un autre');
  const montagne = Math.round((1 - facteurTerrain(CAT.terrains['montagne']!.defense)) * 100);
  assert.ok(html.includes(`hud.defense_part(n=${montagne})`), 'chaque palier dit ce qu’il retire');
  hud.demonter();
});

// ---------------------------------------------------------------------------
// La colonne de droite : la carte à gauche, le panneau à droite
// ---------------------------------------------------------------------------

test('railTient : la colonne demande de la largeur ET de la hauteur', () => {
  assert.equal(railTient(LARGEUR_MINIMALE_RAIL, HAUTEUR_MINIMALE_RAIL), true);
  assert.equal(railTient(LARGEUR_MINIMALE_RAIL - 1, HAUTEUR_MINIMALE_RAIL), false,
    'trop étroit : le plateau a besoin de sa place avant tout');
  assert.equal(railTient(1600, HAUTEUR_MINIMALE_RAIL - 1), false,
    'un téléphone couché a de la largeur et pas de hauteur : la colonne y serait un tunnel');
  assert.equal(railTient(0, 0), false);
});

test('chaque panneau va dans sa zone, et le panneau d’unité ne s’efface plus quand le menu d’ordres s’ouvre', () => {
  const etat = partie();
  const unite = etat.unites.find((u) => u.camp === 0);
  assert.ok(unite);
  const vue = (): VueJeu => ({
    ...vueDe(etat, { x: unite.x, y: unite.y }),
    phase: 'action',
    selection: unite.id,
    menu: {
      ancre: { x: unite.x, y: unite.y },
      options: [{ id: 'attendre', cle: 'hud.attendre', disponible: true }],
    },
  });

  const large = hudSur(vue, { largeur: 1400, hauteur: 900 });
  // La météo se lit **sous** la journée, et non derrière le panneau d'unité :
  // c'est la même question, et le panneau d'unité est le seul qui grandisse.
  assert.deepEqual(large.ordreRail(), ['partie', 'bulletin', 'inspection', 'dock'],
    'la colonne va de la journée au pied, la météo juste sous la journée');
  // Ce qui décrit la partie s'en va dans la colonne...
  for (const nom of ['partie', 'bulletin', 'inspection', 'dock']) {
    assert.equal(large.zone(nom), 'hud-rail', `${nom} appartient à la colonne`);
  }
  // ...ce qui commente une case reste sur l'image...
  for (const nom of ['ordres', 'duel', 'camera', 'attente', 'annonce']) {
    assert.equal(large.zone(nom), 'hud-carte', `${nom} reste ancré à la carte`);
  }
  // ...et une modale ne relève d'aucune des deux : son voile couvre les deux colonnes.
  for (const nom of ['production', 'fin']) {
    assert.equal(large.zone(nom), 'atlas-hud', `${nom} couvre les deux colonnes`);
  }
  // Le défaut que la colonne corrige : les PV, les munitions et le carburant
  // quittaient l'écran à l'instant précis où l'on choisit son ordre.
  assert.match(large.slots.get('inspection')!.innerHTML, /class="p inspect"/,
    'dans la colonne, le panneau d’unité survit au menu d’ordres');
  assert.match(large.slots.get('ordres')!.innerHTML, /data-valeur="attendre"/);
  large.demonter();

  // Sur écran étroit, rien ne change : les deux panneaux se disputeraient le
  // même coin, et c'est toujours le menu qui gagne.
  const etroit = hudSur(vue);
  assert.equal(etroit.zone('inspection'), 'hud-rail', 'la zone ne dépend pas de la largeur, la mise en page si');
  assert.equal(etroit.slots.get('inspection')!.innerHTML, '');
  etroit.demonter();
});

test('le démontage rend son conteneur tel quel : pas de marge de colonne orpheline', () => {
  const etat = partie();
  const h = hudSur(() => vueDe(etat, { x: 1, y: 1 }), { largeur: 1400, hauteur: 900 });
  assert.equal(h.conteneur.dataset['atlasRail'], 'oui');
  h.demonter();
  assert.equal(h.conteneur.dataset['atlasRail'], undefined);
  assert.equal(h.conteneur.dataset['atlasHote'], undefined);
});

test('la colonne montre les deux pouvoirs, et un bouton éteint dit pourquoi', () => {
  const etat = partie();
  const pouvoirs = {
    normal: {
      nom: 'commandant.x.pouvoir', cout: 100, pret: true,
      effets: [{ cible: 'mes_unites', modificateur: { quoi: 'attaque', valeur: 1.2 } }],
    },
    super: {
      nom: 'commandant.x.super', cout: 300, pret: false,
      effets: [{ cible: 'mes_unites', modificateur: { quoi: 'mouvement', valeur: 1 } }],
    },
  } as const;
  const large = hudSur(() => ({ ...vueDe(etat, { x: 1, y: 1 }), pouvoirs }), { largeur: 1400, hauteur: 900 });
  const html = large.slots.get('dock')!.innerHTML;
  assert.match(html, /data-action="pouvoir" data-niveau="normal"(?! disabled)/);
  // Le super pouvoir existait du moteur au splash, et n'avait aucun bouton.
  assert.match(html, /data-action="pouvoir_super" data-niveau="super" disabled/);
  assert.match(html, /hud\.jauge_insuffisante/, 'le bouton éteint dit pourquoi il l’est');
  assert.match(html, /commandant\.x\.pouvoir/);
  assert.match(html, /commandant\.x\.super/);
  large.demonter();

  // Écran étroit : le bouton unique d'avant, et rien de plus — un dock de 72 px
  // ne porte pas deux pouvoirs nommés.
  const etroit = hudSur(() => ({ ...vueDe(etat, { x: 1, y: 1 }), pouvoirs }));
  const compact = etroit.slots.get('dock')!.innerHTML;
  assert.match(compact, /data-action="pouvoir"/);
  assert.doesNotMatch(compact, /pouvoir_super/);
  etroit.demonter();
});

test('le compteur de capture dit le seuil de la case, et le QG en demande le double', () => {
  const cat = chargerCatalogue();
  const etat = creerPartie(scenePersonnalisee(['PCH'], {}, [
    { camp: 0, type: 'infanterie', x: 1, y: 0 },
  ]), cat, 'hud');
  const unite = etat.unites[0];
  assert.ok(unite);
  unite.pointsCapture = 12;
  const surVille = hudSur(() => ({ ...vueDe(etat, { x: 1, y: 0 }), catalogue: cat }));
  assert.match(surVille.slots.get('inspection')!.innerHTML,
    /hud\.capture_points \{&quot;n&quot;:12,&quot;total&quot;:20\}/);
  surVille.demonter();

  // Le même compte sur un QG vaut la moitié du chemin : c'est exactement ce
  // qu'un fanion hissé à mi-hauteur ne peut pas dire.
  unite.x = 2;
  const surQg = hudSur(() => ({ ...vueDe(etat, { x: 2, y: 0 }), catalogue: cat }));
  assert.match(surQg.slots.get('inspection')!.innerHTML,
    /hud\.capture_points \{&quot;n&quot;:12,&quot;total&quot;:40\}/);
  surQg.demonter();
});

test('le bandeau de partie tient sur une bande : la journée, les fonds, le revenu — et rien d’autre', () => {
  const etat = partie();
  for (const taille of [undefined, { largeur: 1400, hauteur: 900 }]) {
    const h = hudSur(() => vueDe(etat, { x: 1, y: 1 }), taille);
    const html = h.slots.get('partie')!.innerHTML;
    assert.match(html, /hud\.journee/);
    assert.match(html, /class="fonds"/);
    // Le solde dit où l'on en est, le revenu dit où l'on va : c'est la moitié
    // qui manquait, et elle tient dans six caractères.
    assert.match(html, /class="revenu"/);
    assert.match(html, /hud\.revenu \{&quot;n&quot;:/);
    // Le compte de bâtiments est parti : « le 1/1, je ne suis pas sûr qu'il soit
    // utile », et il coûtait une ligne permanente pour un chiffre qu'on regarde
    // deux fois par partie.
    assert.doesNotMatch(html, /class="points"/);
    h.demonter();
  }
});

test('le bulletin montre trois journées, la courante en avant, sans rien replier', () => {
  const etat = partie();
  const h = hudSur(() => vueDe(etat, { x: 1, y: 1 }), { largeur: 1400, hauteur: 900 });
  const html = h.slots.get('bulletin')!.innerHTML;
  // Trois cases : aujourd'hui, et les deux journées que le climat annonce.
  assert.equal((html.match(/class="meteo-case"/g) ?? []).length, 3);
  assert.equal((html.match(/data-courant="oui"/g) ?? []).length, 1, 'une seule journée est celle qu’on joue');
  assert.match(html, new RegExp(`hud\\.meteo_jour \\{&quot;n&quot;:${Math.max(1, etat.journee)}\\}`));
  assert.match(html, new RegExp(`hud\\.meteo_jour \\{&quot;n&quot;:${Math.max(1, etat.journee) + 2}\\}`));
  // Plus d'accordéon : la météo change le mouvement et la vision, elle ne se
  // range pas derrière un clic.
  assert.doesNotMatch(html, /<details|<summary/);
  h.demonter();
});

test('le bouton de détail de la jauge déplie ce que font les deux pouvoirs, lu sur leurs effets', () => {
  const etat = partie();
  const pouvoirs = {
    normal: {
      nom: 'commandant.x.pouvoir', cout: 100, pret: true,
      effets: [{ cible: 'mes_unites', modificateur: { quoi: 'attaque', valeur: 1.2 } }],
    },
    super: {
      nom: 'commandant.x.super', cout: 300, pret: false,
      effets: [{ cible: 'mes_unites', modificateur: { quoi: 'mouvement', valeur: 1 } }],
    },
  } as const;
  const h = hudSur(() => ({ ...vueDe(etat, { x: 1, y: 1 }), pouvoirs }), { largeur: 1400, hauteur: 900 });
  const dock = h.slots.get('dock')!;
  // Replié par défaut : le bouton existe, les effets non.
  assert.match(dock.innerHTML, /data-action="pouvoir_info"/);
  assert.doesNotMatch(dock.innerHTML, /class="pouvoir-effets"/);

  cliquer(h.conteneur, 'pouvoir_info');
  const ouvert = h.slots.get('dock')!.innerHTML;
  assert.match(ouvert, /class="pouvoir-effets"/);
  // Un rapport se dit en pour cent, un entier en points : la forme vient des
  // bornes du moteur, elle n'est pas redécidée ici.
  assert.match(ouvert, /hud\.effet_pourcent \{&quot;quoi&quot;:&quot;modificateur\.attaque&quot;,&quot;signe&quot;:&quot;\+&quot;,&quot;n&quot;:20\}/);
  assert.match(ouvert, /hud\.effet_points \{&quot;quoi&quot;:&quot;modificateur\.mouvement&quot;,&quot;signe&quot;:&quot;\+&quot;,&quot;n&quot;:1\}/);
  h.demonter();
});

test('cliquer une unité seule ouvre son détail ; un transport chargé ne décide pas à ma place', () => {
  const etat = partie();
  const [seule, porteur, passager] = etat.unites.filter((u) => u.camp === 0);
  assert.ok(seule && porteur && passager);
  porteur.cargo = [passager.id];
  passager.dansTransport = porteur.id;

  let selection: string | null = null;
  const vue = (): VueJeu => ({ ...vueDe(etat, { x: seule.x, y: seule.y }), selection });
  const h = hudSur(vue, { largeur: 1400, hauteur: 900 });
  // Rien de sélectionné : la fiche est repliée.
  assert.doesNotMatch(h.slots.get('inspection')!.innerHTML, /class="fiche"/);

  selection = seule.id;
  h.rafraichir();
  assert.match(h.slots.get('inspection')!.innerHTML, /class="fiche"/,
    'une unité qui ne porte rien n’a rien à cacher : le détail s’ouvre');

  // Un transport chargé pose la question de savoir de qui l'on parle ; on n'y
  // répond pas à sa place.
  selection = porteur.id;
  h.rafraichir();
  assert.doesNotMatch(h.slots.get('inspection')!.innerHTML, /class="fiche"/);
  h.demonter();

  // Sur écran étroit, jamais : la fiche dépliée couvrirait le plateau qu'on lit.
  let etroite: string | null = null;
  const petit = hudSur(() => ({ ...vueDe(etat, { x: seule.x, y: seule.y }), selection: etroite }));
  etroite = seule.id;
  petit.rafraichir();
  assert.doesNotMatch(petit.slots.get('inspection')!.innerHTML, /class="fiche"/);
  petit.demonter();
});

test('la fiche montre une tuile par terrain, peinte avec la palette du canon', () => {
  const etat = partie();
  const unite = etat.unites.find((u) => u.camp === 0);
  assert.ok(unite);
  const h = hudSur(() => ({
    ...vueDe(etat, { x: unite.x, y: unite.y }), selection: unite.id,
  }), { largeur: 1400, hauteur: 900 });
  const html = h.slots.get('inspection')!.innerHTML;
  assert.match(html, /class="puce tuilee"/);
  assert.match(html, /class="tuile"/);
  // La couleur vient du canon, jamais d'une seconde table : une tuile de plaine
  // porte exactement la teinte que `content/terrains.json` lui donne.
  const plaine = CAT.terrains['plaine'];
  assert.ok(plaine);
  assert.ok(html.includes(`fill="${plaine.palette.main}"`),
    'la tuile est peinte avec la palette que le terrain déclare');
  h.demonter();
});


// ---------------------------------------------------------------------------
// Le vocabulaire visuel : l'échelle, les signes, la couleur de l'armée
// ---------------------------------------------------------------------------

/** La feuille de style du HUD, lue dans la source : elle n'est pas exportée. */
function feuille(): string {
  const source = readFileSync(path.resolve(import.meta.dirname, '..', '..', 'src', 'render', 'hud-html.ts'), 'utf8');
  const debut = source.indexOf('const STYLE = `');
  const fin = source.indexOf('\n`;', debut);
  assert.ok(debut >= 0 && fin > debut, 'la feuille de style est introuvable');
  return source.slice(debut, fin);
}

test('l’échelle typographique est fermée : huit crans, et aucune taille écrite à la main', () => {
  // Dix-neuf tailles cohabitaient — 9, 9,5, 10, 11, 11,5, 12, 12,5, 13, 13,5,
  // 14, 15, 16, 17, 20, 21, 22, 25, 26 px —, c'est-à-dire aucune échelle. Sans
  // police de jeu, la régularité de l'échelle est le levier le plus fort ; ce
  // test est ce qui l'empêche de se re-sédimenter au prochain panneau ajouté.
  const css = feuille();
  const enDur = css.match(/font-size:\s*[0-9.]+px/g) ?? [];
  assert.deepEqual(enDur, [], 'une taille écrite à la main dans la feuille du HUD');
  const crans = new Set(css.match(/font-size:var\(--t[1-8]\)/g) ?? []);
  assert.equal(crans.size, 8, 'les huit crans servent tous, et il n’y en a pas un neuvième');
  for (let i = 1; i <= 8; i += 1) {
    assert.match(css, new RegExp(`--t${i}:[0-9]+px`), `le cran --t${i} est déclaré`);
  }
});

test('aucun signe du HUD n’est un caractère : retour, détail et zooms sont dessinés', () => {
  // Le « i » du bouton de détail était l'icône « info » du web, le retour un
  // « ↶ » de traitement de texte, et les zooms un « + » et un « − » de 25 px
  // dans des carrés — « une calculatrice ». Tout le reste du jeu est dessiné.
  const etat = partie();
  const unite = etat.unites.find((u) => u.camp === 0);
  assert.ok(unite);
  const h = hudSur(() => ({ ...vueDe(etat, { x: unite.x, y: unite.y }), selection: unite.id }), { largeur: 1400, hauteur: 900 });
  const inspection = h.slots.get('inspection')!.innerHTML;
  assert.match(inspection, /class="detail"[^>]*>\s*<svg/, 'le détail est une loupe, pas un « i »');
  assert.match(inspection, /class="retour"[^>]*>\s*<svg/, 'le retour est une flèche dessinée');
  assert.ok(!inspection.includes('↶'), 'plus de « ↶ »');
  h.demonter();

  // Les commandes de caméra n'existent que si le rendu sait zoomer et tourner :
  // on monte donc un HUD qui le sait.
  const { conteneur } = document();
  conteneur.clientWidth = 1400;
  conteneur.clientHeight = 900;
  const camera = monterHudHtml(conteneur as unknown as HTMLElement, {
    vue: () => vueDe(etat, { x: 0, y: 0 }),
    t: (cle) => cle,
    finTour: () => undefined, choisirSuite: () => undefined, choisirProduction: () => undefined,
    jouerPouvoir: () => undefined, annuler: () => undefined, recommencer: () => undefined,
    versEcran: () => null, zoomer: () => undefined, tourner: () => undefined, recentrer: () => undefined,
  });
  const boutons = emplacements(conteneur).get('camera')!.innerHTML;
  assert.equal((boutons.match(/<svg/g) ?? []).length, 5, 'cinq boutons — deux rotations, deux zooms, un recentrage —, cinq dessins');
  assert.doesNotMatch(boutons, /aria-hidden="true">[+−]</, 'plus de « + » ni de « − » de calculatrice');
  camera.demonter();
});

test('le HUD prend la couleur de l’armée en main, sans réécrire un seul emplacement', () => {
  // « Dans un Advance Wars, la fenêtre prend la couleur de l'armée qui joue ;
  // ici c'est un filet » — les deux personas, le même reproche. La couleur est
  // posée sur la racine par le style, jamais par le HTML : changer de tour ne
  // coûte donc aucune écriture de DOM.
  const etat = partie();
  const h = hudSur(() => vueDe(etat, { x: 1, y: 1 }), { largeur: 1400, hauteur: 900 });
  const racine = h.conteneur.children.find((e) => e.className === 'atlas-hud')!;
  assert.equal(racine.style['--camp'], PALETTES.bleu.main, 'le camp 0 joue : le bleu');
  const ecritures = new Map([...h.slots].map(([nom, e]) => [nom, e.ecritures]));

  etat.campCourant = 1;
  h.rafraichir();
  assert.equal(racine.style['--camp'], PALETTES.rouge.main, 'le camp 1 joue : le rouge');
  // Un seul emplacement change, et ce n'est pas pour la couleur : la fin de tour
  // s'éteint parce que ce n'est plus mon tour. Les dix autres — la bande de
  // partie comprise, qui porte pourtant la couleur du camp — ne bougent pas.
  const remues = [...h.slots].filter(([nom, e]) => e.ecritures !== ecritures.get(nom)).map(([nom]) => nom);
  assert.deepEqual(remues, ['dock'], 'la couleur du tour ne passe pas par le HTML');
  h.demonter();
});

test('une alerte porte un signe, pas seulement une couleur', () => {
  // `data-alerte` ne parlait que par la teinte : un daltonien ne lisait rien.
  // Trois registres désormais — un signe, une forme (le cadre en orange, la
  // plaque pleine en rouge, par le CSS), une teinte —, il en reste deux si
  // l'une manque.
  const etat = partie();
  const unite = etat.unites.find((u) => u.camp === 0 && u.munitions !== null && CAT.unites[u.type]!.munitions !== null);
  assert.ok(unite);
  unite.munitions = 0;
  const r = inspection(etat, { x: unite.x, y: unite.y });
  assert.match(r.html, /data-alerte="rouge"[^>]*>\s*<svg/, 'le triangle précède le chiffre');
  r.demonter();
});

// ---------------------------------------------------------------------------
// Le pouvoir, et le menu de production
// ---------------------------------------------------------------------------

const POUVOIRS = {
  normal: {
    nom: 'commandant.x.pouvoir', cout: 100, pret: true,
    effets: [{ cible: 'mes_unites', modificateur: { quoi: 'attaque', valeur: 1.2 } }],
  },
  super: {
    nom: 'commandant.x.super', cout: 300, pret: true,
    effets: [{ cible: 'mes_unites', modificateur: { quoi: 'mouvement', valeur: 1 } }],
  },
} as const;

test('un bouton de pouvoir tient sur une ligne : un signe pour le rang, plus un mot', () => {
  // Ils portaient trois tailles de texte dans une boîte de 40 px — un rang en
  // capitales de 8,5 px, un nom de 12, un prix de 11 —, soit un panneau pour
  // deux libellés. Le rang est un éclair, deux pour le super ; il reste écrit
  // dans le nom accessible, seul endroit où un mot vaut mieux qu'un dessin.
  const etat = partie();
  const h = hudSur(() => ({ ...vueDe(etat, { x: 1, y: 1 }), pouvoirs: POUVOIRS }), { largeur: 1400, hauteur: 900 });
  const dock = h.slots.get('dock')!.innerHTML;
  assert.doesNotMatch(dock, /class="entete"/, 'plus de ligne d’en-tête dans le bouton');
  assert.doesNotMatch(dock, /class="pouvoir"[^>]*>[^<]*<span class="rang"/, 'le rang n’est plus un mot du bouton');
  assert.match(dock, /class="pouvoir"[^>]*>\s*<svg/, 'le rang est un signe, en tête du bouton');
  assert.equal((dock.match(/class="nom"/g) ?? []).length, 2);
  assert.equal((dock.match(/class="prix"/g) ?? []).length, 2);
  // Le mot reste dans le nom accessible : c'est là qu'il sert encore.
  assert.match(dock, /aria-label="hud\.super_pouvoir · commandant\.x\.super"/);
  h.demonter();
});

/** Un HUD ouvert sur le menu de production d'un bâtiment, en catalogue 4. */
function enProduction(unites: readonly CleUnite[], fonds?: number) {
  const cat = chargerCatalogue(4);
  const etat = creerPartie(scenePersonnalisee(['PUP'], {}, [{ camp: 0, type: 'infanterie', x: 0, y: 0 }]), cat, 'prod');
  const camp = etat.camps.find((c) => c.id === 0);
  assert.ok(camp);
  if (fonds !== undefined) camp.fonds = fonds;
  return {
    cat,
    fonds: camp.fonds,
    ...hudSur(() => ({
      ...vueDe(etat, { x: 1, y: 0 }), catalogue: cat, phase: 'production',
      production: { batiment: { x: 1, y: 0 }, unites },
    }), { largeur: 1400, hauteur: 900 }),
  };
}

test('le menu de production replie sa fiche longue, et le bouton de détail l’ouvre — un seul balisage', () => {
  // Le panneau posait la grille, cinq chiffres, les traits, ce qu'elle démolit,
  // ce qui la démolit, la note de référence, les paliers d'abri, deux listes de
  // terrains et deux de météo : sept cents pixels ancrés à côté d'un bâtiment,
  // avec trois zones de défilement imbriquées. « Moche et pas très intuitif. »
  const h = enProduction(['infanterie', 'char_leger']);
  let html = h.slots.get('production')!.innerHTML;
  // Ce qui décide d'un achat reste : les chiffres, ce qu'elle démolit, ce qui la démolit.
  assert.match(html, /class="cartouche"/);
  assert.doesNotMatch(html, /<dl>/, 'les chiffres ne sont plus une liste de définitions');
  assert.match(html, /fiche\.forte/);
  assert.match(html, /fiche\.craint/);
  // Ce qui explique un chiffre attend qu'on le demande.
  assert.ok(!html.includes('fiche.abris'), 'les paliers d’abri sont repliés');
  assert.ok(!html.includes('fiche.rapide'), 'les terrains aussi');
  assert.match(html, /data-action="fiche_production" aria-expanded="false"/);

  cliquer(h.conteneur, 'fiche_production');
  html = h.slots.get('production')!.innerHTML;
  assert.ok(html.includes('fiche.abris'), 'dépliée, c’est la fiche complète');
  assert.ok(html.includes('fiche.rapide'));
  assert.ok(html.includes('fiche.degats_reference'));
  assert.match(html, /data-action="fiche_production" aria-expanded="true"/);
  // Et c'est **le même** balisage que le panneau d'unité : une seule fiche.
  assert.match(html, /class="fiche"/);
  h.demonter();
});

test('le pied du menu de production dit ce qui resterait après l’achat, ou ce qui manque', () => {
  const riche = enProduction(['infanterie'], 9000);
  const cout = riche.cat.unites['infanterie']!.cout;
  // Le nombre passe par `Intl` : on compare au **format**, pas aux chiffres nus.
  assert.ok(riche.slots.get('production')!.innerHTML
    .includes(`fiche.solde_apres {&quot;n&quot;:&quot;${nombre('fr', 9000 - cout)}&quot;}`));
  assert.doesNotMatch(riche.slots.get('production')!.innerHTML, /data-manque="oui"/);
  riche.demonter();

  const pauvre = enProduction(['infanterie'], 0);
  const html = pauvre.slots.get('production')!.innerHTML;
  assert.match(html, /class="note" data-manque="oui">fiche\.fonds_insuffisants/);
  assert.match(html, /class="recruter" data-action="produire" data-valeur="infanterie" disabled/);
  // Trop chère, mais toujours consultable : on veut savoir pour quoi l'on économise.
  assert.match(html, /data-abordable="non"/);
  pauvre.demonter();
});

// ---------------------------------------------------------------------------
// L'écran de fin
// ---------------------------------------------------------------------------

test('l’écran de fin porte un bilan des deux camps, lu sur l’état et rien d’autre', () => {
  // C'étaient un titre, une journée et un bouton : rien de ce que le match
  // venait de produire, alors que tout est dans l'état.
  const etat = partie();
  etat.partie = { ...etat.partie, terminee: true, vainqueur: 0, nul: false };
  etat.produites = { '0:infanterie': 3, '0:char_leger': 1, '1:infanterie': 2 };
  const miennes = etat.unites.filter((u) => u.camp === 0).length;
  const batiments0 = Object.values(etat.proprietaires).filter((c) => c === 0).length;
  const h = hudSur(() => ({ ...vueDe(etat, { x: 0, y: 0 }), phase: 'fin' }), { largeur: 1400, hauteur: 900 });
  const html = h.slots.get('fin')!.innerHTML;
  assert.match(html, /combat\.manche_gagnee/);
  assert.match(html, /data-action="rejouer"/);
  // Trois lignes, plus la tête qui nomme les deux commandants.
  assert.equal((html.match(/class="bilan-ligne"/g) ?? []).length, 3);
  assert.match(html, /class="bilan-ligne bilan-tete"/);
  assert.match(html, /hud\.bilan_unites/);
  assert.match(html, /hud\.bilan_batiments/);
  assert.match(html, /hud\.bilan_recrutees/);
  // Mon camp d'abord, et les comptes sont ceux de l'état.
  const chiffres = [...html.matchAll(/<b style="--teinte:([^"]+)">([^<]+)<\/b>/g)];
  assert.equal(chiffres.length, 6, 'trois lignes, deux camps');
  assert.equal(chiffres[0]![1], PALETTES.bleu.main, 'mon camp est en tête');
  assert.equal(chiffres[0]![2], String(miennes));
  assert.equal(chiffres[2]![2], String(batiments0));
  assert.equal(chiffres[4]![2], '4', 'trois infanteries et un char : quatre recrues');
  assert.equal(chiffres[5]![2], '2');
  h.demonter();
});

test('le panneau d’unité annonce la zone de danger sur une unité adverse, et sur elle seule', () => {
  // Le calcul existe depuis toujours, le geste est un double-clic, et rien ne
  // l'annonçait : une fonctionnalité qu'aucun joueur ne peut découvrir n'existe pas.
  const etat = partie();
  const mienne = etat.unites.find((u) => u.camp === 0);
  const sienne = etat.unites.find((u) => u.camp === 1);
  assert.ok(mienne && sienne);
  const sur = (u: Unite) => hudSur(() => vueDe(etat, { x: u.x, y: u.y }), { largeur: 1400, hauteur: 900 });
  const adverse = sur(sienne);
  assert.match(adverse.slots.get('inspection')!.innerHTML, /class="astuce">.*hud\.danger_astuce/);
  adverse.demonter();
  const amie = sur(mienne);
  assert.doesNotMatch(amie.slots.get('inspection')!.innerHTML, /hud\.danger_astuce/,
    'sur ma propre unité, le double-clic ne montre rien : l’astuce mentirait');
  amie.demonter();
});

// ---------------------------------------------------------------------------
// Les deux commandes que le HUD sait rendre et que `jeu.ts` doit encore brancher
// ---------------------------------------------------------------------------

test('la case de mouvement dit le coût du chemin pointé, et redevient le mouvement sans chemin', () => {
  // « Le coût du chemin pointé pendant la visée » : le calcul existe au
  // contrôleur (`deplacementDe` garde la Portee du moteur), il n'était affiché
  // nulle part. Le HUD le rend dès que la vue le porte.
  const etat = partie();
  const unite = etat.unites.find((u) => u.camp === 0);
  assert.ok(unite);
  const type = CAT.unites[unite.type]!;
  let cout: { cout: number; max: number } | null = { cout: 4, max: type.mouvement };
  const h = hudSur(() => ({
    ...vueDe(etat, { x: unite.x, y: unite.y }), phase: 'selection', selection: unite.id, cheminCout: cout,
  }), { largeur: 1400, hauteur: 900 });
  // La ligne de statistiques du panneau, et elle seule : la fiche dépliée porte
  // légitimement le mouvement du **type**, qui ne dépend d'aucun chemin.
  const ligne = (): string => /<div class="stats">(.*?)<\/div>/.exec(h.slots.get('inspection')!.innerHTML)?.[1] ?? '';
  assert.match(ligne(), new RegExp(`hud\\.chemin_cout \\{&quot;n&quot;:4,&quot;max&quot;:${type.mouvement}\\}`));
  assert.doesNotMatch(ligne(), /hud\.mouvement/,
    'la case de mouvement est occupée par le coût, elle n’est pas doublée');

  cout = null;
  h.rafraichir();
  assert.match(ligne(), new RegExp(`hud\\.mouvement \\{&quot;n&quot;:${type.mouvement}\\}`));
  assert.doesNotMatch(ligne(), /hud\.chemin_cout/);
  h.demonter();
});

test('le bouton « unité suivante » n’existe que si le jeu sait y répondre', () => {
  // Le compteur du bouton de fin de tour dit « 4 unités prêtes » sans donner
  // aucun moyen de les retrouver, et `recentrer` va sur la sélection, pas sur la
  // prochaine à jouer. Le HUD offre la commande, comme il offre le zoom : dès
  // que l'API la porte, et jamais sinon.
  const etat = partie();
  const monter = (uniteSuivante?: () => void) => {
    const { conteneur } = document();
    conteneur.clientWidth = 1400;
    conteneur.clientHeight = 900;
    const hud = monterHudHtml(conteneur as unknown as HTMLElement, {
      vue: () => vueDe(etat, { x: 0, y: 0 }),
      t: (cle) => cle,
      finTour: () => undefined, choisirSuite: () => undefined, choisirProduction: () => undefined,
      jouerPouvoir: () => undefined, annuler: () => undefined, recommencer: () => undefined,
      versEcran: () => null, ...(uniteSuivante ? { uniteSuivante } : {}),
    });
    return { html: emplacements(conteneur).get('camera')!.innerHTML, conteneur, demonter: () => hud.demonter() };
  };
  const sans = monter();
  assert.equal(sans.html, '', 'sans commande, pas de bouton — et pas de panneau du tout');
  sans.demonter();

  let appels = 0;
  const avec = monter(() => { appels += 1; });
  assert.match(avec.html, /data-action="unite_suivante"[^>]*aria-label="hud\.unite_suivante"/);
  cliquer(avec.conteneur, 'unite_suivante');
  assert.equal(appels, 1, 'le clic va au jeu, le HUD ne décide de rien');
  avec.demonter();
});
