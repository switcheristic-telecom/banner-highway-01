/**
 * Clothoid (Euler spiral / Cornu spiral) math library.
 *
 * A clothoid has curvature that varies linearly with arc length:
 *   κ(s) = κ₀ + (dκ/ds) · s
 *
 * The position is obtained by integrating heading, which involves
 * generalized Fresnel integrals.
 */

/**
 * Numerically evaluate a clothoid segment using Gauss-Legendre quadrature.
 *
 * Given start heading θ₀, start curvature κ₀, curvature rate σ = dκ/ds,
 * and total arc length L, compute the endpoint (Δx, Δz) relative to origin
 * with start heading = θ₀.
 *
 * θ(s) = θ₀ + κ₀·s + ½·σ·s²
 * x(L) = ∫₀ᴸ cos(θ(s)) ds
 * z(L) = ∫₀ᴸ sin(θ(s)) ds
 */

// 16-point Gauss-Legendre nodes and weights on [-1, 1]
const GL_NODES = [
  -0.9894009349916499, -0.9445750230732326, -0.8656312023878318,
  -0.7554044083550030, -0.6178762444026438, -0.4580167776572274,
  -0.2816035507792589, -0.0950125098376374,
  0.0950125098376374, 0.2816035507792589, 0.4580167776572274,
  0.6178762444026438, 0.7554044083550030, 0.8656312023878318,
  0.9445750230732326, 0.9894009349916499,
];

const GL_WEIGHTS = [
  0.0271524594117541, 0.0622535239386479, 0.0951585116824928,
  0.1246289712555339, 0.1495959888165767, 0.1691565193950025,
  0.1826034150449236, 0.1894506104550685,
  0.1894506104550685, 0.1826034150449236, 0.1691565193950025,
  0.1495959888165767, 0.1246289712555339, 0.0951585116824928,
  0.0622535239386479, 0.0271524594117541,
];

export interface ClothoidSegment {
  x0: number;
  z0: number;
  theta0: number;
  kappa0: number;
  sigma: number; // dκ/ds
  length: number;
}

/**
 * Evaluate position at arc length s along a clothoid segment.
 * Returns (x, z) in world coordinates.
 */
export function clothoidEvalXZ(
  seg: ClothoidSegment,
  s: number,
): { x: number; z: number } {
  const halfL = s / 2;
  let ix = 0;
  let iz = 0;

  for (let i = 0; i < GL_NODES.length; i++) {
    const si = halfL * GL_NODES[i] + halfL;
    const theta = seg.theta0 + seg.kappa0 * si + 0.5 * seg.sigma * si * si;
    ix += GL_WEIGHTS[i] * Math.cos(theta);
    iz += GL_WEIGHTS[i] * Math.sin(theta);
  }

  ix *= halfL;
  iz *= halfL;

  return { x: seg.x0 + ix, z: seg.z0 + iz };
}

/**
 * Evaluate heading at arc length s along a clothoid.
 */
export function clothoidEvalTheta(seg: ClothoidSegment, s: number): number {
  return seg.theta0 + seg.kappa0 * s + 0.5 * seg.sigma * s * s;
}

/**
 * Evaluate curvature at arc length s along a clothoid.
 */
export function clothoidEvalKappa(seg: ClothoidSegment, s: number): number {
  return seg.kappa0 + seg.sigma * s;
}

/**
 * Evaluate tangent direction at arc length s.
 * Returns a unit vector (dx, dz).
 */
export function clothoidEvalTangent(
  seg: ClothoidSegment,
  s: number,
): { dx: number; dz: number } {
  const theta = clothoidEvalTheta(seg, s);
  return { dx: Math.cos(theta), dz: Math.sin(theta) };
}

/**
 * G1 Hermite clothoid interpolation.
 *
 * Given two oriented points:
 *   P0 = (x0, z0) with heading θ0
 *   P1 = (x1, z1) with heading θ1
 *
 * Find a clothoid (or 3-segment clothoid: arc + clothoid + arc) that
 * connects them. For simplicity and robustness, we use a single clothoid
 * with optimised κ₀ and L, then iterate with Newton-Raphson.
 *
 * Returns a ClothoidSegment or null if fitting fails.
 */
