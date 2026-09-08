#!/usr/bin/env node
/**
 * Rustine de three r170 : la clé de programme d'un matériau à nœuds.
 *
 * `NodeUtils.getCacheKey` compose la clé dans un tableau, et r170 y **pousse le
 * tableau lui-même** :
 *
 *     values.push( values, cyrb53( property.slice( 0, - 4 ) ), childNode.getCacheKey( force ) );
 *
 * Le tableau devient auto-référent. `cyrb53` le convertit ensuite en nombre, ce
 * qui appelle `Array.prototype.join` : V8 s'en tire par sa détection de cycle,
 * **JavaScriptCore lève** `RangeError: Maximum call stack size exceeded`. Le jeu
 * ne dessine donc jamais sa première image sur Safari — ni sur un iPhone —, et
 * la page bascule sur un écran d'erreur qui rend le plateau inerte. Trouvé le
 * 8 septembre 2026 par `e2e/safari.spec.ts`.
 *
 * C'est une faute d'amont, corrigée depuis : la 0.186 écrit
 * `values.push( hashString( … ), childNode.getCacheKey( … ) )` dans `Node.js`.
 * Monter de r170 à r186 est un chantier à part — tout ce que ce dépôt exploite
 * de r170 y passerait, à commencer par l'instanciation de `lots.ts` —, alors on
 * corrige la ligne, et rien d'autre.
 *
 * La rustine est **idempotente** et **bruyante** : si le motif fautif a disparu
 * sans que le motif corrigé soit là, elle échoue, parce que cela veut dire que
 * three a changé et qu'il faut refaire ce raisonnement.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Les fichiers de three qui portent la ligne. `three/webgpu` charge le premier. */
const CIBLES = [
  'build/three.webgpu.js',
  'build/three.webgpu.nodes.js',
  'src/nodes/core/NodeUtils.js',
];

const FAUTIF = 'values.push( values, cyrb53(';
const CORRIGE = 'values.push( cyrb53(';

let posees = 0;
let dejaLa = 0;
for (const relatif of CIBLES) {
  const chemin = path.resolve(process.cwd(), 'node_modules', 'three', relatif);
  let source;
  try {
    source = readFileSync(chemin, 'utf8');
  } catch {
    // Un fichier absent n'est pas une faute : three peut cesser de le publier.
    continue;
  }
  if (source.includes(FAUTIF)) {
    writeFileSync(chemin, source.split(FAUTIF).join(CORRIGE));
    posees += 1;
  } else if (source.includes(CORRIGE)) {
    dejaLa += 1;
  } else {
    console.error(
      `rustine-three : ni le motif fautif ni le corrigé dans ${relatif}.\n`
      + 'three a changé : relire scripts/rustine-three.mjs avant de continuer.',
    );
    process.exit(1);
  }
}

if (posees > 0) console.log(`rustine-three : ${posees} fichier(s) corrigé(s).`);
else if (dejaLa > 0) console.log('rustine-three : déjà posée.');
