import { Database } from 'bun:sqlite';
import { mkdirSync } from 'fs';
import { join } from 'path';

const DB_DIR = join(import.meta.dir, '..', 'data');
const DB_PATH = join(DB_DIR, 'highway.sqlite');

let _db: Database | null = null;

export function getDb(): Database {
  if (_db) return _db;

  mkdirSync(DB_DIR, { recursive: true });

  const db = new Database(DB_PATH, { create: true });
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  db.run(`CREATE TABLE IF NOT EXISTS roads (
    id TEXT PRIMARY KEY,
    waypoints TEXT NOT NULL,
    is_cyclic INTEGER DEFAULT 0,
    width REAL DEFAULT 5.555,
    segment_count INTEGER DEFAULT 2000
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS banner_assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS road_junctions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_road TEXT NOT NULL,
    from_t REAL NOT NULL,
    to_road TEXT NOT NULL,
    to_t REAL NOT NULL,
    FOREIGN KEY (from_road) REFERENCES roads(id),
    FOREIGN KEY (to_road) REFERENCES roads(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS banners (
    id TEXT PRIMARY KEY,
    road_id TEXT NOT NULL,
    t REAL NOT NULL,
    angle REAL DEFAULT 0,
    asset_id TEXT,
    distance REAL DEFAULT 10,
    size REAL DEFAULT 1.7,
    elevation REAL DEFAULT 10,
    emissive_intensity REAL DEFAULT 0.8,
    FOREIGN KEY (road_id) REFERENCES roads(id),
    FOREIGN KEY (asset_id) REFERENCES banner_assets(id) ON DELETE SET NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS highway_parts (
    id TEXT PRIMARY KEY,
    road_id TEXT NOT NULL,
    start_t REAL NOT NULL,
    FOREIGN KEY (road_id) REFERENCES roads(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS midi_songs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    source_url TEXT DEFAULT '',
    language TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS part_songs (
    part_id TEXT NOT NULL,
    song_id TEXT NOT NULL,
    PRIMARY KEY (part_id, song_id),
    FOREIGN KEY (part_id) REFERENCES highway_parts(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES midi_songs(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audio_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    synth_volume REAL DEFAULT -6,
    synth_attack REAL DEFAULT 0.01,
    synth_decay REAL DEFAULT 0.2,
    synth_sustain REAL DEFAULT 0.5,
    synth_release REAL DEFAULT 0.5,
    reverb_wet REAL DEFAULT 0.35,
    reverb_decay REAL DEFAULT 2,
    delay_wet REAL DEFAULT 0.5,
    delay_time REAL DEFAULT 0.25,
    delay_feedback REAL DEFAULT 0.4,
    chorus_wet REAL DEFAULT 0.5,
    chorus_frequency REAL DEFAULT 4,
    chorus_depth REAL DEFAULT 0.5,
    chorus_spread REAL DEFAULT 180,
    eq_low REAL DEFAULT 0,
    eq_mid REAL DEFAULT 0,
    eq_high REAL DEFAULT 0
  )`);
  db.run('INSERT OR IGNORE INTO audio_settings (id) VALUES (1)');

  // Migrations: add columns to existing tables
  try { db.run('ALTER TABLE banner_assets ADD COLUMN caption TEXT'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE banners ADD COLUMN caption TEXT'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE highway_parts ADD COLUMN sky_effect INTEGER DEFAULT 0'); } catch { /* already exists */ }
  db.run('UPDATE roads SET segment_count = 2000 WHERE segment_count <= 100');

  // Ensure asset directories exist
  mkdirSync(join(import.meta.dir, '..', 'assets', 'midi'), { recursive: true });

  _db = db;
  return db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
