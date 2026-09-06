// Le composeur de silhouettes, sur un pinceau factice qui journalise ses appels.
// Pas de canvas ici : on ne juge pas le dessin, on garde trois promesses.
// Aucune silhouette du catalogue ne casse ; les trois troupes à pied ne sont
// pas le même dessin à un accessoire près ; et un module que les pattes ont
// déjà traduit en équipement ne se pose pas une seconde fois.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogue } from '../../src/engine/index';
import { PALETTES } from '../../src/render/palettes';
import { dessinerSilhouette, dessinerUnite, equipementDe } from '../../src/render/sprites/silhouettes';
import type { Pinceau } from '../../src/render/sprites/formes';
import type { CleUnite, ModuleSilhouette } from '../../src/schemas/index';

/** Un pinceau qui note chaque méthode appelée et chaque propriété posée. */
function pinceauFactice(): { g: Pinceau; journal: string[] } {
  const journal: string[] = [];
  const proprietes: Record<string, unknown> = {};
  const g = new Proxy(proprietes, {
    get(_, prop) {
      if (typeof prop !== 'string') return undefined;
      if (prop === 'createLinearGradient') return () => ({ addColorStop(): void { /* factice */ } });
      if (prop in proprietes) return proprietes[prop];
      return (...args: unknown[]): void => {
        journal.push(`${prop}(${args.map((a) => (typeof a === 'number' ? a.toFixed(2) : String(a))).join(',')})`);
      };
    },
    set(_, prop, valeur) {
      if (typeof prop === 'string') {
        proprietes[prop] = valeur;
        journal.push(`${prop}=${String(valeur)}`);
      }
      return true;
    },
  });
  return { g: g as unknown as Pinceau, journal };
}

const CAT = chargerCatalogue(2);
const BLEU = PALETTES.bleu;

test('toute silhouette du catalogue se dessine, et chaque save a son restore', () => {
  for (const cle of Object.keys(CAT.unites) as CleUnite[]) {
    const { g, journal } = pinceauFactice();
    dessinerUnite(g, CAT.unites[cle]!.silhouette, BLEU);
    assert.ok(journal.length > 10, `${cle} : rien n'a été dessiné`);
    const saves = journal.filter((l) => l === 'save()').length;
    const restores = journal.filter((l) => l === 'restore()').length;
    assert.equal(saves, restores, `${cle} : ${saves} save pour ${restores} restore`);
  }
});

test('l’équipement d’une troupe à pied se lit dans ses modules', () => {
  assert.equal(equipementDe([]), 'fusil');
  assert.equal(equipementDe(['lance_roquettes']), 'lance_missiles');
  assert.equal(equipementDe(['radar']), 'chantier');
  // Un module qui n'a pas de sens sur des hommes ne les désarme pas.
  assert.equal(equipementDe(['antenne']), 'fusil');
});

test('infanterie, méca et génie ne sont pas le même dessin à un accessoire près', () => {
  const dessin = (modules: readonly ModuleSilhouette[]): string[] => {
    const { g, journal } = pinceauFactice();
    dessinerSilhouette(g, 'pattes', 'capsule', modules, 1, BLEU);
    return journal;
  };
  const infanterie = dessin([]);
  const meca = dessin(['lance_roquettes']);
  const genie = dessin(['radar']);

  // Trois têtes de fantassin, deux pour les autres : la masse du groupe diffère.
  const tetes = (j: string[]): number => j.filter((l) => l === `fillStyle=${'#f3c9a4'}`).length;
  assert.ok(tetes(infanterie) > tetes(meca), 'l’infanterie compte plus d’hommes que le méca');
  assert.ok(tetes(infanterie) > tetes(genie), 'l’infanterie compte plus d’hommes que le génie');

  // Le tube d'épaule est le trait le plus épais qu'une troupe à pied porte ;
  // le fusil est un trait fin. Ni l'un ni l'autre ne se prête aux autres.
  const traits = (j: string[]): number[] => j
    .filter((l) => l.startsWith('lineWidth='))
    .map((l) => Number(l.slice('lineWidth='.length)));
  assert.ok(Math.max(...traits(meca)) >= 7, 'le méca porte un gros tube');
  assert.ok(Math.max(...traits(infanterie)) < 7, 'l’infanterie ne porte pas de tube');
  assert.ok(Math.max(...traits(genie)) < 7, 'le génie ne porte pas de tube');
  assert.notDeepEqual(infanterie, genie);
  assert.notDeepEqual(meca, genie);

  // Le génie porte l'accent sur la tête et le gilet ; l'infanterie, non.
  const accents = (j: string[]): number => j.filter((l) => l === `fillStyle=${BLEU.light}`).length;
  assert.ok(accents(genie) > accents(infanterie), 'le génie est plus clair que l’infanterie');
});

test('un module déjà porté par les pattes ne se pose pas une seconde fois', () => {
  const avec = pinceauFactice();
  dessinerSilhouette(avec.g, 'pattes', 'capsule', ['radar'], 1, BLEU);
  const sans = pinceauFactice();
  dessinerSilhouette(sans.g, 'pattes', 'capsule', ['radar', 'antenne'], 1, BLEU);
  // Le radar est déjà l'équipe de chantier ; seule l'antenne ajoute un dessin.
  assert.ok(sans.journal.length > avec.journal.length);
  const rotations = (j: string[]): number => j.filter((l) => l.startsWith('rotate(-0.50')).length;
  assert.equal(rotations(avec.journal), 0, 'la parabole du radar ne doit pas se poser sur des hommes');
});
