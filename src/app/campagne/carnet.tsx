'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { t } from '@/i18n/index';
import { PROFILS_BIOME } from '@/mapgen/parametres';
import campagne from '../../../content/campagne.json';
import { lireProgression, missionOuverte, type Progression } from './progression';

const codes = campagne.missions.map(m => m.scenarioCle);

export default function Carnet() {
  const [progression, setProgression] = useState<Progression>({ version: 1, victoires: [] });
  const [pret, setPret] = useState(false);
  useEffect(() => {
    const lire = () => { setProgression(lireProgression()); setPret(true); };
    lire();
    window.addEventListener('pageshow', lire);
    window.addEventListener('storage', lire);
    return () => { window.removeEventListener('pageshow', lire); window.removeEventListener('storage', lire); };
  }, []);
  const gagnees = codes.filter(c => progression.victoires.includes(c)).length;
  return <main className="campagne-page">
    <header className="campagne-entete">
      <p className="campagne-kicker">{t('fr', 'campagne.surtitre')}</p>
      <h1>{campagne.titre}</h1>
      <p className="campagne-intro">{campagne.introduction}</p>
      <p className="campagne-progression">{t('fr', 'campagne.progression', { n: gagnees, total: codes.length })}</p>
      {gagnees === codes.length ? <p>{t('fr', 'campagne.fin')}</p> : null}
    </header>
    <ol className="campagne-etapes">
      {campagne.missions.map((m, i) => {
        const gagnee = progression.victoires.includes(m.scenarioCle);
        const ouverte = pret && missionOuverte(codes, m.scenarioCle, progression);
        return <li className={`campagne-etape ${ouverte ? '' : 'verrouillee'}`} key={m.scenarioCle}>
          <div className="campagne-numero">{String(i + 1).padStart(2, '0')}</div>
          <div className="campagne-fiche">
            <p className="campagne-kicker">{t('fr', `biome.${m.biome}`)} · {t('fr', gagnee ? 'campagne.gagnee' : ouverte ? 'campagne.disponible' : 'campagne.verrouillee')}</p>
            <h2>{m.titre}</h2><p className="campagne-kicker">{t('fr', m.entrainement ? 'campagne.entrainement' : 'campagne.officiel')}</p>
            <p>{m.recit}</p>
            <p className="campagne-but"><strong>{t('fr', 'campagne.objectif')}</strong> — {m.objectif}</p>
            {ouverte ? <Link className="atlas-bouton" href={`/jeu/${m.scenarioCle}`}>{t('fr', gagnee ? 'campagne.rejouer' : 'campagne.briefing')}</Link> : null}
          </div>
        </li>;
      })}
    </ol>
    <details className="campagne-biomes"><summary>{t('fr', 'campagne.biomes')}</summary><dl>{Object.entries(PROFILS_BIOME).map(([cle, profil]) => <div key={cle}><dt>{t('fr', `biome.${cle}`)}</dt><dd>{profil.description}</dd></div>)}</dl></details>
    <footer className="campagne-pied"><p>{t('fr', 'campagne.sauvegarde')}</p><Link href="/jeu/demo">{t('fr', 'campagne.demo')}</Link></footer>
  </main>;
}
