import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerCatalogue, creerPartie } from '../../src/engine/index';
import { NIVEAU_EAU } from '../../src/render3d/geometrie';
import * as THREE from 'three';
import { parametresAmbiance } from '../../src/render3d/eclairage';
import {
  conformerModele, couleurMasquee, definirMasque, masqueDe, NOM_FIGURINE, type ModeleCharge,
} from '../../src/render3d/modeles';
import {
  Materiaux, OPACITE_FURTIVE, OPACITE_JOUEE, OPACITE_VERRE, construirePlaceholder, creerUnites, geometriesSilhouette,
  materiauxPropresDe, type VisionRendu,
} from '../../src/render3d/unites';

import { partiePersonnalisee, scenePersonnalisee } from '../engine/aides';

const cat = chargerCatalogue();

/** Laisse passer la promesse d'un chargeur de test : un tour de boucle suffit. */
function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

/**
 * Un modèle de test construit en mémoire : un nœud `corps` (une boîte de 0,5 de
 * haut, l'avant en +Z), un nœud `module_tourelle`, et des clips d'une seconde
 * qui font tourner la tourelle d'un angle à un autre — par défaut `repos` à
 * peine, `deplacement` franchement.
 */
function modeleTest(
  clips: Record<string, [number, number]> = { repos: [0, 0.1], deplacement: [0, 1] },
): ModeleCharge {
  const scene = new THREE.Group();
  const geo = new THREE.BoxGeometry(0.6, 0.5, 0.8);
  geo.translate(0, 0.25, 0);
  const corps = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ name: 'mat_corps' }));
  corps.name = 'corps';
  const tourelle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), new THREE.MeshStandardMaterial({ name: 'mat_details' }));
  tourelle.name = 'module_tourelle';
  tourelle.position.y = 0.5;
  scene.add(corps, tourelle);
  return conformerModele({
    niveaux: [scene],
    clips: Object.entries(clips).map(([nom, [de, vers]]) => new THREE.AnimationClip(nom, 1, [
      new THREE.NumberKeyframeTrack('module_tourelle.rotation[y]', [0, 1], [de, vers]),
    ])),
    kit: false,
  });
}

