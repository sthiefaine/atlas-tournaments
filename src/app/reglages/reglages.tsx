'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  NOM_PROFIL_MAX, PREFERENCES_PAR_DEFAUT, PROFILS, PROFILS_PAR_DEFAUT, changerProfilActif,
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
 * **L'effacement rend compte.** Avant, le bouton passait par une confirmation,
 * effaçait, et une ligne de douze pixels disait « Progression effacée. » — le
 * propriétaire ne l'a pas vue. Le bandeau annonce désormais **ce qui a été
 * effacé**, avec les chiffres lus avant l'effacement (après, il n'y a plus que
 * des zéros à compter), et reste affiché tant qu'on n'a pas quitté la page ou
 * changé de profil. Un refus du navigateur a son propre bandeau : dire « effacé »
 * quand rien ne l'a été serait pire que ne rien dire.
 */

export interface LibellesReglages {
  titre: string;
  retour: string;
  dialogues: string;
  dialoguesNote: string;
  animations: string;
  animationsNote: string;
  actif: string;
  inactif: string;
  profils: string;
  profilsNote: string;
  /** Les noms par défaut, tant que le joueur n'a pas nommé le profil. */
  profilA: string;
  profilB: string;
  profilActif: string;
  profilNom: string;
  profilNomNote: string;
  stockage: string;
  stockageOk: string;
  stockageKo: string;
  effacer: string;
  effacerNote: string;
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

/** Ce que le dernier effacement a donné : un bilan, ou un refus. */
type Effacement = { profil: string; bilan: BilanProgression } | { echec: true } | null;

export default function Reglages({ libelles }: { libelles: LibellesReglages }): React.ReactElement {
  const [preferences, setPreferences] = useState<Preferences>({ ...PREFERENCES_PAR_DEFAUT });
  const [profils, setProfils] = useState<EtatProfils>({ ...PROFILS_PAR_DEFAUT, noms: { ...PROFILS_PAR_DEFAUT.noms } });
  // Le champ garde ce que le joueur tape ; on n'enregistre que la forme
  // normalisée, et le champ s'y aligne quand il perd le focus — rogner à chaque
  // frappe empêcherait de taper une espace au milieu d'un nom.
  const [saisie, setSaisie] = useState('');
  const [pret, setPret] = useState(false);
  const [stockage, setStockage] = useState(true);
  const [confirme, setConfirme] = useState(false);
  const [effacement, setEffacement] = useState<Effacement>(null);

  useEffect(() => {
    const etat = lireProfils();
    setPreferences(lirePreferences());
    setProfils(etat);
    setSaisie(etat.noms[etat.actif]);
    setStockage(stockageDisponible());
    setPret(true);
  }, []);

  const nomDe = (profil: Profil): string => profils.noms[profil] || (profil === 'a' ? libelles.profilA : libelles.profilB);

  const changer = (partiel: Partial<Preferences>): void => {
    const suivant = { ...preferences, ...partiel };
    setPreferences(suivant);
    setStockage(ecrirePreferences(suivant));
  };

  const activer = (profil: Profil): void => {
    if (profil === profils.actif) return;
    const suivant = { ...profils, actif: profil };
    setProfils(suivant);
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
    setConfirme(false);
  };

  const interrupteur = (
    cle: 'dialogues' | 'animationsReduites', titre: string, note: string,
  ): React.ReactElement => {
    const actif = preferences[cle];
    return <div className="reglage-ligne">
      <button
        type="button" className="reglage-interrupteur" role="switch" aria-checked={actif}
        disabled={!pret} onClick={() => changer({ [cle]: !actif } as Partial<Preferences>)}
      >
        <span className="reglage-libelle">
          <strong>{titre}</strong>
          <span className="reglage-note">{note}</span>
        </span>
        <span className="reglage-glissiere" aria-hidden="true"><i /></span>
      </button>
      <span className="reglage-etat">{actif ? libelles.actif : libelles.inactif}</span>
    </div>;
  };

  return <main className="atlas-reglages">
    <header className="reglages-entete">
      <h1>{libelles.titre}</h1>
      <Link className="reglages-retour" href="/">{libelles.retour}</Link>
    </header>

    <section className="reglages-groupe">
      {interrupteur('dialogues', libelles.dialogues, libelles.dialoguesNote)}
      {interrupteur('animationsReduites', libelles.animations, libelles.animationsNote)}
    </section>

    <section className="reglages-groupe" aria-labelledby="reglage-profils">
      <h2 id="reglage-profils">{libelles.profils}</h2>
      <div className="reglage-choix reglage-profils" role="radiogroup" aria-label={libelles.profils}>
        {PROFILS.map((profil) => {
          const choisi = profils.actif === profil;
          return <button
            key={profil} type="button" role="radio" aria-checked={choisi}
            className={choisi ? 'choisi' : ''} disabled={!pret} onClick={() => activer(profil)}
          >
            <span className="reglage-profil-nom">{nomDe(profil)}</span>
            <span className="reglage-profil-etat">{choisi ? libelles.profilActif : ' '}</span>
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
    </section>

    <section className="reglages-groupe" aria-labelledby="reglage-stockage">
      <h2 id="reglage-stockage">{libelles.stockage}</h2>
      {/* En navigation privée, le joueur perd sa progression sans jamais
          l'apprendre : on le lui dit avant, pas après. */}
      <p className="reglage-note" role="status">{stockage ? libelles.stockageOk : libelles.stockageKo}</p>
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
    </section>
  </main>;
}
