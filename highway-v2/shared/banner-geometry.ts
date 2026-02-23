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
  side: number;
  tangentX: number;
  tangentZ: number;
  normalX: number;
  normalZ: number;
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
  const signLen = (banner.size * aspectRatio) / 2;
  const signEndX = pivotX + signDirX * signLen;
  const signEndZ = pivotZ + signDirZ * signLen;

  return {
    pivotX,
    pivotZ,
    elevation: banner.elevation,
    rotationY,
    roadPointX: roadPoint.x,
    roadPointZ: roadPoint.z,
    signEndX,
    signEndZ,
    side,
    tangentX: tx,
    tangentZ: tz,
    normalX: nx,
    normalZ: nz,
  };
}
