// Le composeur de placeholders 3D. La règle du brief est absolue : **aucune
// unité n'est modélisée par son nom**. Ce test l'exerce sur toutes les unités
// du dernier catalogue, puis sur des silhouettes construites à la main, et
// vérifie que chaque brique déclarée se retrouve bien dans la liste de pièces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Vector3 } from 'three';

import { chargerCatalogueUnites } from '../../src/content/index';
import { chargerCatalogue } from '../../src/engine/index';
import {
  composerSilhouette, echelleTaille, hauteurSilhouette, nomsPieces,
} from '../../src/render3d/pieces';
import { geometriesSilhouette } from '../../src/render3d/unites';
import {
  BASES_SILHOUETTE, CORPS_SILHOUETTE, MODULES_SILHOUETTE, TAILLES_SILHOUETTE,
  type ModuleSilhouette, type Silhouette,
} from '../../src/schemas/index';

// Le **dernier** catalogue, pas celui par défaut de `chargerCatalogue` (le 2) :
// une unité homologuée ce matin doit passer les bornes de la case le jour même,
// et le furtif du catalogue 6 ne serait exercé par rien d'autre ici.
const CAT = chargerCatalogue(chargerCatalogueUnites().catalogueVersion);

function silhouette(p: Partial<Silhouette>): Silhouette {
  return { base: 'chenilles', corps: 'bloc', modules: [], taille: 2, ...p };
}

test('un char est une base, un corps et sa tourelle, dans cet ordre', () => {
  const noms = nomsPieces(silhouette({ base: 'chenilles', corps: 'bloc', modules: ['tourelle'] }));
  for (const nom of [
    'chenille_gauche', 'chenille_droite', 'plancher',
    'corps_bloc', 'capot',
    'tourelle', 'canon', 'galet_gauche_0', 'garde_boue_droite', 'ecoutille_tourelle',
  ]) assert.ok(noms.includes(nom), nom);
});

test('l’artillerie pose son canon long sur un plateau à chenilles', () => {
  const noms = nomsPieces(silhouette({ base: 'chenilles', corps: 'plateau', modules: ['canon_long'] }));
  for (const nom of [
    'chenille_gauche', 'chenille_droite', 'plancher',
    'corps_plateau', 'cabine', 'pare_brise',
    'berceau', 'canon_long', 'frein_bouche', 'culasse',
  ]) assert.ok(noms.includes(nom), nom);
});

test('l’infanterie est un groupe de trois figurines, jamais un bloc', () => {
  const noms = nomsPieces(silhouette({ base: 'pattes', corps: 'capsule', modules: [], taille: 1 }));
  for (const nom of [
    'figurine_1_jambe_gauche', 'figurine_1_tronc', 'figurine_1_casque',
    'figurine_2_jambe_gauche', 'figurine_2_tronc', 'figurine_2_casque',
    'figurine_3_jambe_gauche', 'figurine_3_tronc', 'figurine_3_casque',
    'figurine_1_sac', 'figurine_1_rebord_casque', 'figurine_1_fusil',
  ]) assert.ok(noms.includes(nom), nom);
  // Les trois figurines occupent trois places différentes dans la case.
  const places = composerSilhouette(silhouette({ base: 'pattes', corps: 'capsule' }))
    .filter((p) => p.nom.endsWith('_tronc'))
    .map((p) => `${p.position[0]},${p.position[2]}`);
  assert.equal(new Set(places).size, 3);
  // Et une infanterie mécanisée porte quand même son module.
  const meca = nomsPieces(silhouette({ base: 'pattes', corps: 'capsule', modules: ['lance_roquettes'] }));
  assert.ok(meca.includes('figurine_1_tube_lance') && meca.includes('figurine_2_ogive'), 'le module suit la troupe : chaque grenadier porte son tube');
});

