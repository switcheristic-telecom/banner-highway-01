import * as Audio from './AudioEngine';

let panelEl: HTMLElement | null = null;

interface SliderDef {
  label: string;
  min: number;
  max: number;
  step: number;
  get: () => number;
  set: (v: number) => void;
}

const SECTIONS: { title: string; sliders: SliderDef[] }[] = [
  {
    title: 'Synth',
    sliders: [
      { label: 'Volume (dB)', min: -40, max: 0, step: 1, get: Audio.getSynthVolume, set: Audio.setSynthVolume },
      { label: 'Attack', min: 0.001, max: 2, step: 0.01, get: Audio.getSynthAttack, set: Audio.setSynthAttack },
      { label: 'Decay', min: 0, max: 2, step: 0.01, get: Audio.getSynthDecay, set: Audio.setSynthDecay },
      { label: 'Sustain', min: 0, max: 1, step: 0.01, get: Audio.getSynthSustain, set: Audio.setSynthSustain },
      { label: 'Release', min: 0.01, max: 4, step: 0.01, get: Audio.getSynthRelease, set: Audio.setSynthRelease },
    ],
  },
  {
    title: 'Reverb',
    sliders: [
      { label: 'Wet', min: 0, max: 1, step: 0.01, get: Audio.getReverbWet, set: Audio.setReverbWet },
      { label: 'Decay (s)', min: 0.1, max: 10, step: 0.1, get: Audio.getReverbDecay, set: Audio.setReverbDecay },
    ],
  },
  {
    title: 'Delay',
    sliders: [
      { label: 'Wet', min: 0, max: 1, step: 0.01, get: Audio.getDelayWet, set: Audio.setDelayWet },
      { label: 'Time (s)', min: 0.01, max: 2, step: 0.01, get: Audio.getDelayTime, set: Audio.setDelayTime },
      { label: 'Feedback', min: 0, max: 0.99, step: 0.01, get: Audio.getDelayFeedback, set: Audio.setDelayFeedback },
    ],
  },
  {
    title: 'Chorus',
    sliders: [
      { label: 'Wet', min: 0, max: 1, step: 0.01, get: Audio.getChorusWet, set: Audio.setChorusWet },
      { label: 'Freq (Hz)', min: 0.1, max: 20, step: 0.1, get: Audio.getChorusFrequency, set: Audio.setChorusFrequency },
      { label: 'Depth', min: 0, max: 1, step: 0.01, get: Audio.getChorusDepth, set: Audio.setChorusDepth },
      { label: 'Spread (°)', min: 0, max: 180, step: 1, get: Audio.getChorusSpread, set: Audio.setChorusSpread },
    ],
  },
  {
    title: 'EQ',
    sliders: [
      { label: 'Low (dB)', min: -12, max: 12, step: 0.5, get: Audio.getEQLow, set: Audio.setEQLow },
      { label: 'Mid (dB)', min: -12, max: 12, step: 0.5, get: Audio.getEQMid, set: Audio.setEQMid },
      { label: 'High (dB)', min: -12, max: 12, step: 0.5, get: Audio.getEQHigh, set: Audio.setEQHigh },
    ],
  },
];

export function createMusicPanel(): HTMLElement {
  panelEl = document.getElementById('music-panel');
  if (!panelEl) return document.createElement('div');

  let html = '';
  for (const section of SECTIONS) {
    html += `<div class="mp-section">`;
    html += `<div class="mp-section-title">${section.title}</div>`;
    for (const slider of section.sliders) {
      const id = `mp-${section.title}-${slider.label}`.replace(/[\s()°/]/g, '-');
      html += `
        <div class="mp-row">
          <label class="mp-label">${slider.label}</label>
          <input type="range" class="mp-slider" id="${id}"
            min="${slider.min}" max="${slider.max}" step="${slider.step}"
            value="${slider.get()}" />
          <span class="mp-value" id="${id}-val">${slider.get().toFixed(2)}</span>
        </div>`;
    }
    html += `</div>`;
  }
  panelEl.innerHTML = html;

  // Wire up events
  for (const section of SECTIONS) {
    for (const slider of section.sliders) {
      const id = `mp-${section.title}-${slider.label}`.replace(/[\s()°/]/g, '-');
      const input = document.getElementById(id) as HTMLInputElement;
      const valSpan = document.getElementById(`${id}-val`)!;
      if (!input) continue;
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        slider.set(v);
        valSpan.textContent = v.toFixed(2);
      });
    }
  }

  return panelEl;
}

export function togglePanel(): void {
  if (!panelEl) return;
  panelEl.classList.toggle('hidden');
}
