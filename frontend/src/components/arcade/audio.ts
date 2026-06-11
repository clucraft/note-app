/**
 * Arcade audio: a generative synthwave music engine and synthesized sound
 * effects, all built on the Web Audio API. No audio assets, no network.
 *
 * Everything routes through a master gain so closing the overlay (or the
 * boss key) silences the arcade instantly.
 */

const MUSIC_KEY = 'arcade.music';
const SFX_KEY = 'arcade.sfx';

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let arpDelay: DelayNode | null = null;

let musicOn = (localStorage.getItem(MUSIC_KEY) ?? '1') === '1';
let sfxOn = (localStorage.getItem(SFX_KEY) ?? '1') === '1';
let schedulerTimer: number | null = null;
let step = 0;
let nextTime = 0;

const BPM = 80;
const STEP = 60 / BPM / 4; // sixteenth note
const STEPS_PER_CHORD = 32; // two bars
// Am — F — C — G with smooth voice leading
const CHORDS: number[][] = [
  [57, 60, 64],
  [57, 60, 65],
  [55, 60, 64],
  [55, 59, 62],
];
const BASS_ROOTS = [33, 29, 36, 31];

function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();

  masterGain = ctx.createGain();
  masterGain.gain.value = 0.9;
  masterGain.connect(ctx.destination);

  musicGain = ctx.createGain();
  musicGain.gain.value = 0.14;
  musicGain.connect(masterGain);

  sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.5;
  sfxGain.connect(masterGain);

  // shared feedback delay for the arpeggio (the "stars going by" echo)
  arpDelay = ctx.createDelay(1);
  arpDelay.delayTime.value = STEP * 3;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.3;
  arpDelay.connect(feedback);
  feedback.connect(arpDelay);
  arpDelay.connect(musicGain);

  // reusable white-noise buffer for hats and explosions
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  return ctx;
}

/** Call from any user gesture; resumes a suspended context and starts music if enabled. */
export function unlockAudio() {
  const c = ensureContext();
  if (!c) return;
  if (c.state === 'suspended') {
    c.resume().then(() => {
      if (musicOn) startEngine();
    });
  } else if (musicOn) {
    startEngine();
  }
}

export function stopAllAudio() {
  stopEngine();
  if (ctx && ctx.state === 'running') {
    ctx.suspend();
  }
}

export function isMusicOn(): boolean {
  return musicOn;
}

export function isSfxOn(): boolean {
  return sfxOn;
}

export function toggleMusic(): boolean {
  musicOn = !musicOn;
  localStorage.setItem(MUSIC_KEY, musicOn ? '1' : '0');
  if (musicOn) unlockAudio();
  else stopEngine();
  return musicOn;
}

export function toggleSfx(): boolean {
  sfxOn = !sfxOn;
  localStorage.setItem(SFX_KEY, sfxOn ? '1' : '0');
  return sfxOn;
}

// ---------------- music engine ----------------

function startEngine() {
  const c = ensureContext();
  if (!c || schedulerTimer !== null || c.state !== 'running') return;
  step = 0;
  nextTime = c.currentTime + 0.1;
  schedulerTimer = window.setInterval(() => {
    if (!c) return;
    while (nextTime < c.currentTime + 0.35) {
      scheduleStep(step, nextTime);
      step = (step + 1) % (STEPS_PER_CHORD * CHORDS.length);
      nextTime += STEP;
    }
  }, 100);
}

function stopEngine() {
  if (schedulerTimer !== null) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

function scheduleStep(s: number, t: number) {
  const chordIdx = Math.floor(s / STEPS_PER_CHORD) % CHORDS.length;
  const chord = CHORDS[chordIdx];

  if (s % STEPS_PER_CHORD === 0) pad(chord, t, STEPS_PER_CHORD * STEP);
  if (s % 8 === 0) bass(BASS_ROOTS[chordIdx], t);
  if (s % 2 === 0 && Math.random() < 0.8) arp(chord, t);
  if (s % 16 === 0 || s % 16 === 8) kick(t);
  if (s % 4 === 2) hat(t);
}

function pad(chord: number[], t: number, dur: number) {
  if (!ctx || !musicGain) return;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.8;
  filter.frequency.setValueAtTime(450, t);
  filter.frequency.linearRampToValueAtTime(1100, t + dur * 0.5);
  filter.frequency.linearRampToValueAtTime(450, t + dur);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(0.05, t + 0.9);
  env.gain.setValueAtTime(0.05, t + dur - 1.2);
  env.gain.linearRampToValueAtTime(0, t + dur + 0.2);

  filter.connect(env);
  env.connect(musicGain);

  for (const note of chord) {
    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = midiToFreq(note);
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + dur + 0.3);
    }
  }
}

