/**
 * Sonidos navideños generados con Web Audio (campanitas): sin archivos ni descargas.
 * Reglas:
 *  · Solo suenan como respuesta a algo que la persona hizo (nunca solos al abrir la app).
 *  · Se pueden apagar desde el perfil o el menú; la preferencia se recuerda en el teléfono.
 *  · Volumen bajo y sonidos cortos.
 */
export type SoundName = 'tap' | 'success' | 'celebrate' | 'error' | 'tick' | 'reveal';

const KEY = 'nf-sound';
const listeners = new Set<(enabled: boolean) => void>();

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(KEY, enabled ? 'on' : 'off');
  } catch {
    // modo privado: vale solo para esta visita
  }
  listeners.forEach((l) => l(enabled));
  if (enabled) playSound('success');
}

export function onSoundChange(listener: (enabled: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Una campanita: tono principal + armónicos que se apagan rápido. */
function bell(ac: AudioContext, freq: number, at: number, duration = 0.9, volume = 0.16) {
  const out = ac.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(volume, at + 0.012);
  out.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  out.connect(ac.destination);
  for (const [ratio, gain] of [
    [1, 1],
    [2.76, 0.35],
    [5.4, 0.15],
  ] as const) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * ratio, at);
    g.gain.value = gain;
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + duration + 0.05);
  }
}

/** Golpecito suave (botones, pasos de la ruleta). */
function blip(ac: AudioContext, freq: number, at: number, duration = 0.07, volume = 0.07) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, at);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.7, at + duration);
  g.gain.setValueAtTime(volume, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

// Notas (Hz)
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const E6 = 1318.5;
const G6 = 1568;

/** Primeras notas de "Jingle Bells" (melodía de dominio público, 1857). */
const JINGLE: [number, number][] = [
  [E5, 1],
  [E5, 1],
  [E5, 2],
  [E5, 1],
  [E5, 1],
  [E5, 2],
  [E5, 1],
  [G5, 1],
  [C5, 1.5],
  [D5, 0.5],
  [E5, 3],
];

export function playSound(name: SoundName) {
  if (!isSoundEnabled()) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  switch (name) {
    case 'tap':
      blip(ac, 880, t);
      break;
    case 'tick':
      blip(ac, 1320, t, 0.05, 0.05);
      break;
    case 'success':
      bell(ac, C6, t, 0.5);
      bell(ac, E6, t + 0.11, 0.7);
      break;
    case 'reveal':
      [C6, E6, G6].forEach((f, i) => bell(ac, f, t + i * 0.09, 0.8, 0.13));
      break;
    case 'error':
      blip(ac, 233, t, 0.22, 0.09);
      blip(ac, 196, t + 0.16, 0.3, 0.09);
      break;
    case 'celebrate': {
      let at = t;
      for (const [freq, beats] of JINGLE) {
        bell(ac, freq * 2, at, 0.22 * beats + 0.35, 0.13);
        at += 0.17 * beats;
      }
      break;
    }
  }
}
