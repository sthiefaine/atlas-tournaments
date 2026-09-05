import Link from 'next/link';
import { t } from '@/i18n/index';
import campagne from '../../content/campagne.json';
import { MenuCampagne, type Epreuve } from './menu-campagne';
import { PlateauAccueil } from './plateau-accueil';
import { Vitrine } from './vitrine';

/**
 * L'accueil : **un écran-titre de jeu**, pensé en portrait d'abord.
 *
 * La version précédente était une page de présentation — bandeau de marque,
 * titre-slogan, pitch de deux cents caractères, trois liens soulignés, pied avec
 * frise et mentions. Sur un téléphone de 390 px, le seul bouton arrivait à
 * 711 px du haut et le plateau, qui est la seule chose qui montre le jeu, à
 * 805 px : deux écrans plus bas. Personne ne fait défiler un écran-titre.
 *
 * Quatre décisions la tiennent :
 *
 * 1. **Le jeu est le fond, en plein cadre.** Une vraie partie jouée par l'IA
 *    tourne derrière le menu (`vitrine.tsx`, `attract.tsx`), assombrie aux bords
 *    par une nappe en dégradé plutôt qu'enfermée dans un cadre : on n'encadre
 *    pas une capture d'écran de son propre jeu sur son écran-titre.
 * 2. **Quatre boutons, ancrés en bas.** Sur un téléphone tenu à une main, tout
 *    ce qui est au-dessus de 560 px du bas est hors de portée du pouce. Le titre
 *    y va, le menu non. Campagne domine : c'est le seul geste qu'on répète.
 * 3. **Un écran, pas de défilement.** Ce qui ne tient pas est supprimé, pas
 *    repoussé sous la ligne de flottaison. Le pitch et la frise des vingt-quatre
 *    nations ne sont pas perdus : ils appartiennent au carnet, où ils disent
 *    quelque chose à quelqu'un qui a déjà joué.
 * 4. **Le vocabulaire du HUD** — encre, papier, signal, biseaux au `clip-path`,
 *    ombres dures : entrer en jeu ne doit pas être un changement d'univers.
 *
 * La page est un composant serveur. Seul le bouton Campagne est client, parce
 * qu'il lit `localStorage` ; on lui passe des libellés déjà traduits.
 */

export default function Accueil() {
  const locale = 'fr';
  const epreuves: Epreuve[] = campagne.missions.map((m) => ({ cle: m.scenarioCle, titre: m.titre }));
  const total = epreuves.length;

  return <main className="atlas-accueil">
    <Vitrine><PlateauAccueil locale={locale} /></Vitrine>

    <div className="accueil-nappe" aria-hidden="true" />

    <header className="accueil-titre">
      <p className="atlas-etiquette">{t(locale, 'accueil.genre_court')}</p>
      <h1>
        <span className="titre-haut">{t(locale, 'accueil.nom_haut')}</span>
        <span className="titre-filet" aria-hidden="true" />
        <span className="titre-bas">{t(locale, 'accueil.nom_bas')}</span>
      </h1>
      <p className="accueil-accroche">{t(locale, 'accueil.accroche')}</p>
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
        }}
      />

      <Link className="menu-bouton" href="/jeu/demo">
        <svg className="menu-glyphe" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 8h5v8H4zM15 8h5v8h-5z" fill="currentColor" />
          <path d="M10.5 12h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="menu-texte">
          <strong>{t(locale, 'accueil.menu_jeu_libre')}</strong>
          <span className="menu-note">{t(locale, 'accueil.jeu_libre_note')}</span>
        </span>
      </Link>

      <div className="accueil-menu-rang">
        <Link className="menu-bouton menu-petit" href="/atelier">
          <svg className="menu-glyphe" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3l9 9-9 9-9-9z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="2.4" fill="currentColor" />
          </svg>
          <span className="menu-texte">
            <strong>{t(locale, 'campagne.atelier')}</strong>
            <span className="menu-note">{t(locale, 'accueil.atelier_note')}</span>
          </span>
        </Link>

        <Link className="menu-bouton menu-petit" href="/reglages">
          <svg className="menu-glyphe" viewBox="0 0 24 24" aria-hidden="true">
            <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </g>
            <g fill="currentColor">
              <circle cx="9" cy="7" r="2.2" /><circle cx="15" cy="12" r="2.2" /><circle cx="8" cy="17" r="2.2" />
            </g>
          </svg>
          <span className="menu-texte">
            <strong>{t(locale, 'accueil.menu_reglages')}</strong>
            <span className="menu-note">{t(locale, 'accueil.reglages_note')}</span>
          </span>
        </Link>
      </div>
    </nav>
  </main>;
}
