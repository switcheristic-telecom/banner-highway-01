export interface RoadWaypoint {
  x: number;
  z: number;
  headingOverride?: number;
}

export interface Road {
  id: string;
  waypoints: RoadWaypoint[];
  isCyclic: boolean;
  width: number;
  segmentCount: number;
}

export interface RoadJunction {
  fromRoad: string;
  fromT: number;
  toRoad: string;
  toT: number;
}

export interface RoadNetwork {
  roads: Road[];
  junctions: RoadJunction[];
}

export interface BannerAsset {
  id: string;
  name: string;
  filePath: string;
  width?: number;
  height?: number;
}

export interface BannerPlacement {
  id: string;
  roadId: string;
  t: number;
  angle: number;
  distance: number;
  elevation: number;
  size: number;
  emissiveIntensity: number;
  mirror: boolean;
  assetId: string | null;
}

export interface BannerRenderData extends BannerPlacement {
  imageFile: string;
  aspectRatio: number;
  padX: number;
  padY: number;
}

export interface RawSceneData {
  roadNetwork: RoadNetwork;
  banners: BannerPlacement[];
  assets: BannerAsset[];
}

export interface SceneData {
  roadNetwork: RoadNetwork;
  banners: BannerRenderData[];
}
