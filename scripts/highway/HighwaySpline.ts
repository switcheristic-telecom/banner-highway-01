import * as THREE from 'three';
import type { RoadWaypoint } from '@/constants/types';
import {
  type SplineSolution,
  solvePeriodicSpline,
  solveOpenSpline,
} from './PeriodicSplineSolver';

interface SamplePoint {
  x: number;
  z: number;
  tx: number;
  tz: number;
  cumLen: number;
}

export class HighwaySpline {
  branchId: string;
  waypoints: RoadWaypoint[];
  isCyclic: boolean;
  headings: number[];
  samples: SamplePoint[];
  length: number;

  private spline: SplineSolution;
  private sampleCount: number;

  constructor(waypoints: RoadWaypoint[], branchId: string, isCyclic = false) {
    this.branchId = branchId;
    this.waypoints = waypoints;
    this.isCyclic = isCyclic;
    this.sampleCount = Math.max(500, waypoints.length * 80);

    this.spline = isCyclic
      ? solvePeriodicSpline(waypoints)
      : solveOpenSpline(waypoints);
    this.headings = this.spline.headings;

    this.samples = this.buildSampleTable();
    this.length = this.samples.length > 0
      ? this.samples[this.samples.length - 1].cumLen
      : 0;
  }

  /**
   * Evaluate the Hermite cubic spline for segment i at local parameter u ∈ [0, 1].
   * Returns position and tangent direction.
   */
  private hermiteEval(segIdx: number, u: number): { x: number; z: number; tx: number; tz: number } {
    const N = this.waypoints.length;
    const i = segIdx;
    const j = this.isCyclic ? (i + 1) % N : i + 1;
    const h = this.spline.chordLengths[i];

    const x0 = this.waypoints[i].x, z0 = this.waypoints[i].z;
    const x1 = this.waypoints[j].x, z1 = this.waypoints[j].z;
    const mx0 = this.spline.dxdt[i] * h, mz0 = this.spline.dzdt[i] * h;
    const mx1 = this.spline.dxdt[j] * h, mz1 = this.spline.dzdt[j] * h;

    const u2 = u * u, u3 = u2 * u;

    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;

    const x = h00 * x0 + h10 * mx0 + h01 * x1 + h11 * mx1;
    const z = h00 * z0 + h10 * mz0 + h01 * z1 + h11 * mz1;

    const dh00 = 6 * u2 - 6 * u;
    const dh10 = 3 * u2 - 4 * u + 1;
    const dh01 = -6 * u2 + 6 * u;
    const dh11 = 3 * u2 - 2 * u;

    const tx = dh00 * x0 + dh10 * mx0 + dh01 * x1 + dh11 * mx1;
    const tz = dh00 * z0 + dh10 * mz0 + dh01 * z1 + dh11 * mz1;

    return { x, z, tx, tz };
  }

  private buildSampleTable(): SamplePoint[] {
    const N = this.waypoints.length;
    const segCount = this.isCyclic ? N : N - 1;
    if (segCount === 0) return [];

    const totalChord = this.spline.chordLengths.reduce(
      (s, c, i) => s + (i < segCount ? c : 0), 0,
    );

    const samples: SamplePoint[] = [];
    let cumLen = 0;

    for (let si = 0; si < segCount; si++) {
      const h = this.spline.chordLengths[si];
      const segSamples = Math.max(10, Math.round(this.sampleCount * (h / totalChord)));

      for (let k = 0; k <= segSamples; k++) {
        if (si > 0 && k === 0) continue;

        const u = k / segSamples;
        const { x, z, tx, tz } = this.hermiteEval(si, u);

        if (samples.length > 0) {
          const prev = samples[samples.length - 1];
          const dx = x - prev.x;
          const dz = z - prev.z;
          cumLen += Math.sqrt(dx * dx + dz * dz);
        }

        samples.push({ x, z, tx, tz, cumLen });
      }
    }

    return samples;
  }

  /**
   * Map global parameter t ∈ [0, 1] to a sample point via arc-length interpolation.
   */
  private sampleAtT(t: number): { x: number; z: number; tx: number; tz: number } {
    if (this.samples.length === 0) return { x: 0, z: 0, tx: 1, tz: 0 };

    if (this.isCyclic) {
      t = ((t % 1) + 1) % 1;
    } else {
      t = Math.max(0, Math.min(1, t));
    }

    const targetLen = t * this.length;

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
      return { x: s0.x, z: s0.z, tx: s0.tx, tz: s0.tz };
    }

    const alpha = (targetLen - s0.cumLen) / segLen;
    return {
      x: s0.x + alpha * (s1.x - s0.x),
      z: s0.z + alpha * (s1.z - s0.z),
      tx: s0.tx + alpha * (s1.tx - s0.tx),
      tz: s0.tz + alpha * (s1.tz - s0.tz),
    };
  }

  getPoint(t: number): THREE.Vector3 {
    const p = this.sampleAtT(t);
    return new THREE.Vector3(p.x, 0, p.z);
  }

  getTangent(t: number): THREE.Vector3 {
    const p = this.sampleAtT(t);
    return new THREE.Vector3(p.tx, 0, p.tz).normalize();
  }

  getNormal(t: number): THREE.Vector3 {
    const tangent = this.getTangent(t);
    return new THREE.Vector3(-tangent.z, 0, tangent.x);
  }

  getPoints(divisions = 50): THREE.Vector3[] {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= divisions; i++) {
      pts.push(this.getPoint(i / divisions));
    }
    return pts;
  }

  getSpacedPoints(divisions = 50): THREE.Vector3[] {
    return this.getPoints(divisions);
  }

  getLength(): number {
    return this.length;
  }

  getClosestPoint(position: THREE.Vector3): {
    point: THREE.Vector3 | null;
    t: number;
    distance: number;
  } {
    let minDistance = Infinity;
    let closestT = 0;
    let closestPoint: THREE.Vector3 | null = null;

    const testCount = 200;
    for (let i = 0; i <= testCount; i++) {
      const t = i / testCount;
      const point = this.getPoint(t);
      const distance = position.distanceTo(point);

      if (distance < minDistance) {
        minDistance = distance;
        closestT = t;
        closestPoint = point;
      }
    }

    return { point: closestPoint, t: closestT, distance: minDistance };
  }

  getFrenetFrames(segments = 50) {
    const frames = {
      tangents: [] as THREE.Vector3[],
      normals: [] as THREE.Vector3[],
      binormals: [] as THREE.Vector3[],
    };

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const tangent = this.getTangent(t);
      const normal = this.getNormal(t);
      const binormal = new THREE.Vector3()
        .crossVectors(tangent, normal)
        .normalize();

      frames.tangents.push(tangent);
      frames.normals.push(normal);
      frames.binormals.push(binormal);
    }

    return frames;
  }

  createTubeGeometry(radius = 1, radialSegments = 8, tubularSegments = 50) {
    const path = new THREE.CurvePath<THREE.Vector3>();
    const pts = this.getPoints(tubularSegments);
    for (let i = 0; i < pts.length - 1; i++) {
      path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    }
    return new THREE.TubeGeometry(path, tubularSegments, radius, radialSegments, this.isCyclic);
  }
}