test('une coque est un navire, et son corps dit lequel', () => {
  const navire = (corps: Silhouette['corps'], modules: ModuleSilhouette[] = []): string[] => nomsPieces(
    silhouette({ base: 'coque', corps, modules, taille: 3 }),
  );
  // Un bâtiment de surface : carène, muraille, étrave à joues, pont, et tout
  // l'accastillage sans lequel une coque n'est qu'une caisse pointue.
  const cuirasse = navire('bloc', ['tourelle', 'canon_long']);
  for (const nom of [
    'carene', 'coque', 'etrave', 'joue_gauche', 'joue_droite', 'tableau_arriere', 'pont',
    'ligne_flottaison', 'pavois_gauche', 'lisse_droite', 'chandelier_0_gauche', 'bitte_avant_droite',
    'ancre_gauche', 'helice_droite', 'gouvernail', 'cabestan',
    'passerelle', 'cheminee', 'mat_veille', 'tourelle', 'canon_long',
  ]) assert.ok(cuirasse.includes(nom), `cuirassé : ${nom}`);

  // Un pont plat : la barge et le porte-avions ont la même base et le même
  // corps ; seuls leurs modules les distinguent, et c'est là que ça se joue.
  const porteAvions = navire('plateau', ['antenne', 'radar']);
  const barge = navire('plateau', ['grue']);
  for (const nom of ['pont_plat', 'rouf']) {
    assert.ok(porteAvions.includes(nom) && barge.includes(nom), nom);
  }
  assert.ok(porteAvions.includes('ilot') && porteAvions.includes('axe_piste_0'),
    'un porte-avions a un îlot et un axe de piste');
  assert.ok(!barge.includes('ilot'), 'une barge n’a pas d’îlot');
  assert.ok(barge.includes('porte_etrave') && barge.includes('cale'),
    'une barge a une porte d’étrave et une cale');
  assert.ok(!porteAvions.includes('porte_etrave'));

  // Un submersible : ni pavois, ni bastingage, ni tableau — un kiosque.
  const sousMarin = navire('capsule', ['antenne']);
  for (const nom of ['coque_pression', 'kiosque', 'barre_plongee_gauche', 'safran', 'helice']) {
    assert.ok(sousMarin.includes(nom), `sous-marin : ${nom}`);
  }
  for (const nom of ['pavois_gauche', 'lisse_gauche', 'tableau_arriere', 'pont']) {
    assert.ok(!sousMarin.includes(nom), `un sous-marin n’a pas de ${nom}`);
  }
});

test('des ailes sont un aéronef entier, fuselage compris, et ce qu’il emporte pend sous lui', () => {
  const avion = (corps: Silhouette['corps'], modules: ModuleSilhouette[] = []): string[] => nomsPieces(
    silhouette({ base: 'ailes', corps, modules, taille: 3 }),
  );
  const chasseur = avion('capsule');
  for (const nom of [
    'aile_gauche', 'saumon_droite', 'stabilisateur_gauche', 'derive', 'gouverne_derive',
    'reacteur_gauche', 'reacteur_tuyere_droite', 'cocarde_gauche', 'missile_droite', 'ogive_missile_gauche',
    'corps_capsule', 'nez', 'verriere',
  ]) assert.ok(chasseur.includes(nom), `chasseur : ${nom}`);
  // L'ancienne base posait deux plaques, une dérive et un train, sans rien pour
  // les tenir : un avion sans fuselage ne se lit pas, même de loin.
  assert.ok(!chasseur.includes('train'));

  const bombardier = avion('bloc', ['nacelle']);
  for (const nom of [
    'corps_bloc', 'nez', 'poste', 'soute', 'poutre_queue', 'tourelle_queue',
    'reacteur_interne_gauche', 'reacteur_externe_droite', 'nacelle',
  ]) assert.ok(bombardier.includes(nom), `bombardier : ${nom}`);
  assert.ok(!bombardier.includes('missile_gauche'), 'un bombardier garde ses bombes en soute');

  // Ce qu'un bombardier emporte pend **sous** le fuselage : une nacelle posée
  // sur son dos se lirait comme une tourelle, et un avion n'en porte pas.
  const pieces = composerSilhouette(silhouette({ base: 'ailes', corps: 'bloc', modules: ['nacelle'], taille: 3 }));
  const ventre = pieces.find((p) => p.nom === 'soute')!;
  const nacelle = pieces.find((p) => p.nom === 'nacelle')!;
  assert.ok(nacelle.position[1] < ventre.position[1], 'la nacelle est sous la soute');
});

