import Link from 'next/link';
import { t } from '@/i18n/index';
import campagne from '../../content/campagne.json';
import { Convocation, type Epreuve } from './convocation';
import { PlateauAccueil } from './plateau-accueil';
import { Vitrine } from './vitrine';

/**
 * L'accueil : **l'écran-titre**, pas une page de présentation.
 *
 * Trois décisions le tiennent :
 *
 * 1. **on montre le jeu** — le plateau est le fond, avec sa grammaire réelle
 *    (vert, j'y vais ; rouge, j'y tire), parce qu'un écran-titre qui décrit un
 *    jeu au lieu de le montrer ne convainc personne ;
 * 2. **un seul geste** — un bouton, qui mène droit à l'épreuve suivante et non
 *    à une seconde page de choix. Le carnet, le match libre et l'atelier sont
 *    des liens de service ; l'administration n'est pas sur la page publique ;
 * 3. **le vocabulaire du HUD** — encre, papier, signal, biseaux et ombres
 *    dures : entrer en jeu ne doit pas être un changement d'univers.
 *
 * La page est un composant serveur. Seule la convocation est cliente, parce
 * qu'elle lit `localStorage` ; on lui passe des libellés déjà traduits.
 */

/** La France dans la frise des vingt-quatre : c'est d'elle que tout part. */
const RANG_FRANCE = 7;

/** Nombre de nations de la Ronde (`content/pays/`, `BRIEF.md`). */
const NATIONS = 24;

export default function Accueil() {
  const locale = 'fr';
  const epreuves: Epreuve[] = campagne.missions.map((m) => ({
    cle: m.scenarioCle,
    titre: m.titre,
    biome: t(locale, `biome.${m.biome}`),
  }));

  return <main className="atlas-accueil">
    <header className="accueil-bandeau">
      <span className="accueil-marque">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1l7 7-7 7-7-7z" fill="currentColor" /></svg>
        {t(locale, 'app.titre')}
      </span>
      <span className="accueil-baseline">{t(locale, 'app.baseline')}</span>
    </header>

    <div className="accueil-corps">
      <section className="accueil-identite">
        <p className="atlas-etiquette accueil-genre">{t(locale, 'accueil.genre')}</p>
        <h1>
          <span className="accueil-reserve">{t(locale, 'accueil.titre_haut')}</span>
          <span className="accueil-libre">{t(locale, 'accueil.titre_bas')}</span>
        </h1>
        <p className="accueil-pitch">{t(locale, 'accueil.pitch')}</p>
        <nav className="accueil-annexes">
          <Link href="/campagne">{t(locale, 'campagne.retour')}</Link>
          <Link href="/jeu/demo">{t(locale, 'accueil.match_libre')}</Link>
          <Link href="/atelier">{t(locale, 'campagne.atelier')}</Link>
        </nav>
      </section>

      <div className="accueil-colonne">
        <Vitrine><PlateauAccueil locale={locale} /></Vitrine>
        <Convocation
          epreuves={epreuves}
          libelles={{
            carnet: t(locale, 'accueil.carnet_titre'),
            prochaine: t(locale, 'accueil.prochaine'),
            terminee: t(locale, 'campagne.fin'),
            entrer: t(locale, 'accueil.entrer'),
            reprendre: t(locale, 'accueil.reprendre'),
            rejouer: t(locale, 'accueil.rejouer'),
            progression: Array.from(
              { length: epreuves.length + 1 },
              (_, n) => t(locale, 'campagne.progression', { n, total: epreuves.length }),
            ),
          }}
        />
      </div>
    </div>

    <footer className="accueil-pied">
      <svg className="accueil-frise" viewBox="0 0 700 26" role="img" aria-labelledby="frise-titre">
        <title id="frise-titre">{t(locale, 'accueil.frise_titre')}</title>
        <g aria-hidden="true">
          <path d="M4 13h692" stroke="#f4edda" strokeOpacity=".14" strokeWidth="1" />
          {Array.from({ length: NATIONS }, (_, i) => {
            const x = 14 + i * ((700 - 28) / (NATIONS - 1));
            return i === RANG_FRANCE
              ? <g key={i}>
                <circle cx={x} cy={13} r={9} fill="none" stroke="#ffd162" strokeWidth="2" />
                <circle cx={x} cy={13} r={5} fill="#ffd162" />
              </g>
              : <circle key={i} cx={x} cy={13} r={4} fill="#f4edda" fillOpacity=".24" />;
          })}
        </g>
      </svg>
      <p className="accueil-legende">{t(locale, 'accueil.frise_legende')}</p>
      <p className="accueil-mention">{t(locale, 'accueil.sans_compte')}</p>
    </footer>
  </main>;
}
