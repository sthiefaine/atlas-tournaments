'use client';

import Link from 'next/link';
import { useEffect, useState, type KeyboardEvent } from 'react';
import type { Mode } from '../../schemas/types';
import { lireProgression } from '../campagne/progression';
import { indexChoix } from '../navigation-choix';
import { QUALITES_RENDU, type QualiteRendu } from '../../render/qualite';
import { VITESSES_ANIMATIONS } from '../../render/cadence';
import {
  ecrireDifficulte, lireDifficulte, NOM_PROFIL_MAX, PREFERENCES_PAR_DEFAUT, PROFILS, PROFILS_PAR_DEFAUT, changerProfilActif,
  compterProgression, effacerProgression, ecrirePreferences, lirePreferences,
  lireProfils, normaliserNomProfil, renommerProfil, stockageDisponible,
  type BilanProgression, type EtatProfils, type Preferences, type Profil,
} from '../preferences';

/**
 * L'îlot client des réglages : il lit et écrit `localStorage`, c'est sa seule
 * raison d'être cliente. Il ne connaît ni le canon ni `t()` — la page lui passe
 * des libellés déjà traduits.
 *
 * Le même sens unique que sur l'accueil : avant montage, on affiche les valeurs
 * par défaut ; après, celles du navigateur. Tant que `pret` est faux, les
 * commandes sont désactivées — basculer un interrupteur sur un état qu'on n'a
 * pas encore lu écraserait le choix précédent.
 *
 * **Un interrupteur n'est plus une glissière.** C'en était une, avec sa pastille
 * qui coulisse et le mot « Activé » relégué dans une colonne de 74 px à droite :
 * le contrôle d'un panneau de préférences de système d'exploitation, posé au
 * milieu d'un jeu à l'encre et au signal. C'est maintenant une **plaque** qui
 * porte son propre état, peinte en signal quand le réglage est mis, creuse
 * quand il ne l'est pas — la même mécanique que les boutons du HUD, avec une
 * épaisseur qui s'écrase à l'appui. Le contrôle reste un `role="switch"` avec
 * son `aria-checked` ; la plaque est `aria-hidden`, sans quoi le lecteur d'écran
 * annoncerait deux fois le même état.
 *
 * **L'effacement rend compte.** Avant, le bouton passait par une confirmation,
 * effaçait, et une ligne de douze pixels disait « Progression effacée. » — le
 * propriétaire ne l'a pas vue. Le bandeau annonce désormais **ce qui a été
 * effacé**, avec les chiffres lus avant l'effacement (après, il n'y a plus que
 * des zéros à compter), et reste affiché tant qu'on n'a pas quitté la page ou
 * changé de profil. Un refus du navigateur a son propre bandeau : dire « effacé »
 * quand rien ne l'a été serait pire que ne rien dire.
 */

export interface LibellesReglages {
  sons: string;
  sonsNote: string;
  volumeSons: string;
  difficulte: string;
  difficulteNote: string;
  victoiresModes: string;
  normal: string;
  difficile: string;
  titre: string;
  retour: string;
  /** Titre du panneau des réglages qui se voient pendant une partie. */
  enPartie: string;
  dialogues: string;
  dialoguesNote: string;
  animations: string;
  animationsNote: string;
  vitesse: string;
  vitesseNote: string;
  vitesseNormale: string;
  vitesseRapide: string;
  vitesseInstantanee: string;
  ecranCombat: string;
  ecranCombatNote: string;
  /** Titre du panneau d'affichage. */
  affichage: string;
  qualite: string;
  qualiteNote: string;
  qualiteAuto: string;
  qualiteBasse: string;
  actif: string;
  inactif: string;
  /** Titre du panneau des deux sauvegardes de l'appareil. */
  sauvegardes: string;
  /** Intitulé accessible du choix de sauvegarde. */
  profils: string;
  profilsNote: string;
  /** Les noms par défaut, tant que le joueur n'a pas nommé le profil. */
  profilA: string;
  profilB: string;
  profilActif: string;
  profilNom: string;
  profilNomNote: string;
  /** Contient `{victoires}` et `{parties}` : ce que la sauvegarde tient. */
  profilBilan: string;
  /** Ce que dit une sauvegarde à laquelle personne n'a encore touché. */
  profilVide: string;
  stockageOk: string;
  stockageKo: string;
  effacer: string;
  effacerNote: string;
  /** La mention de version, déjà composée ; vide quand le build n'a rien laissé. */
  version?: string;
  /** Contient `{nom}`, le nom du profil actif. */
  effacerProfil: string;
  effacerConfirmer: string;
  annuler: string;
  /** Contient `{nom}`. */
  efface: string;
  /** Contient `{victoires}` et `{parties}`. */
  effaceBilan: string;
  effaceKo: string;
}

