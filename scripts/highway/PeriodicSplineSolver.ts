/**
 * Periodic cubic spline solver for computing smooth headings from waypoint positions.
 *
 * Given N waypoint positions arranged in a ring, solves a cyclic tridiagonal
 * system to find the natural cubic spline through them, then extracts tangent
 * angles as heading values.
 *
 * Supports optional heading overrides (pinned headings) at individual waypoints.
 */

export interface WaypointInput {
  x: number;
  z: number;
  headingOverride?: number;
}

/**
 * Full spline solution: derivatives, chord lengths, and derived headings.
 * The dxdt/dzdt arrays are the first derivatives of the cubic spline
 * w.r.t. chord-length parameterisation at each knot.
 */
export interface SplineSolution {
  headings: number[];
  dxdt: number[];
  dzdt: number[];
  chordLengths: number[];
}

/**
 * Solve a periodic (cyclic) cubic spline through waypoints.
 * Returns derivatives, chord lengths, and headings.
 */
export function solvePeriodicSpline(waypoints: WaypointInput[]): SplineSolution {
  const N = waypoints.length;
  if (N < 2) return { headings: waypoints.map(() => 0), dxdt: waypoints.map(() => 0), dzdt: waypoints.map(() => 0), chordLengths: [] };
  if (N === 2) {
    const dx = waypoints[1].x - waypoints[0].x;
    const dz = waypoints[1].z - waypoints[0].z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1e-10;
    const h = Math.atan2(dz, dx);
    const h0 = waypoints[0].headingOverride ?? h;
    const h1 = waypoints[1].headingOverride ?? h;
    return {
      headings: [h0, h1],
      dxdt: [Math.cos(h0), Math.cos(h1)],
      dzdt: [Math.sin(h0), Math.sin(h1)],
      chordLengths: [d, d],
    };
  }

  const chordLengths: number[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const dx = waypoints[j].x - waypoints[i].x;
    const dz = waypoints[j].z - waypoints[i].z;
    chordLengths[i] = Math.sqrt(dx * dx + dz * dz);
    if (chordLengths[i] < 1e-10) chordLengths[i] = 1e-10;
  }

  const xs = waypoints.map(w => w.x);
  const zs = waypoints.map(w => w.z);

  const dxdt = solvePeriodicSplineDerivatives(xs, chordLengths);
  const dzdt = solvePeriodicSplineDerivatives(zs, chordLengths);

  const headings: number[] = new Array(N);
  for (let i = 0; i < N; i++) {
    if (waypoints[i].headingOverride !== undefined) {
      headings[i] = waypoints[i].headingOverride!;
      dxdt[i] = Math.cos(headings[i]);
      dzdt[i] = Math.sin(headings[i]);
    } else {
      headings[i] = Math.atan2(dzdt[i], dxdt[i]);
    }
  }

  return { headings, dxdt, dzdt, chordLengths };
}

/**
 * Solve an open (non-cyclic) cubic spline through waypoints.
 * Returns derivatives, chord lengths, and headings.
 */
export function solveOpenSpline(waypoints: WaypointInput[]): SplineSolution {
  const N = waypoints.length;
  if (N < 2) return { headings: waypoints.map(() => 0), dxdt: waypoints.map(() => 0), dzdt: waypoints.map(() => 0), chordLengths: [] };
  if (N === 2) {
    const dx = waypoints[1].x - waypoints[0].x;
    const dz = waypoints[1].z - waypoints[0].z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1e-10;
    const h = Math.atan2(dz, dx);
    const h0 = waypoints[0].headingOverride ?? h;
    const h1 = waypoints[1].headingOverride ?? h;
    return {
      headings: [h0, h1],
      dxdt: [Math.cos(h0), Math.cos(h1)],
      dzdt: [Math.sin(h0), Math.sin(h1)],
      chordLengths: [d],
    };
  }

  const chordLengths: number[] = new Array(N - 1);
  for (let i = 0; i < N - 1; i++) {
    const dx = waypoints[i + 1].x - waypoints[i].x;
    const dz = waypoints[i + 1].z - waypoints[i].z;
    chordLengths[i] = Math.sqrt(dx * dx + dz * dz);
    if (chordLengths[i] < 1e-10) chordLengths[i] = 1e-10;
  }

  const xs = waypoints.map(w => w.x);
  const zs = waypoints.map(w => w.z);

  const dxdt = solveNaturalSplineDerivatives(xs, chordLengths);
  const dzdt = solveNaturalSplineDerivatives(zs, chordLengths);

  const headings: number[] = new Array(N);
  for (let i = 0; i < N; i++) {
    if (waypoints[i].headingOverride !== undefined) {
      headings[i] = waypoints[i].headingOverride!;
      dxdt[i] = Math.cos(headings[i]);
      dzdt[i] = Math.sin(headings[i]);
    } else {
      headings[i] = Math.atan2(dzdt[i], dxdt[i]);
    }
  }

  return { headings, dxdt, dzdt, chordLengths };
}

/** @deprecated Use solvePeriodicSpline instead */
export function solvePeriodicHeadings(waypoints: WaypointInput[]): number[] {
  return solvePeriodicSpline(waypoints).headings;
}

/** @deprecated Use solveOpenSpline instead */
export function solveOpenHeadings(waypoints: WaypointInput[]): number[] {
  return solveOpenSpline(waypoints).headings;
}

