// Le HUD n'écrit dans le DOM que les emplacements dont le HTML a changé. Il
// n'y a pas de jsdom ici : un document factice compte les écritures
// d'`innerHTML`, ce qui est exactement ce qu'on veut mesurer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  chargerCatalogue, creerPartie, reglagesParDefaut, sceneDeCarte, type EtatPartie,
} from '../../src/engine/index';
import { ambiance } from '../../src/render/ambiance';
import { monterHudHtml, poserEmplacements, type VueJeu } from '../../src/render/hud-html';
import type { HorlogeScenes } from '../../src/render/scenes-html';
import { DUREES, type Partition } from '../../src/render/partition';
import { chiffreSigne, MS_FIXE } from '../../src/render/scenes-html';
import { validerMapDef } from '../../src/schemas/index';

class FauxElement {
  children: FauxElement[] = [];
  className = '';
  id = '';
  textContent = '';
  dataset: Record<string, string> = {};
  attributs = new Map<string, string>();
  style: Record<string, unknown> = { setProperty: (): void => undefined };
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
  ecouteurs = new Map<string, (e: Event) => void>();
  addEventListener(type: string, fn: (e: Event) => void): void { this.ecouteurs.set(type, fn); }
  removeEventListener(type: string): void { this.ecouteurs.delete(type); }
  focus(): void { /* idem */ }
}
// `instanceof HTMLElement` et `HTMLCanvasElement` sont évalués par le HUD.
const g = globalThis as Record<string, unknown>;
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

/** Les emplacements de la racine du HUD, par nom, avec leurs écritures. */
function emplacements(conteneur: FauxElement): Map<string, FauxElement> {
  const racine = conteneur.children.find((e) => e.className === 'atlas-hud');
  assert.ok(racine);
  return new Map(racine.children.map((e) => [e.attributs.get('data-emplacement') ?? '', e]));
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
