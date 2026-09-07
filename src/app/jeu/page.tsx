import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import Link from 'next/link';

import { VERSION_MOTEUR } from '@/engine/index';
import { t } from '@/i18n/index';
import { validerMapDef, validerScenario, type MapDef, type Resultat, type Scenario } from '@/schemas/index';

import campagne from '../../../content/campagne.json';
import carteDemo from '../../../content/cartes/carte_plaine_symetrique.json';
import scenarioDemo from '../../../content/scenarios/demo.json';
import { ListeParties, type PartieAffichee } from './liste-parties';
import { CLE_DEMONSTRATION, partiesLibres } from './parties-libres';

/**
 * `/jeu` : la **porte du jeu libre**.
 *
 * Le bouton « Jeu libre » de l'écran-titre pointait en dur sur `/jeu/demo`, et
 * rien ne menait aux cartes écrites hors campagne : elles se jouaient à une
 * adresse que personne ne connaissait. Cette page liste les parties libres —
 * la démonstration, puis tout scénario en ligne qu'aucune épreuve de la
 * campagne ne cite (`parties-libres.ts` dit le critère) — avec ce qu'il faut
 * pour choisir : la taille de la carte, le biome, le catalogue, les camps,
 * l'adversaire, la limite de journées.
 *
 * Composant serveur, comme l'accueil : il lit le canon sur le disque, traduit,
 * et passe des libellés prêts à un seul îlot client, qui n'est client que
 * pour lire dans `localStorage` si une partie est en cours.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const locale = 'fr';

export const metadata = {
  title: `${t(locale, 'accueil.menu_jeu_libre')} · ${t(locale, 'accueil.nom_haut')}`,
};

/**
 * Lit et valide tous les JSON d'un dossier de `content/`. Un fichier illisible
 * ou invalide n'est pas une partie : on le passe, on n'en fait pas une erreur
 * de page. Les noms sont triés pour que la lecture soit la même d'un serveur à
 * l'autre.
 */
async function lireDossier<T>(dossier: string, valider: (brut: unknown) => Resultat<T>): Promise<T[]> {
  const racine = path.resolve(process.cwd(), 'content', dossier);
  let noms: string[];
  try {
    noms = (await readdir(racine)).filter((n) => n.endsWith('.json')).sort();
  } catch {
    return [];
  }
  const valeurs: T[] = [];
  for (const nom of noms) {
    try {
      const r = valider(JSON.parse(await readFile(path.join(racine, nom), 'utf8')) as unknown);
      if (r.ok) valeurs.push(r.valeur);
    } catch {
      // Un JSON cassé ne ferme pas la porte aux autres parties.
    }
  }
  return valeurs;
}

export default async function PageJeuLibre(): Promise<React.ReactElement> {
  const [scenarios, cartes] = await Promise.all([
    lireDossier<Scenario>('scenarios', validerScenario),
    lireDossier<MapDef>('cartes', validerMapDef),
  ]);
  // La démonstration est importée statiquement, comme sur sa propre page : elle
  // doit être là même si le disque ne répond pas (`02-architecture.md` §3.5).
  if (!scenarios.some((s) => s.code === CLE_DEMONSTRATION)) {
    const d = validerScenario(scenarioDemo);
    const c = validerMapDef(carteDemo);
    if (d.ok && c.ok) {
      scenarios.push(d.valeur);
      cartes.push(c.valeur);
    }
  }
  const parties = partiesLibres(
    scenarios,
    new Map(cartes.map((c) => [c.cle, c])),
    campagne.missions.map((m) => m.scenarioCle),
  );

  const affichees: PartieAffichee[] = parties.map((p) => ({
    cle: p.cle,
    href: `/jeu/${p.cle}`,
    surtitre: [t(locale, `biome.${p.biome}`), t(locale, 'jeu_libre.catalogue', { n: p.catalogueVersion })]
      .filter((s) => s !== '').join(' · '),
    nom: p.nom,
    catalogueVersion: p.catalogueVersion,
    // Une chaîne encore inconnue de `t()` rend vide : on ne pose pas de pastille vide.
    details: [
      t(locale, 'jeu_libre.taille', { largeur: p.largeur, hauteur: p.hauteur }),
      t(locale, 'jeu_libre.camps', { n: p.camps }),
      p.adversaire
        ? t(locale, 'jeu_libre.adversaire', { nom: t(locale, `commandant.${p.adversaire.commandantCle}.nom`) })
        : '',
      p.limiteJournees !== null ? t(locale, 'jeu_libre.journees', { n: p.limiteJournees }) : '',
    ].filter((d) => d !== ''),
  }));

  return <main className="atlas-jeu-libre">
    <header className="jeu-libre-entete">
      <div>
        <p className="jeu-libre-surtitre">{t(locale, 'jeu_libre.surtitre')}</p>
        <h1>{t(locale, 'accueil.menu_jeu_libre')}</h1>
        <p className="jeu-libre-note">{t(locale, 'accueil.jeu_libre_note')}</p>
      </div>
      <Link className="jeu-libre-retour" href="/">{t(locale, 'reglages.retour')}</Link>
    </header>

    <ListeParties
      parties={affichees}
      versionMoteur={VERSION_MOTEUR}
      libelles={{
        liste: t(locale, 'jeu_libre.liste'),
        jouer: t(locale, 'menu.jouer'),
        reprendre: t(locale, 'hud.reprendre'),
        nouvellePartie: t(locale, 'hud.nouvelle_partie'),
        enCours: t(locale, 'jeu_libre.en_cours'),
      }}
    />

    <footer className="jeu-libre-pied"><p>{t(locale, 'jeu_libre.sauvegarde')}</p></footer>
  </main>;
}
