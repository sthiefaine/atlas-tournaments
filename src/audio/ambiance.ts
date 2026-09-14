import type { Son } from './types';

/** Nappes stéréo continues. Le changement de météo croise deux nappes pendant 1,4 s. */
export interface Ambiance { arreter(fondu?: number): void }
export type BruitsAmbiance = Map<'souffle' | 'grave', AudioBuffer>;
export function creerAmbiance(c: AudioContext, sortie: AudioNode, son: Son, cache: BruitsAmbiance): Ambiance {
  const profils = {
    vent: { grave: true, hz: 470, niveau: .28, vitesse: .09, profondeur: .07, type: 'lowpass' },
    pluie: { grave: false, hz: 3200, niveau: .15, vitesse: .17, profondeur: .018, type: 'lowpass' },
    vagues: { grave: false, hz: 1050, niveau: .19, vitesse: .115, profondeur: .12, type: 'lowpass' },
    insectes: { grave: false, hz: 3100, niveau: .025, vitesse: 5.3, profondeur: .02, type: 'bandpass' },
  } as const;
  const p = profils[son as keyof typeof profils] ?? profils.vent;
  const cle = p.grave ? 'grave' : 'souffle';
  let buffer = cache.get(cle);
  if (!buffer) {
    buffer = c.createBuffer(2, c.sampleRate * 12, c.sampleRate);
    for (let canal = 0; canal < 2; canal++) {
      const d = buffer.getChannelData(canal); let graine = 93271 + canal * 971, precedent = 0;
      for (let i = 0; i < d.length; i++) {
        graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0;
        const blanc = graine / 2147483648 - 1;
        precedent = .985 * precedent + .015 * blanc;
        d[i] = p.grave ? precedent * 7 : blanc;
      }
      // Raccord court du bruit filtré ; la modulation longue reste un oscillateur continu.
      const raccord = 2048;
      for (let i = 0; i < raccord; i++) {
        const poids = i / (raccord - 1);
        d[d.length - raccord + i] = d[d.length - raccord + i]! * (1 - poids) + d[i]! * poids;
      }
    }
    cache.set(cle, buffer);
  }
  const bruit = c.createBufferSource(); bruit.buffer = buffer; bruit.loop = true; bruit.loopStart = 2048 / c.sampleRate;
  const filtre = c.createBiquadFilter(); filtre.type = p.type; filtre.frequency.value = p.hz; filtre.Q.value = .65;
  const mouvement = c.createGain(); mouvement.gain.value = p.niveau;
  const lfo = c.createOscillator(); lfo.frequency.value = p.vitesse;
  const modulation = c.createGain(); modulation.gain.value = p.profondeur;
  lfo.connect(modulation); modulation.connect(mouvement.gain);
  const fondu = c.createGain(); fondu.gain.setValueAtTime(0, c.currentTime); fondu.gain.linearRampToValueAtTime(1, c.currentTime + 1.4);
  bruit.connect(filtre); filtre.connect(mouvement); mouvement.connect(fondu); fondu.connect(sortie);
  bruit.start(c.currentTime, 2.73); lfo.start();
  let arrete = false;
  bruit.onended = () => { bruit.disconnect(); filtre.disconnect(); mouvement.disconnect(); fondu.disconnect(); lfo.disconnect(); modulation.disconnect(); };
  return { arreter(duree = 1.4) {
    if (arrete) return; arrete = true;
    fondu.gain.cancelAndHoldAtTime(c.currentTime); fondu.gain.linearRampToValueAtTime(0, c.currentTime + duree);
    bruit.stop(c.currentTime + duree); lfo.stop(c.currentTime + duree);
  } };
}
