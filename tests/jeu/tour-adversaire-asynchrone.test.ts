// Le chef d'orchestre (`render/jeu.ts`, `tourAdversaire`) accepte depuis le
// 23 septembre 2026 un adversaire qui répond **plus tard** — une promesse, le
// tour calculé dans un Web Worker. Il doit jouer la suite exactement comme
// celle d'un adversaire synchrone, et ne jamais jouer une suite arrivée pour
// une partie démontée ou recommencée entre-temps. Le jeu est monté pour de
// bon, sans navigateur : une peau muette, et un document factice pour le HUD.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { creerAdversaireEnFond } from '../../src/app/jeu/adversaire-fond';
import { appliquer, type Action, type EtatPartie } from '../../src/engine/index';
import { monterJeu, type Adversaire, type Jeu } from '../../src/render/jeu';
import type { GestesRendu, Rendu } from '../../src/render/rendu';
import { adversaireDuFil, FauxWorker, partieNeuve, preparerPartie, unInstant, type Partie } from './aides';

// ---------------------------------------------------------------------------
// Un document factice, juste assez pour que le HUD se monte et reçoive un clic
// (le même principe que `tests/render/hud-html.test.ts`, sans jsdom).
// ---------------------------------------------------------------------------

class FauxElement {
  children: FauxElement[] = [];
  parent: FauxElement | null = null;
  className = '';
  id = '';
  clientWidth = 0;
  clientHeight = 0;
  textContent = '';
  innerHTML = '';
  dataset: Record<string, string> = {};
  attributs = new Map<string, string>();
  style: Record<string, unknown> = {
    setProperty(this: Record<string, unknown>, cle: string, valeur: string): void { this[cle] = valeur; },
  };
  ownerDocument: unknown;
  ecouteurs = new Map<string, (e: Event) => void>();
  setAttribute(k: string, v: string): void { this.attributs.set(k, v); }
  hasAttribute(k: string): boolean { return this.attributs.has(k); }
  appendChild(e: FauxElement): FauxElement { e.parent = this; this.children.push(e); return e; }
  remove(): void {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((e) => e !== this);
    this.parent = null;
  }
  contains(): boolean { return false; }
  querySelector(): null { return null; }
  classList = { contains: (c: string): boolean => this.className.split(' ').includes(c) };
  /** Le HUD ne demande que « [data-action] » : on remonte les `dataset`. */
  closest(selecteur: string): FauxElement | null {
    const attribut = selecteur.replace(/[[\]]/g, '').replace(/^data-/, '').replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- on remonte la chaîne des parents, en partant de soi.
    let noeud: FauxElement | null = this;
    while (noeud) {
      if (noeud.dataset[attribut] !== undefined) return noeud;
      noeud = noeud.parent;
    }
    return null;
  }
  addEventListener(type: string, fn: (e: Event) => void): void { this.ecouteurs.set(type, fn); }
  removeEventListener(type: string): void { this.ecouteurs.delete(type); }
  focus(): void { /* rien à faire */ }
}
const globales = globalThis as Record<string, unknown>;
globales['Element'] ??= FauxElement;
globales['HTMLElement'] ??= FauxElement;
globales['HTMLCanvasElement'] ??= class {};

/** Un conteneur dans un document factice. */
function conteneurFactice(): FauxElement {
  const doc = {
    createElement: (): FauxElement => Object.assign(new FauxElement(), { ownerDocument: doc }),
    getElementById: (): null => null,
    head: new FauxElement(),
    activeElement: null,
    defaultView: undefined,
  };
  const conteneur = new FauxElement();
  conteneur.ownerDocument = doc;
  return conteneur;
}

/** Clique un bouton du HUD, comme le doigt : un élément qui porte `data-action`. */
function cliquerHud(conteneur: FauxElement, action: string): void {
  const racine = conteneur.children.find((e) => e.className === 'atlas-hud');
  const surClic = racine?.ecouteurs.get('click');
  if (!surClic) throw new Error('HUD non monté');
  const bouton = new FauxElement();
  bouton.dataset['action'] = action;
  surClic({ target: bouton, preventDefault: () => undefined, stopPropagation: () => undefined } as unknown as Event);
}

/** Une peau muette, qui garde les gestes qu'on lui branche : ce sont nos doigts. */
function peauMuette(): { rendu: Rendu; gestes: () => GestesRendu } {
  let gestes: GestesRendu | null = null;
  const rendu = {
    cle: '3d' as const,
    canvas: null,
    monter: () => undefined,
    afficher: () => undefined,
    animer: () => Promise.resolve(),
    versMonde: () => null,
    versEcran: () => null,
    brancher: (g: GestesRendu) => { gestes = g; return () => { gestes = null; }; },
    msParImage: () => 0,
    capturer: () => null,
    cadrer: () => undefined,
    demonter: () => undefined,
  } as unknown as Rendu;
  return {
    rendu,
    gestes: () => {
      if (!gestes) throw new Error('aucun geste branché');
      return gestes;
    },
  };
}