function bass(root: number, t: number) {
  if (!ctx || !musicGain) return;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = midiToFreq(root);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.16, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + STEP * 7);
  osc.connect(env);
  env.connect(musicGain);
  osc.start(t);
  osc.stop(t + STEP * 8);
}

function arp(chord: number[], t: number) {
  if (!ctx || !arpDelay || !musicGain) return;
  const note = chord[Math.floor(Math.random() * chord.length)] + 12;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = midiToFreq(note);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.07, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  osc.connect(env);
  env.connect(musicGain);
  env.connect(arpDelay);
  osc.start(t);
  osc.stop(t + 0.3);
}

function kick(t: number) {
  if (!ctx || !musicGain) return;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.25, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  osc.connect(env);
  env.connect(musicGain);
  osc.start(t);
  osc.stop(t + 0.2);
}

function hat(t: number) {
  if (!ctx || !musicGain || !noiseBuffer) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 7000;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.025, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  src.connect(filter);
  filter.connect(env);
  env.connect(musicGain);
  src.start(t, Math.random());
  src.stop(t + 0.06);
}

// ---------------- sound effects ----------------

function now(): number {
  return ctx?.currentTime ?? 0;
}

function ready(): boolean {
  if (!sfxOn) return false;
  const c = ensureContext();
  return !!c && c.state === 'running';
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) {
  if (!ctx || !sfxGain) return;
  const t = now();
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const env = ctx.createGain();
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(env);
  env.connect(sfxGain);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, filterFreq: number, gain: number, sweepTo?: number) {
  if (!ctx || !sfxGain || !noiseBuffer) return;
  const t = now();
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFreq, t);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const env = ctx.createGain();
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter);
  filter.connect(env);
  env.connect(sfxGain);
  src.start(t, Math.random());
  src.stop(t + dur + 0.02);
}

export const sfx = {
  /** Short blip — ball bounces; pass a frequency to vary wall vs paddle. */
  bounce(freq = 520) {
    if (!ready()) return;
    tone(freq, 0.06, 'triangle', 0.12);
  },
  /** Crunchy little burst — brick/enemy destroyed. */
  brick() {
    if (!ready()) return;
    noise(0.12, 2600, 0.14, 500);
    tone(300, 0.1, 'square', 0.05, 120);
  },
  /** Bigger boom — explosions, crashes. */
  explosion(big = false) {
    if (!ready()) return;
    noise(big ? 0.5 : 0.25, big ? 1400 : 1800, big ? 0.3 : 0.16, 120);
    tone(big ? 90 : 130, big ? 0.4 : 0.2, 'sine', big ? 0.25 : 0.12, 40);
  },
  /** Quick laser zap — shots. */
  zap() {
    if (!ready()) return;
    tone(880, 0.08, 'square', 0.06, 220);
  },
  /** Cheerful rising blip — power-ups, pickups, food. */
  pickup() {
    if (!ready()) return;
    tone(520, 0.07, 'triangle', 0.1, 1040);
  },
  /** Low thud — piece lock, life lost. */
  thud() {
    if (!ready()) return;
    tone(160, 0.1, 'sine', 0.15, 70);
  },
  /** Rising sweep — wave/level cleared. */
  sweep() {
    if (!ready()) return;
    tone(330, 0.35, 'triangle', 0.1, 1320);
  },
  /** Sad descending tones — game over. */
  over() {
    if (!ready()) return;
    tone(392, 0.18, 'triangle', 0.1);
    setTimeout(() => {
      if (ready()) tone(311, 0.18, 'triangle', 0.1);
    }, 180);
    setTimeout(() => {
      if (ready()) tone(233, 0.35, 'triangle', 0.1);
    }, 360);
  },
};
