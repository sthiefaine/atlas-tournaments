'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { libelleDecision } from './consequences';
import { estSourceBanc, scenarioDeSource } from './bancs';
import { CarteParcours } from './carte-parcours';
import { GESTES_PRECHARGEMENT } from '../jeu/precharger';
import type { Vignette } from '../jeu/parties-libres';
import { lireDifficulte, lireProfils, type EtatProfils } from '../preferences';
import { etatsItineraire, stationParDefaut, type EtatStation } from './itineraire';
import { lireProgression, vestiaire as clesOuvertes, type Progression } from './progression';
import { Gras } from '../gras';
import { Buste, Silhouette } from '../buste-commandant';
import { compteRoster, fichesRoster, type FicheRoster } from '../../render/roster-commandants';
import type { RosterJouables } from '../../schemas/index';
import type { DescriptionCommandant } from './roster';

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
  journalTitre: string;
  journalNote: string;
  revoirDecision: string;
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
  /**
   * Les lignes de journal des **bancs prêtés**, déjà traduites, par clé de
   * libellé (`bancs.ts`) : un banc s'enregistre sous des clés i18n, et ce
   * composant n'appelle pas `t()`.
   */
  bancs: Readonly<Record<string, { titre: string; effet: string }>>;
}

/**
 * Le **vestiaire** du carnet : le roster du canon, et de quoi le peindre.
 *
 * La page ne peut pas composer les cases elle-même — l'état de chacune dépend de
 * la progression, qui vit dans `localStorage` et n'existe donc qu'ici. Elle
 * envoie ce qu'elle sait traduire, le carnet compose par `fichesRoster`, et la
 * règle d'ouverture reste celle de `vestiaire()` : le carnet n'en invente pas
 * une seconde.
 */
export interface VestiaireCarnet {
  roster: RosterJouables;
  /** Nom, style et kit de chaque commandant, déjà traduits. */
  descriptions: Readonly<Record<string, DescriptionCommandant>>;
  /** Ce que chaque `ouvertPar` veut dire, déjà dit : « Remportez Le pacte du col ». */
  portes: Readonly<Record<string, string>>;
  titre: string;
  note: string;
  /** Une entrée par nombre de bancs ouverts, de zéro à tous. */
  comptes: readonly string[];
  /** Une entrée par nombre de secrets encore fermés. */
  comptesSecrets: readonly string[];
  grille: string;
  verrouille: string;
  secret: string;
  indice: string;
  kit: string;
}