/** Une partie montée pour de bon, et de quoi y jouer. */
interface Montage {
  jeu: Jeu;
  conteneur: FauxElement;
  /** Les états que la page a reçus, dans l'ordre (`surEtat`), sans doublon consécutif. */
  etats: EtatPartie[];
  /** Le camp du joueur humain. */
  camp: 0 | 1;
  finTour(): void;
}

function monter(p: Partie, adversaire: Adversaire, hud = false, camp: 0 | 1 = 0): Montage {
  const { rendu, gestes } = peauMuette();
  const conteneur = conteneurFactice();
  const etats: EtatPartie[] = [];
  const jeu = monterJeu(conteneur as unknown as HTMLElement, {
    scenario: p.scenario, carte: p.carte, catalogue: p.cat, commandants: p.commandants, graine: p.graine,
    adversaire, fabriqueRendu: () => rendu, hud, dialogues: false, debug: false, camp,
    vitesseAnimations: 'instantanee', animationsReduites: true,
    surEtat: (e) => { if (etats.at(-1) !== e) etats.push(e); },
  });
  return { jeu, conteneur, etats, camp, finTour: () => gestes().surTouche?.('fin_tour') };
}

/** Attend que la main revienne au joueur : c'est à son camp, et le contrôleur n'attend plus. */
async function mainAuJoueur(m: Montage, budget = 60_000): Promise<void> {
  const debut = Date.now();
  while (Date.now() - debut < budget) {
    if (m.jeu.etat.partie.terminee) return;
    if (m.jeu.etat.campCourant === m.camp && m.conteneur.dataset['etat'] !== 'attente') return;
    await unInstant(2);
  }
  throw new Error('la main n’est pas revenue au joueur');
}

/** Un adversaire dont on tient la réponse : il note l'état demandé, on décide quand il répond. */
function adversaireTenu(): {
  adversaire: Adversaire;
  demandes: EtatPartie[];
  repondre(actions: Action[]): void;
  demande(n?: number): Promise<EtatPartie>;
} {
  const demandes: EtatPartie[] = [];
  const enAttente: ((actions: Action[]) => void)[] = [];
  return {
    adversaire: (etat) => new Promise<Action[]>((resoudre) => { demandes.push(etat); enAttente.push(resoudre); }),
    demandes,
    repondre: (actions) => { enAttente.shift()?.(actions); },
    /** La `n`-ième demande (à partir de 1), dès qu'elle est faite ; une erreur si elle ne vient pas. */
    demande: async (n = 1) => {
      const debut = Date.now();
      while (demandes.length < n) {
        if (Date.now() - debut > 20_000) throw new Error(`la demande n° ${n} n’est jamais venue (${demandes.length} faites)`);
        await unInstant(2);
      }
      return demandes[n - 1]!;
    },
  };
}

// ---------------------------------------------------------------------------

test('un adversaire asynchrone est joué exactement comme un synchrone, action par action', async () => {
  const p = preparerPartie('demo');
  const duFil = adversaireDuFil(p);
  // Trois façons de répondre la même chose : tout de suite (la page d'avant),
  // plus tard, et par l'adversaire en fond branché sur un faux worker.
  const plusTard: Adversaire = (etat) => {
    const suite = duFil(structuredClone(etat));
    return new Promise((resoudre) => setTimeout(() => resoudre(suite), 3));
  };
  const fond = creerAdversaireEnFond(p.strategie, p.scenario.catalogueVersion, p.commandants, p.strategiesParCamp, {
    creerWorker: () => new FauxWorker(), surRepli: () => undefined,
  });
  const montages = [monter(p, duFil), monter(p, plusTard), monter(p, fond.adversaire)];
  // Quatre tours du joueur, qui passe : quatre tours d'IA, à chaque fois comparés.
  for (let tour = 0; tour < 4; tour += 1) {
    for (const m of montages) {
      m.finTour();
      await mainAuJoueur(m);
    }
    const [reference, ...autres] = montages;
    for (const m of autres) assert.deepEqual(m.jeu.etat, reference!.jeu.etat, `tour ${tour + 1}`);
  }
  // Et la suite des états vus par la page, pas seulement le dernier.
  const [reference, ...autres] = montages;
  for (const m of autres) assert.deepEqual(m.etats, reference!.etats);
  assert.ok(reference!.etats.length > 20, `${reference!.etats.length} états traversés`);
  assert.equal(fond.mode, 'worker');
  for (const m of montages) m.jeu.demonter();
  fond.fermer();
});

test('une suite arrivée après le démontage n’est jamais jouée', async () => {
  const p = preparerPartie('demo');
  const tenu = adversaireTenu();
  const m = monter(p, tenu.adversaire);
  m.finTour();
  const demande = await tenu.demande();
  const figee = m.jeu.etat;
  const vus = m.etats.length;
  m.jeu.demonter();
  tenu.repondre(adversaireDuFil(p)(structuredClone(demande)));
  await unInstant(20);
  assert.equal(m.jeu.etat, figee, 'rien n’a été appliqué');
  assert.equal(m.etats.length, vus, 'la page n’a rien reçu');
  assert.equal(tenu.demandes.length, 1, 'et rien n’a été redemandé');
});

