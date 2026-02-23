import { BANNER_DEFAULTS } from './defaults';

export interface BannerGeometryInput {
  distance: number;
  elevation: number;
  angle: number;
  size: number;
  aspectRatio?: number;
}

export interface BannerGeometryResult {
  pivotX: number;
  pivotZ: number;
  elevation: number;
  rotationY: number;
  roadPointX: number;
  roadPointZ: number;
  signEndX: number;
  signEndZ: number;
  /** Pole base position (where the leg meets the ground in 3D) */
  poleX: number;
  poleZ: number;
  /** Far end of the banner frame (opposite the pole) */
  farEndX: number;
  farEndZ: number;
  side: number;
  tangentX: number;
  tangentZ: number;
  normalX: number;
  normalZ: number;
  signDirX: number;
  signDirZ: number;
}

/**
 * Compute banner geometry from a road point, tangent, and banner parameters.
 *
 * This function is shared between the 2D editor and 3D viewer to ensure
 * identical banner positioning.
 *
 * @param roadPoint - Position on the road at banner's t parameter
 * @param roadTangent - Normalized tangent direction at that point
 * @param banner - Banner placement parameters (direct world-space values)
 */
export function computeBannerGeometry(
  roadPoint: { x: number; z: number },
  roadTangent: { x: number; z: number },
  banner: BannerGeometryInput,
): BannerGeometryResult {
  const tx = roadTangent.x;
  const tz = roadTangent.z;

  // Normal: perpendicular to tangent (right-hand rule in XZ plane)
  const nx = -tz;
  const nz = tx;

  const dist = banner.distance;
  const side = Math.sign(dist) || 1;

  // Pivot position: road point offset along normal by distance
  const pivotX = roadPoint.x + nx * dist;
  const pivotZ = roadPoint.z + nz * dist;

  const angleRad = (banner.angle * Math.PI) / 180;

  // Y-axis rotation for 3D group placement
  const rotationY = Math.atan2(nx, nz) + (Math.PI / 2) * side - angleRad;

  // Sign direction for 2D editor visualization
  const baseDir = { x: tz * side, z: -tx * side };
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  const signDirX = baseDir.x * cosA - baseDir.z * sinA;
  const signDirZ = baseDir.x * sinA + baseDir.z * cosA;

  const aspectRatio = banner.aspectRatio ?? BANNER_DEFAULTS.aspectRatio;
  const padX = BANNER_DEFAULTS.padX;
  const signLen = (banner.size * aspectRatio) / 2;
  const frameHalfW = signLen + padX;
  const signEndX = pivotX + signDirX * signLen;
  const signEndZ = pivotZ + signDirZ * signLen;

  // Pole: left edge of frame (where the leg is in 3D), opposite from signEnd
  const poleX = pivotX - signDirX * frameHalfW;
  const poleZ = pivotZ - signDirZ * frameHalfW;
  // Far end: right edge of frame (opposite the pole)
  const farEndX = pivotX + signDirX * frameHalfW;
  const farEndZ = pivotZ + signDirZ * frameHalfW;

  return {
    pivotX,
    pivotZ,
    elevation: banner.elevation,
    rotationY,
    roadPointX: roadPoint.x,
    roadPointZ: roadPoint.z,
    signEndX,
    signEndZ,
    poleX,
    poleZ,
    farEndX,
    farEndZ,
    side,
    tangentX: tx,
    tangentZ: tz,
    normalX: nx,
    normalZ: nz,
    signDirX,
    signDirZ,
  };
}
