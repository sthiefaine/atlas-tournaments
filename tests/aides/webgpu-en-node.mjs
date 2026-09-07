// Préchargé avant tous les tests (`scripts/test.mjs`) : le moteur WebGPU de
// three suppose un navigateur — `self.GPUShaderStage`, `navigator.userAgent` —
// dès son chargement. On lui donne le strict minimum, et rien qui ressemble à
// une carte graphique : un test qui créerait un `WebGPURenderer` doit échouer.
//
// Et `three` désigne le moteur WebGPU, comme dans le navigateur (`next.config.ts`).
// Les tests sont du CommonJS aux yeux de tsx (pas de `"type": "module"`) : leurs
// `import` deviennent des `require`, qui ne passent pas par les crochets ESM.
// On corrige donc **les deux** résolutions, celle de `require` et celle d'`import`.
import Module, { register } from 'node:module';

if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;
if (typeof globalThis.navigator === 'undefined') {
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node' }, configurable: true, writable: true });
}

const CLASSIQUES = [/[\\/]three[\\/]build[\\/]three\.cjs$/, /[\\/]three[\\/]build[\\/]three\.module\.js$/];
export function versWebgpu(chemin) {
  return CLASSIQUES.some((r) => r.test(chemin))
    ? chemin.replace(/three\.(cjs|module\.js)$/, 'three.webgpu.js')
    : chemin;
}

const resoudreOrigine = Module._resolveFilename;
Module._resolveFilename = function resoudreThree(demande, ...reste) {
  return versWebgpu(resoudreOrigine.call(this, demande === 'three' ? 'three/webgpu' : demande, ...reste));
};

register('./resoudre-three.mjs', import.meta.url);
