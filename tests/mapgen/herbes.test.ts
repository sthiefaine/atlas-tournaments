// Les hautes herbes (7 septembre 2026 au soir, `herbes.ts`) : une part de la
// plaine devient `herbe_haute`, en taches, après le bâti et les routes, avec la
// symétrie exacte de la carte et la cour du QG nue. Sans le paramètre, rien ne
// change ; avec, la carte « herbe remise en plaine » est la carte sans herbe.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { creerCadre, genererCarte, verifierCarte } from '../../src/mapgen/index';
import { validerMapDef } from '../../src/schemas/index';
import { CARACTERE_PAR_TERRAIN, SYMETRIES, type MapDef, type ParametresCarte, type Symetrie } from '../../src/schemas/types';

const base: ParametresCarte = {
  largeur: 20, hauteur: 14, camps: 2, biome: 'plaine', ratioMer: 0, ratioRelief: 0.18,
  villesParCamp: 3, villesNeutres: 2, usinesParCamp: 1, aeroportsParCamp: 1,
  symetrie: 'axe_vertical', densiteRoutes: 0.6,
};
const G = CARACTERE_PAR_TERRAIN.herbe_haute;
const P = CARACTERE_PAR_TERRAIN.plaine;
const QG = CARACTERE_PAR_TERRAIN.qg;
const GRAINES = [1, 2, 3, 4];

function cellules(carte: MapDef, car: string): { x: number; y: number }[] {
  const sortie: { x: number; y: number }[] = [];
  carte.grille.forEach((ligne, y) => {
    for (let x = 0; x < ligne.length; x += 1) if (ligne[x] === car) sortie.push({ x, y });
  });
  return sortie;
}

/** Les mêmes paramètres, carrés quand la symétrie l'exige. */
function avec(symetrie: Symetrie, ratio: number | undefined): ParametresCarte {
  const carre = symetrie === 'rotation_90';
  const p: ParametresCarte = { ...base, symetrie, hauteur: carre ? base.largeur : base.hauteur };
  return ratio === undefined ? p : { ...p, ratioHerbesHautes: ratio };
}

test('sans le paramètre, aucune herbe ne pousse et la carte est déterministe', () => {
  for (const graine of GRAINES) {
    const carte = genererCarte(base, graine);
    assert.equal(cellules(carte, G).length, 0, `graine ${graine}`);
    assert.deepEqual(genererCarte(base, graine).grille, carte.grille);
  }
});

test('avec un ratio, des taches symétriques sur la plaine, jamais dans la cour d’un QG, à la part demandée', () => {
  for (const symetrie of SYMETRIES) {
    for (const graine of GRAINES) {
      const p = avec(symetrie, 0.2);
      const carte = genererCarte(p, graine);
      const contexte = `${symetrie}/${graine}`;
      assert.ok(validerMapDef(carte).ok, `${contexte} : carte valide`);
      const herbes = cellules(carte, G);
      const plaines = cellules(carte, P);
      const part = herbes.length / Math.max(1, herbes.length + plaines.length);
      assert.ok(part >= 0.12 && part <= 0.3, `${contexte} : part d'herbe ${part.toFixed(3)}`);
      // La symétrie : l'image d'une herbe est une herbe.
      const cadre = creerCadre(symetrie, carte.camps, carte.largeur, carte.hauteur);
      for (const h of herbes) {
        for (const image of cadre.orbite(h.y * carte.largeur + h.x)) {
          const x = image % carte.largeur;
          const y = Math.floor(image / carte.largeur);
          assert.equal(carte.grille[y]?.[x], G, `${contexte} : l'image de (${h.x},${h.y}) en (${x},${y})`);
        }
      }
      // La cour du QG reste nue.
      for (const qg of cellules(carte, QG)) {
        for (const h of herbes) {
          assert.ok(Math.max(Math.abs(qg.x - h.x), Math.abs(qg.y - h.y)) >= 2, `${contexte} : herbe collée au QG`);
        }
      }
      assert.deepEqual(genererCarte(p, graine).grille, carte.grille, `${contexte} : déterminisme`);
      // La mesure de la campagne de contrôle dit la part réellement semée.
      const rapport = verifierCarte(carte);
      assert.equal(rapport.mesures['herbe_haute_part'], Number(part.toFixed(4)), `${contexte} : mesure`);
    }
  }
});

test('l’herbe ne remplace que de la plaine : remise en plaine, la carte est celle sans herbe', () => {
  for (const graine of GRAINES) {
    const sans = genererCarte(base, graine);
    const avecHerbe = genererCarte({ ...base, ratioHerbesHautes: 0.25 }, graine);
    assert.ok(cellules(avecHerbe, G).length > 0, `graine ${graine} : de l'herbe`);
    assert.deepEqual(avecHerbe.grille.map((l) => l.replaceAll(G, P)), sans.grille, `graine ${graine}`);
    assert.deepEqual(avecHerbe.proprietaires, sans.proprietaires);
    assert.deepEqual(avecHerbe.unitesDepart, sans.unitesDepart);
  }
});
