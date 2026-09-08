'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { t } from '@/i18n/index';
import campagne from '../../../content/campagne.json';
import { lireProgression, type Progression } from './progression';
import { etatStation, nomCourt, stationParDefaut } from './itineraire';
import { GESTES_PRECHARGEMENT } from '../jeu/precharger';

/**
 * Le **fil de la campagne** : un itinéraire, pas un sommaire.
 *
 * Il était une liste : une colonne de prose à 1040 px, six `<li>` numérotés
 * « 01 » à « 06 » séparés par des filets gris, un paragraphe de récit chacun, et
 * un bouton vert arrondi. C'était un article — et c'était le seul écran du jeu
 * à n'avoir **aucun fond à lui** : il héritait du `body` de Tailwind, donc blanc
 * en thème clair et suivant le réglage du système, quand tout le reste est à
 * l'encre. On sortait d'un écran-titre sombre où un plateau 3D joue tout seul,
 * et on tombait sur une page blanche.
 *
 * Trois décisions le remplacent :
 *
 * 1. **Un itinéraire.** Six stations sur une ligne, dans l'ordre du voyage, avec
 *    trois états qui se lisent sans lire : remportée (pleine, en signal, cochée),
 *    ouverte (creuse, cerclée de signal, la seule qui respire), verrouillée
 *    (éteinte, son trait resté gris). Chacun change de **peinture** : une
 *    opacité sur du texte ne dit pas « verrouillé », elle dit « délavé ».
 * 2. **Un dossier à la fois.** La station choisie ouvre sa fiche dessous ; les
 *    cinq autres sont des jalons. Six récits de même poids visuel ne se lisent
 *    pas, et surtout ils s'interposent entre le joueur et le bouton.
 * 3. **Le vocabulaire du jeu** : encre, papier, signal, biseaux, ombres dures et
 *    sans flou, et la jauge à six segments **littéralement celle** du bouton
 *    Campagne de l'écran-titre. Entrer dans la campagne ne doit pas être un
 *    changement d'univers.
 *
 * Le glossaire des biomes est parti : c'était un glossaire en pied d'un écran de
 * choix, et il tirait tout `mapgen/parametres` dans le lot de cette page.
 *
 * Le sens de l'hydratation reste à sens unique, comme pour le bouton Campagne
 * (`menu-campagne.tsx`) : le serveur rend l'état **neutre** — première épreuve
 * ouverte, aucune victoire —, le client l'enrichit après montage. Jamais
 * l'inverse : afficher « remportée » puis se raviser serait pire que d'attendre.
 */

const codes = campagne.missions.map((m) => m.scenarioCle);

export default function Carnet() {
  const [progression, setProgression] = useState<Progression>({ version: 1, victoires: [] });
  const [pret, setPret] = useState(false);
  // La station que le joueur a choisie ; tant qu'il n'a rien choisi, c'est la
  // prochaine à jouer qui s'ouvre — c'est ce qu'il vient chercher neuf fois sur dix.
  const [choisie, setChoisie] = useState<number | null>(null);

  useEffect(() => {
    const lire = (): void => { setProgression(lireProgression()); setPret(true); };
    lire();
    window.addEventListener('pageshow', lire);
    window.addEventListener('storage', lire);
    return () => {
      window.removeEventListener('pageshow', lire);
      window.removeEventListener('storage', lire);
    };
  }, []);

  const etatDe = (index: number) => etatStation(codes, index, progression.victoires, pret);
  const gagnees = codes.filter((c) => progression.victoires.includes(c)).length;
  const active = choisie ?? stationParDefaut(codes, progression.victoires);
  const mission = campagne.missions[active];
  const etat = etatDe(active);
  const complet = gagnees === codes.length;

  return <main className="atlas-carnet">
    <header className="carnet-entete">
      <div className="carnet-titre">
        <p className="atlas-etiquette">{t('fr', 'campagne.surtitre')}</p>
        <h1>{campagne.titre}</h1>
        {/* La seule phrase de l'écran, et elle porte une règle qu'on ne devine
            pas : ce que vise un objectif est peint en or sur le terrain. */}
        <p className="carnet-accroche">{campagne.introduction}</p>
      </div>
      <Link className="carnet-retour" href="/">{t('fr', 'menu.retour')}</Link>
    </header>

    <p className="carnet-avancee">
      <span className="carnet-jauge" aria-hidden="true">
        {campagne.missions.map((m, i) => <i key={m.scenarioCle} className={i < gagnees ? 'faite' : ''} />)}
      </span>
      <span>{t('fr', 'campagne.progression', { n: gagnees, total: codes.length })}</span>
    </p>

    <nav className="carnet-route" aria-label={t('fr', 'campagne.itineraire')}>
      <ol>
        {campagne.missions.map((m, i) => {
          const e = etatDe(i);
          // L'état est peint sur la station ; il est aussi **dit**, parce qu'une
          // peinture ne se lit pas à la voix et qu'un losange plein ne prononce
          // pas « remportée ».
          const etatDit = t('fr', e === 'gagnee' ? 'campagne.gagnee' : e === 'ouverte' ? 'campagne.disponible' : 'campagne.verrouillee');
          return <li key={m.scenarioCle} data-etat={e}>
            <button
              type="button"
              className="station"
              data-etat={e}
              aria-current={i === active ? 'step' : undefined}
              aria-label={`${t('fr', 'campagne.mission', { n: i + 1 })} · ${nomCourt(m.titre)} · ${etatDit}`}
              onClick={() => setChoisie(i)}
            >
              <span className="station-losange" aria-hidden="true">
                <b>{i + 1}</b>
              </span>
              <span className="station-nom">{nomCourt(m.titre)}</span>
            </button>
          </li>;
        })}
      </ol>
    </nav>

    {mission ? <section className="carnet-dossier" data-etat={etat} aria-live="polite">
      <p className="atlas-etiquette dossier-rang">
        <span>{t('fr', 'campagne.mission', { n: active + 1 })}</span>
        <span>{t('fr', mission.entrainement ? 'campagne.entrainement' : 'campagne.officiel')}</span>
        <span>{t('fr', `biome.${mission.biome}`)}</span>
        <span className="dossier-plaque" data-etat={etat}>
          {t('fr', etat === 'gagnee' ? 'campagne.gagnee' : etat === 'ouverte' ? 'campagne.disponible' : 'campagne.verrouillee')}
        </span>
      </p>
      <h2>{mission.titre}</h2>
      <p className="dossier-objectif">
        <span className="atlas-etiquette">{t('fr', 'campagne.objectif')}</span>
        {mission.objectif}
      </p>
      <p className="dossier-recit">{mission.recit}</p>
      <div className="dossier-actions">
        {etat === 'verrouillee'
          ? <p className="dossier-verrou">{t('fr', 'campagne.verrouillee')}</p>
          : <Link className="atlas-bouton" href={`/jeu/${mission.scenarioCle}`} {...GESTES_PRECHARGEMENT}>
            {t('fr', etat === 'gagnee' ? 'campagne.rejouer' : 'campagne.jouer')}
          </Link>}
      </div>
    </section> : null}

    <footer className="carnet-pied">
      {complet ? <p className="carnet-fin">{t('fr', 'campagne.fin')}</p> : null}
      <p>{t('fr', 'campagne.sauvegarde')}</p>
      <Link href="/jeu">{t('fr', 'campagne.demo')}</Link>
    </footer>
  </main>;
}
