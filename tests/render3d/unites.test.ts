import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerCatalogue } from '../../src/engine/index';
import { NIVEAU_EAU } from '../../src/render3d/geometrie';
import * as THREE from 'three';
import { TASSEMENT, creerUnites, geometriesSilhouette } from '../../src/render3d/unites';

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

// ---------------------------------------------------------------------------
// Une unité qui a joué se lit : gris, immobile, tassée, cadenas
// ---------------------------------------------------------------------------

/**
 * Un document minimal : un canevas dont le contexte **enregistre** les tracés.
 * On ne peut pas lire les pixels sous Node ; on peut vérifier ce qu'on y a
 * dessiné, et c'est ce que l'étiquette promet — un cadenas vectoriel, pas un
 * texte.
 */
function documentFactice(): { doc: Document; traces: string[] } {
  const traces: string[] = [];
  const contexte = new Proxy({}, {
    get: (_cible, nom: string) => (nom === 'canvas' ? undefined : (...args: unknown[]) => {
      traces.push(`${nom}${nom === 'fillText' ? `:${String(args[0])}` : ''}`);
    }),
    set: () => true,
  });
  const doc = {
    createElement: () => ({ width: 0, height: 0, getContext: () => contexte }),
  } as unknown as Document;
  return { doc, traces };
}

/** Les couleurs hexadécimales de tous les matériaux d'une pièce, par nom de maillage. */
function couleursDe(corps: { traverse(f: (o: unknown) => void): void }): Record<string, string> {
  const couleurs: Record<string, string> = {};
  corps.traverse((o) => {
    const m = o as { name?: string; material?: { color?: { getHexString(): string }; uuid: string } };
    if (m.material?.color) couleurs[m.name ?? ''] = `${m.material.color.getHexString()}@${m.material.uuid}`;
  });
  return couleurs;
}

