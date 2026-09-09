/** Vérités du canon côté serveur. La route publique générique ne sert pas ce fichier. */
import donnees from '../../content/personnages.json';
export interface FaitPersonnage { cle: string; repere: string; acteRevelation: number; fait: string; source: string; confidentialite?: string; jalonRevelation?: string }
export interface PersonnageHistorique { paysCode?: string; premierPlan?: boolean; role?: string; cle: string; nom: string; fonction: string; motivation: string; croyance: string; liens: string[]; historique: FaitPersonnage[]; identiteTactique?: { style: string; faiblesse: string; dilemme: string; mission: string } }
export function personnagesCanon(): readonly PersonnageHistorique[] { return donnees.personnages; }
/** Un acte est trop grossier pour autoriser un jalon tardif ou les notes auteur. */
export function faitVisiblePourActe(fait: FaitPersonnage, acte: number): boolean {
  return (fait.confidentialite === undefined || fait.confidentialite === 'public')
    && fait.jalonRevelation === undefined && fait.acteRevelation <= acte;
}
/** Composition explicite : aucune donnée auteur ajoutée ne fuit par propagation. */
export function filtrerPersonnagesPourActe(personnages: readonly PersonnageHistorique[], acte: number) {
  if (![0, 1, 2, 3].includes(acte)) throw new Error('Acte narratif invalide');
  return personnages.map(p => ({
    cle: p.cle, nom: p.nom, fonction: p.fonction,
    ...(acte === 3 ? {motivation:p.motivation, croyance:p.croyance, liens:p.liens, identiteTactique:p.identiteTactique} : {}),
    historique: p.historique.filter(f => faitVisiblePourActe(f,acte)).map(f => ({
      cle:f.cle, repere:f.repere, acteRevelation:f.acteRevelation, fait:f.fait, source:f.source,
    })),
  }));
}
/** Contexte éditorial filtré, pas une autorisation de révéler des secrets à un joueur.
 * Les jalons demandent une future vérification serveur de progression : ?acte=3
 * ne révèle jamais S5E4, et aucun paramètre client ne permet de forcer ce jalon.
 */
export function personnagesPourActe(acte: number) {
  return {version:donnees.version, programme:donnees.programme, acte, personnages:filtrerPersonnagesPourActe(personnagesCanon(),acte)};
}