test('les figurines détaillées partagent leur géométrie avec sept matériaux au maximum', () => {
  for (const cle of cat.cles) {
    const silhouette = cat.unites[cle]!.silhouette;
    const geometries = geometriesSilhouette(silhouette);
    assert.equal(geometriesSilhouette(silhouette), geometries, `${cle} : cache partagé`);
    // Sept rôles, dont la peau des figurines : c'est la borne des draw calls d'une unité.
    assert.ok(geometries.size <= 7 && geometries.size >= 3, `${cle} : draw calls bornés`);
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
// Une unité qui a joué se lit : translucide, sans ombre, immobile, cadenas
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

test('une unité qui a joué s’efface en transparence, sans ombre, puis retrouve exactement ses matériaux au réveil', () => {
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
  const principale = corpsMien.getObjectByName('silhouette_principal') as THREE.Mesh;
  const verre = corpsMien.getObjectByName('silhouette_verre') as THREE.Mesh;
  assert.ok(verre, 'le char léger a une cabine : c’est le cas qui compte pour le tri de profondeur');
  const ombres = new Map<string, boolean>();
  corpsMien.traverse((o) => { if (o instanceof THREE.Mesh) ombres.set(o.name, o.castShadow); });
  assert.equal(ombres.get('silhouette_principal'), true);
  assert.equal(ombres.get('silhouette_verre'), false, 'le verre ne portait déjà pas d’ombre');
  assert.equal(mien.userData['agie'], false);

  // Les deux unités ont agi ; seule celle du camp courant (0) doit s'effacer.
  const agies = {
    ...prete,
    unites: prete.unites.map((u) => ({ ...u, etat: 'agi' as const })),
  };
  calque.maj(agies, cat, null);
  assert.equal(mien.userData['agie'], true);
  assert.equal(sien.userData['agie'], false);
  assert.deepEqual(couleursDe(corpsSien), reposSien, 'l’adversaire garde ses matériaux');

  const ternies = couleursDe(corpsMien);
  const [teinte, uuidTerni] = ternies['silhouette_principal']!.split('@');
  const [teinteRepos, uuidRepos] = reposMien['silhouette_principal']!.split('@');
  assert.equal(teinte, teinteRepos, 'la teinte ne change pas : ni gris, ni noir');
  assert.notEqual(uuidTerni, uuidRepos, 'mais le matériau porté est un double');
  const terni = principale.material as THREE.MeshStandardMaterial;
  const vif = principale.userData['repos'] as THREE.MeshStandardMaterial;
  assert.equal(terni.transparent, true);
  assert.equal(terni.opacity, OPACITE_JOUEE, 'six dixièmes');
  assert.equal(terni.depthWrite, true, 'une figurine convexe écrit sa profondeur, comme le verre');
  assert.equal(terni.roughness, vif.roughness, 'même matière');
  assert.equal(terni.metalness, vif.metalness);
  assert.equal(terni.emissiveIntensity, vif.emissiveIntensity);
  assert.equal((verre.material as THREE.MeshStandardMaterial).opacity, OPACITE_VERRE, 'le verre garde son opacité propre, déjà plus basse');
  corpsMien.traverse((o) => {
    if (o instanceof THREE.Mesh && o.name !== 'socle_lisere') assert.equal(o.castShadow, false, `${o.name} : la masse trahirait la transparence`);
  });
  assert.equal(ternies['socle_lisere'], reposMien['socle_lisere'], 'le liseré d’équipe reste');
  const lisere = (corpsMien.getObjectByName('socle_lisere') as THREE.Mesh).material as THREE.MeshStandardMaterial;
  assert.equal(lisere.transparent, false, 'et reste opaque');
  // Les originaux n'ont pas été touchés : c'est un échange, pas une recoloration.
  assert.equal(vif.transparent, false);
  assert.equal(reposMien['silhouette_principal']!.split('@')[0], teinteRepos);

  // Un second passage ne recrée rien : même objet terni.
  calque.maj(agies, cat, null);
  assert.deepEqual(couleursDe(corpsMien), ternies);

  // Le réveil rend les objets mêmes, uuid compris, et leur ombre telle qu'elle était.
  calque.maj(prete, cat, null);
  assert.equal(mien.userData['agie'], false);
  assert.deepEqual(couleursDe(corpsMien), reposMien, 'retour à l’identique');
  corpsMien.traverse((o) => {
    if (o instanceof THREE.Mesh) assert.equal(o.castShadow, ombres.get(o.name), `${o.name} : ombre rendue`);
  });
  calque.dispose();
});

test('une unité qui a joué ne respire plus, ne tourne plus, et ne se tasse pas', () => {
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
  assert.notEqual(modele.rotation.z, 0, 'au repos, la figurine respire');

  const agies = { ...prete, unites: prete.unites.map((u) => ({ ...u, etat: 'agi' as const })) };
  calque.maj(agies, cat, null);
  assert.equal(modele.rotation.z, 0, 'plus de respiration');
  assert.equal(modele.position.y, 0, 'la figurine reste posée sur son socle : plus de tassement');
  assert.equal(calque.avancer(100), false, 'plus rien à animer, tout de suite');
  assert.equal(rotor.rotation.y, angle, 'le rotor est arrêté');
  assert.equal(modele.position.y, 0);

  // Le réveil, sous réduction des animations : rien ne bouge non plus.
  calque.maj(prete, cat, null);
  assert.equal(calque.avancer(1, true), false);
  assert.equal(modele.position.y, 0);
  assert.equal(rotor.rotation.y, angle, 'le rotor ne tourne pas sous réduction');
  calque.dispose();
});

test('le double terni d’un modèle masqué garde le masque, la couleur d’équipe telle quelle, et perd son ombre', async () => {
  const etat = partiePersonnalisee(['....', '....'], {}, [{ camp: 0, type: 'char_leger', x: 1, y: 0 }]);
  const masque = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const scene = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ name: 'mat_corps' });
  definirMasque(mat, masque);
  const corps = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.8), mat);
  corps.name = 'corps';
  scene.add(corps);
  const modele = conformerModele({ niveaux: [scene], clips: [], kit: false });
  const { doc } = documentFactice();
  const calque = creerUnites(doc, () => 0, { chargeur: async () => modele });
  calque.maj(etat, cat, null);
  await tick();
  const maille = calque.groupe.getObjectByName('corps') as THREE.Mesh;
  const vif = maille.material as THREE.MeshStandardMaterial;
  const couleur = couleurMasquee(vif);
  assert.ok(couleur, 'le clone teinté mélange la couleur d’équipe par son masque');
  assert.equal(maille.castShadow, true);

  const agie = { ...etat, unites: etat.unites.map((u) => ({ ...u, etat: 'agi' as const })) };
  calque.maj(agie, cat, null);
  const terni = maille.material as THREE.MeshStandardMaterial;
  assert.notEqual(terni, vif);
  assert.equal(terni.opacity, OPACITE_JOUEE);
  assert.equal(masqueDe(terni), masque, 'le masque est rendu au double');
  const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: '', fragmentShader: '#include <common>\n#include <map_fragment>' };
  terni.onBeforeCompile(shader as never, {} as never);
  assert.equal(
    (shader.uniforms['atlasCouleurEquipe']?.value as THREE.Color).getHexString(), couleur.getHexString(),
    'la couleur d’équipe n’est pas ternie : seule l’opacité dit qu’elle a joué',
  );
  assert.equal(maille.castShadow, false);

  calque.maj(etat, cat, null);
  assert.equal(maille.material, vif, 'au réveil, l’objet même');
  assert.equal(maille.castShadow, true);
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

// ---------------------------------------------------------------------------
// Un modèle livré remplace le placeholder et joue ses clips
// ---------------------------------------------------------------------------

test('un modèle livré prend la place du placeholder, sur le même socle à liseré, à sa hauteur', async () => {
  const etat = partiePersonnalisee(['....', '....'], {}, [{ camp: 0, type: 'char_leger', x: 1, y: 0 }]);
  const id = etat.unites[0]!.id;
  const modele = modeleTest({});
  const calque = creerUnites({} as Document, () => 0, { chargeur: async () => modele });
  calque.maj(etat, cat, null);
  const piece = calque.groupe.children[0]!;
  assert.ok(piece.getObjectByName('silhouette_principal'), 'le placeholder d’abord');
  assert.equal(calque.clipJoue(id), null);
  await tick();
  assert.equal(piece.getObjectByName('silhouette_principal'), undefined, 'le placeholder a cédé la place');
  assert.ok(piece.getObjectByName('socle_lisere'), 'le liseré d’équipe est dessiné par le rendu, sous le modèle');
  assert.ok(piece.getObjectByName('socle'));
  const figurine = piece.getObjectByName(NOM_FIGURINE)!;
  assert.ok(figurine.getObjectByName('module_tourelle'), 'les nœuds du fichier sont là, par leur nom');
  assert.notEqual(figurine, modele.objet, 'chaque unité reçoit son clone');
  assert.ok(Math.abs(calque.sommetDe(id) - 0.55) < 1e-6, `l’étiquette s’accroche au sommet du modèle (${calque.sommetDe(id)})`);
  assert.equal(calque.clipJoue(id), null, 'sans clip, pas de lecteur');
  assert.equal(calque.avancer(100), false, 'et rien à animer');
  calque.dispose();
});

