import { Midi } from '@tonejs/midi';
import * as Tone from 'tone';
import { getEffectsInput, getTransport } from './AudioEngine';

let currentMidi: Midi | null = null;
let isPlaying = false;
let trackSynths: Tone.PolySynth[] = [];

/** Master volume for all MidiPlayer synths — used for fading */
const volume = new Tone.Volume(-6);

const transport = getTransport();

let connected = false;
function ensureConnected() {
  if (!connected) {
    volume.connect(getEffectsInput());
    connected = true;
  }
}

export function setVolume(v: number) { volume.volume.value = v; }
export function getVolumeValue(): number { return volume.volume.value; }

export async function loadMidi(url: string): Promise<Midi> {
  const data = await (await fetch(url)).arrayBuffer();
  currentMidi = new Midi(data);
  return currentMidi;
}

function disposeTrackSynths() {
  for (const s of trackSynths) {
    try { s.releaseAll(); } catch { /* noop */ }
    s.dispose();
  }
  trackSynths = [];
}

function createSynthForTrack(program: number): Tone.PolySynth {
  let synth: Tone.PolySynth;

  if (program <= 7) {
    // Piano
    synth = new Tone.PolySynth({
      maxPolyphony: 48,
      voice: Tone.FMSynth,
      options: {
        harmonicity: 3,
        modulationIndex: 1,
        envelope: { attack: 0.005, decay: 0.4, sustain: 0.2, release: 0.4 },
        modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.3 },
        volume: -8,
      },
    });
  } else if (program >= 8 && program <= 15) {
    // Chromatic Percussion (celesta, glockenspiel, music box, vibraphone, etc.)
    synth = new Tone.PolySynth({
      maxPolyphony: 32,
      voice: Tone.FMSynth,
      options: {
        harmonicity: 6,
        modulationIndex: 2,
        envelope: { attack: 0.001, decay: 0.6, sustain: 0.05, release: 0.5 },
        modulationEnvelope: { attack: 0.001, decay: 0.3, sustain: 0.1, release: 0.5 },
        volume: -10,
      },
    });
  } else if (program >= 16 && program <= 23) {
    // Organ
    synth = new Tone.PolySynth({
      maxPolyphony: 32,
      voice: Tone.AMSynth,
      options: {
        harmonicity: 2,
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.3 },
        modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.3 },
        volume: -10,
      },
    });
  } else if (program >= 24 && program <= 31) {
    // Guitar
    synth = new Tone.PolySynth({
      maxPolyphony: 32,
      voice: Tone.FMSynth,
      options: {
        harmonicity: 2,
        modulationIndex: 3,
        envelope: { attack: 0.002, decay: 0.3, sustain: 0.1, release: 0.3 },
        modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.3 },
        volume: -10,
      },
    });
  } else if (program >= 32 && program <= 39) {
    // Bass
    synth = new Tone.PolySynth({
      maxPolyphony: 16,
      voice: Tone.FMSynth,
      options: {
        harmonicity: 1,
        modulationIndex: 2,
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.2 },
        modulationEnvelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.2 },
        volume: -6,
      },
    });
  } else if (program >= 40 && program <= 55) {
    // Strings / Ensemble
    synth = new Tone.PolySynth({
      maxPolyphony: 32,
      voice: Tone.AMSynth,
      options: {
        harmonicity: 2,
        envelope: { attack: 0.3, decay: 0.5, sustain: 0.8, release: 0.5 },
        modulationEnvelope: { attack: 0.5, decay: 0.3, sustain: 0.8, release: 0.5 },
        volume: -12,
      },
    });
  } else if (program >= 56 && program <= 63) {
    // Brass
    synth = new Tone.PolySynth({
      maxPolyphony: 32,
      voice: Tone.AMSynth,
      options: {
        harmonicity: 1.5,
        envelope: { attack: 0.05, decay: 0.3, sustain: 0.7, release: 0.3 },
        modulationEnvelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.3 },
        volume: -10,
      },
    });
  } else if (program >= 64 && program <= 79) {
    // Reed / Pipe (woodwinds)
    synth = new Tone.PolySynth({
      maxPolyphony: 32,
      voice: Tone.FMSynth,
      options: {
        harmonicity: 2,
        modulationIndex: 1,
        envelope: { attack: 0.03, decay: 0.2, sustain: 0.7, release: 0.3 },
        modulationEnvelope: { attack: 0.05, decay: 0.15, sustain: 0.6, release: 0.3 },
        volume: -10,
      },
    });
  } else if (program >= 88 && program <= 95) {
    // Synth Pad
    synth = new Tone.PolySynth({
      maxPolyphony: 32,
      voice: Tone.AMSynth,
      options: {
        harmonicity: 2,
        envelope: { attack: 0.4, decay: 0.5, sustain: 0.8, release: 0.6 },
        modulationEnvelope: { attack: 0.6, decay: 0.4, sustain: 0.7, release: 0.5 },
        volume: -14,
      },
    });
  } else {
    // Default / Synth Lead / Other
    synth = new Tone.PolySynth({
      maxPolyphony: 32,
      voice: Tone.FMSynth,
      options: {
        harmonicity: 2,
        modulationIndex: 1.5,
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.3 },
        modulationEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.3 },
        volume: -8,
      },
    });
  }

  synth.connect(volume);
  return synth;
}

function scheduleMidi(): void {
  if (!currentMidi) return;
  transport.cancel();
  disposeTrackSynths();
  ensureConnected();

  const bpm = currentMidi.header.tempos[0]?.bpm ?? 120;
  transport.bpm.value = bpm;

  // Keep only non-drum, non-empty tracks; cap at MAX_TRACKS to avoid
  // overwhelming the Web Audio thread (which fails silently).
  const MAX_TRACKS = 5;
  const activeTracks = currentMidi.tracks
    .filter((t) => t.notes.length > 0 && t.channel !== 9)
    .sort((a, b) => b.notes.length - a.notes.length)
    .slice(0, MAX_TRACKS);

  // Reduce volume proportional to track count so summed output stays stable.
  const trackGainOffset = activeTracks.length > 1
    ? -10 * Math.log10(activeTracks.length)
    : 0;

  for (const track of activeTracks) {
    const program = track.instrument?.number ?? 0;
    const synth = createSynthForTrack(program);

    synth.volume.value += trackGainOffset;
    trackSynths.push(synth);

    for (const note of track.notes) {
      const duration = Math.max(0.01, note.duration);
      transport.schedule((t: number) => {
        synth.triggerAttackRelease(note.name, duration, t, note.velocity);
      }, note.time);
    }
  }
}

export function play(): void {
  if (!currentMidi) return;
  scheduleMidi();

  // Auto-stop when the MIDI reaches its end so isPlaying stays accurate.
  const duration = currentMidi.duration;
  transport.schedule(() => { stop(); }, duration + 0.5);

  transport.start(undefined, 0);
  isPlaying = true;
}

export function stop(): void {
  transport.stop();
  transport.cancel();
  disposeTrackSynths();
  isPlaying = false;
}

export function getIsPlaying(): boolean {
  return isPlaying;
}

export function getDuration(): number {
  return currentMidi ? currentMidi.duration : 0;
}

export function getCurrentMidi(): Midi | null {
  return currentMidi;
}
