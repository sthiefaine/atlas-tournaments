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
 * **Trois panneaux, et chacun a un titre.** Il y en avait quatre, dont le
 * premier sans titre du tout — trois interrupteurs posés dans une boîte anonyme,
 * puis la qualité, puis les profils, puis la progression, alors que les deux
 * derniers parlent de la même chose. Ils disent maintenant : ce qui se passe *en
 * partie* (dialogues, écran de combat), ce que l'*affichage* coûte (qualité,
 * animations réduites), et les *sauvegardes* — les deux profils de l'appareil,
 * leur nom, ce qu'ils contiennent, et leur effacement.
 *
 * Le choix de sauvegarde vit désormais sur l'écran-titre : appuyer sur Campagne
 * ouvre les deux et lance celle qu'on désigne. Ce panneau ne fait donc plus
 * doublon avec lui — il ne sert pas à *jouer* l'une ou l'autre, il sert à les
 * **nommer**, à voir ce qu'elles contiennent, et à en effacer une. On n'affiche
 * pas d'interrupteur inerte : il n'y a pas d'audio dans le jeu, il n'y a donc pas
 * de réglage de son, même si c'est le premier qu'un joueur cherche.
 */

export const metadata = { title: 'Réglages · Atlas' };

export default function PageReglages(): React.ReactElement {
  const locale = 'fr';
  return <Reglages libelles={{
    difficulte: t(locale, 'mode.titre'),
    difficulteNote: t(locale, 'mode.note'),
    victoiresModes: t(locale, 'mode.victoires'),
    normal: t(locale, 'mode.normal'),
    difficile: t(locale, 'mode.difficile'),
    titre: t(locale, 'reglages.titre'),
    retour: t(locale, 'reglages.retour'),
    enPartie: t(locale, 'reglages.en_partie'),
    dialogues: t(locale, 'reglages.dialogues'),
    dialoguesNote: t(locale, 'reglages.dialogues_note'),
    animations: t(locale, 'reglages.animations'),
    animationsNote: t(locale, 'reglages.animations_note'),
    vitesse: t(locale, 'reglages.vitesse'),
    vitesseNote: t(locale, 'reglages.vitesse_note'),
    vitesseNormale: t(locale, 'reglages.vitesse_normale'),
    vitesseRapide: t(locale, 'reglages.vitesse_rapide'),
    vitesseInstantanee: t(locale, 'reglages.vitesse_instantanee'),
    ecranCombat: t(locale, 'reglages.ecran_combat'),
    ecranCombatNote: t(locale, 'reglages.ecran_combat_note'),
    affichage: t(locale, 'reglages.affichage'),
    qualite: t(locale, 'reglages.qualite'),
    qualiteNote: t(locale, 'reglages.qualite_note'),
    qualiteAuto: t(locale, 'reglages.qualite_auto'),
    qualiteBasse: t(locale, 'reglages.qualite_basse'),
    actif: t(locale, 'reglages.actif'),
    inactif: t(locale, 'reglages.inactif'),
    sauvegardes: t(locale, 'reglages.sauvegardes'),
    profils: t(locale, 'reglages.profils'),
    profilsNote: t(locale, 'reglages.profils_note'),
    profilA: t(locale, 'reglages.profil_a'),
    profilB: t(locale, 'reglages.profil_b'),
    profilActif: t(locale, 'reglages.profil_actif'),
    profilNom: t(locale, 'reglages.profil_nom'),
    profilNomNote: t(locale, 'reglages.profil_nom_note'),
    // Les marqueurs `{victoires}` et `{parties}` sont laissés tels quels :
    // l'îlot les remplit lui-même, il ne connaît les chiffres qu'après montage.
    profilBilan: t(locale, 'reglages.profil_bilan'),
    profilVide: t(locale, 'reglages.profil_vide'),
    stockageOk: t(locale, 'reglages.stockage_ok'),
    stockageKo: t(locale, 'reglages.stockage_ko'),
    effacer: t(locale, 'reglages.effacer'),
    effacerNote: t(locale, 'reglages.effacer_note'),
    effacerProfil: t(locale, 'reglages.effacer_profil'),
    effacerConfirmer: t(locale, 'reglages.effacer_confirmer'),
    annuler: t(locale, 'reglages.annuler'),
    // Contient `{nom}`, le nom du profil actif.
    efface: t(locale, 'reglages.efface'),
    effaceBilan: t(locale, 'reglages.efface_bilan'),
    effaceKo: t(locale, 'reglages.efface_ko'),
    version: libelleVersion(locale, 'reglages', versionBuild()),
  }} />;
}
