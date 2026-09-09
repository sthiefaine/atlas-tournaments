/** Vérités du canon côté serveur. La route publique générique ne sert pas ce fichier. */
import donnees from '../../content/personnages.json';
export interface FaitPersonnage { cle: string; repere: string; acteRevelation: number; fait: string; source: string }
export interface PersonnageHistorique { cle: string; nom: string; fonction: string; motivation: string; croyance: string; liens: string[]; historique: FaitPersonnage[] }
export function personnagesCanon(): readonly PersonnageHistorique[] { return donnees.personnages; }
/** Contexte éditorial filtré, pas une autorisation de révéler des secrets à un joueur. */
export function personnagesPourActe(acte: number) {
  if (![0, 1, 2, 3].includes(acte)) throw new Error('Acte narratif invalide');
  return { version: donnees.version, programme: donnees.programme, acte, personnages: personnagesCanon().map(p => ({ cle: p.cle, nom: p.nom, fonction: p.fonction, ...(acte === 3 ? { motivation: p.motivation, croyance: p.croyance, liens: p.liens } : {}), historique: p.historique.filter(f => f.acteRevelation <= acte) })) };
}
