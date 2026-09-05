/** Données tactiques des commandants jouables ; aucune dépendance au moteur. */
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

/** Reiner protège ses unités ; le profil offensif reste le repli des autres clés. */
export function chargerCommandantJeu(cle: Cle): CommandantJeu {
  const defensif = cle === 'cmd_tomas_reiner';
  const quoi = defensif ? 'defense' : 'attaque';
  return {
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
}

export function resoudreCommandantsScenario(scenario: Scenario): (CommandantJeu | null)[] {
  const resultat: (CommandantJeu | null)[] = [];
  for (const commandant of scenario.commandants) {
    resultat[commandant.camp] = chargerCommandantJeu(commandant.commandantCle);
  }
  return resultat;
}
