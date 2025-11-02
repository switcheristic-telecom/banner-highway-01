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

// MARK: HIGHWAY DATA

export interface HighwayData {
  branches: HighwayBranch[];
  exits: HighwayExit[];
}

export interface HighwayBranch {
  id: string;
  points: { x: number; y: number; z: number }[];
  widthFactor?: number;
  segmentsFactor?: number;
}

export interface HighwayExit {
  fromBranch: string;
  fromT: number;
  toBranch: string;
  toT: number;
}

export const HIGHWAY_DATA: HighwayData = {
  branches: [
    {
      id: 'main',
      points: [
        // new xz:
        { x: 49, y: 0, z: 504 },
        { x: 92, y: 0, z: 504 },
        { x: 114, y: 0, z: 522 },
        { x: 152, y: 0, z: 509 },
        { x: 173, y: 0, z: 554 },
        { x: 215, y: 0, z: 578 },
        { x: 223, y: 0, z: 541 },
        { x: 185, y: 0, z: 517 },
        { x: 223, y: 0, z: 483 },
        // { x: 227, y: 0, z: 490 },
        { x: 246, y: 0, z: 518 },
        { x: 268, y: 0, z: 536 },
        { x: 276, y: 0, z: 572 },
        { x: 327, y: 0, z: 568 },
        { x: 344, y: 0, z: 536 },
        // { x: 337, y: 0, z: 555 },
        { x: 408, y: 0, z: 531 },
        { x: 377, y: 0, z: 497 },
      ],
      widthFactor: 1.2,
      segmentsFactor: 10,
    },
  ],
  exits: [],
};
