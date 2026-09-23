// Les vingt-trois gestes de la carte en 2D, sur une horloge de papier : pour
// chacun, la pose au départ, au milieu et à la fin ; puis ce que chacun a de
// propre — l'élan et le dépassement de la marche, le recul et le projectile du
// tir, l'arrêt sur image et la secousse du coup, l'explosion de la sortie, les
// armes de la faction, la vague d'un pouvoir —, la composition de deux gestes
// sur une même unité, la coupure, et les animations réduites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { EtatPartie } from '../../src/engine/index';
import type { Son } from '../../src/audio/types';
import { Boucle, type Horloge } from '../../src/render/boucle';
import { DUREES, type Geste, type Partition } from '../../src/render/partition';
import {
  animationsDePartition, ARRET_IMAGE_MS, courbePassage, EXECUTANTS, MARCHE, mouvementGlisse, pointSurChemin,
  profilTir, type ContexteAnimation2d,
} from '../../src/render2d/animations';
import type { PoseDrapeau } from '../../src/render2d/batiments';
import { ID_EFFET, IDS_MISSILE, PoolEffets, SECOUSSE_MAX_PX, type Rvb } from '../../src/render2d/effets';
import type { Pose } from '../../src/render2d/lot';
import { Visuels, type EtatVisuel2d } from '../../src/render2d/unites';
import { CAT, partiePersonnalisee } from '../engine/aides';

// ---------------------------------------------------------------------------
// Le banc : une scène de papier, une boucle à horloge manuelle
// ---------------------------------------------------------------------------

interface Banc {
  ctx: ContexteAnimation2d;
  visuels: Visuels;
  effets: PoolEffets;
  sons: Son[];
  secousses: { amplitude: number; duree: number; retard: number }[];
  eclats: { couleur: Rvb; alpha: number }[];
  vagues: { x: number; y: number; rayon: number; retard: number }[];
  forces: Map<string, PoseDrapeau>;
  boucle: Boucle;
  jouer(p: Partition): Promise<void>;
  /** Fait passer `ms` millisecondes, image par image de 16 ms. */
  attendre(ms: number): void;
  /** Les poses d'effets vivantes. */
  posesEffets(): Pose[];
}

function banc(avant: EtatPartie, apres: EtatPartie, o: { visible?: boolean; reduit?: boolean } = {}): Banc {
  let t = 0;
  let rappel: ((t: number) => void) | null = null;
  const horloge: Horloge = {
    planifier: (r) => { rappel = r; return 1; },
    annuler: () => { rappel = null; },
    maintenant: () => t,
  };
  const visuels = new Visuels();
  const effets = new PoolEffets();
  const b: Omit<Banc, 'ctx' | 'boucle' | 'jouer' | 'attendre' | 'posesEffets'> = {
    visuels, effets, sons: [], secousses: [], eclats: [], vagues: [], forces: new Map(),
  };
  const ctx: ContexteAnimation2d = {
    visuels,
    etats: () => ({ courant: apres, precedent: avant }),
    catalogue: () => CAT,
    cadrer: () => undefined,
    drapeau: (cle) => ({
      poseDans: (e) => ({ camp: e.proprietaires[cle] ?? null, niveau: e.proprietaires[cle] === undefined ? 0 : 1 }),
      forcer: (p) => { b.forces.set(cle, p); },
      relacher: () => { b.forces.delete(cle); },
    }),
    audio: { jouer: (s) => { b.sons.push(s); } },
    visible: () => o.visible ?? true,
    temps: () => t,
    salir: () => undefined,
    effets,
    secouer: (amplitude, duree, retard = 0) => { b.secousses.push({ amplitude, duree, retard }); },
    superposition: {
      eclater: (couleur, alpha) => { b.eclats.push({ couleur, alpha }); },
      vague: (x, y, _c, rayon, _d, retard = 0) => { b.vagues.push({ x, y, rayon, retard }); },
    },
    equipe: (camp) => (camp === 0 ? [0.2, 0.4, 1] : [1, 0.3, 0.2]),
    reduit: () => o.reduit === true,
  };
  // Comme la peau : la boucle avance les gestes, la peau pose les effets de
  // l'image, **puis** le pool vieillit de l'image. On lit ce qui a été posé.
  const dessinees: Pose[] = [];
  const boucle = new Boucle((ecoule) => {
    dessinees.length = 0;
    effets.poses(dessinees);
    effets.avancer(ecoule);
  }, horloge);
  return {
    ...b, ctx, boucle,
    jouer: (p) => {
      const { animations, attentes } = animationsDePartition(p, ctx);
      for (const a of animations) boucle.ajouter(a);
      return Promise.all(attentes).then(() => undefined);
    },
    attendre: (ms) => {
      for (let fait = 0; fait < ms; fait += 16) {
        t += 16;
        const r = rappel;
        rappel = null;
        r?.(t);
      }
    },
    posesEffets: () => [...dessinees],
  };
}

