// Crochet de résolution pour les tests : `three` désigne le moteur WebGPU.
//
// Depuis le passage à WebGPU (7 septembre 2026), le code du rendu importe
// `three/webgpu`, et les compléments de three (`three/addons/*`) importent
// `three`. Dans le navigateur, `next.config.ts` fait pointer les deux vers le
// même fichier ; sous Node, ce crochet fait la même chose, sans quoi deux
// copies du cœur de three cohabiteraient et `instanceof` mentirait.
//
// On corrige l'**URL résolue**, pas le spécificateur : le chargeur de tsx passe
// avant celui-ci et a déjà transformé `three` en chemin de fichier.
const CLASSIQUE = '/three/build/three.module.js';
const WEBGPU = '/three/build/three.webgpu.js';

export async function resolve(specifier, context, nextResolve) {
  const resolu = await nextResolve(specifier === 'three' ? 'three/webgpu' : specifier, context);
  if (typeof resolu.url === 'string' && resolu.url.endsWith(CLASSIQUE)) {
    return { ...resolu, url: resolu.url.slice(0, -CLASSIQUE.length) + WEBGPU };
  }
  return resolu;
}