test('des ailes à corps de plateau font une aile volante : un chevron sans dérive ni queue', () => {
  const avion = (corps: Silhouette['corps'], modules: ModuleSilhouette[] = []): string[] => nomsPieces(
    silhouette({ base: 'ailes', corps, modules, taille: 3 }),
  );
  const aileVolante = avion('plateau', ['antenne']);
  const chasseur = avion('capsule');
  for (const nom of [
    'aile_gauche', 'bord_fuite_droite', 'saumon_gauche', 'elevon_droite', 'tuyere_gauche',
    'corps_fondu', 'verriere', 'entree_air_gauche', 'cocarde_droite', 'feu_gauche',
    'antenne', 'embase_antenne',
  ]) assert.ok(aileVolante.includes(nom), `aile volante : ${nom}`);
  // Ni dérive, ni empennage, ni fuselage, ni réacteur en nacelle, ni missile
  // sous voilure : c'est leur absence qui fait la silhouette.
  for (const nom of [
    'derive', 'gouverne_derive', 'stabilisateur_gauche', 'corps_capsule', 'corps_bloc', 'nez',
    'reacteur_gauche', 'reacteur_tuyere_droite', 'missile_gauche', 'pylone_droite', 'poutre_queue',
  ]) assert.ok(!aileVolante.includes(nom), `une aile volante n’a pas de ${nom}`);
  // Et elle se distingue du chasseur dans les deux sens : au moins une pièce à
  // elle, au moins une pièce du chasseur qu'elle n'a pas.
  assert.ok(aileVolante.some((n) => !chasseur.includes(n)), 'rien ne distingue l’aile volante du chasseur');
  assert.ok(chasseur.some((n) => !aileVolante.includes(n)), 'le chasseur n’a rien que l’aile volante n’ait');

  const pieces = composerSilhouette(silhouette({ base: 'ailes', corps: 'plateau', modules: ['antenne'], taille: 3 }));
  // Plate : hormis l'antenne, rien ne monte au tiers de case — le chasseur y
  // dresse sa dérive, le bombardier sa tourelle de queue.
  for (const p of pieces) {
    if (p.nom.includes('antenne')) continue;
    assert.ok(p.position[1] + p.taille[1] / 2 < 0.3, `${p.nom} dépasse du plan de l’aile`);
  }
  // Large : les saumons portent l'envergure au-delà de la mi-case de chaque côté.
  for (const s of pieces.filter((p) => p.nom.startsWith('saumon_'))) {
    assert.ok(Math.abs(s.position[2]) >= 0.35, `${s.nom} : envergure trop courte`);
  }
  // Le module se pose sur le dos de la bosse, pas dans le vide ni dans l'aile :
  // le bas de l'embase affleure l'ellipsoïde à l'aplomb de l'antenne.
  const bosse = pieces.find((p) => p.nom === 'corps_fondu')!;
  const embase = pieces.find((p) => p.nom === 'embase_antenne')!;
  const dx = (embase.position[0] - bosse.position[0]) / (bosse.taille[0] / 2);
  const dz = (embase.position[2] - bosse.position[2]) / (bosse.taille[2] / 2);
  const dosBosse = bosse.position[1] + (bosse.taille[1] / 2) * Math.sqrt(Math.max(0, 1 - dx * dx - dz * dz));
  const basEmbase = embase.position[1] - embase.taille[1] / 2;
  assert.ok(basEmbase >= dosBosse - 0.01 && basEmbase <= dosBosse + 0.02, `embase à ${basEmbase}, dos de la bosse à ${dosBosse}`);
});

