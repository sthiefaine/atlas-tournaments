import Link from 'next/link';
import { t } from '@/i18n/index';
import campagne from '../../content/campagne.json';
import type { Epreuve } from './accueil-campagne';
import { libelleVersion, versionBuild } from './version';
import { MenuCampagne } from './menu-campagne';
import { PlateauAccueil } from './plateau-accueil';
import { Vitrine } from './vitrine';

/**
 * L'accueil : **un écran-titre de jeu**, pensé en portrait d'abord.
 *
 * La version d'origine était une page de présentation — bandeau de marque,
 * titre-slogan, pitch de deux cents caractères, trois liens soulignés, pied avec
 * frise et mentions. Sur un téléphone de 390 px, le seul bouton arrivait à
 * 711 px du haut et le plateau, qui est la seule chose qui montre le jeu, à
 * 805 px : deux écrans plus bas. Personne ne fait défiler un écran-titre.
 *
 * Quatre décisions la tiennent depuis :
 *
 * 1. **Le jeu est le fond, en plein cadre.** Une vraie partie jouée par l'IA
 *    tourne derrière le menu (`vitrine.tsx`, `attract.tsx`), assombrie aux bords
 *    par une nappe en dégradé plutôt qu'enfermée dans un cadre : on n'encadre
 *    pas une capture d'écran de son propre jeu sur son écran-titre.
 * 2. **Un menu ancré en bas.** Sur un téléphone tenu à une main, tout ce qui est
 *    au-dessus de 560 px du bord inférieur est hors de portée du pouce.
 *    L'enseigne y va, le menu jamais. Campagne domine : c'est le seul geste
 *    qu'on répète.
 * 3. **Un écran, pas de défilement.** Ce qui ne tient pas est supprimé, pas
 *    repoussé sous la ligne de flottaison.
 * 4. **Le vocabulaire du HUD** — encre, papier, signal, coins coupés au
 *    `clip-path`, ombres dures : entrer en jeu ne doit pas être un changement
 *    d'univers.
 *
 * ## Ce que la revue du 8 septembre 2026 a changé
 *
 * Verdict du propriétaire sur l'interface entière : « ça fait pas jeu, ça fait
 * blog ». Deux personas — un ado, un joueur d'Advance Wars — ont lu le code de
 * cet écran ; quatre de leurs reproches portaient sur ce fichier, et les quatre
 * disaient la même chose : **il restait des phrases là où un écran-titre ne
 * porte que des étiquettes.**
 *
 * - **L'accroche est partie.** Un paragraphe de vente sous le nom du jeu — « Les
 *   guerres sont finies. Reste le tournoi. » — est une ligne de page d'accueil,
 *   pas d'écran-titre : sur un écran-titre on ne lit pas, on choisit. Elle vit
 *   toujours dans le canon (`accueil.accroche`) pour le jour où le carnet ou la
 *   Dépêche en auront l'usage, là où elle s'adresse à quelqu'un qui a joué.
 * - **Une seule sous-ligne, celle de Campagne.** Chaque bouton portait un nom
 *   *et* une note de 12,5 px : quatre boutons, huit lignes, un menu de réglages.
 *   Pire, la feuille de style les faisait disparaître en paysage court — une
 *   information qui dépend de la taille de la fenêtre n'en est pas une, c'est du
 *   remplissage. Seule Campagne garde la sienne, parce qu'elle porte un **état**
 *   qui change : l'épreuve où l'on en est.
 * - **Les vignettes ont disparu avec elles.** Trois glyphes SVG sur quatre
 *   entrées, c'était de l'iconographie d'application ; le seul repère qu'un menu
 *   de jeu demande est le **curseur** posé sur l'entrée visée, et il est
 *   désormais en CSS, sur l'entrée survolée ou au clavier.
 * - **« Atelier des mondes » mentait.** Le mot promet un éditeur ; la page est un
 *   banc d'essai — on y regarde biomes, saisons, météo et silhouettes, on n'y
 *   compose rien (`CLAUDE.md`, manque n° 13). Un écran-titre n'a pas le droit de
 *   se tromper sur ce que fait un bouton : c'est « Banc d'essai ».
 *
 * La page est un composant serveur. Seul le bouton Campagne est client, parce
 * qu'il lit `localStorage` ; on lui passe des libellés déjà traduits.
 */

export default function Accueil() {
  const locale = 'fr';
  const epreuves: Epreuve[] = campagne.missions.map((m) => ({ cle: m.scenarioCle, titre: m.titre }));
  const total = epreuves.length;
  // La mention de version : calculée au build, vide si le build n'a rien laissé.
  const version = versionBuild();
  const mention = libelleVersion(locale, 'accueil', version);

  return <main className="atlas-accueil">
    <Vitrine><PlateauAccueil locale={locale} /></Vitrine>

    <div className="accueil-nappe" aria-hidden="true" />

    {/* L'enseigne, pas un titre d'article : un surtitre qui dit le genre, le nom
        du jeu frappé en dur, et la plaque qui le verrouille en une seule forme. */}
    <header className="accueil-enseigne">
      <p className="accueil-genre">{t(locale, 'accueil.genre_court')}</p>
      <h1 className="accueil-marque">
        <span className="marque-nom">{t(locale, 'accueil.nom_haut')}</span>
        <span className="marque-plaque">{t(locale, 'accueil.nom_bas')}</span>
      </h1>
    </header>

    <nav className="accueil-menu" aria-label={t(locale, 'accueil.menu')}>
      <MenuCampagne
        epreuves={epreuves}
        libelles={{
          campagne: t(locale, 'accueil.menu_campagne'),
          carnet: t(locale, 'accueil.carnet'),
          neuf: t(locale, 'accueil.campagne_neuf'),
          fini: t(locale, 'accueil.campagne_fini'),
          etat: epreuves.map((_, n) => t(locale, 'accueil.campagne_etat', {
            n, total, epreuve: epreuves[n]?.titre ?? '',
          })),
          profilA: t(locale, 'reglages.profil_a'),
          profilB: t(locale, 'reglages.profil_b'),
          profilActif: t(locale, 'accueil.profil_actif'),
          choisir: t(locale, 'accueil.choisir_sauvegarde'),
          retour: t(locale, 'menu.retour'),
        }}
      />

      <Link className="menu-bouton" href="/jeu">
        <span className="menu-libelle">{t(locale, 'accueil.menu_jeu_libre')}</span>
      </Link>

      <div className="accueil-menu-rang">
        {/* « Banc d'essai » et non « Atelier des mondes » : la page ne compose
            aucun monde, elle les montre. */}
        <Link className="menu-bouton menu-petit" href="/atelier">
          <span className="menu-libelle">{t(locale, 'accueil.menu_banc')}</span>
        </Link>

        <Link className="menu-bouton menu-petit" href="/reglages">
          <span className="menu-libelle">{t(locale, 'accueil.menu_reglages')}</span>
        </Link>
      </div>
    </nav>

    {/* Le tampon de build, pas une mention légale : la même chose qu'un numéro de
        version dans le coin d'un écran-titre de console. Il reste dans le flux,
        jamais en `position:fixed` — la rétraction de la barre d'adresse iOS fait
        sauter un élément fixe. */}
    {mention !== '' && (
      <p className="accueil-tampon" title={version.date ?? undefined}>{mention}</p>
    )}
  </main>;
}