/** La scène commune : deux camps, un bâtiment, un transport. */
function scene(): { avant: EtatPartie; apres: EtatPartie; a: string; b: string; c: string; d: string } {
  const avant = partiePersonnalisee(['PPCPPP', 'PPPPPP', 'PPPPPP', 'PPPPPP'], { '2,0': 1 }, [
    { camp: 0, type: 'char_leger', x: 1, y: 1 },
    { camp: 1, type: 'infanterie', x: 3, y: 1, pv: 80 },
    { camp: 0, type: 'transport', x: 1, y: 2 },
    { camp: 1, type: 'recon', x: 4, y: 2 },
  ]);
  const apres = structuredClone(avant);
  const [a, b, c, d] = avant.unites.map((u) => u.id) as [string, string, string, string];
  return { avant, apres, a, b, c, d };
}

const NEUTRE = {
  dx: 0, dy: 0, dh: 0, orientation: null, clip: 'repos', clipTemps: null, opacite: 1, eclat: 0, echelle: 1,
  pv: null, voile: null, teinte: null,
};

/** L'état visuel, réduit à ce qui se voit ; neutre s'il n'existe pas. */
function vu(v: EtatVisuel2d | undefined): Record<string, unknown> {
  if (!v) return { ...NEUTRE };
  return {
    dx: v.dx, dy: v.dy, dh: v.dh, orientation: v.orientation, clip: v.clip, clipTemps: v.clipTemps, opacite: v.opacite,
    eclat: v.eclat, echelle: v.echelle, pv: v.pv, voile: v.voile, teinte: v.teinte,
  };
}

function estNeutre(v: EtatVisuel2d | undefined): boolean {
  return JSON.stringify(vu(v)) === JSON.stringify(NEUTRE);
}

// ---------------------------------------------------------------------------
// Chaque genre : le départ, le milieu, la fin
// ---------------------------------------------------------------------------

type Preparation = (s: ReturnType<typeof scene>) => Geste;

const GESTES: Record<string, Preparation> = {
  glisser: (s) => ({ genre: 'glisser', unite: s.a, chemin: [{ x: 0, y: 1 }, { x: 1, y: 1 }], debut: 0, duree: 240 }),
  tirer: (s) => ({ genre: 'tirer', unite: s.a, depuis: { x: 1, y: 1 }, vers: { x: 3, y: 1 }, debut: 0, duree: DUREES.tir }),
  encaisser: (s) => ({ genre: 'encaisser', unite: s.b, case: { x: 3, y: 1 }, degats: 40, depuis: { x: 1, y: 1 }, debut: 0, duree: DUREES.encaisser }),
  sortir: (s) => {
    s.apres.unites = s.apres.unites.filter((u) => u.id !== s.b);
    return { genre: 'sortir', unite: s.b, case: { x: 3, y: 1 }, debut: 0, duree: DUREES.sortir };
  },
  hisser: (s) => {
    s.apres.proprietaires['2,0'] = 0;
    return { genre: 'hisser', unite: s.a, case: { x: 2, y: 0 }, camp: 0, points: 20, acquis: true, debut: 0, duree: DUREES.hisser };
  },
  remettre: (s) => ({ genre: 'remettre', unite: s.a, case: { x: 2, y: 0 }, camp: 0, debut: 0, duree: DUREES.remettre }),
  batir: () => ({ genre: 'batir', case: { x: 4, y: 0 }, terrain: 'route', debut: 0, duree: DUREES.batir }),
  apparaitre: (s) => {
    s.apres.unites.push({ ...s.apres.unites[1]!, id: 'recrue', camp: 0, type: 'infanterie', x: 0, y: 3 });
    return { genre: 'apparaitre', unite: 'infanterie', case: { x: 0, y: 3 }, camp: 0, debut: 0, duree: DUREES.apparaitre };
  },
  embarquer: (s) => {
    s.apres.unites.find((u) => u.id === s.a)!.dansTransport = s.c;
    return { genre: 'embarquer', unite: s.a, transport: s.c, de: { x: 1, y: 1 }, vers: { x: 1, y: 2 }, debut: 0, duree: DUREES.embarquer };
  },
  debarquer: (s) => ({ genre: 'debarquer', unite: s.a, transport: s.c, de: { x: 1, y: 2 }, vers: { x: 1, y: 1 }, debut: 0, duree: DUREES.embarquer }),
  fusionner: (s) => {
    s.apres.unites = s.apres.unites.filter((u) => u.id !== s.a);
    return { genre: 'fusionner', unite: s.a, avec: s.c, de: { x: 1, y: 1 }, vers: { x: 1, y: 2 }, debut: 0, duree: DUREES.fusionner };
  },
  ravitailler: (s) => ({ genre: 'ravitailler', unite: s.c, cible: s.a, case: { x: 1, y: 1 }, debut: 0, duree: DUREES.ravitailler }),
  reparer: (s) => ({ genre: 'reparer', unite: s.a, case: { x: 1, y: 1 }, pv: 20, debut: 0, duree: DUREES.reparer }),
  repousser: (s) => ({ genre: 'repousser', unite: s.b, de: { x: 2, y: 1 }, vers: { x: 3, y: 1 }, debut: 0, duree: DUREES.repousser }),
  pouvoir: () => ({ genre: 'pouvoir', camp: 0, niveau: 'super', nom: 'commandant.essai.super', debut: 0, duree: DUREES.pouvoir }),
  cadrer: () => ({ genre: 'cadrer', case: { x: 5, y: 3 }, debut: 0, duree: 0 }),
  voiler: (s) => ({ genre: 'voiler', unite: s.a, case: { x: 1, y: 1 }, debut: 0, duree: DUREES.voiler }),
  devoiler: (s) => ({ genre: 'devoiler', unite: s.a, case: { x: 1, y: 1 }, debut: 0, duree: DUREES.voiler }),
  surprise: (s) => ({ genre: 'surprise', unite: s.a, case: { x: 1, y: 1 }, debut: 0, duree: DUREES.surprise }),
  reveiller: (s) => ({ genre: 'reveiller', unite: s.a, case: { x: 1, y: 1 }, camp: 0, debut: 0, duree: DUREES.reveiller }),
  frapper: () => ({ genre: 'frapper', camp: 1, centre: { x: 2, y: 1 }, rayon: 1, debut: 0, duree: DUREES.frapper }),
  designer: (s) => ({ genre: 'designer', unite: s.a, case: { x: 1, y: 1 }, camp: 1, debut: 0, duree: DUREES.designer }),
  sceller: () => ({ genre: 'sceller', camp: 1, centre: { x: 1, y: 1 }, rayon: 1, debut: 0, duree: DUREES.sceller }),
};

