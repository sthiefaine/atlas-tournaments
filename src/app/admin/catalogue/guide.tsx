import Link from 'next/link';
import { chargerCatalogue } from '@/engine/index';
import { ficheUnite } from '@/render/fiche-unite';
import { ROLES_UNITES } from '@/content/roles-unites';

/** Même lecture des dégâts que la fiche du joueur, sans deuxième matrice. */
export function GuideCatalogue() {
  const catalogue = chargerCatalogue(0);
  return <section aria-label="Rôles et contre-unités" className="space-y-3 mb-6"><h2 className="admin-titre">Quand produire chaque unité ?</h2><p>{catalogue.cles.length} rôles à éprouver sur le terrain. Les dégâts ci-dessous sont les valeurs de base ; portée, abris, points de vie et initiative changent le duel réel.</p>{catalogue.cles.map(cle => {
    const unite = catalogue.unites[cle], fiche = ficheUnite(catalogue, cle), guide = ROLES_UNITES[cle];
    if (!unite || !fiche || !guide) return null;
    const duels = (liste: typeof fiche.forte) => liste.map(d => `${catalogue.unites[d.unite]?.nom ?? d.unite} (${d.degats})`).join(', ') || 'Aucune cible armée';
    return <details key={cle} className="asset-carte"><summary><strong>{unite.nom}</strong> · {guide.role}{unite.factionExclusive ? ' · Faction inconnue' : ''}</summary><p><strong>Quand produire :</strong> {guide.achat}</p><p><strong>Vigilance :</strong> {guide.limite}</p><p><strong>Dégâts de base les plus élevés :</strong> {duels(fiche.forte)}</p><p><strong>Menaces directes :</strong> {duels(fiche.craint)}</p><Link href={`/admin/assets/unite_${cle}_base`}>Modèle et déclinaisons</Link></details>;
  })}</section>;
}