test('le mixer joue repos par défaut, suit le clip demandé, retombe sur repos pour un clip absent', async () => {
  const etat = partiePersonnalisee(['....', '....'], {}, [{ camp: 0, type: 'char_leger', x: 1, y: 0 }]);
  const id = etat.unites[0]!.id;
  const calque = creerUnites({} as Document, () => 0, { chargeur: async () => modeleTest() });
  calque.maj(etat, cat, null);
  await tick();
  const tourelle = calque.groupe.getObjectByName('module_tourelle')!;
  assert.equal(calque.clipJoue(id), 'repos');
  // Un pas est plafonné à 100 ms : cinq pas font la demi-seconde.
  for (let i = 0; i < 5; i += 1) assert.equal(calque.avancer(100), true, 'un mixer qui joue tient la boucle éveillée');
  assert.ok(Math.abs(tourelle.rotation.y - 0.05) < 1e-6, `repos à mi-course : ${tourelle.rotation.y}`);

  calque.visuel(id).clip = 'deplacement';
  calque.avancer(100);
  assert.equal(calque.clipJoue(id), 'deplacement');
  // Passé le fondu de 150 ms, la marche seule pèse : la tourelle tourne franchement.
  calque.avancer(100);
  calque.avancer(100);
  calque.avancer(100);
  assert.ok(tourelle.rotation.y > 0.3, `la marche a pris la main : ${tourelle.rotation.y}`);

  calque.visuel(id).clip = 'tir';
  calque.avancer(16);
  assert.equal(calque.clipJoue(id), 'repos', 'un clip absent retombe sur repos, sans erreur');
  calque.dispose();
  assert.equal(calque.avancer(100), false);
});

test('sous réduction des animations, le mixer n’avance pas mais saute à la première image du clip demandé', async () => {
  const etat = partiePersonnalisee(['....', '....'], {}, [{ camp: 0, type: 'char_leger', x: 1, y: 0 }]);
  const id = etat.unites[0]!.id;
  const { doc } = documentFactice();
  const calque = creerUnites(doc, () => 0, { chargeur: async () => modeleTest({ repos: [0, 0.1], deplacement: [0.3, 1] }) });
  calque.maj(etat, cat, null);
  await tick();
  const tourelle = calque.groupe.getObjectByName('module_tourelle')!;
  calque.avancer(100);
  const angle = tourelle.rotation.y;
  assert.notEqual(angle, 0);
  assert.equal(calque.avancer(200, true), false, 'rien n’anime sous réduction');
  assert.equal(tourelle.rotation.y, angle, 'la pose ne bouge pas');
  calque.visuel(id).clip = 'deplacement';
  assert.equal(calque.avancer(200, true), false);
  assert.equal(calque.clipJoue(id), 'deplacement', 'la demande est tenue à jour : l’état reste juste');
  assert.ok(Math.abs(tourelle.rotation.y - 0.3) < 1e-6, `et la pose est la première image de la marche : ${tourelle.rotation.y}`);

  // Une unité qui a joué ne respire plus, même avec un modèle livré ; mais un
  // geste demandé se joue encore.
  calque.visuel(id).clip = 'repos';
  const agie = { ...etat, unites: etat.unites.map((u) => ({ ...u, etat: 'agi' as const })) };
  calque.maj(agie, cat, null);
  for (let i = 0; i < 20; i += 1) calque.avancer(100);
  const fige = tourelle.rotation.y;
  assert.equal(calque.avancer(100), false, 'plus rien à animer : le repos est figé');
  assert.equal(tourelle.rotation.y, fige);
  calque.visuel(id).clip = 'deplacement';
  assert.equal(calque.avancer(100), true, 'un geste demandé se joue même sur une unité qui a joué');
  calque.dispose();
});

test('un rig sous réduction dès la première image prend la pose du repos, pas celle de liaison', async () => {
  const etat = partiePersonnalisee(['....', '....'], {}, [{ camp: 0, type: 'char_leger', x: 1, y: 0 }]);
  const calque = creerUnites({} as Document, () => 0, { chargeur: async () => modeleTest({ repos: [0.2, 0.2] }) });
  calque.maj(etat, cat, null);
  await tick();
  const tourelle = calque.groupe.getObjectByName('module_tourelle')!;
  for (let i = 0; i < 30; i += 1) calque.avancer(16, true);
  assert.ok(Math.abs(tourelle.rotation.y - 0.2) < 1e-6, `la première image du repos (${tourelle.rotation.y}), jamais la pose de liaison (0)`);
  calque.dispose();
});