test('les vingt-trois gestes de la carte ont un exécutant, et le banc les essaie tous', () => {
  const genres = Object.keys(EXECUTANTS).sort();
  assert.equal(genres.length, 23);
  assert.deepEqual(Object.keys(GESTES).sort(), genres);
});

for (const [genre, preparer] of Object.entries(GESTES)) {
  test(`${genre} : il se passe quelque chose au milieu, et tout revient au repos exact à la fin`, async () => {
    const s = scene();
    const g = preparer(s);
    const bc = banc(s.avant, s.apres);
    let fini = false;
    const fin = bc.jouer({ gestes: [g], duree: g.debut + g.duree });
    void fin.then(() => { fini = true; });
    const ids = [s.a, s.b, s.c, s.d, 'recrue'];
    bc.attendre(16);
    // Au départ, un geste peut déjà poser son premier état : on vérifie seulement qu'il n'a rien cassé.
    for (const id of ids) {
      const v = bc.visuels.lire(id);
      if (v) assert.ok(Number.isFinite(v.dx) && Number.isFinite(v.dy) && Number.isFinite(v.dh), `${genre} ${id} au départ`);
    }
    if (g.duree > 0) {
      bc.attendre(Math.floor(g.duree / 2) - 16);
      const bouge = ids.some((id) => !estNeutre(bc.visuels.lire(id)));
      const effets = bc.effets.vivants > 0 || bc.secousses.length > 0 || bc.eclats.length > 0 || bc.vagues.length > 0 || bc.forces.size > 0;
      assert.ok(bouge || effets, `${genre} : rien ne se passe au milieu`);
    }
    bc.attendre(g.duree + 200);
    await fin;
    assert.equal(fini, true);
    for (const id of ids) assert.deepEqual(vu(bc.visuels.lire(id)), NEUTRE, `${genre} : ${id} au repos exact`);
    assert.equal(bc.forces.size, 0, `${genre} : les drapeaux rendus à l'état`);
    for (const id of ids) assert.equal(bc.visuels.estRetenue(id), false, `${genre} : ${id} relâchée`);
  });
}

// ---------------------------------------------------------------------------
// La marche
// ---------------------------------------------------------------------------

test('la marche prend son élan, file, dépasse d’un souffle et se pose exactement — sans à-coup', () => {
  for (const [duree, longueur] of [[120, 1], [360, 3], [720, 6], [60, 1], [1200, 10]] as const) {
    assert.equal(mouvementGlisse(0, duree, longueur).s, 0, 'part de sa case');
    assert.equal(mouvementGlisse(duree, duree, longueur).s, longueur, 'arrive sur sa case');
    let min = 0;
    let max = 0;
    let avant = 0;
    let pire = 0;
    for (let ms = 0; ms <= duree; ms += 0.5) {
      const { s } = mouvementGlisse(ms, duree, longueur);
      min = Math.min(min, s);
      max = Math.max(max, s);
      pire = Math.max(pire, Math.abs(s - avant));
      avant = s;
    }
    assert.ok(min < -0.01 && min >= -MARCHE.elan - 1e-9, `élan ${duree}/${longueur} : ${min}`);
    assert.ok(max > longueur + 0.005 && max <= longueur + MARCHE.depassement + 1e-9, `dépassement ${duree}/${longueur} : ${max}`);
    // Continue : en une demi-milliseconde, jamais plus qu'une vitesse de marche raisonnable.
    assert.ok(pire < (longueur / duree) * 0.5 * 4, `saut de ${pire} à ${duree}/${longueur}`);
  }
  assert.deepEqual(mouvementGlisse(50, 0, 3), { s: 3, elan: 0, tassement: 0 }, 'sans durée, déjà arrivée');
});

