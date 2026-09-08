'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GESTES_PRECHARGEMENT } from '../jeu/precharger';
import type { Vignette } from '../jeu/parties-libres';
import { lireProfils, type EtatProfils } from '../preferences';
import { etatsItineraire, stationParDefaut, type EtatStation } from './itineraire';
import { lireProgression, type Progression } from './progression';

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
 * Quatre décisions le remplacent :
 *
 * 1. **Un itinéraire.** Six stations sur une ligne, dans l'ordre du voyage, avec
 *    trois états qui se lisent sans lire : remportée (pleine, en signal, cochée),
 *    ouverte (creuse, cerclée de signal, la seule qui respire), verrouillée
 *    (éteinte et **hachurée**, son trait resté gris). Chacun change de
 *    **peinture** : une opacité sur du texte ne dit pas « verrouillé », elle dit
 *    « délavé ».
 * 2. **Un dossier à la fois**, et c'est un briefing : la carte de l'épreuve,
 *    l'objectif, puis les faits qui décident d'une approche — taille, adversaire,
 *    brouillard, limite de journées. Six récits de même poids visuel ne se lisent
 *    pas, et surtout ils s'interposent entre le joueur et le bouton.
 * 3. **Le vocabulaire du jeu** : encre, papier, signal, biseaux, ombres dures et
 *    sans flou, et la jauge à six segments **littéralement celle** du bouton
 *    Campagne de l'écran-titre. Entrer dans la campagne ne doit pas être un
 *    changement d'univers.
 * 4. **Rien de traduit ici.** Ce fichier ne connaît ni le canon ni `t()` : la
 *    page serveur lui passe des libellés prêts et les cartes déjà réduites à des
 *    tracés teints. Il est client parce qu'il lit `localStorage`, et pour cela
 *    seulement — avant, `t()` appelé ici embarquait les 379 chaînes d'interface
 *    dans le lot d'une page de texte.
 *
 * Le sens de l'hydratation reste à sens unique, comme pour le bouton Campagne
 * (`menu-campagne.tsx`) : le serveur rend l'état **neutre** — première épreuve
 * ouverte, aucune victoire —, le client l'enrichit après montage. Jamais
 * l'inverse : afficher « remportée » puis se raviser serait pire que d'attendre.
 */

/** Une épreuve, réduite à ce que le carnet affiche. Tout est déjà traduit. */
export interface EpreuveCarnet {
  cle: string;
  /** « Mission 3 ». */
  rang: string;
  /**
   * Le nom de l'épreuve, débarrassé de son rang : « Le chantier des usines » et
   * non « Entraînement 3 · Le chantier des usines ». Le rang et le genre sont
   * déjà deux plaques au-dessus du titre ; les répéter dedans faisait dire trois
   * fois la même chose à trois hauteurs de caractères différentes.
   */
  nom: string;
  /** « Entraînement guidé » ou « Qualification de la Ronde ». */
  genre: string;
  biome: string;
  objectif: string;
  recit: string;
  /** Les pastilles du briefing : taille, adversaire, brouillard, journées. */
  details: readonly string[];
  /** La carte de l'épreuve, prête à peindre ; `null` si elle a échappé au canon. */
  vignette: Vignette | null;
}

/** Tous les textes de l'écran, déjà traduits par la page. */
export interface LibellesCarnet {
  surtitre: string;
  titre: string;
  introduction: string;
  retour: string;
  itineraire: string;
  objectif: string;
  /** Une entrée par nombre de victoires possible, de zéro à toutes. */
  progression: readonly string[];
  gagnee: string;
  disponible: string;
  /** L'état court d'une épreuve fermée, pour la plaque : « Verrouillée ». */
  fermee: string;
  /** Ce qu'il faut faire pour l'ouvrir : « Remportez la mission précédente ». */
  verrou: string;
  jouer: string;
  rejouer: string;
  fin: string;
  sauvegarde: string;
  demo: string;
  profilA: string;
  profilB: string;
  /** Contient `{nom}` : l'intitulé accessible de la pastille de profil. */
  profilActif: string;
}

/** La carte d'une épreuve, en petit. Décorative : tout est dit à côté. */
function CarteEpreuve({ vignette }: { vignette: Vignette }): React.ReactElement {
  return <svg
    className="dossier-carte"
    viewBox={`0 0 ${vignette.largeur} ${vignette.hauteur}`}
    preserveAspectRatio="xMidYMid meet"
    shapeRendering="crispEdges"
    aria-hidden="true"
  >
    {vignette.couches.map((c) => <path key={c.couleur} d={c.d} fill={c.couleur} />)}
  </svg>;
}

/** Le cadenas du dossier fermé : un signe, doublé du texte qui l'explique. */
function Cadenas(): React.ReactElement {
  return <svg className="dossier-cadenas" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M4 11h16v10H4z" fill="currentColor" />
  </svg>;
}

