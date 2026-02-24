import type { RoadWaypoint } from './types';
import {
  type SplineSolution,
  solvePeriodicSpline,
  solveOpenSpline,
} from './spline-solver';
import {
  fitClothoidG1,
  clothoidEvalXZ,
  clothoidEvalTheta,
  clothoidEvalTangent,
  clothoidEvalKappa,
  type ClothoidSegment,
} from './clothoid';

interface SamplePoint {
  x: number;
  z: number;
  tx: number;
  tz: number;
  heading: number;
  curvature: number;
  cumLen: number;
}

export class RoadSpline {
  readonly roadId: string;
  readonly waypoints: RoadWaypoint[];
  readonly isCyclic: boolean;
  readonly headings: number[];
  readonly clothoids: ClothoidSegment[];
  readonly samples: SamplePoint[];
  readonly totalLength: number;

  constructor(waypoints: RoadWaypoint[], roadId: string, isCyclic = false) {
    this.roadId = roadId;
    this.waypoints = waypoints;
    this.isCyclic = isCyclic;

    if (waypoints.length < 2) {
      this.headings = waypoints.map(() => 0);
      this.clothoids = [];
      this.samples = [];
      this.totalLength = 0;
      return;
    }

    // Step 1: Compute headings via tridiagonal solver
    const solution: SplineSolution = isCyclic
      ? solvePeriodicSpline(waypoints)
      : solveOpenSpline(waypoints);
    this.headings = solution.headings;

    // Step 2: Fit clothoid segments between consecutive waypoints
    this.clothoids = this.buildClothoidSegments();

    // Step 3: Build arc-length lookup table
    const sampleCount = Math.max(1600, waypoints.length * 80);
    this.samples = this.buildSampleTable(sampleCount);
    this.totalLength = this.samples.length > 0
      ? this.samples[this.samples.length - 1].cumLen
      : 0;
  }

  private buildClothoidSegments(): ClothoidSegment[] {
    const N = this.waypoints.length;
    const segCount = this.isCyclic ? N : N - 1;
    const segments: ClothoidSegment[] = [];

    for (let i = 0; i < segCount; i++) {
      const j = (i + 1) % N;
      const seg = fitClothoidG1(
        this.waypoints[i].x, this.waypoints[i].z, this.headings[i],
        this.waypoints[j].x, this.waypoints[j].z, this.headings[j],
      );
      if (seg) {
        segments.push(seg);
      } else {
        // Degenerate case: zero-length segment
        segments.push({
          x0: this.waypoints[i].x,
          z0: this.waypoints[i].z,
          theta0: this.headings[i],
          kappa0: 0,
          sigma: 0,
          length: 0,
        });
      }
    }

    return segments;
  }

  private buildSampleTable(totalSamples: number): SamplePoint[] {
    if (this.clothoids.length === 0) return [];

    const segLengths = this.clothoids.map(c => c.length);
    const totalClothoidLen = segLengths.reduce((a, b) => a + b, 0);
    if (totalClothoidLen < 1e-12) return [];

    const samples: SamplePoint[] = [];
    let cumLen = 0;

    for (let si = 0; si < this.clothoids.length; si++) {
      const seg = this.clothoids[si];
      const segSamples = Math.max(10, Math.round(totalSamples * (seg.length / totalClothoidLen)));

      for (let k = 0; k <= segSamples; k++) {
        if (si > 0 && k === 0) continue;

        const localS = (k / segSamples) * seg.length;
        const pt = clothoidEvalXZ(seg, localS);
        const tangent = clothoidEvalTangent(seg, localS);
        const heading = clothoidEvalTheta(seg, localS);
        const curvature = clothoidEvalKappa(seg, localS);

        if (samples.length > 0) {
          const prev = samples[samples.length - 1];
          const dx = pt.x - prev.x;
          const dz = pt.z - prev.z;
          cumLen += Math.sqrt(dx * dx + dz * dz);
        }

        samples.push({
          x: pt.x, z: pt.z,
          tx: tangent.dx, tz: tangent.dz,
          heading, curvature, cumLen,
        });
      }
    }

    return samples;
  }

  /**
   * Map global parameter t ∈ [0, 1] to a sample point via arc-length interpolation.
   */
  private sampleAtT(t: number): SamplePoint {
    if (this.samples.length === 0) {
      return { x: 0, z: 0, tx: 1, tz: 0, heading: 0, curvature: 0, cumLen: 0 };
    }

    if (this.isCyclic) {
      t = ((t % 1) + 1) % 1;
    } else {
      t = Math.max(0, Math.min(1, t));
    }

    const targetLen = t * this.totalLength;

    let lo = 0;
    let hi = this.samples.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (this.samples[mid].cumLen <= targetLen) lo = mid;
      else hi = mid;
    }

    const s0 = this.samples[lo];
    const s1 = this.samples[hi];
    const segLen = s1.cumLen - s0.cumLen;

    if (segLen < 1e-12) {
      return { ...s0 };
    }

    const alpha = (targetLen - s0.cumLen) / segLen;
    return {
      x: s0.x + alpha * (s1.x - s0.x),
      z: s0.z + alpha * (s1.z - s0.z),
      tx: s0.tx + alpha * (s1.tx - s0.tx),
      tz: s0.tz + alpha * (s1.tz - s0.tz),
      heading: s0.heading + alpha * (s1.heading - s0.heading),
      curvature: s0.curvature + alpha * (s1.curvature - s0.curvature),
      cumLen: targetLen,
    };
  }

  getPoint(t: number): { x: number; z: number } {
    const p = this.sampleAtT(t);
    return { x: p.x, z: p.z };
  }

  getTangent(t: number): { x: number; z: number } {
    const p = this.sampleAtT(t);
    const len = Math.sqrt(p.tx * p.tx + p.tz * p.tz) || 1;
    return { x: p.tx / len, z: p.tz / len };
  }

  getNormal(t: number): { x: number; z: number } {
    const tangent = this.getTangent(t);
    return { x: -tangent.z, z: tangent.x };
  }

  getHeading(t: number): number {
    return this.sampleAtT(t).heading;
  }

  getCurvature(t: number): number {
    return this.sampleAtT(t).curvature;
  }

  getLength(): number {
    return this.totalLength;
  }

  /**
   * Find the closest point on the spline to a world-space position.
   */
  getClosestT(worldX: number, worldZ: number, testCount = 500): { t: number; dist: number } {
    let bestT = 0;
    let bestDist = Infinity;

    for (let i = 0; i <= testCount; i++) {
      const t = i / testCount;
      const pt = this.getPoint(t);
      const dx = pt.x - worldX;
      const dz = pt.z - worldZ;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestDist) {
        bestDist = d;
        bestT = t;
      }
    }

    return { t: bestT, dist: bestDist };
  }

  /**
   * Get evenly spaced points along the spline.
   */
  getPoints(divisions = 50): Array<{ x: number; z: number }> {
    const pts: Array<{ x: number; z: number }> = [];
    for (let i = 0; i <= divisions; i++) {
      pts.push(this.getPoint(i / divisions));
    }
    return pts;
  }
}
