import { getDb, closeDb } from './db';
import { HIGHWAY_DATA } from '../constants/highway';
import { BANNER_DEFS } from '../constants/banner';

const db = getDb();

// Clear existing data (order matters for foreign keys)
db.run('DELETE FROM banners');
db.run('DELETE FROM exits');
db.run('DELETE FROM branches');

// Insert branches
const insertBranch = db.prepare(
  'INSERT INTO branches (id, nodes, width_factor, segments_factor) VALUES (?, ?, ?, ?)'
);

for (const branch of HIGHWAY_DATA.branches) {
  insertBranch.run(
    branch.id,
    JSON.stringify(branch.nodes),
    branch.widthFactor ?? 1.0,
    branch.segmentsFactor ?? 1.0
  );
}

// Insert banners
const insertBanner = db.prepare(
  `INSERT INTO banners (id, branch_id, t, side, angle, distance_factor, size_factor,
   elevation_factor, emissive_factor, pad_x, pad_y, aspect_ratio, image_file, video_file)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

for (const banner of BANNER_DEFS) {
  insertBanner.run(
    banner.id,
    banner.branch_id,
    banner.t,
    banner.side,
    banner.angle,
    banner.distanceFactor ?? null,
    banner.sizeFactor ?? null,
    banner.elevationFactor ?? null,
    banner.emmisiveFactor ?? null,
    banner.padX ?? null,
    banner.padY ?? null,
    banner.aspectRatio ?? null,
    banner.bannerImageFile,
    banner.animatedBannerVideo ?? null
  );
}

// Insert exits
const insertExit = db.prepare(
  'INSERT INTO exits (from_branch, from_t, to_branch, to_t) VALUES (?, ?, ?, ?)'
);

for (const exit of HIGHWAY_DATA.exits) {
  insertExit.run(exit.fromBranch, exit.fromT, exit.toBranch, exit.toT);
}

console.log('Database seeded successfully!');
console.log(`  ${HIGHWAY_DATA.branches.length} branches`);
console.log(`  ${BANNER_DEFS.length} banners`);
console.log(`  ${HIGHWAY_DATA.exits.length} exits`);

closeDb();
