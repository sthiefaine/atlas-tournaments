import { t } from '@/i18n/index';
import { libelleVersion, versionBuild } from '../version';
import Reglages from './reglages';

/**
 * Les réglages : une **vraie page**, avec une URL et un retour, pas une modale.
 *
 * Le menu-titre y mène par un bouton ; un bouton doit mener quelque part d'où
 * l'on revient par le geste habituel du navigateur. Comme partout ailleurs, la
 * page est un composant serveur qui passe des **libellés déjà traduits** à un
 * îlot client — celui-ci l'est parce qu'il lit et écrit `localStorage`.
 *
 * Quatre groupes, et ce sont ceux qui existent réellement dans le code : les
 * trois interrupteurs (dialogues, animations réduites, écran de combat), la qualité d'affichage (elle pilote la chaîne de
 * post-traitement du rendu, `render/qualite.ts`), les deux profils de
 * l'appareil, la progression. On n'affiche pas d'interrupteur inerte : il n'y a
 * pas d'audio dans le jeu, il n'y a donc pas de réglage de son, même si c'est le
 * premier qu'un joueur cherche.
 */

export const metadata = { title: 'Réglages · Atlas' };

export default function PageReglages(): React.ReactElement {
  const locale = 'fr';
  return <Reglages libelles={{
    titre: t(locale, 'reglages.titre'),
    retour: t(locale, 'reglages.retour'),
    dialogues: t(locale, 'reglages.dialogues'),
    dialoguesNote: t(locale, 'reglages.dialogues_note'),
    animations: t(locale, 'reglages.animations'),
    animationsNote: t(locale, 'reglages.animations_note'),
    ecranCombat: t(locale, 'reglages.ecran_combat'),
    ecranCombatNote: t(locale, 'reglages.ecran_combat_note'),
    qualite: t(locale, 'reglages.qualite'),
    qualiteNote: t(locale, 'reglages.qualite_note'),
    qualiteAuto: t(locale, 'reglages.qualite_auto'),
    qualiteBasse: t(locale, 'reglages.qualite_basse'),
    actif: t(locale, 'reglages.actif'),
    inactif: t(locale, 'reglages.inactif'),
    profils: t(locale, 'reglages.profils'),
    profilsNote: t(locale, 'reglages.profils_note'),
    profilA: t(locale, 'reglages.profil_a'),
    profilB: t(locale, 'reglages.profil_b'),
    profilActif: t(locale, 'reglages.profil_actif'),
    profilNom: t(locale, 'reglages.profil_nom'),
    profilNomNote: t(locale, 'reglages.profil_nom_note'),
    stockage: t(locale, 'reglages.stockage'),
    stockageOk: t(locale, 'reglages.stockage_ok'),
    stockageKo: t(locale, 'reglages.stockage_ko'),
    effacer: t(locale, 'reglages.effacer'),
    effacerNote: t(locale, 'reglages.effacer_note'),
    effacerProfil: t(locale, 'reglages.effacer_profil'),
    effacerConfirmer: t(locale, 'reglages.effacer_confirmer'),
    annuler: t(locale, 'reglages.annuler'),
    // Les marqueurs `{nom}`, `{victoires}` et `{parties}` sont laissés tels
    // quels : l'îlot les remplit lui-même, il ne connaît les chiffres qu'après.
    efface: t(locale, 'reglages.efface'),
    effaceBilan: t(locale, 'reglages.efface_bilan'),
    effaceKo: t(locale, 'reglages.efface_ko'),
    version: libelleVersion(locale, 'reglages', versionBuild()),
  }} />;
}
