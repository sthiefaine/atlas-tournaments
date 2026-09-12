import { volumeNormalise, type Son, type SortieAudio } from './types';

/** Timbres synthétiques courts, sans téléchargement ni aléa du moteur de jeu. */
export const TIMBRES: Record<Son, { hz: number; fin: number; duree: number; bruit: number; niveau?: number }> = {
  pas: { hz: 95, fin: 45, duree: .12, bruit: .8, niveau: .2 },
  chenilles: { hz: 65, fin: 55, duree: .28, bruit: .7, niveau: .18 },
  moteur: { hz: 100, fin: 125, duree: .28, bruit: .15, niveau: .16 },
  rotor: { hz: 75, fin: 95, duree: .28, bruit: .5, niveau: .13 },
  sillage: { hz: 65, fin: 35, duree: .3, bruit: .9, niveau: .13 },
  parole: { hz: 310, fin: 240, duree: .045, bruit: .05, niveau: .08 },
  vent: { hz: 30, fin: 35, duree: 3.8, bruit: .9, niveau: .025 },
  pluie: { hz: 35, fin: 30, duree: 3.8, bruit: 1, niveau: .04 },
  insectes: { hz: 1800, fin: 2100, duree: .12, bruit: .05, niveau: .015 },
  vagues: { hz: 35, fin: 25, duree: 3.8, bruit: 1, niveau: .035 },
  rafale: { hz: 180, fin: 70, duree: .12, bruit: .65 },
  canon: { hz: 115, fin: 35, duree: .25, bruit: .5 },
  missile: { hz: 230, fin: 700, duree: .35, bruit: .75 },
  impact: { hz: 90, fin: 30, duree: .18, bruit: .8 },
  hors_jeu: { hz: 180, fin: 35, duree: .42, bruit: .3 },
  capture: { hz: 390, fin: 780, duree: .3, bruit: 0 },
  production: { hz: 260, fin: 520, duree: .18, bruit: 0 },
  pouvoir: { hz: 220, fin: 880, duree: .4, bruit: .1 },
};
export const MAX_VOIX = 12;
export interface AudioJeu extends SortieAudio { detruire(): void; regler(actif: boolean, volume: number): void }

/** Un contexte par partie, créé seulement après un geste. Aucune file différée. */
export function creerAudioJeu(cible: HTMLElement, actif: boolean, volume: number): AudioJeu {
  let contexte: AudioContext | null = null;
  let sortie: GainNode | null = null;
  let mort = false;
  let niveau = volumeNormalise(volume);
  const voix = new Set<() => void>();
  function annuler(): void { for (const arreter of [...voix]) arreter(); }
  function debloquer(): void {
    if (mort || !actif || document.hidden) return;
    try {
      if (!contexte) {
        contexte = new AudioContext();
        sortie = contexte.createGain();
        sortie.gain.value = niveau * .32;
        const limiteur = contexte.createDynamicsCompressor();
        limiteur.threshold.value = -12;
        limiteur.ratio.value = 12;
        sortie.connect(limiteur); limiteur.connect(contexte.destination);
      }
      void contexte.resume().catch(() => {});
    } catch { /* Web Audio indisponible : partie silencieuse. */ }
  }
  function visibilite(): void {
    if (document.hidden) { annuler(); if (contexte) void contexte.suspend().catch(() => {}); }
    // Retour silencieux jusqu'au prochain geste, jamais de sons rattrapés.
  }
  cible.addEventListener('pointerdown', debloquer, true);
  cible.addEventListener('keydown', debloquer, true);
  document.addEventListener('visibilitychange', visibilite);
  let ambiance: Son | null = null;
  let prochaineAmbiance = 0;
  const minuterie = setInterval(() => {
    if (ambiance && contexte?.state === 'running' && !document.hidden && contexte.currentTime >= prochaineAmbiance) {
      prochaineAmbiance = contexte.currentTime + 4;
      api.jouer(ambiance);
    }
  }, 1000);
  const api: AudioJeu = {
    environnement(son) { if (ambiance !== son) { ambiance = son; prochaineAmbiance = 0; } },
    annuler,
    regler(a, v) { actif = a; niveau = volumeNormalise(v); if (!a || !niveau) annuler(); if (sortie && contexte) sortie.gain.setTargetAtTime(a ? niveau * .32 : 0, contexte.currentTime, .015); },
    jouer(son) {
      if (mort || !actif || niveau === 0 || document.hidden || contexte?.state !== 'running' || !sortie) return;
      if (voix.size >= MAX_VOIX) voix.values().next().value?.();
      const c = contexte, t = c.currentTime, p = TIMBRES[son];
      const gain = c.createGain(); gain.connect(sortie);
      gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(p.niveau ?? .5, t + (p.duree > 1 ? .5 : .006));
      gain.gain.exponentialRampToValueAtTime(.0001, t + p.duree);
      const osc = c.createOscillator(); osc.type = 'triangle'; osc.frequency.setValueAtTime(p.hz, t);
      osc.frequency.exponentialRampToValueAtTime(p.fin, t + p.duree); osc.connect(gain);
      const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * p.duree), c.sampleRate);
      const donnees = buffer.getChannelData(0); let graine = 1977;
      for (let i = 0; i < donnees.length; i++) { graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0; donnees[i] = (graine / 2147483648 - 1) * p.bruit; }
      const bruit = c.createBufferSource(); bruit.buffer = buffer;
      const filtre = c.createBiquadFilter(); filtre.type = 'lowpass'; filtre.frequency.value = son === 'missile' ? 2200 : 1200;
      bruit.connect(filtre); filtre.connect(gain);
      let fini = false;
      const arreter = (): void => { if (fini) return; fini = true; voix.delete(arreter); osc.onended = null; try { osc.stop(); bruit.stop(); } catch {} osc.disconnect(); bruit.disconnect(); filtre.disconnect(); gain.disconnect(); };
      voix.add(arreter); osc.onended = arreter;
      osc.start(t); bruit.start(t); osc.stop(t + p.duree); bruit.stop(t + p.duree);
    },
    detruire() {
      if (mort) return; mort = true; clearInterval(minuterie); annuler();
      cible.removeEventListener('pointerdown', debloquer, true); cible.removeEventListener('keydown', debloquer, true);
      document.removeEventListener('visibilitychange', visibilite);
      if (contexte) void contexte.close().catch(() => {}); contexte = null; sortie = null;
    },
  };
  return api;
}
