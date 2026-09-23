// La couleur d'équipe à l'écran (charte des figurines §3.11, 23 septembre
// 2026) : la projection de chaque couleur d'armée dans la fenêtre lisible, et
// la séparation des camps d'une carte. Les chiffres attendus sont ceux de la
// designeuse (`doc/refonte/panel-sprites/avis-designeuse.md`, G.5), recalculés
// ici : ils se retrouvent à l'octet près, et ses écarts au dixième près.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerStylesNations } from '../../src/assets/styles';
import {
  clarteChroma, COULEUR_NEUTRE, dansFenetre, ECART_ENTRE_CAMPS, ecartCouleurs, FENETRE_EQUIPE, oklabDe,
  paletteArmeeParDefaut, paletteProjetee, palettesDesCamps, projeterCouleurEquipe, TOLERANCE_OCTET,
  type CampNation,
} from '../../src/render/couleur-equipe';
import { NATIONS, PALETTES } from '../../src/render/palettes';
import type { CampId, CodePays, Palette } from '../../src/schemas/types';

/** Les 24 couleurs de nation, et leur palette brute. */
const NATIONS_JEU: ReadonlyMap<CodePays, Palette> = new Map(
  chargerStylesNations().map((s) => [s.code, { main: s.palette.main, dark: s.palette.dark, light: s.palette.light }]),
);
const brute = (pays: CodePays): string => NATIONS_JEU.get(pays)!.main;
/** Les 28 couleurs d'armée : 24 nations, 4 camps. */
const VINGT_HUIT: readonly string[] = [...[...NATIONS_JEU.values()].map((p) => p.main), ...NATIONS.map((n) => PALETTES[n].main)];
const GRAPHITE = '#30343b';

/** L'écart de teinte entre deux couleurs, en degrés. */
function ecartTeinte(a: string, b: string): number {
  const d = Math.abs(clarteChroma(a).teinte - clarteChroma(b).teinte) * (180 / Math.PI);
  return d > 180 ? 360 - d : d;
}

/** Une carte : pour chaque rang, un pays ou `null` (le camp sans nation). */
function carte(...pays: (CodePays | null)[]): Map<CampId, Palette> {
  return palettesDesCamps(pays.map((p, i) => ({ camp: i as CampId, nation: p ? NATIONS_JEU.get(p)! : null })));
}

/** L'écart le plus serré entre deux camps d'une carte. */
function plusSerre(p: ReadonlyMap<CampId, Palette>): number {
  const couleurs = [...p.values()].map((q) => q.main);
  let m = Number.POSITIVE_INFINITY;
  for (let i = 0; i < couleurs.length; i += 1) {
    for (let j = i + 1; j < couleurs.length; j += 1) m = Math.min(m, ecartCouleurs(couleurs[i]!, couleurs[j]!));
  }
  return m;
}

// ---------------------------------------------------------------------------
// OKLab, et le ΔE de la charte
// ---------------------------------------------------------------------------

test('OKLab : le blanc, le noir et le rouge de référence de Björn Ottosson', () => {
  const blanc = oklabDe('#ffffff');
  assert.ok(Math.abs(blanc.L - 1) < 1e-4 && Math.abs(blanc.a) < 1e-4 && Math.abs(blanc.b) < 1e-4);
  assert.ok(Math.abs(oklabDe('#000000').L) < 1e-9);
  const rouge = oklabDe('#ff0000');
  assert.ok(Math.abs(rouge.L - 0.62796) < 1e-4, `L ${rouge.L}`);
  assert.ok(Math.abs(rouge.a - 0.22486) < 1e-4, `a ${rouge.a}`);
  assert.ok(Math.abs(rouge.b - 0.12585) < 1e-4, `b ${rouge.b}`);
});

