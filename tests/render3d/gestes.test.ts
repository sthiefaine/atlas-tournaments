import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  creerVue3d, distanceLisible, PAS_TANGAGE, PIXELS_DOUBLE_TAP, TANGAGE_MIN,
} from '../../src/render3d/camera';
import { brancherGestes3d } from '../../src/render3d/gestes';

function montage(pointerType = 'touch') {
  const cible = new EventTarget();
  const canvas = Object.assign(cible, {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    focus: () => undefined,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  }) as unknown as HTMLCanvasElement;
  const vue = creerVue3d({ largeur: 24, hauteur: 24 });
  vue.redimensionner(390, 844);
  vue.cadrerCarte();
  let clics = 0;
  const demonter = brancherGestes3d(canvas, () => vue, () => null,
    { surClicCase: () => { clics++; } }, () => undefined);
  const pointer = (type: string, id: number, x: number, y: number, temps?: number, altKey = false) => {
    const e = Object.assign(new Event(type), {
      pointerId: id, clientX: x, clientY: y, pointerType, button: 0, altKey,
    });
    // `timeStamp` est en lecture seule sur `Event` : une propriété propre le masque.
    if (temps !== undefined) Object.defineProperty(e, 'timeStamp', { value: temps });
    cible.dispatchEvent(e);
  };
  const molette = (deltaY: number, shiftKey = false): void => {
    cible.dispatchEvent(Object.assign(new Event('wheel'), {
      deltaY, shiftKey, preventDefault: () => undefined,
    }));
  };
  const touche = (code: string): void => {
    cible.dispatchEvent(Object.assign(new Event('keydown'), {
      code, preventDefault: () => undefined,
    }));
  };
  return { vue, pointer, molette, touche, clics: () => clics, demonter };
}

test('un tap sélectionne, un glisser un doigt déplace la grille sans clic à son retour', () => {
  const m = montage();
  m.pointer('pointerdown', 1, 195, 422);
  m.pointer('pointerup', 1, 195, 422);
  assert.equal(m.clics(), 1);
  const x = m.vue.etat.cible.x;
  m.pointer('pointerdown', 1, 195, 422);
  m.pointer('pointermove', 1, 295, 422);
  assert.ok(m.vue.etat.cible.x < x);
  m.pointer('pointermove', 1, 195, 422);
  m.pointer('pointerup', 1, 195, 422);
  assert.equal(m.clics(), 1, 'revenir au point de départ ne transforme pas le glisser en tap');
  m.demonter();
});

test('un pincement ne sélectionne jamais la case sous le doigt resté immobile', () => {
  const m = montage();
  const distance = m.vue.etat.distance;
  m.pointer('pointerdown', 1, 120, 422);
  m.pointer('pointerdown', 2, 240, 422);
  m.pointer('pointermove', 2, 310, 422);
  assert.ok(m.vue.etat.distance < distance);
  m.pointer('pointerup', 2, 310, 422);
  m.pointer('pointerup', 1, 120, 422);
  assert.equal(m.clics(), 0);
  m.pointer('pointerdown', 1, 195, 422);
  m.pointer('pointerup', 1, 195, 422);
  assert.equal(m.clics(), 1, 'le tap suivant reste utilisable');
  m.demonter();
});

test('deux doigts glissés de haut en bas inclinent la caméra sans la déplacer', () => {
  const m = montage();
  const tangage = m.vue.etat.tangage;
  const z = m.vue.etat.cible.z;
  const distance = m.vue.etat.distance;
  m.pointer('pointerdown', 1, 120, 500);
  m.pointer('pointerdown', 2, 240, 500);
  // Deux doigts qui montent **ensemble**, par petits pas alternés : c'est ce
  // qu'un navigateur envoie, un événement par doigt. Chaque pas déforme
  // brièvement l'écart — un doigt bouge avant l'autre —, et c'est pourquoi on
  // mesure ici la dérive résiduelle au lieu de prétendre qu'elle est nulle.
  const monter = (de: number, pas: number): void => {
    for (let i = 1; i <= Math.abs(de) / pas; i += 1) {
      const y = 500 + Math.sign(de) * i * pas;
      m.pointer('pointermove', 1, 120, y);
      m.pointer('pointermove', 2, 240, y);
    }
  };
  monter(-100, 5);
  assert.ok(m.vue.etat.tangage < tangage - 10, 'monter les doigts penche la vue, et franchement');
  assert.ok(Math.abs(m.vue.etat.distance - distance) < distance * 0.01, 'écart constant : pas de zoom');
  assert.ok(Math.abs(m.vue.etat.cible.z - z) < 0.1, 'le vertical va à l’inclinaison, pas au glissement');
  // Et dans l'autre sens on se redresse.
  const penche = m.vue.etat.tangage;
  m.pointer('pointermove', 1, 120, 460);
  m.pointer('pointermove', 2, 240, 460);
  assert.ok(m.vue.etat.tangage > penche, 'descendre les doigts redresse');
  m.pointer('pointerup', 1, 120, 460);
  m.pointer('pointerup', 2, 240, 460);
  assert.equal(m.clics(), 0);
  m.demonter();
});

