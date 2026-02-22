export type {
  Vec3,
  RoadWaypoint,
  PathNode,
  HighwayData,
  HighwayBranch,
  HighwayExit,
} from './types';

export {
  HIGHWAY_MESH_DEFAULT_OPTIONS,
  HIGHWAY_SYSTEM_DEFAULT_OPTIONS,
} from './defaults';

import type { Vec3, RoadWaypoint } from './types';

/**
 * Convert Vec3 control points to RoadWaypoints (just extract x, z).
 */
export function pointsToWaypoints(points: Vec3[]): RoadWaypoint[] {
  return points.map((p) => ({ x: p.x, z: p.z }));
}
