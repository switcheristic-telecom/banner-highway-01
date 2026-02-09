import * as THREE from 'three';

// MARK: HIGHWAY OPTIONS

export const HIGHWAY_MESH_DEFAULT_OPTIONS = {
  width: 5.555,
  segments: 100,
  blockMaterial: new THREE.MeshStandardMaterial({
    color: 0x03a062,
    roughness: 0.8,
    metalness: 0.0,
    emissive: 0x03a062,
    emissiveIntensity: 0.3,
  }),
  edgeMaterial: new THREE.MeshStandardMaterial({
    color: 0x03a062,
    emissive: 0x03a062,
    emissiveIntensity: 0.5,
    side: THREE.DoubleSide,
  }),
};

export const HIGHWAY_SYSTEM_DEFAULT_OPTIONS = {
  showEdge: true,
  showBlock: false,
};

// MARK: TYPES

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PathNode {
  position: Vec3;
  handleIn: Vec3;
  handleOut: Vec3;
}

export interface HighwayData {
  branches: HighwayBranch[];
  exits: HighwayExit[];
}

export interface HighwayBranch {
  id: string;
  nodes: PathNode[];
  widthFactor?: number;
  segmentsFactor?: number;
}

export interface HighwayExit {
  fromBranch: string;
  fromT: number;
  toBranch: string;
  toT: number;
}

// MARK: CONVERSION UTILITY

/**
 * Convert legacy Catmull-Rom control points to Bezier PathNodes.
 * Generates smooth handles by deriving tangent direction from neighboring points.
 * Formula: handleOut = position + tangent/6, handleIn = position - tangent/6
 * where tangent is approximated from the two neighboring points.
 */
export function pointsToBezierNodes(points: Vec3[]): PathNode[] {
  if (points.length < 2) {
    return points.map((pos) => ({
      position: { ...pos },
      handleIn: { ...pos },
      handleOut: { ...pos },
    }));
  }

  return points.map((pos, i, arr) => {
    let tx: number, ty: number, tz: number;

    if (i === 0) {
      // First point: tangent from current to next
      tx = arr[1].x - pos.x;
      ty = arr[1].y - pos.y;
      tz = arr[1].z - pos.z;
    } else if (i === arr.length - 1) {
      // Last point: tangent from previous to current
      tx = pos.x - arr[i - 1].x;
      ty = pos.y - arr[i - 1].y;
      tz = pos.z - arr[i - 1].z;
    } else {
      // Interior point: tangent from previous to next
      tx = arr[i + 1].x - arr[i - 1].x;
      ty = arr[i + 1].y - arr[i - 1].y;
      tz = arr[i + 1].z - arr[i - 1].z;
    }

    return {
      position: { x: pos.x, y: pos.y, z: pos.z },
      handleIn: {
        x: pos.x - tx / 6,
        y: pos.y - ty / 6,
        z: pos.z - tz / 6,
      },
      handleOut: {
        x: pos.x + tx / 6,
        y: pos.y + ty / 6,
        z: pos.z + tz / 6,
      },
    };
  });
}

// MARK: HIGHWAY DATA

// Load from generated JSON (written by: bun run extract), fall back to hardcoded legacy data.
// import.meta.glob returns {} if the file doesn't exist, so the fallback always works.
const _generatedModules = import.meta.glob<{ default: HighwayData }>(
  '../generated/highway-data.json',
  { eager: true }
);
const _generated = Object.values(_generatedModules)[0]?.default as
  | HighwayData
  | undefined;

const FALLBACK_POINTS: Vec3[] = [
  { x: 49, y: 0, z: 504 },
  { x: 92, y: 0, z: 504 },
  { x: 114, y: 0, z: 522 },
  { x: 152, y: 0, z: 509 },
  { x: 173, y: 0, z: 554 },
  { x: 215, y: 0, z: 578 },
  { x: 223, y: 0, z: 541 },
  { x: 185, y: 0, z: 517 },
  { x: 223, y: 0, z: 483 },
  { x: 246, y: 0, z: 518 },
  { x: 268, y: 0, z: 536 },
  { x: 276, y: 0, z: 572 },
  { x: 327, y: 0, z: 568 },
  { x: 344, y: 0, z: 536 },
  { x: 408, y: 0, z: 531 },
  { x: 377, y: 0, z: 497 },
];

export const HIGHWAY_DATA: HighwayData = _generated ?? {
  branches: [
    {
      id: 'main',
      nodes: pointsToBezierNodes(FALLBACK_POINTS),
      widthFactor: 1.2,
      segmentsFactor: 10,
    },
  ],
  exits: [],
};