test('deux doigts qui s’écartent zooment toujours, et le glisser horizontal déplace', () => {
  const m = montage();
  const tangage = m.vue.etat.tangage;
  const x = m.vue.etat.cible.x;
  const distance = m.vue.etat.distance;
  m.pointer('pointerdown', 1, 120, 500);
  m.pointer('pointerdown', 2, 240, 500);
  m.pointer('pointermove', 2, 320, 500);
  assert.ok(m.vue.etat.distance < distance, 'l’écart grandit : on se rapproche');
  assert.equal(m.vue.etat.tangage, tangage, 'un pincement horizontal n’incline pas');
  assert.ok(m.vue.etat.cible.x !== x, 'le milieu des doigts a glissé, la carte suit');
  m.demonter();
});

test('la molette zoome, et Maj + molette incline', () => {
  const m = montage('mouse');
  const distance = m.vue.etat.distance;
  const tangage = m.vue.etat.tangage;
  m.molette(-100);
  assert.ok(m.vue.etat.distance <= distance, 'la molette vers le haut rapproche');
  assert.equal(m.vue.etat.tangage, tangage, 'sans Maj, la molette n’incline pas');
  m.molette(100, true);
  assert.equal(m.vue.etat.tangage, tangage - PAS_TANGAGE, 'Maj + molette vers le bas penche');
  m.molette(-100, true);
  assert.equal(m.vue.etat.tangage, tangage, 'et vers le haut redresse');
  m.demonter();
});

test('R redresse la caméra, F la penche, et ni l’une ni l’autre ne joue', () => {
  const m = montage('mouse');
  const tangage = m.vue.etat.tangage;
  m.touche('KeyF');
  assert.equal(m.vue.etat.tangage, tangage - PAS_TANGAGE);
  m.touche('KeyR');
  assert.equal(m.vue.etat.tangage, tangage);
  // Jusqu'à la borne, et pas au-delà.
  for (let i = 0; i < 20; i += 1) m.touche('KeyF');
  assert.equal(m.vue.etat.tangage, TANGAGE_MIN);
  assert.equal(m.clics(), 0, 'une touche de caméra ne remonte pas au contrôleur');
  m.demonter();
});

test('une interruption tactile et un contact à deux doigts sans déplacement ne jouent pas', () => {
  const m = montage();
  m.pointer('pointerdown', 1, 195, 422);
  m.pointer('pointercancel', 1, 195, 422);
  m.pointer('pointerdown', 1, 120, 422);
  m.pointer('pointerdown', 2, 240, 422);
  m.pointer('pointerup', 1, 120, 422);
  m.pointer('pointerup', 2, 240, 422);
  assert.equal(m.clics(), 0);
  m.demonter();
  m.pointer('pointerdown', 1, 195, 422);
  m.pointer('pointerup', 1, 195, 422);
  assert.equal(m.clics(), 0, 'les écouteurs sont retirés au démontage');
});