test('le ΔE est la distance OKLab × 100 : les écarts de la designeuse se retrouvent au dixième', () => {
  const proche = (x: number, attendu: number, quoi: string): void => {
    assert.ok(Math.abs(x - attendu) < 0.06, `${quoi} : ${x.toFixed(2)} au lieu de ${attendu}`);
  };
  proche(ecartCouleurs(projeterCouleurEquipe(brute('is')), GRAPHITE), 28.8, 'Islande projetée — graphite');
  proche(ecartCouleurs(projeterCouleurEquipe(brute('gr')), PALETTES.bleu.main), 3.1, 'Grèce — camp bleu');
  proche(ecartCouleurs(brute('ar'), COULEUR_NEUTRE), 13.2, 'Argentine — neutre');
  proche(ecartCouleurs(PALETTES.vert.main, projeterCouleurEquipe(PALETTES.or.main)), 18.1, 'vert — or');
  proche(ecartCouleurs(projeterCouleurEquipe(brute('nl')), '#f0761e'), 2.8, 'Pays-Bas — orange des Gris');
  assert.equal(ecartCouleurs('#123456', '#123456'), 0);
  assert.equal(ecartCouleurs('#e04b45', '#3f86e0'), ecartCouleurs('#3f86e0', '#e04b45'), 'symétrique');
});

// ---------------------------------------------------------------------------
// La projection
// ---------------------------------------------------------------------------

test('la projection retombe sur le tableau de la charte, à l’octet près', () => {
  // §3.11 et G.5 : or, France, Suisse–Canada–Pérou, Nouvelle-Zélande, Islande.
  assert.equal(projeterCouleurEquipe(PALETTES.or.main), '#d9aa23', 'l’or rejoignait le sable et l’herbe claire');
  assert.equal(projeterCouleurEquipe(brute('fr')), '#4578ec', 'la France noircissait à l’ombre');
  for (const p of ['ch', 'ca', 'pe'] as const) assert.equal(projeterCouleurEquipe(brute(p)), '#d44c40', p);
  assert.equal(projeterCouleurEquipe(brute('nz')), '#339377', 'la Nouvelle-Zélande tombait dans le graphite');
  assert.equal(projeterCouleurEquipe(brute('is')), '#5283ba', 'l’Islande était un gris ; un bleu glacier');
});

test('une couleur déjà dans la fenêtre passe telle quelle : les camps bleu, rouge et vert, l’Inde, le Luxembourg', () => {
  for (const c of [PALETTES.bleu.main, PALETTES.rouge.main, PALETTES.vert.main, brute('in'), brute('lu')]) {
    assert.equal(dansFenetre(c), true, c);
    assert.equal(projeterCouleurEquipe(c), c.toLowerCase(), c);
  }
  // Et toute couleur des 28 qui tient déjà la fenêtre, sans exception.
  for (const c of VINGT_HUIT) if (dansFenetre(c)) assert.equal(projeterCouleurEquipe(c), c.toLowerCase(), c);
});