test('le chemin se prolonge avant et après : c’est là que tombent l’élan et le dépassement', () => {
  const chemin = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }];
  assert.deepEqual(pointSurChemin(chemin, -0.5), { x: -0.5, y: 0, ux: 1, uy: 0 });
  assert.deepEqual(pointSurChemin(chemin, 1), { x: 1, y: 0, ux: 1, uy: 0 });
  assert.deepEqual(pointSurChemin(chemin, 3), { x: 2, y: 1, ux: 0, uy: 1 });
  assert.deepEqual(pointSurChemin(chemin, 4.25), { x: 2, y: 2.25, ux: 0, uy: 1 });
});

test('la marche suit son chemin segment par segment, et sa foulée suit la distance', async () => {
  const s = scene();
  s.apres.unites.find((u) => u.id === s.a)!.x = 2;
  s.apres.unites.find((u) => u.id === s.a)!.y = 3;
  const bc = banc(s.avant, s.apres);
  const chemin = [{ x: 0, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 3 }];
  const fin = bc.jouer({ gestes: [{ genre: 'glisser', unite: s.a, chemin, debut: 0, duree: 480 }], duree: 480 });
  const v = bc.visuels.visuel(s.a);
  const vues: string[] = [];
  const foulees: { s: number; temps: number }[] = [];
  for (let i = 0; i < 29; i++) {
    bc.attendre(16);
    if (v.orientation && vues[vues.length - 1] !== v.orientation) vues.push(v.orientation);
    const parcouru = mouvementGlisse((i + 1) * 16, 480, 4).s;
    if (v.clipTemps !== null && parcouru > 0) foulees.push({ s: parcouru, temps: v.clipTemps });
  }
  assert.deepEqual(vues, ['droite', 'bas'], 'un cap par segment');
  for (const f of foulees) assert.ok(Math.abs(f.temps - f.s * MARCHE.msClipParCase) < 1e-6, 'la foulée suit la distance');
  assert.ok(bc.effets.vivants > 0, 'un char soulève de la poussière');
  bc.attendre(200);
  await fin;
  assert.ok(estNeutre(v));
});

// ---------------------------------------------------------------------------
// Le tir
// ---------------------------------------------------------------------------

test('le profil d’un tir se lit sur les données de l’unité, jamais sur son nom', () => {
  const u = CAT.unites;
  assert.equal(profilTir(u.char_leger, u.infanterie), 'rafale', 'l’arme secondaire contre ses cibles');
  assert.equal(profilTir(u.char_leger, u.char_lourd), 'marqueur');
  assert.equal(profilTir(u.artillerie, u.char_leger), 'cloche');
  assert.equal(profilTir(u.roquettes, u.char_leger), 'missile');
  assert.equal(profilTir(u.infanterie, u.infanterie), 'rafale');
  assert.equal(profilTir(u.antiair, u.helico), 'rafale');
  assert.equal(profilTir(u.bombardier, u.char_leger), 'cloche');
  assert.equal(profilTir(u.chasseur, u.helico), 'missile');
  assert.equal(profilTir(undefined), 'marqueur');
});

test('un tir recule, face à sa cible de trois quarts, et son projectile arrive à l’heure du coup', async () => {
  const s = scene();
  const bc = banc(s.avant, s.apres);
  const duree = DUREES.tir;
  // Le char tire vers la gauche sur un char : un obus tendu.
  s.apres.unites.find((u) => u.id === s.d)!.type = 'char_lourd';
  s.avant.unites.find((u) => u.id === s.d)!.type = 'char_lourd';
  const fin = bc.jouer({ gestes: [{ genre: 'tirer', unite: s.a, depuis: { x: 5, y: 2 }, vers: { x: 4, y: 2 }, debut: 0, duree }], duree });
  const v = bc.visuels.visuel(s.a);
  bc.attendre(32);
  assert.equal(v.orientation, 'gauche');
  assert.ok(v.dx > 0.02, `recul vers la droite, à l'opposé de la cible : ${v.dx}`);
  assert.equal(v.clip, 'tir');
  const obus = bc.posesEffets().find((p) => p.instance.entree.startsWith('effet_trait_'));
  assert.ok(obus, 'un obus tendu est parti');
  bc.attendre(duree - 48);
  const proche = bc.posesEffets().find((p) => p.instance.entree.startsWith('effet_trait_'));
  assert.ok(proche && Math.abs(proche.instance.x - (4.5 + 0.2)) < 0.12, `l'obus arrive sur la cible : ${proche?.instance.x}`);
  bc.attendre(100);
  await fin;
  assert.ok(estNeutre(v));
  assert.deepEqual(bc.sons, ['canon']);
});