test('le glisser souris gauche franchit le seuil puis déplace la carte sans sélectionner', () => {
  const m = montage('mouse');
  const x = m.vue.etat.cible.x;
  m.pointer('pointerdown', 1, 195, 422);
  m.pointer('pointermove', 1, 198, 422);
  assert.equal(m.vue.etat.cible.x, x, 'un léger tremblement laisse le clic disponible');
  m.pointer('pointermove', 1, 245, 422);
  assert.ok(m.vue.etat.cible.x < x, 'le bouton gauche déplace bien la caméra');
  m.pointer('pointerup', 1, 245, 422);
  assert.equal(m.clics(), 0, 'aucune case sélectionnée au relâchement');
  m.pointer('pointerdown', 1, 195, 422);
  m.pointer('pointermove', 1, 198, 422);
  m.pointer('pointerup', 1, 198, 422);
  assert.equal(m.clics(), 1, 'un clic avec tremblement reste un clic');
  m.demonter();
});

test('le seuil de glisser ne vole pas les taps du doigt, et reste serré à la souris', () => {
  const doigt = montage('touch');
  doigt.pointer('pointerdown', 1, 195, 422);
  doigt.pointer('pointermove', 1, 200, 428);
  doigt.pointer('pointerup', 1, 200, 428);
  assert.equal(doigt.clics(), 1, 'la pulpe qui roule de huit pixels fait encore un tap');
  const x = doigt.vue.etat.cible.x;
  doigt.pointer('pointerdown', 1, 195, 422);
  doigt.pointer('pointermove', 1, 209, 422);
  doigt.pointer('pointerup', 1, 209, 422);
  assert.equal(doigt.clics(), 1, 'quatorze pixels, c’est un glisser');
  assert.ok(doigt.vue.etat.cible.x < x);
  doigt.demonter();
  const souris = montage('mouse');
  souris.pointer('pointerdown', 1, 195, 422);
  souris.pointer('pointermove', 1, 203, 422);
  souris.pointer('pointerup', 1, 203, 422);
  assert.equal(souris.clics(), 0, 'huit pixels à la souris, c’est un glisser');
  souris.demonter();
});

test('un glisser lâché en mouvement continue sur sa lancée, puis s’éteint ; le doigt suivant l’arrête sans jouer', () => {
  const m = montage();
  m.pointer('pointerdown', 1, 195, 700, 0);
  for (let i = 1; i <= 6; i += 1) m.pointer('pointermove', 1, 195, 700 - i * 40, i * 16);
  const auLacher = m.vue.etat.cible.z;
  m.pointer('pointerup', 1, 195, 460, 100);
  assert.ok(m.vue.avancer(16), 'la carte glisse encore après le relâchement');
  assert.ok(m.vue.etat.cible.z > auLacher, 'dans le sens du geste');
  let images = 1;
  while (m.vue.avancer(16) && images < 200) images += 1;
  assert.ok(images < 120, 'l’inertie s’éteint en moins de deux secondes');
  assert.equal(m.clics(), 0);

  // Relancé depuis le milieu — le premier lancer a mené la vue au bord, où
  // l'inertie bute —, puis un doigt se pose : la carte s'arrête et ce tap ne joue pas.
  m.vue.centrerCase({ x: 12, y: 12 });
  m.pointer('pointerdown', 1, 195, 700, 1000);
  for (let i = 1; i <= 6; i += 1) m.pointer('pointermove', 1, 195, 700 - i * 40, 1000 + i * 16);
  m.pointer('pointerup', 1, 195, 460, 1100);
  assert.ok(m.vue.avancer(16));
  const arret = { ...m.vue.etat.cible };
  m.pointer('pointerdown', 1, 195, 422, 1200);
  m.pointer('pointerup', 1, 195, 422, 1210);
  assert.equal(m.vue.avancer(16), false, 'le doigt a arrêté la glissade');
  assert.deepEqual(m.vue.etat.cible, arret);
  assert.equal(m.clics(), 0, 'arrêter la carte n’est pas un tap');
  m.pointer('pointerdown', 1, 195, 422, 1400);
  m.pointer('pointerup', 1, 195, 422, 1410);
  assert.equal(m.clics(), 1, 'le tap suivant joue');

  // Un doigt qui s'immobilise avant de lâcher ne lance rien.
  m.pointer('pointerdown', 1, 195, 700, 2000);
  m.pointer('pointermove', 1, 195, 500, 2016);
  m.pointer('pointerup', 1, 195, 500, 2400);
  assert.equal(m.vue.avancer(16), false, 'pas d’inertie après un arrêt');
  m.demonter();
});

