/** Consignes d'assemblage partagées par la commande et le banc de réception. */
import type { AssetSpec } from './spec';

export interface Articulation {
  nom: string; parent: string | null; role: string;
  /** Pivot local au parent, en mètres ; absent quand la fiche ne le fixe pas encore. */
  pivot?: [number, number, number];
}
export interface ContratProduction {
  version: 1;
  assemblage: Articulation[];
  raccord: 'quart_tour' | 'directionnel' | 'aucun';
  reference: string | null;
  consignes: string[];
  gestes: Record<string, string>;
}
export const LIMITE_FICHIER = 32 * 1024 * 1024;
export const LIMITE_LOT = 96 * 1024 * 1024;

export function contratProduction(spec: AssetSpec): ContratProduction {
  const terrain = spec.type === 'terrain';
  const raccord = terrain ? (['plaine', 'foret', 'montagne'].includes(spec.cle) ? 'quart_tour' : 'directionnel') : 'aucun';
  let assemblage: Articulation[] = spec.format.noeuds.map((nom) => ({
    nom, parent: nom === 'racine' ? null : 'racine',
    role: nom === 'racine' ? 'Footprint origin. Identity transform; never animate this node.'
      : nom === 'sol' ? 'Ground surface and its constant-thickness support.'
        : `${nom}: keep this named attachment across all LODs and national kits.`,
  }));
  const identite = spec.type === 'kit' ? `unite_${spec.cle.split('_').slice(1).join('_')}_base` : spec.id;
  if (identite === 'unite_antiair_base') assemblage = [
    { nom: 'racine', parent: null, pivot: [0, 0, 0], role: 'Footprint origin; never animated.' },
    { nom: 'base', parent: 'racine', pivot: [0, 0, 0], role: 'Tracks, rubber pads and road wheels.' },
    { nom: 'corps', parent: 'racine', pivot: [0, .16, 0], role: 'Hull, team-colour front plate, wide sloped cheeks.' },
    { nom: 'module_tourelle', parent: 'corps', pivot: [0, .105, 0], role: 'Turret and two clearly separated short marker tubes. Rotate around local +Y.' },
    { nom: 'module_radar', parent: 'module_tourelle', pivot: [0, .1, -.17], role: 'Chunky dish and folding arm. Scan around +Y, fold around local X.' },
    { nom: 'socle', parent: 'module_tourelle', pivot: [0, .055, .178], role: 'Readiness indicator, scaled to zero when switched off; not a pedestal.' },
  ];
  if (identite === 'unite_artillerie_base') assemblage = [
    { nom: 'racine', parent: null, pivot: [0, 0, 0], role: 'Footprint origin; never animated.' },
    { nom: 'base', parent: 'racine', pivot: [0, 0, 0], role: 'Track runs, pads and road wheels.' },
    { nom: 'corps', parent: 'racine', pivot: [0, .16, 0], role: 'Flat deck, raised front cab, folded side ladder, travel lock.' },
    { nom: 'module_canon_long', parent: 'corps', pivot: [0, .155, -.13], role: 'Open cradle and long marker tube, elevation around local X. No turret or armour.' },
    { nom: 'socle', parent: 'racine', pivot: [0, .185, -.28], role: 'Both rear ground spades, folding together around local X; not a pedestal.' },
  ];
  // Les squelettes humains ont leurs propres os : ne pas inventer leurs parents.
  if (!['unite_antiair_base', 'unite_artillerie_base'].includes(identite) && !terrain) assemblage = [];
  return {
    version: 1, assemblage, raccord,
    reference: spec.type === 'kit' ? `unite_${spec.cle.split('_').slice(1).join('_')}_base`
      : terrain ? 'terrain_plaine' : spec.type === 'unite' ? (spec.id.includes('artillerie') ? 'unite_artillerie_base' : /tracked|chenilles/.test(spec.description.en) ? 'unite_antiair_base' : /infanterie|genie/.test(spec.id) ? 'unite_infanterie_base' : null) : null,
    consignes: [
      'Use three silhouette anchors from the description. Check top, three-quarter and 65 degrees above the ground at 48 CSS pixels per metre. Fine surface grain must not replace readable geometry.',
      ...(spec.type === 'kit' ? ['Edit only material/image references and PNG pixels in a copy of the delivered base GLB. Preserve its geometry binary, accessors, UVs, skeleton, named nodes and animation clips byte-for-byte; no added ornament geometry.'] : []),
      'One shared UV0 layout across LODs and all kits of this base. Preserve material assignments and named attachments. Provide vertex normals and UV0 on every triangle primitive; no negative scale or duplicate node names.',
      `Albedo uses sRGB; normal, roughness, metalness, occlusion${spec.textures.some((t) => t.canal === 'masque_equipe') ? ' and team mask' : ''} use linear data. Tangent-space normal map follows glTF (+Y/green up). glTF roughness reads G and metalness B; the rugosite PNG stores roughness in G and metalness in B (R may store occlusion). The separate metal PNG remains the editable metal channel.`,
      `Each file must be at most ${LIMITE_FICHIER / 1048576} MiB; the complete delivery at most ${LIMITE_LOT / 1048576} MiB. Keep PNG textures external, shared by all LODs. Each GLB image URI must be the exact neighbouring filename, without a directory or data URI. Never embed duplicate PNG copies.`,
      ...(raccord === 'quart_tour' ? ['All four texture edges must match, including reversal after 90-degree rotation. Rotate tangent-space normals with the tile. Keep interior variations asymmetric; test a 4×4 mosaic with mixed quarter turns. No large repeated landmark.'] : []),
      ...(raccord === 'directionnel' ? ['This is directional: preserve connected road/bridge/shore axes. Do not demand arbitrary quarter-turn edge compatibility. Test aligned repetitions and the intended neighbouring terrain.'] : []),
      'Deliver a candidate, then obtain human visual approval in the inspector. Technical acceptance alone never approves the art or proves that lighting was not baked into albedo.',
    ],
    gestes: {
      repos: 'Subtle breathing or scanning; start and end transforms coincide. No root motion.',
      deplacement: identite === 'unite_artillerie_base'
        ? 'Raise both spades, lower the tube onto the travel lock; restrained suspension motion, loop without a jump.'
        : 'Small suspension or gait motion. The game moves the root; this clip must stay in place and loop seamlessly.',
      tir: 'Brief marker-launcher recoil followed by recovery to the working pose; no explosion or projectile mesh.',
      touche: 'Small readable tilt and immediate recovery; no damage or missing geometry.',
      hors_jeu: 'Settle the hull, park the equipment and hide the readiness indicator. Hold the final slump; never explode. Rigid node transforms cannot animate PBR emission: hide or fold the indicator instead.',
      capture: 'A restrained acknowledgement gesture; keep the footprint fixed.',
    },
  };
}
