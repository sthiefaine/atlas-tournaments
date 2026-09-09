/** Données tactiques des commandants jouables ; aucune dépendance au moteur. */
import { lireProfilCommandant } from './profils-commandants';
import type { Cle, EffetModificateur, EffetPouvoir, Scenario } from '../schemas/types';

interface CapaciteJeu {
  nom: string;
  barres: number;
  effets: EffetPouvoir[];
  duree: 'tour_complet';
}

export interface CommandantJeu {
  cle: Cle;
  nom: string;
  passif: EffetModificateur | null;
  pouvoir: CapaciteJeu;
  superPouvoir: CapaciteJeu;
}

/** Révision 1 inchangée pour les anciens scénarios ; spécialisation Aube à partir du catalogue 7. */
export function chargerCommandantJeu(cle: Cle, revision = 1): CommandantJeu {
  if (revision === 3) {
    const profil = lireProfilCommandant(cle);
    if (!profil) throw new Error(`Commandant absent du catalogue tactique 3 : ${cle}`);
    return {
      cle, nom: `commandant.${cle}.nom`, passif: profil.passif,
      pouvoir: { ...profil.pouvoir, nom: `commandant.${cle}.pouvoir_v3` },
      superPouvoir: { ...profil.superPouvoir, nom: `commandant.${cle}.super_v3` },
    };
  }
  const defensif = cle === 'cmd_tomas_reiner';
  const quoi = defensif ? 'defense' : 'attaque';
  const commandant: CommandantJeu = {
    cle,
    nom: `commandant.${cle}.nom`,
    passif: defensif ? { cible: 'mes_unites', modificateur: { quoi: 'defense', valeur: 1.1 } } : null,
    pouvoir: {
      nom: `commandant.${cle}.pouvoir`, barres: 3, duree: 'tour_complet',
      effets: [{ cible: 'mes_unites', modificateur: { quoi, valeur: defensif ? 1.25 : 1.2 } }],
    },
    superPouvoir: {
      nom: `commandant.${cle}.super`, barres: 6, duree: 'tour_complet',
      effets: [
        { cible: 'mes_unites', modificateur: { quoi, valeur: defensif ? 1.5 : 1.4 } },
        { cible: 'mes_unites', modificateur: { quoi: 'mouvement', valeur: 1 } },
      ],
    },
  };
  if (revision >= 2) {
    if (['cmd_solveig_tamm', 'cmd_wren_osoko', 'cmd_hadran_ost'].includes(cle)) {
      commandant.pouvoir.nom = `commandant.${cle}.pouvoir_aube`;
      commandant.superPouvoir.nom = `commandant.${cle}.super_aube`;
    }
    if (cle === 'cmd_solveig_tamm') {
      const filtre = { types: ['transport', 'transport_air', 'barge'] };
      commandant.pouvoir.effets = [{ cible: 'mes_unites', filtre, modificateur: { quoi: 'defense', valeur: 1.35 } }];
      commandant.superPouvoir.effets = [
        ...commandant.pouvoir.effets,
        { cible: 'mes_unites', filtre, modificateur: { quoi: 'mouvement', valeur: 1 } },
        { cible: 'mes_unites', modificateur: { quoi: 'defense', valeur: 1.15 } },
      ];
    } else if (cle === 'cmd_wren_osoko') {
      commandant.pouvoir.effets = [{ cible: 'mes_unites', modificateur: { quoi: 'vision', valeur: 2 } }];
      commandant.superPouvoir.effets = [
        { cible: 'mes_unites', modificateur: { quoi: 'vision', valeur: 3 } },
        { cible: 'mes_unites', modificateur: { quoi: 'mouvement', valeur: 1 } },
      ];
    } else if (cle === 'cmd_hadran_ost') {
      commandant.pouvoir.effets = [{ cible: 'mes_unites', filtre: { mouvement: ['chenilles'] }, modificateur: { quoi: 'attaque', valeur: 1.3 } }];
      commandant.superPouvoir.effets = [
        { cible: 'mes_unites', filtre: { mouvement: ['chenilles'] }, modificateur: { quoi: 'attaque', valeur: 1.45 } },
        { cible: 'mes_unites', filtre: { mouvement: ['chenilles'] }, modificateur: { quoi: 'mouvement', valeur: 1 } },
      ];
    }
  }
  return commandant;
}

export function resoudreCommandantsScenario(scenario: Scenario): (CommandantJeu | null)[] {
  const resultat: (CommandantJeu | null)[] = [];
  for (const commandant of scenario.commandants) {
    resultat[commandant.camp] = chargerCommandantJeu(commandant.commandantCle, scenario.commandantsVersion ?? (scenario.catalogueVersion >= 7 ? 2 : 1));
  }
  return resultat;
}