test('une unité qui a joué finit son fondu vers le repos avant de se figer', async () => {
  const etat = partiePersonnalisee(['....', '....'], {}, [{ camp: 0, type: 'char_leger', x: 1, y: 0 }]);
  const id = etat.unites[0]!.id;
  const { doc } = documentFactice();
  const calque = creerUnites(doc, () => 0, { chargeur: async () => modeleTest({ repos: [0.2, 0.2], tir: [0, 1] }) });
  // L'état est en avance : l'attaquant a déjà joué quand son tir s'anime.
  const agie = { ...etat, unites: etat.unites.map((u) => ({ ...u, etat: 'agi' as const })) };
  calque.maj(agie, cat, null);
  await tick();
  const tourelle = calque.groupe.getObjectByName('module_tourelle')!;
  assert.ok(Math.abs(tourelle.rotation.y - 0.2) < 1e-6, 'au repos, figée sur sa première image');
  assert.equal(calque.avancer(100), false, 'figée : rien à animer');

  const v = calque.visuel(id);
  v.clip = 'tir';
  v.clipDuree = 260;
  assert.equal(calque.avancer(100), true, 'le tir se joue même sur une unité qui a joué');
  for (let i = 0; i < 2; i += 1) calque.avancer(100);
  assert.equal(calque.clipJoue(id), 'repos', 'le tir fini rend la main au repos');
  assert.ok(tourelle.rotation.y > 0.5, `au début du fondu, la dernière image du tir pèse encore (${tourelle.rotation.y})`);
  // Le geste est fini côté animations : repos demandé. Le fondu doit aller au bout.
  v.clip = 'repos';
  v.clipDuree = 0;
  for (let i = 0; i < 10; i += 1) calque.avancer(100);
  assert.ok(Math.abs(tourelle.rotation.y - 0.2) < 1e-6, `figée au repos (${tourelle.rotation.y}), pas sur la dernière image du tir`);
  assert.equal(calque.avancer(100), false, 'et plus rien à animer');
  calque.dispose();
});

test('retirer une unité à modèle livré libère ses matériaux teintés et leurs doubles ternis', async () => {
  const etat = partiePersonnalisee(['....', '....'], {}, [{ camp: 0, type: 'char_leger', x: 1, y: 0 }]);
  const { doc } = documentFactice();
  const calque = creerUnites(doc, () => 0, { chargeur: async () => modeleTest({}) });
  calque.maj(etat, cat, null);
  await tick();
  const piece = calque.groupe.children[0]!;
  const corps = piece.getObjectByName(NOM_FIGURINE)!.parent!;
  const propres = materiauxPropresDe(corps);
  assert.equal(propres.length, 2, 'mat_corps et mat_details ont été clonés pour cette unité');
  // L'unité joue : ses clones reçoivent un double terni.
  const agie = { ...etat, unites: etat.unites.map((u) => ({ ...u, etat: 'agi' as const })) };
  calque.maj(agie, cat, null);
  const maille = piece.getObjectByName('corps') as THREE.Mesh;
  const terni = maille.material as THREE.Material;
  assert.ok(propres.includes(maille.userData['repos'] as THREE.MeshStandardMaterial), 'le matériau de repos est le clone');
  assert.notEqual(terni, maille.userData['repos'], 'le matériau porté est le terni');
  const liberes: string[] = [];
  for (const m of [...propres, terni]) {
    const original = m.dispose.bind(m);
    m.dispose = () => { liberes.push(m.uuid); original(); };
  }

  calque.maj({ ...etat, unites: [] }, cat, null);
  assert.equal(calque.groupe.children.length, 0);
  for (const m of propres) assert.ok(liberes.includes(m.uuid), 'chaque clone teinté est libéré');
  assert.ok(liberes.includes(terni.uuid), 'et son double terni avec lui');
  assert.equal(materiauxPropresDe(corps).length, 0);
  calque.dispose();
});

test('Materiaux.oublier rend un terni et retire son entrée ; un placeholder n’en a pas à rendre', () => {
  const materiaux = new Materiaux();
  const origine = new THREE.MeshStandardMaterial({ color: 0x2f5fd0 });
  const terni = materiaux.terni(origine);
  assert.equal(materiaux.terni(origine), terni, 'mémorisé');
  assert.equal(materiaux.oublier(origine), true);
  assert.notEqual(materiaux.terni(origine), terni, 'l’entrée a disparu : un nouveau double');
  assert.equal(materiaux.oublier(new THREE.MeshStandardMaterial()), false, 'rien à oublier');
  const etat = partiePersonnalisee(['....', '....'], {}, [{ camp: 0, type: 'char_leger', x: 1, y: 0 }]);
  const calque = creerUnites({} as Document, () => 0);
  calque.maj(etat, cat, null);
  assert.equal(materiauxPropresDe(calque.groupe.children[0]!.children[0]!).length, 0, 'un placeholder ne possède aucun matériau');
  calque.dispose();
  materiaux.dispose();
});

test('un modèle arrivé après le retrait de l’unité ne s’installe pas', async () => {
  const etat = partiePersonnalisee(['....', '....'], {}, [{ camp: 0, type: 'char_leger', x: 1, y: 0 }]);
  let resoudre: ((m: ModeleCharge | null) => void) | null = null;
  const calque = creerUnites({} as Document, () => 0, {
    chargeur: () => new Promise<ModeleCharge | null>((r) => { resoudre = r; }),
  });
  calque.maj(etat, cat, null);
  const piece = calque.groupe.children[0]!;
  calque.maj({ ...etat, unites: [] }, cat, null);
  assert.equal(calque.groupe.children.length, 0);
  resoudre!(modeleTest());
  await tick();
  assert.ok(piece.getObjectByName('silhouette_principal'), 'la pièce retirée garde son placeholder, rien n’a été monté');
  assert.equal(calque.groupe.children.length, 0);
  calque.dispose();
});

