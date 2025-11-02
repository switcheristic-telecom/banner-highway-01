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

export const BANNER_DEFS: BannerDefinition[] = [
  // Main branch banners - forming a poetry sequence
  {
    id: 'banner_main_1',
    branch_id: 'main',
    t: 0.1 / 2,
    side: 'r',
    angle: 0,
    sizeFactor: 1.2,
    distanceFactor: 0.1,
    bannerImageFile: 'poem-1/1.jpg',
  },
  {
    id: 'banner_main_2',
    branch_id: 'main',
    t: 0.21 / 2,
    side: 'r',
    sizeFactor: 1.0,
    angle: 0,
    distanceFactor: 0.1,
    aspectRatio: 3.9,
    bannerImageFile: 'poem-1/2.jpg',
  },
  {
    id: 'banner_main_3',
    branch_id: 'main',
    t: 0.32 / 2,
    side: 'r',
    sizeFactor: 1.5,
    angle: 0,
    distanceFactor: 0.9,
    bannerImageFile: 'poem-1/3.jpg',
  },
  {
    id: 'banner_main_4',
    branch_id: 'main',
    t: 0.4 / 2,
    side: 'r',
    sizeFactor: 1,
    angle: -15,
    distanceFactor: 0.1,
    bannerImageFile: 'poem-1/4.jpg',
  },
  {
    id: 'banner_main_5',
    branch_id: 'main',
    t: 0.48 / 2,
    side: 'r',
    sizeFactor: 1.3,
    angle: 10,
    distanceFactor: 0.5,
    bannerImageFile: 'poem-1/5.jpg',
  },
  {
    id: 'banner_main_6',
    branch_id: 'main',
    t: 0.55 / 2,
    side: 'r',
    sizeFactor: 1,
    angle: 0,
    distanceFactor: 0.1,
    bannerImageFile: 'poem-1/6.jpg',
  },
  {
    id: 'banner_main_7',
    branch_id: 'main',
    t: 0.65 / 2,
    side: 'r',
    sizeFactor: 1,
    angle: 30,
    distanceFactor: 0.1,
    bannerImageFile: 'poem-1/7.jpg',
  },
  {
    id: 'banner_main_8',
    branch_id: 'main',
    t: 0.75 / 2,
    side: 'r',
    sizeFactor: 1.4,
    angle: 8,
    distanceFactor: 0.15,
    bannerImageFile: 'poem-1/8.jpg',
  },
  {
    id: 'banner_main_9',
    branch_id: 'main',
    t: 0.85 / 2,
    side: 'r',
    sizeFactor: 1.2,
    angle: 0,
    distanceFactor: 1.0,
    emmisiveFactor: 0.4,
    bannerImageFile: 'poem-1/9.jpg',
  },
  {
    id: 'banner_main_10',
    branch_id: 'main',
    t: 0.99 / 2,
    side: 'r',
    elevationFactor: 0.8,
    sizeFactor: 2.0,
    angle: 0,
    distanceFactor: 0.01,
    bannerImageFile: 'poem-1/10.jpg',
  },
];

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
