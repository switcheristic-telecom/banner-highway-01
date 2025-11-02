import * as THREE from 'three';

export class HighwaySpline {
  branchId: string;
  points: THREE.Vector3[];
  spline: THREE.CatmullRomCurve3;
  length: number;
  lengthSegments: number;
  arcLengthDivisions: number;

  constructor(points: THREE.Vector3[], branchId: string) {
    this.branchId = branchId;
    this.points = points;

    // Create CatmullRom spline for smooth curves
    this.spline = new THREE.CatmullRomCurve3(
      this.points,
      false,
      'catmullrom',
      0.5
    );

    // Cache for performance
    this.length = this.spline.getLength();
    this.lengthSegments = 100;
    this.arcLengthDivisions = 200;
  }

  getPoint(t: number): THREE.Vector3 {
    return this.spline.getPoint(t);
  }

  getTangent(t: number): THREE.Vector3 {
    return this.spline.getTangent(t);
  }

  getNormal(t: number): THREE.Vector3 {
    const tangent = this.getTangent(t);
    // Calculate normal in XZ plane (perpendicular to tangent)
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
    return normal.normalize();
  }

  getPoints(divisions = 50): THREE.Vector3[] {
    return this.spline.getPoints(divisions);
  }

  getSpacedPoints(divisions = 50): THREE.Vector3[] {
    return this.spline.getSpacedPoints(divisions);
  }

  getLength(): number {
    return this.length;
  }

  // Get the closest point on the spline to a given position
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

  // Get frenet frames for proper orientation along the spline
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

  // Create a tube geometry from the spline (useful for visualization)
  createTubeGeometry(radius = 1, radialSegments = 8, tubularSegments = 50) {
    return new THREE.TubeGeometry(
      this.spline,
      tubularSegments,
      radius,
      radialSegments,
      false
    );
  }

  // Subdivide the spline for smoother curves
  subdivide(iterations = 1) {
    let points = [...this.points];

    for (let iter = 0; iter < iterations; iter++) {
      const newPoints: THREE.Vector3[] = [];

      for (let i = 0; i < points.length - 1; i++) {
        newPoints.push(points[i]);

        // Add midpoint
        const midpoint = new THREE.Vector3().lerpVectors(
          points[i],
          points[i + 1],
          0.5
        );
        newPoints.push(midpoint);
      }

      newPoints.push(points[points.length - 1]);
      points = newPoints;
    }

    this.points = points;
    this.spline = new THREE.CatmullRomCurve3(
      this.points,
      false,
      'catmullrom',
      0.5
    );
    this.length = this.spline.getLength();
  }
}