export default function Carnet({ epreuves, libelles }: {
  epreuves: readonly EpreuveCarnet[];
  libelles: LibellesCarnet;
}): React.ReactElement {
  const [progression, setProgression] = useState<Progression>({ version: 1, victoires: [] });
  const [profils, setProfils] = useState<EtatProfils | null>(null);
  const [pret, setPret] = useState(false);
  // La station que le joueur a choisie ; tant qu'il n'a rien choisi, c'est la
  // prochaine à jouer qui s'ouvre — c'est ce qu'il vient chercher neuf fois sur dix.
  const [choisie, setChoisie] = useState<number | null>(null);

  useEffect(() => {
    // `pageshow` et `storage` : le retour depuis une mission passe souvent par le
    // cache de navigation, qui ne rejoue pas le montage.
    const lire = (): void => {
      setProgression(lireProgression());
      setProfils(lireProfils());
      setPret(true);
    };
    lire();
    window.addEventListener('pageshow', lire);
    window.addEventListener('storage', lire);
    return () => {
      window.removeEventListener('pageshow', lire);
      window.removeEventListener('storage', lire);
    };
  }, []);

  const codes = epreuves.map((e) => e.cle);
  const etats = etatsItineraire(codes, progression.victoires, pret);
  const gagnees = etats.filter((e) => e === 'gagnee').length;
  const active = choisie ?? stationParDefaut(codes, progression.victoires);
  const mission = epreuves[active];
  const etat: EtatStation = etats[active] ?? 'verrouillee';
  const mot = (e: EtatStation): string =>
    (e === 'gagnee' ? libelles.gagnee : e === 'ouverte' ? libelles.disponible : libelles.fermee);

  // La pastille de profil ne paraît que si l'appareil a réellement deux joueurs.
  // Sans elle, une progression vide se lit comme une progression perdue alors
  // qu'on regarde simplement l'autre sauvegarde (l'écran-titre laisse en choisir
  // une avant de lancer).
  const nomProfil = profils && (profils.actif === 'b' || profils.noms[profils.actif] !== '')
    ? profils.noms[profils.actif] || (profils.actif === 'a' ? libelles.profilA : libelles.profilB)
    : null;

  return <main className="atlas-carnet">
    <header className="carnet-entete">
      <div className="carnet-titre">
        <p className="atlas-etiquette">{libelles.surtitre}</p>
        <h1>{libelles.titre}</h1>
        {/* La seule phrase de l'écran, et elle porte une règle qu'on ne devine
            pas : ce que vise un objectif est peint en or sur le terrain. */}
        <p className="carnet-accroche">{libelles.introduction}</p>
      </div>
      <Link className="atlas-retour" href="/">{libelles.retour}</Link>
    </header>

    <p className="carnet-avancee">
      <span className="carnet-jauge" aria-hidden="true">
        {epreuves.map((e, i) => <i key={e.cle} className={i < gagnees ? 'faite' : ''} />)}
      </span>
      <span>{libelles.progression[gagnees] ?? ''}</span>
      {nomProfil !== null
        ? <span className="carnet-profil" aria-label={libelles.profilActif.replace('{nom}', nomProfil)}>{nomProfil}</span>
        : null}
    </p>

    <nav className="carnet-route" aria-label={libelles.itineraire}>
      <ol>
        {epreuves.map((m, i) => {
          const e = etats[i] ?? 'verrouillee';
          // L'état est peint sur la station ; il est aussi **dit**, parce qu'une
          // peinture ne se lit pas à la voix et qu'un losange plein ne prononce
          // pas « remportée ».
          return <li key={m.cle} data-etat={e}>
            <button
              type="button"
              className="station"
              data-etat={e}
              aria-current={i === active ? 'step' : undefined}
              aria-label={[m.rang, m.nom, mot(e)].filter((s) => s !== '').join(' · ')}
              onClick={() => setChoisie(i)}
            >
              <span className="station-losange" aria-hidden="true">
                <b>{i + 1}</b>
              </span>
              <span className="station-nom">{m.nom}</span>
            </button>
          </li>;
        })}
      </ol>
    </nav>

    {mission ? <section className="carnet-dossier" data-etat={etat} aria-live="polite">
      {mission.vignette ? <CarteEpreuve vignette={mission.vignette} /> : null}
      <div className="dossier-texte">
        <p className="atlas-etiquette dossier-rang">
          <span>{mission.rang}</span>
          <span>{mission.genre}</span>
          <span>{mission.biome}</span>
          {mot(etat) !== '' ? <span className="dossier-plaque" data-etat={etat}>{mot(etat)}</span> : null}
        </p>
        <h2>{mission.nom}</h2>
        <p className="dossier-objectif">
          <span className="atlas-etiquette">{libelles.objectif}</span>
          {mission.objectif}
        </p>
        {mission.details.length > 0
          ? <ul className="dossier-details">{mission.details.map((d) => <li key={d}>{d}</li>)}</ul>
          : null}
        <p className="dossier-recit">{mission.recit}</p>
        <div className="dossier-actions">
          {etat === 'verrouillee'
            ? <p className="dossier-verrou"><Cadenas />{libelles.verrou}</p>
            : <Link className="atlas-bouton" href={`/jeu/${mission.cle}`} {...GESTES_PRECHARGEMENT}>
              {etat === 'gagnee' ? libelles.rejouer : libelles.jouer}
            </Link>}
        </div>
      </div>
    </section> : null}

    <footer className="carnet-pied">
      {gagnees === epreuves.length && epreuves.length > 0
        ? <p className="carnet-fin">{libelles.fin}</p>
        : null}
      <p>{libelles.sauvegarde}</p>
      <Link className="carnet-lien" href="/jeu">{libelles.demo}</Link>
    </footer>
  </main>;
}
