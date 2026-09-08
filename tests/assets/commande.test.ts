// La commande donnée au générateur est **composée depuis la fiche**. Ce test
// existe pour une seule raison : une commande recopiée à la main dérive le jour
// où une dimension change, et le générateur rend alors un fichier que le
// contrôle refuse — sans que personne comprenne pourquoi.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { commandeAsset, genererSpecs } from '../../src/assets/index';
import { chargerCatalogue } from '../../src/engine/index';

/** Toutes les spécifications du canon, comme la page d'administration les lit. */
function specs() {
  return genererSpecs();
}

test('la commande reprend les mesures, les budgets et les noms de la fiche', () => {
  const spec = specs().find((s) => s.id === 'unite_char_leger_base');
  assert.ok(spec, 'le char léger est dans le canon');
  const texte = commandeAsset(spec);

  // Les mesures et leur tolérance, telles que le contrôle les relira.
  assert.ok(texte.includes(`${spec.echelle.x.cible} m (± ${spec.echelle.x.tolerance})`),
    'la largeur cible et sa tolérance');
  assert.ok(texte.includes(`± ${spec.echelle.y.tolerance}`), 'la hauteur');

  // Les budgets par niveau de détail, et le nom de fichier exact de chacun.
  for (const lod of spec.verification.lodRequis) {
    assert.ok(texte.includes(`_lod${lod}.glb`), `le nom du niveau ${lod}`);
  }
  assert.ok(texte.includes(String(spec.budget.lod0)), 'le budget de triangles du niveau 0');
  assert.ok(texte.includes(String(spec.budget.materiauxMax)), 'le nombre de matériaux admis');

  // Les noms que le rendu cherche : jamais un index, toujours un nom.
  for (const n of spec.format.noeuds) assert.ok(texte.includes(n), `le nœud ${n}`);
  for (const m of spec.format.materiauxAttendus) assert.ok(texte.includes(m), `le matériau ${m}`);
});

test('la commande porte la contrainte qui fait refuser le plus d’assets', () => {
  // Une ombre peinte dans l'albédo devient une ombre permanente, qui contredit
  // le soleil du jeu à toute heure et à toute saison.
  for (const spec of specs().slice(0, 40)) {
    assert.match(commandeAsset(spec), /no lighting and no shadow baked into the albedo/i,
      `${spec.id} : l’albédo sans éclairage cuit`);
  }
});

test('la commande dit les interdits de la fiche, et le masque d’équipe quand il est demandé', () => {
  const avecMasque = specs().find((s) => s.textures.some((t) => t.canal === 'masque_equipe'));
  assert.ok(avecMasque, 'au moins une fiche demande un masque d’équipe');
  const texte = commandeAsset(avecMasque);
  assert.match(texte, /team mask/i, 'le masque est décrit');
  assert.match(texte, /neutral grey/i, 'et ce qu’il faut peindre dans l’albédo');
  assert.ok(avecMasque.interdits.length > 0);
  for (const i of avecMasque.interdits) {
    assert.ok(texte.includes(i.replace(/_/g, ' ')), `l’interdit ${i}`);
  }

  // Une fiche sans masque n'en parle pas : on ne demande pas une carte inutile.
  const sansMasque = specs().find((s) => !s.textures.some((t) => t.canal === 'masque_equipe'));
  if (sansMasque) assert.doesNotMatch(commandeAsset(sansMasque), /team mask/i);
});

test('toutes les fiches du canon composent une commande non vide', () => {
  const toutes = specs();
  assert.ok(toutes.length > 100, 'le canon en porte plusieurs centaines');
  const cat = chargerCatalogue();
  assert.ok(cat, 'le catalogue se charge');
  for (const spec of toutes) {
    const texte = commandeAsset(spec);
    assert.ok(texte.length > 400, `${spec.id} : la commande est substantielle`);
    assert.ok(!texte.includes('undefined'), `${spec.id} : aucun trou dans la commande`);
    assert.ok(!texte.includes('{id}'), `${spec.id} : les gabarits de nommage sont substitués`);
  }
});
