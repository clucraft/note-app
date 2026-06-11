/**
 * Arcade audio: a generative synthwave music engine and synthesized sound
 * effects, all built on the Web Audio API. No audio assets, no network.
 *
 * The music engine plays one of several "tracks" — parameter patches
 * (tempo, chords, voicing, drum density) over the same synth core.
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

interface Track {
  name: string;
  bpm: number;
  chords: number[][]; // midi notes per chord
  bass: number[]; // midi root per chord
  bassSteps: number[]; // steps within a chord (mod 32) where the bass plays
  padType: OscillatorType;
  padGain: number;
  padFilter: [number, number]; // sweep range, Hz
  arpEvery: number; // trigger an arp note every N sixteenth steps
  arpChance: number;
  arpOctave: number; // semitones above chord tones
  kick: boolean;
  hat: boolean;
  hatEvery: number;
}

const STEPS_PER_CHORD = 32; // two bars of sixteenths

const TRACKS: Track[] = [
  {
    name: 'MIDNIGHT DRIVE',
    bpm: 80,
    chords: [
      [57, 60, 64],
      [57, 60, 65],
      [55, 60, 64],
      [55, 59, 62],
    ], // Am F C G
    bass: [33, 29, 36, 31],
    bassSteps: [0, 8, 16, 24],
    padType: 'sawtooth',
    padGain: 0.05,
    padFilter: [450, 1100],
    arpEvery: 2,
    arpChance: 0.8,
    arpOctave: 12,
    kick: true,
    hat: true,
    hatEvery: 4,
  },
  {
    name: 'NEON COAST',
    bpm: 72,
    chords: [
      [57, 62, 65],
      [58, 62, 65],
      [57, 60, 65],
      [55, 60, 64],
    ], // Dm Bb F C
    bass: [38, 34, 29, 36],
    bassSteps: [0, 12, 16, 28],
    padType: 'sawtooth',
    padGain: 0.04,
    padFilter: [380, 900],
    arpEvery: 4,
    arpChance: 0.7,
    arpOctave: 12,
    kick: false,
    hat: true,
    hatEvery: 4,
  },
  {
    name: 'STARFALL',
    bpm: 84,
    chords: [
      [55, 59, 64],
      [55, 60, 64],
      [55, 59, 62],
      [54, 57, 62],
    ], // Em C G D
    bass: [28, 36, 31, 26],
    bassSteps: [0, 8, 16, 24],
    padType: 'sawtooth',
    padGain: 0.05,
    padFilter: [500, 1300],
    arpEvery: 2,
    arpChance: 0.9,
    arpOctave: 12,
    kick: true,
    hat: true,
    hatEvery: 4,
  },
  {
    name: 'CHROME SUNSET',
    bpm: 76,
    chords: [
      [53, 57, 60],
      [55, 59, 62],
      [57, 60, 64],
      [55, 59, 62],
    ], // F G Am G
    bass: [29, 31, 33, 31],
    bassSteps: [0, 16],
    padType: 'triangle',
    padGain: 0.07,
    padFilter: [500, 1400],
    arpEvery: 4,
    arpChance: 0.5,
    arpOctave: 24,
    kick: false,
    hat: false,
    hatEvery: 4,
  },
  {
    name: 'GRID RUNNER',
    bpm: 88,
    chords: [
      [57, 60, 64],
      [57, 60, 64],
      [53, 57, 60],
      [55, 59, 62],
    ], // Am Am F G
    bass: [33, 33, 29, 31],
    bassSteps: [0, 4, 8, 12, 16, 20, 24, 28],
    padType: 'sawtooth',
    padGain: 0.045,
    padFilter: [450, 1200],
    arpEvery: 2,
    arpChance: 0.85,
    arpOctave: 12,
    kick: true,
    hat: true,
    hatEvery: 2,
  },
  {
    name: 'AFTERGLOW',
    bpm: 64,
    chords: [
      [60, 64, 67, 71],
      [53, 57, 60, 64],
      [57, 60, 64, 67],
      [55, 59, 62, 67],
    ], // Cmaj7 Fmaj7 Am7 G6
    bass: [36, 29, 33, 31],
    bassSteps: [0],
    padType: 'sawtooth',
    padGain: 0.04,
    padFilter: [350, 800],
    arpEvery: 8,
    arpChance: 0.5,
    arpOctave: 12,
    kick: false,
    hat: false,
    hatEvery: 4,
  },
];

let trackIdx = 0;

function track(): Track {
  return TRACKS[trackIdx];
}

function stepSeconds(): number {
  return 60 / track().bpm / 4;
}

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
  arpDelay = ctx.createDelay(2);
  arpDelay.delayTime.value = stepSeconds() * 3;
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

export function getTrackName(): string {
  return track().name;
}

/** Advance to the next track; restarts the engine if it's playing. */
export function nextTrack(): string {
  trackIdx = (trackIdx + 1) % TRACKS.length;
  if (schedulerTimer !== null) {
    stopEngine();
    startEngine();
  }
  return track().name;
}

