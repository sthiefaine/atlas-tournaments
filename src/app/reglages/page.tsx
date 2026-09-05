import { t } from '@/i18n/index';
import Reglages from './reglages';

/**
 * Les réglages : une **vraie page**, avec une URL et un retour, pas une modale.
 *
 * Le menu-titre y mène par un bouton ; un bouton doit mener quelque part d'où
 * l'on revient par le geste habituel du navigateur. Comme partout ailleurs, la
 * page est un composant serveur qui passe des **libellés déjà traduits** à un
 * îlot client — celui-ci l'est parce qu'il lit et écrit `localStorage`.
 *
 * Trois réglages seulement, et ce sont les trois qui existent réellement dans
 * le code. On n'affiche pas d'interrupteur inerte : il n'y a pas d'audio dans le
 * jeu, il n'y a donc pas de réglage de son, même si c'est le premier qu'un
 * joueur cherche.
 */

export const metadata = { title: 'Réglages · Atlas' };

export default function PageReglages(): React.ReactElement {
  const locale = 'fr';
  return <Reglages libelles={{
    titre: t(locale, 'reglages.titre'),
    retour: t(locale, 'reglages.retour'),
    affichage: t(locale, 'reglages.affichage'),
    affichageNote: t(locale, 'reglages.affichage_note'),
    rendus: [
      { valeur: 'auto', libelle: t(locale, 'reglages.affichage_auto') },
      { valeur: '3d', libelle: t(locale, 'reglages.affichage_3d') },
      { valeur: '2d', libelle: t(locale, 'reglages.affichage_2d') },
    ],
    dialogues: t(locale, 'reglages.dialogues'),
    dialoguesNote: t(locale, 'reglages.dialogues_note'),
    animations: t(locale, 'reglages.animations'),
    animationsNote: t(locale, 'reglages.animations_note'),
    actif: t(locale, 'reglages.actif'),
    inactif: t(locale, 'reglages.inactif'),
    stockage: t(locale, 'reglages.stockage'),
    stockageOk: t(locale, 'reglages.stockage_ok'),
    stockageKo: t(locale, 'reglages.stockage_ko'),
    effacer: t(locale, 'reglages.effacer'),
    effacerNote: t(locale, 'reglages.effacer_note'),
    effacerConfirmer: t(locale, 'reglages.effacer_confirmer'),
    annuler: t(locale, 'reglages.annuler'),
    efface: t(locale, 'reglages.efface'),
  }} />;
}
