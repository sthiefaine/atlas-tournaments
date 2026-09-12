/**
 * Le **vestiaire**, côté application : ce que l'écran de sélection et le carnet
 * ont besoin de savoir, lu au canon et traduit une fois.
 *
 * Le partage est celui du dépôt : `render/roster-commandants.ts` tient la règle
 * d'affichage — trois états, l'ordre des cases, ce qu'un secret fermé ne doit
 * pas laisser fuir — sans lire ni `content/` ni le profil ; ce module lui donne
 * le roster du canon, l'acquis que la progression a calculé, et deux fonctions
 * qui savent nommer un commandant et une porte.
 *
 * Rien n'y est recopié. Le kit d'un commandant est lu **sur ses effets** par la
 * même `lignesPouvoir` que la jauge du HUD : une fiche qui recopierait une
 * phrase dériverait au premier chiffre changé, et le vestiaire promettrait un
 * pouvoir que la partie ne donne pas.
 *
 * Ce module ne **choisit** ni n'**applique** rien : `commandants-jouables.ts`
 * dit ce qui est prenable et pose le général au camp du joueur, ici on ne fait
 * que montrer — y compris ce qui n'est pas prenable, qui est justement la
 * moitié de l'écran (les portes et les silhouettes).
 */
import campagneJson from '../../../content/campagne.json';
import { chargerCommandantJeu, type RevisionCommandants } from '../../content/commandants-jeu';
import { lireProfilCommandant } from '../../content/profils-commandants';
import { resoudre } from '../../i18n/index';
import type { Catalogue } from '../../engine/index';
import { effetsDeCapacite, faiblesseDuProfil } from '../../render/kit-commandant';
import { lignesPouvoir, nomTerrain, nomUnite, type Traduire } from '../../render/libelles';
import { fichesRoster, type FicheRoster } from '../../render/roster-commandants';
import type { CleTerrain, CleUnite, RosterJouables } from '../../schemas/index';
import { nomCourt } from './itineraire';

/** `ouvertPar` d'un commandant ouvert d'entrée, et de celui dont l'épreuve reste à écrire. */
export const OUVERT_DEBUT = 'debut';
export const OUVERT_A_VENIR = 'a_venir';

/** Les titres des épreuves de la campagne, par code, pour dire une porte. */
const TITRES_CAMPAGNE: ReadonlyMap<string, string> = new Map(
  campagneJson.missions.map((m) => [m.scenarioCle, nomCourt(m.titre)] as const),
);

/**
 * Le titre d'une épreuve, ou une chaîne vide quand on ne le connaît pas.
 *
 * Deux sources, dans cet ordre : la chaîne `epreuve.<code>` — les essais d'Aube,
 * qui ne sont pas au fil de la campagne —, puis le fil lui-même. Une porte dont
 * on ne sait pas nommer l'épreuve se dit sans la nommer plutôt qu'avec un code
 * de scénario, qui n'est un nom pour personne.
 */
export function titreEpreuve(locale: string, code: string): string {
  return resoudre(locale, `epreuve.${code}`) ?? TITRES_CAMPAGNE.get(code) ?? '';
}

/** Comment dire ce qui ouvre un commandant encore fermé. */
export function porteCommandant(t: Traduire, locale: string, ouvertPar: string): string {
  if (ouvertPar === OUVERT_A_VENIR) return t('vestiaire.porte_a_venir');
  const epreuve = titreEpreuve(locale, ouvertPar);
  return epreuve === '' ? t('vestiaire.porte_inconnue') : t('vestiaire.porte', { epreuve });
}

/** Nom, style et kit d'un commandant, tels que la grille les montre. */
export interface DescriptionCommandant {
  nom: string;
  style: string;
  lignes: readonly string[];
}

/**
 * De quoi décrire n'importe quel commandant du roster, à la révision que le
 * scénario joue.
 *
 * Quatre lignes au plus, et ce sont les quatre qui changent une partie : le
 * passif, le pouvoir, le super et la **faiblesse**. La faiblesse n'existe qu'à
 * partir de la révision 4 ; un kit d'avant n'en montre pas, et la page ne plante
 * pas dessus (`render/kit-commandant.ts`).
 */
export function descripteurCommandant(
  t: Traduire, locale: string, catalogue: Catalogue, revision: RevisionCommandants,
): (cle: string) => DescriptionCommandant {
  const noms = {
    unite: (c: CleUnite) => nomUnite(locale, catalogue, c),
    terrain: (c: CleTerrain) => nomTerrain(locale, catalogue, c),
  };
  return (cle) => {
    const nom = resoudre(locale, `commandant.${cle}.nom`) ?? '';
    let kit;
    try {
      kit = chargerCommandantJeu(cle, revision);
    } catch {
      // Un commandant que la révision jouée ne connaît pas : on le nomme sans
      // promettre un kit. Mieux vaut une case sobre qu'un briefing qui refuse
      // de s'ouvrir parce qu'un registre a pris de l'avance sur un catalogue.
      return { nom, style: '', lignes: [] };
    }
    const profil = lireProfilCommandant(cle);
    const faiblesse = faiblesseDuProfil(profil);
    return {
      nom,
      style: profil?.style ?? '',
      lignes: [
        ...(kit.passif ? lignesPouvoir(t, [kit.passif], { noms }) : []),
        ...lignesPouvoir(t, effetsDeCapacite(kit.pouvoir), { noms, duree: kit.pouvoir.duree }),
        ...lignesPouvoir(t, effetsDeCapacite(kit.superPouvoir), { noms, duree: kit.superPouvoir.duree }),
        ...(faiblesse ? lignesPouvoir(t, [faiblesse.effet], { noms }) : []),
      ],
    };
  };
}

/** Ce qu'il faut pour composer la grille : le canon, l'acquis, et la langue. */
export interface OptionsGrille {
  t: Traduire;
  locale: string;
  roster: RosterJouables;
  /** Les clés ouvertes, telles que `vestiaire()` les a calculées. Jamais recalculées ici. */
  acquis: readonly string[];
  /** Le commandant du scénario, quand il y en a un : proposé en premier. */
  defaut?: string;
  catalogue: Catalogue;
  revision: RevisionCommandants;
}

/** La grille du briefing et du carnet, prête à peindre. */
export function grilleCommandants(o: OptionsGrille): FicheRoster[] {
  const decrire = descripteurCommandant(o.t, o.locale, o.catalogue, o.revision);
  return fichesRoster({
    roster: o.roster,
    acquis: o.acquis,
    defaut: o.defaut,
    decrire,
    direPorte: (ouvertPar) => porteCommandant(o.t, o.locale, ouvertPar),
  });
}
