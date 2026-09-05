import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerCatalogue } from '../../src/engine/index';
import { NIVEAU_EAU } from '../../src/render3d/geometrie';
import { creerUnites, geometriesSilhouette } from '../../src/render3d/unites';

import { partiePersonnalisee } from '../engine/aides';

const cat = chargerCatalogue();

test('les figurines détaillées partagent leur géométrie avec six matériaux au maximum', () => {
  for (const cle of cat.cles) {
    const silhouette = cat.unites[cle]!.silhouette;
    const geometries = geometriesSilhouette(silhouette);
    assert.equal(geometriesSilhouette(silhouette), geometries, `${cle} : cache partagé`);
    assert.ok(geometries.size <= 6 && geometries.size >= 3, `${cle} : draw calls bornés`);
    let triangles = 0;
    for (const geo of geometries.values()) {
      triangles += geo.getAttribute('position').count / 3;
      assert.ok(geo.boundingSphere && Number.isFinite(geo.boundingSphere.radius));
    }
    assert.ok(triangles < 6000, `${cle} : ${triangles} triangles dépassent le budget mobile`);
  }
});


test('les animations de repos font tourner les rotors et respirer les figurines sans déplacer les socles', () => {
  const etat = partiePersonnalisee(['....', '....'], {}, [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 0, type: 'helico', x: 1, y: 0 },
  ]);
  const calque = creerUnites({} as Document, () => 0);
  calque.maj(etat, cat, null);
  const soldat = calque.groupe.children[0]!;
  const modele = soldat.getObjectByName('figurine_modele')!;
  const socle = soldat.getObjectByName('socle')!;
  const rotor = calque.groupe.getObjectByName('rotor_anime')!;
  const positionSocle = socle.position.clone();
  const positionUnite = soldat.position.clone();
  assert.equal(calque.avancer(100), true);
  assert.notEqual(rotor.rotation.y, 0);
  assert.notEqual(modele.rotation.z, 0);
  assert.deepEqual(socle.position, positionSocle);
  assert.deepEqual(soldat.position, positionUnite);
  calque.dispose();
  assert.equal(calque.avancer(100), false);
});

// ---------------------------------------------------------------------------
// Les pièces reposent sur le sol, quel que soit le sol
// ---------------------------------------------------------------------------

/** L'inclinaison d'un objet par rapport à la verticale, en radians. */
function inclinaison(objet: { quaternion: { x: number; y: number; z: number; w: number } }): number {
  const { x, z } = objet.quaternion;
  // L'axe Y local, une fois tourné : son écart à (0,1,0) est l'inclinaison.
  const hy = 1 - 2 * (x * x + z * z);
  return Math.acos(Math.max(-1, Math.min(1, hy)));
}

test('sur un sol plat, une pièce reste d’aplomb', () => {
  const etat = partiePersonnalisee(['....', '....'], {}, [{ camp: 0, type: 'char_leger', x: 1, y: 0 }]);
  const calque = creerUnites({} as Document, () => 0.2);
  calque.maj(etat, cat, null);
  const piece = calque.groupe.children[0]!;
  assert.ok(inclinaison(piece) < 1e-6, 'aucune inclinaison sur un terrain plat');
  assert.ok(Math.abs(piece.position.y - 0.2) < 1e-6, 'elle se pose à l’altitude du sol');
  calque.dispose();
});

test('sur une pente, une pièce s’incline avec le sol, sans culbuter', () => {
  const etat = partiePersonnalisee(['....', '....'], {}, [{ camp: 0, type: 'char_leger', x: 1, y: 0 }]);
  // Une rampe franche : un dénivelé d'une demi-case par case.
  const calque = creerUnites({} as Document, (x) => x * 0.5);
  calque.maj(etat, cat, null);
  const piece = calque.groupe.children[0]!;
  const angle = inclinaison(piece);
  assert.ok(angle > 0.02, `la pièce doit suivre la pente (${angle.toFixed(3)} rad)`);
  assert.ok(angle <= 0.24, `mais rester debout (${angle.toFixed(3)} rad)`);
  calque.dispose();
});

test('une pièce ne coule pas sous le plan d’eau', () => {
  const etat = partiePersonnalisee(['....', '....'], {}, [{ camp: 0, type: 'char_leger', x: 1, y: 0 }]);
  // Le fond marin est à −0,40 ; le plan d'eau à −0,12.
  const calque = creerUnites({} as Document, () => -0.4);
  calque.maj(etat, cat, null);
  const piece = calque.groupe.children[0]!;
  assert.ok(piece.position.y > NIVEAU_EAU, 'une marée qui reprend une case ne noie pas la pièce');
  assert.ok(piece.position.y < NIVEAU_EAU + 0.05, 'elle patauge, elle ne lévite pas');
  calque.dispose();
});
