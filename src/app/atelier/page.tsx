import { validerMapDef, validerScenario } from '@/schemas/index';
import scenarioBocage from '../../../content/scenarios/qualification_bocage.json';
import carteBocage from '../../../content/cartes/carte_qualification_bocage.json';
import scenarioCote from '../../../content/scenarios/passage_des_marees.json';
import carteCote from '../../../content/cartes/carte_passage_des_marees.json';
import scenarioCol from '../../../content/scenarios/pacte_du_col.json';
import carteCol from '../../../content/cartes/carte_pacte_du_col.json';
import Atelier from './atelier';

export const metadata = { title: 'Atelier des mondes · Atlas' };

export default function PageAtelier(): React.ReactElement {
  const mondes = [
    { nom: 'Bocage', scenario: scenarioBocage, carte: carteBocage },
    { nom: 'Littoral', scenario: scenarioCote, carte: carteCote },
    { nom: 'Col montagneux', scenario: scenarioCol, carte: carteCol },
  ].map(monde => {
    const scenario = validerScenario(monde.scenario);
    const carte = validerMapDef(monde.carte);
    if (!scenario.ok || !carte.ok) throw new Error('Un monde de l’atelier est invalide.');
    return { nom: monde.nom, scenario: scenario.valeur, carte: carte.valeur };
  });
  return <Atelier mondes={mondes} />;
}
