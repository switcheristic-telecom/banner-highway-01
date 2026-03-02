/** Master volume (dB) for all MidiPlayer synths. */
export const MASTER_VOLUME_DB = 0;

/** Maximum simultaneous MIDI tracks to prevent Web Audio thread overload. */
export const MAX_TRACKS = 5;

/** MIDI channel reserved for drums (GM standard). */
export const DRUM_CHANNEL = 9;

/** Seconds of lead-in before the first note when skipping silence. */
export const SKIP_LEAD_IN = 0.05;

/** Volume fade speed in dB per second. */
export const FADE_SPEED = 30;

/** Target volume (dB) when fading out — effectively silent. */
export const FADE_OUT_TARGET = -60;

/** Threshold (dB) at which a fade-out is considered complete. */
export const FADE_OUT_THRESHOLD = -59;