/** Une substitution minimale : l'îlot n'embarque pas `t()`, mais deux marqueurs, ça se remplace. */
function remplir(texte: string, valeurs: Record<string, string | number>): string {
  return texte.replace(/\{([a-z]+)\}/g, (entier, nom: string) => (nom in valeurs ? String(valeurs[nom]) : entier));
}

/**
 * Un panneau de réglages. Sans titre — une clé de chaîne pas encore écrite rend
 * une chaîne vide —, il ne prétend pas en avoir un : ni titre creux, ni
 * `aria-labelledby` qui désignerait un élément muet.
 */
function Groupe({ id, titre, children }: {
  id: string; titre: string; children: React.ReactNode;
}): React.ReactElement {
  return <section className="reglages-groupe" aria-labelledby={titre === '' ? undefined : id}>
    {titre !== '' ? <h2 id={id}>{titre}</h2> : null}
    {children}
  </section>;
}

/** Ce que le dernier effacement a donné : un bilan, ou un refus. */
type Effacement = { profil: string; bilan: BilanProgression } | { echec: true } | null;

export default function Reglages({ libelles }: { libelles: LibellesReglages }): React.ReactElement {
  const [victoiresModes, setVictoiresModes] = useState({ normal: 0, difficile: 0 });
  const compterModes = (profil: Profil): void => {
    const p = lireProgression(profil);
    setVictoiresModes({ normal: p.victoiresParMode?.normal?.length ?? (p.victoiresParMode ? 0 : p.victoires.length), difficile: p.victoiresParMode?.difficile?.length ?? 0 });
  };
  const [difficulte, setDifficulte] = useState<Mode>('normal');
  const [preferences, setPreferences] = useState<Preferences>({ ...PREFERENCES_PAR_DEFAUT });
  const [profils, setProfils] = useState<EtatProfils>({ ...PROFILS_PAR_DEFAUT, noms: { ...PROFILS_PAR_DEFAUT.noms } });
  // Ce que chaque sauvegarde tient. `null` tant que le navigateur n'a pas parlé :
  // c'est ce qui distingue « pas encore lu » de « lu, et vide ».
  const [bilans, setBilans] = useState<Record<Profil, BilanProgression> | null>(null);
  // Le champ garde ce que le joueur tape ; on n'enregistre que la forme
  // normalisée, et le champ s'y aligne quand il perd le focus — rogner à chaque
  // frappe empêcherait de taper une espace au milieu d'un nom.
  const [saisie, setSaisie] = useState('');
  const [pret, setPret] = useState(false);
  const [stockage, setStockage] = useState(true);
  const [confirme, setConfirme] = useState(false);
  const [effacement, setEffacement] = useState<Effacement>(null);

  const compter = (): Record<Profil, BilanProgression> => ({
    a: compterProgression('a'), b: compterProgression('b'),
  });

  useEffect(() => {
    const etat = lireProfils();
    setPreferences(lirePreferences());
    setProfils(etat);
    setDifficulte(lireDifficulte(etat.actif));
    compterModes(etat.actif);
    setSaisie(etat.noms[etat.actif]);
    setBilans(compter());
    setStockage(stockageDisponible());
    setPret(true);
  }, []);

  /** Les radios offrent un seul arrêt Tab ; les flèches déplacent choix et focus. */
  const naviguer = (event: KeyboardEvent<HTMLButtonElement>, index: number, total: number, choisir: (index: number) => void): void => {
    const suivant = indexChoix(event.key, index, total);
    if (suivant === null) return;
    event.preventDefault();
    choisir(suivant);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[suivant]?.focus();
  };

  const nomDe = (profil: Profil): string => profils.noms[profil] || (profil === 'a' ? libelles.profilA : libelles.profilB);
  const libelleQualite: Record<QualiteRendu, string> = {
    auto: libelles.qualiteAuto, basse: libelles.qualiteBasse,
  };
  /** Ce que tient une sauvegarde, en une ligne ; vide tant qu'on ne l'a pas lue. */
  const bilanDe = (profil: Profil): string => {
    const b = bilans?.[profil];
    if (!b) return '';
    if (b.victoires === 0 && b.parties === 0) return libelles.profilVide;
    return remplir(libelles.profilBilan, { victoires: b.victoires, parties: b.parties });
  };

  const changer = (partiel: Partial<Preferences>): void => {
    const suivant = { ...preferences, ...partiel };
    setPreferences(suivant);
    setStockage(ecrirePreferences(suivant));
  };

  const activer = (profil: Profil): void => {
    if (profil === profils.actif) return;
    const suivant = { ...profils, actif: profil };
    setProfils(suivant);
    setDifficulte(lireDifficulte(profil));
    compterModes(profil);
    setSaisie(suivant.noms[profil]);
    setStockage(changerProfilActif(profil));
    // Le bandeau parlait de l'autre profil : il n'a plus rien à dire ici.
    setEffacement(null);
    setConfirme(false);
  };

  const renommer = (brut: string): void => {
    setSaisie(brut);
    const nom = normaliserNomProfil(brut);
    const suivant = { ...profils, noms: { ...profils.noms, [profils.actif]: nom } };
    setProfils(suivant);
    setStockage(renommerProfil(profils.actif, nom));
  };

  const effacer = (): void => {
    const profil = profils.actif;
    const bilan = compterProgression(profil);
    const ok = effacerProgression(profil);
    setStockage(ok);
    setEffacement(ok ? { profil: nomDe(profil), bilan } : { echec: true });
    setBilans(compter());
    compterModes(profil);
    setConfirme(false);
  };

  /**
   * Une bascule : le nom et sa note à gauche, l'état en plaque à droite. La
   * plaque est `aria-hidden` — `role="switch"` et `aria-checked` disent déjà
   * l'état, et l'entendre deux fois est une gêne, pas une aide.
   */
  const bascule = (
    cle: 'dialogues' | 'animationsReduites' | 'ecranCombat' | 'sons', titre: string, note: string,
  ): React.ReactElement => {
    const actif = preferences[cle];
    return <button
      type="button" className="reglage-bascule" role="switch" aria-checked={actif}
      disabled={!pret} onClick={() => changer({ [cle]: !actif } as Partial<Preferences>)}
    >
      <span className="reglage-libelle">
        <strong>{titre}</strong>
        <span className="reglage-note">{note}</span>
      </span>
      <span className="reglage-etat" aria-hidden="true">{actif ? libelles.actif : libelles.inactif}</span>
    </button>;
  };

  return <main className="atlas-reglages">
    <header className="reglages-entete">
      <h1>{libelles.titre}</h1>
      <Link className="atlas-retour" href="/">{libelles.retour}</Link>
    </header>

    <Groupe id="reglage-en-partie" titre={libelles.enPartie}>
      {bascule('sons', libelles.sons, libelles.sonsNote)}
      <label className="reglage-rangee"><span className="reglage-libelle"><strong>{libelles.volumeSons} : {Math.round(preferences.volumeSons * 100)} %</strong></span>
        <input type="range" min={0} max={100} step={5} value={Math.round(preferences.volumeSons * 100)} disabled={!pret || !preferences.sons}
          onChange={e => changer({ volumeSons: Number(e.target.value) / 100 })} />
      </label>
      {bascule('dialogues', libelles.dialogues, libelles.dialoguesNote)}
      {bascule('ecranCombat', libelles.ecranCombat, libelles.ecranCombatNote)}
      <div className="reglage-rangee">
        <span className="reglage-libelle"><strong>{libelles.vitesse}</strong>
          <span className="reglage-note">{libelles.vitesseNote}</span></span>
        <div className="reglage-choix" role="radiogroup" aria-label={libelles.vitesse}>
          {VITESSES_ANIMATIONS.map((vitesse, index) => {
            const choisi = preferences.vitesseAnimations === vitesse;
            return <button key={vitesse} type="button" role="radio" aria-checked={choisi}
              tabIndex={choisi ? 0 : -1} disabled={!pret} className={choisi ? 'choisi' : ''}
              onClick={() => changer({ vitesseAnimations: vitesse })}
              onKeyDown={(event) => naviguer(event, index, VITESSES_ANIMATIONS.length,
                (i) => changer({ vitesseAnimations: VITESSES_ANIMATIONS[i]! }))}>
              {vitesse === 'normale' ? libelles.vitesseNormale : vitesse === 'rapide' ? libelles.vitesseRapide : libelles.vitesseInstantanee}
            </button>;
          })}
        </div>
      </div>
    </Groupe>

    <Groupe id="reglage-difficulte" titre={libelles.difficulte}>
      <p className="reglage-note">{nomDe(profils.actif)} · {libelles.difficulteNote}</p>
      <p className="reglage-note">{remplir(libelles.victoiresModes, victoiresModes)}</p>
      <div className="reglage-choix" role="radiogroup" aria-label={libelles.difficulte}>
        {(['normal', 'difficile'] as const).map((mode, index) => {
          const choisi = difficulte === mode;
          const choisir = (valeur: Mode): void => {
            const ok = ecrireDifficulte(profils.actif, valeur);
            setStockage(ok);
            if (ok) setDifficulte(valeur);
          };
          return <button key={mode} type="button" role="radio" aria-checked={choisi} tabIndex={choisi ? 0 : -1}
            disabled={!pret} className={choisi ? 'choisi' : ''}
            onClick={() => choisir(mode)}
            onKeyDown={(event) => naviguer(event, index, 2, (i) => choisir(i === 0 ? 'normal' : 'difficile'))}>
            {mode === 'normal' ? libelles.normal : libelles.difficile}
          </button>;
        })}
      </div>
    </Groupe>

    <Groupe id="reglage-affichage" titre={libelles.affichage}>
      {/* Deux choix, un rang : le réglage pilote réellement la chaîne de
          post-traitement du rendu, lue par la page de jeu au montage. */}
      <div className="reglage-rangee">
        <span className="reglage-libelle">
          <strong>{libelles.qualite}</strong>
          <span className="reglage-note">{libelles.qualiteNote}</span>
        </span>
        <div className="reglage-choix" role="radiogroup" aria-label={libelles.qualite}>
          {QUALITES_RENDU.map((q, index) => {
            const choisi = preferences.qualite === q;
            return <button
              key={q} type="button" role="radio" aria-checked={choisi}
              tabIndex={choisi ? 0 : -1}
              onKeyDown={(event) => naviguer(event, index, QUALITES_RENDU.length, (i) => changer({ qualite: QUALITES_RENDU[i]! }))}
              className={choisi ? 'choisi' : ''} disabled={!pret} onClick={() => changer({ qualite: q })}
            >
              {libelleQualite[q]}
            </button>;
          })}
        </div>
      </div>
      {bascule('animationsReduites', libelles.animations, libelles.animationsNote)}
    </Groupe>

    <Groupe id="reglage-sauvegardes" titre={libelles.sauvegardes}>
      {/* L'écran-titre choisit **laquelle on joue** ; ici on les nomme, on voit
          ce qu'elles tiennent, et on en efface une. */}
      <div className="reglage-cartouches" role="radiogroup" aria-label={libelles.profils}>
        {PROFILS.map((profil, index) => {
          const choisi = profils.actif === profil;
          return <button
            key={profil} type="button" role="radio" aria-checked={choisi}
            tabIndex={choisi ? 0 : -1}
            onKeyDown={(event) => naviguer(event, index, PROFILS.length, (i) => activer(PROFILS[i]!))}
            className="reglage-cartouche" disabled={!pret} onClick={() => activer(profil)}
          >
            <span className="cartouche-nom">{nomDe(profil)}</span>
            <span className="cartouche-bilan">{bilanDe(profil)}</span>
            {/* `aria-checked` dit déjà « sélectionné » : la plaque est une
                peinture, elle n'a pas à être annoncée une seconde fois. */}
            {choisi ? <span className="cartouche-plaque" aria-hidden="true">{libelles.profilActif}</span> : null}
          </button>;
        })}
      </div>
      <label className="reglage-champ">
        <span className="reglage-libelle">
          <strong>{libelles.profilNom}</strong>
          <span className="reglage-note">{libelles.profilNomNote}</span>
        </span>
        <input
          type="text" value={saisie} maxLength={NOM_PROFIL_MAX} disabled={!pret}
          autoComplete="off" autoCapitalize="words" spellCheck={false} enterKeyHint="done"
          placeholder={profils.actif === 'a' ? libelles.profilA : libelles.profilB}
          onChange={(e) => renommer(e.target.value)}
          onBlur={() => setSaisie(profils.noms[profils.actif])}
        />
      </label>
      <p className="reglage-note">{libelles.profilsNote}</p>
      {/* En navigation privée, le joueur perd sa progression sans jamais
          l'apprendre : on le lui dit avant, pas après. */}
      <p className="reglage-note" data-alerte={stockage ? undefined : 'oui'} role="status">
        {stockage ? libelles.stockageOk : libelles.stockageKo}
      </p>
      {effacement && 'echec' in effacement
        ? <p className="reglage-bilan echec" role="alert">{libelles.effaceKo}</p>
        : null}
      {effacement && 'bilan' in effacement
        ? <div className="reglage-bilan" role="status">
          <strong>{remplir(libelles.efface, { nom: effacement.profil })}</strong>
          <span>{remplir(libelles.effaceBilan, { victoires: effacement.bilan.victoires, parties: effacement.bilan.parties })}</span>
        </div>
        : null}
      {confirme
        ? <div className="reglage-danger">
          <p>{libelles.effacerNote}</p>
          <p>{remplir(libelles.effacerProfil, { nom: nomDe(profils.actif) })}</p>
          <div className="reglage-actions">
            <button type="button" className="reglage-detruire" onClick={effacer}>{libelles.effacerConfirmer}</button>
            <button type="button" onClick={() => setConfirme(false)}>{libelles.annuler}</button>
          </div>
        </div>
        : <button type="button" className="reglage-effacer" disabled={!pret} onClick={() => { setEffacement(null); setConfirme(true); }}>
          {libelles.effacer}
        </button>}
    </Groupe>
    {libelles.version ? <p className="reglages-version">{libelles.version}</p> : null}
  </main>;
}
