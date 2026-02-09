const BANNER_DEFAULT_OPTIONS = {
  elevation: 10,
  emmisiveIntensity: 0.8,
  padX: 1,
  padY: 1,
  size: 1.7,
  distance: 10,
  aspectRatio: 7.8,
};

export default BANNER_DEFAULT_OPTIONS;

export interface BannerDefinition {
  id: string;
  branch_id: string;
  t: number;
  side: 'l' | 'r';
  angle: number;

  distanceFactor?: number;
  sizeFactor?: number;
  elevationFactor?: number;
  emmisiveFactor?: number;

  padX?: number;
  padY?: number;
  aspectRatio?: number;

  bannerImageFile: string;
  animatedBannerVideo?: string;
}

// Load from generated JSON (written by: bun run extract), fall back to hardcoded data.
const _generatedModules = import.meta.glob<{ default: BannerDefinition[] }>(
  '../generated/banner-data.json',
  { eager: true }
);
const _generated = Object.values(_generatedModules)[0]?.default as
  | BannerDefinition[]
  | undefined;

const FALLBACK_BANNER_DEFS: BannerDefinition[] = [
  { id: 'banner_main_1', branch_id: 'main', t: 0.1 / 2, side: 'r', angle: 0, sizeFactor: 1.2, distanceFactor: 0.1, bannerImageFile: 'poem-1/1.jpg' },
  { id: 'banner_main_2', branch_id: 'main', t: 0.21 / 2, side: 'r', angle: 0, sizeFactor: 1.0, distanceFactor: 0.1, aspectRatio: 3.9, bannerImageFile: 'poem-1/2.jpg' },
  { id: 'banner_main_3', branch_id: 'main', t: 0.32 / 2, side: 'r', angle: 0, sizeFactor: 1.5, distanceFactor: 0.9, bannerImageFile: 'poem-1/3.jpg' },
  { id: 'banner_main_4', branch_id: 'main', t: 0.4 / 2, side: 'r', angle: -15, sizeFactor: 1, distanceFactor: 0.1, bannerImageFile: 'poem-1/4.jpg' },
  { id: 'banner_main_5', branch_id: 'main', t: 0.48 / 2, side: 'r', angle: 10, sizeFactor: 1.3, distanceFactor: 0.5, bannerImageFile: 'poem-1/5.jpg' },
  { id: 'banner_main_6', branch_id: 'main', t: 0.55 / 2, side: 'r', angle: 0, sizeFactor: 1, distanceFactor: 0.1, bannerImageFile: 'poem-1/6.jpg' },
  { id: 'banner_main_7', branch_id: 'main', t: 0.65 / 2, side: 'r', angle: 30, sizeFactor: 1, distanceFactor: 0.1, bannerImageFile: 'poem-1/7.jpg' },
  { id: 'banner_main_8', branch_id: 'main', t: 0.75 / 2, side: 'r', angle: 8, sizeFactor: 1.4, distanceFactor: 0.15, bannerImageFile: 'poem-1/8.jpg' },
  { id: 'banner_main_9', branch_id: 'main', t: 0.85 / 2, side: 'r', angle: 0, sizeFactor: 1.2, distanceFactor: 0.1, emmisiveFactor: 0.4, bannerImageFile: 'poem-1/9.jpg' },
  { id: 'banner_main_10', branch_id: 'main', t: 0.99 / 2, side: 'r', angle: 0, sizeFactor: 2.0, elevationFactor: 0.8, distanceFactor: 0.01, bannerImageFile: 'poem-1/10.jpg' },
  { id: 'banner_main_11', branch_id: 'main', t: 0.12 / 2 + 0.5, side: 'l', angle: 30, sizeFactor: 1.2, elevationFactor: 0.9, distanceFactor: 0.01, bannerImageFile: 'poem-2/1.jpg' },
  { id: 'banner_main_12', branch_id: 'main', t: 0.18 / 2 + 0.5, side: 'l', angle: 30, sizeFactor: 1.2, elevationFactor: 1.0, distanceFactor: 0.1, bannerImageFile: 'poem-2/2.jpg' },
  { id: 'banner_main_13', branch_id: 'main', t: 0.28 / 2 + 0.5, side: 'l', angle: 0, sizeFactor: 1.2, elevationFactor: 1.1, distanceFactor: 0.1, bannerImageFile: 'poem-2/3.jpg' },
  { id: 'banner_main_14', branch_id: 'main', t: 0.36 / 2 + 0.5, side: 'l', angle: 12, sizeFactor: 1, elevationFactor: 1, distanceFactor: 0.001, emmisiveFactor: 0.8, bannerImageFile: 'poem-2/4.jpg' },
  { id: 'banner_main_15', branch_id: 'main', t: 0.48 / 2 + 0.5, side: 'l', angle: 0, sizeFactor: 1.5, distanceFactor: 0.1, emmisiveFactor: 2, bannerImageFile: 'poem-2/5.jpg' },
  { id: 'banner_main_16', branch_id: 'main', t: 0.55 / 2 + 0.5, side: 'l', angle: 0, sizeFactor: 1.2, distanceFactor: 0.1, bannerImageFile: 'poem-2/6.jpg' },
  { id: 'banner_main_17', branch_id: 'main', t: 0.65 / 2 + 0.5, side: 'l', angle: 0, sizeFactor: 1.2, distanceFactor: 0.1, aspectRatio: 3.9, bannerImageFile: 'poem-2/7.jpg' },
  { id: 'banner_main_18', branch_id: 'main', t: 0.75 / 2 + 0.5, side: 'l', angle: 0, sizeFactor: 1.2, distanceFactor: 0.1, emmisiveFactor: 0.6, bannerImageFile: 'poem-2/8.jpg' },
  { id: 'banner_main_19', branch_id: 'main', t: 0.85 / 2 + 0.5, side: 'l', angle: 0, sizeFactor: 1.2, distanceFactor: 0.1, bannerImageFile: 'poem-2/9.jpg' },
  { id: 'banner_main_20', branch_id: 'main', t: 0.99 / 2 + 0.5, side: 'l', angle: 0, sizeFactor: 1.2, distanceFactor: 0.1, bannerImageFile: 'poem-2/10.jpg' },
];

