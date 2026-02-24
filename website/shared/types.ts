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
  assetId: string | null;
  caption?: string;
}

export interface BannerRenderData extends BannerPlacement {
  imageFile: string;
  aspectRatio: number;
  padX: number;
  padY: number;
  caption: string;
}

export interface HighwayPart {
  id: string;
  roadId: string;
  startT: number;
  skyEffect: number;
}

export interface MidiSong {
  id: string;
  name: string;
  filePath: string;
  sourceUrl: string;
  language: string;
}

export interface PartSongAssignment {
  partId: string;
  songId: string;
}

export interface AudioSettings {
  synthVolume: number;
  synthAttack: number;
  synthDecay: number;
  synthSustain: number;
  synthRelease: number;
  reverbWet: number;
  reverbDecay: number;
  delayWet: number;
  delayTime: number;
  delayFeedback: number;
  chorusWet: number;
  chorusFrequency: number;
  chorusDepth: number;
  chorusSpread: number;
  eqLow: number;
  eqMid: number;
  eqHigh: number;
}

export interface RawSceneData {
  roadNetwork: RoadNetwork;
  banners: BannerPlacement[];
  assets: BannerAsset[];
  parts: HighwayPart[];
  songs: MidiSong[];
  partSongs: PartSongAssignment[];
  audioSettings: AudioSettings | null;
}

export interface SceneData {
  roadNetwork: RoadNetwork;
  banners: BannerRenderData[];
  parts: HighwayPart[];
  songs: MidiSong[];
  partSongs: PartSongAssignment[];
  audioSettings: AudioSettings | null;
}