/**
 * Solve for first derivatives of a periodic cubic spline.
 *
 * Given values y[0..N-1] at knots with spacings h[0..N-1] (cyclic),
 * solve the cyclic tridiagonal system for the first derivatives m[i] = dy/dt at each knot.
 *
 * The system is:
 *   h[i-1]·m[i-1] + 2·(h[i-1]+h[i])·m[i] + h[i]·m[i+1]
 *     = 3·( h[i-1]·δ[i] + h[i]·δ[i-1] )
 *
 * where δ[i] = (y[i+1]-y[i]) / h[i], indices mod N.
 */
function solvePeriodicSplineDerivatives(y: number[], h: number[]): number[] {
  const N = y.length;

  // Divided differences
  const delta: number[] = new Array(N);
  for (let i = 0; i < N; i++) {
    delta[i] = (y[(i + 1) % N] - y[i]) / h[i];
  }

  // Build cyclic tridiagonal system: A·m = d
  // a[i] = h[(i-1+N)%N]          (sub-diagonal)
  // b[i] = 2·(h[(i-1+N)%N] + h[i])  (diagonal)
  // c[i] = h[i]                   (super-diagonal)
  // d[i] = 3·(h[(i-1+N)%N]·delta[i] + h[i]·delta[(i-1+N)%N])

  const a: number[] = new Array(N);
  const b: number[] = new Array(N);
  const c: number[] = new Array(N);
  const rhs: number[] = new Array(N);

  for (let i = 0; i < N; i++) {
    const im = (i - 1 + N) % N;
    a[i] = h[im];
    b[i] = 2 * (h[im] + h[i]);
    c[i] = h[i];
    rhs[i] = 3 * (h[im] * delta[i] + h[i] * delta[im]);
  }

  return solveCyclicTridiagonal(a, b, c, rhs);
}

/**
 * Solve for first derivatives of a natural cubic spline (open).
 */
function solveNaturalSplineDerivatives(y: number[], h: number[]): number[] {
  const N = y.length;
  const M = N - 1; // number of intervals

  const delta: number[] = new Array(M);
  for (let i = 0; i < M; i++) {
    delta[i] = (y[i + 1] - y[i]) / h[i];
  }

  if (N === 2) {
    return [delta[0], delta[0]];
  }

  // Tridiagonal system for interior points + natural end conditions.
  // Natural end conditions: second derivative = 0 at endpoints
  // This gives: 2·m[0] + m[1] = 3·δ[0]
  //             m[N-2] + 2·m[N-1] = 3·δ[N-2]
  const aa: number[] = new Array(N);
  const bb: number[] = new Array(N);
  const cc: number[] = new Array(N);
  const rhs: number[] = new Array(N);

  bb[0] = 2;
  cc[0] = 1;
  rhs[0] = 3 * delta[0];

  for (let i = 1; i < N - 1; i++) {
    aa[i] = h[i];
    bb[i] = 2 * (h[i - 1] + h[i]);
    cc[i] = h[i - 1];
    rhs[i] = 3 * (h[i] * delta[i - 1] + h[i - 1] * delta[i]);
  }

  aa[N - 1] = 1;
  bb[N - 1] = 2;
  rhs[N - 1] = 3 * delta[M - 1];

  return solveTridiagonal(aa, bb, cc, rhs);
}

/**
 * Solve a cyclic tridiagonal system using the Sherman-Morrison formula.
 * A·x = d where A is NxN cyclic tridiagonal.
 */
function solveCyclicTridiagonal(
  a: number[], b: number[], c: number[], d: number[],
): number[] {
  const N = a.length;
  if (N === 1) return [d[0] / b[0]];

  const gamma = -b[0];

  // Modified diagonal
  const bb = [...b];
  bb[0] = b[0] - gamma;
  bb[N - 1] = b[N - 1] - a[0] * c[N - 1] / gamma;

  // Solve Ay = d with modified A
  const y = solveTridiagonal(a, bb, c, d);

  // Solve Au = u_vec
  const u = new Array(N).fill(0);
  u[0] = gamma;
  u[N - 1] = c[N - 1];
  const z = solveTridiagonal(a, bb, c, u);

  // Apply Sherman-Morrison
  const factor = (y[0] + a[0] * y[N - 1] / gamma) /
    (1 + z[0] + a[0] * z[N - 1] / gamma);

  const x = new Array(N);
  for (let i = 0; i < N; i++) {
    x[i] = y[i] - factor * z[i];
  }

  return x;
}

/**
 * Solve a tridiagonal system using Thomas algorithm.
 * a[i] = sub-diagonal (a[0] unused)
 * b[i] = diagonal
 * c[i] = super-diagonal (c[N-1] unused)
 * d[i] = right-hand side
 */
function solveTridiagonal(
  a: number[], b: number[], c: number[], d: number[],
): number[] {
  const N = b.length;
  const cp = new Array(N);
  const dp = new Array(N);
  const x = new Array(N);

  cp[0] = c[0] / b[0];
  dp[0] = d[0] / b[0];

  for (let i = 1; i < N; i++) {
    const denom = b[i] - a[i] * cp[i - 1];
    cp[i] = c[i] ? c[i] / denom : 0;
    dp[i] = (d[i] - a[i] * dp[i - 1]) / denom;
  }

  x[N - 1] = dp[N - 1];
  for (let i = N - 2; i >= 0; i--) {
    x[i] = dp[i] - cp[i] * x[i + 1];
  }

  return x;
}