// ---------------------------------------------------------------------------
// Les matières par rôle : chaque pièce est en quelque chose
// ---------------------------------------------------------------------------

const ROLES = ['principal', 'sombre', 'clair', 'materiel', 'verre', 'roulant', 'peau'] as const;

test('les sept rôles sont des matières : tôle peinte, acier, verre translucide, caoutchouc, peau mate', () => {
  const materiaux = new Materiaux();
  const jeu = materiaux.jeu(0, null);
  for (const role of ROLES) assert.ok(jeu[role] instanceof THREE.MeshStandardMaterial, role);
  // La tôle peinte : un métal faible mais non nul, une rugosité moyenne.
  for (const role of ['principal', 'sombre', 'clair'] as const) {
    assert.ok(jeu[role].metalness >= 0.05 && jeu[role].metalness <= 0.35, `${role} : métal de tôle peinte (${jeu[role].metalness})`);
    assert.ok(jeu[role].roughness >= 0.35 && jeu[role].roughness <= 0.7, `${role} : rugosité de tôle peinte (${jeu[role].roughness})`);
  }
  // L'émission compensait l'absence d'environnement : il n'en reste qu'un
  // souffle, hors verre — et tout ce qui n'est pas verre est opaque.
  for (const role of ROLES) {
    if (role === 'verre') continue;
    assert.ok(jeu[role].emissiveIntensity <= 0.05, `${role} émet ${jeu[role].emissiveIntensity}`);
    assert.equal(jeu[role].transparent, false, `${role} est opaque`);
  }
  assert.ok(jeu.principal.emissiveIntensity > 0, 'un souffle de sa couleur, pour la nuit');
  assert.equal(jeu.principal.emissive.getHex(), jeu.principal.color.getHex(), 'de sa propre couleur');
  assert.ok(jeu.materiel.metalness >= 0.6, 'l’acier est un métal');
  const verre = jeu.verre;
  assert.equal(verre.transparent, true, 'le verre est translucide');
  assert.ok(verre.opacity > 0.3 && verre.opacity < 0.8, `verre à ${verre.opacity}`);
  assert.equal(verre.opacity, OPACITE_VERRE);
  assert.ok(verre.roughness < 0.2, 'le verre est presque lisse');
  assert.ok(verre.metalness < 0.2, 'et diélectrique');
  assert.equal(verre.depthWrite, true, 'une cabine écrit sa profondeur');
  assert.ok(verre.emissiveIntensity <= 0.25, 'une lueur de cabine, pas un néon');
  assert.ok(jeu.roulant.roughness >= 0.8, 'du caoutchouc, mat');
  assert.equal(jeu.roulant.metalness, 0);
  assert.equal(jeu.peau.metalness, 0, 'une peau sans métal');
  assert.ok(jeu.peau.roughness >= 0.6, 'et mate');
  // Le jeu est mémorisé : même camp, mêmes objets.
  assert.equal(materiaux.jeu(0, null), jeu);
  materiaux.dispose();
});

test('la pluie mouille la tôle, l’acier et le caoutchouc par jeu de matériaux, et sèche à l’identique', () => {
  const materiaux = new Materiaux();
  const jeu = materiaux.jeu(1, null);
  const terni = materiaux.terni(jeu.principal);
  const sec = Object.fromEntries(ROLES.map((r) => [r, jeu[r].roughness])) as Record<typeof ROLES[number], number>;
  const terniSec = terni.roughness;
  assert.equal(terniSec, sec.principal, 'une pièce ternie garde la matière de sa vive : seule l’opacité change');

  materiaux.mouiller(1);
  for (const role of ['principal', 'sombre', 'clair', 'materiel', 'roulant'] as const) {
    assert.ok(jeu[role].roughness < sec[role] - 0.2, `${role} luit sous la pluie (${jeu[role].roughness} contre ${sec[role]})`);
    assert.ok(jeu[role].roughness > 0, `${role} ne devient pas un miroir`);
  }
  assert.equal(jeu.verre.roughness, sec.verre, 'le verre est déjà lisse');
  assert.equal(jeu.peau.roughness, sec.peau, 'une figurine peinte ne brille pas sous l’eau');
  assert.ok(terni.roughness < terniSec, 'le double terni suit son original');
  assert.equal(terni.roughness, jeu.principal.roughness, 'à l’identique');
  // Un jeu créé sous la pluie naît mouillé : l'humidité est celle de la scène, pas du moment de la création.
  const autre = materiaux.jeu(0, null);
  assert.ok(autre.principal.roughness < sec.principal - 0.2);
  assert.equal(autre.principal.roughness, jeu.principal.roughness);

  // Le retour au sec rend exactement les nombres de départ, sur les mêmes objets.
  materiaux.mouiller(0);
  for (const role of ROLES) assert.equal(jeu[role].roughness, sec[role], `${role} sèche à l’identique`);
  assert.equal(terni.roughness, terniSec);
  assert.equal(materiaux.jeu(1, null), jeu, 'mouiller ne recrée rien');
  assert.equal(materiaux.terni(jeu.principal), terni);
  // Hors bornes, l'humidité est bornée : une pluie à 200 % est une pluie.
  materiaux.mouiller(2);
  const plein = jeu.principal.roughness;
  materiaux.mouiller(1);
  assert.equal(jeu.principal.roughness, plein);
  materiaux.dispose();
});

