import type { BannerAsset, BannerPlacement, BannerRenderData } from './types';

export const BANNER_DEFAULTS = {
  distance: 10,
  elevation: 10,
  size: 1.7,
  emissiveIntensity: 0.8,
  padX: 1,
  padY: 1,
  aspectRatio: 7.8,
  angle: 0,
};

export const ROAD_DEFAULTS = {
  width: 5.555,
  segmentCount: 10,
};

export function resolveForRender(
  placement: BannerPlacement,
  assets: Map<string, BannerAsset>,
): BannerRenderData {
  const asset = placement.assetId ? assets.get(placement.assetId) : undefined;
  return {
    ...placement,
    imageFile: asset?.filePath ?? '',
    aspectRatio:
      asset && asset.width && asset.height
        ? asset.width / asset.height
        : BANNER_DEFAULTS.aspectRatio,
    padX: BANNER_DEFAULTS.padX,
    padY: BANNER_DEFAULTS.padY,
    caption: placement.caption ?? '',
  };
}
