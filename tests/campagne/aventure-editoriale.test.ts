/** Le plan reste un graphe cohérent, distinct du parcours jouable. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const lire = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const lore = lire('doc/refonte/lore-v2.json');
const nations = lire('doc/refonte/opus1-nations.json');

test('les douze arcs couvrent chacun douze épisodes nationaux, sans perte ni doublon', () => {
  assert.equal(Object.keys(lore.episodes).length, 200);
  assert.equal(lore.arcsNationaux.length, 12);
  const ids = lore.arcsNationaux.flatMap((arc: { nation: string; episodes: string[] }) => {
    assert.equal(arc.episodes.length, 12);
    for (const id of arc.episodes) assert.ok(id.startsWith(`opus1_${arc.nation}_`));
    return arc.episodes;
  });
  assert.equal(new Set(ids).size, 144);
  assert.deepEqual([...ids].sort(), nations.missions.map((m: { id: string }) => m.id).sort());
  for (const m of nations.missions) {
    assert.equal(lore.episodes[m.id].resume, m.situation, m.id);
  }
});

test('les choix, ouvertures et retours pointent vers des épisodes existants', () => {
  const cles = new Set(Object.keys(lore.episodes));
  let decisions = 0;
  for (const [id, episode] of Object.entries(lore.episodes) as [string, { decision?: { options: { cle: string; consequences?: { cible: string | null }[]; ouvre?: string[]; ferme?: string[] }[] } }][]) {
    if (!episode.decision) continue;
    decisions += 1;
    const options = episode.decision.options;
    assert.equal(new Set(options.map(o => o.cle)).size, options.length, id);
    for (const o of options) {
      for (const cible of [...(o.consequences ?? []).map(c => c.cible), ...(o.ouvre ?? []), ...(o.ferme ?? [])]) {
        if (cible) assert.ok(cles.has(cible), `${id} vers ${cible}`);
      }
    }
  }
  assert.equal(decisions, 79);
  assert.equal(lore.fins.length, 4);
  assert.equal(lire('content/campagne.json').missions.length, 12, 'ne pas présenter le plan comme des missions intégrées');
});
