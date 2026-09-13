import { volumeNormalise, type Son, type SortieAudio } from './types';

/** Timbres synthétiques courts, sans téléchargement ni aléa du moteur de jeu. */
interface Timbre {
  hz: number; fin: number; duree: number; bruit: number;
  niveau: number; tonal: number; filtre: number; attaque?: number; pulsation?: number;
}
/** Matières sourdes et mécaniques ; aucune mélodie de récompense. */
export const TIMBRES: Record<Son, Timbre> = {
  pas: { hz: 72, fin: 58, duree: .11, bruit: .85, niveau: .24, tonal: .12, filtre: 650 },
  chenilles: { hz: 52, fin: 50, duree: .32, bruit: .8, niveau: .24, tonal: .18, filtre: 950, pulsation: 24 },
  moteur: { hz: 62, fin: 65, duree: .34, bruit: .45, niveau: .21, tonal: .35, filtre: 420, pulsation: 32 },
  rotor: { hz: 48, fin: 48, duree: .34, bruit: .85, niveau: .18, tonal: .12, filtre: 650, pulsation: 18 },
  sillage: { hz: 40, fin: 40, duree: .45, bruit: 1, niveau: .18, tonal: 0, filtre: 1100, attaque: .08 },
  parole: { hz: 120, fin: 120, duree: .028, bruit: .7, niveau: .045, tonal: 0, filtre: 1400 },
  vent: { hz: 30, fin: 30, duree: 4.8, bruit: 1, niveau: .055, tonal: 0, filtre: 480, attaque: 1.4 },
  pluie: { hz: 30, fin: 30, duree: 4.8, bruit: 1, niveau: .055, tonal: 0, filtre: 2600, attaque: 1.2 },
  insectes: { hz: 1800, fin: 1800, duree: 4.8, bruit: 1, niveau: .008, tonal: 0, filtre: 2800, attaque: 1.4, pulsation: 7 },
  vagues: { hz: 30, fin: 30, duree: 4.8, bruit: 1, niveau: .07, tonal: 0, filtre: 850, attaque: 1.8 },
  rafale: { hz: 105, fin: 65, duree: .095, bruit: 1, niveau: .42, tonal: .2, filtre: 2100 },
  canon: { hz: 78, fin: 38, duree: .32, bruit: 1, niveau: .55, tonal: .35, filtre: 1300 },
  missile: { hz: 65, fin: 55, duree: .5, bruit: 1, niveau: .34, tonal: .08, filtre: 1900, attaque: .06 },
  impact: { hz: 68, fin: 36, duree: .22, bruit: 1, niveau: .42, tonal: .2, filtre: 850 },
  hors_jeu: { hz: 58, fin: 38, duree: .55, bruit: .8, niveau: .28, tonal: .12, filtre: 550 },
  capture: { hz: 130, fin: 125, duree: .16, bruit: .65, niveau: .22, tonal: .12, filtre: 1100 },
  production: { hz: 82, fin: 78, duree: .24, bruit: .85, niveau: .26, tonal: .18, filtre: 800 },
  pouvoir: { hz: 56, fin: 48, duree: .55, bruit: .8, niveau: .34, tonal: .25, filtre: 1200, attaque: .04 },
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
      gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(p.niveau, t + (p.attaque ?? .004));
      gain.gain.exponentialRampToValueAtTime(.0001, t + p.duree);
      const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(p.hz, t);
      osc.frequency.exponentialRampToValueAtTime(p.fin, t + p.duree); const tonal = c.createGain(); tonal.gain.value = p.tonal; osc.connect(tonal); tonal.connect(gain);
      const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * p.duree), c.sampleRate);
      const donnees = buffer.getChannelData(0); let graine = (1977 + Math.floor(t * 1000)) >>> 0;
      for (let i = 0; i < donnees.length; i++) { graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0; const modulation = p.pulsation ? .55 + .45 * Math.sin(2 * Math.PI * p.pulsation * i / c.sampleRate) ** 2 : 1; donnees[i] = (graine / 2147483648 - 1) * p.bruit * modulation; }
      const bruit = c.createBufferSource(); bruit.buffer = buffer;
      const filtre = c.createBiquadFilter(); filtre.type = 'lowpass'; filtre.frequency.value = p.filtre;
      bruit.connect(filtre); filtre.connect(gain);
      let fini = false;
      const arreter = (): void => { if (fini) return; fini = true; voix.delete(arreter); osc.onended = null; try { osc.stop(); bruit.stop(); } catch {} osc.disconnect(); tonal.disconnect(); bruit.disconnect(); filtre.disconnect(); gain.disconnect(); };
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
