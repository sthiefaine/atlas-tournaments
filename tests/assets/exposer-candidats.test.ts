import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, readlinkSync, lstatSync, unlinkSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exposerCandidats } from '../../scripts/production/exposer-candidats';

/** Deux minuscules lots : la publication lit les octets, leur validation relève du bilan préalable. */
function preparer() {
  const racine = mkdtempSync(path.join(os.tmpdir(), 'atlas-exposition-'));
  mkdirSync(path.join(racine, 'assets/production'), { recursive: true });
  mkdirSync(path.join(racine, 'assets/specs'), { recursive: true });
  const lots = ['terrain_alpha', 'terrain_beta'].map(id => {
    const dossier = `assets/livraisons/${id}`;
    mkdirSync(path.join(racine, dossier), { recursive: true });
    writeFileSync(path.join(racine, dossier, `${id}_lod0.glb`), 'petit tampon partagé');
    writeFileSync(path.join(racine, dossier, `${id}_albedo.png`), 'petite texture partagée');
    writeFileSync(path.join(racine, `assets/specs/${id}.json`), JSON.stringify({
      id, verification: { lodRequis: [0] }, textures: [{ canal: 'albedo', format: 'png' }],
      variantes: { saisons: [] }, nommage: { modele: '{id}_lod{lod}.glb', texture: '{id}_{canal}_{variante}.{ext}' },
    }));
    return { id, dossier };
  });
  const bilan = { total: 2, lotsComplets: 2, imagesEmbarquees: 0, lots };
  writeFileSync(path.join(racine, 'assets/production/bilan.json'), JSON.stringify(bilan));
  return { racine, bilan };
}

test('exposition : données dédupliquées, alias relatifs, rejeu idempotent et fichier ordinaire préservé', () => {
  const { racine } = preparer();
  try {
    const resultat = exposerCandidats(racine);
    assert.equal(resultat.assets, 2);
    assert.equal(resultat.fichiers, 4);
    assert.equal(readdirSync(path.join(racine, 'public/assets/donnees')).length, 2);
    const alias = path.join(resultat.repertoire, 'terrain_alpha_albedo.png');
    const cible = readlinkSync(alias);
    assert.match(cible, /^\.\.\/donnees\/[a-f0-9]{64}\.png$/);
    assert.equal(readlinkSync(path.join(resultat.repertoire, 'terrain_beta_albedo.png')), cible);
    assert.equal(readFileSync(alias, 'utf8'), 'petite texture partagée');
    const inode = lstatSync(alias).ino;
    const manifeste = readFileSync(path.join(racine, 'assets/production/exposition.json'));
    assert.deepEqual(exposerCandidats(racine), resultat);
    assert.equal(lstatSync(alias).ino, inode, 'le rejeu ne remplace pas un alias déjà exact');
    assert.deepEqual(readFileSync(path.join(racine, 'assets/production/exposition.json')), manifeste);
    unlinkSync(alias);
    writeFileSync(alias, 'travail local à conserver');
    assert.throws(() => exposerCandidats(racine), /n’est pas un alias de production/);
    assert.equal(readFileSync(alias, 'utf8'), 'travail local à conserver');
  } finally { rmSync(racine, { recursive: true, force: true }); }
});

test('exposition : un bilan incomplet, tronqué ou avec images embarquées ne publie rien', () => {
  const { racine, bilan } = preparer();
  try {
    for (const invalide of [{ ...bilan, lotsComplets: 1 }, { ...bilan, lots: bilan.lots.slice(0, 1) }, { ...bilan, imagesEmbarquees: 1 }]) {
      writeFileSync(path.join(racine, 'assets/production/bilan.json'), JSON.stringify(invalide));
      assert.throws(() => exposerCandidats(racine), /bilan doit être complet/);
      assert(!existsSync(path.join(racine, 'public')), 'le refus précède toute écriture publique');
      assert(!existsSync(path.join(racine, 'assets/production/exposition.json')));
    }
  } finally { rmSync(racine, { recursive: true, force: true }); }
});
