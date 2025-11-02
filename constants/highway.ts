import * as THREE from 'three';

// MARK: HIGHWAY OPTIONS

export const HIGHWAY_MESH_DEFAULT_OPTIONS = {
  width: 2,
  segments: 100,
  blockNMaterial: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0.0,
    emissive: 0xffffff,
    emissiveIntensity: 0.3,
  }),
  edgeMaterial: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
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

export const HIGHWAY_DATA = {
  branches: [
    {
      id: 'main',
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 10 },
        { x: 20, y: 0, z: 15 },
        { x: 35, y: 0, z: 18 },
        { x: 50, y: 0, z: 20 },
        { x: 65, y: 0, z: 25 },
        { x: 80, y: 0, z: 35 },
        { x: 90, y: 0, z: 50 },
        { x: 95, y: 0, z: 65 },
        { x: 100, y: 0, z: 80 },
        { x: 105, y: 0, z: 95 },
        { x: 110, y: 0, z: 110 },
        { x: 115, y: 0, z: 125 },
        { x: 120, y: 0, z: 140 },
        { x: 125, y: 0, z: 155 },
        { x: 130, y: 0, z: 170 },
      ],
      width: 1.2,
      segments: 5,
    },
    {
      id: 'branch_1',
      points: [
        { x: 50, y: 0, z: 20 },
        { x: 55, y: 0, z: 15 },
        { x: 65, y: 0, z: 10 },
        { x: 75, y: 0, z: 8 },
        { x: 85, y: 0, z: 10 },
        { x: 95, y: 0, z: 15 },
        { x: 105, y: 0, z: 20 },
        { x: 115, y: 0, z: 25 },
        { x: 125, y: 0, z: 30 },
      ],
      width: 1,
      segments: 80,
    },
    {
      id: 'branch_2',
      points: [
        { x: 90, y: 0, z: 50 },
        { x: 95, y: 0, z: 55 },
        { x: 105, y: 0, z: 60 },
        { x: 115, y: 0, z: 62 },
        { x: 125, y: 0, z: 65 },
        { x: 135, y: 0, z: 70 },
        { x: 145, y: 0, z: 75 },
      ],
      width: 1,
      segments: 5,
    },
  ],
  exits: [
    {
      fromBranch: 'main',
      fromT: 0.3,
      toBranch: 'branch_1',
      toT: 0,
    },
    {
      fromBranch: 'main',
      fromT: 0.55,
      toBranch: 'branch_2',
      toT: 0,
    },
    {
      fromBranch: 'branch_1',
      fromT: 0.9,
      toBranch: 'main',
      toT: 0.7,
    },
    {
      fromBranch: 'branch_2',
      fromT: 0.9,
      toBranch: 'main',
      toT: 0.85,
    },
  ],
};