function canaux(hex: string): [number, number, number] {
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function saturation(hex: string): number {
  const max = Math.max(...canaux(hex));
  const min = Math.min(...canaux(hex));
  return max === 0 ? 0 : (max - min) / max;
}

function luminance(hex: string): number {
  const [r, g, b] = canaux(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test('une unité qui a joué est ternie, puis retrouve exactement ses matériaux au réveil', () => {
  const prete = partiePersonnalisee(['....', '....'], {}, [
    { camp: 0, type: 'char_leger', x: 0, y: 0 },
    { camp: 1, type: 'char_leger', x: 3, y: 0 },
  ]);
  const { doc } = documentFactice();
  const calque = creerUnites(doc, () => 0);
  calque.maj(prete, cat, null);
  const [mien, sien] = calque.groupe.children as [THREE.Group, THREE.Group];
  const corpsMien = mien.getObjectByName('figurine_modele')!.parent!;
  const corpsSien = sien.getObjectByName('figurine_modele')!.parent!;
  const reposMien = couleursDe(corpsMien);
  const reposSien = couleursDe(corpsSien);
  assert.equal(mien.userData['agie'], false);

  // Les deux unités ont agi ; seule celle du camp courant (0) doit se ternir.
  const agies = {
    ...prete,
    unites: prete.unites.map((u) => ({ ...u, etat: 'agi' as const })),
  };
  calque.maj(agies, cat, null);
  assert.equal(mien.userData['agie'], true);
  assert.equal(sien.userData['agie'], false);
  assert.deepEqual(couleursDe(corpsSien), reposSien, 'l’adversaire garde ses matériaux');

  const ternies = couleursDe(corpsMien);
  const principal = ternies['silhouette_principal']!.split('@')[0]!;
  const reposPrincipal = reposMien['silhouette_principal']!.split('@')[0]!;
  assert.notEqual(principal, reposPrincipal, 'la teinte principale change');
  assert.ok(saturation(principal) < saturation(reposPrincipal) * 0.5, `désaturée (${principal} vs ${reposPrincipal})`);
  assert.ok(luminance(principal) < luminance(reposPrincipal) * 0.75, 'et nettement plus sombre');
  assert.equal(ternies['socle_lisere'], reposMien['socle_lisere'], 'le liseré d’équipe reste');
  // Les originaux n'ont pas été touchés : c'est un échange, pas une recoloration.
  assert.equal(reposMien['silhouette_principal']!.split('@')[0], reposPrincipal);

  // Un second passage ne recrée rien : même objet terni.
  calque.maj(agies, cat, null);
  assert.deepEqual(couleursDe(corpsMien), ternies);

  // Le réveil rend les objets mêmes, uuid compris.
  calque.maj(prete, cat, null);
  assert.equal(mien.userData['agie'], false);
  assert.deepEqual(couleursDe(corpsMien), reposMien, 'retour à l’identique');
  calque.dispose();
});

test('une unité qui a joué ne respire plus, ne tourne plus, et se tasse de quelques centièmes', () => {
  const prete = partiePersonnalisee(['....', '....'], {}, [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 0, type: 'helico', x: 1, y: 0 },
  ]);
  const { doc } = documentFactice();
  const calque = creerUnites(doc, () => 0);
  calque.maj(prete, cat, null);
  const modele = calque.groupe.children[0]!.getObjectByName('figurine_modele')!;
  const rotor = calque.groupe.getObjectByName('rotor_anime')!;
  calque.avancer(100);
  const angle = rotor.rotation.y;
  assert.notEqual(angle, 0);

  const agies = { ...prete, unites: prete.unites.map((u) => ({ ...u, etat: 'agi' as const })) };
  calque.maj(agies, cat, null);
  // Le tassement glisse : il continue d'animer tant qu'il n'est pas arrivé.
  assert.equal(calque.avancer(50), true);
  assert.ok(modele.position.y < 0 && modele.position.y > -TASSEMENT, 'en cours de tassement');
  assert.equal(rotor.rotation.y, angle, 'le rotor est arrêté');
  assert.equal(modele.rotation.z, 0, 'plus de respiration');
  for (let i = 0; i < 20; i += 1) calque.avancer(100);
  assert.equal(modele.position.y, -TASSEMENT, 'tassée, et pas plus');
  assert.equal(calque.avancer(100), false, 'plus rien à animer');

  // Sous réduction des animations, le réveil se fait d'un coup et rien ne bouge.
  calque.maj(prete, cat, null);
  assert.equal(calque.avancer(1, true), false);
  assert.equal(modele.position.y, 0);
  assert.equal(rotor.rotation.y, angle, 'le rotor ne tourne pas sous réduction');
  calque.dispose();
});

test('l’étiquette d’une unité qui a joué porte un cadenas dessiné, jamais un texte', () => {
  const prete = partiePersonnalisee(['....', '....'], {}, [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 0, type: 'infanterie', x: 1, y: 0 },
  ]);
  const { doc, traces } = documentFactice();
  const calque = creerUnites(doc, () => 0);
  calque.maj(prete, cat, null);
  const [intacte, blessee] = calque.groupe.children as [THREE.Group, THREE.Group];
  assert.equal(intacte.children.some((o) => o instanceof THREE.Sprite), false, 'intacte et prête : pas d’étiquette');

  const agies = {
    ...prete,
    unites: prete.unites.map((u, i) => ({ ...u, etat: 'agi' as const, pv: i === 0 ? u.pv : 47 })),
  };
  traces.length = 0;
  calque.maj(agies, cat, null);
  const spriteIntacte = intacte.children.find((o) => o instanceof THREE.Sprite) as THREE.Sprite;
  const spriteBlessee = blessee.children.find((o) => o instanceof THREE.Sprite) as THREE.Sprite;
  assert.ok(spriteIntacte, 'intacte mais a joué : une étiquette au seul cadenas');
  assert.ok(spriteBlessee);
  assert.ok(traces.includes('fillRect'), 'le corps du cadenas est un rectangle plein');
  assert.equal(traces.filter((t) => t.startsWith('fillText')).length, 1, 'un seul chiffre, celui des PV');
  assert.ok(traces.includes('fillText:5'));
  assert.ok(spriteBlessee.scale.x > spriteBlessee.scale.y, 'PV et cadenas : la pastille devient une gélule');
  assert.equal(spriteIntacte.scale.x, spriteIntacte.scale.y, 'cadenas seul : une pastille ronde');

  // Au réveil, l'unité intacte perd son étiquette et l'autre ne garde que le chiffre.
  const reveil = { ...agies, unites: agies.unites.map((u) => ({ ...u, etat: 'prete' as const })) };
  traces.length = 0;
  calque.maj(reveil, cat, null);
  assert.equal(intacte.children.some((o) => o instanceof THREE.Sprite), false);
  assert.equal(traces.includes('fillRect'), false, 'plus de cadenas');
  calque.dispose();
});