test('le verre d’un placeholder ne projette pas d’ombre pleine, et les repères du socle restent opaques', () => {
  const materiaux = new Materiaux();
  let vues = 0;
  for (const cle of cat.cles) {
    const s = cat.unites[cle]!.silhouette;
    if (!geometriesSilhouette(s).has('verre')) continue;
    vues += 1;
    const piece = construirePlaceholder(s, 1, materiaux, null, cle);
    const verre = piece.getObjectByName('silhouette_verre') as THREE.Mesh;
    assert.equal(verre.castShadow, false, `${cle} : une ombre pleine sous une cabine trahirait sa transparence`);
    assert.equal(verre.receiveShadow, true);
    assert.equal((piece.getObjectByName('silhouette_principal') as THREE.Mesh).castShadow, true, 'la caisse porte son ombre');
    // Deux encoches pour le camp 1 : un marquage opaque, pas un vitrage qui
    // prendrait la couleur de l'anneau sous lui.
    for (let i = 0; i < 2; i += 1) {
      const repere = piece.getObjectByName(`socle_repere_${i}`) as THREE.Mesh;
      assert.ok(repere, `${cle} : repère ${i}`);
      const m = repere.material as THREE.MeshStandardMaterial;
      assert.equal(m.transparent, false, 'un marquage, pas un vitrage');
      assert.notEqual(m, materiaux.jeu(1, null).verre);
      assert.equal(m, materiaux.repere(), 'la même pastille pour tous');
    }
  }
  assert.ok(vues > 0, 'au moins une silhouette du catalogue porte du verre');
  materiaux.dispose();
});

test('le calque des unités reçoit l’ambiance : sous la pluie, ses tôles luisent, puis sèchent', () => {
  const etat = partiePersonnalisee(['....', '....'], {}, [{ camp: 0, type: 'char_leger', x: 0, y: 0 }]);
  const calque = creerUnites({} as Document, () => 0);
  calque.maj(etat, cat, null);
  const principal = calque.groupe.getObjectByName('silhouette_principal') as THREE.Mesh;
  const m = principal.material as THREE.MeshStandardMaterial;
  calque.appliquerAmbiance(parametresAmbiance('ete', 'jour', 'clair'));
  const sec = m.roughness;
  calque.appliquerAmbiance(parametresAmbiance('automne', 'jour', 'pluie'));
  assert.ok(m.roughness < sec, 'la pluie mouille la tôle');
  assert.equal(principal.material, m, 'sur le même matériau : rien n’est recréé par unité');
  calque.appliquerAmbiance(parametresAmbiance('ete', 'jour', 'clair'));
  assert.equal(m.roughness, sec, 'le beau temps sèche à l’identique');
  calque.dispose();
});

// ---------------------------------------------------------------------------
// Une vue qui ne change rien ne repose rien ; le sol qui bouge repose tout
// ---------------------------------------------------------------------------

test('deux maj sur le même état ne reposent pas les unités, et le disent', () => {
  const etat = partiePersonnalisee(['....', '....'], {}, [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'char_leger', x: 2, y: 1 },
  ]);
  let lectures = 0;
  const calque = creerUnites({} as Document, () => { lectures += 1; return 0.1; });
  assert.equal(calque.maj(etat, cat, null), true, 'la première pose change la scène');
  assert.ok(lectures > 0);
  lectures = 0;
  // Un survol : même état, même vue des unités. Pas une lecture du relief.
  assert.equal(calque.maj(etat, cat, null), false);
  assert.equal(calque.maj(etat, cat, new Set(['0,0', '2,1'])), false, 'une visibilité neuve mais égale ne change rien');
  assert.equal(lectures, 0, 'aucune unité reposée');

  // Une unité qui change de case dans l'état est reposée, elle seule.
  const bougee = { ...etat, unites: etat.unites.map((u) => (u.id === etat.unites[0]!.id ? { ...u, x: 1 } : u)) };
  assert.equal(calque.maj(bougee, cat, null), true);
  assert.equal(lectures, 5, 'cinq lectures du relief : une seule pose');
  assert.ok(Math.abs(calque.positionDe(etat.unites[0]!.id)!.x - 1.5) < 1e-9);

  // L'état visuel — la prise des animations — compte autant que l'état.
  lectures = 0;
  const v = calque.visuel(etat.unites[1]!.id);
  v.dx = 0.3;
  assert.equal(calque.maj(bougee, cat, null), true, 'un glissement d’animation repose l’unité');
  assert.equal(lectures, 5);
  assert.ok(Math.abs(calque.positionDe(etat.unites[1]!.id)!.x - 2.8) < 1e-9);

  // Une unité qui disparaît ou qui entre dans la vue change la scène aussi.
  assert.equal(calque.maj(bougee, cat, new Set(['1,0'])), true, 'le char sort du brouillard');
  assert.equal(calque.groupe.children.length, 1);
  assert.equal(calque.maj(bougee, cat, new Set(['1,0'])), false);
  assert.equal(calque.maj(bougee, cat, null), true, 'il y rentre');
  calque.dispose();
});

