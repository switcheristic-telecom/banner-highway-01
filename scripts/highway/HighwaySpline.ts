import * as THREE from 'three';
import type { PathNode, Vec3 } from '@/constants/highway';

function toVec3(v: Vec3): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.y, v.z);
}

export class HighwaySpline {
  branchId: string;
  nodes: PathNode[];
  curvePath: THREE.CurvePath<THREE.Vector3>;
  length: number;

  constructor(nodes: PathNode[], branchId: string) {
    this.branchId = branchId;
    this.nodes = nodes;

    // Build a CurvePath from chained CubicBezierCurve3 segments
    this.curvePath = new THREE.CurvePath<THREE.Vector3>();

    for (let i = 0; i < nodes.length - 1; i++) {
      const segment = new THREE.CubicBezierCurve3(
        toVec3(nodes[i].position),
        toVec3(nodes[i].handleOut),
        toVec3(nodes[i + 1].handleIn),
        toVec3(nodes[i + 1].position)
      );
      this.curvePath.add(segment);
    }

    // Cache length
    this.length = this.curvePath.getLength();
  }

  getPoint(t: number): THREE.Vector3 {
    return this.curvePath.getPoint(t);
  }

  getTangent(t: number): THREE.Vector3 {
    return this.curvePath.getTangent(t);
  }

  getNormal(t: number): THREE.Vector3 {
    const tangent = this.getTangent(t);
    // Calculate normal in XZ plane (perpendicular to tangent)
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
    return normal.normalize();
  }

  getPoints(divisions = 50): THREE.Vector3[] {
    return this.curvePath.getPoints(divisions);
  }

  getSpacedPoints(divisions = 50): THREE.Vector3[] {
    return this.curvePath.getSpacedPoints(divisions);
  }

  getLength(): number {
    return this.length;
  }

  // Get the closest point on the curve to a given position
  getClosestPoint(position: THREE.Vector3): {
    point: THREE.Vector3 | null;
    t: number;
    distance: number;
  } {
    let minDistance = Infinity;
    let closestT = 0;
    let closestPoint: THREE.Vector3 | null = null;

    const samples = 100;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
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

  // Get frenet frames for proper orientation along the curve
  getFrenetFrames(segments = 50) {
    const frames = {
      tangents: [] as THREE.Vector3[],
      normals: [] as THREE.Vector3[],
      binormals: [] as THREE.Vector3[],
    };

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const tangent = this.getTangent(t);

      // Calculate normal and binormal
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const binormal = new THREE.Vector3()
        .crossVectors(tangent, normal)
        .normalize();

      frames.tangents.push(tangent);
      frames.normals.push(normal);
      frames.binormals.push(binormal);
    }

    return frames;
  }

  // Create a tube geometry from the curve (useful for visualization)
  createTubeGeometry(radius = 1, radialSegments = 8, tubularSegments = 50) {
    return new THREE.TubeGeometry(
      this.curvePath,
      tubularSegments,
      radius,
      radialSegments,
      false
    );
  }
}
