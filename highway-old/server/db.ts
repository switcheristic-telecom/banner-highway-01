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

  db.run(`CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    waypoints TEXT NOT NULL,
    is_cyclic INTEGER DEFAULT 0,
    width_factor REAL DEFAULT 1.0,
    segments_factor REAL DEFAULT 1.0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS banner_assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
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

  migrateBannersTable(db);
  migrateBranchesTable(db);

  _db = db;
  return db;
}

/**
 * Migrate branches table from old Bezier `nodes` column to `waypoints` + `is_cyclic`.
 */
function migrateBranchesTable(db: Database) {
  const tableInfo = db.query("PRAGMA table_info(branches)").all() as Array<{ name: string }>;

  const hasNodes = tableInfo.some(c => c.name === 'nodes');
  const hasWaypoints = tableInfo.some(c => c.name === 'waypoints');

  if (!hasNodes) return; // Already migrated or fresh table

  if (hasWaypoints) return; // Both exist somehow - skip

  // Old schema has `nodes` (Bezier PathNode JSON). Convert to `waypoints` (RoadWaypoint JSON).
  const oldBranches = db.query('SELECT * FROM branches').all() as Array<{
    id: string; nodes: string; width_factor: number; segments_factor: number;
  }>;

  db.run(`CREATE TABLE branches_new (
    id TEXT PRIMARY KEY,
    waypoints TEXT NOT NULL,
    is_cyclic INTEGER DEFAULT 0,
    width_factor REAL DEFAULT 1.0,
    segments_factor REAL DEFAULT 1.0
  )`);

  const insert = db.prepare(
    'INSERT INTO branches_new (id, waypoints, is_cyclic, width_factor, segments_factor) VALUES (?, ?, ?, ?, ?)'
  );

  for (const branch of oldBranches) {
    let waypointsJson: string;
    try {
      const nodes = JSON.parse(branch.nodes);
      if (Array.isArray(nodes) && nodes.length > 0 && nodes[0].position) {
        // Old Bezier format: extract x, z from position
        const waypoints = nodes.map((n: { position: { x: number; z: number } }) => ({
          x: n.position.x,
          z: n.position.z,
        }));
        waypointsJson = JSON.stringify(waypoints);
      } else if (Array.isArray(nodes) && nodes.length > 0 && 'x' in nodes[0]) {
        // Already in waypoint format
        waypointsJson = branch.nodes;
      } else {
        waypointsJson = '[]';
      }
    } catch {
      waypointsJson = '[]';
    }

    insert.run(branch.id, waypointsJson, 0, branch.width_factor, branch.segments_factor);
  }

  db.run('DROP TABLE branches');
  db.run('ALTER TABLE branches_new RENAME TO branches');

  console.log(`Migrated ${oldBranches.length} branches from Bezier nodes to waypoints`);
}

function migrateBannersTable(db: Database) {
  const tableInfo = db.query("PRAGMA table_info(banners)").all() as Array<{ name: string }>;

  if (tableInfo.length === 0) {
    db.run(`CREATE TABLE banners (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL,
      t REAL NOT NULL,
      angle REAL DEFAULT 0,
      asset_id TEXT,
      distance_factor REAL,
      size_factor REAL,
      elevation_factor REAL,
      emissive_factor REAL,
      mirror INTEGER DEFAULT 0,
      FOREIGN KEY (branch_id) REFERENCES branches(id),
      FOREIGN KEY (asset_id) REFERENCES banner_assets(id) ON DELETE SET NULL
    )`);
    return;
  }

  const hasSide = tableInfo.some(c => c.name === 'side');
  const hasImageFile = tableInfo.some(c => c.name === 'image_file');
  const hasMirror = tableInfo.some(c => c.name === 'mirror');

  if (hasImageFile) {
    // Migration from very old schema (image_file/video_file columns) -> new schema
    const oldBanners = db.query('SELECT * FROM banners').all() as Array<{
      id: string; branch_id: string; t: number; side: string; angle: number;
      distance_factor: number | null; size_factor: number | null;
      elevation_factor: number | null; emissive_factor: number | null;
      image_file: string; video_file: string | null;
    }>;

    const imageFiles = new Set(oldBanners.map(b => b.image_file).filter(Boolean));

    const insertAsset = db.prepare(
      'INSERT OR IGNORE INTO banner_assets (id, name, file_path) VALUES (?, ?, ?)'
    );
    const assetIdMap = new Map<string, string>();

    for (const filePath of imageFiles) {
      const assetId = `asset_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const name = filePath.split('/').pop() ?? filePath;
      insertAsset.run(assetId, name, filePath);
      assetIdMap.set(filePath, assetId);
    }

    db.run(`CREATE TABLE banners_new (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL,
      t REAL NOT NULL,
      angle REAL DEFAULT 0,
      asset_id TEXT,
      distance_factor REAL,
      size_factor REAL,
      elevation_factor REAL,
      emissive_factor REAL,
      mirror INTEGER DEFAULT 0,
      FOREIGN KEY (branch_id) REFERENCES branches(id),
      FOREIGN KEY (asset_id) REFERENCES banner_assets(id) ON DELETE SET NULL
    )`);

    const insertNew = db.prepare(
      `INSERT INTO banners_new (id, branch_id, t, angle, asset_id,
       distance_factor, size_factor, elevation_factor, emissive_factor, mirror)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const b of oldBanners) {
      const isRight = b.side === 'r';
      const newAngle = isRight ? -(b.angle || 0) : (b.angle || 0);
      const oldDf = b.distance_factor;
      const newDf = isRight ? (oldDf ?? 1) : -(oldDf ?? 1);
      insertNew.run(
        b.id, b.branch_id, b.t, newAngle,
        assetIdMap.get(b.image_file) ?? null,
        newDf, b.size_factor, b.elevation_factor, b.emissive_factor,
        isRight ? 1 : 0
      );
    }

    db.run('DROP TABLE banners');
    db.run('ALTER TABLE banners_new RENAME TO banners');
    console.log(`Migrated ${oldBanners.length} banners from image_file schema, created ${imageFiles.size} assets`);
    return;
  }

  if (hasSide && !hasMirror) {
    // Migration from side-based schema -> signed distance + mirror
    const oldBanners = db.query('SELECT * FROM banners').all() as Array<{
      id: string; branch_id: string; t: number; side: string; angle: number;
      asset_id: string | null;
      distance_factor: number | null; size_factor: number | null;
      elevation_factor: number | null; emissive_factor: number | null;
    }>;

    db.run(`CREATE TABLE banners_new (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL,
      t REAL NOT NULL,
      angle REAL DEFAULT 0,
      asset_id TEXT,
      distance_factor REAL,
      size_factor REAL,
      elevation_factor REAL,
      emissive_factor REAL,
      mirror INTEGER DEFAULT 0,
      FOREIGN KEY (branch_id) REFERENCES branches(id),
      FOREIGN KEY (asset_id) REFERENCES banner_assets(id) ON DELETE SET NULL
    )`);

    const insertNew = db.prepare(
      `INSERT INTO banners_new (id, branch_id, t, angle, asset_id,
       distance_factor, size_factor, elevation_factor, emissive_factor, mirror)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const b of oldBanners) {
      const isRight = b.side === 'r';
      const newAngle = isRight ? -(b.angle || 0) : (b.angle || 0);
      const oldDf = b.distance_factor;
      const newDf = isRight ? (oldDf ?? 1) : -(oldDf ?? 1);
      insertNew.run(
        b.id, b.branch_id, b.t, newAngle, b.asset_id,
        newDf, b.size_factor, b.elevation_factor, b.emissive_factor,
        isRight ? 1 : 0
      );
    }

    db.run('DROP TABLE banners');
    db.run('ALTER TABLE banners_new RENAME TO banners');
    console.log(`Migrated ${oldBanners.length} banners from side-based to signed distance + mirror`);
    return;
  }
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
