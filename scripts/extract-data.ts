/**
 * Build-time script: reads SQLite database and writes JSON files to generated/.
 * Run with: bun scripts/extract-data.ts
 */
import { Database } from 'bun:sqlite';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const DB_PATH = join(import.meta.dir, '..', 'data', 'highway.sqlite');
const GENERATED_DIR = join(import.meta.dir, '..', 'generated');

// Ensure generated directory exists
mkdirSync(GENERATED_DIR, { recursive: true });

const db = new Database(DB_PATH, { readonly: true });

// Extract branches
const branches = db.query('SELECT * FROM branches').all() as Array<{
  id: string;
  nodes: string;
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

const highwayData = {
  branches: branches.map((b) => ({
    id: b.id,
    nodes: JSON.parse(b.nodes),
    widthFactor: b.width_factor,
    segmentsFactor: b.segments_factor,
  })),
  exits: exits.map((e) => ({
    fromBranch: e.from_branch,
    fromT: e.from_t,
    toBranch: e.to_branch,
    toT: e.to_t,
  })),
};

writeFileSync(
  join(GENERATED_DIR, 'highway-data.json'),
  JSON.stringify(highwayData, null, 2)
);

// Extract banners
const banners = db.query('SELECT * FROM banners ORDER BY t').all() as Array<{
  id: string;
  branch_id: string;
  t: number;
  side: string;
  angle: number;
  distance_factor: number | null;
  size_factor: number | null;
  elevation_factor: number | null;
  emissive_factor: number | null;
  pad_x: number | null;
  pad_y: number | null;
  aspect_ratio: number | null;
  image_file: string;
  video_file: string | null;
}>;

const bannerData = banners.map((b) => {
  const def: Record<string, unknown> = {
    id: b.id,
    branch_id: b.branch_id,
    t: b.t,
    side: b.side,
    angle: b.angle,
    bannerImageFile: b.image_file,
  };

  // Only include optional fields if they have values
  if (b.distance_factor != null) def.distanceFactor = b.distance_factor;
  if (b.size_factor != null) def.sizeFactor = b.size_factor;
  if (b.elevation_factor != null) def.elevationFactor = b.elevation_factor;
  if (b.emissive_factor != null) def.emmisiveFactor = b.emissive_factor;
  if (b.pad_x != null) def.padX = b.pad_x;
  if (b.pad_y != null) def.padY = b.pad_y;
  if (b.aspect_ratio != null) def.aspectRatio = b.aspect_ratio;
  if (b.video_file != null) def.animatedBannerVideo = b.video_file;

  return def;
});

writeFileSync(
  join(GENERATED_DIR, 'banner-data.json'),
  JSON.stringify(bannerData, null, 2)
);

console.log('Data extracted successfully!');
console.log(`  ${branches.length} branches`);
console.log(`  ${banners.length} banners`);
console.log(`  ${exits.length} exits`);
console.log(`  Output: ${GENERATED_DIR}/`);

db.close();
