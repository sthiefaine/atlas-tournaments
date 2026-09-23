// Ce qui se peint au sol sans être une image : cases allumées, flèche,
// curseur, anneau, fond, voile. On vérifie l'emprise — une case allumée tombe
// exactement sur la case que `versMonde` renverrait — et les couleurs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ambiance } from '../../src/render/ambiance';
import { FLOTTANTS_SOMMET, Trace } from '../../src/render2d/aplats';
import { caseDepuisPlan, niveauxBrouillard } from '../../src/render2d/contrat';
import {
  COULEURS_SURBRILLANCE, couleurTerrainFond, tracerAnneau, tracerCurseur, tracerFleche, tracerFond,
  tracerSurbrillances, tracerVoile,
} from '../../src/render2d/surbrillances';

/** Les sommets d'une trace : position et couleur prémultipliée. */
function sommets(t: Trace): { X: number; Y: number; c: number[] }[] {
  const s = [];
  for (let i = 0; i < t.sommets; i++) {
    const o = i * FLOTTANTS_SOMMET;
    s.push({ X: t.donnees[o]!, Y: t.donnees[o + 1]!, c: Array.from(t.donnees.subarray(o + 2, o + 6)) });
  }
  return s;
}

test('une case allumée couvre sa case et seulement elle, à la couleur de son genre', () => {
  const t = new Trace();
  tracerSurbrillances(t, [{ case: { x: 3, y: 2 }, genre: 'deplacement' }, { case: { x: 4, y: 2 }, genre: 'attaque' }]);
  assert.equal(t.sommets, 12, 'deux quads, quatre triangles');
  const s = sommets(t);
  for (const p of s.slice(0, 6)) assert.deepEqual(caseDepuisPlan(p.X, p.Y, 10, 10), { x: 3, y: 2 });
  for (const p of s.slice(6)) assert.deepEqual(caseDepuisPlan(p.X, p.Y, 10, 10), { x: 4, y: 2 });
  const vert = COULEURS_SURBRILLANCE.deplacement;
  const c = s[0]!.c;
  // Prémultipliée : chaque composante porte l'alpha.
  assert.ok(Math.abs(c[0]! - vert[0] * vert[3]) < 1e-6 && Math.abs(c[3]! - vert[3]) < 1e-6);
});

test('vert, j’y vais ; rouge, j’y tire ; or pour l’objectif ; bleu pour le chantier', () => {
  const [vr, vv, vb] = COULEURS_SURBRILLANCE.deplacement;
  const [rr, rv] = COULEURS_SURBRILLANCE.attaque;
  const [or, ov, ob] = COULEURS_SURBRILLANCE.capture;
  const [br, , bb] = COULEURS_SURBRILLANCE.production;
  assert.ok(vv > vr && vv > vb);
  assert.ok(rr > rv);
  assert.ok(or > ob && ov > ob);
  assert.ok(bb > br);
});

test('la flèche : un corps par segment, des coudes, une pointe, et un liseré dessous', () => {
  const t = new Trace();
  tracerFleche(t, [{ x: 0, y: 0 }]);
  assert.equal(t.sommets, 0, 'une seule case n’a pas de flèche');
  tracerFleche(t, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]);
  // Par passe : deux segments (2 quads), un coude (1 quad), une pointe (1 triangle) ; deux passes.
  assert.equal(t.sommets, 2 * (6 + 6 + 6 + 3));
  // Le liseré est peint d'abord, et plus sombre que le corps.
  const s = sommets(t);
  assert.ok(s[0]!.c[0]! < s[s.length - 1]!.c[0]!);
});

test('un chemin aveugle se trace en tirets : plus de morceaux, moins d’encre', () => {
  const plein = new Trace();
  const tirets = new Trace();
  const chemin = [{ x: 0, y: 0 }, { x: 5, y: 0 }];
  tracerFleche(plein, chemin, false);
  tracerFleche(tirets, chemin, true);
  assert.ok(tirets.sommets > plein.sommets, 'des tirets, pas un ruban');
  // L'encre : la somme des aires des corps est plus petite en tirets.
  const aire = (t: Trace): number => {
    let a = 0;
    const s = sommets(t);
    for (let i = 0; i + 2 < s.length; i += 3) {
      const [p, q, r] = [s[i]!, s[i + 1]!, s[i + 2]!];
      a += Math.abs((q.X - p.X) * (r.Y - p.Y) - (r.X - p.X) * (q.Y - p.Y)) / 2;
    }
    return a;
  };
  assert.ok(aire(tirets) < aire(plein));
});

test('le curseur est le contour de sa case', () => {
  const t = new Trace();
  tracerCurseur(t, { x: 2, y: 5 });
  assert.equal(t.sommets, 24);
  for (const p of sommets(t)) assert.deepEqual(caseDepuisPlan(p.X, p.Y, 10, 10), { x: 2, y: 5 });
});

test('l’anneau bat, sauf sous animations réduites', () => {
  const a = new Trace();
  const b = new Trace();
  tracerAnneau(a, 3.5, 3.5, 0, false);
  tracerAnneau(b, 3.5, 3.5, 500, false);
  assert.notDeepEqual(Array.from(a.donnees.subarray(0, 6)), Array.from(b.donnees.subarray(0, 6)));
  const c = new Trace();
  const d = new Trace();
  tracerAnneau(c, 3.5, 3.5, 0, true);
  tracerAnneau(d, 3.5, 3.5, 500, true);
  assert.deepEqual(Array.from(c.donnees.subarray(0, c.sommets * FLOTTANTS_SOMMET)), Array.from(d.donnees.subarray(0, d.sommets * FLOTTANTS_SOMMET)));
});

test('le fond : une couleur par case, noire sous le brouillard', () => {
  const t = new Trace();
  const brouillard = niveauxBrouillard(2, 1, new Set(['0,0']));
  tracerFond(t, 2, 1, () => '#80ff00', brouillard);
  const s = sommets(t);
  assert.equal(s.length, 12);
  assert.ok(s[0]!.c[1]! > 0.99, 'la case vue garde sa couleur');
  assert.deepEqual(s[6]!.c.slice(0, 3), [0, 0, 0], 'la case cachée est noire');
  assert.equal(s[6]!.c[3], 1, 'et opaque');
});

test('le fond lit la palette d’ambiance : la nuit assombrit l’herbe', () => {
  const jour = ambiance('ete', 'jour', 'clair').palette;
  const nuit = ambiance('ete', 'nuit', 'clair').palette;
  assert.equal(couleurTerrainFond('plaine', jour), jour.herbe);
  assert.equal(couleurTerrainFond('mer', jour), jour.eauBas);
  assert.equal(couleurTerrainFond('ville', jour), jour.route);
  assert.notEqual(couleurTerrainFond('plaine', nuit), couleurTerrainFond('plaine', jour));
});

test('le voile couvre le champ, et ne pèse rien quand il est transparent', () => {
  const t = new Trace();
  tracerVoile(t, { minX: 0, minY: 0, maxX: 100, maxY: 50 }, '#0d1a3a', 0);
  assert.equal(t.sommets, 0);
  tracerVoile(t, { minX: 0, minY: 0, maxX: 100, maxY: 50 }, '#0d1a3a', 0.32);
  assert.equal(t.sommets, 6);
});
