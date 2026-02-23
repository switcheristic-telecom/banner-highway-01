import * as THREE from 'three';
import type { BannerAsset, BannerDefinition, BannerInfo } from './types';

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

export const BANNER_DEFAULT_OPTIONS = {
  elevation: 10,
  emissiveIntensity: 0.8,
  padX: 1,
  padY: 1,
  size: 1.7,
  distance: 10,
  aspectRatio: 7.8,
};

export function applyDefaults(
  def: BannerDefinition,
  assets: Map<string, BannerAsset>,
): BannerInfo {
  const asset = def.assetId ? assets.get(def.assetId) : undefined;
  return {
    id: def.id,
    branch_id: def.branch_id,
    t: def.t,
    angle: def.angle,
    distance: (def.distanceFactor ?? 1) * BANNER_DEFAULT_OPTIONS.distance,
    size: (def.sizeFactor ?? 1) * BANNER_DEFAULT_OPTIONS.size,
    elevation: (def.elevationFactor ?? 1) * BANNER_DEFAULT_OPTIONS.elevation,
    emissiveIntensity:
      (def.emissiveFactor ?? 1) * BANNER_DEFAULT_OPTIONS.emissiveIntensity,
    padX: BANNER_DEFAULT_OPTIONS.padX,
    padY: BANNER_DEFAULT_OPTIONS.padY,
    aspectRatio: asset && asset.width && asset.height
      ? asset.width / asset.height
      : BANNER_DEFAULT_OPTIONS.aspectRatio,
    imageFile: asset?.filePath ?? '',
    mirror: def.mirror ?? false,
  };
}