/** Une case du vestiaire. Même grammaire qu'au briefing, sans le geste de prendre. */
function CaseCommandant({ fiche, v }: { fiche: FicheRoster; v: VestiaireCarnet }): React.ReactElement {
  return <li className="vestiaire-case" data-etat={fiche.etat} data-commandant={fiche.cle === '' ? undefined : fiche.cle}>
    {fiche.etat === 'secret' ? <Silhouette /> : <Buste camp={0} teinte={fiche.etat === 'verrouille'} />}
    <span className="vestiaire-nom">{fiche.etat === 'secret' ? v.secret : fiche.nom}</span>
    {fiche.style !== '' ? <span className="vestiaire-style">{fiche.style}</span> : null}
    {fiche.etat === 'verrouille' ? <span className="vestiaire-plaque" data-plaque="verrouille">{v.verrouille}</span> : null}
    {fiche.porte !== '' ? <span className="vestiaire-porte">{fiche.porte}</span> : null}
    {fiche.indice !== '' ? <span className="vestiaire-indice"><b>{v.indice}</b>{fiche.indice}</span> : null}
    {fiche.etat === 'jouable' && fiche.gout !== '' ? <p className="vestiaire-gout">{fiche.gout}</p> : null}
  </li>;
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

export default function Carnet({ epreuves, libelles, vestiaire }: {
  epreuves: readonly EpreuveCarnet[];
  libelles: LibellesCarnet;
  /** Le vestiaire, ou `null` quand le roster n'a pas pu être lu. */
  vestiaire?: VestiaireCarnet | null;
}): React.ReactElement {
  const [progression, setProgression] = useState<Progression>({ version: 1, victoires: [] });
  const [profils, setProfils] = useState<EtatProfils | null>(null);
  const [pret, setPret] = useState(false);
  const [mode, setMode] = useState<'normal' | 'difficile'>('normal');
  // La station que le joueur a choisie ; tant qu'il n'a rien choisi, c'est la
  // prochaine à jouer qui s'ouvre — c'est ce qu'il vient chercher neuf fois sur dix.
  const [choisie, setChoisie] = useState<number | null>(null);

  useEffect(() => {
    // `pageshow` et `storage` : le retour depuis une mission passe souvent par le
    // cache de navigation, qui ne rejoue pas le montage.
    const lire = (): void => {
      const progression = lireProgression();
      const mode = lireDifficulte();
      setMode(mode);
      setProgression(progression);
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

  const victoiresMode = progression.victoiresParMode?.[mode] ?? (mode === 'normal' && !progression.victoiresParMode ? progression.victoires : []);
  const codes = epreuves.map((e) => e.cle);
  const etats = etatsItineraire(codes, victoiresMode, pret);
  const gagnees = etats.filter((e) => e === 'gagnee').length;
  const active = choisie ?? stationParDefaut(codes, victoiresMode);
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

  // Le vestiaire se compose ici parce que son état dépend de la progression, que
  // seul le client connaît. Tant que rien n'est lu (`pret`), l'acquis est vide :
  // le serveur rend donc un vestiaire fermé, et le client l'ouvre — jamais
  // l'inverse, comme pour les stations de l'itinéraire.
  const fichesVestiaire = vestiaire ? (() => {
    const fiches = fichesRoster({
      roster: vestiaire.roster,
      acquis: pret ? clesOuvertes(progression, vestiaire.roster) : [],
      decrire: (cle) => vestiaire.descriptions[cle] ?? { nom: '', style: '', lignes: [] },
      direPorte: (ouvertPar) => vestiaire.portes[ouvertPar] ?? '',
    });
    return { fiches, compte: compteRoster(fiches) };
  })() : null;

  return <main className="atlas-carnet">
    <header className="carnet-entete">
      <div className="carnet-titre">
        <p className="atlas-etiquette">{libelles.surtitre}</p>
        <h1>{libelles.titre}</h1>
        {/* La seule phrase de l'écran, et elle porte une règle qu'on ne devine
            pas : ce que vise un objectif est peint en or sur le terrain. */}
        <p className="carnet-accroche"><Gras texte={libelles.introduction} /></p>
      </div>
      <Link className="atlas-retour" href="/campagne/salon">Retour au camp</Link>
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

    <div className="carnet-avancee"><strong>{mode === 'normal' ? 'Mode normal' : 'Mode difficile'}</strong><Link className="atlas-retour" href="/campagne/depart">Changer de profil ou de difficulté</Link><Link className="atlas-retour" href="/campagne/journal">Journal de bord</Link></div>
    <CarteParcours epreuves={epreuves} etats={etats} active={active} choisir={i => { setChoisie(i); document.getElementById('dossier-mission')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' }); }} />

    {mission ? <section id="dossier-mission" className="carnet-dossier" data-etat={etat} aria-live="polite">
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
        <p className="dossier-recit"><Gras texte={mission.recit} /></p>
        <div className="dossier-actions">
          {etat === 'verrouillee'
            ? <p className="dossier-verrou"><Cadenas />{libelles.verrou}</p>
            : <Link className="atlas-bouton" href={`/jeu/${mission.cle}`} {...GESTES_PRECHARGEMENT}>
              {etat === 'gagnee' ? libelles.rejouer : libelles.jouer}
            </Link>}
        </div>
      </div>
    </section> : null}

    {/* La collection. C'est ici qu'on vient voir ce qu'on a gagné, et surtout
        ce qui reste : quatre silhouettes qui ne disent qu'un indice font plus
        pour l'envie de rejouer que douze bustes déjà acquis. */}
    {fichesVestiaire && vestiaire ? <section className="carnet-vestiaire" aria-labelledby="titre-collection">
      <h2 id="titre-collection">{vestiaire.titre}</h2>
      <p className="carnet-avancee">
        <span>{vestiaire.comptes[fichesVestiaire.compte.acquis] ?? ''}</span>
        {fichesVestiaire.compte.secrets > 0
          ? <span className="carnet-profil">{vestiaire.comptesSecrets[fichesVestiaire.compte.secrets] ?? ''}</span>
          : null}
      </p>
      <p>{vestiaire.note}</p>
      <ul className="vestiaire-grille" aria-label={vestiaire.grille}>
        {fichesVestiaire.fiches.map((f) => <CaseCommandant key={f.id} fiche={f} v={vestiaire} />)}
      </ul>
    </section> : null}

    {(progression.journal?.length ?? 0) > 0 ? <section className="carnet-journal" aria-labelledby="journal-aube">
      <h2 id="journal-aube">{libelles.journalTitre}</h2>
      <p>{libelles.journalNote}</p>
      <ol>{progression.journal?.map((cle) => {
        const decision = progression.decisions?.[cle];
        const brut = decision ? libelleDecision(decision) : undefined;
        // Un banc porte des clés : la page les a traduites d'avance.
        const texte = brut && decision && estSourceBanc(decision.scenario) ? libelles.bancs[brut.titre] : brut;
        return decision && texte ? <li key={cle}><strong>{texte.titre}</strong><p>{texte.effet}</p><Link href={`/jeu/${scenarioDeSource(decision.scenario)}`}>{libelles.revoirDecision}</Link></li> : null;
      })}</ol>
    </section> : null}

    <footer className="carnet-pied">
      {gagnees === epreuves.length && epreuves.length > 0
        ? <p className="carnet-fin">{libelles.fin}</p>
        : null}
      <p>{libelles.sauvegarde}</p>
      <Link className="carnet-lien" href="/atelier/assets">Carte des assets</Link>
    </footer>
  </main>;
}
