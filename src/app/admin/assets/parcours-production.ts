import type { AssetSpec } from '../../../assets/spec';
import { nomModele, nomTexture } from '../../../assets/index';
import { contratProduction } from '../../../assets/production';
import type { ReceptionAsset } from '../../../serveur/reception-assets';
import { baseRequise, chantier } from '../../../serveur/chantier-assets';
import { promptProduction } from './prompt-production';

/** Trois preuves différentes : présence, contrôle automatique, décision humaine. */
export function jalonsProduction(reception: ReceptionAsset) {
  const candidat = reception.fichiers.length > 0;
  const technique = candidat && reception.revision !== null && ['conforme', 'approuve', 'integre'].includes(reception.etat);
  const artistique = technique && ['approuve', 'integre'].includes(reception.etat) && reception.revue !== null;
  return { candidat, technique, artistique, enJeu: artistique && reception.etat === 'integre' && reception.revue?.decision === 'integre' };
}

/** Les candidats conformes attendent une revue ; ne jamais demander leur régénération. */
export function fileProduction(specs: readonly AssetSpec[], receptions: ReadonlyMap<string, ReceptionAsset>) {
  const approuves = new Set(specs.filter(s => {
    const r = receptions.get(s.id); return r && jalonsProduction(r).artistique;
  }).map(s => s.id));
  return chantier(specs, approuves).filter(e => receptions.get(e.spec.id)?.etat !== 'conforme');
}

export function manifesteAsset(spec: AssetSpec, reception: ReceptionAsset) {
  return {
    version: 1,
    nature: 'commande_de_production',
    asset: spec.id,
    spec,
    contrat: contratProduction(spec),
    baseRequise: baseRequise(spec),
    fichiersObligatoires: [
      ...spec.verification.lodRequis.map(lod => nomModele(spec, lod)),
      ...spec.textures.filter(t => t.obligatoire).map(t => nomTexture(spec, t.canal)),
    ],
    reception: { etat: reception.etat, revision: reception.revision, fichiers: reception.fichiers, motifs: reception.motifs, jalons: jalonsProduction(reception) },
    prompt: promptProduction(spec, reception.fichiers),
    avertissement: 'Cette commande et sa génération ne valent ni conformité technique ni approbation artistique. Les décisions restent liées à la révision du lot.',
  };
}
