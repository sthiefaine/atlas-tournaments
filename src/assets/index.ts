/**
 * Point d'entrée de la couche `assets` : le format des spécifications, leur
 * validateur, le catalogue produit depuis le canon, et le contrôle des fichiers
 * GLB qui reviennent du générateur externe.
 *
 * Cette couche n'importe que `schemas/` et `content/` (`doc/02-architecture.md` §5,
 * vérifié par `tests/frontieres.test.ts`). Elle ne connaît ni `three`, ni le DOM,
 * ni le rendu : elle tourne en Node, dans les tests et dans les scripts.
 *
 * Document propriétaire : `doc/11-assets-spec.md`.
 */

export * from './spec';
export * from './commande';
export * from './valider';
export * from './valider-gltf';
export * from './styles';
export * from './catalogue';
