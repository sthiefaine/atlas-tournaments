import { readdirSync } from 'node:fs';
import path from 'node:path';
import { genererSpecs } from '@/assets/catalogue';
import CarteAssets from './carte';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Carte des assets · Atlas' };
export default function PageAssets(): React.ReactElement {
  const lire = (dossier: string) => {
    try { return new Set(readdirSync(path.join(process.cwd(), 'public/assets', dossier))); }
    catch { return new Set<string>(); }
  };
  const actifs = lire('modeles'), candidats = lire('candidats');
  const assets = genererSpecs().map(s => {
    const fichier = `${s.id}_lod0.glb`;
    const dossier = candidats.has(fichier) ? 'candidats' : actifs.has(fichier) ? 'modeles' : null;
    return { id: s.id, famille: s.type, url: dossier ? `/assets/${dossier}/${fichier}` : null, candidat: dossier === 'candidats' };
  });
  return <CarteAssets assets={assets} />;
}
