import { creerAmbiance, type Ambiance, type BruitsAmbiance } from './ambiance';
import { normaliserMixage, type MixageAudio, volumeNormalise, type Son, type SortieAudio } from './types';

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
export interface AudioJeu extends SortieAudio {
  detruire(): void;
  regler(actif: boolean, volume: number, mixage?: Partial<MixageAudio>): void;
}

/** Un seul contexte, ouvert au premier geste, sans sons mis en attente. */
export function creerAudioJeu(cible: HTMLElement, actif: boolean, volume: number, mixage?: Partial<MixageAudio>): AudioJeu {
  const doc = cible.ownerDocument;
  let contexte: AudioContext | null = null, sortie: GainNode | null = null;
  let bus: Record<keyof MixageAudio, GainNode> | null = null, respiration: GainNode | null = null;
  let mort = false, niveau = volumeNormalise(volume), mix = normaliserMixage(mixage);
  let environnement: Son | null = null, nappe: Ambiance | null = null, sonNappe: Son | null = null;
  let derniereParole = -1, variation = 0;
  const voix = new Set<() => void>(), cacheAmbiance: BruitsAmbiance = new Map();
  const cacheBruit = new Map<Son, AudioBuffer>();
  function annuler(): void { for (const arreter of [...voix]) arreter(); }
  function arreterNappe(fondu = .2): void { nappe?.arreter(fondu); nappe = null; sonNappe = null; }
  function actualiserAmbiance(): void {
    if (!contexte || !respiration || !actif || !niveau || !mix.ambiance || doc.hidden || contexte.state !== 'running') { arreterNappe(); return; }
    if (environnement === sonNappe) return;
    arreterNappe(1.4);
    if (environnement) { nappe = creerAmbiance(contexte, respiration, environnement, cacheAmbiance); sonNappe = environnement; }
  }
  function debloquer(): void {
    if (mort || !actif || doc.hidden) return;
    try {
      if (!contexte) {
        contexte = new AudioContext(); sortie = contexte.createGain(); sortie.gain.value = niveau * .32;
        const limiteur = contexte.createDynamicsCompressor(); limiteur.threshold.value = -12; limiteur.ratio.value = 12;
        sortie.connect(limiteur); limiteur.connect(contexte.destination);
        bus = { ambiance: contexte.createGain(), effets: contexte.createGain(), dialogues: contexte.createGain() };
        for (const cle of ['ambiance', 'effets', 'dialogues'] as const) { bus[cle].gain.value = mix[cle]; bus[cle].connect(sortie); }
        respiration = contexte.createGain(); respiration.connect(bus.ambiance);
      }
      void contexte.resume().then(() => { if (!mort) actualiserAmbiance(); }).catch(() => {});
    } catch { /* Web Audio absent : le jeu reste jouable en silence. */ }
  }
  function visibilite(): void {
    if (doc.hidden) { annuler(); arreterNappe(0); if (contexte) void contexte.suspend().catch(() => {}); }
    // Après un retour, le prochain geste réactive le son ; aucun rattrapage.
  }
  cible.addEventListener('pointerdown', debloquer, true); cible.addEventListener('keydown', debloquer, true);
  doc.addEventListener('visibilitychange', visibilite);
  return {
    environnement(son) { environnement = son; actualiserAmbiance(); },
    annuler,
    regler(a, v, m) {
      actif = a; niveau = volumeNormalise(v); if (m) mix = normaliserMixage(m);
      if (!a || !niveau) annuler();
      if (sortie && contexte && bus) {
        sortie.gain.setTargetAtTime(a ? niveau * .32 : 0, contexte.currentTime, .03);
        for (const cle of ['ambiance', 'effets', 'dialogues'] as const) bus[cle].gain.setTargetAtTime(mix[cle], contexte.currentTime, .05);
      }
      actualiserAmbiance();
    },
    jouer(son) {
      if (mort || !actif || !niveau || doc.hidden || contexte?.state !== 'running' || !bus) return;
      if (['vent', 'pluie', 'vagues', 'insectes'].includes(son)) { environnement = son; actualiserAmbiance(); return; }
      const c = contexte, t = c.currentTime, p = TIMBRES[son], dialogue = son === 'parole';
      if (!(dialogue ? mix.dialogues : mix.effets)) return;
      if (dialogue && t - derniereParole < .075) return;
      if (dialogue) derniereParole = t;
      if (voix.size >= MAX_VOIX) voix.values().next().value?.();
      // Les tirs et la radio passent devant le paysage, sans le couper.
      if (respiration && (dialogue || ['canon', 'rafale', 'missile', 'impact', 'pouvoir'].includes(son))) {
        const g = respiration.gain; g.cancelAndHoldAtTime(t); g.linearRampToValueAtTime(dialogue ? .7 : .5, t + .025); g.setTargetAtTime(1, t + p.duree, .35);
      }
      const gain = c.createGain(); gain.connect(dialogue ? bus.dialogues : bus.effets);
      gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(p.niveau, t + (p.attaque ?? .004)); gain.gain.exponentialRampToValueAtTime(.0001, t + p.duree);
      const ecart = [1, .96, 1.035, .985, 1.018][variation++ % 5]!;
      const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(p.hz * ecart, t); osc.frequency.exponentialRampToValueAtTime(p.fin * ecart, t + p.duree);
      const tonal = c.createGain(); tonal.gain.value = p.tonal; osc.connect(tonal); tonal.connect(gain);
      let buffer = cacheBruit.get(son);
      if (!buffer) {
        buffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const d = buffer.getChannelData(0); let graine = 1977;
        for (let i = 0; i < d.length; i++) {
          graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0;
          const modulation = p.pulsation ? .35 + .65 * Math.sin(Math.PI * p.pulsation * i / c.sampleRate) ** 4 : 1;
          d[i] = (graine / 2147483648 - 1) * p.bruit * modulation;
        }
        cacheBruit.set(son, buffer);
      }
      const bruit = c.createBufferSource(); bruit.buffer = buffer; bruit.loop = true; bruit.playbackRate.value = ecart;
      const filtre = c.createBiquadFilter(); filtre.type = dialogue ? 'bandpass' : 'lowpass'; filtre.frequency.value = (dialogue ? 850 : p.filtre) * ecart; filtre.Q.value = dialogue ? .8 : .7;
      bruit.connect(filtre); filtre.connect(gain);
      let fini = false;
      const arreter = (): void => {
        if (fini) return; fini = true; voix.delete(arreter); osc.onended = null;
        try { osc.stop(); bruit.stop(); } catch { /* Déjà arrêtés par leur enveloppe. */ }
        osc.disconnect(); tonal.disconnect(); bruit.disconnect(); filtre.disconnect(); gain.disconnect();
      };
      voix.add(arreter); osc.onended = arreter;
      osc.start(t); bruit.start(t, (variation * .137) % .4); osc.stop(t + p.duree); bruit.stop(t + p.duree);
    },
    detruire() {
      if (mort) return; mort = true; annuler(); arreterNappe(0);
      cible.removeEventListener('pointerdown', debloquer, true); cible.removeEventListener('keydown', debloquer, true); doc.removeEventListener('visibilitychange', visibilite);
      if (contexte) void contexte.close().catch(() => {});
      contexte = null; sortie = null; bus = null; respiration = null; cacheBruit.clear(); cacheAmbiance.clear();
    },
  };
}