test('ce qui repose sur le sol se repose avec lui : une mutation de terrain repose les unités', () => {
  const etat = partiePersonnalisee(['....', '....'], {}, [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'char_leger', x: 2, y: 1 },
  ]);
  let sol = 0.3;
  const calque = creerUnites({} as Document, () => sol);
  calque.maj(etat, cat, null);
  const [soldat, char] = calque.groupe.children as [THREE.Object3D, THREE.Object3D];
  assert.ok(Math.abs(soldat.position.y - 0.3) < 1e-9);

  // La marée descend. Une vue de plus ne suffit pas : l'état n'a pas changé,
  // et une unité ne sait pas que le sol a bougé sous elle…
  sol = -0.05;
  calque.maj(etat, cat, null);
  assert.ok(Math.abs(soldat.position.y - 0.3) < 1e-9, 'un survol ne repose pas');
  // …c'est le relief qui le lui dit.
  calque.majRelief();
  assert.ok(Math.abs(soldat.position.y + 0.05) < 1e-9, 'reposée sur le sol descendu');
  assert.ok(Math.abs(char.position.y + 0.05) < 1e-9);

  // Pendant une mutation annoncée, les unités suivent le sol image par image,
  // puis se posent une dernière fois sur sa position finale.
  calque.suivreSol(100);
  sol = 0.1;
  assert.equal(calque.avancer(40), true);
  assert.ok(Math.abs(soldat.position.y - 0.1) < 1e-9, 'suit le sol à la première image');
  sol = 0.2;
  calque.avancer(40);
  assert.ok(Math.abs(soldat.position.y - 0.2) < 1e-9);
  sol = 0.25;
  calque.avancer(40);
  assert.ok(Math.abs(soldat.position.y - 0.25) < 1e-9, 'la dernière image pose sur la position finale');
  sol = 0.9;
  calque.avancer(40);
  assert.ok(Math.abs(soldat.position.y - 0.25) < 1e-9, 'le sol s’est arrêté : plus de repose par image');
  // Une pose d'animation reprend le sol courant, comme toujours.
  calque.visuel(etat.unites[0]!.id).dx = 0.1;
  calque.maj(etat, cat, null);
  assert.ok(Math.abs(soldat.position.y - 0.9) < 1e-9);
  calque.dispose();
});

// ---------------------------------------------------------------------------
// Catalogue 6 : le voile de la furtivité, et ce que le joueur voit
// ---------------------------------------------------------------------------

const cat6 = chargerCatalogue(6);

/** Deux chasseurs furtifs au contact, un par camp, sur une plaine. */
function partieFurtive(): ReturnType<typeof partiePersonnalisee> {
  return creerPartie(scenePersonnalisee(['PPPP', 'PPPP'], {}, [
    { camp: 0, type: 'furtif', x: 0, y: 0 },
    { camp: 1, type: 'furtif', x: 1, y: 0 },
  ]), cat6, 'test');
}

/** Le matériau principal d'une pièce, et l'ombre de son maillage. */
function principale(piece: THREE.Object3D): { materiau: THREE.MeshStandardMaterial; ombre: boolean } {
  const maille = piece.getObjectByName('silhouette_principal') as THREE.Mesh;
  assert.ok(maille, 'la silhouette a une pièce principale');
  return { materiau: maille.material as THREE.MeshStandardMaterial, ombre: maille.castShadow };
}

test('une furtive du joueur se voile sans ombre, jouée en plus elle prend la plus faible opacité, et l’adversaire au contact la voit entière', () => {
  const prete = partieFurtive();
  const { doc } = documentFactice();
  const calque = creerUnites(doc, () => 0);
  const vision: VisionRendu = { camp: 0, unites: null };
  assert.equal(calque.maj(prete, cat6, null, vision), true);
  const [mien, sien] = calque.groupe.children as [THREE.Group, THREE.Group];
  const corpsMien = mien.children[0]!;
  const corpsSien = sien.children[0]!;
  const reposMien = principale(corpsMien);
  const reposSien = principale(corpsSien);
  assert.equal(reposMien.ombre, true);
  assert.equal(reposMien.materiau.transparent, false);

  // Les deux se cachent : seule la mienne se voile — l'autre, je la tiens au contact.
  const cachees = { ...prete, unites: prete.unites.map((u) => ({ ...u, furtive: true })) };
  assert.equal(calque.maj(cachees, cat6, null, vision), true, 'l’ombre a changé : la scène est à redessiner');
  const voilee = principale(corpsMien);
  assert.notEqual(voilee.materiau, reposMien.materiau, 'un double, jamais l’original');
  assert.equal(voilee.materiau.transparent, true);
  assert.equal(voilee.materiau.opacity, OPACITE_FURTIVE);
  assert.equal(voilee.materiau.depthWrite, true);
  assert.equal(voilee.materiau.color.getHex(), reposMien.materiau.color.getHex(), 'même teinte : seule l’opacité parle');
  assert.equal(voilee.ombre, false, 'la masse trahirait la transparence');
  assert.equal(mien.userData['agie'], false, 'se cacher n’est pas avoir joué');
  const vue = principale(corpsSien);
  assert.equal(vue.materiau, reposSien.materiau, 'la furtive adverse vue au contact est entière');
  assert.equal(vue.ombre, true);
  assert.equal(calque.maj(cachees, cat6, null, vision), false, 'rien à refaire au second passage');
  assert.equal(principale(corpsMien).materiau, voilee.materiau, 'le double est mémorisé');

  // Jouée et furtive : la plus faible des deux opacités, et le cadenas de l'état joué.
  const jouees = { ...cachees, unites: cachees.unites.map((u) => ({ ...u, etat: 'agi' as const })) };
  calque.maj(jouees, cat6, null, vision);
  assert.equal(principale(corpsMien).materiau.opacity, Math.min(OPACITE_JOUEE, OPACITE_FURTIVE));
  assert.equal(mien.userData['agie'], true);
  assert.equal(principale(corpsSien).materiau, reposSien.materiau, 'l’adversaire qui a joué n’est pas du camp courant : rien');

  // Jouée sans être furtive : l'opacité de l'état joué, comme avant.
  const seulementJouees = { ...prete, unites: prete.unites.map((u) => ({ ...u, etat: 'agi' as const })) };
  calque.maj(seulementJouees, cat6, null, vision);
  assert.equal(principale(corpsMien).materiau.opacity, OPACITE_JOUEE);

  // Le retour : l'objet même, l'ombre rendue.
  assert.equal(calque.maj(prete, cat6, null, vision), true);
  assert.equal(principale(corpsMien).materiau, reposMien.materiau, 'retour à l’identique');
  assert.equal(principale(corpsMien).ombre, true);

  // Sans vision — le banc, la vitrine —, toute furtive se voile.
  calque.maj(cachees, cat6, null);
  assert.equal(principale(corpsMien).materiau.opacity, OPACITE_FURTIVE);
  assert.equal(principale(corpsSien).materiau.opacity, OPACITE_FURTIVE);
  calque.dispose();
});

