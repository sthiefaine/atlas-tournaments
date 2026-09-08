/**
 * La **commande** d'un asset : la fiche traduite en un texte qu'on donne à un
 * générateur, et rien de plus.
 *
 * Elle est composée **depuis la spécification**, jamais écrite à la main. C'est
 * la règle qui compte : la fiche est contractuelle — un contrôle automatique la
 * relit à la livraison et refuse le fichier —, et une commande recopiée à la
 * main dérive du jour où une dimension change. Tout ce qui suit sort de
 * `spec` : les mesures, les budgets, les noms de nœuds, les canaux de texture,
 * les clips, les interdits.
 *
 * Le texte est en **anglais** parce que les générateurs y répondent mieux, et
 * parce que `description.en` est déjà là pour cela (`doc/11-assets-spec.md` §9).
 * Il ne flatte pas le générateur : si le ton dérive vers le militaire réaliste,
 * on change de générateur, pas de fiche.
 *
 * Une contrainte pèse plus que les autres et se répète pour cette raison :
 * **aucun éclairage ni ombre cuits dans l'albédo**. Une ombre peinte dans la
 * texture devient une ombre permanente, qui contredit le soleil du jeu à toute
 * heure et à toute saison ; c'est le défaut qui fait refuser le plus souvent un
 * asset par ailleurs correct.
 */

import {
  nomModele, nomTexture,
  type AssetSpec, type Dimension, type NiveauLod,
} from './spec';

/** Une mesure de la fiche, en mètres, avec sa tolérance. */
function mesure(d: Dimension): string {
  return `${d.cible} m (± ${d.tolerance})`;
}

/** La liste des interdits, en négations courtes et en anglais. */
function interdits(spec: AssetSpec): string {
  return spec.interdits.map((i) => `no ${i.replace(/_/g, ' ')}`).join(', ');
}

/** Les niveaux de détail exigés, dans l'ordre, avec leur budget de triangles. */
function niveaux(spec: AssetSpec): string {
  return spec.verification.lodRequis
    .map((lod: NiveauLod) => `\`${nomModele(spec, lod)}\` ≤ ${spec.budget[`lod${lod}` as 'lod0' | 'lod1' | 'lod2']} triangles`)
    .join(', ');
}

/** Les cartes attendues, avec leur résolution et le nom exact du fichier. */
function textures(spec: AssetSpec): string {
  return spec.textures
    .map((t) => `\`${nomTexture(spec, t.canal)}\` (${t.canal}, ${t.resolution}×${t.resolution})`)
    .join(', ');
}

/** Les clips attendus, avec leur durée et s'ils bouclent. */
function animations(spec: AssetSpec): string {
  if (spec.animations.length === 0) return '';
  return spec.animations
    .map((a) => `\`${a.nom}\` (${a.dureeMs} ms${a.boucle ? ', looping' : ''}${a.obligatoire ? '' : ', optional'})`)
    .join(', ');
}

/**
 * La commande complète pour un asset, prête à coller.
 *
 * Six blocs, dans l'ordre où un générateur les lit : ce que c'est, le style,
 * les mesures, la géométrie nommée, les textures, les clips. Le dernier
 * paragraphe dit ce qu'un générateur ne saura probablement pas faire — les
 * noms, les niveaux de détail, le masque d'équipe, le pivot, les clips — parce
 * que le savoir d'avance évite de refaire trois fois le même aller-retour.
 */
export function commandeAsset(spec: AssetSpec): string {
  const e = spec.echelle;
  const masque = spec.textures.some((t) => t.canal === 'masque_equipe');
  const clips = animations(spec);

  const lignes: string[] = [
    `You are producing a game-ready 3D asset for a turn-based tactics game.`,
    `Follow every constraint below literally: an automatic check reads them back on delivery and refuses the file.`,
    '',
    `## What it is`,
    '',
    spec.description.en,
    '',
    `## Style`,
    '',
    `Stylised realism: real materials — painted sheet metal, matte technical fabric, washed concrete, worn wood, dusty rubber — on simple, readable volumes. Competition equipment kept in good repair, marked by use, never damaged by violence. Saturated colours, figurine proportions. The silhouette must stay recognisable from a 65° top-down camera at about 48 pixels per metre.`,
    '',
    `Forbidden, without exception: ${interdits(spec)}. These are tournament athletes with marker launchers, not soldiers.`,
    '',
    `## Size and pivot`,
    '',
    `Bounding box ${mesure(e.x)} wide, ${mesure(e.y)} tall, ${mesure(e.z)} deep.`,
    `Origin: ${spec.pivot.origine === 'centre_au_sol' ? 'centre of the footprint, at ground level' : String(spec.pivot.origine).replace(/_/g, ' ')}. Up axis **+Y**, front **+Z**, resting on the ground. 1 unit = 1 metre.`,
    '',
    `## Geometry and naming`,
    '',
    `glTF 2.0 binary (.glb), PBR metallic-roughness. One file per level of detail: ${niveaux(spec)}.`,
    `At most ${spec.budget.materiauxMax} materials, named exactly: ${spec.format.materiauxAttendus.map((m) => `\`${m}\``).join(', ')}.`,
    `Nodes named exactly: ${spec.format.noeuds.map((n) => `\`${n}\``).join(', ')}.`,
    '',
    `## Textures`,
    '',
    `One PNG per channel: ${textures(spec)}.`,
    `**No lighting and no shadow baked into the albedo** — the game lights the scene itself, and a painted shadow becomes a permanent one that contradicts the sun at every hour and every season.`,
  ];

  if (masque) {
    lignes.push(
      '',
      `The **team mask** is a crisp black-and-white image: white where the team colour will be applied, black on tracks, glass, rubber, metal and skin. Paint those masked zones **neutral grey** in the albedo, never in a nation colour.`,
    );
  }

  if (clips !== '') {
    lignes.push(
      '',
      `## Animations`,
      '',
      `Clips named exactly: ${clips}.`,
      `For a rigid model these are node-transform animations. \`hors_jeu\` is a slump and a switch-off, never an explosion.`,
    );
  }

  // Ce qu'un générateur rate presque toujours — et le dire d'avance évite de
  // refaire trois fois le même aller-retour. La liste suit la fiche : pas de
  // masque d'équipe demandé, pas de masque d'équipe à corriger.
  const aReprendre = [
    'node names', 'material names',
    `the ${spec.verification.lodRequis.length} levels of detail`,
    ...(masque ? ['the team mask'] : []),
    'the pivot',
    ...(clips !== '' ? ['the animation clips'] : []),
  ];
  lignes.push(
    '',
    `## What you will probably have to fix by hand afterwards`,
    '',
    `${aReprendre.join(', ')}. Generators rarely get these right; the rest of the specification they usually do.`,
  );

  return lignes.join('\n');
}
