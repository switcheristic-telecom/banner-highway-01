import { getDb, closeDb } from './db';
import type { RoadWaypoint } from '../constants/types';

const db = getDb();

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

// Waypoints forming a closed loop.
// The solver will compute smooth headings automatically.
const SEED_WAYPOINTS: RoadWaypoint[] = [
  { x: 49, z: 504 },
  { x: 92, z: 504 },
  { x: 114, z: 522 },
  { x: 152, z: 509 },
  { x: 173, z: 554 },
  { x: 215, z: 578 },
  { x: 223, z: 541 },
  { x: 185, z: 517 },
  { x: 223, z: 483 },
  { x: 246, z: 518 },
  { x: 268, z: 536 },
  { x: 276, z: 572 },
  { x: 327, z: 568 },
  { x: 344, z: 536 },
  { x: 408, z: 531 },
  { x: 377, z: 497 },
  // Closing arc: curve back toward the start
  { x: 340, z: 470 },
  { x: 280, z: 455 },
  { x: 200, z: 460 },
  { x: 120, z: 470 },
  { x: 60, z: 485 },
];

const SEED_BRANCHES = [
  {
    id: 'main',
    waypoints: SEED_WAYPOINTS,
    isCyclic: true,
    widthFactor: 1.2,
    segmentsFactor: 10,
  },
];

const SEED_ASSETS = [
  { id: 'poem1_1', name: '1.jpg', filePath: 'poem-1/1.jpg' },
  { id: 'poem1_2', name: '2.jpg', filePath: 'poem-1/2.jpg' },
  { id: 'poem1_3', name: '3.jpg', filePath: 'poem-1/3.jpg' },
  { id: 'poem1_4', name: '4.jpg', filePath: 'poem-1/4.jpg' },
  { id: 'poem1_5', name: '5.jpg', filePath: 'poem-1/5.jpg' },
  { id: 'poem1_6', name: '6.jpg', filePath: 'poem-1/6.jpg' },
  { id: 'poem1_7', name: '7.jpg', filePath: 'poem-1/7.jpg' },
  { id: 'poem1_8', name: '8.jpg', filePath: 'poem-1/8.jpg' },
  { id: 'poem1_9', name: '9.jpg', filePath: 'poem-1/9.jpg' },
  { id: 'poem1_10', name: '10.jpg', filePath: 'poem-1/10.jpg' },
  { id: 'poem2_1', name: '1.jpg', filePath: 'poem-2/1.jpg' },
  { id: 'poem2_2', name: '2.jpg', filePath: 'poem-2/2.jpg' },
  { id: 'poem2_3', name: '3.jpg', filePath: 'poem-2/3.jpg' },
  { id: 'poem2_4', name: '4.jpg', filePath: 'poem-2/4.jpg' },
  { id: 'poem2_5', name: '5.jpg', filePath: 'poem-2/5.jpg' },
  { id: 'poem2_6', name: '6.jpg', filePath: 'poem-2/6.jpg' },
  { id: 'poem2_7', name: '7.jpg', filePath: 'poem-2/7.jpg' },
  { id: 'poem2_8', name: '8.jpg', filePath: 'poem-2/8.jpg' },
  { id: 'poem2_9', name: '9.jpg', filePath: 'poem-2/9.jpg' },
  { id: 'poem2_10', name: '10.jpg', filePath: 'poem-2/10.jpg' },
];