export const BANNER_DEFS: BannerDefinition[] = _generated ?? FALLBACK_BANNER_DEFS;

export interface BannerInfo {
  id: string;
  branch_id: string;
  t: number;
  side: 'l' | 'r';
  angle: number;
  distance: number;
  size: number;
  elevation: number;
  emmisiveIntensity: number;
  padX: number;
  padY: number;
  aspectRatio: number;
  bannerImageFile: string;
  animatedBannerVideo?: string;
}

function applyDefault(BannerDefinition: BannerDefinition): BannerInfo {
  return {
    id: BannerDefinition.id,
    branch_id: BannerDefinition.branch_id,
    t: BannerDefinition.t,
    side: BannerDefinition.side,
    angle: BannerDefinition.angle,
    distance:
      (BannerDefinition.distanceFactor ?? 1) * BANNER_DEFAULT_OPTIONS.distance,
    size: (BannerDefinition.sizeFactor ?? 1) * BANNER_DEFAULT_OPTIONS.size,
    elevation:
      (BannerDefinition.elevationFactor ?? 1) *
      BANNER_DEFAULT_OPTIONS.elevation,
    padX: BannerDefinition.padX ?? BANNER_DEFAULT_OPTIONS.padX,
    padY: BannerDefinition.padY ?? BANNER_DEFAULT_OPTIONS.padY,
    emmisiveIntensity:
      (BannerDefinition.emmisiveFactor ?? 1) *
      BANNER_DEFAULT_OPTIONS.emmisiveIntensity,
    aspectRatio:
      BannerDefinition.aspectRatio ?? BANNER_DEFAULT_OPTIONS.aspectRatio,
    bannerImageFile: BannerDefinition.bannerImageFile,
    animatedBannerVideo: BannerDefinition.animatedBannerVideo,
  };
}

export const BANNER_INFOS: BannerInfo[] = BANNER_DEFS.map(applyDefault);
