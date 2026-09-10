import Link from 'next/link';
import { IDENTITES_COMMANDANTS } from '@/content/identites-commandants';
import { lireProfilCommandant } from '@/content/profils-commandants';
import { chargerCatalogue } from '@/engine/index';
import { traducteur } from '@/i18n/index';
import { effetsDeCapacite, faiblesseDuProfil, repliquesDuProfil } from '@/render/kit-commandant';
import { lignesPouvoir, nomTerrain, nomUnite } from '@/render/libelles';

const locale = 'fr';

/**
 * Le kit d'un commandant tel que le catalogue tactique le déclare, lu sur ses
 * **effets** par la même `lignesPouvoir` que la jauge du HUD — jamais une
 * phrase recopiée, qui dériverait au premier chiffre changé. La faiblesse et
 * les répliques n'existent qu'à partir de la révision 4 : un profil d'avant
 * n'en montre pas, et la page ne plante pas dessus.
 */
function KitCommandant({ cle }: { cle: string }) {
  const profil = lireProfilCommandant(cle);
  if (!profil) return null;
  const t = traducteur(locale);
  const cat = chargerCatalogue();
  const noms = {
    unite: (c: Parameters<typeof nomUnite>[2]) => nomUnite(locale, cat, c),
    terrain: (c: Parameters<typeof nomTerrain>[2]) => nomTerrain(locale, cat, c),
  };
  const faiblesse = faiblesseDuProfil(profil);
  const repliques = repliquesDuProfil(profil);
  const capacites = [
    { titre: profil.pouvoir.nom, lignes: lignesPouvoir(t, effetsDeCapacite(profil.pouvoir), { noms, duree: profil.pouvoir.duree }), replique: repliques?.pouvoir ?? null },
    { titre: profil.superPouvoir.nom, lignes: lignesPouvoir(t, effetsDeCapacite(profil.superPouvoir), { noms, duree: profil.superPouvoir.duree }), replique: repliques?.super ?? null },
  ];
  return <dl className="carnet-kit">
    <dt>{t('hud.passif')}</dt><dd>{profil.passif ? lignesPouvoir(t, [profil.passif], { noms }).join(' · ') : t('hud.sans_passif')}</dd>
    {capacites.map((c) => <div key={c.titre}>
      <dt>{c.titre}</dt><dd>{c.lignes.join(' · ')}{c.replique ? <q className="carnet-replique">{c.replique}</q> : null}</dd>
    </div>)}
    {faiblesse ? <><dt>{t('hud.faiblesse')}</dt><dd>{faiblesse.description} · {lignesPouvoir(t, [faiblesse.effet], { noms }).join(' · ')}</dd></> : null}
  </dl>;
}

export function GuideCommandants() {
  return <section className="aube-parcours" aria-label="Styles des commandants"><h2>Connaître les commandants</h2><p>Dans les nouvelles épreuves Aube, leurs pouvoirs favorisent des décisions différentes. Les entraînements et anciens scénarios conservent leurs règles. Les dilemmes se règlent après les épreuves concernées ; consulter ce carnet ne choisit rien à votre place.</p>{IDENTITES_COMMANDANTS.map(p => <details className="asset-carte mb-3" key={p.cle}><summary><strong>{p.nom}</strong> · {p.style}</summary><p>{p.capacites}</p><KitCommandant cle={p.cle} /><p><strong>Vigilance :</strong> {p.faiblesse}</p><p><strong>Dilemme :</strong> {p.dilemme}</p><Link href={`/jeu/${p.mission}`}>Voir l’épreuve liée</Link></details>)}</section>;
}