const SEED_BANNERS = [
  { id: 'banner_main_1', branch_id: 'main', t: 0.1 / 2, side: 'r', angle: 0, sizeFactor: 1.2, distanceFactor: 0.1, assetId: 'poem1_1' },
  { id: 'banner_main_2', branch_id: 'main', t: 0.21 / 2, side: 'r', angle: 0, sizeFactor: 1.0, distanceFactor: 0.1, assetId: 'poem1_2' },
  { id: 'banner_main_3', branch_id: 'main', t: 0.32 / 2, side: 'r', angle: 0, sizeFactor: 1.5, distanceFactor: 0.9, assetId: 'poem1_3' },
  { id: 'banner_main_4', branch_id: 'main', t: 0.4 / 2, side: 'r', angle: -15, sizeFactor: 1, distanceFactor: 0.1, assetId: 'poem1_4' },
  { id: 'banner_main_5', branch_id: 'main', t: 0.48 / 2, side: 'r', angle: 10, sizeFactor: 1.3, distanceFactor: 0.5, assetId: 'poem1_5' },
  { id: 'banner_main_6', branch_id: 'main', t: 0.55 / 2, side: 'r', angle: 0, sizeFactor: 1, distanceFactor: 0.1, assetId: 'poem1_6' },
  { id: 'banner_main_7', branch_id: 'main', t: 0.65 / 2, side: 'r', angle: 30, sizeFactor: 1, distanceFactor: 0.1, assetId: 'poem1_7' },
  { id: 'banner_main_8', branch_id: 'main', t: 0.75 / 2, side: 'r', angle: 8, sizeFactor: 1.4, distanceFactor: 0.15, assetId: 'poem1_8' },
  { id: 'banner_main_9', branch_id: 'main', t: 0.85 / 2, side: 'r', angle: 0, sizeFactor: 1.2, distanceFactor: 0.1, emissiveFactor: 0.4, assetId: 'poem1_9' },
  { id: 'banner_main_10', branch_id: 'main', t: 0.99 / 2, side: 'r', angle: 0, sizeFactor: 2.0, elevationFactor: 0.8, distanceFactor: 0.01, assetId: 'poem1_10' },
  { id: 'banner_main_11', branch_id: 'main', t: 0.12 / 2 + 0.5, side: 'l', angle: 30, sizeFactor: 1.2, elevationFactor: 0.9, distanceFactor: 0.01, assetId: 'poem2_1' },
  { id: 'banner_main_12', branch_id: 'main', t: 0.18 / 2 + 0.5, side: 'l', angle: 30, sizeFactor: 1.2, elevationFactor: 1.0, distanceFactor: 0.1, assetId: 'poem2_2' },
  { id: 'banner_main_13', branch_id: 'main', t: 0.28 / 2 + 0.5, side: 'l', angle: 0, sizeFactor: 1.2, elevationFactor: 1.1, distanceFactor: 0.1, assetId: 'poem2_3' },
  { id: 'banner_main_14', branch_id: 'main', t: 0.36 / 2 + 0.5, side: 'l', angle: 12, sizeFactor: 1, elevationFactor: 1, distanceFactor: 0.001, emissiveFactor: 0.8, assetId: 'poem2_4' },
  { id: 'banner_main_15', branch_id: 'main', t: 0.48 / 2 + 0.5, side: 'l', angle: 0, sizeFactor: 1.5, distanceFactor: 0.1, emissiveFactor: 2, assetId: 'poem2_5' },
  { id: 'banner_main_16', branch_id: 'main', t: 0.55 / 2 + 0.5, side: 'l', angle: 0, sizeFactor: 1.2, distanceFactor: 0.1, assetId: 'poem2_6' },
  { id: 'banner_main_17', branch_id: 'main', t: 0.65 / 2 + 0.5, side: 'l', angle: 0, sizeFactor: 1.2, distanceFactor: 0.1, assetId: 'poem2_7' },
  { id: 'banner_main_18', branch_id: 'main', t: 0.75 / 2 + 0.5, side: 'l', angle: 0, sizeFactor: 1.2, distanceFactor: 0.1, emissiveFactor: 0.6, assetId: 'poem2_8' },
  { id: 'banner_main_19', branch_id: 'main', t: 0.85 / 2 + 0.5, side: 'l', angle: 0, sizeFactor: 1.2, distanceFactor: 0.1, assetId: 'poem2_9' },
  { id: 'banner_main_20', branch_id: 'main', t: 0.99 / 2 + 0.5, side: 'l', angle: 0, sizeFactor: 1.2, distanceFactor: 0.1, assetId: 'poem2_10' },
] as Array<Record<string, unknown>>;

// ---------------------------------------------------------------------------
// Seed the database
// ---------------------------------------------------------------------------

db.run('DELETE FROM banners');
db.run('DELETE FROM banner_assets');
db.run('DELETE FROM exits');
db.run('DELETE FROM branches');

const insertBranch = db.prepare(
  'INSERT INTO branches (id, waypoints, is_cyclic, width_factor, segments_factor) VALUES (?, ?, ?, ?, ?)'
);

for (const branch of SEED_BRANCHES) {
  insertBranch.run(
    branch.id,
    JSON.stringify(branch.waypoints),
    branch.isCyclic ? 1 : 0,
    branch.widthFactor ?? 1.0,
    branch.segmentsFactor ?? 1.0
  );
}

const insertAsset = db.prepare(
  'INSERT INTO banner_assets (id, name, file_path) VALUES (?, ?, ?)'
);

for (const a of SEED_ASSETS) {
  insertAsset.run(a.id, a.name, a.filePath);
}

const insertBanner = db.prepare(
  `INSERT INTO banners (id, branch_id, t, side, angle, asset_id,
   distance_factor, size_factor, elevation_factor, emissive_factor)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

for (const b of SEED_BANNERS) {
  insertBanner.run(
    b.id as string,
    b.branch_id as string,
    b.t as number,
    b.side as string,
    (b.angle as number) ?? 0,
    (b.assetId as string) ?? null,
    (b.distanceFactor as number) ?? null,
    (b.sizeFactor as number) ?? null,
    (b.elevationFactor as number) ?? null,
    (b.emissiveFactor as number) ?? null,
  );
}

console.log('Database seeded successfully!');
console.log(`  ${SEED_BRANCHES.length} branches (cyclic: ${SEED_BRANCHES.filter(b => b.isCyclic).length})`);
console.log(`  ${SEED_ASSETS.length} assets`);
console.log(`  ${SEED_BANNERS.length} banners`);

closeDb();