test('chaque unité du dernier catalogue tient dans sept matériaux et sous six mille triangles', () => {
  // `tests/render3d/unites.test.ts` fait la même mesure sur le catalogue 2 ;
  // ici, c'est le dernier catalogue, donc les silhouettes que ce test-là ne
  // voit pas — coques, ailes, aile volante.
  for (const cle of CAT.cles) {
    const geometries = geometriesSilhouette(CAT.unites[cle]!.silhouette);
    assert.ok(geometries.size <= 7 && geometries.size >= 3, `${cle} : ${geometries.size} matériaux`);
    let triangles = 0;
    for (const geo of geometries.values()) triangles += geo.getAttribute('position').count / 3;
    assert.ok(triangles < 6000, `${cle} : ${triangles} triangles dépassent le budget mobile`);
  }
});

test('chaque base, chaque corps et chaque module produit des pièces', () => {
  for (const base of BASES_SILHOUETTE) {
    const noms = nomsPieces(silhouette({ base }));
    assert.ok(noms.length > 0, `la base ${base} ne produit rien`);
  }
  for (const corps of CORPS_SILHOUETTE) {
    const noms = nomsPieces(silhouette({ corps }));
    assert.ok(noms.length >= 3, `le corps ${corps} ne produit rien`);
  }
  for (const greffon of MODULES_SILHOUETTE) {
    const avec = nomsPieces(silhouette({ modules: [greffon] }));
    const sans = nomsPieces(silhouette({ modules: [] }));
    assert.ok(avec.length > sans.length, `le module ${greffon} ne produit rien`);
  }
});

test('les pièces sont nommées, dimensionnées et bornées à la case', () => {
  for (const cle of CAT.cles) {
    const type = CAT.unites[cle];
    if (!type) continue;
    const pieces = composerSilhouette(type.silhouette);
    assert.ok(pieces.length >= 3, `${cle} : trop peu de pièces`);
    const noms = new Set(pieces.map((p) => p.nom));
    assert.equal(noms.size, pieces.length, `${cle} : deux pièces portent le même nom`);
    const e = echelleTaille(type.silhouette.taille);
    for (const p of pieces) {
      for (const d of p.taille) assert.ok(d > 0, `${cle}/${p.nom} : dimension nulle`);
      assert.ok(p.position[1] >= -0.05, `${cle}/${p.nom} : pièce sous le sol`);
      // Rien ne dépasse d'une case : les unités voisines ne se chevauchent pas.
      const rotation = new Euler(...(p.rotation ?? [0, 0, 0]));
      let demiLargeur = 0;
      for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) {
        const coin = new Vector3(x * p.taille[0], y * p.taille[1], z * p.taille[2]).applyEuler(rotation);
        demiLargeur = Math.max(demiLargeur, Math.abs(p.position[2] + coin.z) * e);
      }
      assert.ok(demiLargeur <= 0.62, `${cle}/${p.nom} : déborde de sa case (${demiLargeur})`);
    }
    const haut = hauteurSilhouette(type.silhouette);
    assert.ok(haut > 0.15 && haut < 1, `${cle} : hauteur invraisemblable (${haut})`);
  }
});

test('la taille de silhouette échelonne le modèle sans l’inverser', () => {
  const echelles = TAILLES_SILHOUETTE.map((t) => echelleTaille(t));
  for (let i = 1; i < echelles.length; i += 1) {
    const avant = echelles[i - 1] ?? 0;
    const apres = echelles[i] ?? 0;
    assert.ok(apres > avant, 'une taille supérieure doit donner un modèle plus grand');
  }
  assert.equal(echelleTaille(2), 1);
});


test('le génie porte son équipement de chantier distinct des armes de l’infanterie', () => {
  const genie = nomsPieces(CAT.unites['genie']!.silhouette);
  assert.ok(genie.includes('figurine_1_outil_pelle'));
  assert.ok(genie.includes('figurine_2_caisse_outils'));
  assert.ok(!genie.includes('figurine_1_fusil'));
});