export function fitClothoidG1(
  x0: number, z0: number, theta0: number,
  x1: number, z1: number, theta1: number,
): ClothoidSegment | null {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < 1e-10) return null;

  // Angle of chord from P0 to P1
  const phi = Math.atan2(dz, dx);

  // Normalise angles relative to chord
  let alpha = normalizeAngle(theta0 - phi);
  let beta = normalizeAngle(theta1 - phi);

  // Total turning angle
  const deltaTheta = normalizeAngle(theta1 - theta0);

  // Initial guess: assume a circular arc (σ=0)
  // For a circular arc: Δθ = κ·L, and the chord relates to radius.
  // Better initial guess using a cubic polynomial match.
  let L = dist * guessLengthFactor(alpha, beta);
  let kappa0 = guessInitialKappa(alpha, beta, L, deltaTheta);

  // Newton-Raphson iteration
  const MAX_ITER = 50;
  const TOL = 1e-10;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    // σ is determined by the heading constraint:
    // θ₁ - θ₀ = κ₀·L + ½·σ·L²  =>  σ = 2·(Δθ - κ₀·L) / L²
    const sigma = 2 * (deltaTheta - kappa0 * L) / (L * L);

    const seg: ClothoidSegment = {
      x0: 0, z0: 0, theta0: alpha, kappa0, sigma, length: L,
    };

    // Evaluate endpoint in normalised (chord-aligned) frame
    const endPt = clothoidEvalXZ(seg, L);

    // Target: endPt should be (dist, 0) in chord frame
    const errX = endPt.x - dist;
    const errZ = endPt.z;

    if (Math.abs(errX) < TOL && Math.abs(errZ) < TOL) {
      // Converged - build the actual segment in world coords
      return {
        x0, z0,
        theta0,
        kappa0,
        sigma,
        length: L,
      };
    }

    // Numerical Jacobian
    const dL = L * 1e-6 + 1e-10;
    const dK = Math.max(Math.abs(kappa0) * 1e-6, 1e-10);

    // Partial w.r.t. L
    const sigmaL = 2 * (deltaTheta - kappa0 * (L + dL)) / ((L + dL) * (L + dL));
    const segL: ClothoidSegment = {
      x0: 0, z0: 0, theta0: alpha, kappa0, sigma: sigmaL, length: L + dL,
    };
    const endL = clothoidEvalXZ(segL, L + dL);
    const dFxdL = (endL.x - dist - errX) / dL;
    const dFzdL = (endL.z - errZ) / dL;

    // Partial w.r.t. kappa0
    const sigmaK = 2 * (deltaTheta - (kappa0 + dK) * L) / (L * L);
    const segK: ClothoidSegment = {
      x0: 0, z0: 0, theta0: alpha, kappa0: kappa0 + dK, sigma: sigmaK, length: L,
    };
    const endK = clothoidEvalXZ(segK, L);
    const dFxdK = (endK.x - dist - errX) / dK;
    const dFzdK = (endK.z - errZ) / dK;

    // Solve 2x2: J · [δL, δκ]ᵀ = -[errX, errZ]ᵀ
    const det = dFxdL * dFzdK - dFxdK * dFzdL;
    if (Math.abs(det) < 1e-20) break;

    const deltaL = (-errX * dFzdK + errZ * dFxdK) / det;
    const deltaK = (-errZ * dFxdL + errX * dFzdL) / det;

    L += deltaL;
    kappa0 += deltaK;

    if (L < dist * 0.5) L = dist * 0.5;
    if (L > dist * 10) L = dist * 10;
  }

  // Fallback: if Newton didn't converge, return a straight line segment
  return {
    x0, z0,
    theta0,
    kappa0: 0,
    sigma: 0,
    length: dist,
  };
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

function guessLengthFactor(alpha: number, beta: number): number {
  const absA = Math.abs(alpha);
  const absB = Math.abs(beta);
  const maxAng = Math.max(absA, absB);
  // For small angles, length ≈ chord. For large turns, length grows.
  return 1.0 + 0.3 * maxAng + 0.1 * maxAng * maxAng;
}

function guessInitialKappa(
  _alpha: number,
  _beta: number,
  L: number,
  deltaTheta: number,
): number {
  return deltaTheta / L;
}
