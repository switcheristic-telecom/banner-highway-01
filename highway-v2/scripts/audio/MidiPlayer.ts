import { Midi } from '@tonejs/midi';
import { getSynth, getTransport } from './AudioEngine';

let currentMidi: Midi | null = null;
let isPlaying = false;

const transport = getTransport();
const synth = getSynth();

export async function loadMidi(url: string): Promise<Midi> {
  const data = await (await fetch(url)).arrayBuffer();
  currentMidi = new Midi(data);
  return currentMidi;
}

function scheduleMidi(): void {
  if (!currentMidi) return;
  transport.cancel();

  const bpm = currentMidi.header.tempos[0]?.bpm ?? 120;
  transport.bpm.value = bpm;

  for (const track of currentMidi.tracks) {
    if (!track.notes.length) continue;
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
  transport.start(undefined, 0);
  isPlaying = true;
}

export function stop(): void {
  transport.stop();
  transport.cancel();
  synth.releaseAll();
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
