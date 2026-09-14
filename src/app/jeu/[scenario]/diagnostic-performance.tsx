'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Jeu } from '@/render/jeu';
import { creerRelevePerformance } from '@/render/mesure-performance';
import { appareilTactile } from '@/render/appareil';
import { t } from '@/i18n';

/** Outil local à la demande : aucun autre canvas, aucun modèle téléchargé. */
export default function DiagnosticPerformance({ jeu, locale, scenario }: { jeu: RefObject<Jeu | null>; locale: string; scenario: string }) {
  const [ouvert, setOuvert] = useState(true);
  const [secondes, setSecondes] = useState<number | null>(null);
  const [rapport, setRapport] = useState('');
  const [copie, setCopie] = useState(false);
  const arreter = useRef<((publier: boolean) => void) | null>(null);
  useEffect(() => () => arreter.current?.(false), []);

  function commencer() {
    const partie = jeu.current;
    if (!partie || arreter.current) return;
    const releve = creerRelevePerformance(), debut = performance.now();
    const canvas = document.querySelector<HTMLCanvasElement>('.atlas-toile');
    const contexte = { backend: partie.mesurer()?.backend, tactile: appareilTactile(window),
      navigateur: navigator.userAgent, processeursLogiques: navigator.hardwareConcurrency,
      ecran: { largeur: window.innerWidth, hauteur: window.innerHeight, ratioAppareil: window.devicePixelRatio,
        pixelsCanvas: canvas ? [canvas.width, canvas.height] : null },
    };
    let visibleMs = 0, dernier = debut, masque = document.hidden;
    const blocages: number[] = [];
    const debrancher = partie.observerImages(image => {
      if (document.hidden) { releve.interrompre(); return; }
      releve.image(image);
    });
    let observateur: PerformanceObserver | null = null;
    if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      observateur = new PerformanceObserver(liste => {
        if (document.hidden) return;
        for (const entree of liste.getEntries()) if (entree.startTime >= debut && blocages.length < 1000) blocages.push(entree.duration);
      });
      observateur.observe({ type: 'longtask' });
    }
    const avancer = () => {
      const maintenant = performance.now();
      if (!masque) visibleMs += maintenant - dernier;
      dernier = maintenant;
    };
    const changerVisibilite = () => { avancer(); masque = document.hidden; releve.interrompre(); };
    document.addEventListener('visibilitychange', changerVisibilite);
    const minuterie = window.setInterval(() => {
      avancer(); setSecondes(Math.min(60, Math.floor(visibleMs / 1000)));
      if (visibleMs >= 60000) arreter.current?.(true);
    }, 500);
    arreter.current = publier => {
      avancer(); window.clearInterval(minuterie); debrancher(); observateur?.disconnect();
      document.removeEventListener('visibilitychange', changerVisibilite); arreter.current = null;
      if (!publier) return;
      const fichiers = performance.getEntriesByType('resource').filter((e): e is PerformanceResourceTiming => e instanceof PerformanceResourceTiming)
        .filter(e => new URL(e.name).origin === location.origin && /\/assets\/(modeles|donnees)\/.+\.(glb|png)(\?|$)/.test(e.name))
        .map(e => ({ chemin: new URL(e.name).pathname, dureeMs: Math.round(e.duration), octetsTransferes: e.transferSize, octetsEncodes: e.encodedBodySize }));
      setRapport(JSON.stringify({ version: 1, revisionOptimisation: 'lod0-mobile-2026-09-14', scenario,
        contexte, commit: process.env.ATLAS_VERSION_COMMIT ?? null, dureeVisibleMs: Math.round(visibleMs), dureeTotaleMs: Math.round(performance.now() - debut),
        ...releve.bilan(), derniereScene: partie.mesurer(),
        tachesLongues: observateur ? { compte: blocages.length, maximumMs: blocages.length ? Math.max(...blocages) : 0 } : null,
        fichiers, limites: [
          'Mesure locale de cadence et de soumission CPU ; aucune durée GPU directe ni certification du modèle de téléphone.',
          'Repos volontaire à environ 10 images/s sur tactile ; cible action 30 images/s.',
          'Triangles renderer.info approximatifs sur le repli WebGL ; familles décrit la scène entière, y compris hors caméra.',
          'Coût CPU de la première capture du duel inclus. Les changements de phase et retours en premier plan rompent les intervalles.',
          'Ressources : historique du chargement de cette page, éventuellement incomplet si le tampon navigateur a débordé ; transfert nul possible en cache.',
        ],
      }, null, 2));
      setSecondes(null); setOuvert(true);
    };
    setRapport(''); setCopie(false); setSecondes(0); setOuvert(false);
  }
  function telecharger() {
    const url = URL.createObjectURL(new Blob([rapport], { type: 'application/json' }));
    const lien = document.createElement('a'); lien.href = url; lien.download = `atlas-performance-${scenario}.json`; lien.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <aside className="atlas-diagnostic" aria-label={t(locale, 'performance.titre')}>
    <button type="button" className="atlas-diagnostic-entete" onClick={() => setOuvert(v => !v)} aria-expanded={ouvert}>
      {t(locale, 'performance.titre')}{secondes !== null ? ` · ${secondes}/60 s` : ''}
    </button>
    {ouvert && <div className="atlas-diagnostic-contenu">
      <p>{t(locale, 'performance.consigne')}</p>
      <div className="atlas-diagnostic-actions">
        {secondes === null ? <button type="button" onClick={commencer}>{t(locale, 'performance.demarrer')}</button>
          : <button type="button" onClick={() => arreter.current?.(true)}>{t(locale, 'performance.arreter')}</button>}
        {rapport && <>
          <button type="button" onClick={telecharger}>{t(locale, 'performance.telecharger')}</button>
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(rapport).then(() => setCopie(true)).catch(() => setCopie(false)); }}>{t(locale, copie ? 'performance.copie' : 'performance.copier')}</button>
        </>}
      </div>
      {rapport && <details><summary>{t(locale, 'performance.rapport')}</summary><textarea aria-label={t(locale, 'performance.rapport')} readOnly value={rapport} onFocus={e => e.currentTarget.select()} /></details>}
    </div>}
  </aside>;
}