test('une rafale : trois traçantes, trois coups de son, et un tir vertical ne tourne pas le dos', async () => {
  const s = scene();
  const bc = banc(s.avant, s.apres);
  const duree = DUREES.tir;
  const fin = bc.jouer({ gestes: [{ genre: 'tirer', unite: s.a, depuis: { x: 1, y: 1 }, vers: { x: 1, y: 3 }, debut: 0, duree }], duree });
  // Une cible sous lui : l'infanterie de la scène n'y est pas, on en met une.
  const v = bc.visuels.visuel(s.a);
  bc.attendre(duree);
  await fin;
  assert.ok(estNeutre(v));
  void v;
  const s2 = scene();
  const bc2 = banc(s2.avant, s2.apres);
  const fin2 = bc2.jouer({ gestes: [{ genre: 'tirer', unite: s2.a, depuis: { x: 1, y: 1 }, vers: { x: 3, y: 1 }, debut: 0, duree }], duree });
  bc2.attendre(100);
  const traits = bc2.posesEffets().filter((p) => p.instance.entree.startsWith('effet_trait_')).length;
  assert.equal(traits, 3, 'trois traçantes');
  bc2.attendre(duree);
  await fin2;
  assert.deepEqual(bc2.sons, ['rafale', 'rafale', 'rafale']);
  // Vertical : il garde la vue de repos de son camp, trois quarts vers la droite.
  const s3 = scene();
  const bc3 = banc(s3.avant, s3.apres);
  void bc3.jouer({ gestes: [{ genre: 'tirer', unite: s3.a, depuis: { x: 1, y: 1 }, vers: { x: 1, y: 3 }, debut: 0, duree }], duree });
  bc3.attendre(32);
  assert.equal(bc3.visuels.visuel(s3.a).orientation, 'droite');
});

// ---------------------------------------------------------------------------
// Le coup : l'arrêt sur image, la secousse
// ---------------------------------------------------------------------------

test('un coup fige la cible en blanc le temps de l’arrêt sur image, puis elle vibre en s’amortissant', async () => {
  const s = scene();
  const bc = banc(s.avant, s.apres);
  const duree = DUREES.encaisser;
  const fin = bc.jouer({ gestes: [{ genre: 'encaisser', unite: s.b, case: { x: 3, y: 1 }, degats: 60, depuis: { x: 1, y: 1 }, debut: 0, duree }], duree });
  const v = bc.visuels.visuel(s.b);
  assert.ok(ARRET_IMAGE_MS >= 60 && ARRET_IMAGE_MS <= 80);
  // Pendant l'arrêt : blanche, immobile, sur la première image de son clip.
  for (let t = 16; t < ARRET_IMAGE_MS; t += 16) {
    bc.attendre(16);
    assert.deepEqual([v.eclat, v.dx, v.dy, v.clip, v.clipTemps], [1, 0, 0, 'touche', 0], `à ${t} ms`);
  }
  // La secousse de l'écran part à la fin de l'arrêt, forte pour un coup plein.
  assert.equal(bc.secousses.length, 1);
  const [sec] = bc.secousses;
  assert.ok(sec!.amplitude >= 2 && sec!.amplitude <= SECOUSSE_MAX_PX, `${sec!.amplitude}`);
  assert.equal(sec!.amplitude, SECOUSSE_MAX_PX, 'soixante PV internes, un coup plein');
  assert.equal(sec!.retard, ARRET_IMAGE_MS - 16, 'elle attend la fin de l’arrêt');
  // L'étoile d'impact est tenue ; les étincelles attendent.
  const etoile = bc.posesEffets().find((p) => p.instance.entree === ID_EFFET.etoile);
  assert.ok(etoile);
  assert.equal(bc.posesEffets().filter((p) => p.instance.entree === ID_EFFET.etincelle).length, 0, 'les étincelles partent après l’arrêt');
  // Après : la pièce vibre le long du coup, et l'amplitude tombe.
  const ecarts: number[] = [];
  for (let t = 0; t < duree - ARRET_IMAGE_MS; t += 16) {
    bc.attendre(16);
    ecarts.push(Math.abs(v.dx));
  }
  assert.ok(Math.max(...ecarts.slice(0, 4)) > 0.03, 'elle vibre');
  assert.ok(Math.max(...ecarts.slice(-4)) < Math.max(...ecarts.slice(0, 4)) / 3, 'et s’amortit');
  assert.ok(bc.posesEffets().some((p) => p.instance.entree === ID_EFFET.etincelle), 'les étincelles sont parties');
  bc.attendre(100);
  await fin;
  assert.ok(estNeutre(v));
});

test('l’arrêt sur image tient dans un coup bref : jamais plus que la moitié du geste', async () => {
  const s = scene();
  const bc = banc(s.avant, s.apres);
  const fin = bc.jouer({ gestes: [{ genre: 'encaisser', unite: s.b, case: { x: 3, y: 1 }, degats: 5, depuis: { x: 1, y: 1 }, debut: 0, duree: 96 }], duree: 96 });
  const v = bc.visuels.visuel(s.b);
  bc.attendre(64);
  assert.ok(v.eclat < 1, 'passé la moitié, l’arrêt est fini');
  assert.equal(bc.secousses[0]?.amplitude, 2 + 2 * (5 / 60), 'une égratignure secoue à peine');
  bc.attendre(100);
  await fin;
});

// ---------------------------------------------------------------------------
// La sortie, la production, la capture
// ---------------------------------------------------------------------------

