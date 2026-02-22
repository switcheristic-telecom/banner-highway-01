export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** @deprecated Use RoadWaypoint instead. Kept for migration. */
export interface PathNode {
  position: Vec3;
  handleIn: Vec3;
  handleOut: Vec3;
}

export interface RoadWaypoint {
  x: number;
  z: number;
  headingOverride?: number;
}

export interface HighwayData {
  branches: HighwayBranch[];
  exits: HighwayExit[];
}

export interface HighwayBranch {
  id: string;
  waypoints: RoadWaypoint[];
  isCyclic: boolean;
  widthFactor?: number;
  segmentsFactor?: number;
}

export interface HighwayExit {
  fromBranch: string;
  fromT: number;
  toBranch: string;
  toT: number;
}

export interface BannerAsset {
  id: string;
  name: string;
  filePath: string;
  width?: number;
  height?: number;
}

export interface BannerDefinition {
  id: string;
  branch_id: string;
  t: number;
  side: 'l' | 'r';
  angle: number;

  assetId: string | null;

  distanceFactor?: number;
  sizeFactor?: number;
  elevationFactor?: number;
  emissiveFactor?: number;
}

export interface BannerInfo {
  id: string;
  branch_id: string;
  t: number;
  side: 'l' | 'r';
  angle: number;
  distance: number;
  size: number;
  elevation: number;
  emissiveIntensity: number;
  padX: number;
  padY: number;
  aspectRatio: number;
  imageFile: string;
}

export interface RawSceneData {
  highway: HighwayData;
  banners: BannerDefinition[];
  assets: BannerAsset[];
}

export interface SceneData {
  highway: HighwayData;
  banners: BannerInfo[];
}
