/**
 * `serveur/controle/` — la moitié « gardien » du serveur.
 *
 * La routine `atlas_controle` ne fait tourner aucun code : elle demande, elle
 * lit, elle arbitre (`05-routines.md` §4.1). Tout ce qui est calculable est
 * calculé ici : les vérifications structurelles d'une carte
 * (`verifierCarteControle`, reproductibilité comprise) et les seuils qui
 * transforment une campagne de simulation en `ReviewVerdict` (`rendreVerdict`).
 */

export {
  reproductible, verifierCarteControle, type RapportControle,
} from './verifications';
export {
  GRAVITE_MOTIF, MOTIFS_MAX, motifsDeCatalogue, motifsDeSimulation, ordonnerMotifs,
  rendreVerdict, SEUILS_CONTROLE,
  type CibleControle, type Gravite, type Motif,
} from './verdict';