test('une unité hors jeu chancelle, éclate au tiers — son, secousse, fumée —, puis s’efface', async () => {
  const s = scene();
  s.apres.unites = s.apres.unites.filter((u) => u.id !== s.b);
  const bc = banc(s.avant, s.apres);
  const duree = DUREES.sortir;
  const fin = bc.jouer({ gestes: [{ genre: 'sortir', unite: s.b, case: { x: 3, y: 1 }, debut: 0, duree }], duree });
  bc.attendre(96);
  assert.deepEqual(bc.sons, [], 'pas de bruit avant qu’elle éclate');
  assert.equal(bc.visuels.visuel(s.b).clip, 'hors_jeu');
  assert.equal(bc.visuels.visuel(s.b).opacite, 1, 'elle est encore là');
  bc.attendre(96);
  assert.deepEqual(bc.sons, ['hors_jeu']);
  assert.ok(bc.posesEffets().some((p) => p.instance.entree.startsWith('effet_fumee_') || p.instance.entree === ID_EFFET.eclair), 'l’explosion');
  assert.equal(bc.secousses[0]?.amplitude, SECOUSSE_MAX_PX);
  bc.attendre(160);
  assert.ok(bc.visuels.visuel(s.b).opacite < 0.5, 'elle s’efface');
  bc.attendre(200);
  await fin;
  assert.equal(bc.visuels.estRetenue(s.b), false);
  // La fumée retombe après la fin du geste : elle ne retient pas la partition.
  assert.ok(bc.effets.vivants > 0, 'la fumée traîne encore un peu');
});

test('une unité produite n’est pas là avant son tour, tombe de son bâtiment et soulève la poussière', async () => {
  const s = scene();
  s.apres.unites.push({ ...s.apres.unites[1]!, id: 'recrue', camp: 0, type: 'infanterie', x: 0, y: 3 });
  const bc = banc(s.avant, s.apres);
  const fin = bc.jouer({ gestes: [{ genre: 'apparaitre', unite: 'infanterie', case: { x: 0, y: 3 }, camp: 0, debut: 100, duree: 520 }], duree: 620 });
  bc.attendre(48);
  assert.equal(bc.visuels.visuel('recrue').opacite, 0, 'invisible en attendant');
  bc.attendre(96);
  const v = bc.visuels.visuel('recrue');
  assert.ok(v.dh > 0.1 && v.echelle < 1, 'elle tombe et grandit');
  bc.attendre(260);
  assert.ok(bc.posesEffets().some((p) => p.instance.entree === ID_EFFET.poussiere), 'la poussière à l’atterrissage');
  bc.attendre(300);
  await fin;
  assert.ok(estNeutre(bc.visuels.lire('recrue')));
  assert.deepEqual(bc.sons, ['production']);
});

test('une capture acquise : l’unité plante ses couleurs, une gerbe à leur teinte quand elles arrivent en haut', async () => {
  const s = scene();
  s.apres.proprietaires['2,0'] = 0;
  const bc = banc(s.avant, s.apres);
  const duree = DUREES.hisser;
  const fin = bc.jouer({ gestes: [{ genre: 'hisser', unite: s.a, case: { x: 2, y: 0 }, camp: 0, points: 20, acquis: true, debut: 0, duree }], duree });
  bc.attendre(160);
  assert.equal(bc.visuels.visuel(s.a).clip, 'capture');
  assert.equal(bc.forces.get('2,0')?.camp, 1, 'l’ancien drapeau descend');
  bc.attendre(Math.round(0.92 * duree) - 160 + 32);
  const gerbe = bc.posesEffets().filter((p) => p.instance.entree === ID_EFFET.scintille);
  assert.ok(gerbe.length > 0, 'la gerbe au sommet du mât');
  assert.deepEqual([...gerbe[0]!.instance.teinte!].map((c) => Math.round(c * 100) / 100), [0.48, 0.61, 1], 'à la teinte du camp, éclaircie');
  bc.attendre(200);
  await fin;
  assert.deepEqual(bc.sons, ['capture']);
});

// ---------------------------------------------------------------------------
// Deux gestes sur une unité : la composition
// ---------------------------------------------------------------------------

test('la riposte : la cible tire pendant qu’elle encaisse — le coup reçu se voit, la vue reste celle du tir', async () => {
  const s = scene();
  const bc = banc(s.avant, s.apres);
  const fin = bc.jouer({
    gestes: [
      { genre: 'encaisser', unite: s.b, case: { x: 3, y: 1 }, degats: 30, depuis: { x: 1, y: 1 }, debut: 100, duree: 300 },
      { genre: 'tirer', unite: s.b, depuis: { x: 3, y: 1 }, vers: { x: 1, y: 1 }, debut: 20, duree: 260 },
    ],
    duree: 400,
  });
  const v = bc.visuels.visuel(s.b);
  bc.attendre(64);
  assert.equal(v.clip, 'tir');
  assert.equal(v.orientation, 'gauche');
  bc.attendre(64);
  assert.equal(v.clip, 'touche', 'le coup l’emporte sur le tir');
  assert.equal(v.orientation, 'gauche', 'la vue du tir tient');
  assert.equal(v.eclat, 1, 'l’arrêt sur image');
  bc.attendre(176);
  assert.equal(v.clip, 'touche', 'le tir fini, le coup continue');
  bc.attendre(200);
  await fin;
  assert.ok(estNeutre(v));
});

// ---------------------------------------------------------------------------
// Couper, réduire
// ---------------------------------------------------------------------------

