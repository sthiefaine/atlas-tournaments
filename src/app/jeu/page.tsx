import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import Link from 'next/link';

import { VERSION_MOTEUR } from '@/engine/index';
import { t } from '@/i18n/index';
import { paletteDe } from '@/render/palettes';
import { validerMapDef, validerScenario, type CampId, type MapDef, type Resultat, type Scenario } from '@/schemas/index';

import campagne from '../../../content/campagne.json';
import carteDemo from '../../../content/cartes/carte_plaine_symetrique.json';
import scenarioDemo from '../../../content/scenarios/demo.json';
import terrainsJson from '../../../content/terrains.json';
import { ListeParties, type PartieAffichee } from './liste-parties';
import { CLE_DEMONSTRATION, partiesLibres, vignetteCarte } from './parties-libres';

/**
 * `/jeu` : le **choix de la carte**.
 *
 * Le bouton « Jeu libre » de l'écran-titre pointait en dur sur `/jeu/demo`, et
 * rien ne menait aux cartes écrites hors campagne : elles se jouaient à une
 * adresse que personne ne connaissait. Cette page les liste — la démonstration,
 * puis tout scénario en ligne qu'aucune épreuve de la campagne ne cite
 * (`parties-libres.ts` dit le critère).
 *
 * Elle était une **grille de fiches produit** : un nom, un surtitre, quatre
 * pastilles de chiffres, deux boutons. Rien n'y montrait le jeu, alors que la
 * question posée — « l'archipel ou le bras de mer ? » — se répond en regardant
 * une carte, pas en lisant « 20 × 14 ». Chaque fiche porte donc **la carte
 * elle-même**, dessinée depuis sa grille aux couleurs du canon (`vignetteCarte`),
 * les bâtiments à la couleur de qui les tient. C'est la grammaire de tous les
 * écrans de sélection de carte du genre, et elle ne coûte aucun asset.
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

/** La couleur de chaque terrain, telle que le canon la déclare. */
const COULEURS_TERRAIN = new Map(terrainsJson.terrains.map((f) => [f.car, f.palette.main] as const));

/**
 * La teinte d'une case de vignette.
 *
 * Un bâtiment prend la couleur du camp qui le tient, et jamais celle de son
 * toit : sur une carte vue de haut, ce qu'on cherche est où sont les siens.
 * Neutre, il garde sa couleur de terrain — le gris clair des villes du canon dit
 * déjà « à prendre ». Les deux palettes viennent du canon et de `render/`, rien
 * n'est recopié ici.
 */
function couleurCase(caractere: string, camp: CampId | null): string {
  if (camp !== null) return paletteDe(camp).main;
  return COULEURS_TERRAIN.get(caractere) ?? '#0f2129';
}

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
  const parCle = new Map(cartes.map((c) => [c.cle, c]));
  const parties = partiesLibres(scenarios, parCle, campagne.missions.map((m) => m.scenarioCle));

  const affichees: PartieAffichee[] = parties.map((p) => {
    const carte = parCle.get(p.carteCle);
    return {
      cle: p.cle,
      href: `/jeu/${p.cle}`,
      biome: t(locale, `biome.${p.biome}`),
      nom: p.nom,
      catalogueVersion: p.catalogueVersion,
      // La carte est calculée ici, au serveur : l'îlot client ne connaît ni les
      // terrains ni les palettes, il pose des tracés déjà teints.
      vignette: carte ? vignetteCarte(carte, couleurCase) : null,
      // Le ruban de la démonstration. Il ne répète pas son nom — « Match
      // d'exhibition » est déjà écrit dessous — il dit ce que la place en tête
      // de liste veut dire : c'est par là qu'on commence.
      ruban: p.demonstration ? t(locale, 'jeu_libre.decouverte') : '',
      // Une chaîne encore inconnue de `t()` rend vide : on ne pose pas de pastille vide.
      details: [
        t(locale, 'jeu_libre.taille', { largeur: p.largeur, hauteur: p.hauteur }),
        // « 2 camps » est le cas de tout le monde : ce n'est une information que
        // lorsqu'il y en a plus.
        p.camps > 2 ? t(locale, 'jeu_libre.camps', { n: p.camps }) : '',
        t(locale, 'jeu_libre.catalogue', { n: p.catalogueVersion }),
        p.adversaire
          ? t(locale, 'jeu_libre.adversaire', { nom: t(locale, `commandant.${p.adversaire.commandantCle}.nom`) })
          : '',
        p.limiteJournees !== null ? t(locale, 'jeu_libre.journees', { n: p.limiteJournees }) : '',
        // Le brouillard était calculé et affiché nulle part, alors que c'est ce
        // qui change le plus une partie.
        p.brouillard ? t(locale, 'jeu_libre.brouillard') : '',
      ].filter((d) => d !== ''),
    };
  });

  return <main className="atlas-jeu-libre">
    <header className="jeu-libre-entete">
      <div>
        <p className="atlas-etiquette">{t(locale, 'jeu_libre.surtitre')}</p>
        <h1>{t(locale, 'accueil.menu_jeu_libre')}</h1>
        <p className="jeu-libre-note">{t(locale, 'accueil.jeu_libre_note')}</p>
      </div>
      <Link className="atlas-retour" href="/">{t(locale, 'reglages.retour')}</Link>
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
