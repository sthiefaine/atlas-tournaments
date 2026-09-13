import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { t } from '@/i18n/index';
import { paletteDe } from '@/render/palettes';
import { validerMapDef, validerScenario, type CampId, type MapDef, type Resultat, type Scenario } from '@/schemas/index';

import campagneJson from '../../../content/campagne.json';
import terrainsJson from '../../../content/terrains.json';
import { vignetteCarte } from '../jeu/parties-libres';
import Carnet, { type EpreuveCarnet } from './carnet';
import { SOURCES_DECISION, optionsDecision } from './consequences';
import { CLES_I18N_BANC, estSourceBanc } from './bancs';
import { nomCourt } from './itineraire';

/**
 * `/campagne` : l'**itinéraire de la sélection**.
 *
 * La page était `<Carnet />` et rien d'autre : tout — le canon, les six récits,
 * et surtout `t()` — vivait dans un composant client, contre la convention du
 * dépôt. Une page de texte embarquait donc les **379 chaînes d'interface** du
 * jeu, soit une vingtaine de kilo-octets de JavaScript pour afficher six titres.
 * `menu-campagne.tsx` montre la règle : la page est un composant serveur qui lit
 * le canon, traduit, et passe des **libellés déjà traduits** à un îlot client
 * qui n'est client que parce qu'il lit `localStorage`.
 *
 * Elle en profite pour dire ce qu'un briefing doit dire. Le dossier d'une
 * épreuve n'avait que son récit ; il porte maintenant **la carte** — dessinée
 * depuis sa grille, comme sur `/jeu` — et les faits qui décident d'une approche :
 * la taille du terrain, l'adversaire, le brouillard, la limite de journées. Ils
 * étaient tous dans le canon, à une jointure de là, et affichés nulle part.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const locale = 'fr';

export const metadata = {
  title: `${t(locale, 'accueil.menu_campagne')} · ${t(locale, 'accueil.nom_haut')}`,
};

/** La couleur de chaque terrain, telle que le canon la déclare. */
const COULEURS_TERRAIN = new Map(terrainsJson.terrains.map((f) => [f.car, f.palette.main] as const));

/** La teinte d'une case de vignette : le camp qui la tient, sinon son terrain. */
function couleurCase(caractere: string, camp: CampId | null): string {
  if (camp !== null) return paletteDe(camp).main;
  return COULEURS_TERRAIN.get(caractere) ?? '#0f2129';
}

/**
 * Lit et valide tous les JSON d'un dossier de `content/`.
 *
 * Recopié de `jeu/page.tsx`, et c'est délibéré : la seule autre place possible
 * serait le module pur que les deux pages partagent (`parties-libres.ts`), or
 * l'îlot client de `/jeu` l'importe — y mettre `node:fs` ferait entrer le
 * système de fichiers dans un lot de navigateur. Un fichier illisible n'est pas
 * une épreuve : on le passe, on n'en fait pas une erreur de page.
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
      // Un JSON cassé ne ferme pas la porte aux autres épreuves.
    }
  }
  return valeurs;
}

export default async function PageCampagne(): Promise<React.ReactElement> {
  const [scenarios, cartes] = await Promise.all([
    lireDossier<Scenario>('scenarios', validerScenario),
    lireDossier<MapDef>('cartes', validerMapDef),
  ]);
  const parCode = new Map(scenarios.map((s) => [s.code, s]));
  const parCle = new Map(cartes.map((c) => [c.cle, c]));
  const total = campagneJson.missions.length;

  const epreuves: EpreuveCarnet[] = campagneJson.missions.map((m, i) => {
    const scenario = parCode.get(m.scenarioCle);
    const carte = scenario ? parCle.get(scenario.carteCle) : undefined;
    // L'adversaire est **celui qui porte une IA**, jamais « le camp 1 » : à
    // l'exhibition alliée, c'est le camp 0 que le joueur commande.
    const adversaire = scenario?.commandants.find((c) => c.ia);
    return {
      cle: m.scenarioCle,
      rang: t(locale, 'campagne.mission', { n: i + 1 }),
      nom: nomCourt(m.titre),
      genre: t(locale, m.entrainement ? 'campagne.entrainement' : 'campagne.officiel'),
      biome: t(locale, `biome.${m.biome}`),
      objectif: m.objectif,
      recit: m.recit,
      vignette: carte ? vignetteCarte(carte, couleurCase) : null,
      // Une chaîne inconnue de `t()` rend vide, et une pastille vide ne se pose pas.
      details: [
        carte ? t(locale, 'jeu_libre.taille', { largeur: carte.largeur, hauteur: carte.hauteur }) : '',
        adversaire
          ? t(locale, 'jeu_libre.adversaire', { nom: t(locale, `commandant.${adversaire.commandantCle}.nom`) })
          : '',
        scenario?.brouillard === true ? t(locale, 'jeu_libre.brouillard') : '',
        scenario && scenario.limiteJournees !== null
          ? t(locale, 'jeu_libre.journees', { n: scenario.limiteJournees })
          : '',
      ].filter((d) => d !== ''),
    };
  });

  return <><Carnet
    epreuves={epreuves}
    libelles={{
      journalTitre: t(locale, 'aube.journal'),
      journalNote: t(locale, 'aube.journal_note'),
      revoirDecision: t(locale, 'aube.revoir'),
      surtitre: t(locale, 'campagne.surtitre'),
      titre: campagneJson.titre,
      introduction: campagneJson.introduction,
      retour: t(locale, 'menu.retour'),
      itineraire: t(locale, 'campagne.itineraire'),
      objectif: t(locale, 'campagne.objectif'),
      // Un tableau borné plutôt qu'un `t()` embarqué : le nombre de victoires
      // possibles est énumérable, autant l'énumérer (c'est ce que fait le bouton
      // Campagne de l'écran-titre pour sa sous-ligne).
      progression: campagneJson.missions.map((_, n) => t(locale, 'campagne.progression', { n, total }))
        .concat(t(locale, 'campagne.progression', { n: total, total })),
      gagnee: t(locale, 'campagne.gagnee'),
      disponible: t(locale, 'campagne.disponible'),
      fermee: t(locale, 'campagne.fermee'),
      verrou: t(locale, 'campagne.verrouillee'),
      jouer: t(locale, 'campagne.jouer'),
      rejouer: t(locale, 'campagne.rejouer'),
      fin: t(locale, 'campagne.fin'),
      sauvegarde: t(locale, 'campagne.sauvegarde'),
      demo: t(locale, 'campagne.demo'),
      profilA: t(locale, 'reglages.profil_a'),
      profilB: t(locale, 'reglages.profil_b'),
      profilActif: t(locale, 'accueil.profil_actif'),
      // « Vous avez joué sous les couleurs de… » : chaque banc du canon, traduit
      // ici pour que le carnet n'embarque pas `t()`.
      bancs: Object.fromEntries(SOURCES_DECISION.filter(estSourceBanc).flatMap((source) => optionsDecision(source).map((o) => [
        o.titre, { titre: t(locale, CLES_I18N_BANC.journal, { banc: t(locale, o.titre) }), effet: t(locale, o.effet) },
      ]))),
    }}
  /></>;
}
