import { getDb, closeDb } from './db';

const db = getDb();

// Clear existing data
db.run('DELETE FROM banners');
db.run('DELETE FROM road_junctions');
db.run('DELETE FROM banner_assets');
db.run('DELETE FROM roads');

// Insert a default road with waypoints forming a gentle curve
const waypoints = [
  { x: 100, z: 400 },
  { x: 150, z: 450 },
  { x: 200, z: 500 },
  { x: 228, z: 530 },
  { x: 260, z: 570 },
  { x: 300, z: 620 },
  { x: 350, z: 660 },
  { x: 400, z: 680 },
  { x: 450, z: 670 },
  { x: 480, z: 640 },
  { x: 490, z: 600 },
  { x: 480, z: 560 },
  { x: 450, z: 530 },
  { x: 400, z: 510 },
  { x: 350, z: 500 },
  { x: 300, z: 480 },
  { x: 260, z: 450 },
  { x: 230, z: 420 },
  { x: 200, z: 390 },
  { x: 160, z: 370 },
];

db.run(
  'INSERT INTO roads (id, waypoints, is_cyclic, width, segment_count) VALUES (?, ?, ?, ?, ?)',
  ['main', JSON.stringify(waypoints), 1, 5.555, 100],
);

// Insert some sample banners with direct world-space values
const banners = [
  { id: 'banner_1', roadId: 'main', t: 0.1, angle: 0, distance: 10, size: 1.7, elevation: 10, emissiveIntensity: 0.8 },
  { id: 'banner_2', roadId: 'main', t: 0.25, angle: 0, distance: -10, size: 1.7, elevation: 10, emissiveIntensity: 0.8 },
  { id: 'banner_3', roadId: 'main', t: 0.4, angle: 5, distance: 12, size: 2.0, elevation: 12, emissiveIntensity: 0.9 },
  { id: 'banner_4', roadId: 'main', t: 0.6, angle: -3, distance: -8, size: 1.5, elevation: 8, emissiveIntensity: 0.7 },
  { id: 'banner_5', roadId: 'main', t: 0.8, angle: 0, distance: 10, size: 1.7, elevation: 10, emissiveIntensity: 0.8 },
];

const insertBanner = db.prepare(
  `INSERT INTO banners (id, road_id, t, angle, distance, size, elevation, emissive_intensity, mirror)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

for (const b of banners) {
  insertBanner.run(b.id, b.roadId, b.t, b.angle, b.distance, b.size, b.elevation, b.emissiveIntensity, 0);
}

console.log(`Seeded: 1 road with ${waypoints.length} waypoints, ${banners.length} banners`);

closeDb();
