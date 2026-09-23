// Aide de test **vide**, gardée pour que la commande de test ciblé écrite partout
// dans le dépôt continue de marcher :
//
//     node --import tsx --import ./tests/aides/webgpu-en-node.mjs --test <fichiers>
//
// Elle préchargeait ce que le moteur WebGPU de three exigeait sous Node — deux
// globales de navigateur (`self`, `navigator`) — et faisait désigner à `three`
// le fichier `three/webgpu`, pour que la peau 3D et les compléments de three
// partagent une seule copie du cœur (`instanceof`). La peau 3D a été retirée le
// 23 septembre 2026, et plus rien n'importe `three/webgpu` ni `three/tsl` : les
// tests, comme les scripts de production, prennent `three` tel qu'il se publie.
// `npm test` (`scripts/test.mjs`) ne la précharge plus.
//
// Un test qui aurait besoin d'une globale de navigateur la pose lui-même, là où
// on la voit (`analyserGlb` pose `self`, par exemple).
export {};