/** Pick a random track — called when the arcade opens so each visit differs. */
export function randomizeTrack(): string {
  trackIdx = Math.floor(Math.random() * TRACKS.length);
  return track().name;
}

// ---------------- music engine ----------------

function startEngine() {
  const c = ensureContext();
  if (!c || schedulerTimer !== null || c.state !== 'running') return;
  if (arpDelay) arpDelay.delayTime.value = stepSeconds() * 3;
  step = 0;
  nextTime = c.currentTime + 0.1;
  schedulerTimer = window.setInterval(() => {
    if (!c) return;
    const dur = stepSeconds();
    while (nextTime < c.currentTime + 0.35) {
      scheduleStep(step, nextTime);
      step = (step + 1) % (STEPS_PER_CHORD * track().chords.length);
      nextTime += dur;
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
  const tr = track();
  const chordIdx = Math.floor(s / STEPS_PER_CHORD) % tr.chords.length;
  const chord = tr.chords[chordIdx];
  const inChord = s % STEPS_PER_CHORD;

  if (inChord === 0) pad(tr, chord, t, STEPS_PER_CHORD * stepSeconds());
  if (tr.bassSteps.includes(inChord % 32)) bass(tr.bass[chordIdx], t);
  if (s % tr.arpEvery === 0 && Math.random() < tr.arpChance) arp(tr, chord, t);
  if (tr.kick && (s % 16 === 0 || s % 16 === 8)) kick(t);
  if (tr.hat && s % tr.hatEvery === Math.floor(tr.hatEvery / 2)) hat(t);
}

function pad(tr: Track, chord: number[], t: number, dur: number) {
  if (!ctx || !musicGain) return;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.8;
  filter.frequency.setValueAtTime(tr.padFilter[0], t);
  filter.frequency.linearRampToValueAtTime(tr.padFilter[1], t + dur * 0.5);
  filter.frequency.linearRampToValueAtTime(tr.padFilter[0], t + dur);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(tr.padGain, t + 0.9);
  env.gain.setValueAtTime(tr.padGain, t + dur - 1.2);
  env.gain.linearRampToValueAtTime(0, t + dur + 0.2);

  filter.connect(env);
  env.connect(musicGain);

  for (const note of chord) {
    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator();
      osc.type = tr.padType;
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
  const dur = stepSeconds();
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = midiToFreq(root);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.16, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + dur * 7);
  osc.connect(env);
  env.connect(musicGain);
  osc.start(t);
  osc.stop(t + dur * 8);
}

function arp(tr: Track, chord: number[], t: number) {
  if (!ctx || !arpDelay || !musicGain) return;
  const note = chord[Math.floor(Math.random() * chord.length)] + tr.arpOctave;
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