test('le fondu du voile règle des doubles propres à l’unité, puis rend les doubles partagés', () => {
  const prete = partieFurtive();
  const cachee = { ...prete, unites: prete.unites.map((u) => (u.camp === 0 ? { ...u, furtive: true } : u)) };
  const { doc } = documentFactice();
  const calque = creerUnites(doc, () => 0);
  const vision: VisionRendu = { camp: 0, unites: null };
  calque.maj(cachee, cat6, null, vision);
  const mien = calque.groupe.children[0]!;
  const corps = mien.children[0]!;
  const partage = principale(corps).materiau;
  assert.equal(partage.opacity, OPACITE_FURTIVE);

  // L'état dit furtive ; le geste retient le voile d'avant, puis le fait tomber.
  const id = cachee.unites[0]!.id;
  const v = calque.visuel(id);
  v.voile = 0;
  assert.equal(calque.maj(cachee, cat6, null, vision), true, 'entière de nouveau : l’ombre revient');
  assert.equal(principale(corps).materiau.transparent, false, 'à voile nul, les matériaux de repos');
  v.voile = 0.5;
  assert.equal(calque.maj(cachee, cat6, null, vision), true, 'translucide : l’ombre s’éteint');
  const fondu = principale(corps).materiau;
  assert.notEqual(fondu, partage, 'un double à l’unité, pas celui du calque');
  assert.ok(Math.abs(fondu.opacity - (1 - 0.5 * (1 - OPACITE_FURTIVE))) < 1e-9);
  assert.equal(principale(corps).ombre, false);
  v.voile = 0.75;
  assert.equal(calque.maj(cachee, cat6, null, vision), false, 'régler l’opacité ne vaut pas une carte d’ombre');
  assert.equal(principale(corps).materiau, fondu, 'le même double, réglé');
  assert.ok(Math.abs(fondu.opacity - (1 - 0.75 * (1 - OPACITE_FURTIVE))) < 1e-9);

  // Fini : l'état parle, et c'est le double partagé qui revient.
  v.voile = null;
  calque.maj(cachee, cat6, null, vision);
  assert.equal(principale(corps).materiau, partage);

  // Un voile poussé sur une furtive adverse ne change rien : elle est vue.
  const sien = calque.groupe.children[1]!;
  const reposSien = principale(sien.children[0]!).materiau;
  calque.visuel(cachee.unites[1]!.id).voile = 0.5;
  calque.maj(cachee, cat6, null, vision);
  assert.equal(principale(sien.children[0]!).materiau, reposSien);
  calque.dispose();
});

test('ce que le joueur ne voit pas n’est pas dessiné, même sur une case éclairée', () => {
  const etat = partieFurtive();
  const [mienne, sienne] = etat.unites.map((u) => u.id) as [string, string];
  const { doc } = documentFactice();
  const calque = creerUnites(doc, () => 0);
  // Toutes les cases sont vues, mais la furtive adverse hors contact ne l'est pas.
  const cases = new Set(['0,0', '1,0', '2,0', '3,0', '0,1', '1,1', '2,1', '3,1']);
  calque.maj(etat, cat6, cases, { camp: 0, unites: new Set([mienne]) });
  assert.equal(calque.groupe.children.length, 1, 'la mienne seule');
  assert.equal(calque.positionDe(sienne), null);
  // Elle revient dès qu'elle est vue, et disparaît de nouveau.
  assert.equal(calque.maj(etat, cat6, cases, { camp: 0, unites: new Set([mienne, sienne]) }), true);
  assert.equal(calque.groupe.children.length, 2);
  assert.equal(calque.maj(etat, cat6, cases, { camp: 0, unites: new Set([mienne]) }), true);
  assert.equal(calque.groupe.children.length, 1);
  // `null` : tout est vu.
  calque.maj(etat, cat6, cases, { camp: 0, unites: null });
  assert.equal(calque.groupe.children.length, 2);
  calque.dispose();
});