test('couper au milieu d’une salve : chaque geste pose son état final exact', async () => {
  const s = scene();
  s.apres.unites = s.apres.unites.filter((u) => u.id !== s.b);
  s.apres.proprietaires['2,0'] = 0;
  const bc = banc(s.avant, s.apres);
  const fin = bc.jouer({
    gestes: [
      { genre: 'glisser', unite: s.a, chemin: [{ x: 0, y: 1 }, { x: 1, y: 1 }], debut: 0, duree: 240 },
      { genre: 'tirer', unite: s.a, depuis: { x: 1, y: 1 }, vers: { x: 3, y: 1 }, debut: 240, duree: 260 },
      { genre: 'encaisser', unite: s.b, case: { x: 3, y: 1 }, degats: 90, depuis: { x: 1, y: 1 }, debut: 500, duree: 300 },
      { genre: 'sortir', unite: s.b, case: { x: 3, y: 1 }, debut: 800, duree: 420 },
      { genre: 'hisser', unite: s.c, case: { x: 2, y: 0 }, camp: 0, points: 20, acquis: true, debut: 0, duree: 1100 },
      { genre: 'pouvoir', camp: 0, niveau: 'normal', nom: 'x', debut: 0, duree: 2000 },
    ],
    duree: 2000,
  });
  bc.attendre(560);
  assert.ok(!estNeutre(bc.visuels.lire(s.b)) || bc.visuels.estRetenue(s.b));
  bc.boucle.viderFile(true);
  await fin;
  for (const id of [s.a, s.b, s.c, s.d]) assert.deepEqual(vu(bc.visuels.lire(id)), NEUTRE, id);
  assert.equal(bc.visuels.estRetenue(s.b), false);
  assert.equal(bc.forces.size, 0);
});

test('sous animations réduites : l’état final tout de suite, sans un effet ni une secousse', async () => {
  const s = scene();
  s.apres.unites = s.apres.unites.filter((u) => u.id !== s.b);
  s.apres.proprietaires['2,0'] = 0;
  const bc = banc(s.avant, s.apres, { reduit: true });
  const gestes: Geste[] = Object.values(GESTES).map((preparer) => ({ ...preparer(s), debut: 0, duree: 0 }) as Geste);
  const fin = bc.jouer({ gestes, duree: 0 });
  bc.attendre(16);
  await fin;
  assert.equal(bc.effets.vivants, 0);
  assert.deepEqual(bc.secousses, []);
  assert.deepEqual(bc.eclats, []);
  assert.deepEqual(bc.vagues, []);
  for (const id of [s.a, s.b, s.c, s.d, 'recrue']) assert.deepEqual(vu(bc.visuels.lire(id)), NEUTRE, id);
  assert.ok(!bc.sons.includes('pas'), 'une marche qui ne dure pas ne fait pas de bruit de pas');
});

test('une rafale réduite ne tire qu’un coup de son : trois d’un coup ne font qu’un bruit', async () => {
  const s = scene();
  const bc = banc(s.avant, s.apres, { reduit: true });
  const fin = bc.jouer({ gestes: [{ genre: 'tirer', unite: s.a, depuis: { x: 1, y: 1 }, vers: { x: 3, y: 1 }, debut: 0, duree: 0 }], duree: 0 });
  bc.attendre(16);
  await fin;
  assert.deepEqual(bc.sons, ['rafale']);
});

test('le drapeau « réduit » du contexte suffit aussi : une partition qui dure, jouée sans effets', async () => {
  const s = scene();
  const bc = banc(s.avant, s.apres, { reduit: true });
  const duree = DUREES.encaisser;
  const fin = bc.jouer({ gestes: [{ genre: 'encaisser', unite: s.b, case: { x: 3, y: 1 }, degats: 60, depuis: { x: 1, y: 1 }, debut: 0, duree }], duree });
  bc.attendre(duree + 32);
  await fin;
  assert.equal(bc.effets.vivants, 0);
  assert.deepEqual(bc.secousses, []);
});

// ---------------------------------------------------------------------------
// Les armes de la faction, le pouvoir
// ---------------------------------------------------------------------------

test('une frappe de zone : des missiles sur chaque case du rayon, les deux camps, rien hors de la carte ni hors de vue', async () => {
  const s = scene();
  const bc = banc(s.avant, s.apres);
  const duree = DUREES.frapper;
  const fin = bc.jouer({ gestes: [{ genre: 'frapper', camp: 1, centre: { x: 0, y: 0 }, rayon: 1, debut: 0, duree }], duree });
  bc.attendre(16);
  // Trois cases du rayon sont sur la carte (0,0), (1,0), (0,1) : trois missiles, qui tombent.
  bc.attendre(200);
  const missiles = bc.posesEffets().filter((p) => IDS_MISSILE.includes(p.instance.entree));
  assert.ok(missiles.length >= 1 && missiles.length <= 3, `${missiles.length}`);
  assert.ok(missiles.every((p) => IDS_MISSILE.indexOf(p.instance.entree) >= 2 && IDS_MISSILE.indexOf(p.instance.entree) <= 6), 'ils tombent vers le bas de l’écran');
  assert.equal(bc.secousses.length, 1);
  bc.attendre(duree);
  await fin;
  assert.deepEqual(bc.sons.slice(0, 2), ['missile', 'impact']);
  const cache = banc(s.avant, s.apres, { visible: false });
  const fin2 = cache.jouer({ gestes: [{ genre: 'frapper', camp: 1, centre: { x: 2, y: 1 }, rayon: 1, debut: 0, duree }], duree });
  cache.attendre(duree + 32);
  await fin2;
  assert.equal(cache.effets.vivants, 0, 'hors de vue, rien ne tombe');
  assert.deepEqual(cache.secousses, []);
});

