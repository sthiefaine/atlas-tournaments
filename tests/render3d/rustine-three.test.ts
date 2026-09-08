// La rustine de three r170 est posée par `postinstall`, donc par une commande
// que personne ne relance à la main. Ce test est ce qui la tient : sans lui,
// une réinstallation avec `--ignore-scripts` rendrait le jeu injouable sur
// Safari sans que rien ne le dise avant le rapport d'un joueur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Les fichiers de three que la rustine corrige, dans l'ordre du script. */
const CIBLES = ['build/three.webgpu.js', 'build/three.webgpu.nodes.js', 'src/nodes/core/NodeUtils.js'];

test('la rustine de three est posée : la clé de programme ne se pousse plus dans elle-même', () => {
  // `values.push( values, … )` rend le tableau de la clé auto-référent. `cyrb53`
  // le convertit en nombre, ce qui appelle `Array.prototype.join` : V8 s'en tire
  // par sa détection de cycle, JavaScriptCore lève « Maximum call stack size
  // exceeded » — et le plateau ne dessine jamais sa première image sur Safari.
  let vus = 0;
  for (const relatif of CIBLES) {
    let source: string;
    try {
      source = readFileSync(path.resolve(process.cwd(), 'node_modules', 'three', relatif), 'utf8');
    } catch {
      continue;
    }
    vus += 1;
    assert.ok(!source.includes('values.push( values, cyrb53('),
      `three/${relatif} porte encore la faute de r170 : lancer « node scripts/rustine-three.mjs »`);
    assert.ok(source.includes('values.push( cyrb53('),
      `three/${relatif} n’a plus le motif attendu : relire scripts/rustine-three.mjs`);
  }
  assert.ok(vus > 0, 'aucun fichier de three trouvé : l’installation est incomplète');
});

test('compileAsync transmet les deux listes transparentes et la vraie scène', () => {
  for (const relatif of ['build/three.webgpu.js', 'build/three.webgpu.nodes.js', 'src/renderers/common/Renderer.js']) {
    const source = readFileSync(path.resolve('node_modules/three', relatif), 'utf8');
    assert.ok(!source.includes('this._renderTransparents( transparentObjects, camera, sceneRef, lightsNode )'));
    assert.ok(source.includes('this._renderTransparents( transparentObjects, renderList.transparentDoublePass, camera, sceneRef, lightsNode )'));
  }
});
