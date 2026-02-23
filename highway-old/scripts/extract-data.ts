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

const branches = db.query('SELECT * FROM branches').all() as Array<{
  id: string;
  waypoints: string;
  is_cyclic: number;
  width_factor: number;
  segments_factor: number;
}>;

const exits = db.query('SELECT * FROM exits').all() as Array<{
  id: number;
  from_branch: string;
  from_t: number;
  to_branch: string;
  to_t: number;
}>;

const banners = db.query('SELECT * FROM banners ORDER BY t').all() as Array<{
  id: string;
  branch_id: string;
  t: number;
  angle: number;
  asset_id: string | null;
  distance_factor: number | null;
  size_factor: number | null;
  elevation_factor: number | null;
  emissive_factor: number | null;
  mirror: number;
}>;

const assets = db.query('SELECT * FROM banner_assets').all() as Array<{
  id: string;
  name: string;
  file_path: string;
  width: number | null;
  height: number | null;
}>;

const data = {
  highway: {
    branches: branches.map((b) => ({
      id: b.id,
      waypoints: JSON.parse(b.waypoints),
      isCyclic: !!b.is_cyclic,
      widthFactor: b.width_factor,
      segmentsFactor: b.segments_factor,
    })),
    exits: exits.map((e) => ({
      fromBranch: e.from_branch,
      fromT: e.from_t,
      toBranch: e.to_branch,
      toT: e.to_t,
    })),
  },
  banners: banners.map((b) => {
    const def: Record<string, unknown> = {
      id: b.id,
      branch_id: b.branch_id,
      t: b.t,
      angle: b.angle,
      assetId: b.asset_id,
      mirror: !!b.mirror,
    };

    if (b.distance_factor != null) def.distanceFactor = b.distance_factor;
    if (b.size_factor != null) def.sizeFactor = b.size_factor;
    if (b.elevation_factor != null) def.elevationFactor = b.elevation_factor;
    if (b.emissive_factor != null) def.emissiveFactor = b.emissive_factor;

    return def;
  }),
  assets: assets.map((a) => ({
    id: a.id,
    name: a.name,
    filePath: a.file_path,
    width: a.width,
    height: a.height,
  })),
};

writeFileSync(
  join(GENERATED_DIR, 'data.json'),
  JSON.stringify(data, null, 2)
);

console.log('Data extracted successfully!');
console.log(`  ${branches.length} branches`);
console.log(`  ${banners.length} banners`);
console.log(`  ${assets.length} assets`);
console.log(`  ${exits.length} exits`);
console.log(`  Output: ${GENERATED_DIR}/data.json`);

db.close();