test('un double-tap au doigt recentre la case tapée à un zoom lisible, après les deux taps', () => {
  const m = montage();
  const avant = m.vue.caseSous(60, 200, null);
  assert.ok(avant);
  m.pointer('pointerdown', 1, 60, 200, 1000);
  m.pointer('pointerup', 1, 60, 200, 1010);
  m.pointer('pointerdown', 1, 60, 200, 1200);
  m.pointer('pointerup', 1, 60, 200, 1210);
  assert.equal(m.clics(), 2, 'les deux taps vont au jeu');
  assert.ok(m.vue.avancer(16), 'le recentrage se joue en transition');
  m.vue.avancer(1000);
  assert.deepEqual(m.vue.caseSous(195, 422, null), avant, 'la case tapée est au centre');
  assert.ok(m.vue.etat.distance <= distanceLisible(844, PIXELS_DOUBLE_TAP) + 1e-9);
  m.demonter();
});

// ---------------------------------------------------------------------------
// L'inspection : double-clic à la souris, appui long au doigt
// ---------------------------------------------------------------------------

function montageInspection(pointerType: string, inspecte: () => boolean) {
  const cible = new EventTarget();
  const canvas = Object.assign(cible, {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    focus: () => undefined,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  }) as unknown as HTMLCanvasElement;
  const vue = creerVue3d({ largeur: 24, hauteur: 24 });
  vue.redimensionner(390, 844);
  vue.cadrerCarte();
  const journal: string[] = [];
  const demonter = brancherGestes3d(canvas, () => vue, () => null, {
    surClicCase: () => { journal.push('clic'); },
    surAnnuler: () => { journal.push('annuler'); },
    surInspecter: () => { journal.push('inspecter'); return inspecte(); },
  }, () => undefined);
  const pointer = (type: string, id: number, x: number, y: number, temps?: number, altKey = false) => {
    const e = Object.assign(new Event(type), {
      pointerId: id, clientX: x, clientY: y, pointerType, button: 0, altKey,
    });
    // `timeStamp` est en lecture seule sur `Event` : une propriété propre le masque.
    if (temps !== undefined) Object.defineProperty(e, 'timeStamp', { value: temps });
    cible.dispatchEvent(e);
  };
  return { pointer, journal, demonter };
}

test('deux clics souris sur la même case en moins de 350 ms demandent l’inspection, après les clics', () => {
  const m = montageInspection('mouse', () => true);
  m.pointer('pointerdown', 1, 195, 422, 1000);
  m.pointer('pointerup', 1, 195, 422, 1010);
  m.pointer('pointerdown', 1, 195, 422, 1200);
  m.pointer('pointerup', 1, 195, 422, 1210);
  assert.deepEqual(m.journal, ['clic', 'clic', 'inspecter']);
  // Trop tard : deux clics ordinaires.
  m.pointer('pointerdown', 1, 195, 422, 2000);
  m.pointer('pointerup', 1, 195, 422, 2010);
  m.pointer('pointerdown', 1, 195, 422, 2500);
  m.pointer('pointerup', 1, 195, 422, 2510);
  assert.deepEqual(m.journal, ['clic', 'clic', 'inspecter', 'clic', 'clic']);
  // Une autre case : deux clics ordinaires aussi.
  m.pointer('pointerdown', 1, 195, 422, 3000);
  m.pointer('pointerup', 1, 195, 422, 3010);
  m.pointer('pointerdown', 1, 60, 200, 3100);
  m.pointer('pointerup', 1, 60, 200, 3110);
  assert.deepEqual(m.journal, ['clic', 'clic', 'inspecter', 'clic', 'clic', 'clic', 'clic']);
  m.demonter();
});