test('les 28 couleurs de jeu : dans la fenêtre, à teinte gardée, loin du neutre — et la projection est idempotente', () => {
  const f = FENETRE_EQUIPE;
  for (const c of VINGT_HUIT) {
    const jeu = projeterCouleurEquipe(c);
    const { clarte, chroma } = clarteChroma(jeu);
    assert.match(jeu, /^#[0-9a-f]{6}$/);
    assert.ok(clarte >= f.clarteMin - TOLERANCE_OCTET && clarte <= f.clarteMax + TOLERANCE_OCTET, `${c} → ${jeu} : L ${clarte.toFixed(4)}`);
    assert.ok(chroma >= f.chromaMin - TOLERANCE_OCTET, `${c} → ${jeu} : C ${chroma.toFixed(4)}`);
    assert.ok(ecartTeinte(c, jeu) < 1, `${c} → ${jeu} : la teinte a tourné de ${ecartTeinte(c, jeu).toFixed(2)}°`);
    // Aucune ne peut se prendre pour un bâtiment neutre ni une pièce grise.
    assert.ok(ecartCouleurs(jeu, COULEUR_NEUTRE) >= 13, `${c} → ${jeu} : ${ecartCouleurs(jeu, COULEUR_NEUTRE).toFixed(1)} du neutre`);
    assert.equal(projeterCouleurEquipe(jeu), jeu, `${jeu} : une seconde projection ne la bouge plus`);
  }
  // L'arrondi à l'octet laisse la Nouvelle-Zélande d'un millième sous la
  // fenêtre : c'est pour elle que la fenêtre se lit à l'octet près.
  assert.equal(dansFenetre('#339377'), false);
  assert.equal(dansFenetre('#339377', TOLERANCE_OCTET), true);
});

test('le neutre ne se projette jamais : il est hors de la fenêtre, et c’est lui qu’elle protège', () => {
  assert.equal(dansFenetre(COULEUR_NEUTRE), false);
  assert.deepEqual(paletteArmeeParDefaut(null), PALETTES.neutre);
  assert.equal(paletteArmeeParDefaut(null).main, '#b9bec7');
});

test('la palette d’un camp sans nation : la sienne, projetée — seul l’or bouge', () => {
  assert.deepEqual(paletteArmeeParDefaut(0), PALETTES.bleu);
  assert.deepEqual(paletteArmeeParDefaut(1), PALETTES.rouge);
  assert.deepEqual(paletteArmeeParDefaut(2), PALETTES.vert);
  assert.deepEqual(paletteArmeeParDefaut(3), { ...PALETTES.or, main: '#d9aa23' });
});

test('une palette projetée garde son sombre et son clair : seule la couleur principale se déplace', () => {
  const fr = NATIONS_JEU.get('fr')!;
  assert.deepEqual(paletteProjetee(fr), { main: '#4578ec', dark: fr.dark, light: fr.light });
});

test('la projection est totale : un gris parfait, un bleu que le sRGB ne tient pas à cette clarté', () => {
  const gris = projeterCouleurEquipe('#808080');
  assert.ok(dansFenetre(gris, TOLERANCE_OCTET), gris);
  assert.ok(ecartTeinte(gris, PALETTES.bleu.main) < 2, `${gris} : un gris prend la teinte du camp bleu`);
  // Le bleu pur, relevé à L 0,60, sortirait du gamut : la chroma se réduit, la teinte reste.
  const bleu = projeterCouleurEquipe('#0000ff');
  assert.ok(dansFenetre(bleu, TOLERANCE_OCTET), bleu);
  assert.ok(ecartTeinte('#0000ff', bleu) < 1, bleu);
  assert.equal(projeterCouleurEquipe('pas une couleur'), projeterCouleurEquipe('#000000'), 'illisible : du noir, projeté');
});

// ---------------------------------------------------------------------------
// La séparation des camps
// ---------------------------------------------------------------------------

test('la Suisse contre le Canada : même rouge — le second prend la première couleur de camp libre', () => {
  const p = carte('ch', 'ca');
  assert.equal(p.get(0)!.main, '#d44c40', 'le camp 0 garde sa nation');
  // La couleur de son camp, le rouge, est à 2,4 du rouge suisse : elle ne sépare rien.
  assert.ok(ecartCouleurs(PALETTES.rouge.main, '#d44c40') < ECART_ENTRE_CAMPS);
  assert.deepEqual(p.get(1), PALETTES.bleu, 'la première couleur de camp qui tient l’écart');
  assert.ok(plusSerre(p) >= ECART_ENTRE_CAMPS);
});

test('la France contre le camp bleu : 4,3 d’écart — la France, qui joue après, reprend le rouge de son camp', () => {
  assert.ok(ecartCouleurs('#4578ec', PALETTES.bleu.main) < ECART_ENTRE_CAMPS);
  const p = carte(null, 'fr');
  assert.deepEqual(p.get(0), PALETTES.bleu);
  assert.deepEqual(p.get(1), PALETTES.rouge);
  // Au camp 0, c'est elle qui garde sa couleur ; le camp sans nation a déjà la sienne, le rouge.
  const q = carte('fr', null);
  assert.equal(q.get(0)!.main, '#4578ec');
  assert.deepEqual(q.get(1), PALETTES.rouge);
});

test('la France contre le Luxembourg, la partie ordinaire : deux bleus à 13,2 — le Luxembourg passe au rouge', () => {
  assert.ok(ecartCouleurs('#4578ec', brute('lu')) < ECART_ENTRE_CAMPS);
  const p = carte('fr', 'lu');
  assert.equal(p.get(0)!.main, '#4578ec');
  assert.deepEqual(p.get(1), PALETTES.rouge);
  // Deux nations assez loin gardent chacune la sienne.
  const q = carte('fr', 'in');
  assert.equal(q.get(0)!.main, '#4578ec');
  assert.equal(q.get(1)!.main, brute('in'));
});

test('deux camps tiennent toujours l’écart : les 24 nations deux à deux, et contre les camps sans nation', () => {
  const codes = [...NATIONS_JEU.keys()];
  let cartes = 0;
  const verifier = (p: Map<CampId, Palette>, quoi: string): void => {
    cartes += 1;
    assert.ok(plusSerre(p) >= ECART_ENTRE_CAMPS, `${quoi} : ${plusSerre(p).toFixed(1)}`);
  };
  for (const a of codes) {
    for (const b of codes) if (a !== b) verifier(carte(a, b), `${a} contre ${b}`);
    verifier(carte(a, null), `${a} contre le camp rouge`);
    verifier(carte(null, a), `le camp bleu contre ${a}`);
    // Le camp 0 garde toujours sa nation, projetée : c'est d'ordinaire le joueur.
    for (const b of codes) if (a !== b) assert.equal(carte(a, b).get(0)!.main, projeterCouleurEquipe(brute(a)));
  }
  assert.equal(cartes, 600);
});

test('trois camps tiennent l’écart, les nations aux deux premiers comme dans une partie ordinaire', () => {
  const codes = [...NATIONS_JEU.keys()];
  for (const a of codes) {
    for (const b of codes) {
      if (a === b) continue;
      const p = carte(a, b, null);
      assert.ok(plusSerre(p) >= ECART_ENTRE_CAMPS, `${a}, ${b}, vert : ${plusSerre(p).toFixed(1)}`);
    }
  }
});

test('quatre camps : Suisse, Canada, Pérou et Islande — trois rouges identiques et un gris se séparent', () => {
  const p = carte('ch', 'ca', 'pe', 'is');
  assert.equal(p.get(0)!.main, '#d44c40', 'la Suisse garde sa nation');
  assert.deepEqual(p.get(1), PALETTES.bleu, 'le Canada : son rouge de camp est pris, le bleu est libre');
  assert.deepEqual(p.get(2), PALETTES.vert, 'le Pérou reprend la couleur de son camp');
  assert.equal(p.get(3)!.main, '#d9aa23', 'l’Islande, trop près du bleu, reprend l’or de son camp');
  assert.equal(new Set([...p.values()].map((q) => q.main)).size, 4, 'quatre armées, quatre couleurs');
  // Quatre camps ne tiennent pas 25 : les quatre couleurs de camp ne sont qu'à
  // 18,1 l'une de l'autre au plus près (vert et or), et aucune coloration ne
  // fait mieux ici.
  assert.ok(Math.abs(plusSerre(p) - 18.1) < 0.06, plusSerre(p).toFixed(2));
});

test('quatre camps, jamais pire que les seules couleurs de camp — le recours de la charte', () => {
  const recours = plusSerre(carte(null, null, null, null));
  assert.ok(Math.abs(recours - 18.1) < 0.06, recours.toFixed(2));
  assert.deepEqual([...carte(null, null, null, null).values()], [0, 1, 2, 3].map((c) => paletteArmeeParDefaut(c as CampId)));
  // La partie ordinaire à quatre camps : les nations aux deux premiers, les deux
  // autres sans nation (FR11, « un contre trois »).
  const codes = [...NATIONS_JEU.keys()];
  for (const a of codes) {
    for (const b of codes) {
      if (a === b) continue;
      assert.ok(plusSerre(carte(a, b, null, null)) >= recours - 1e-9, `${a}, ${b}`);
    }
  }
  // Ce qu'une recherche camp après camp manquait : les Pays-Bas au camp 1
  // gardaient leur orange, et l'or du camp 3 tombait à 11,5 d'eux.
  const p = carte('fr', 'nl', null, null);
  assert.deepEqual([...p.values()].map((q) => q.main), ['#4578ec', PALETTES.rouge.main, PALETTES.vert.main, '#d9aa23']);
});

test('la séparation ne dépend pas de l’ordre donné ; un camp répété ne compte qu’une fois', () => {
  const ch = NATIONS_JEU.get('ch')!;
  const ca = NATIONS_JEU.get('ca')!;
  const dans = (liste: CampNation[]): string[] => {
    const p = palettesDesCamps(liste);
    return [0, 1].map((c) => p.get(c as CampId)!.main);
  };
  const attendu = dans([{ camp: 0, nation: ch }, { camp: 1, nation: ca }]);
  assert.deepEqual(dans([{ camp: 1, nation: ca }, { camp: 0, nation: ch }]), attendu);
  assert.deepEqual(dans([{ camp: 0, nation: ch }, { camp: 1, nation: ca }, { camp: 1, nation: null }]), attendu);
  assert.equal(palettesDesCamps([]).size, 0);
  // Un camp seul n'a personne à qui se comparer : sa nation, projetée.
  assert.equal(palettesDesCamps([{ camp: 2, nation: NATIONS_JEU.get('nz')! }]).get(2)!.main, '#339377');
});