test('une partie recommencée pendant que l’IA réfléchit, joueur en premier : la suite d’avant tombe', async () => {
  const p = preparerPartie('demo');
  const tenu = adversaireTenu();
  const m = monter(p, tenu.adversaire, true);
  m.finTour();
  const demande = await tenu.demande();
  assert.equal(demande.campCourant, 1, 'l’IA réfléchit à son tour');
  // Le joueur recommence pendant que l'IA réfléchit : le fil principal ne gèle
  // plus, le bouton répond.
  cliquerHud(m.conteneur, 'rejouer');
  assert.deepEqual(m.jeu.etat, partieNeuve(p), 'la partie est neuve');
  // La suite arrive, calculée pour l'ancienne partie.
  tenu.repondre(adversaireDuFil(p)(structuredClone(demande)));
  await unInstant(10);
  await mainAuJoueur(m);
  assert.deepEqual(m.jeu.etat, partieNeuve(p), 'aucune action de l’ancienne partie n’a été jouée');
  assert.equal(tenu.demandes.length, 1, 'c’est au joueur : rien n’est redemandé');
  assert.equal(m.conteneur.dataset['etat'], 'inactif', 'le contrôleur rend la main au joueur');
  // Et la nouvelle partie se joue normalement : son premier tour d'IA est demandé pour elle.
  m.finTour();
  const suivante = await tenu.demande(2);
  assert.equal(suivante.journee, 1);
  assert.equal(suivante.campCourant, 1);
  tenu.repondre(adversaireDuFil(p)(structuredClone(suivante)));
  await mainAuJoueur(m);
  assert.equal(m.jeu.etat.campCourant, 0);
  assert.equal(m.jeu.etat.journee, 2);
  m.jeu.demonter();
});

test('une partie recommencée pendant que l’IA réfléchit, IA en premier : la suite est redemandée pour la nouvelle partie', async () => {
  // Le joueur tient le camp 1 : la partie neuve commence par le tour de l'IA,
  // et la boucle de `tourAdversaire` continue. Sans la comparaison de l'état
  // demandé à l'état courant, la suite calculée pour la journée 2 de
  // l'ancienne partie serait jouée sur la journée 1 de la nouvelle.
  const p = preparerPartie('demo');
  const duFil = adversaireDuFil(p);
  const tenu = adversaireTenu();
  const m = monter(p, tenu.adversaire, true, 1);
  // Premier tour de l'IA, dès le montage.
  const premiere = await tenu.demande(1);
  assert.deepEqual(premiere, partieNeuve(p));
  tenu.repondre(duFil(structuredClone(premiere)));
  await mainAuJoueur(m);
  // Le joueur passe ; l'IA réfléchit à la journée 2 ; le joueur recommence.
  m.finTour();
  const seconde = await tenu.demande(2);
  assert.equal(seconde.journee, 2);
  cliquerHud(m.conteneur, 'rejouer');
  tenu.repondre(duFil(structuredClone(seconde)));
  // La suite de la journée 2 est jetée ; la nouvelle partie est redemandée.
  const troisieme = await tenu.demande(3);
  assert.deepEqual(troisieme, partieNeuve(p), 'la demande porte sur la partie neuve');
  const attendu = duFil(structuredClone(troisieme));
  // Une copie : le chef d'orchestre consomme la suite qu'on lui rend (`shift`).
  tenu.repondre([...attendu]);
  await mainAuJoueur(m);
  // Le résultat : exactement le premier tour de l'IA, joué sur la partie neuve.
  let reference = partieNeuve(p);
  for (const action of attendu) {
    const r = appliquer(reference, action, p.cat, p.commandants);
    assert.ok(r.ok);
    reference = r.etat;
  }
  assert.deepEqual(m.jeu.etat, reference);
  assert.equal(tenu.demandes.length, 3);
  m.jeu.demonter();
});

test('l’adversaire passif, synchrone, passe toujours son tour', async () => {
  const p = preparerPartie('demo');
  // Sans adversaire, le rendu reste jouable : l'IA « passe » sans promesse.
  const { rendu, gestes } = peauMuette();
  const conteneur = conteneurFactice();
  const jeu = monterJeu(conteneur as unknown as HTMLElement, {
    scenario: p.scenario, carte: p.carte, catalogue: p.cat, commandants: p.commandants, graine: p.graine,
    fabriqueRendu: () => rendu, hud: false, dialogues: false, debug: false, vitesseAnimations: 'instantanee',
  });
  gestes().surTouche?.('fin_tour');
  await mainAuJoueur({ jeu, conteneur, etats: [], camp: 0, finTour: () => undefined });
  assert.equal(jeu.etat.campCourant, 0);
  assert.equal(jeu.etat.journee, 2);
  jeu.demonter();
});
