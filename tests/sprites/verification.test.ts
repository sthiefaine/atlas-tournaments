// La vérification d'un manifeste, sur des manifestes construits à la main :
// elle doit voir ce qui ferait tomber une image à côté de sa case.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PIXELS_PAR_CASE, TANGAGE_CARTE, TANGAGE_PROFIL, VERSION_SPRITES, type EntreeSprite, type ManifesteSprites,
} from '../../src/render2d/contrat';
import { composerManifeste, problemesManifeste } from '../../scripts/sprites/manifeste';

function entree(): EntreeSprite {
  return {
    id: 'unite_essai_base',
    famille: 'unite',
    cle: 'essai',
    source: { fichier: 'public/assets/modeles/unite_essai_base_lod0.glb', sha256: 'a'.repeat(64) },
    pages: [{ couleur: 'assets/sprites/unites/unite_essai_base_0.webp', masque: 'assets/sprites/unites/unite_essai_base_0_masque.png', largeur: 256, hauteur: 128 }],
    animations: [
      { vue: 'droite', clip: 'repos', boucle: true, ips: 5, cadres: [{ page: 0, x: 0, y: 0, l: 100, h: 90, px: 50, py: 70 }] },
      { vue: 'droite', clip: 'tir', boucle: false, ips: 12, cadres: [{ page: 0, x: 104, y: 0, l: 100, h: 90, px: 50, py: 70 }] },
    ],
  };
}

function manifeste(e: EntreeSprite): ManifesteSprites {
  return composerManifeste([{ entree: e, cuisson: { version: 1, empreinte: '', date: '', secondes: 0, secondesRendu: 0, images: 0, imagesUniques: 0, octets: 0, canevas: {}, materiauxTeints: [], avertissements: [] } }]);
}

test('un manifeste bien formé ne présente aucun problème', () => {
  const m = manifeste(entree());
  assert.equal(m.version, VERSION_SPRITES);
  assert.equal(m.pixelsParCase, PIXELS_PAR_CASE);
  assert.equal(m.tangage, TANGAGE_CARTE);
  assert.equal(m.tangageProfil, TANGAGE_PROFIL);
  assert.deepEqual(problemesManifeste(m), []);
  assert.deepEqual(problemesManifeste(m, () => ({ largeur: 256, hauteur: 128 })), []);
});

test('la vérification voit une image hors de sa page, une page absente ou de la mauvaise taille', () => {
  const hors = entree();
  hors.animations[1]!.cadres[0]!.x = 200;
  assert.ok(problemesManifeste(manifeste(hors)).some((p) => p.includes('hors de sa page')));
  const sansPage = entree();
  sansPage.animations[0]!.cadres[0]!.page = 3;
  assert.ok(problemesManifeste(manifeste(sansPage)).some((p) => p.includes('page 3 absente')));
  assert.ok(problemesManifeste(manifeste(entree()), () => null).some((p) => p.includes('fichier absent')));
  assert.ok(problemesManifeste(manifeste(entree()), () => ({ largeur: 128, hauteur: 128 })).some((p) => p.includes('le manifeste dit')));
});

test('la vérification voit un chemin absolu, un doublon, un clip inconnu, une cadence nulle, un pivot perdu', () => {
  const absolu = entree();
  absolu.pages[0]!.couleur = '/assets/sprites/unites/x.webp';
  assert.ok(problemesManifeste(manifeste(absolu)).some((p) => p.includes('chemin de page')));
  const doublon = entree();
  doublon.animations[1]!.clip = 'repos';
  assert.ok(problemesManifeste(manifeste(doublon)).some((p) => p.includes('en double')));
  const inconnu = entree();
  (inconnu.animations[1] as { clip: string }).clip = 'danse';
  assert.ok(problemesManifeste(manifeste(inconnu)).some((p) => p.includes('clip danse')));
  const arrete = entree();
  arrete.animations[0]!.ips = 0;
  assert.ok(problemesManifeste(manifeste(arrete)).some((p) => p.includes('images par seconde')));
  const perdu = entree();
  perdu.animations[0]!.cadres[0]!.py = 5000;
  assert.ok(problemesManifeste(manifeste(perdu)).some((p) => p.includes('pivot')));
  const autreVersion = { ...manifeste(entree()), version: 2 } as unknown as ManifesteSprites;
  assert.ok(problemesManifeste(autreVersion).some((p) => p.includes('version')));
});

test('un état de bâtiment connu passe ; un état inconnu, ou posé sur une unité, est dit avant que le rendu l’écarte', () => {
  const batiment = (etat: string): EntreeSprite => ({
    ...entree(), id: `batiment_ville_${etat}`, famille: 'batiment', cle: 'ville', etat: etat as EntreeSprite['etat'],
  });
  assert.deepEqual(problemesManifeste(manifeste(batiment('desaffecte'))), []);
  assert.ok(problemesManifeste(manifeste(batiment('ruine'))).some((p) => p.includes('état ruine')));
  const unite = { ...entree(), etat: 'desaffecte' } as EntreeSprite;
  assert.ok(problemesManifeste(manifeste(unite)).some((p) => p.includes('état desaffecte')));
});
