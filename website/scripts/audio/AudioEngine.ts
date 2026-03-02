import * as Tone from 'tone';

// --- Synth ---
const synth = new Tone.PolySynth({
  maxPolyphony: 32,
  voice: Tone.Synth,
  options: {
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.5 },
    volume: -6,
  },
}).toDestination();

// --- Effects chain: Chorus → FeedbackDelay → Reverb → EQ3 → Limiter → Destination ---
const chorus = new Tone.Chorus({ frequency: 4, delayTime: 2.5, depth: 0.5, wet: 0 }).start();
const feedbackDelay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.4, wet: 0 });
const reverb = new Tone.Reverb({ decay: 2, preDelay: 0.01, wet: 0.35 });
const eq3 = new Tone.EQ3({ low: 0, mid: 0, high: 0 });
const limiter = new Tone.Limiter(-1);

synth.disconnect();
synth.connect(chorus);
chorus.connect(feedbackDelay);
feedbackDelay.connect(reverb);
reverb.connect(eq3);
eq3.connect(limiter);
limiter.toDestination();

export const reverbReady: Promise<void> = reverb.generate().then(() => {});

// --- Synth controls ---
export function getSynthVolume(): number { return synth.volume.value; }
export function setSynthVolume(v: number): void { synth.volume.value = v; }
export function getSynthAttack(): number { return synth.get().envelope.attack as number; }
export function setSynthAttack(v: number): void { synth.set({ envelope: { attack: v } }); }
export function getSynthDecay(): number { return synth.get().envelope.decay as number; }
export function setSynthDecay(v: number): void { synth.set({ envelope: { decay: v } }); }
export function getSynthSustain(): number { return synth.get().envelope.sustain as number; }
export function setSynthSustain(v: number): void { synth.set({ envelope: { sustain: v } }); }
export function getSynthRelease(): number { return synth.get().envelope.release as number; }
export function setSynthRelease(v: number): void { synth.set({ envelope: { release: v } }); }

// --- Chorus ---
export function getChorusWet(): number { return chorus.wet.value; }
export function setChorusWet(v: number): void { chorus.wet.value = v; }
export function getChorusFrequency(): number { return Number(chorus.frequency.value); }
export function setChorusFrequency(v: number): void { chorus.frequency.value = v; }
export function getChorusDepth(): number { return chorus.depth; }
export function setChorusDepth(v: number): void { chorus.depth = v; }
export function getChorusSpread(): number { return chorus.spread; }
export function setChorusSpread(v: number): void { chorus.spread = v; }

// --- FeedbackDelay ---
export function getDelayWet(): number { return feedbackDelay.wet.value; }
export function setDelayWet(v: number): void { feedbackDelay.wet.value = v; }
export function getDelayTime(): number { return Number(feedbackDelay.delayTime.value); }
export function setDelayTime(v: number): void { feedbackDelay.delayTime.value = v; }
export function getDelayFeedback(): number { return feedbackDelay.feedback.value; }
export function setDelayFeedback(v: number): void { feedbackDelay.feedback.value = v; }

// --- Reverb ---
export function getReverbWet(): number { return reverb.wet.value; }
export function setReverbWet(v: number): void { reverb.wet.value = v; }
export function getReverbDecay(): number { return Number(reverb.decay); }
export function setReverbDecay(v: number): void { reverb.decay = v; }

// --- EQ3 ---
export function getEQLow(): number { return eq3.low.value; }
export function setEQLow(v: number): void { eq3.low.value = v; }
export function getEQMid(): number { return eq3.mid.value; }
export function setEQMid(v: number): void { eq3.mid.value = v; }
export function getEQHigh(): number { return eq3.high.value; }
export function setEQHigh(v: number): void { eq3.high.value = v; }

export function getSynth(): Tone.PolySynth<Tone.Synth> { return synth; }
export function getEffectsInput(): Tone.ToneAudioNode { return chorus; }
export function getTransport(): ReturnType<typeof Tone.getTransport> { return Tone.getTransport(); }
export function getBpm(): number { return Tone.getTransport().bpm.value; }
export function setBpm(v: number): void { Tone.getTransport().bpm.value = v; }

export async function ensureAudioStarted(): Promise<void> {
  if (Tone.getContext().state !== 'running') {
    await Tone.start();
  }
}

export function applySettings(s: {
  synthVolume: number; synthAttack: number; synthDecay: number;
  synthSustain: number; synthRelease: number;
  reverbWet: number; reverbDecay: number;
  delayWet: number; delayTime: number; delayFeedback: number;
  chorusWet: number; chorusFrequency: number; chorusDepth: number; chorusSpread: number;
  eqLow: number; eqMid: number; eqHigh: number;
}): void {
  setSynthVolume(s.synthVolume);
  setSynthAttack(s.synthAttack);
  setSynthDecay(s.synthDecay);
  setSynthSustain(s.synthSustain);
  setSynthRelease(s.synthRelease);
  setReverbWet(s.reverbWet);
  setReverbDecay(s.reverbDecay);
  setDelayWet(s.delayWet);
  setDelayTime(s.delayTime);
  setDelayFeedback(s.delayFeedback);
  setChorusWet(s.chorusWet);
  setChorusFrequency(s.chorusFrequency);
  setChorusDepth(s.chorusDepth);
  setChorusSpread(s.chorusSpread);
  setEQLow(s.eqLow);
  setEQMid(s.eqMid);
  setEQHigh(s.eqHigh);
}
