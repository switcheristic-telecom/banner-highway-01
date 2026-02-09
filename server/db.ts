import { Database } from 'bun:sqlite';
import { mkdirSync } from 'fs';
import { join } from 'path';

const DB_DIR = join(import.meta.dir, '..', 'data');
const DB_PATH = join(DB_DIR, 'highway.sqlite');

let _db: Database | null = null;

export function getDb(): Database {
  if (_db) return _db;

  // Ensure data directory exists
  mkdirSync(DB_DIR, { recursive: true });

  const db = new Database(DB_PATH, { create: true });
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  // Create tables
  db.run(`CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    nodes TEXT NOT NULL,
    width_factor REAL DEFAULT 1.0,
    segments_factor REAL DEFAULT 1.0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS banners (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    t REAL NOT NULL,
    side TEXT NOT NULL CHECK(side IN ('l', 'r')),
    angle REAL DEFAULT 0,
    distance_factor REAL,
    size_factor REAL,
    elevation_factor REAL,
    emissive_factor REAL,
    pad_x REAL,
    pad_y REAL,
    aspect_ratio REAL,
    image_file TEXT NOT NULL,
    video_file TEXT,
    FOREIGN KEY (branch_id) REFERENCES branches(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS exits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_branch TEXT NOT NULL,
    from_t REAL NOT NULL,
    to_branch TEXT NOT NULL,
    to_t REAL NOT NULL,
    FOREIGN KEY (from_branch) REFERENCES branches(id),
    FOREIGN KEY (to_branch) REFERENCES branches(id)
  )`);

  _db = db;
  return db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