test('le rayon verrouille sa cible d’un réticule, puis le trait tombe', async () => {
  const s = scene();
  const bc = banc(s.avant, s.apres);
  const duree = DUREES.designer;
  const fin = bc.jouer({ gestes: [{ genre: 'designer', unite: s.a, case: { x: 1, y: 1 }, camp: 1, debut: 0, duree }], duree });
  bc.attendre(64);
  const ids = (): string[] => bc.posesEffets().map((p) => p.instance.entree);
  assert.ok(ids().includes(ID_EFFET.reticule));
  assert.ok(!ids().includes(ID_EFFET.rayon), 'pas de trait avant le verrou');
  assert.deepEqual(bc.sons, []);
  bc.attendre(Math.round(0.4 * duree) - 64 + 32);
  assert.ok(ids().includes(ID_EFFET.rayon), 'le trait');
  assert.deepEqual(bc.sons, ['rafale']);
  bc.attendre(duree);
  await fin;
});

test('une impulsion se referme, puis ce qui a un moteur bleuit — pas ce qui marche', async () => {
  const s = scene();
  // Une infanterie dans le rayon : elle n'a pas de moteur.
  s.apres.unites.find((u) => u.id === s.b)!.x = 2;
  const bc = banc(s.avant, s.apres);
  const duree = DUREES.sceller;
  const fin = bc.jouer({ gestes: [{ genre: 'sceller', camp: 1, centre: { x: 1, y: 1 }, rayon: 1, debut: 0, duree }], duree });
  bc.attendre(320);
  assert.equal(bc.visuels.visuel(s.a).teinte, null, 'pas avant que l’anneau se referme');
  bc.attendre(Math.round(0.85 * duree) - 320);
  assert.ok(bc.visuels.visuel(s.a).teinte, 'le char est figé');
  assert.ok(bc.visuels.visuel(s.c).teinte, 'le transport aussi');
  assert.equal(bc.visuels.lire(s.b)?.teinte ?? null, null, 'l’infanterie marche encore');
  bc.attendre(duree);
  await fin;
  assert.ok(estNeutre(bc.visuels.lire(s.a)));
});

test('un pouvoir : l’éclat à la couleur du camp, une vague depuis le QG — deux pour un super —, ses unités s’allument au passage', async () => {
  const s = scene();
  const bc = banc(s.avant, s.apres);
  const duree = DUREES.pouvoir;
  const fin = bc.jouer({ gestes: [{ genre: 'pouvoir', camp: 0, niveau: 'super', nom: 'x', debut: 0, duree }], duree });
  bc.attendre(16);
  assert.equal(bc.eclats.length, 1);
  assert.ok(bc.eclats[0]!.alpha > 0.4);
  assert.equal(bc.vagues.length, 2, 'deux vagues pour un super');
  const qg = s.avant.camps.find((c) => c.id === 0)?.qgCase ?? null;
  if (qg === null) {
    // Pas de QG : depuis le centre de ses unités.
    const siennes = s.avant.unites.filter((u) => u.camp === 0);
    const x = siennes.reduce((t, u) => t + u.x + 0.5, 0) / siennes.length;
    assert.ok(Math.abs(bc.vagues[0]!.x - x) < 1e-9);
  }
  assert.ok(bc.vagues[0]!.rayon >= Math.hypot(6, 4) / 2, 'la vague couvre la carte');
  let allume = 0;
  for (let t = 0; t < 1200; t += 16) {
    bc.attendre(16);
    allume = Math.max(allume, bc.visuels.visuel(s.a).eclat);
  }
  assert.ok(allume > 0.5, 'le char s’allume quand la vague le touche');
  assert.equal(bc.visuels.lire(s.b)?.eclat ?? 0, 0, 'pas l’adversaire');
  bc.attendre(duree);
  await fin;
  assert.deepEqual(bc.sons, ['pouvoir']);
  assert.equal(bc.secousses.length, 1);
});

test('les passages ne sont jamais des lignes droites sèches', () => {
  assert.ok(courbePassage('embarquer', 0.1) < 0, 'un élan avant de monter');
  assert.ok(Math.max(...[0.6, 0.7, 0.8, 0.9].map((p) => courbePassage('debarquer', p))) > 1, 'un dépassement en descendant');
  for (const genre of ['embarquer', 'debarquer', 'fusionner', 'repousser'] as const) {
    assert.equal(courbePassage(genre, 0), genre === 'embarquer' || genre === 'fusionner' ? -0 : 0);
    assert.ok(Math.abs(courbePassage(genre, 1) - 1) < 1e-12, genre);
  }
  assert.ok(courbePassage('repousser', 0.5) > 0.5, 'poussé, il freine');
});
