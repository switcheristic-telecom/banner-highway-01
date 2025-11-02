const BANNER_DEFAULT_OPTIONS = {
  elevation: 10,
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
    t: 0.1,
    side: 'r',
    angle: 60,
    sizeFactor: 1.2,
    distanceFactor: 0.8,
    bannerImageFile: 'banner-1.png',
  },
  {
    id: 'banner_main_2',
    branch_id: 'main',
    t: 0.15,
    side: 'l',
    sizeFactor: 1.0,
    angle: 60,
    distanceFactor: 0.5,
    bannerImageFile: 'banner-2.png',
  },
  {
    id: 'banner_main_3',
    branch_id: 'main',
    t: 0.25,
    side: 'r',
    sizeFactor: 1.5,
    angle: 0,
    distanceFactor: 0.9,
    bannerImageFile: 'banner-2.png',
  },
  {
    id: 'banner_main_4',
    branch_id: 'main',
    t: 0.35,
    side: 'l',
    sizeFactor: 0.8,
    angle: -15,
    distanceFactor: 1.1,
    bannerImageFile: 'banner-2.png',
  },
  {
    id: 'banner_main_5',
    branch_id: 'main',
    t: 0.45,
    side: 'r',
    sizeFactor: 1.3,
    angle: 5,
    distanceFactor: 1.0,
    bannerImageFile: 'banner-2.png',
  },
  {
    id: 'banner_main_6',
    branch_id: 'main',
    t: 0.55,
    side: 'l',
    sizeFactor: 1.1,
    angle: 0,
    distanceFactor: 0.95,
    bannerImageFile: 'banner-2.png',
  },
  {
    id: 'banner_main_7',
    branch_id: 'main',
    t: 0.65,
    side: 'r',
    sizeFactor: 0.9,
    angle: -10,
    distanceFactor: 1.15,
    bannerImageFile: 'banner-2.png',
  },
  {
    id: 'banner_main_8',
    branch_id: 'main',
    t: 0.75,
    side: 'l',
    sizeFactor: 1.4,
    angle: 8,
    distanceFactor: 0.85,
    bannerImageFile: 'banner-2.png',
    aspectRatio: 1.5,
  },
  {
    id: 'banner_main_9',
    branch_id: 'main',
    t: 0.85,
    side: 'r',
    sizeFactor: 1.2,
    angle: 0,
    distanceFactor: 1.0,
    bannerImageFile: 'banner-2.png',
  },
  {
    id: 'banner_main_10',
    branch_id: 'main',
    t: 0.95,
    side: 'l',
    sizeFactor: 1.0,
    angle: -5,
    distanceFactor: 1.1,
    bannerImageFile: 'banner-2.png',
  },

  // Branch 1 banners - alternative poetry sequence
  {
    id: 'banner_branch1_1',
    branch_id: 'branch_1',
    t: 0.2,
    side: 'r',
    sizeFactor: 1.1,
    angle: 0,
    distanceFactor: 0.9,
    bannerImageFile: 'banner-2.png',
  },
  {
    id: 'banner_branch1_2',
    branch_id: 'branch_1',
    t: 0.4,
    side: 'l',
    sizeFactor: 1.3,
    angle: 10,
    distanceFactor: 1.0,
    bannerImageFile: 'banner-2.png',
  },
  {
    id: 'banner_branch1_3',
    branch_id: 'branch_1',
    t: 0.6,
    side: 'r',
    sizeFactor: 0.9,
    angle: -5,
    distanceFactor: 1.2,
    bannerImageFile: 'banner-2.png',
  },
  {
    id: 'banner_branch1_4',
    branch_id: 'branch_1',
    t: 0.8,
    side: 'l',
    sizeFactor: 1.5,
    angle: 0,
    distanceFactor: 0.95,
    bannerImageFile: 'banner-2.png',
  },

  // Branch 2 banners - another alternative sequence
  {
    id: 'banner_branch2_1',
    branch_id: 'branch_2',
    t: 0.15,
    side: 'l',
    sizeFactor: 1.2,
    angle: 5,
    distanceFactor: 1.0,
    bannerImageFile: 'banner-2.png',
  },
  {
    id: 'banner_branch2_2',
    branch_id: 'branch_2',
    t: 0.35,
    side: 'r',
    sizeFactor: 1.0,
    angle: -10,
    distanceFactor: 1.1,
    bannerImageFile: 'banner-2.png',
    aspectRatio: 1.5,
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
    aspectRatio:
      BannerDefinition.aspectRatio ?? BANNER_DEFAULT_OPTIONS.aspectRatio,
    bannerImageFile: BannerDefinition.bannerImageFile,
    animatedBannerVideo: BannerDefinition.animatedBannerVideo,
  };
}

export const BANNER_INFOS: BannerInfo[] = BANNER_DEFS.map(applyDefault);