test('un appui long au doigt inspecte sans annuler, annule s’il n’y a rien à inspecter, et n’est pas un tap', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let inspecte = true;
    const m = montageInspection('touch', () => inspecte);
    m.pointer('pointerdown', 1, 195, 422);
    mock.timers.tick(600);
    m.pointer('pointerup', 1, 195, 422);
    assert.deepEqual(m.journal, ['inspecter'], 'ni clic ni annulation en plus');

    inspecte = false;
    m.pointer('pointerdown', 1, 195, 422);
    mock.timers.tick(600);
    m.pointer('pointerup', 1, 195, 422);
    assert.deepEqual(m.journal, ['inspecter', 'inspecter', 'annuler']);

    // Un doigt qui bouge avant le délai glisse la caméra, il n'appuie pas longuement.
    m.pointer('pointerdown', 1, 195, 422);
    m.pointer('pointermove', 1, 260, 422);
    mock.timers.tick(600);
    m.pointer('pointerup', 1, 260, 422);
    assert.deepEqual(m.journal, ['inspecter', 'inspecter', 'annuler']);

    // Un tap bref reste un tap.
    m.pointer('pointerdown', 1, 195, 422);
    m.pointer('pointerup', 1, 195, 422);
    mock.timers.tick(600);
    assert.deepEqual(m.journal, ['inspecter', 'inspecter', 'annuler', 'clic']);
    m.demonter();
  } finally {
    mock.timers.reset();
  }
});

// ---------------------------------------------------------------------------
// Le survol est coalescé sur l'image
// ---------------------------------------------------------------------------

test('cent positions de souris ne lancent qu’un rayon, à l’image suivante, sur la dernière position', () => {
  const cible = new EventTarget();
  const canvas = Object.assign(cible, {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    focus: () => undefined,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  }) as unknown as HTMLCanvasElement;
  const vue = creerVue3d({ largeur: 24, hauteur: 24 });
  vue.redimensionner(390, 844);
  vue.cadrerCarte();
  const survols: { x: number; y: number }[] = [];
  const planifiees: (() => void)[] = [];
  let annulees = 0;
  const demonter = brancherGestes3d(canvas, () => vue, () => null,
    { surSurvolCase: (c) => { if (c) survols.push(c); } }, () => undefined, {
      planifierImage: (f) => { planifiees.push(f); return planifiees.length; },
      annulerImage: () => { annulees += 1; },
    });
  const bouger = (x: number, y: number): void => {
    cible.dispatchEvent(Object.assign(new Event('pointermove'), {
      pointerId: 1, clientX: x, clientY: y, pointerType: 'mouse', button: 0,
    }));
  };
  for (let i = 0; i < 100; i += 1) bouger(60 + i, 200 + i);
  assert.equal(survols.length, 0, 'rien avant l’image');
  assert.equal(planifiees.length, 1, 'une seule image demandée');
  planifiees[0]!();
  assert.equal(survols.length, 1);
  assert.deepEqual(survols[0], vue.caseSous(159, 299, null), 'la dernière position, pas la première');
  // La suivante repart de zéro, et un démontage avec une image en attente l'annule.
  bouger(195, 422);
  assert.equal(planifiees.length, 2);
  demonter();
  assert.equal(annulees, 1);
  planifiees[1]!();
  assert.equal(survols.length, 1, 'une image annulée ne survole plus rien');
});


test('Alt-glisser orbite librement sans déplacement de cible ni clic ni inertie', () => {
  const m = montage('mouse');
  const depart = { ...m.vue.etat.cible };
  const lacet = m.vue.etat.lacet;
  const tangage = m.vue.etat.tangage;
  m.pointer('pointerdown', 1, 100, 200, 0, true);
  m.pointer('pointermove', 1, 130, 180, 30, true);
  m.pointer('pointerup', 1, 130, 180, 40, true);
  assert.notEqual(m.vue.etat.lacet, lacet);
  assert.notEqual(m.vue.etat.tangage, tangage);
  assert.deepEqual(m.vue.etat.cible, depart);
  assert.equal(m.clics(), 0);
  const apres = { ...m.vue.etat.cible };
  m.vue.avancer(100);
  assert.deepEqual(m.vue.etat.cible, apres);
  m.demonter();
});

test('la torsion de deux doigts change le bearing sans sélectionner une case', () => {
  const m = montage();
  const lacet = m.vue.etat.lacet;
  m.pointer('pointerdown', 1, 120, 400);
  m.pointer('pointerdown', 2, 240, 400);
  m.pointer('pointermove', 2, 220, 460);
  assert.notEqual(m.vue.etat.lacet, lacet);
  m.pointer('pointerup', 2, 220, 460);
  m.pointer('pointerup', 1, 120, 400);
  assert.equal(m.clics(), 0);
  m.demonter();
});
