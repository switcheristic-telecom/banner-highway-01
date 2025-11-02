import * as THREE from 'three';
import { HighwaySpline } from './HighwaySpline';

interface HighwayMeshOptions {
  width: number;
  segments: number;
  blockMaterial: THREE.Material;
  edgeMaterial: THREE.Material;
}

export class HighwayMesh {
  spline: HighwaySpline;
  width: number;
  segments: number;
  blockMaterial: THREE.Material;
  blockMesh: THREE.Mesh;
  edgeMaterial: THREE.Material;
  edgeLinesGroup: THREE.Group;

  constructor(spline: HighwaySpline, options: HighwayMeshOptions) {
    this.spline = spline;
    this.width = options.width;
    this.segments = options.segments;
    this.blockMaterial = options.blockMaterial;
    this.edgeMaterial = options.edgeMaterial;

    this.blockMesh = this.createBlockMesh();
    this.edgeLinesGroup = this.createEdgeLinesGroup();
  }

  createBlockMesh() {
    const geometry = this.createBlockGeometry();
    const blockMesh = new THREE.Mesh(geometry, this.blockMaterial);
    blockMesh.receiveShadow = true;
    blockMesh.castShadow = false;
    return blockMesh;
  }

  createBlockGeometry() {
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Generate vertices along the spline
    for (let i = 0; i <= this.segments; i++) {
      const t = i / this.segments;
      const point = this.spline.getPoint(t);
      const tangent = this.spline.getTangent(t);
      const normal = this.spline.getNormal(t);

      // Create two vertices for the road width
      const halfWidth = this.width / 2;

      // Left side
      const leftPoint = point
        .clone()
        .add(normal.clone().multiplyScalar(-halfWidth));
      vertices.push(leftPoint.x, leftPoint.y, leftPoint.z);

      // Right side
      const rightPoint = point
        .clone()
        .add(normal.clone().multiplyScalar(halfWidth));
      vertices.push(rightPoint.x, rightPoint.y, rightPoint.z);

      // Normals (pointing up)
      normals.push(0, 1, 0);
      normals.push(0, 1, 0);

      // UVs
      const u = t;
      uvs.push(0, u);
      uvs.push(1, u);
    }

    // Create indices for triangles
    for (let i = 0; i < this.segments; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;

      // Two triangles per segment
      indices.push(a, c, b);
      indices.push(b, c, d);
    }

    // Create BufferGeometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(normals, 3)
    );
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    // Compute additional attributes
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();

    return geometry;
  }

  createEdgeLinesGroup() {
    const edgeLinesGroup = new THREE.Group();
    const halfWidth = this.width / 2;
    const lineThickness = 0.15; // Thickness of the edge line (adjustable)
    const lineHeight = 0.1; // Height of the edge line

    // Material for the edge strips
    const edgeMaterial = this.edgeMaterial;

    // Create geometry for left edge strip
    const leftVertices: number[] = [];
    const leftIndices: number[] = [];
    const leftNormals: number[] = [];
    const leftUvs: number[] = [];

    // Create geometry for right edge strip
    const rightVertices: number[] = [];
    const rightIndices: number[] = [];
    const rightNormals: number[] = [];
    const rightUvs: number[] = [];

    // Generate vertices along the spline
    for (let i = 0; i <= this.segments; i++) {
      const t = i / this.segments;
      const point = this.spline.getPoint(t);
      const normal = this.spline.getNormal(t);

      // Left edge strip (outer and inner edge)
      const leftOuter = point
        .clone()
        .add(normal.clone().multiplyScalar(-halfWidth - lineThickness / 2));
      const leftInner = point
        .clone()
        .add(normal.clone().multiplyScalar(-halfWidth + lineThickness / 2));

      leftOuter.y += 0.05;
      leftInner.y += 0.05;

      leftVertices.push(leftOuter.x, leftOuter.y, leftOuter.z);
      leftVertices.push(leftInner.x, leftInner.y, leftInner.z);
      leftNormals.push(0, 1, 0, 0, 1, 0);
      leftUvs.push(0, t, 1, t);

      // Right edge strip (inner and outer edge)
      const rightInner = point
        .clone()
        .add(normal.clone().multiplyScalar(halfWidth - lineThickness / 2));
      const rightOuter = point
        .clone()
        .add(normal.clone().multiplyScalar(halfWidth + lineThickness / 2));

      rightInner.y += 0.05;
      rightOuter.y += 0.05;

      rightVertices.push(rightInner.x, rightInner.y, rightInner.z);
      rightVertices.push(rightOuter.x, rightOuter.y, rightOuter.z);
      rightNormals.push(0, 1, 0, 0, 1, 0);
      rightUvs.push(0, t, 1, t);
    }

    // Create indices for triangle strips
    for (let i = 0; i < this.segments; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;

      // Two triangles per segment
      leftIndices.push(a, b, c);
      leftIndices.push(b, d, c);

      rightIndices.push(a, b, c);
      rightIndices.push(b, d, c);
    }

    // Create left edge mesh
    const leftGeometry = new THREE.BufferGeometry();
    leftGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(leftVertices, 3)
    );
    leftGeometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(leftNormals, 3)
    );
    leftGeometry.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute(leftUvs, 2)
    );
    leftGeometry.setIndex(leftIndices);

    const leftMesh = new THREE.Mesh(leftGeometry, edgeMaterial);
    leftMesh.layers.set(15); // Environment layer
    edgeLinesGroup.add(leftMesh);

    // Create right edge mesh
    const rightGeometry = new THREE.BufferGeometry();
    rightGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(rightVertices, 3)
    );
    rightGeometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(rightNormals, 3)
    );
    rightGeometry.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute(rightUvs, 2)
    );
    rightGeometry.setIndex(rightIndices);

    const rightMesh = new THREE.Mesh(rightGeometry, edgeMaterial.clone());
    rightMesh.layers.set(15); // Environment layer
    edgeLinesGroup.add(rightMesh);

    return edgeLinesGroup;
  }

  dispose() {
    this.blockMesh.geometry.dispose();
    this.edgeLinesGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        child.material.dispose();
      }
    });
    this.blockMaterial.dispose();
    this.edgeMaterial.dispose();
  }
}
