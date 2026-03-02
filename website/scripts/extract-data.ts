/**
 * Build-time script: reads SQLite database and writes a single data.json to generated/.
 * Run with: bun scripts/extract-data.ts
 */
import { Database } from 'bun:sqlite';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const DB_PATH = join(import.meta.dir, '..', 'data', 'highway.sqlite');
const GENERATED_DIR = join(import.meta.dir, '..', 'generated');

mkdirSync(GENERATED_DIR, { recursive: true });

const db = new Database(DB_PATH, { readonly: true });

const roads = db.query('SELECT * FROM roads').all() as Array<{
  id: string;
  waypoints: string;
  is_cyclic: number;
  width: number;
  segment_count: number;
}>;

const junctions = db.query('SELECT * FROM road_junctions').all() as Array<{
  id: number;
  from_road: string;
  from_t: number;
  to_road: string;
  to_t: number;
}>;

const banners = db.query('SELECT * FROM banners ORDER BY t').all() as Array<{
  id: string;
  road_id: string;
  t: number;
  angle: number;
  asset_id: string | null;
  distance: number;
  size: number;
  elevation: number;
  emissive_intensity: number;
  caption: string | null;
  url: string | null;
}>;

const assets = db.query('SELECT * FROM banner_assets').all() as Array<{
  id: string;
  name: string;
  file_path: string;
  width: number | null;
  height: number | null;
  caption: string | null;
}>;

const parts = db.query('SELECT * FROM highway_parts ORDER BY road_id, start_t').all() as Array<{
  id: string;
  road_id: string;
  start_t: number;
  sky_effect: number;
}>;

const songs = db.query('SELECT * FROM midi_songs').all() as Array<{
  id: string;
  name: string;
  file_path: string;
  source_url: string;
  language: string;
}>;

const partSongs = db.query('SELECT * FROM part_songs').all() as Array<{
  part_id: string;
  song_id: string;
}>;

let audioSettingsRow: any = null;
try {
  audioSettingsRow = db.query('SELECT * FROM audio_settings WHERE id = 1').get() as any;
} catch { /* table may not exist in older DBs */ }

const data = {
  roadNetwork: {
    roads: roads.map((r) => ({
      id: r.id,
      waypoints: JSON.parse(r.waypoints),
      isCyclic: !!r.is_cyclic,
      width: r.width,
      segmentCount: r.segment_count,
    })),
    junctions: junctions.map((j) => ({
      fromRoad: j.from_road,
      fromT: j.from_t,
      toRoad: j.to_road,
      toT: j.to_t,
    })),
  },
  banners: banners.map((b) => ({
    id: b.id,
    roadId: b.road_id,
    t: b.t,
    angle: b.angle,
    assetId: b.asset_id,
    distance: b.distance,
    size: b.size,
    elevation: b.elevation,
    emissiveIntensity: b.emissive_intensity,
    caption: b.caption ?? '',
    url: b.url ?? '',
  })),
  assets: assets.map((a) => ({
    id: a.id,
    name: a.name,
    filePath: a.file_path,
    width: a.width,
    height: a.height,
    caption: a.caption,
  })),
  parts: parts.map((p) => ({
    id: p.id,
    roadId: p.road_id,
    startT: p.start_t,
    skyEffect: p.sky_effect ?? 0,
  })),
  songs: songs.map((s) => ({
    id: s.id,
    name: s.name,
    filePath: s.file_path,
    sourceUrl: s.source_url,
    language: s.language,
  })),
  partSongs: partSongs.map((ps) => ({
    partId: ps.part_id,
    songId: ps.song_id,
  })),
  audioSettings: audioSettingsRow ? {
    synthVolume: audioSettingsRow.synth_volume,
    synthAttack: audioSettingsRow.synth_attack,
    synthDecay: audioSettingsRow.synth_decay,
    synthSustain: audioSettingsRow.synth_sustain,
    synthRelease: audioSettingsRow.synth_release,
    reverbWet: audioSettingsRow.reverb_wet,
    reverbDecay: audioSettingsRow.reverb_decay,
    delayWet: audioSettingsRow.delay_wet,
    delayTime: audioSettingsRow.delay_time,
    delayFeedback: audioSettingsRow.delay_feedback,
    chorusWet: audioSettingsRow.chorus_wet,
    chorusFrequency: audioSettingsRow.chorus_frequency,
    chorusDepth: audioSettingsRow.chorus_depth,
    chorusSpread: audioSettingsRow.chorus_spread,
    eqLow: audioSettingsRow.eq_low,
    eqMid: audioSettingsRow.eq_mid,
    eqHigh: audioSettingsRow.eq_high,
  } : null,
};

writeFileSync(
  join(GENERATED_DIR, 'data.json'),
  JSON.stringify(data, null, 2),
);

console.log('Data extracted successfully!');
console.log(`  ${roads.length} roads`);
console.log(`  ${banners.length} banners`);
console.log(`  ${assets.length} assets`);
console.log(`  ${junctions.length} junctions`);
console.log(`  ${parts.length} highway parts`);
console.log(`  ${songs.length} MIDI songs`);
console.log(`  Output: ${GENERATED_DIR}/data.json`);

db.close();
